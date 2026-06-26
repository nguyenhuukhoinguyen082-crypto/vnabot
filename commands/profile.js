const { SlashCommandBuilder, MessageFlags, ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ThumbnailBuilder } = require('discord.js');
const { LOGO, FOOTER, COLORS, STATUS_EMOJI } = require('../config');
const { getUserBookings, getEvents } = require('../firebase');
const { isUBEnabled, getUBBalance } = require('../services/unbelievaboat');

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

    const [userBookings, allEvents] = await Promise.all([
      getUserBookings(target.id),
      getEvents(),
    ]);
    const userRsvps = allEvents.filter(e =>
      Array.isArray(e.rsvps) && e.rsvps.some(r => r.discord_id === target.id)
    );

    let economyLine = '> Economy is tracked via Unbelievaboat.';
    if (isUBEnabled()) {
      const ubBal = await getUBBalance(interaction.guildId, target.id).catch(() => null);
      if (ubBal) {
        economyLine = [
          `> 👛 **Cash:** ${(ubBal.cash || 0).toLocaleString()} VND`,
          `> 🏦 **Bank:** ${(ubBal.bank || 0).toLocaleString()} VND`,
          `> 💎 **Total:** ${(ubBal.total || 0).toLocaleString()} VND`,
        ].join('\n');
      }
    }

    const joinedAt = member?.joinedAt
      ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>`
      : 'Unknown';

    const roles = member?.roles.cache
      .filter(r => r.id !== interaction.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => `<@&${r.id}>`)
      .slice(0, 3)
      .join(', ') || 'None';

    const flightHistory = [
      `> 🎫 **Active Bookings:** ${userBookings.length}`,
      `> 📅 **Events Attended:** ${userRsvps.length}`,
      userBookings.length > 0
        ? `> 🛫 **Last Flight:** ${userBookings[userBookings.length - 1]?.flight_number || 'N/A'}`
        : '> 🛫 **Last Flight:** None yet',
    ].join('\n');

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.primary)
      .addSectionComponents(section =>
        section
          .addTextDisplayComponents(
            td => td.setContent(`# 👤 ${target.displayName || target.username}'s Profile`),
            td => td.setContent([
              `> 🏷️ **Username:** ${target.username}`,
              `> 📅 **Joined:** ${joinedAt}`,
              `> 🎖️ **Top Roles:** ${roles}`,
            ].join('\n')),
            td => td.setContent(`> **💰 Economy**\n${economyLine}`),
          )
          .setThumbnailAccessory(tb => tb.setURL(target.displayAvatarURL({ dynamic: true, size: 256 })))
      )
      .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(td => td.setContent(`> **✈️ Flight History**\n${flightHistory}`))
      .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
