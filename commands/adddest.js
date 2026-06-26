const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ContainerBuilder, TextDisplayBuilder } = require('discord.js');
const { addDestination } = require('../firebase');
const { FOOTER, COLORS } = require('../config');
const utils = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('adddest')
    .setDescription('[STAFF] Add a new destination')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt =>
      opt.setName('name').setDescription('Destination name (e.g. Ho Chi Minh City)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('code').setDescription('Airport IATA code (e.g. SGN)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('imagelink').setDescription('Image URL for this destination').setRequired(true))
    .addStringOption(opt =>
      opt.setName('description').setDescription('Short description of the destination').setRequired(true))
    .addStringOption(opt =>
      opt.setName('country').setDescription('Country name').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!utils.staffCheck(interaction)) {
      return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
    }

    const name = interaction.options.getString('name');
    const code = interaction.options.getString('code').toUpperCase();
    const imagelink = interaction.options.getString('imagelink');
    const description = interaction.options.getString('description');
    const country = interaction.options.getString('country') || 'Vietnam';

    const id = await addDestination({ name, code, image_url: imagelink, description, country });

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.success)
      .addTextDisplayComponents(
        td => td.setContent('# ✅ Destination Added'),
        td => td.setContent(`> **🌍 Name:** ${name}`),
        td => td.setContent(`> **🛬 Code:** ${code}`),
        td => td.setContent(`> **🌏 Country:** ${country}`),
        td => td.setContent(`> **📝 Description:** ${description}`),
        td => td.setContent(`> **🔑 ID:** \`${id}\``),
        td => td.setContent(`-# Added by ${interaction.user.username} • ${FOOTER}`),
      );

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
