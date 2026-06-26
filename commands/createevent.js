const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ContainerBuilder, TextDisplayBuilder } = require('discord.js');
const { createEvent } = require('../firebase');
const utils = require('../utils');
const { FOOTER, COLORS, STATUS_EMOJI } = require('../config');

function ictToTimestamp(dateStr, timeStr) {
  try {
    const [day, month, year] = dateStr.split('/').map(Number);
    const [hour, min] = timeStr.split(':').map(Number);
    return Date.UTC(year, month - 1, day, hour - 7, min);
  } catch { return null; }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createevent')
    .setDescription('[STAFF] Create a new event with full details')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt => opt.setName('name').setDescription('Event name').setRequired(true))
    .addStringOption(opt => opt.setName('date').setDescription('Start date (dd/mm/yyyy)').setRequired(true))
    .addStringOption(opt => opt.setName('time').setDescription('Start time ICT (HH:mm)').setRequired(true))
    .addStringOption(opt => opt.setName('enddate').setDescription('End date (dd/mm/yyyy)').setRequired(true))
    .addStringOption(opt => opt.setName('endtime').setDescription('End time ICT (HH:mm)').setRequired(true))
    .addStringOption(opt => opt.setName('type').setDescription('Event type').setRequired(true)
      .addChoices(
        { name: '✈️ Group Flight', value: 'Group Flight' },
        { name: '📚 Training', value: 'Training' },
        { name: '�- �️ Meeting', value: 'Meeting' },
        { name: '🎉 Special Event', value: 'Special Event' },
        { name: '📋 Other', value: 'Other' },
      ))
    .addStringOption(opt => opt.setName('host').setDescription('Host name').setRequired(true))
    .addStringOption(opt => opt.setName('banner').setDescription('Banner image URL').setRequired(false))
    .addStringOption(opt => opt.setName('shortdesc').setDescription('Short description').setRequired(false))
    .addStringOption(opt => opt.setName('fulldesc').setDescription('Full description').setRequired(false))
    .addStringOption(opt => opt.setName('agenda').setDescription('Event agenda').setRequired(false))
    .addStringOption(opt => opt.setName('flightnumber').setDescription('Linked flight number').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

if (!utils.staffCheck(interaction)) return interaction.editReply({ content: '> You do not have permission to use this command.' });

    const name = interaction.options.getString('name');
    const date = interaction.options.getString('date');
    const time = interaction.options.getString('time');
    const endDate = interaction.options.getString('enddate');
    const endTime = interaction.options.getString('endtime');
    const type = interaction.options.getString('type');
    const host = interaction.options.getString('host');
    const banner = interaction.options.getString('banner') || null;
    const shortDesc = interaction.options.getString('shortdesc') || '';
    const fullDesc = interaction.options.getString('fulldesc') || '';
    const agenda = interaction.options.getString('agenda') || null;
    const flightNumber = interaction.options.getString('flightnumber') || null;

    const tsStart = ictToTimestamp(date, time);
    const tsEnd = ictToTimestamp(endDate, endTime);

    if (!tsStart || !tsEnd) return interaction.editReply({ content: '> Invalid date/time. Use dd/mm/yyyy and HH:mm.' });
    if (tsEnd <= tsStart) return interaction.editReply({ content: '> End time must be after start time.' });

    // Create real Discord Scheduled Event
    let discordEvent = null;
    try {
      discordEvent = await interaction.guild.scheduledEvents.create({
        name,
        scheduledStartTime: new Date(tsStart),
        scheduledEndTime: new Date(tsEnd),
        privacyLevel: 2,
        entityType: 3,
        entityMetadata: { location: `Vietnam Airlines Group | PTFS — ${type}` },
        description: (shortDesc || fullDesc || `${type} event hosted by ${host}`).slice(0, 1000),
        image: banner || null,
      });
    } catch (err) {
      console.error('Discord Event creation failed:', err.message);
    }

    const discordEventLink = discordEvent
      ? `https://discord.com/events/${interaction.guild.id}/${discordEvent.id}`
      : null;

    const eventId = await createEvent({
      name, date_time: `${date} ${time} ICT`, end_time: `${endDate} ${endTime} ICT`,
      timestamp_start: tsStart, timestamp_end: tsEnd,
      event_type: type, host_name: host, banner_image: banner,
      short_description: shortDesc, full_description: fullDesc,
      agenda, flight_number: flightNumber,
      discord_event_id: discordEvent?.id || null,
      discord_link: discordEventLink, status: 'upcoming',
    });

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.success)
      .addTextDisplayComponents(
        td => td.setContent('# Event Created!'),
        td => td.setContent(`> **Name:** \`${name}\``),
        td => td.setContent(`> **Type:** \`${type}\``),
        td => td.setContent(`> **Host:** \`${host}\``),
        td => td.setContent(`> **Start:** <t:${Math.floor(tsStart / 1000)}:F>`),
        td => td.setContent(`> **End:** <t:${Math.floor(tsEnd / 1000)}:F>`),
        td => td.setContent(`> **Flight:** \`${flightNumber || 'N/A'}\``),
        td => td.setContent(`> **Event ID:** \`${eventId}\``),
        td => td.setContent(`> **Discord Event:** ${discordEventLink ? `[Click here](${discordEventLink})` : 'Failed — check bot permissions (Manage Events)'}`),
        td => td.setContent(`> Use \`/postevent ${name}\` to post the announcement`),
        td => td.setContent(`-# Created by ${interaction.user.username} • ${FOOTER}`),
      );

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
