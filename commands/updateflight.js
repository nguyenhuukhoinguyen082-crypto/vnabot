const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { getFlight, updateFlight, getFlightClasses, setFlightClasses } = require('../firebase');
const { FOOTER, COLORS, CLASS_CONFIG } = require('../config');
const utils = require('../utils');

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
          { name: '💳 Class Config', value: 'class_config' },
        ))
    .addStringOption(opt =>
      opt.setName('value').setDescription('New value (for bookings_open use: true or false)').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!utils.staffCheck(interaction)) {
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

    // Handle class config update
    if (field === 'class_config') {
      const classes = await getFlightClasses(flight.id) || {};
      const defs = CLASS_CONFIG;
      for (const cls of ['economy', 'premium_economy', 'business']) {
        if (!classes[cls]) classes[cls] = { ...defs[cls] };
      }

      // Parse value as JSON: {"economy": {"cost": 100000, "role_id": "123"}, ...}
      try {
        const parsed = JSON.parse(value);
        for (const cls of ['economy', 'premium_economy', 'business']) {
          if (parsed[cls]) {
            classes[cls] = { ...classes[cls], ...parsed[cls] };
          }
        }
      } catch {
        return interaction.editReply({
          content: '❌ For class_config, value must be valid JSON. Example: `{"economy":{"cost":100000,"role_id":"123"},"business":{"cost":500000}}`',
        });
      }

      await setFlightClasses(flight.id, classes);

      const classInfo = Object.entries(classes).map(([k, v]) =>
        `${v.emoji || '•'} ${v.label}: ${(v.cost || 0).toLocaleString()}₫${v.role_id ? ' · <@&' + v.role_id + '>' : ''}`
      ).join('\n');

      const container = new ContainerBuilder()
        .setAccentColor(COLORS.success)
        .addTextDisplayComponents(
          td => td.setContent('# ✅ Class Config Updated'),
          td => td.setContent(`> **✈️ Flight:** ${flightNumber}`),
          td => td.setContent(`${classInfo}`),
          td => td.setContent(`-# Updated by ${interaction.user.username} • ${FOOTER}`),
        );

      return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    await updateFlight(flight.id, { [field]: value });

    const fieldLabels = {
      time: '🕐 Time',
      gate: '🚪 Gate',
      status: '📋 Status',
      aircraft: '🛩️ Aircraft',
      bookings_open: '🎫 Bookings Open',
    };

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.success)
      .addTextDisplayComponents(
        td => td.setContent('# ✅ Flight Updated'),
        td => td.setContent(`> **✈️ Flight:** ${flightNumber}`),
        td => td.setContent(`> **🛩️ Route:** ${flight.origin} → ${flight.destination}`),
        td => td.setContent(`> **${fieldLabels[field] || field}:** ${value}`),
        td => td.setContent(`-# Updated by ${interaction.user.username} • ${FOOTER}`),
      );

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
