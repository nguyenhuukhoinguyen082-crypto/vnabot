const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getDestinations, removeDestination } = require('../firebase');
require('dotenv').config();

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

    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
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

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🗑️ Destination Removed')
      .addFields(
        { name: '🌍 Name', value: dest.name || 'N/A', inline: true },
        { name: '🛬 Code', value: dest.code || 'N/A', inline: true },
      )
      .setFooter({ text: `Removed by ${interaction.user.username} • Vietnam Airlines Group | PTFS` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
