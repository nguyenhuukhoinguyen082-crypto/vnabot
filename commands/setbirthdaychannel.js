const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { updateBirthdayConfig } = require('../firebase');
require('dotenv').config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setbirthdaychannel')
    .setDescription('[STAFF] Set the channel where birthday announcements are posted')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel for birthday announcements').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.editReply({ content: '❌ You do not have permission.' });
    }

    const channel = interaction.options.getChannel('channel');
    await updateBirthdayConfig({ channel_id: channel.id });

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x00B050)
        .setTitle('✅ Birthday Channel Set')
        .setDescription(`Birthday announcements will now be posted in <#${channel.id}>.`)
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })],
    });
  },
};
