const { MessageFlags, ContainerBuilder, TextDisplayBuilder } = require('discord.js');
const { getBirthdays, getBirthdayConfig, updateBirthdayConfig } = require('../firebase');
const { LOGO, FOOTER, COLORS } = require('../config');

async function checkBirthdays(client) {
  try {
    const config = await getBirthdayConfig();
    if (!config.channel_id) return;

    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const dateKey = `${month}-${day}`;
    const lastAnnounced = config.last_announced || {};

    if (lastAnnounced[dateKey]) return;

    const birthdays = await getBirthdays();
    const todaysBirthdays = birthdays.filter(b => b.day === day && b.month === month);

    if (!todaysBirthdays.length) return;

    const channel = await client.channels.fetch(config.channel_id).catch(() => null);
    if (!channel) return;

    await Promise.all(todaysBirthdays.map(async (b) => {
      const container = new ContainerBuilder()
        .setAccentColor(COLORS.warning)
        .addTextDisplayComponents(td => td.setContent('# Happy Birthday!'))
        .addTextDisplayComponents(td => td.setContent(`> Everyone wish <@${b.discord_id}> a very happy birthday today!`))
        .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));
      await channel.send({ content: `<@${b.discord_id}>`, components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }));

    await updateBirthdayConfig({ last_announced: { ...lastAnnounced, [dateKey]: true } });
  } catch (err) {
    console.error('Birthday check failed:', err.message);
  }
}

module.exports = { checkBirthdays };
