const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getFrequentFlyer, getFFConfig, updateFrequentFlyer, getEconomy, updateEconomy, getFFLeaderboard } = require('../firebase');
const { calculateTier } = require('./ffhelper');

const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

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

    // ══════════════════════════════════════════════════════════════════════════
    // BALANCE
    // ══════════════════════════════════════════════════════════════════════════
    if (sub === 'balance') {
      await interaction.deferReply();
      const target = interaction.options.getUser('user') || interaction.user;
      const ff = await getFrequentFlyer(target.id);
      const config = await getFFConfig();
      const currentTier = calculateTier(ff.lifetime_miles || 0, config.tiers);
      const tierEmoji = TIER_EMOJI[currentTier.name] || '⚪';

      // Find next tier
      const sortedTiers = [...config.tiers].sort((a, b) => a.threshold - b.threshold);
      const currentIndex = sortedTiers.findIndex(t => t.name === currentTier.name);
      const nextTier = sortedTiers[currentIndex + 1];

      const embed = new EmbedBuilder()
        .setColor(TIER_COLOR[currentTier.name] || 0x007B8A)
        .setTitle(`✈️ ${target.displayName || target.username}'s LotusMiles Status`)
        .setThumbnail(LOGO)
        .addFields(
          { name: `${tierEmoji} Tier`, value: currentTier.name, inline: true },
          { name: '🎫 Available Miles', value: `${(ff.miles || 0).toLocaleString()} mi`, inline: true },
          { name: '🏆 Lifetime Miles', value: `${(ff.lifetime_miles || 0).toLocaleString()} mi`, inline: true },
          { name: '✈️ Flights Completed', value: `${ff.flights_completed || 0}`, inline: true },
        )
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
        .setTimestamp();

      if (nextTier) {
        const remaining = nextTier.threshold - (ff.lifetime_miles || 0);
        embed.addFields({
          name: `📈 Next Tier: ${TIER_EMOJI[nextTier.name] || '⚪'} ${nextTier.name}`,
          value: `> ${remaining.toLocaleString()} more lifetime miles needed`,
          inline: false,
        });
      } else {
        embed.addFields({ name: '🏅 Status', value: '> You\'ve reached the highest tier!', inline: false });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // REDEEM
    // ══════════════════════════════════════════════════════════════════════════
    if (sub === 'redeem') {
      await interaction.deferReply();
      const amount = interaction.options.getInteger('amount');
      const ff = await getFrequentFlyer(interaction.user.id);

      if (amount <= 0) return interaction.editReply({ content: '❌ Amount must be greater than 0.' });
      if (amount > (ff.miles || 0)) {
        return interaction.editReply({ content: `❌ You only have **${(ff.miles || 0).toLocaleString()} miles** available.` });
      }

      // Conversion rate: 10 miles = 1 VND
      const vndEarned = Math.floor(amount / 10);
      if (vndEarned < 1) return interaction.editReply({ content: '❌ Minimum redemption is 10 miles (= 1 VND).' });

      const eco = await getEconomy(interaction.user.id);
      await updateEconomy(interaction.user.id, { wallet: (eco.wallet || 0) + vndEarned });
      await updateFrequentFlyer(interaction.user.id, { miles: (ff.miles || 0) - amount });

      const embed = new EmbedBuilder()
        .setColor(0x00B050)
        .setTitle('✅ Miles Redeemed!')
        .setThumbnail(LOGO)
        .addFields(
          { name: '🎫 Miles Redeemed', value: `${amount.toLocaleString()} mi`, inline: true },
          { name: '💰 VND Received', value: `${vndEarned.toLocaleString()} VND`, inline: true },
          { name: '🎫 Remaining Miles', value: `${((ff.miles || 0) - amount).toLocaleString()} mi`, inline: true },
        )
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LEADERBOARD
    // ══════════════════════════════════════════════════════════════════════════
    if (sub === 'leaderboard') {
      await interaction.deferReply();
      const board = await getFFLeaderboard();
      if (!board.length) return interaction.editReply({ content: '✈️ No LotusMiles data yet!' });

      const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      const lines = await Promise.all(board.map(async (entry, i) => {
        let name = entry.discord_id;
        try {
          const member = await interaction.guild.members.fetch(entry.discord_id).catch(() => null);
          name = member?.displayName || member?.user?.username || entry.discord_id;
        } catch {}
        const emoji = TIER_EMOJI[entry.tier] || '⚪';
        return `${MEDALS[i]} **${name}** — ${(entry.lifetime_miles || 0).toLocaleString()} mi ${emoji} ${entry.tier || 'Member'}`;
      }));

      const embed = new EmbedBuilder()
        .setColor(0xC4972A)
        .setTitle('✈️ Vietnam Airlines Group | PTFS — LotusMiles Leaderboard')
        .setDescription(lines.join('\n'))
        .setThumbnail(LOGO)
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
