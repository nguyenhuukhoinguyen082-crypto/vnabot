const { SlashCommandBuilder, MessageFlags, ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ThumbnailBuilder } = require('discord.js');
const { LOGO, FOOTER, COLORS, STATUS_EMOJI } = require('../config');
const { getRoutes, getDestinations } = require('../firebase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('network')
    .setDescription('View the Vietnam Airlines Group | PTFS route network as text overview'),

  async execute(interaction) {
    await interaction.deferReply();
    const routes = await getRoutes();
    const destinations = await getDestinations();

    if (!routes.length) return interaction.editReply({ content: '> No routes available to display yet.' });

    const connections = {};
    for (const r of routes) {
      const o = r.origin || 'N/A';
      const d = r.destination || 'N/A';
      connections[o] = (connections[o] || 0) + 1;
      connections[d] = (connections[d] || 0) + 1;
    }

    const sortedHubs = Object.entries(connections).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const description = [
      `> **${routes.length}** active routes connecting **${Object.keys(connections).length}** airports.`,
      '',
      '**Top Hubs (most connections):**',
      ...sortedHubs.map(([code, count], i) => `> \`#${i + 1}\` **${code}** - ${count} connection(s)`),
      '',
      '**All Routes:**',
      ...routes.slice(0, 15).map(r => `> ${r.origin} > ${r.destination}`),
      routes.length > 15 ? `\n> ...and ${routes.length - 15} more. Use \`/routes\` to see all.` : '',
    ].join('\n');

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.primary)
      .addSectionComponents(section =>
        section
          .addTextDisplayComponents(
            td => td.setContent('# Vietnam Airlines Group | PTFS — Route Network'),
            td => td.setContent(description),
          )
          .setThumbnailAccessory(tb => tb.setURL(LOGO))
      )
      .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER} - Use /routes for full list`));

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
