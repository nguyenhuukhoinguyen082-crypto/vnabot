const { SlashCommandBuilder, MessageFlags, ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ThumbnailBuilder } = require('discord.js');
const { LOGO, FOOTER, COLORS, STATUS_EMOJI } = require('../config');
const { getBookings } = require('../firebase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logbook')
    .setDescription('View your or someone\'s flight history')
    .addUserOption(opt => opt.setName('user').setDescription('User to check').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') || interaction.user;

    const allBookings = await getBookings();
    const userBookings = allBookings
      .filter(b => b.discord_id === target.id)
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    if (!userBookings.length) {
      const container = new ContainerBuilder()
        .setAccentColor(COLORS.primary)
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(
              td => td.setContent(`# 📖 ${target.displayName || target.username}'s Logbook`),
              td => td.setContent('No flights logged yet. Book a flight with `/book flight`!'),
            )
            .setThumbnailAccessory(tb => tb.setURL(target.displayAvatarURL({ dynamic: true }) || LOGO))
        )
        .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));
      return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    const economyCount = userBookings.filter(b => b.seat_class === 'economy').length;
    const businessCount = userBookings.filter(b => b.seat_class === 'business').length;

    const recent = userBookings.slice(0, 10);
    const lines = recent.map(b => {
      const date = b.created_at ? new Date(b.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
      const classEmoji = b.seat_class === 'business' ? '💼' : '💺';
      return `${classEmoji} **${b.flight_number}** — ${b.origin} ✈️ ${b.destination} — Seat ${b.seat} — *${date}*`;
    });

    const container = new ContainerBuilder()
      .setAccentColor(0x007B8A)
      .addSectionComponents(section =>
        section
          .addTextDisplayComponents(
            td => td.setContent(`# 📖 ${target.displayName || target.username}'s Flight Logbook`),
            td => td.setContent(`**${userBookings.length}** total flight(s) logged.`),
            td => td.setContent(`> **💺 Economy Flights:** ${economyCount}  |  **💼 Business Flights:** ${businessCount}`),
          )
          .setThumbnailAccessory(tb => tb.setURL(target.displayAvatarURL({ dynamic: true }) || LOGO))
      )
      .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(td => td.setContent(`> **🕐 Recent Flights**\n${lines.join('\n')}`));

    if (userBookings.length > 10) {
      container.addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
      container.addTextDisplayComponents(td => td.setContent(`*...and ${userBookings.length - 10} more flight(s).*`));
    }

    container.addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(td => td.setContent('-# Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao'));

    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
