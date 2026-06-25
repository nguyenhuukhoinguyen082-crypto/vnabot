const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
require('dotenv').config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embedbuilder')
    .setDescription('[STAFF] Build and post a fully custom embed with live preview')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(opt => opt.setName('channel').setDescription('Channel ID to post in (leave empty for current)').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.editReply({ content: '❌ You do not have permission.' });
    }

    const channelId = interaction.options.getString('channel');

    let data = { title: 'Title here', description: 'Description here', color: '#E30613', footer: '', image: '', thumbnail: '' };

    function buildPreview() {
      const embed = new EmbedBuilder()
        .setTitle(data.title || null)
        .setDescription(data.description || null)
        .setColor(data.color ? parseInt(data.color.replace('#', ''), 16) : 0x007B8A);
      if (data.footer) embed.setFooter({ text: data.footer });
      if (data.image) embed.setImage(data.image);
      if (data.thumbnail) embed.setThumbnail(data.thumbnail);
      return embed;
    }

    function buildRows() {
      return [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('eco_eb_titledesc').setLabel('Title & Description').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('eco_eb_color').setLabel('Color').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('eco_eb_images').setLabel('Images').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('eco_eb_footer').setLabel('Footer').setStyle(ButtonStyle.Primary),
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('eco_eb_post').setLabel('Post Embed ✅').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('eco_eb_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
        ),
      ];
    }

    const msg = await interaction.editReply({ embeds: [buildPreview()], components: buildRows() });

    const collector = msg.createMessageComponentCollector({ time: 600_000, filter: i => i.user.id === interaction.user.id });

    collector.on('collect', async (i) => {
      try {
        const id = i.customId;

        if (id === 'eco_eb_cancel') {
          collector.stop('cancelled');
          return await i.update({ content: '❌ Embed builder cancelled.', embeds: [], components: [] });
        }

        if (id === 'eco_eb_post') {
          let targetChannel;
          if (channelId) {
            targetChannel = await interaction.client.channels.fetch(channelId).catch(() => null);
            if (!targetChannel) return await i.reply({ content: `❌ Channel \`${channelId}\` not found.`, ephemeral: true });
          } else {
            targetChannel = interaction.channel;
          }
          await targetChannel.send({ embeds: [buildPreview()] });
          collector.stop('posted');
          return await i.update({ content: `✅ Embed posted in <#${targetChannel.id}>!`, embeds: [], components: [] });
        }

        if (id === 'eco_eb_titledesc') {
          const modal = new ModalBuilder().setCustomId('eb_modal_titledesc').setTitle('Edit Title & Description');
          modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setValue(data.title).setRequired(false)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('Description').setStyle(TextInputStyle.Paragraph).setValue(data.description).setRequired(false)),
          );
          await i.showModal(modal);
          const submitted = await i.awaitModalSubmit({ time: 120_000, filter: m => m.user.id === interaction.user.id }).catch(() => null);
          if (!submitted) return;
          data.title = submitted.fields.getTextInputValue('title');
          data.description = submitted.fields.getTextInputValue('desc');
          return await submitted.update({ embeds: [buildPreview()], components: buildRows() });
        }

        if (id === 'eco_eb_color') {
          const modal = new ModalBuilder().setCustomId('eb_modal_color').setTitle('Edit Color');
          modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Hex color (e.g. #E30613)').setStyle(TextInputStyle.Short).setValue(data.color).setRequired(true)),
          );
          await i.showModal(modal);
          const submitted = await i.awaitModalSubmit({ time: 120_000, filter: m => m.user.id === interaction.user.id }).catch(() => null);
          if (!submitted) return;
          const color = submitted.fields.getTextInputValue('color');
          if (/^#?[0-9A-Fa-f]{6}$/.test(color)) data.color = color.startsWith('#') ? color : `#${color}`;
          return await submitted.update({ embeds: [buildPreview()], components: buildRows() });
        }

        if (id === 'eco_eb_images') {
          const modal = new ModalBuilder().setCustomId('eb_modal_images').setTitle('Edit Images');
          modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('image').setLabel('Main image URL').setStyle(TextInputStyle.Short).setValue(data.image).setRequired(false)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('thumb').setLabel('Thumbnail URL').setStyle(TextInputStyle.Short).setValue(data.thumbnail).setRequired(false)),
          );
          await i.showModal(modal);
          const submitted = await i.awaitModalSubmit({ time: 120_000, filter: m => m.user.id === interaction.user.id }).catch(() => null);
          if (!submitted) return;
          data.image = submitted.fields.getTextInputValue('image');
          data.thumbnail = submitted.fields.getTextInputValue('thumb');
          return await submitted.update({ embeds: [buildPreview()], components: buildRows() });
        }

        if (id === 'eco_eb_footer') {
          const modal = new ModalBuilder().setCustomId('eb_modal_footer').setTitle('Edit Footer');
          modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('footer').setLabel('Footer text').setStyle(TextInputStyle.Short).setValue(data.footer).setRequired(false)),
          );
          await i.showModal(modal);
          const submitted = await i.awaitModalSubmit({ time: 120_000, filter: m => m.user.id === interaction.user.id }).catch(() => null);
          if (!submitted) return;
          data.footer = submitted.fields.getTextInputValue('footer');
          return await submitted.update({ embeds: [buildPreview()], components: buildRows() });
        }
      } catch (err) {
        console.error('Embed builder error:', err.message);
      }
    });

    collector.on('end', (_, reason) => {
      if (reason !== 'posted' && reason !== 'cancelled') {
        interaction.editReply({ components: [] }).catch(() => {});
      }
    });
  },
};
