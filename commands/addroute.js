const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { addRoute } = require('../firebase');
require('dotenv').config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addroute')
    .setDescription('[STAFF] Add a new route')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt =>
      opt.setName('origin').setDescription('Origin airport code (e.g. HAN)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('destination').setDescription('Destination airport code (e.g. SGN)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('originimage').setDescription('Image URL for origin city').setRequired(true))
    .addStringOption(opt =>
      opt.setName('destimage').setDescription('Image URL for destination city').setRequired(true))
    .addStringOption(opt =>
      opt.setName('duration').setDescription('Flight duration (e.g. 2h 15m)').setRequired(false))
    .addIntegerOption(opt =>
      opt.setName('distance').setDescription('Distance in nautical miles').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
    }

    const origin = interaction.options.getString('origin').toUpperCase();
    const destination = interaction.options.getString('destination').toUpperCase();
    const originImage = interaction.options.getString('originimage');
    const destImage = interaction.options.getString('destimage');
    const duration = interaction.options.getString('duration') || null;
    const distance = interaction.options.getInteger('distance') || null;

    const id = await addRoute({
      origin,
      destination,
      origin_image: originImage,
      dest_image: destImage,
      duration,
      distance,
    });

    const embed = new EmbedBuilder()
      .setColor(0x00B050)
      .setTitle('✅ Route Added')
      .setImage(originImage)
      .addFields(
        { name: '🛫 Origin', value: origin, inline: true },
        { name: '🛬 Destination', value: destination, inline: true },
        { name: '⏱️ Duration', value: duration || 'N/A', inline: true },
        { name: '📏 Distance', value: distance ? `${distance} nm` : 'N/A', inline: true },
        { name: '🔑 Route ID', value: `\`${id}\``, inline: false },
      )
      .setFooter({ text: `Added by ${interaction.user.username} • Vietnam Airlines Group | PTFS` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
