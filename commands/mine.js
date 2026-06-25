const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getEconomy, updateEconomy, getEconomyConfig } = require('../firebase');

const THUMBNAIL = 'https://i.postimg.cc/SRMftcKS/vna.jpg';
const OUTCOMES = [
  { label: 'Jet Fuel Deposit', emoji: '⛽', multiplier: 1.0 },
  { label: 'Runway Scrap Metal', emoji: '🔩', multiplier: 0.8 },
  { label: 'Rare Aviation Parts', emoji: '⚙️', multiplier: 1.5 },
  { label: 'Airport Gold Nugget', emoji: '🪙', multiplier: 2.0 },
  { label: 'Nothing but dirt', emoji: '💨', multiplier: 0.2 },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mine')
    .setDescription('Go mining at the airport construction site to earn VND'),

  async execute(interaction) {
    await interaction.deferReply();
    const eco = await getEconomy(interaction.user.id);
    const config = await getEconomyConfig();
    const now = Date.now();
    const cooldown = config.cooldown_mine * 1000;

    if (eco.last_mine && now - eco.last_mine < cooldown) {
      const mins = Math.ceil((eco.last_mine + cooldown - now) / 60000);
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0x007B8A).setTitle('⏰ Still Mining')
          .setThumbnail(THUMBNAIL)
          .setDescription(`Your pickaxe is worn out! Rest for **${mins} minute(s)**.`)
          .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })],
      });
    }

    const outcome = OUTCOMES[Math.floor(Math.random() * OUTCOMES.length)];
    const base = Math.floor(Math.random() * (config.mine_max - config.mine_min + 1)) + config.mine_min;
    const amount = Math.floor(base * outcome.multiplier);
    const newWallet = (eco.wallet || 0) + amount;
    const xp = (eco.xp || 0) + 8;

    await updateEconomy(interaction.user.id, { wallet: newWallet, last_mine: now, xp });

    const embed = new EmbedBuilder()
      .setColor(0xC4972A)
      .setTitle(`⛏️ Mining Complete!`)
      .setThumbnail(THUMBNAIL)
      .setDescription(`> You found **${outcome.emoji} ${outcome.label}**!`)
      .addFields(
        { name: '💰 Earned', value: `+${amount.toLocaleString()} VND`, inline: true },
        { name: '✨ XP', value: '+8 XP', inline: true },
        { name: '👛 Wallet', value: `${newWallet.toLocaleString()} VND`, inline: true },
      )
      .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
