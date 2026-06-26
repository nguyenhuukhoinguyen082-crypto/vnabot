const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ContainerBuilder, TextDisplayBuilder } = require('discord.js');
const { getFlight, deleteFlight, getBookings, deleteFlightBookings, getEvents, deleteEvent } = require('../firebase');
const { FOOTER, COLORS } = require('../config');
const utils = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deleteflight')
    .setDescription('[STAFF] Permanently delete a flight from the database (use for test flights)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt => opt.setName('flightnumber').setDescription('Flight number to delete (e.g. VJ100)').setRequired(true))
    .addBooleanOption(opt => opt.setName('confirm').setDescription('Confirm permanent deletion').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!utils.staffCheck(interaction)) {
      return interaction.editReply({ content: '> You do not have permission to use this command.' });
    }

    const flightNumber = interaction.options.getString('flightnumber').toUpperCase();
    const confirm = interaction.options.getBoolean('confirm');

    if (!confirm) {
      return interaction.editReply({ content: '> Set `confirm` to `true` to permanently delete this flight. This cannot be undone — unlike `/cancelflight`, this removes it from the database entirely.' });
    }

    const flight = await getFlight(flightNumber);
    if (!flight) {
      return interaction.editReply({ content: `> Flight **${flightNumber}** not found.` });
    }

    // Count bookings that will be removed
    const bookings = await getBookings(flight.id);

    // Find and delete any linked event + its Discord Scheduled Event
    const allEvents = await getEvents();
    const linkedEvent = allEvents.find(e =>
      (e.flight_number || '').toUpperCase() === flightNumber || e.flight_id === flight.id
    );

    let discordEventDeleted = false;
    if (linkedEvent?.discord_event_id) {
      try {
        const discordEvent = await interaction.guild.scheduledEvents.fetch(linkedEvent.discord_event_id).catch(() => null);
        if (discordEvent) {
          await discordEvent.delete();
          discordEventDeleted = true;
        }
      } catch (err) {
        console.error('Failed to delete Discord event:', err.message);
      }
    }

    if (linkedEvent) {
      await deleteEvent(linkedEvent.id);
    }

    // Delete all bookings tied to this flight
    await deleteFlightBookings(flight.id);

    // Delete the flight itself
    await deleteFlight(flight.id);

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.danger)
      .addTextDisplayComponents(
        td => td.setContent('# Flight Permanently Deleted'),
        td => td.setContent(`> **✈️ Flight:** ${flightNumber}`),
        td => td.setContent(`> **🛩️ Route:** ${flight.origin || 'N/A'} → ${flight.destination || 'N/A'}`),
        td => td.setContent(`> **Bookings Removed:** ${bookings.length}`),
        td => td.setContent(`> **Linked Event:** ${linkedEvent ? 'Removed from database' : 'None found'}`),
        td => td.setContent(`> **Discord Event:** ${linkedEvent?.discord_event_id ? (discordEventDeleted ? 'Also deleted from Discord' : 'Could not delete from Discord') : 'N/A'}`),
        td => td.setContent(`-# Deleted by ${interaction.user.username} • ${FOOTER}`),
      );

    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
