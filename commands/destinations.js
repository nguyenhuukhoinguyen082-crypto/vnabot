const { SlashCommandBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { FOOTER, COLORS } = require('../config');
const { getDestinations } = require('../firebase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('destinations')
    .setDescription('Browse all Vietnam Airlines Group | PTFS destinations'),

  async execute(interaction) {
    await interaction.deferReply();
    const destinations = await getDestinations();
    if (!destinations.length) return interaction.editReply({ content: '🌍 No destinations added yet.' });

    let page = 0;
    const total = destinations.length;

    function buildPage(index) {
      const dest = destinations[index];

      const container = new ContainerBuilder()
        .setAccentColor(COLORS.primary);

      if (dest.image_url) {
        container.addSectionComponents(section =>
          section
            .addTextDisplayComponents(
              td => td.setContent(`# 🌍 ${dest.name || 'Destination'}`),
              td => td.setContent(dest.description || 'No description available.'),
              td => td.setContent(`> **🛬 Airport Code:** ${dest.code || 'N/A'}\n> **🌏 Country:** ${dest.country || 'N/A'}`),
            )
            .setThumbnailAccessory(tb => tb.setURL(dest.image_url))
        );
      } else {
        container.addTextDisplayComponents(
          td => td.setContent(`# 🌍 ${dest.name || 'Destination'}`),
          td => td.setContent(dest.description || 'No description available.'),
          td => td.setContent(`> **🛬 Airport Code:** ${dest.code || 'N/A'}\n> **🌏 Country:** ${dest.country || 'N/A'}`),
        );
      }

      container
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td =>
          td.setContent(`-# Destination ${index + 1} of ${total} · ${FOOTER}`)
        )
        .addActionRowComponents(row =>
          row.addComponents(
            new ButtonBuilder()
              .setCustomId('dest_prev')
              .setLabel('◀ Previous')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(index === 0),
            new ButtonBuilder()
              .setCustomId('dest_next')
              .setLabel('Next ▶')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(index === total - 1),
          )
        );

      return [container];
    }

    const msg = await interaction.editReply({
      components: buildPage(page),
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
        if (btn.customId === 'dest_prev') page = Math.max(0, page - 1);
        if (btn.customId === 'dest_next') page = Math.min(total - 1, page + 1);
        await btn.update({ components: buildPage(page), flags: MessageFlags.IsComponentsV2 });
      } catch (err) {
        console.error('Destinations collector error:', err.message);
      }
    });

    collector.on('end', () => { interaction.editReply({ components: [] }).catch(() => {}); });
  },
};
