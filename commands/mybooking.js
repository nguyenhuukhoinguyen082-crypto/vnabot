const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBookings } = require('../firebase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mybooking')
    .setDescription('Check your current flight bookings'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const allBookings = await getBookings();
    const myBookings = allBookings.filter(b => b.discord_id === interaction.user.id);

    if (!myBookings.length) {
      return interaction.editReply({
        content: `🎫 You have no active bookings.\nUse \`/book flight [flightnumber] [class] [seat]\` to book a flight!`,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x00B050)
      .setTitle('🎫 Your Bookings')
      .setDescription(`You have **${myBookings.length}** active booking(s).`)
      .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
      .setTimestamp();

    for (const booking of myBookings) {
      const classLabel = booking.seat_class === 'business' ? '💼 Business' : '💺 Economy';
      embed.addFields({
        name: `✈️ Flight ${booking.flight_number} — ${booking.origin} → ${booking.destination}`,
        value: [
          `> 🎫 **Booking Code:** \`${booking.booking_code}\``,
          `> 💺 **Seat:** ${booking.seat} (${classLabel})`,
          `> 🕐 **Time:** ${booking.time || 'TBA'}`,
          `> 🛩️ **Aircraft:** ${booking.aircraft || 'N/A'}`,
          `> 📋 **Status:** ${booking.status || 'Confirmed'}`,
          `> ❌ To cancel: \`/book cancel ${booking.flight_number} true\``,
        ].join('\n'),
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
