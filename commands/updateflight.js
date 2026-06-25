const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getFlight, updateFlight } = require('../firebase');
require('dotenv').config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('updateflight')
    .setDescription('[STAFF] Update a flight\'s details')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt =>
      opt.setName('flightnumber').setDescription('Flight number to update (e.g. VJ100)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('field').setDescription('What to update').setRequired(true)
        .addChoices(
          { name: '🕐 Time', value: 'time' },
          { name: '🚪 Gate', value: 'gate' },
          { name: '📋 Status', value: 'status' },
          { name: '🛩️ Aircraft', value: 'aircraft' },
          { name: '🎫 Open Bookings', value: 'bookings_open' },
        ))
    .addStringOption(opt =>
      opt.setName('value').setDescription('New value (for bookings_open use: true or false)').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
    }

    const flightNumber = interaction.options.getString('flightnumber').toUpperCase();
    const field = interaction.options.getString('field');
    let value = interaction.options.getString('value');

    const flight = await getFlight(flightNumber);
    if (!flight) {
      return interaction.editReply({ content: `❌ Flight **${flightNumber}** not found.` });
    }

    // Handle boolean for bookings_open
    if (field === 'bookings_open') {
      if (value.toLowerCase() === 'true') value = true;
      else if (value.toLowerCase() === 'false') value = false;
      else return interaction.editReply({ content: '❌ For bookings_open, value must be `true` or `false`.' });
    }

    // Validate status values
    if (field === 'status') {
      const validStatuses = ['scheduled', 'on_time', 'delayed', 'boarding', 'departed', 'arrived', 'cancelled', 'ended'];
      if (!validStatuses.includes(value.toLowerCase())) {
        return interaction.editReply({
          content: `❌ Invalid status. Valid options: \`${validStatuses.join('`, `')}\``,
        });
      }
      value = value.toLowerCase();
    }

    await updateFlight(flight.id, { [field]: value });

    const fieldLabels = {
      time: '🕐 Time',
      gate: '🚪 Gate',
      status: '📋 Status',
      aircraft: '🛩️ Aircraft',
      bookings_open: '🎫 Bookings Open',
    };

    const embed = new EmbedBuilder()
      .setColor(0x00B050)
      .setTitle('✅ Flight Updated')
      .addFields(
        { name: '✈️ Flight', value: flightNumber, inline: true },
        { name: '🗺️ Route', value: `${flight.origin} → ${flight.destination}`, inline: true },
        { name: fieldLabels[field] || field, value: `${value}`, inline: true },
      )
      .setFooter({ text: `Updated by ${interaction.user.username} • Vietnam Airlines Group | PTFS` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
