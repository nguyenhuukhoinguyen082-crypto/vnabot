const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ContainerBuilder, TextDisplayBuilder } = require('discord.js');
const { addRoute } = require('../firebase');
const { FOOTER, COLORS } = require('../config');
const utils = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addroute')
    .setDescription('[STAFF] Add a new route')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt =>
      opt.setName('origin').setDescription('Origin airport code (e.g. HAN)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('destination').setDescription('Destination airport code (e.g. SGN)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('originimage').setDescription('Image URL for origin city').setRequired(true))
    .addStringOption(opt =>
      opt.setName('destimage').setDescription('Image URL for destination city').setRequired(true))
    .addStringOption(opt =>
      opt.setName('duration').setDescription('Flight duration (e.g. 2h 15m)').setRequired(false))
    .addIntegerOption(opt =>
      opt.setName('distance').setDescription('Distance in nautical miles').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!utils.staffCheck(interaction)) {
      return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
    }

    const origin = interaction.options.getString('origin').toUpperCase();
    const destination = interaction.options.getString('destination').toUpperCase();
    const originImage = interaction.options.getString('originimage');
    const destImage = interaction.options.getString('destimage');
    const duration = interaction.options.getString('duration') || null;
    const distance = interaction.options.getInteger('distance') || null;

    const id = await addRoute({
      origin,
      destination,
      origin_image: originImage,
      dest_image: destImage,
      duration,
      distance,
    });

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.success)
      .addTextDisplayComponents(
        td => td.setContent('# ✅ Route Added'),
        td => td.setContent(`> **🛫 Origin:** ${origin}`),
        td => td.setContent(`> **🛬 Destination:** ${destination}`),
        td => td.setContent(`> **⏱️ Duration:** ${duration || 'N/A'}`),
        td => td.setContent(`> **📏 Distance:** ${distance ? `${distance} nm` : 'N/A'}`),
        td => td.setContent(`> **🔑 Route ID:** \`${id}\``),
        td => td.setContent(`-# Added by ${interaction.user.username} • ${FOOTER}`),
      );

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
