const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getRoutes, getDestinations } = require('../firebase');

const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('network')
    .setDescription('View the Vietnam Airlines Group | PTFS route network as text overview'),

  async execute(interaction) {
    await interaction.deferReply();
    const routes = await getRoutes();
    const destinations = await getDestinations();

    if (!routes.length) return interaction.editReply({ content: '🗺️ No routes available to display yet.' });

    // Build a hub-and-spoke summary: count connections per airport
    const connections = {};
    for (const r of routes) {
      const o = r.origin || 'N/A';
      const d = r.destination || 'N/A';
      connections[o] = (connections[o] || 0) + 1;
      connections[d] = (connections[d] || 0) + 1;
    }

    const sortedHubs = Object.entries(connections).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const embed = new EmbedBuilder()
      .setColor(0x007B8A)
      .setTitle('🗺️ Vietnam Airlines Group | PTFS — Route Network')
      .setThumbnail(LOGO)
      .setDescription([
        `**${routes.length}** active routes connecting **${Object.keys(connections).length}** airports.`,
        '',
        '**🏆 Top Hubs (most connections):**',
        ...sortedHubs.map(([code, count], i) => `${i + 1}. **${code}** — ${count} connection(s)`),
        '',
        '**✈️ All Routes:**',
        ...routes.slice(0, 15).map(r => `> ${r.origin} ✈️ ${r.destination}`),
        routes.length > 15 ? `\n*...and ${routes.length - 15} more. Use \`/routes\` to see all.*` : '',
      ].join('\n'))
      .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao • Use /routes for full list' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
