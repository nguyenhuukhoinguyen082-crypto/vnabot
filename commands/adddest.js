const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { addDestination } = require('../firebase');
require('dotenv').config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('adddest')
    .setDescription('[STAFF] Add a new destination')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt =>
      opt.setName('name').setDescription('Destination name (e.g. Ho Chi Minh City)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('code').setDescription('Airport IATA code (e.g. SGN)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('imagelink').setDescription('Image URL for this destination').setRequired(true))
    .addStringOption(opt =>
      opt.setName('description').setDescription('Short description of the destination').setRequired(true))
    .addStringOption(opt =>
      opt.setName('country').setDescription('Country name').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
    }

    const name = interaction.options.getString('name');
    const code = interaction.options.getString('code').toUpperCase();
    const imagelink = interaction.options.getString('imagelink');
    const description = interaction.options.getString('description');
    const country = interaction.options.getString('country') || 'Vietnam';

    const id = await addDestination({ name, code, image_url: imagelink, description, country });

    const embed = new EmbedBuilder()
      .setColor(0x00B050)
      .setTitle('✅ Destination Added')
      .setImage(imagelink)
      .addFields(
        { name: '🌍 Name', value: name, inline: true },
        { name: '🛬 Code', value: code, inline: true },
        { name: '🌏 Country', value: country, inline: true },
        { name: '📝 Description', value: description, inline: false },
        { name: '🔑 ID', value: `\`${id}\``, inline: false },
      )
      .setFooter({ text: `Added by ${interaction.user.username} • Vietnam Airlines Group | PTFS` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
