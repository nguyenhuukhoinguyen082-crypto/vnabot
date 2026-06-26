const { SlashCommandBuilder, MessageFlags, ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getEvents, rsvpEvent } = require('../firebase');
const { FOOTER, COLORS } = require('../config');

const TYPE_EMOJI = {
  'Group Flight': '✈️', 'Training': '📚',
  'Meeting': '🎙️', 'Special Event': '🎉', 'Other': '📋',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('events')
    .setDescription('View all upcoming Vietnam Airlines Group | PTFS events'),

  async execute(interaction) {
    await interaction.deferReply();
    const allEvents = await getEvents();
    const events = allEvents.filter(e => e.status !== 'ended' && e.status !== 'cancelled');

    if (!events.length) return interaction.editReply({
      components: [new TextDisplayBuilder().setContent('📅 No upcoming events right now. Check back later!')],
      flags: MessageFlags.IsComponentsV2,
    });

    let page = 0;
    const total = events.length;

    function buildEventCard(index) {
      const event = events[index];
      const typeEmoji = TYPE_EMOJI[event.event_type] || '📅';
      const startTs = event.timestamp_start ? `<t:${Math.floor(event.timestamp_start / 1000)}:F>` : event.date_time || 'TBA';
      const endTs = event.timestamp_end ? `<t:${Math.floor(event.timestamp_end / 1000)}:R>` : null;
      const rsvpCount = Array.isArray(event.rsvps) ? event.rsvps.length : 0;
      const isFirst = index === 0;
      const isLast = index === total - 1;
      const title = event.name || event.title || 'Unnamed Event';

      const fields = [
        `> 🕐 **Start:** ${startTs}`,
        `> 🏁 **End:** ${endTs || 'TBA'}`,
        `> 🎭 **Type:** ${event.event_type || 'General'}`,
        `> 👤 **Host:** ${event.host_name || 'TBA'}`,
        `> 👥 **RSVPs:** ${rsvpCount}`,
        `> 📋 **Status:** ${event.status || 'Upcoming'}`,
      ].join('\n');

      const container = new ContainerBuilder().setAccentColor(COLORS.primary);

      if (event.banner_image) {
        container.addSectionComponents(section =>
          section
            .addTextDisplayComponents(
              td => td.setContent(`# ${typeEmoji} ${title}`),
              td => td.setContent(event.short_description || event.full_description || 'No description.'),
              td => td.setContent(fields),
            )
            .setThumbnailAccessory(thumb => thumb.setURL(event.banner_image))
        );
      } else {
        container.addTextDisplayComponents(
          td => td.setContent(`# ${typeEmoji} ${title}`),
          td => td.setContent(event.short_description || event.full_description || 'No description.'),
          td => td.setContent(fields),
        );
      }

      if (event.agenda) {
        container.addTextDisplayComponents(td => td.setContent(`> 📋 **Agenda:** ${event.agenda.slice(0, 1024)}`));
      }
      if (event.discord_link) {
        container.addTextDisplayComponents(td => td.setContent(`> 🔗 **Discord Event:** [Click to join](${event.discord_link})`));
      }
      if (event.flight_number) {
        container.addTextDisplayComponents(td => td.setContent(`> ✈️ **Flight:** ${event.flight_number}`));
      }

      container.addTextDisplayComponents(td => td.setContent(`-# Event ${index + 1} of ${total} · Use /rsvp ${event.id} to attend · ${FOOTER}`));
      container.addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
      container.addActionRowComponents(row =>
        row.addComponents(
          new ButtonBuilder().setCustomId('ev_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(isFirst),
          new ButtonBuilder().setCustomId('ev_rsvp').setLabel('RSVP ✅').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('ev_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(isLast),
        )
      );

      return [container];
    }

    const msg = await interaction.editReply({ components: buildEventCard(page), flags: MessageFlags.IsComponentsV2 });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
      filter: i => i.user.id === interaction.user.id,
    });

    collector.on('collect', async (btn) => {
      try {
        if (btn.customId === 'ev_prev') {
          page = Math.max(0, page - 1);
          await btn.update({ components: buildEventCard(page), flags: MessageFlags.IsComponentsV2 });
        } else if (btn.customId === 'ev_next') {
          page = Math.min(total - 1, page + 1);
          await btn.update({ components: buildEventCard(page), flags: MessageFlags.IsComponentsV2 });
        } else if (btn.customId === 'ev_rsvp') {
          const ev = events[page];
          const result = await rsvpEvent(ev.id, btn.user.id, btn.user.username);
          if (result === 'already') {
            await btn.reply({
              components: [new TextDisplayBuilder().setContent(`⚠️ Already RSVP'd to **${ev.name}**!`)],
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
          } else {
            await btn.reply({
              components: [new TextDisplayBuilder().setContent(`✅ RSVP'd to **${ev.name}**! See you there! ✈️`)],
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
          }
        }
      } catch (err) {
        console.error('Events collector error:', err.message);
      }
    });

    collector.on('end', () => { interaction.editReply({ components: [] }).catch(() => {}); });
  },
};
