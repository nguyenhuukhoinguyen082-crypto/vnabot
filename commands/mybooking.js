const { SlashCommandBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const { getBookings } = require('../firebase');
const { FOOTER, COLORS } = require('../config');

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
        content: '> You have no active bookings.\n> Use `/book flight` to book a flight!',
      });
    }

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.success)
      .addTextDisplayComponents(
        td => td.setContent('# Your Bookings'),
        td => td.setContent(`> You have **${myBookings.length}** active booking(s).`),
      )
      .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small));

    for (const booking of myBookings) {
      const classLabel = booking.seat_class === 'business' ? 'Business' : 'Economy';
      container.addTextDisplayComponents(td => td.setContent([
        `> **${booking.flight_number} — ${booking.origin} > ${booking.destination}**`,
        `> **Booking Code:** \`${booking.booking_code}\``,
        `> **Seat:** \`${booking.seat}\` (${classLabel})`,
        `> **Time:** \`${booking.time || 'TBA'}\``,
        `> **Aircraft:** \`${booking.aircraft || 'N/A'}\``,
        `> **Status:** \`${booking.status || 'Confirmed'}\``,
        `> Cancel: \`/book cancel ${booking.flight_number} true\``,
      ].join('\n')));
      container.addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
    }

    container.addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
