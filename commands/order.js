const { SlashCommandBuilder, MessageFlags, ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ThumbnailBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getMenu, createFoodOrder } = require('../firebase');
const { LOGO, FOOTER, COLORS } = require('../config');

const pendingOrders = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('order')
    .setDescription('Order food from the Vietnam Airlines Group | PTFS inflight menu')
    .addSubcommand(sub => sub.setName('food').setDescription('Browse and order from the inflight menu')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const menu = await getMenu();

    if (!menu.length) return interaction.editReply({ content: '> The menu is currently unavailable.' });

    const categories = {};
    for (const item of menu) {
      const cat = item.category || 'Other';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(item);
    }

    function buildMenuContainer() {
      const container = new ContainerBuilder()
        .setAccentColor(COLORS.primary)
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(
              td => td.setContent('# Vietnam Airlines Group | PTFS — Inflight Menu'),
              td => td.setContent('Select an item below to order.'),
            )
            .setThumbnailAccessory(tb => tb.setURL(LOGO))
        )
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small));

      for (const [cat, items] of Object.entries(categories)) {
        container.addTextDisplayComponents(td => td.setContent(
          `> **${cat}**\n${items.map(i => `> **${i.name}** - ${i.price ? `\`${i.price.toLocaleString()} VND\`` : 'Complimentary'}\n> *${i.description || ''}*`).join('\n')}`
        ));
      }

      container.addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
      container.addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));
      return container;
    }

    const options = menu.slice(0, 25).map(item => ({
      label: item.name,
      description: item.description?.slice(0, 100) || item.category || 'Menu item',
      value: item.id,
      emoji: '🍽️',
    }));

    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('food_select')
        .setPlaceholder('Choose your meal...')
        .addOptions(options)
    );

    const msg = await interaction.editReply({ components: [buildMenuContainer(), selectRow], flags: MessageFlags.IsComponentsV2 });

    const collector = msg.createMessageComponentCollector({
      time: 60_000,
      filter: i => i.user.id === interaction.user.id,
    });

    collector.on('collect', async (i) => {
      try {
        if (i.isStringSelectMenu() && i.customId === 'food_select') {
          const item = menu.find(m => m.id === i.values[0]);
          if (!item) {
            const errContainer = new ContainerBuilder()
              .addTextDisplayComponents(td => td.setContent('❌ Item not found.'));
            return await i.update({ components: [errContainer], flags: MessageFlags.IsComponentsV2 });
          }

          const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('food_confirm').setLabel(`Order: ${item.name}`).setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId('food_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('❌'),
          );

          const confirmContainer = new ContainerBuilder()
            .setAccentColor(COLORS.warning)
            .addSectionComponents(section =>
              section
                .addTextDisplayComponents(
                  td => td.setContent('# 🛒 Confirm Your Order'),
                  td => td.setContent([
                    `> **🍽️ Item:** ${item.name}`,
                    `> **💰 Price:** ${item.price ? `${item.price.toLocaleString()} VND` : 'Complimentary'}`,
                  ].join('\n')),
                  td => td.setContent(`> **📝 Description:** ${item.description || 'N/A'}`),
                )
                .setThumbnailAccessory(tb => tb.setURL(LOGO))
            )
            .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

          pendingOrders.set(interaction.user.id, item);

          await i.update({ components: [confirmContainer, confirmRow], flags: MessageFlags.IsComponentsV2 });

        } else if (i.isButton() && i.customId === 'food_confirm') {
          const item = pendingOrders.get(interaction.user.id);
          if (!item) {
            const errContainer = new ContainerBuilder()
              .addTextDisplayComponents(td => td.setContent('❌ Order lost. Try again.'));
            return await i.update({ components: [errContainer], flags: MessageFlags.IsComponentsV2 });
          }

          const { code } = await createFoodOrder({
            discord_id: interaction.user.id,
            username: interaction.user.username,
            item_id: item.id,
            item_name: item.name,
            price: item.price || 0,
          });

          pendingOrders.delete(interaction.user.id);

          const doneContainer = new ContainerBuilder()
            .setAccentColor(COLORS.success)
            .addSectionComponents(section =>
              section
                .addTextDisplayComponents(
                  td => td.setContent('# ✅ Order Placed!'),
                  td => td.setContent(`> **🎫 Order Code:**\n\`\`\`${code}\`\`\``),
                  td => td.setContent(`> **🍽️ Item:** ${item.name}\n> **💰 Price:** ${item.price ? `${item.price.toLocaleString()} VND` : 'Complimentary'}`),
                )
                .setThumbnailAccessory(tb => tb.setURL(LOGO))
            )
            .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

          collector.stop('done');
          await i.update({ components: [doneContainer], flags: MessageFlags.IsComponentsV2 });

        } else if (i.isButton() && i.customId === 'food_cancel') {
          collector.stop('cancelled');
          const cancelContainer = new ContainerBuilder()
            .addTextDisplayComponents(td => td.setContent('❌ Order cancelled.'));
          await i.update({ components: [cancelContainer], flags: MessageFlags.IsComponentsV2 });
        }
      } catch (err) {
        console.error('Order collector error:', err.message);
      }
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time') {
        const timeoutContainer = new ContainerBuilder()
          .addTextDisplayComponents(td => td.setContent('⏱️ Order timed out.'));
        interaction.editReply({ components: [timeoutContainer], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
      }
    });
  },
};
