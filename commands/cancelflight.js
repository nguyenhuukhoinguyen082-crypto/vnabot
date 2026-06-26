const { SlashCommandBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, PermissionFlagsBits } = require('discord.js');
const { getFlight, updateFlight } = require('../firebase');
const { FOOTER, COLORS } = require('../config');
const utils = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cancelflight')
    .setDescription('[STAFF] Cancel a flight')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt =>
      opt.setName('flightnumber').setDescription('Flight number to cancel (e.g. VJ100)').setRequired(true))
    .addBooleanOption(opt =>
      opt.setName('confirm').setDescription('Confirm cancellation').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!utils.staffCheck(interaction)) {
      return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
    }

    const flightNumber = interaction.options.getString('flightnumber').toUpperCase();
    const confirm = interaction.options.getBoolean('confirm');

    if (!confirm) {
      return interaction.editReply({ content: '⚠️ Cancellation not confirmed. Set `confirm` to `true` to proceed.' });
    }

    const flight = await getFlight(flightNumber);
    if (!flight) {
      return interaction.editReply({ content: `❌ Flight **${flightNumber}** not found.` });
    }

    await updateFlight(flight.id, { status: 'cancelled', bookings_open: false });

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.danger)
      .addTextDisplayComponents(td => td.setContent('# ✈️ Flight Cancelled'))
      .addTextDisplayComponents(td => td.setContent('> **✈️ Flight:** ' + flightNumber))
      .addTextDisplayComponents(td => td.setContent('> **🛫 Route:** ' + flight.origin + ' → ' + flight.destination))
      .addTextDisplayComponents(td => td.setContent('> **📋 New Status:** ❌ Cancelled'))
      .addTextDisplayComponents(td => td.setContent('> Bookings are now **closed**. The flight is marked as cancelled in the system.'))
      .addTextDisplayComponents(td => td.setContent('-# Cancelled by ' + interaction.user.username + ' • ' + FOOTER));

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
