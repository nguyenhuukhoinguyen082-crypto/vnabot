const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ContainerBuilder, TextDisplayBuilder } = require('discord.js');
const { FOOTER, COLORS } = require('../config');
const utils = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('[STAFF] Post a formatted Vietnam Airlines announcement')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt =>
      opt.setName('title').setDescription('Announcement title').setRequired(true))
    .addStringOption(opt =>
      opt.setName('message').setDescription('Announcement message').setRequired(true))
    .addStringOption(opt =>
      opt.setName('type').setDescription('Announcement type').setRequired(false)
        .addChoices(
          { name: '📢 General', value: 'general' },
          { name: '✈️ Flight', value: 'flight' },
          { name: '🎉 Event', value: 'event' },
          { name: '⚠️ Important', value: 'important' },
          { name: '🛠️ Maintenance', value: 'maintenance' },
        ))
    .addStringOption(opt =>
      opt.setName('channel').setDescription('Channel ID to post in (leave empty for current channel)').setRequired(false))
    .addRoleOption(opt =>
      opt.setName('ping').setDescription('Role to ping with this announcement').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!utils.staffCheck(interaction)) {
      return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
    }

    const title = interaction.options.getString('title');
    const message = interaction.options.getString('message');
    const type = interaction.options.getString('type') || 'general';
    const channelId = interaction.options.getString('channel');
    const pingRole = interaction.options.getRole('ping');

    const typeConfig = {
      general:     { emoji: '📢', color: COLORS.primary },
      flight:      { emoji: '✈️', color: 0x0099FF },
      event:       { emoji: '🎉', color: COLORS.warning },
      important:   { emoji: '⚠️', color: COLORS.primary },
      maintenance: { emoji: '🛠️', color: COLORS.neutral },
    };

    const config = typeConfig[type];

    const container = new ContainerBuilder()
      .setAccentColor(config.color)
      .addTextDisplayComponents(
        td => td.setContent(`# ${config.emoji} ${title}`),
        td => td.setContent(message),
        td => td.setContent(`-# Announced by ${interaction.user.username} • ${FOOTER}`),
      );

    // Determine target channel
    let targetChannel;
    if (channelId) {
      targetChannel = await interaction.client.channels.fetch(channelId).catch(() => null);
      if (!targetChannel) {
        return interaction.editReply({ content: `❌ Channel ID \`${channelId}\` not found.` });
      }
    } else {
      targetChannel = interaction.channel;
    }

    const pingContent = pingRole ? `<@&${pingRole.id}>` : null;

    await targetChannel.send({ content: pingContent, components: [container], flags: MessageFlags.IsComponentsV2 });

    await interaction.editReply({
      content: `✅ Announcement posted in <#${targetChannel.id}>!`,
    });
  },
};
