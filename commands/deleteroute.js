const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getRoutes, deleteRoute } = require('../firebase');
require('dotenv').config();

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

    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
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

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🗑️ Route Deleted')
      .addFields(
        { name: '🛫 Origin', value: origin, inline: true },
        { name: '🛬 Destination', value: destination, inline: true },
      )
      .setFooter({ text: `Deleted by ${interaction.user.username} • Vietnam Airlines Group | PTFS` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
