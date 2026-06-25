const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../firebase');
const { ref, push, set } = require('firebase/database');
require('dotenv').config();

const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Submit a suggestion for Vietnam Airlines Group | PTFS')
    .addStringOption(opt => opt.setName('suggestion').setDescription('Your suggestion').setRequired(true))
    .addStringOption(opt => opt.setName('channel').setDescription('Suggestions channel ID (leave empty for current channel)').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const suggestion = interaction.options.getString('suggestion');
    const channelId = interaction.options.getString('channel') || process.env.SUGGESTIONS_CHANNEL_ID;

    let targetChannel;
    if (channelId) {
      targetChannel = await interaction.client.channels.fetch(channelId).catch(() => null);
      if (!targetChannel) {
        targetChannel = interaction.channel;
      }
    } else {
      targetChannel = interaction.channel;
    }

    const embed = new EmbedBuilder()
      .setColor(0x007B8A)
      .setTitle('💡 New Suggestion')
      .setDescription(suggestion)
      .setThumbnail(LOGO)
      .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao • React below to vote!' })
      .setTimestamp();

    const msg = await targetChannel.send({ embeds: [embed] });
    await msg.react('👍').catch(() => {});
    await msg.react('👎').catch(() => {});

    // Log to Firebase for staff tracking
    const newRef = push(ref(db, 'suggestions'));
    await set(newRef, {
      discord_id: interaction.user.id,
      username: interaction.user.username,
      suggestion,
      message_id: msg.id,
      channel_id: targetChannel.id,
      created_at: Date.now(),
      status: 'pending',
    });

    return interaction.editReply({ content: `✅ Your suggestion has been posted in <#${targetChannel.id}>!` });
  },
};
