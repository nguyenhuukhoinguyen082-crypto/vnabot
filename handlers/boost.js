const { MessageFlags, ContainerBuilder } = require('discord.js');
const { LOGO, FOOTER, COLORS } = require('../config');

async function handleBoost(oldMember, newMember) {
  try {
    const oldBoostedAt = oldMember.premiumSinceTimestamp;
    const newBoostedAt = newMember.premiumSinceTimestamp;

    if (oldBoostedAt || !newBoostedAt) return;

    const channelId = process.env.BOOST_CHANNEL_ID;
    const channel = channelId
      ? await newMember.guild.channels.fetch(channelId).catch(() => null)
      : newMember.guild.systemChannel;

    if (!channel) return;

    const boostCount = newMember.guild.premiumSubscriptionCount || 0;

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.boost)
      .addTextDisplayComponents(td => td.setContent('# Thank You for Boosting!'))
      .addTextDisplayComponents(td => td.setContent(`<@${newMember.id}> just boosted **Vietnam Airlines Group | PTFS**! Thank you for your support!`))
      .addTextDisplayComponents(td => td.setContent(`> **Total Server Boosts:** ${boostCount}`))
      .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

    await channel.send({ content: `<@${newMember.id}>`, components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
  } catch (err) {
    console.error('Boost handler error:', err.message);
  }
}

module.exports = { handleBoost };
