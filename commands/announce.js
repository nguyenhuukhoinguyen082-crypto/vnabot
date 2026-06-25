const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

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

    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
    }

    const title = interaction.options.getString('title');
    const message = interaction.options.getString('message');
    const type = interaction.options.getString('type') || 'general';
    const channelId = interaction.options.getString('channel');
    const pingRole = interaction.options.getRole('ping');

    const typeConfig = {
      general:     { emoji: '📢', color: 0x007B8A },
      flight:      { emoji: '✈️', color: 0x0099FF },
      event:       { emoji: '🎉', color: 0xC4972A },
      important:   { emoji: '⚠️', color: 0x007B8A },
      maintenance: { emoji: '🛠️', color: 0x888888 },
    };

    const config = typeConfig[type];

    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setTitle(`${config.emoji} ${title}`)
      .setDescription(message)
      .setThumbnail('https://i.postimg.cc/SRMftcKS/vna.jpg')
      .addFields({
        name: '\u200b',
        inline: false,
      })
      .setFooter({ text: `Announced by ${interaction.user.username} • Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao` })
      .setTimestamp();

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

    await targetChannel.send({ content: pingContent, embeds: [embed] });

    await interaction.editReply({
      content: `✅ Announcement posted in <#${targetChannel.id}>!`,
    });
  },
};
