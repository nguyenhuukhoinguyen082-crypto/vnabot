const {
  SlashCommandBuilder, PermissionFlagsBits, MessageFlags,
  ContainerBuilder, SectionBuilder, TextDisplayBuilder,
  SeparatorBuilder, SeparatorSpacingSize, ThumbnailBuilder,
  MediaGalleryBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} = require('discord.js');
const { getPartnerships, getPartnership, addPartnership, removePartnership } = require('../firebase');
const { LOGO, FOOTER, COLORS } = require('../config');
const utils = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('partnership')
    .setDescription('Manage Vietnam Airlines Group | PTFS airline partnerships')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('[STAFF] Add a new partner airline')
        .addStringOption(opt => opt.setName('name').setDescription('Partner airline name').setRequired(true))
        .addStringOption(opt => opt.setName('logo').setDescription('Partner airline logo URL').setRequired(true))
        .addStringOption(opt => opt.setName('discordlink').setDescription('Partner Discord invite link').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('Description of the partnership').setRequired(true))
        .addStringOption(opt => opt.setName('banner').setDescription('Banner image URL (optional)').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Browse all Vietnam Airlines Group | PTFS partner airlines'))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('[STAFF] Remove a partnership')
        .addStringOption(opt => opt.setName('name').setDescription('Partner airline name').setRequired(true))
        .addBooleanOption(opt => opt.setName('confirm').setDescription('Confirm removal').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('post')
        .setDescription('[STAFF] Post a partnership announcement')
        .addStringOption(opt => opt.setName('name').setDescription('Partner airline name').setRequired(true))
        .addStringOption(opt => opt.setName('channel').setDescription('Channel ID (leave empty for current)').setRequired(false))
        .addRoleOption(opt => opt.setName('ping').setDescription('Role to ping').setRequired(false))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      await interaction.deferReply({ ephemeral: true });
      if (!utils.staffCheck(interaction)) {
        return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
      }

      const name = interaction.options.getString('name');
      const logo = interaction.options.getString('logo');
      const discordLink = interaction.options.getString('discordlink');
      const description = interaction.options.getString('description');
      const banner = interaction.options.getString('banner') || null;

      const id = await addPartnership({ name, logo, discord_link: discordLink, description, banner });

      const container = new ContainerBuilder()
        .setAccentColor(COLORS.success)
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(
              td => td.setContent('# ✅ Partnership Added'),
              td => td.setContent([
                `> **🤝 Partner:** ${name}`,
                `> **🔗 Discord:** ${discordLink ? `[Join Server](${discordLink})` : 'N/A'}`,
              ].join('\n')),
              td => td.setContent([
                `> **📝 Description:** ${description}`,
                `> **🔑 ID:** \`${id}\``,
              ].join('\n')),
            )
            .setThumbnailAccessory(tb => tb.setURL(logo))
        );

      if (banner) {
        container.addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        container.addMediaGalleryComponents(gallery =>
          gallery.addItems(item => item.setURL(banner))
        );
      }

      container
        .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td => td.setContent(`> Use \`/partnership post ${name}\` to announce this partnership!`))
        .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td => td.setContent(`-# Added by ${interaction.user.username} • ${FOOTER}`));

      return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    if (sub === 'list') {
      await interaction.deferReply();
      const partnerships = (await getPartnerships()).filter(p => p.status !== 'removed');

      if (!partnerships.length) {
        const container = new ContainerBuilder()
          .setAccentColor(COLORS.primary)
          .addSectionComponents(section =>
            section
              .addTextDisplayComponents(
                td => td.setContent('# 🤝 Vietnam Airlines Group | PTFS — Partnerships'),
                td => td.setContent('No partnerships yet. Check back soon!'),
              )
              .setThumbnailAccessory(tb => tb.setURL(LOGO))
          )
          .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      let page = 0;
      const total = partnerships.length;

      function buildContainer(index) {
        const p = partnerships[index];
        const container = new ContainerBuilder()
          .setAccentColor(COLORS.primary)
          .addSectionComponents(section =>
            section
              .addTextDisplayComponents(
                td => td.setContent(`# 🤝 ${p.name}`),
                td => td.setContent(p.description || 'No description provided.'),
                td => td.setContent(`> **🔗 Discord Server:** ${p.discord_link ? `[Join Here](${p.discord_link})` : 'N/A'}`),
              )
              .setThumbnailAccessory(tb => tb.setURL(p.logo || LOGO))
          );

        if (p.banner) {
          container.addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
          container.addMediaGalleryComponents(gallery =>
            gallery.addItems(item => item.setURL(p.banner))
          );
        }

        container
          .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(td => td.setContent(`-# Partner ${index + 1} of ${total} • ${FOOTER}`));

        return container;
      }

      function buildRow(index) {
        const p = partnerships[index];
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('pt_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
        );
        if (p.discord_link) {
          row.addComponents(
            new ButtonBuilder().setLabel('Join Partner Server').setStyle(ButtonStyle.Link).setURL(p.discord_link).setEmoji('🔗'),
          );
        }
        row.addComponents(
          new ButtonBuilder().setCustomId('pt_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(index === total - 1),
        );
        return row;
      }

      const msg = await interaction.editReply({ components: [buildContainer(page), buildRow(page)], flags: MessageFlags.IsComponentsV2 });

      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120_000,
        filter: i => i.user.id === interaction.user.id,
      });

      collector.on('collect', async (btn) => {
        try {
          if (btn.customId === 'pt_prev') page = Math.max(0, page - 1);
          if (btn.customId === 'pt_next') page = Math.min(total - 1, page + 1);
          await btn.update({ components: [buildContainer(page), buildRow(page)], flags: MessageFlags.IsComponentsV2 });
        } catch (err) {
          console.error('Partnership list collector error:', err.message);
        }
      });

      collector.on('end', () => { interaction.editReply({ components: [] }).catch(() => {}); });
      return;
    }

    if (sub === 'remove') {
      await interaction.deferReply({ ephemeral: true });
      if (!utils.staffCheck(interaction)) {
        return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
      }

      const name = interaction.options.getString('name');
      const confirm = interaction.options.getBoolean('confirm');

      if (!confirm) return interaction.editReply({ content: '⚠️ Set `confirm` to `true` to proceed.' });

      const partnership = await getPartnership(name);
      if (!partnership) {
        const list = (await getPartnerships()).map(p => `• **${p.name}**`).join('\n');
        return interaction.editReply({ content: `❌ Partnership **"${name}"** not found.\n\nExisting:\n${list || 'None'}` });
      }

      await removePartnership(partnership.id);

      const container = new ContainerBuilder()
        .setAccentColor(COLORS.danger)
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(
              td => td.setContent('# ❌ Partnership Removed'),
              td => td.setContent(`> **🤝 Partner:** ${partnership.name}`),
            )
            .setThumbnailAccessory(tb => tb.setURL(partnership.logo || LOGO))
        )
        .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td => td.setContent(`-# Removed by ${interaction.user.username} • ${FOOTER}`));

      return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    if (sub === 'post') {
      await interaction.deferReply({ ephemeral: true });
      if (!utils.staffCheck(interaction)) {
        return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
      }

      const name = interaction.options.getString('name');
      const channelId = interaction.options.getString('channel');
      const pingRole = interaction.options.getRole('ping');

      const partnership = await getPartnership(name);
      if (!partnership) {
        const list = (await getPartnerships()).map(p => `• **${p.name}**`).join('\n');
        return interaction.editReply({ content: `❌ Partnership **"${name}"** not found.\n\nExisting:\n${list || 'None'}` });
      }

      const container = new ContainerBuilder()
        .setAccentColor(COLORS.primary)
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(
              td => td.setContent(`# 🤝 New Partnership — ${partnership.name}`),
              td => td.setContent([
                `📢 We're excited to announce our new partnership with **${partnership.name}**!`,
                '',
                partnership.description || '',
              ].join('\n')),
              td => td.setContent(`> **🔗 Join Their Server:** ${partnership.discord_link ? `[Click Here](${partnership.discord_link})` : 'N/A'}`),
            )
            .setThumbnailAccessory(tb => tb.setURL(partnership.logo || LOGO))
        );

      if (partnership.banner) {
        container.addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        container.addMediaGalleryComponents(gallery =>
          gallery.addItems(item => item.setURL(partnership.banner))
        );
      }

      container.addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
      container.addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

      const row = new ActionRowBuilder();
      if (partnership.discord_link) {
        row.addComponents(
          new ButtonBuilder().setLabel(`Join ${partnership.name}`).setStyle(ButtonStyle.Link).setURL(partnership.discord_link).setEmoji('🔗'),
        );
      }

      let targetChannel;
      if (channelId) {
        targetChannel = await interaction.client.channels.fetch(channelId).catch(() => null);
        if (!targetChannel) return interaction.editReply({ content: `❌ Channel \`${channelId}\` not found.` });
      } else {
        targetChannel = interaction.channel;
      }

      const components = [];
      if (pingRole) {
        components.push(new TextDisplayBuilder().setContent(`<@&${pingRole.id}>`));
      }
      components.push(container);
      if (row.components.length) components.push(row);

      await targetChannel.send({
        components,
        flags: MessageFlags.IsComponentsV2,
      });

      return interaction.editReply({ content: `✅ Partnership announcement posted in <#${targetChannel.id}>!` });
    }
  },
};
