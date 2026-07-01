const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { updateConfig, getConfig } = require('../firebase');
require('dotenv').config();

const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setprivateserverlink')
    .setDescription('[STAFF] Set the Roblox private server link used for check-in announcements')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt => opt.setName('link').setDescription('Roblox private server link').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.editReply({ content: '❌ You do not have permission.' });
    }

    const link = interaction.options.getString('link');

    if (!link.startsWith('http')) {
      return interaction.editReply({ content: '❌ Please provide a valid URL starting with http:// or https://' });
    }

    await updateConfig({ private_server_link: link });

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x006785)
        .setTitle('✅ Private Server Link Updated')
        .setThumbnail(LOGO)
        .setDescription(`This link will now be used on every check-in announcement until changed again.`)
        .addFields({ name: '🔗 Link', value: link, inline: false })
        .setFooter({ text: `Set by ${interaction.user.username} • Vietnam Airlines Group | PTFS` })
        .setTimestamp()],
    });
  },
};
