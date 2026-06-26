const {
  SlashCommandBuilder, PermissionFlagsBits, MessageFlags,
  ContainerBuilder, TextDisplayBuilder,
  ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} = require('discord.js');
const { addPlane } = require('../firebase');
const { FOOTER, COLORS } = require('../config');
const utils = require('../utils');

// Real Vietnam Airlines fleet templates
const TEMPLATES = {
  '787-9': {
    aircraft_type: 'Boeing 787-9 Dreamliner',
    display_name: 'VNA 787-9',
    passenger_capacity: 294,
    seat_config: '2-3-2 / 2-2-2',
    seat_rows: 35,
    seat_cols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'],
    has_business: true,
    business_rows: 6,
    notes: 'Long-haul widebody with Business and Economy cabins',
  },
  '787-10': {
    aircraft_type: 'Boeing 787-10 Dreamliner',
    display_name: 'VNA 787-10',
    passenger_capacity: 318,
    seat_config: '2-3-2 / 2-2-2',
    seat_rows: 40,
    seat_cols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'],
    has_business: true,
    business_rows: 6,
    notes: 'Long-haul widebody, stretched variant',
  },
  'a350-900': {
    aircraft_type: 'Airbus A350-900',
    display_name: 'VNA A350-900',
    passenger_capacity: 305,
    seat_config: '2-3-2 / 2-2-2',
    seat_rows: 38,
    seat_cols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'],
    has_business: true,
    business_rows: 8,
    notes: 'Premium long-haul aircraft with Lotus Business class',
  },
  'a321neo': {
    aircraft_type: 'Airbus A321neo',
    display_name: 'VNA A321neo',
    passenger_capacity: 180,
    seat_config: '3-3',
    seat_rows: 30,
    seat_cols: ['A', 'B', 'C', 'D', 'E', 'F'],
    has_business: false,
    business_rows: 0,
    notes: 'Narrowbody, domestic and short-haul routes',
  },
  'a330-300': {
    aircraft_type: 'Airbus A330-300',
    display_name: 'VNA A330-300',
    passenger_capacity: 266,
    seat_config: '2-4-2',
    seat_rows: 42,
    seat_cols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    has_business: true,
    business_rows: 4,
    notes: 'Medium-haul widebody, regional international routes',
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createplane')
    .setDescription('[STAFF] Add a new aircraft to the fleet')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt => opt.setName('registration').setDescription('Tail registration WITHOUT VN- prefix (e.g. A123)').setRequired(true))
    .addStringOption(opt => opt.setName('template').setDescription('Use a Vietnam Airlines template or custom').setRequired(true)
      .addChoices(
        { name: '✈️ Boeing 787-9 Dreamliner (294 pax)', value: '787-9' },
        { name: '✈️ Boeing 787-10 Dreamliner (318 pax)', value: '787-10' },
        { name: '✈️ Airbus A350-900 (305 pax)', value: 'a350-900' },
        { name: '✈️ Airbus A321neo (180 pax)', value: 'a321neo' },
        { name: '✈️ Airbus A330-300 (266 pax + Business)', value: 'a330-300' },
        { name: '⚙️ Custom', value: 'custom' },
      ))
    .addStringOption(opt => opt.setName('status').setDescription('Service status').setRequired(true)
      .addChoices(
        { name: '🟢 Active (Airworthy)', value: 'Active (Airworthy)' },
        { name: '🟡 Maintenance', value: 'Maintenance' },
        { name: '🔴 Grounded', value: 'Grounded' },
        { name: '⚫ Retired', value: 'Retired' },
      ))
    .addStringOption(opt => opt.setName('imageurl').setDescription('Livery image URL (overrides template image)').setRequired(false))
    // Custom-only fields
    .addStringOption(opt => opt.setName('type').setDescription('[Custom only] Aircraft type').setRequired(false))
    .addStringOption(opt => opt.setName('displayname').setDescription('[Custom only] Display name').setRequired(false))
    .addIntegerOption(opt => opt.setName('capacity').setDescription('[Custom only] Passenger capacity').setRequired(false))
    .addStringOption(opt => opt.setName('description').setDescription('[Custom only] Description').setRequired(false))
    .addBooleanOption(opt => opt.setName('business').setDescription('[Custom only] Has Business Class?').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!utils.staffCheck(interaction)) {
      return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
    }

    const registration = interaction.options.getString('registration').toUpperCase();
    const templateKey = interaction.options.getString('template');
    const status = interaction.options.getString('status');
    const imageOverride = interaction.options.getString('imageurl');

    const template = { ...TEMPLATES[templateKey] };

    // Apply custom fields if provided
    if (templateKey === 'custom') {
      template.aircraft_type = interaction.options.getString('type') || 'Unknown';
      template.display_name = interaction.options.getString('displayname') || 'Custom Aircraft';
      template.passenger_capacity = interaction.options.getInteger('capacity') || 180;
      template.description = interaction.options.getString('description') || '';
      template.has_business = interaction.options.getBoolean('business') ?? false;
    }

    const imageUrl = imageOverride || template.image_url || null;

    const planeData = {
      ...template,
      tail_registration: registration,
      full_registration: `VN-${registration}`,
      service_status: status,
      image_url: imageUrl,
    };

    const id = await addPlane(planeData);

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.success)
      .addTextDisplayComponents(
        td => td.setContent('# ✅ Aircraft Added to Fleet'),
        td => td.setContent(`> **✈️ Type:** ${template.aircraft_type || 'N/A'}`),
        td => td.setContent(`> **🏷️ Display Name:** ${template.display_name || 'N/A'}`),
        td => td.setContent(`> **🔖 Registration:** VN-${registration}`),
        td => td.setContent(`> **💺 Capacity:** ${template.passenger_capacity || '?'} seats`),
        td => td.setContent(`> **🪑 Config:** ${template.seat_config || 'N/A'}`),
        td => td.setContent(`> **💼 Business Class:** ${template.has_business ? `✅ ${template.business_rows} rows` : '❌ No'}`),
        td => td.setContent(`> **🔧 Status:** ${status || 'Active'}`),
        td => td.setContent(`> **🔑 ID:** \`${id}\``),
        td => td.setContent(`> **📝 Notes:** ${template.notes || template.description || 'N/A'}`),
        td => td.setContent(`-# Added by ${interaction.user.username} • ${FOOTER}`),
      );

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
