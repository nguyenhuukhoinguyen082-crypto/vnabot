const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getEvents, rsvpEvent } = require('../firebase');

const TYPE_EMOJI = {
  'Group Flight': '✈️', 'Training': '📚',
  'Meeting': '🗣️', 'Special Event': '🎉', 'Other': '📋',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('events')
    .setDescription('View all upcoming Vietnam Airlines Group | PTFS events'),

  async execute(interaction) {
    await interaction.deferReply();
    const allEvents = await getEvents();
    const events = allEvents.filter(e => e.status !== 'ended' && e.status !== 'cancelled');

    if (!events.length) return interaction.editReply({ content: '📅 No upcoming events right now. Check back later!' });

    let page = 0;
    const total = events.length;

    function buildEmbed(index) {
      const event = events[index];
      const typeEmoji = TYPE_EMOJI[event.event_type] || '📅';
      const startTs = event.timestamp_start ? `<t:${Math.floor(event.timestamp_start / 1000)}:F>` : event.date_time || 'TBA';
      const endTs = event.timestamp_end ? `<t:${Math.floor(event.timestamp_end / 1000)}:R>` : null;
      const rsvpCount = Array.isArray(event.rsvps) ? event.rsvps.length : 0;

      const embed = new EmbedBuilder()
        .setColor(0x007B8A)
        .setTitle(`${typeEmoji} ${event.name || event.title || 'Unnamed Event'}`)
        .setDescription(event.short_description || event.full_description || 'No description.')
        .addFields(
          { name: '🕐 Start', value: startTs, inline: true },
          { name: '🏁 End', value: endTs || 'TBA', inline: true },
          { name: '🎭 Type', value: event.event_type || 'General', inline: true },
          { name: '👤 Host', value: event.host_name || 'TBA', inline: true },
          { name: '👥 RSVPs', value: `${rsvpCount}`, inline: true },
          { name: '📋 Status', value: event.status || 'Upcoming', inline: true },
        )
        .setFooter({ text: `Event ${index + 1} of ${total} • Use /rsvp ${event.id} to attend • Vietnam Airlines Group | PTFS` })
        .setTimestamp();

      if (event.banner_image) embed.setImage(event.banner_image);
      if (event.agenda) embed.addFields({ name: '📋 Agenda', value: event.agenda.slice(0, 1024), inline: false });
      if (event.discord_link) embed.addFields({ name: '🔗 Discord Event', value: `[Click to join](${event.discord_link})`, inline: true });
      if (event.flight_number) embed.addFields({ name: '✈️ Flight', value: event.flight_number, inline: true });
      return embed;
    }

    function buildRow(index) {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ev_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
        new ButtonBuilder().setCustomId('ev_rsvp').setLabel('RSVP ✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('ev_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(index === total - 1),
      );
    }

    const msg = await interaction.editReply({ embeds: [buildEmbed(page)], components: [buildRow(page)] });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
      filter: i => i.user.id === interaction.user.id,
    });

    collector.on('collect', async (btn) => {
      try {
        if (btn.customId === 'ev_prev') {
          page = Math.max(0, page - 1);
          await btn.update({ embeds: [buildEmbed(page)], components: [buildRow(page)] });
        } else if (btn.customId === 'ev_next') {
          page = Math.min(total - 1, page + 1);
          await btn.update({ embeds: [buildEmbed(page)], components: [buildRow(page)] });
        } else if (btn.customId === 'ev_rsvp') {
          const event = events[page];
          const result = await rsvpEvent(event.id, btn.user.id, btn.user.username);
          if (result === 'already') {
            await btn.reply({ content: `⚠️ Already RSVP'd to **${event.name}**!`, ephemeral: true });
          } else {
            await btn.reply({ content: `✅ RSVP'd to **${event.name}**! See you there! ✈️`, ephemeral: true });
          }
        }
      } catch (err) {
        console.error('Events collector error:', err.message);
      }
    });

    collector.on('end', () => { interaction.editReply({ components: [] }).catch(() => {}); });
  },
};
