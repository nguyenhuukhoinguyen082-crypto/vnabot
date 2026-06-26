const { SlashCommandBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const { getFlights } = require('../firebase');
const { FOOTER, COLORS, STATUS_EMOJI } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('flights')
    .setDescription('View all upcoming Vietnam Airlines Group | PTFS flights'),

  async execute(interaction) {
    await interaction.deferReply();

    const flights = await getFlights();
    const active = flights.filter(f => f.status !== 'cancelled' && f.status !== 'ended');

    if (!active.length) {
      return interaction.editReply({
        components: [new TextDisplayBuilder().setContent('> No flights scheduled right now. Check back later!')],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.primary)
      .addTextDisplayComponents(td => td.setContent('# Vietnam Airlines Group | PTFS - Flights'))
      .addTextDisplayComponents(td => td.setContent(`> **${active.length}** flight(s) currently available for booking.`));

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

      container.addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
      container.addTextDisplayComponents(td => td.setContent(`### ${statusEmoji} Flight ${fn} - ${origin} to ${dest}`));
      container.addTextDisplayComponents(td => td.setContent(`> **Time:** \`${time}\``));
      container.addTextDisplayComponents(td => td.setContent(`> **Aircraft:** \`${aircraft}\``));
      container.addTextDisplayComponents(td => td.setContent(`> **Gate:** \`${gate}\``));
      container.addTextDisplayComponents(td => td.setContent(`> **Business:** \`${business}\``));
      container.addTextDisplayComponents(td => td.setContent(`> **Status:** \`${status}\``));
      container.addTextDisplayComponents(td => td.setContent(`> **Bookings:** \`${bookings}\``));
    }

    container.addTextDisplayComponents(td => td.setContent(`-# Use /book to book a flight · ${FOOTER}`));

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
