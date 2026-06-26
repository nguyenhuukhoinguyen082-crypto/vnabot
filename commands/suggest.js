const { SlashCommandBuilder, MessageFlags, ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ThumbnailBuilder } = require('discord.js');
const { db } = require('../firebase');
const { ref, push, set } = require('firebase/database');
const { LOGO, FOOTER, COLORS } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Submit a suggestion for Vietnam Airlines Group | PTFS')
    .addStringOption(opt => opt.setName('suggestion').setDescription('Your suggestion').setRequired(true))
    .addStringOption(opt => opt.setName('channel').setDescription('Suggestions channel ID (leave empty for current)').setRequired(false)),

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

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.primary)
      .addSectionComponents(section =>
        section
          .addTextDisplayComponents(
            td => td.setContent('# 💡 New Suggestion'),
            td => td.setContent(`Submitted by **${interaction.user.username}**`),
            td => td.setContent(suggestion),
          )
          .setThumbnailAccessory(tb => tb.setURL(interaction.user.displayAvatarURL({ dynamic: true })))
      )
      .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER} • React below to vote!`));

    const msg = await targetChannel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
    await msg.react('👍').catch(() => {});
    await msg.react('👎').catch(() => {});

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
