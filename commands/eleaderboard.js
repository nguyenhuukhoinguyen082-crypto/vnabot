const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getEconomyLeaderboard } = require('../firebase');

const THUMBNAIL = 'https://i.postimg.cc/SRMftcKS/vna.jpg';
const MEDALS = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eleaderboard')
    .setDescription('View the top 10 richest users in the server'),

  async execute(interaction) {
    await interaction.deferReply();
    const board = await getEconomyLeaderboard();

    if (!board.length) return interaction.editReply({ content: '💰 No economy data yet!' });

    const lines = await Promise.all(board.map(async (entry, i) => {
      let name = entry.discord_id;
      try {
        const member = await interaction.guild.members.fetch(entry.discord_id).catch(() => null);
        name = member?.displayName || member?.user?.username || entry.discord_id;
      } catch {}
      return `${MEDALS[i]} **${name}** — ${entry.total.toLocaleString()} VND`;
    }));

    const embed = new EmbedBuilder()
      .setColor(0xC4972A)
      .setTitle('💰 Vietnam Airlines Group | PTFS — Economy Leaderboard')
      .setDescription(lines.join('\n'))
      .setThumbnail(THUMBNAIL)
      .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
