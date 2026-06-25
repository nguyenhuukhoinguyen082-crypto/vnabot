const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getEconomy, updateEconomy } = require('../firebase');
require('dotenv').config();

const THUMBNAIL = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addmoney')
    .setDescription('[STAFF] Add VND to a user\'s balance')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(opt => opt.setName('user').setDescription('User to add money to').setRequired(true))
    .addIntegerOption(opt => opt.setName('amount').setDescription('Amount in VND').setRequired(true))
    .addStringOption(opt => opt.setName('type').setDescription('Add to wallet or bank').setRequired(false)
      .addChoices(
        { name: '👛 Wallet', value: 'wallet' },
        { name: '🏦 Bank', value: 'bank' },
      )),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.editReply({ content: '❌ You do not have permission.' });
    }

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const type = interaction.options.getString('type') || 'wallet';

    const eco = await getEconomy(target.id);
    const newVal = (eco[type] || 0) + amount;
    await updateEconomy(target.id, { [type]: newVal });

    const embed = new EmbedBuilder()
      .setColor(0x00B050).setTitle('💰 Money Added').setThumbnail(THUMBNAIL)
      .addFields(
        { name: '👤 User', value: target.username, inline: true },
        { name: '💰 Added', value: `+${amount.toLocaleString()} VND`, inline: true },
        { name: type === 'wallet' ? '👛 New Wallet' : '🏦 New Bank', value: `${newVal.toLocaleString()} VND`, inline: true },
      )
      .setFooter({ text: `By ${interaction.user.username} • Vietnam Airlines Group | PTFS` }).setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
