const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getMenu, createFoodOrder } = require('../firebase');

const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('order')
    .setDescription('Order food from the Vietnam Airlines Group | PTFS inflight menu')
    .addSubcommand(sub => sub.setName('food').setDescription('Browse and order from the inflight menu')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const menu = await getMenu();

    if (!menu.length) return interaction.editReply({ content: '🍽️ The menu is currently unavailable.' });

    const categories = {};
    for (const item of menu) {
      const cat = item.category || 'Other';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(item);
    }

    const embed = new EmbedBuilder()
      .setColor(0x007B8A)
      .setTitle('🍽️ Vietnam Airlines Group | PTFS — Inflight Menu')
      .setThumbnail(LOGO)
      .setDescription('Select an item below to order.')
      .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
      .setTimestamp();

    for (const [cat, items] of Object.entries(categories)) {
      embed.addFields({
        name: `🍴 ${cat}`,
        value: items.map(i => `• **${i.name}** — ${i.price ? `${i.price.toLocaleString()} VND` : 'Complimentary'}\n  *${i.description || ''}*`).join('\n'),
        inline: false,
      });
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

    const msg = await interaction.editReply({ embeds: [embed], components: [selectRow] });

    const collector = msg.createMessageComponentCollector({
      time: 60_000,
      filter: i => i.user.id === interaction.user.id,
    });

    collector.on('collect', async (i) => {
      try {
        if (i.isStringSelectMenu() && i.customId === 'food_select') {
          const item = menu.find(m => m.id === i.values[0]);
          if (!item) return await i.update({ content: '❌ Item not found.', components: [] });

          const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('food_confirm').setLabel(`Order: ${item.name}`).setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId('food_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('❌'),
          );

          const confirmEmbed = new EmbedBuilder()
            .setColor(0xC4972A).setTitle('🛒 Confirm Your Order').setThumbnail(LOGO)
            .addFields(
              { name: '🍽️ Item', value: item.name, inline: true },
              { name: '💰 Price', value: item.price ? `${item.price.toLocaleString()} VND` : 'Complimentary', inline: true },
              { name: '📝 Description', value: item.description || 'N/A', inline: false },
            )
            .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' }).setTimestamp();

          // Store selected item for confirm step
          i.client._pendingOrder = i.client._pendingOrder || {};
          i.client._pendingOrder[interaction.user.id] = item;

          await i.update({ embeds: [confirmEmbed], components: [confirmRow] });

        } else if (i.isButton() && i.customId === 'food_confirm') {
          const item = i.client._pendingOrder?.[interaction.user.id];
          if (!item) return await i.update({ content: '❌ Order lost. Try again.', embeds: [], components: [] });

          const { code } = await createFoodOrder({
            discord_id: interaction.user.id,
            username: interaction.user.username,
            item_id: item.id,
            item_name: item.name,
            price: item.price || 0,
          });

          if (i.client._pendingOrder) delete i.client._pendingOrder[interaction.user.id];

          const doneEmbed = new EmbedBuilder()
            .setColor(0x00B050).setTitle('✅ Order Placed!').setThumbnail(LOGO)
            .addFields(
              { name: '🎫 Order Code', value: `\`\`\`${code}\`\`\``, inline: false },
              { name: '🍽️ Item', value: item.name, inline: true },
              { name: '💰 Price', value: item.price ? `${item.price.toLocaleString()} VND` : 'Complimentary', inline: true },
            )
            .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' }).setTimestamp();

          collector.stop('done');
          await i.update({ embeds: [doneEmbed], components: [] });

        } else if (i.isButton() && i.customId === 'food_cancel') {
          collector.stop('cancelled');
          await i.update({ content: '❌ Order cancelled.', embeds: [], components: [] });
        }
      } catch (err) {
        console.error('Order collector error:', err.message);
      }
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time') {
        interaction.editReply({ content: '⏱️ Order timed out.', embeds: [], components: [] }).catch(() => {});
      }
    });
  },
};
