const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getFlights } = require('../firebase');

const STATUS_EMOJI = {
  scheduled: '🕐',
  boarding: '🚪',
  departed: '✈️',
  arrived: '🛬',
  cancelled: '❌',
  delayed: '⏳',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('flights')
    .setDescription('View all upcoming Vietnam Airlines Group | PTFS flights'),

  async execute(interaction) {
    await interaction.deferReply();

    const flights = await getFlights();
    const active = flights.filter(f => f.status !== 'cancelled' && f.status !== 'ended');

    if (!active.length) {
      return interaction.editReply({ content: '✈️ No flights scheduled right now. Check back later!' });
    }

    const embed = new EmbedBuilder()
      .setColor(0x007B8A)
      .setTitle('🇻🇳 Vietnam Airlines Group | PTFS — Flights')
      .setDescription(`**${active.length}** flight(s) currently available for booking.`)
      .setThumbnail('https://i.postimg.cc/SRMftcKS/vna.jpg')
      .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao • Use /book to book a flight' })
      .setTimestamp();

    for (const flight of active) {
      const statusEmoji = STATUS_EMOJI[flight.status?.toLowerCase()] || '🕐';
      const fn = flight.flight_number || flight.flightNumber || 'N/A';
      const origin = flight.origin || flight.from || 'N/A';
      const dest = flight.destination || flight.to || 'N/A';
      const time = flight.time || flight.departure_time || 'TBA';
      const aircraft = flight.aircraft || 'N/A';
      const gate = flight.gate || 'TBA';
      const business = flight.has_business ? '✅' : '❌';
      const status = flight.status || 'Scheduled';
      const bookings = flight.bookings_open ? '✅ Open' : '❌ Closed';

      embed.addFields({
        name: `${statusEmoji} Flight ${fn} — ${origin} → ${dest}`,
        value: [
          `> 🕐 **Time:** ${time}`,
          `> ✈️ **Aircraft:** ${aircraft}`,
          `> 🚪 **Gate:** ${gate}`,
          `> 💼 **Business Class:** ${business}`,
          `> 📋 **Status:** ${status}`,
          `> 🎫 **Bookings:** ${bookings}`,
        ].join('\n'),
        inline: false,
      });
    }

    embed.addFields({
      name: '\u200b',
      inline: false,
    });

    await interaction.editReply({ embeds: [embed] });
  },
};
