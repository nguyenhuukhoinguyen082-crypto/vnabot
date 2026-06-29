const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { updateConfig } = require('../firebase');
require('dotenv').config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setflightboardchannel')
    .setDescription('[STAFF] Set the channel where the daily flight board is posted')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel for the flight board').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.editReply({ content: '❌ You do not have permission.' });
    }

    const channel = interaction.options.getChannel('channel');
    await updateConfig({ flightboard_channel_id: channel.id });
    return interaction.editReply({
      content: `✅ Flight board channel set to <#${channel.id}>.\nIt will auto-post daily at **06:00 ICT**. Use \`/postflightboard\` to post immediately.`,
    });
  },
};
