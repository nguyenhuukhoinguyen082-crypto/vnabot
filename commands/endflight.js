const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ContainerBuilder, TextDisplayBuilder } = require('discord.js');
const { getFlight, updateFlight, getBookings, deleteFlightBookings } = require('../firebase');
const { FOOTER, COLORS } = require('../config');
const utils = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('endflight')
    .setDescription('[STAFF] End a flight — closes bookings and wipes all bookings for that flight')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt =>
      opt.setName('flightnumber').setDescription('Flight number to end (e.g. VJ100)').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!utils.staffCheck(interaction)) {
      return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
    }

    const flightNumber = interaction.options.getString('flightnumber').toUpperCase();
    const flight = await getFlight(flightNumber);

    if (!flight) {
      return interaction.editReply({ content: `❌ Flight **${flightNumber}** not found.` });
    }

    // Fetch bookings before deleting so we can notify passengers
    const bookings = await getBookings(flight.id);

    // Close bookings and mark as ended
    await updateFlight(flight.id, { status: 'ended', bookings_open: false });

    // Delete all bookings for this flight
    await deleteFlightBookings(flight.id);

    // Notify each passenger about the cancellation
    let notified = 0;
    for (const booking of bookings) {
      try {
        const passenger = await interaction.client.users.fetch(booking.discord_id).catch(() => null);
        if (passenger) {
          const dmContainer = new ContainerBuilder()
            .setAccentColor(COLORS.danger)
            .addTextDisplayComponents(
              td => td.setContent('# ✈️ Flight Cancelled'),
              td => td.setContent(`Your booking on flight **${flightNumber}** has been cancelled because the flight has ended.`),
              td => td.setContent(`> **✈️ Flight:** ${flightNumber}`),
              td => td.setContent(`> **💺 Seat:** ${booking.seat || 'N/A'}`),
              td => td.setContent(`> **🛩️ Route:** ${flight.origin} ✈️ ${flight.destination}`),
              td => td.setContent(`-# ${FOOTER}`),
            );
          await passenger.send({ components: [dmContainer], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
          notified++;
        }
      } catch { /* skip if DM fails */ }
    }

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.neutral)
      .addTextDisplayComponents(
        td => td.setContent('# 🛬 Flight Ended'),
        td => td.setContent(`> **✈️ Flight:** ${flightNumber}`),
        td => td.setContent(`> **🛩️ Route:** ${flight.origin} → ${flight.destination}`),
        td => td.setContent(`> **📋 Status:** 🛬 Ended`),
        td => td.setContent(`> All bookings for this flight have been **deleted**.`),
        td => td.setContent(`> Bookings are now **closed**.`),
        td => td.setContent(`-# ${notified} passenger(s) notified • Ended by ${interaction.user.username} • ${FOOTER}`),
      );

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
