const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getRoutes } = require('../firebase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('routes')
    .setDescription('View all Vietnam Airlines Group | PTFS routes'),

  async execute(interaction) {
    await interaction.deferReply();
    const routes = await getRoutes();
    if (!routes.length) return interaction.editReply({ content: '🗺️ No routes available yet.' });

    let page = 0;
    const total = routes.length;

    function buildEmbed(index) {
      const route = routes[index];
      const origin = route.origin || route.from || 'N/A';
      const dest = route.destination || route.to || 'N/A';
      const embed = new EmbedBuilder()
        .setColor(0x007B8A)
        .setTitle(`✈️ ${origin} → ${dest}`)
        .addFields(
          { name: '🛫 Origin', value: origin, inline: true },
          { name: '🛬 Destination', value: dest, inline: true },
          { name: '📋 Status', value: route.status || 'Active', inline: true },
          { name: '⏱️ Duration', value: route.duration || 'N/A', inline: true },
          { name: '📏 Distance', value: route.distance ? `${route.distance} nm` : 'N/A', inline: true },
        )
        .setFooter({ text: `Route ${index + 1} of ${total} • Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao` })
        .setTimestamp();
      if (route.origin_image) embed.setImage(route.origin_image);
      return embed;
    }

    function buildRow(index) {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('route_prev').setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
        new ButtonBuilder().setCustomId('route_next').setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(index === total - 1),
      );
    }

    const msg = await interaction.editReply({
      embeds: [buildEmbed(page)],
      components: total > 1 ? [buildRow(page)] : [],
    });

    if (total <= 1) return;

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
      filter: i => i.user.id === interaction.user.id,
    });

    collector.on('collect', async (btn) => {
      try {
        if (btn.customId === 'route_prev') page = Math.max(0, page - 1);
        if (btn.customId === 'route_next') page = Math.min(total - 1, page + 1);
        await btn.update({ embeds: [buildEmbed(page)], components: [buildRow(page)] });
      } catch (err) {
        console.error('Routes collector error:', err.message);
      }
    });

    collector.on('end', () => { interaction.editReply({ components: [] }).catch(() => {}); });
  },
};
