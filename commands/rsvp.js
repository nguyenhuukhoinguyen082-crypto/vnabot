const { SlashCommandBuilder, MessageFlags, ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ThumbnailBuilder } = require('discord.js');
const { getEvents, rsvpEvent } = require('../firebase');
const { LOGO, FOOTER, COLORS } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rsvp')
    .setDescription('RSVP to a Vietnam Airlines Group | PTFS event')
    .addStringOption(opt =>
      opt.setName('event')
        .setDescription('Event ID or name to attend')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const query = interaction.options.getString('event').toLowerCase();
    const events = await getEvents();

    const event = events.find(e =>
      e.id.toLowerCase() === query ||
      (e.name || e.title || '').toLowerCase().includes(query)
    );

    if (!event) {
      const container = new ContainerBuilder()
        .setAccentColor(COLORS.primary)
        .addTextDisplayComponents(
          td => td.setContent('# ❌ Event Not Found'),
          td => td.setContent(`Could not find event matching **"${query}"**.`),
        );

      if (events.length) {
        container.addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        container.addTextDisplayComponents(td => td.setContent('> **Available events:**'));

        for (const e of events) {
          container.addTextDisplayComponents(td => td.setContent([
            `> **📅 ${e.name || e.title || 'Unnamed Event'}**`,
            `> ID: \`${e.id}\``,
            `> Date: ${e.date || e.event_date || 'TBA'}`,
            `> Use \`/rsvp ${e.id}\` to attend`,
          ].join('\n')));
          container.addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
        }
      } else {
        container.addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        container.addTextDisplayComponents(td => td.setContent('No events are currently scheduled. Check back later!'));
      }

      container.addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));
      return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    const result = await rsvpEvent(event.id, interaction.user.id, interaction.user.username);

    if (result === 'already') {
      return interaction.editReply({
        content: `⚠️ You've already RSVP'd to **${event.name || event.title}**! See you there! ✈️`,
      });
    }

    const rsvpCount = (event.rsvps?.length || 0) + 1;

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.success)
      .addSectionComponents(section =>
        section
          .addTextDisplayComponents(
            td => td.setContent('# ✅ RSVP Confirmed!'),
            td => td.setContent(`You're attending **${event.name || event.title || 'the event'}**!`),
            td => td.setContent([
              `> **📅 Event:** ${event.name || event.title || 'N/A'}`,
              `> **📅 Date:** ${event.date || event.event_date || 'TBA'}`,
              `> **🕐 Time:** ${event.time || 'TBA'}`,
              `> **✈️ Flight:** ${event.flight_number || 'N/A'}`,
              `> **👥 Attendees:** ${rsvpCount}`,
            ].join('\n')),
          )
          .setThumbnailAccessory(tb => tb.setURL(LOGO))
      )
      .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
