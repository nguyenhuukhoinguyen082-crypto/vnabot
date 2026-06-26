const { SlashCommandBuilder, MessageFlags, ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ThumbnailBuilder } = require('discord.js');
const { LOGO, FOOTER, COLORS, STATUS_EMOJI } = require('../config');
const { getFrequentFlyer, getFFConfig, updateFrequentFlyer, getFFLeaderboard } = require('../firebase');
const { calculateTier } = require('./ffhelper');
const { creditUB } = require('../services/unbelievaboat');

const TIER_EMOJI = { Member: '⚪', Silver: '⚪', Gold: '🟡', Platinum: '💎' };
const TIER_COLOR = { Member: 0x888888, Silver: 0xC0C0C0, Gold: 0xC4972A, Platinum: 0x00CFFF };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('miles')
    .setDescription('Vietnam Airlines Group | PTFS LotusMiles miles')
    .addSubcommand(sub =>
      sub.setName('balance')
        .setDescription('Check your or someone\'s LotusMiles miles')
        .addUserOption(opt => opt.setName('user').setDescription('User to check').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('redeem')
        .setDescription('Redeem your miles for VND')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Miles to redeem').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('leaderboard')
        .setDescription('View the top 10 LotusMiless')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'balance') {
      await interaction.deferReply();
      const target = interaction.options.getUser('user') || interaction.user;
      const ff = await getFrequentFlyer(target.id);
      const config = await getFFConfig();
      const currentTier = calculateTier(ff.lifetime_miles || 0, config.tiers);
      const tierEmoji = TIER_EMOJI[currentTier.name] || '⚪';

      const sortedTiers = [...config.tiers].sort((a, b) => a.threshold - b.threshold);
      const currentIndex = sortedTiers.findIndex(t => t.name === currentTier.name);
      const nextTier = sortedTiers[currentIndex + 1];

      const container = new ContainerBuilder()
        .setAccentColor(TIER_COLOR[currentTier.name] || COLORS.primary);

      container.addSectionComponents(section =>
        section
          .addTextDisplayComponents(
            td => td.setContent(`# ✈️ ${target.displayName || target.username}'s LotusMiles Status`),
            td => td.setContent([
              `> ${tierEmoji} **Tier:** ${currentTier.name}`,
              `> 🎫 **Available Miles:** ${(ff.miles || 0).toLocaleString()} mi`,
              `> 🏆 **Lifetime Miles:** ${(ff.lifetime_miles || 0).toLocaleString()} mi`,
              `> ✈️ **Flights Completed:** ${ff.flights_completed || 0}`,
            ].join('\n')),
          )
          .setThumbnailAccessory(tb => tb.setURL(LOGO))
      );

      if (nextTier) {
        const remaining = nextTier.threshold - (ff.lifetime_miles || 0);
        container.addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        container.addTextDisplayComponents(td => td.setContent(`> **📈 Next Tier:** ${TIER_EMOJI[nextTier.name] || '⚪'} ${nextTier.name}\n> ${remaining.toLocaleString()} more lifetime miles needed`));
      } else {
        container.addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        container.addTextDisplayComponents(td => td.setContent("> 🏅 **Status:** You've reached the highest tier!"));
      }

      container.addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
      container.addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

      return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    if (sub === 'redeem') {
      await interaction.deferReply();
      const amount = interaction.options.getInteger('amount');
      const ff = await getFrequentFlyer(interaction.user.id);

      if (amount <= 0) return interaction.editReply({ content: '❌ Amount must be greater than 0.' });
      if (amount > (ff.miles || 0)) {
        return interaction.editReply({ content: `❌ You only have **${(ff.miles || 0).toLocaleString()} miles** available.` });
      }

      const vndEarned = Math.floor(amount / 10);
      if (vndEarned < 1) return interaction.editReply({ content: '❌ Minimum redemption is 10 miles (= 1 VND).' });

      await creditUB(interaction.guildId, interaction.user.id, vndEarned, 'Miles redemption');
      await updateFrequentFlyer(interaction.user.id, { miles: (ff.miles || 0) - amount });

      const container = new ContainerBuilder()
        .setAccentColor(0x00B050)
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(
              td => td.setContent('# ✅ Miles Redeemed!'),
              td => td.setContent([
                `> 🎫 **Miles Redeemed:** ${amount.toLocaleString()} mi`,
                `> 💰 **VND Received:** ${vndEarned.toLocaleString()} VND`,
                `> 🎫 **Remaining Miles:** ${((ff.miles || 0) - amount).toLocaleString()} mi`,
              ].join('\n')),
            )
            .setThumbnailAccessory(tb => tb.setURL(LOGO))
        )
        .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

      return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    if (sub === 'leaderboard') {
      await interaction.deferReply();
      const board = await getFFLeaderboard();
      if (!board.length) return interaction.editReply({ content: '✈️ No LotusMiles data yet!' });

      const MEDALS = ['#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10'];
      const lines = await Promise.all(board.map(async (entry, i) => {
        let name = entry.discord_id;
        try {
          const member = await interaction.guild.members.fetch(entry.discord_id).catch(() => null);
          name = member?.displayName || member?.user?.username || entry.discord_id;
        } catch {}
        const emoji = TIER_EMOJI[entry.tier] || '';
        return `> \`${MEDALS[i]}\` **${name}** - ${(entry.lifetime_miles || 0).toLocaleString()} mi ${emoji} ${entry.tier || 'Member'}`;
      }));

      const container = new ContainerBuilder()
        .setAccentColor(0xC4972A)
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(
              td => td.setContent('# Vietnam Airlines Group | PTFS — LotusMiles Leaderboard'),
              td => td.setContent(lines.join('\n')),
            )
            .setThumbnailAccessory(tb => tb.setURL(LOGO))
        )
        .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

      return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
  },
};
