const { SlashCommandBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, PermissionFlagsBits } = require('discord.js');
const { getDestinations, removeDestination } = require('../firebase');
const { FOOTER, COLORS } = require('../config');
const utils = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removedest')
    .setDescription('[STAFF] Remove a destination')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt =>
      opt.setName('name').setDescription('Destination name or IATA code (e.g. SGN or Ho Chi Minh City)').setRequired(true))
    .addBooleanOption(opt =>
      opt.setName('confirm').setDescription('Confirm removal').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!utils.staffCheck(interaction)) {
      return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
    }

    const query = interaction.options.getString('name');
    const confirm = interaction.options.getBoolean('confirm');

    if (!confirm) {
      return interaction.editReply({ content: '⚠️ Removal not confirmed. Set `confirm` to `true` to proceed.' });
    }

    const destinations = await getDestinations();
    const dest = destinations.find(d =>
      (d.name || '').toLowerCase() === query.toLowerCase() ||
      (d.code || '').toLowerCase() === query.toLowerCase() ||
      d.id === query
    );

    if (!dest) {
      const list = destinations.map(d => `• **${d.name}** (\`${d.code}\`) — ID: \`${d.id}\``).join('\n');
      return interaction.editReply({
        content: `❌ Destination **"${query}"** not found.\n\nAvailable destinations:\n${list || 'None'}`,
      });
    }

    await removeDestination(dest.id);

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.danger)
      .addTextDisplayComponents(td => td.setContent('# ✈️ Destination Removed'))
      .addTextDisplayComponents(td => td.setContent(`> **🌍 Name:** ${dest.name || 'N/A'}`))
      .addTextDisplayComponents(td => td.setContent(`> **🛬 Code:** ${dest.code || 'N/A'}`))
      .addTextDisplayComponents(td => td.setContent('-# Removed by ' + interaction.user.username + ' • ' + FOOTER));

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
