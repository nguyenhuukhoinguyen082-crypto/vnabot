const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getFlight, updateFlight, deleteFlightBookings } = require('../firebase');
require('dotenv').config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('endflight')
    .setDescription('[STAFF] End a flight — closes bookings and wipes all bookings for that flight')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt =>
      opt.setName('flightnumber').setDescription('Flight number to end (e.g. VJ100)').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
    }

    const flightNumber = interaction.options.getString('flightnumber').toUpperCase();
    const flight = await getFlight(flightNumber);

    if (!flight) {
      return interaction.editReply({ content: `❌ Flight **${flightNumber}** not found.` });
    }

    // Close bookings and mark as ended
    await updateFlight(flight.id, { status: 'ended', bookings_open: false });

    // Delete all bookings for this flight
    await deleteFlightBookings(flight.id);

    const embed = new EmbedBuilder()
      .setColor(0x888888)
      .setTitle('🛬 Flight Ended')
      .addFields(
        { name: '✈️ Flight', value: flightNumber, inline: true },
        { name: '🗺️ Route', value: `${flight.origin} → ${flight.destination}`, inline: true },
        { name: '📋 Status', value: '🛬 Ended', inline: true },
        {
          name: '\u200b',
          value: '> All bookings for this flight have been **deleted**.\n> Bookings are now **closed**.',
        },
      )
      .setFooter({ text: `Ended by ${interaction.user.username} • Vietnam Airlines Group | PTFS` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
