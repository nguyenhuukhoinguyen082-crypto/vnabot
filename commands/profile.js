const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBookings, getEvents, db } = require('../firebase');
const { ref, get } = require('firebase/database');

async function getEconomyData(discordId) {
  try {
    const snap = await get(ref(db, `economy/${discordId}`));
    return snap.exists() ? snap.val() : { wallet: 0, bank: 0, xp: 0, level: 1 };
  } catch { return { wallet: 0, bank: 0, xp: 0, level: 1 }; }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View a user\'s Vietnam Airlines Group | PTFS profile')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to view (leave empty for yourself)').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    const [allBookings, allEvents, economy] = await Promise.all([
      getBookings(),
      getEvents(),
      getEconomyData(target.id),
    ]);

    const userBookings = allBookings.filter(b => b.discord_id === target.id);
    const userRsvps = allEvents.filter(e =>
      Array.isArray(e.rsvps) && e.rsvps.some(r => r.discord_id === target.id)
    );

    const totalVND = (economy.wallet || 0) + (economy.bank || 0);
    const level = economy.level || 1;
    const xp = economy.xp || 0;
    const xpNeeded = level * 100;
    const xpBar = Math.floor((xp / xpNeeded) * 10);
    const progressBar = '🟥'.repeat(xpBar) + '⬛'.repeat(10 - xpBar);

    const joinedAt = member?.joinedAt
      ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>`
      : 'Unknown';

    const roles = member?.roles.cache
      .filter(r => r.id !== interaction.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => `<@&${r.id}>`)
      .slice(0, 3)
      .join(', ') || 'None';

    const embed = new EmbedBuilder()
      .setColor(0x007B8A)
      .setTitle(`👤 ${target.displayName || target.username}'s Profile`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        {
          name: '👋 Member Info',
          value: [
            `> 🏷️ **Username:** ${target.username}`,
            `> 📅 **Joined:** ${joinedAt}`,
            `> 🎖️ **Top Roles:** ${roles}`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '💰 Economy',
          value: [
            `> 👛 **Wallet:** ${(economy.wallet || 0).toLocaleString()} VND`,
            `> 🏦 **Bank:** ${(economy.bank || 0).toLocaleString()} VND`,
            `> 💎 **Total:** ${totalVND.toLocaleString()} VND`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '⭐ Level',
          value: [
            `> 🏅 **Level:** ${level}`,
            `> ✨ **XP:** ${xp}/${xpNeeded}`,
            `> ${progressBar}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '✈️ Flight History',
          value: [
            `> 🎫 **Active Bookings:** ${userBookings.length}`,
            `> 📅 **Events Attended:** ${userRsvps.length}`,
            userBookings.length > 0
              ? `> 🛫 **Last Flight:** ${userBookings[userBookings.length - 1]?.flight_number || 'N/A'}`
              : '> 🛫 **Last Flight:** None yet',
          ].join('\n'),
          inline: false,
        },
      )
      .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
