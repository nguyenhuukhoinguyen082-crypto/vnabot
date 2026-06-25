const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getFlight, updateFlight } = require('../firebase');
require('dotenv').config();

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

    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
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

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('✈️ Flight Cancelled')
      .addFields(
        { name: '✈️ Flight', value: flightNumber, inline: true },
        { name: '🗺️ Route', value: `${flight.origin} → ${flight.destination}`, inline: true },
        { name: '📋 New Status', value: '❌ Cancelled', inline: true },
        {
          name: '\u200b',
          value: '> Bookings are now **closed**. The flight is marked as cancelled in the system.',
        },
      )
      .setFooter({ text: `Cancelled by ${interaction.user.username} • Vietnam Airlines Group | PTFS` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
