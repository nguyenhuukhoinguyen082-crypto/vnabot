const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getCareer, getCareerConfig, getCareerLeaderboard } = require('../firebase');
const { calculateRank } = require('./ffhelper');

const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('career')
    .setDescription('Vietnam Airlines Group | PTFS pilot career progress')
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('View career rank and progress')
        .addUserOption(opt => opt.setName('user').setDescription('User to check').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('leaderboard')
        .setDescription('View the top 10 pilots by flights completed')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ══════════════════════════════════════════════════════════════════════════
    // INFO
    // ══════════════════════════════════════════════════════════════════════════
    if (sub === 'info') {
      await interaction.deferReply();
      const target = interaction.options.getUser('user') || interaction.user;
      const career = await getCareer(target.id);
      const config = await getCareerConfig();

      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      const joinTimestamp = career.join_timestamp || member?.joinedTimestamp || Date.now();
      const daysInServer = Math.floor((Date.now() - joinTimestamp) / 86400000);
      const flightsCompleted = career.flights_completed || 0;

      const currentRank = calculateRank(daysInServer, flightsCompleted, config.ranks);

      // Find next rank
      const sortedRanks = [...config.ranks].sort((a, b) => a.flights_required - b.flights_required);
      const currentIndex = sortedRanks.findIndex(r => r.name === currentRank.name);
      const nextRank = sortedRanks[currentIndex + 1];

      const embed = new EmbedBuilder()
        .setColor(0x007B8A)
        .setTitle(`👨‍✈️ ${target.displayName || target.username}'s Career Progress`)
        .setThumbnail(target.displayAvatarURL({ dynamic: true }) || LOGO)
        .addFields(
          { name: '🎖️ Current Rank', value: currentRank.name, inline: true },
          { name: '📅 Days in Server', value: `${daysInServer} day(s)`, inline: true },
          { name: '✈️ Flights Completed', value: `${flightsCompleted}`, inline: true },
        )
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
        .setTimestamp();

      if (nextRank) {
        const daysNeeded = Math.max(0, nextRank.days_required - daysInServer);
        const flightsNeeded = Math.max(0, nextRank.flights_required - flightsCompleted);
        embed.addFields({
          name: `📈 Next Rank: ${nextRank.name}`,
          value: [
            daysNeeded > 0 ? `> 📅 ${daysNeeded} more day(s) in server` : '> 📅 Time requirement met ✅',
            flightsNeeded > 0 ? `> ✈️ ${flightsNeeded} more flight(s) needed` : '> ✈️ Flight requirement met ✅',
          ].join('\n'),
          inline: false,
        });
      } else {
        embed.addFields({ name: '🏅 Status', value: '> You\'ve reached the highest rank!', inline: false });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LEADERBOARD
    // ══════════════════════════════════════════════════════════════════════════
    if (sub === 'leaderboard') {
      await interaction.deferReply();
      const board = await getCareerLeaderboard();
      if (!board.length) return interaction.editReply({ content: '👨‍✈️ No career data yet!' });

      const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      const lines = await Promise.all(board.map(async (entry, i) => {
        let name = entry.discord_id;
        try {
          const member = await interaction.guild.members.fetch(entry.discord_id).catch(() => null);
          name = member?.displayName || member?.user?.username || entry.discord_id;
        } catch {}
        return `${MEDALS[i]} **${name}** — ${entry.flights_completed || 0} flights — 🎖️ ${entry.rank || 'Trainee'}`;
      }));

      const embed = new EmbedBuilder()
        .setColor(0x007B8A)
        .setTitle('👨‍✈️ Vietnam Airlines Group | PTFS — Career Leaderboard')
        .setDescription(lines.join('\n'))
        .setThumbnail(LOGO)
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
