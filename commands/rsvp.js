const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getEvents, rsvpEvent } = require('../firebase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rsvp')
    .setDescription('RSVP to a Vietnam Airlines Group | PTFS event')
    .addStringOption(opt =>
      opt.setName('event')
        .setDescription('Event ID or name to attend')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const query = interaction.options.getString('event').toLowerCase();
    const events = await getEvents();

    // Try to match by ID or name
    const event = events.find(e =>
      e.id.toLowerCase() === query ||
      (e.name || e.title || '').toLowerCase().includes(query)
    );

    if (!event) {
      // Show available events
      const embed = new EmbedBuilder()
        .setColor(0x007B8A)
        .setTitle('❌ Event Not Found')
        .setDescription(`Could not find event matching **"${query}"**.\n\nAvailable events:`)
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' });

      if (events.length) {
        embed.addFields(events.map(e => ({
          name: `📅 ${e.name || e.title || 'Unnamed Event'}`,
          value: `> ID: \`${e.id}\`\n> Date: ${e.date || e.event_date || 'TBA'}\n> Use \`/rsvp ${e.id}\` to attend`,
          inline: false,
        })));
      } else {
        embed.setDescription('No events are currently scheduled. Check back later!');
      }

      return interaction.editReply({ embeds: [embed] });
    }

    const result = await rsvpEvent(event.id, interaction.user.id, interaction.user.username);

    if (result === 'already') {
      return interaction.editReply({
        content: `⚠️ You've already RSVP'd to **${event.name || event.title}**! See you there! ✈️`,
      });
    }

    const rsvpCount = (event.rsvps?.length || 0) + 1;

    const embed = new EmbedBuilder()
      .setColor(0x00B050)
      .setTitle('✅ RSVP Confirmed!')
      .setDescription(`You're attending **${event.name || event.title || 'the event'}**!`)
      .setThumbnail('https://i.postimg.cc/SRMftcKS/vna.jpg')
      .addFields(
        { name: '📅 Event', value: event.name || event.title || 'N/A', inline: true },
        { name: '🗓️ Date', value: event.date || event.event_date || 'TBA', inline: true },
        { name: '🕐 Time', value: event.time || 'TBA', inline: true },
        { name: '✈️ Flight', value: event.flight_number || 'N/A', inline: true },
        { name: '👥 Attendees', value: `${rsvpCount}`, inline: true },
        {
          name: '\u200b',
          inline: false,
        },
      )
      .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
