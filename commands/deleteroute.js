const { SlashCommandBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, PermissionFlagsBits } = require('discord.js');
const { getRoutes, deleteRoute } = require('../firebase');
const { FOOTER, COLORS } = require('../config');
const utils = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deleteroute')
    .setDescription('[STAFF] Delete a route')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt =>
      opt.setName('origin').setDescription('Origin airport code (e.g. HAN)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('destination').setDescription('Destination airport code (e.g. SGN)').setRequired(true))
    .addBooleanOption(opt =>
      opt.setName('confirm').setDescription('Confirm deletion').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!utils.staffCheck(interaction)) {
      return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
    }

    const origin = interaction.options.getString('origin').toUpperCase();
    const destination = interaction.options.getString('destination').toUpperCase();
    const confirm = interaction.options.getBoolean('confirm');

    if (!confirm) {
      return interaction.editReply({ content: '⚠️ Deletion not confirmed. Set `confirm` to `true` to proceed.' });
    }

    const routes = await getRoutes();
    const route = routes.find(r =>
      (r.origin || '').toUpperCase() === origin &&
      (r.destination || '').toUpperCase() === destination
    );

    if (!route) {
      const list = routes.map(r => `• **${r.origin} → ${r.destination}**`).join('\n');
      return interaction.editReply({
        content: `❌ Route **${origin} → ${destination}** not found.\n\nExisting routes:\n${list || 'None'}`,
      });
    }

    await deleteRoute(route.id);

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.danger)
      .addTextDisplayComponents(td => td.setContent('# ✈️ Route Deleted'))
      .addTextDisplayComponents(td => td.setContent(`> **🛫 Origin:** ${origin}`))
      .addTextDisplayComponents(td => td.setContent(`> **🛬 Destination:** ${destination}`))
      .addTextDisplayComponents(td => td.setContent('-# Deleted by ' + interaction.user.username + ' • ' + FOOTER));

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
