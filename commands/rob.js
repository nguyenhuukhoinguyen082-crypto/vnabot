const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getEconomy, updateEconomy, getEconomyConfig } = require('../firebase');

const THUMBNAIL = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rob')
    .setDescription('Attempt to rob another user (very risky!)')
    .addUserOption(opt => opt.setName('user').setDescription('User to rob').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user');

    if (target.id === interaction.user.id) return interaction.editReply({ content: '❌ You cannot rob yourself!' });
    if (target.bot) return interaction.editReply({ content: '❌ You cannot rob a bot!' });

    const eco = await getEconomy(interaction.user.id);
    const targetEco = await getEconomy(target.id);
    const config = await getEconomyConfig();
    const now = Date.now();
    const cooldown = config.cooldown_rob * 1000;

    if (eco.last_rob && now - eco.last_rob < cooldown) {
      const hours = Math.ceil((eco.last_rob + cooldown - now) / 3600000);
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0x007B8A).setTitle('⏰ Still Hiding')
          .setThumbnail(THUMBNAIL)
          .setDescription(`Security is searching for you! Lay low for **${hours}h**.`)
          .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })],
      });
    }

    if ((targetEco.wallet || 0) < 100) {
      return interaction.editReply({ content: `❌ **${target.username}** is broke — not worth the risk!` });
    }

    const successRate = config.rob_success_rate / 100;
    const success = Math.random() < successRate;

    let robAmount, newRobberWallet, newTargetWallet;
    if (success) {
      robAmount = Math.floor((targetEco.wallet || 0) * (0.2 + Math.random() * 0.3));
      newRobberWallet = (eco.wallet || 0) + robAmount;
      newTargetWallet = Math.max(0, (targetEco.wallet || 0) - robAmount);
      await updateEconomy(target.id, { wallet: newTargetWallet });
    } else {
      robAmount = config.rob_fine;
      newRobberWallet = Math.max(0, (eco.wallet || 0) - robAmount);
    }

    await updateEconomy(interaction.user.id, { wallet: newRobberWallet, last_rob: now });

    const embed = new EmbedBuilder()
      .setColor(success ? 0x00B050 : 0xFF0000)
      .setTitle(success ? `🦹 Robbery Successful!` : `🚨 Caught Red-Handed!`)
      .setThumbnail(THUMBNAIL)
      .setDescription(success
        ? `> You robbed **${target.username}** at the airport terminal!`
        : `> **${target.username}** called airport security on you!`)
      .addFields(
        { name: success ? '💰 Stolen' : '💸 Fine', value: `${success ? '+' : '-'}${robAmount.toLocaleString()} VND`, inline: true },
        { name: '👛 Your Wallet', value: `${newRobberWallet.toLocaleString()} VND`, inline: true },
        { name: '📊 Success Rate', value: `${config.rob_success_rate}%`, inline: true },
      )
      .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
