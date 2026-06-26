const {
  SlashCommandBuilder, MessageFlags, PermissionFlagsBits,
  ContainerBuilder, SectionBuilder,
  TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const utils = require('../utils');
const { LOGO, FOOTER, COLORS } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embedbuilder')
    .setDescription('[STAFF] Build and post a fully custom embed with live preview')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(opt => opt.setName('channel').setDescription('Channel ID to post in (leave empty for current)').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    if (!utils.staffCheck(interaction)) return interaction.editReply({ content: '> You do not have permission.' });

    const channelId = interaction.options.getString('channel');

    let data = { title: 'Title here', description: 'Description here', color: '#E30613', footer: '', image: '', thumbnail: '' };

    function buildPreview() {
      const container = new ContainerBuilder()
        .setAccentColor(data.color ? parseInt(data.color.replace('#', ''), 16) : COLORS.primary);

      if (data.thumbnail) {
        container.addSectionComponents(section =>
          section
            .addTextDisplayComponents(td => td.setContent(`# ${data.title || 'Title here'}`))
            .setThumbnailAccessory(thumb => thumb.setURL(data.thumbnail))
        );
      } else {
        container.addTextDisplayComponents(td => td.setContent(`# ${data.title || 'Title here'}`));
      }

      container.addTextDisplayComponents(td => td.setContent(data.description || 'Description here'));

      if (data.image) {
        container.addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
        container.addSectionComponents(section =>
          section
            .addTextDisplayComponents(td => td.setContent(' '))
            .setThumbnailAccessory(thumb => thumb.setURL(data.image))
        );
      }

      if (data.footer) {
        container.addTextDisplayComponents(td => td.setContent(`-# ${data.footer}`));
      }

      return [container];
    }

    function buildRows() {
      return [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('eb_titledesc').setLabel('Title & Description').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('eb_color').setLabel('Color').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('eb_images').setLabel('Images').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('eb_footer').setLabel('Footer').setStyle(ButtonStyle.Primary),
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('eb_post').setLabel('Post Embed ✅').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('eb_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
        ),
      ];
    }

    const msg = await interaction.editReply({
      components: [...buildPreview(), ...buildRows()],
      flags: MessageFlags.IsComponentsV2,
    });

    const collector = msg.createMessageComponentCollector({ time: 600_000, filter: i => i.user.id === interaction.user.id });

    collector.on('collect', async (i) => {
      try {
        const id = i.customId;

        if (id === 'eb_cancel') {
          collector.stop('cancelled');
          return await i.update({
            components: [new TextDisplayBuilder().setContent('Embed builder cancelled.')],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        if (id === 'eb_post') {
          let targetChannel;
          if (channelId) {
            targetChannel = await interaction.client.channels.fetch(channelId).catch(() => null);
            if (!targetChannel) return await i.reply({
              components: [new TextDisplayBuilder().setContent(`Channel \`${channelId}\` not found.`)],
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
          } else {
            targetChannel = interaction.channel;
          }
          await targetChannel.send({
            components: buildPreview(),
            flags: MessageFlags.IsComponentsV2,
          });
          collector.stop('posted');
          return await i.update({
            components: [new TextDisplayBuilder().setContent(`Embed posted in <#${targetChannel.id}>!`)],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        if (id === 'eb_titledesc') {
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
          return await submitted.update({
            components: [...buildPreview(), ...buildRows()],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        if (id === 'eb_color') {
          const modal = new ModalBuilder().setCustomId('eb_modal_color').setTitle('Edit Color');
          modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Hex color (e.g. #E30613)').setStyle(TextInputStyle.Short).setValue(data.color).setRequired(true)),
          );
          await i.showModal(modal);
          const submitted = await i.awaitModalSubmit({ time: 120_000, filter: m => m.user.id === interaction.user.id }).catch(() => null);
          if (!submitted) return;
          const color = submitted.fields.getTextInputValue('color');
          if (/^#?[0-9A-Fa-f]{6}$/.test(color)) data.color = color.startsWith('#') ? color : `#${color}`;
          return await submitted.update({
            components: [...buildPreview(), ...buildRows()],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        if (id === 'eb_images') {
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
          return await submitted.update({
            components: [...buildPreview(), ...buildRows()],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        if (id === 'eb_footer') {
          const modal = new ModalBuilder().setCustomId('eb_modal_footer').setTitle('Edit Footer');
          modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('footer').setLabel('Footer text').setStyle(TextInputStyle.Short).setValue(data.footer).setRequired(false)),
          );
          await i.showModal(modal);
          const submitted = await i.awaitModalSubmit({ time: 120_000, filter: m => m.user.id === interaction.user.id }).catch(() => null);
          if (!submitted) return;
          data.footer = submitted.fields.getTextInputValue('footer');
          return await submitted.update({
            components: [...buildPreview(), ...buildRows()],
            flags: MessageFlags.IsComponentsV2,
          });
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
