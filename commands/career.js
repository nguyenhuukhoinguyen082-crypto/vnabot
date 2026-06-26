const {
  SlashCommandBuilder, MessageFlags,
  ContainerBuilder, SectionBuilder,
  TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
} = require('discord.js');
const { LOGO, FOOTER, COLORS } = require('../config');
const { getCareer, getCareerConfig, getCareerLeaderboard } = require('../firebase');
const { calculateRank } = require('./ffhelper');

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

      const sortedRanks = [...config.ranks].sort((a, b) => a.flights_required - b.flights_required);
      const currentIndex = sortedRanks.findIndex(r => r.name === currentRank.name);
      const nextRank = sortedRanks[currentIndex + 1];

      const container = new ContainerBuilder()
        .setAccentColor(COLORS.primary)
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(td => td.setContent(`# ${target.displayName || target.username}'s Career Progress`))
            .setThumbnailAccessory(thumb => thumb.setURL(target.displayAvatarURL({ dynamic: true }) || LOGO))
        )
        .addTextDisplayComponents(td => td.setContent(
          `> **Current Rank:** ${currentRank.name}\n` +
          `> **Days in Server:** ${daysInServer} day(s)\n` +
          `> **Flights Completed:** ${flightsCompleted}`
        ));

      if (nextRank) {
        const daysNeeded = Math.max(0, nextRank.days_required - daysInServer);
        const flightsNeeded = Math.max(0, nextRank.flights_required - flightsCompleted);
        container.addTextDisplayComponents(td => td.setContent(
          `### Next Rank: ${nextRank.name}\n` +
          `${daysNeeded > 0 ? `> ${daysNeeded} more day(s) in server` : '> Time requirement met'}\n` +
          `${flightsNeeded > 0 ? `> ${flightsNeeded} more flight(s) needed` : '> Flight requirement met'}`
        ));
      } else {
        container.addTextDisplayComponents(td => td.setContent("> You've reached the highest rank!"));
      }

      container.addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

      return interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub === 'leaderboard') {
      await interaction.deferReply();
      const board = await getCareerLeaderboard();
      if (!board.length) return interaction.editReply({ content: 'No career data yet!' });

      const MEDALS = ['#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10'];
      const lines = await Promise.all(board.map(async (entry, i) => {
        let name = entry.discord_id;
        try {
          const member = await interaction.guild.members.fetch(entry.discord_id).catch(() => null);
          name = member?.displayName || member?.user?.username || entry.discord_id;
        } catch {}
        return `> \`${MEDALS[i]}\` **${name}** - ${entry.flights_completed || 0} flights - ${entry.rank || 'Trainee'}`;
      }));

      const container = new ContainerBuilder()
        .setAccentColor(COLORS.primary)
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(td => td.setContent('# Vietnam Airlines Group | PTFS - Career Leaderboard'))
            .setThumbnailAccessory(thumb => thumb.setURL(LOGO))
        )
        .addTextDisplayComponents(td => td.setContent(lines.join('\n')))
        .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

      return interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};
