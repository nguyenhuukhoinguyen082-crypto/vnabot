const {
  SlashCommandBuilder,
  MessageFlags,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const { LOGO, FOOTER, COLORS, STATUS_EMOJI } = require('../config');
const { getRoutes } = require('../firebase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('routes')
    .setDescription('View all Vietnam Airlines Group | PTFS routes'),

  async execute(interaction) {
    await interaction.deferReply();
    const routes = await getRoutes();
    if (!routes.length) return interaction.editReply({ content: '❌ No routes available yet.' });

    let page = 0;
    const total = routes.length;

    function buildRouteCard(index) {
      const route = routes[index];
      const origin = route.origin || route.from || 'N/A';
      const dest = route.destination || route.to || 'N/A';
      const isFirst = index === 0;
      const isLast = index === total - 1;

      const container = new ContainerBuilder()
        .setAccentColor(COLORS.primary);

      if (route.origin_image) {
        container.addSectionComponents(section =>
          section
            .addTextDisplayComponents(td => td.setContent(`# ✈️ ${origin} → ${dest}`))
            .setThumbnailAccessory(tb => tb.setURL(route.origin_image))
        );
      } else {
        container.addTextDisplayComponents(td => td.setContent(`# ✈️ ${origin} → ${dest}`));
      }

      container.addSeparatorComponents(sep =>
        sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
      );

      container.addTextDisplayComponents(td =>
        td.setContent(
          [
            `> **🛫 Origin:** ${origin}`,
            `> **🛬 Destination:** ${dest}`,
            `> **📋 Status:** ${route.status || 'Active'}`,
            `> **⏱️ Duration:** ${route.duration || 'N/A'}`,
            `> **📏 Distance:** ${route.distance ? `${route.distance} nm` : 'N/A'}`,
          ].join('\n')
        )
      );

      container.addSeparatorComponents(sep =>
        sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
      );

      container.addTextDisplayComponents(td =>
        td.setContent(`-# Route ${index + 1} of ${total} • ${FOOTER}`)
      );

      container.addActionRowComponents(row =>
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('route_prev')
            .setLabel('◀ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(isFirst),
          new ButtonBuilder()
            .setCustomId('route_next')
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(isLast),
        )
      );

      return [container];
    }

    const msg = await interaction.editReply({
      components: buildRouteCard(page),
      flags: MessageFlags.IsComponentsV2,
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
        await btn.update({
          components: buildRouteCard(page),
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (err) {
        console.error('Routes collector error:', err.message);
      }
    });

    collector.on('end', () => {
      interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};
