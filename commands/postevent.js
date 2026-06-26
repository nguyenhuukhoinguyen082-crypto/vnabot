const {
  SlashCommandBuilder, MessageFlags, PermissionFlagsBits,
  ContainerBuilder, SectionBuilder,
  TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { getEvents } = require('../firebase');
const { FOOTER, COLORS } = require('../config');
const utils = require('../utils');

const TYPE_EMOJI = {
  'Group Flight': '✈️', 'Training': '📚',
  'Meeting': '🗣️', 'Special Event': '🎉', 'Other': '📋',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('postevent')
    .setDescription('[STAFF] Post an event announcement')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt => opt.setName('name').setDescription('Event name or ID').setRequired(true))
    .addStringOption(opt => opt.setName('channel').setDescription('Channel ID to post in (leave empty for current)').setRequired(false))
    .addRoleOption(opt => opt.setName('ping').setDescription('Role to ping').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!utils.staffCheck(interaction)) {
      return interaction.editReply({ content: '> You do not have permission to use this command.' });
    }

    const query = interaction.options.getString('name');
    const channelId = interaction.options.getString('channel');
    const pingRole = interaction.options.getRole('ping');

    const events = await getEvents();
    const event = events.find(e =>
      e.id === query ||
      (e.name || '').toLowerCase().includes(query.toLowerCase())
    );

    if (!event) {
      const list = events.map(e => `• **${e.name}** — \`${e.id}\``).join('\n');
      return interaction.editReply({ content: `> Event not found.\n\nAvailable:\n${list || 'None'}` });
    }

    const typeEmoji = TYPE_EMOJI[event.event_type] || '📅';
    const startTs = event.timestamp_start ? `<t:${Math.floor(event.timestamp_start / 1000)}:F>` : event.date_time || 'TBA';
    const endTs = event.timestamp_end ? `<t:${Math.floor(event.timestamp_end / 1000)}:F>` : event.end_time || 'TBA';
    const countdown = event.timestamp_start ? `<t:${Math.floor(event.timestamp_start / 1000)}:R>` : '';

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.primary)
      .addTextDisplayComponents(td => td.setContent(`# ${typeEmoji} ${event.name}`))
      .addTextDisplayComponents(td => td.setContent(event.short_description || event.full_description || 'Join us for this exciting event!'));

    if (event.banner_image) {
      container.addSectionComponents(section =>
        section
          .addTextDisplayComponents(td => td.setContent(' '))
          .setThumbnailAccessory(thumb => thumb.setURL(event.banner_image))
      );
    }

    container.addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(td => td.setContent(
        `> **Start:** ${startTs} ${countdown}\n` +
        `> **End:** ${endTs}\n` +
        `> **Type:** ${event.event_type || 'General'}\n` +
        `> **Host:** ${event.host_name || 'TBA'}\n` +
        `> **Flight:** ${event.flight_number || 'N/A'}\n` +
        `> **RSVP:** Use \`/rsvp ${event.id}\``
      ));

    if (event.full_description && event.short_description) {
      container.addTextDisplayComponents(td => td.setContent(`> **Details:** ${event.full_description.slice(0, 1024)}`));
    }
    if (event.agenda) {
      container.addTextDisplayComponents(td => td.setContent(`> **Agenda:** ${event.agenda.slice(0, 1024)}`));
    }

    container.addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

    const row = new ActionRowBuilder();
    if (event.discord_link) {
      row.addComponents(
        new ButtonBuilder().setLabel('Join Discord Event').setStyle(ButtonStyle.Link).setURL(event.discord_link).setEmoji('📅'),
      );
    }
    row.addComponents(
      new ButtonBuilder().setLabel('RSVP').setStyle(ButtonStyle.Success).setCustomId(`rsvp_${event.id}`).setEmoji('✅'),
    );

    let targetChannel;
    if (channelId) {
      targetChannel = await interaction.client.channels.fetch(channelId).catch(() => null);
      if (!targetChannel) return interaction.editReply({ content: `> Channel \`${channelId}\` not found.` });
    } else {
      targetChannel = interaction.channel;
    }

    const pingContent = pingRole ? `<@&${pingRole.id}>` : null;
    await targetChannel.send({
      content: pingContent,
      components: [container, row],
      flags: MessageFlags.IsComponentsV2,
    });

    await interaction.editReply({ content: `> Event **${event.name}** posted in <#${targetChannel.id}>!` });
  },
};
