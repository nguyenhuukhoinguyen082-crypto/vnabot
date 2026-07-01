const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getFlight, updateFlight, getConfig } = require('../firebase');
require('dotenv').config();

const VNA_NAVY = 0x006785;
const AIRLINE_TAIL_EMOJI = {
  VN: '<:hvntail:1519977376044286072>',
  BL: '<:BLTail:1514151520936136734>',
  OV: '<:VAS:1514151545745182841>',
};

function ictToTimestamp(dateStr, timeStr) {
  try {
    const [day, month, year] = dateStr.split('/').map(Number);
    const [hour, min] = timeStr.split(':').map(Number);
    return Date.UTC(year, month - 1, day, hour - 7, min);
  } catch { return null; }
}

function getTailEmoji(flightNumber) {
  const prefix = flightNumber.slice(0, 2).toUpperCase();
  return AIRLINE_TAIL_EMOJI[prefix] || AIRLINE_TAIL_EMOJI['VN'];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('updateflight')
    .setDescription('[STAFF] Update a flight — status changes auto-post the relevant announcement')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt => opt.setName('flightnumber').setDescription('Flight number to update (e.g. VN100)').setRequired(true))
    .addStringOption(opt => opt.setName('status').setDescription('New status').setRequired(false)
      .addChoices(
        { name: '🟢 Scheduled', value: 'scheduled' },
        { name: '🛂 Boarding (auto-posts check-in)', value: 'boarding' },
        { name: '🟡 Delayed (auto-posts notice)', value: 'delayed' },
        { name: '🔴 Cancelled (auto-posts notice)', value: 'cancelled' },
        { name: '🔄 Rescheduled (auto-posts notice)', value: 'rescheduled' },
        { name: '✈️ Departed', value: 'departed' },
        { name: '⚫ Ended', value: 'ended' },
      ))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason (required for delayed/cancelled/rescheduled)').setRequired(false))
    .addStringOption(opt => opt.setName('newdate').setDescription('New date if rescheduled (dd/mm/yyyy)').setRequired(false))
    .addStringOption(opt => opt.setName('newtime').setDescription('New time ICT if rescheduled (HH:mm)').setRequired(false))
    .addStringOption(opt => opt.setName('gate').setDescription('Update gate').setRequired(false))
    .addChannelOption(opt => opt.setName('channel').setDescription('Override which channel the auto-notice posts to').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.editReply({ content: '❌ You do not have permission.' });
    }

    const flightNumber = interaction.options.getString('flightnumber').toUpperCase();
    const newStatus     = interaction.options.getString('status');
    const reason        = interaction.options.getString('reason');
    const newDate       = interaction.options.getString('newdate');
    const newTime       = interaction.options.getString('newtime');
    const newGate       = interaction.options.getString('gate');
    const channelOpt    = interaction.options.getChannel('channel');

    const flight = await getFlight(flightNumber);
    if (!flight) {
      return interaction.editReply({ content: `❌ Flight **${flightNumber}** not found.` });
    }

    const oldStatus = (flight.status || 'scheduled').toLowerCase();
    const updates = {};
    if (newGate) updates.gate = newGate;

    let statusChanged = false;
    if (newStatus && newStatus !== oldStatus) {
      statusChanged = true;
      updates.status = newStatus;

      // Require a reason for disruptive status changes
      if (['delayed', 'cancelled', 'rescheduled'].includes(newStatus) && !reason) {
        return interaction.editReply({ content: `❌ A \`reason\` is required when setting status to **${newStatus}**.` });
      }

      // Handle reschedule date/time update
      if (newStatus === 'rescheduled' && newDate && newTime) {
        const ts = ictToTimestamp(newDate, newTime);
        if (!ts) return interaction.editReply({ content: '❌ Invalid newdate/newtime format. Use dd/mm/yyyy and HH:mm.' });
        updates.date = newDate;
        updates.time = `${newDate} ${newTime}`;
        updates.timestamp = ts;
      }
    }

    await updateFlight(flight.id, updates);

    // ── Guard: only auto-post once per actual status change ────────────────────
    if (!statusChanged) {
      return interaction.editReply({ content: `✅ Flight **${flightNumber}** updated.${newGate ? ` Gate: ${newGate}` : ''}` });
    }

    const config = await getConfig();
    const targetChannelId = channelOpt?.id || flight.announcement_channel_id || config.default_flight_channel_id;

    if (!targetChannelId) {
      return interaction.editReply({ content: `⚠️ Status updated to **${newStatus}**, but no channel is known for this flight to auto-post the notice. Original announcement channel wasn't recorded — pass \`channel\` manually next time.` });
    }

    const targetChannel = await interaction.client.channels.fetch(targetChannelId).catch(() => null);
    if (!targetChannel) {
      return interaction.editReply({ content: `⚠️ Status updated, but the announcement channel could no longer be found.` });
    }

    const tailEmoji = getTailEmoji(flightNumber);
    const flightType = flight.flight_type || 'Normal Flight';

    // ═══════════════════════════════════════════════════════════════════════
    // CHECK-IN announcement (status → boarding)
    // ═══════════════════════════════════════════════════════════════════════
    if (newStatus === 'boarding') {
      const spawnAirport = flight.ptfs_origin_airport || flight.origin_name || flight.origin || 'the origin airport';

      const embed = new EmbedBuilder()
        .setColor(VNA_NAVY)
        .setTitle(`${tailEmoji} | ${flightNumber} | ${flightType}`)
        .setDescription([
          `Check-in for flight ${flightNumber} has started. Please follow the following instructions to proceed your check-in.`,
          '',
          '> - Prepare your booking ID',
          '> - Join the server',
          `> - Spawn at ${spawnAirport}`,
          '> - Head to the check-in counter',
          '',
          'Please follow server-wide rules during the flight and we hope you have a great flight.',
        ].join('\n'))
        .setFooter({ text: 'Vietnam Airlines | Reach Further' })
        .setTimestamp();

      const row = new ActionRowBuilder();
      if (config.private_server_link) {
        row.addComponents(
          new ButtonBuilder()
            .setLabel('🔗 Join Private Server')
            .setStyle(ButtonStyle.Link)
            .setURL(config.private_server_link),
        );
      }

      await targetChannel.send({
        content: '<@&1503023201402224780>',
        embeds: [embed],
        components: row.components.length ? [row] : [],
      });

      return interaction.editReply({ content: `✅ Check-in announcement posted in <#${targetChannel.id}> for **${flightNumber}**.` });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DELAY / CANCEL / RESCHEDULE announcement
    // ═══════════════════════════════════════════════════════════════════════
    if (['delayed', 'cancelled', 'rescheduled'].includes(newStatus)) {
      const verbMap = {
        delayed: 'delayed',
        cancelled: 'cancelled',
        rescheduled: 'rescheduled',
      };
      const verb = verbMap[newStatus];
      const destLabel = flight.destination_name || flight.destination || 'destination';

      let extraLine = '';
      if (newStatus === 'rescheduled' && updates.timestamp) {
        extraLine = `\n\n> 🕐 **New Flight Time:** <t:${Math.floor(updates.timestamp / 1000)}:F>`;
      }

      const embed = new EmbedBuilder()
        .setColor(newStatus === 'cancelled' ? 0xEF4444 : newStatus === 'delayed' ? 0xF59E0B : VNA_NAVY)
        .setTitle(`${tailEmoji} | ${flightNumber} | ${flightType}`)
        .setDescription([
          `Dear passengers, flight ${flightNumber} flying to ${destLabel}, has been ${verb} due to ${reason}. We deeply apologize for the inconvenience.`,
          '',
          `This ${newStatus === 'cancelled' ? 'cancellation' : newStatus === 'delayed' ? 'delay' : 'reschedulation'} is the result of upcoming events that we do not know. We appreciate your understanding and look forward to welcoming you on a future flight.`,
          extraLine,
        ].join('\n'))
        .setFooter({ text: 'Vietnam Airlines | Reach Further' })
        .setTimestamp();

      await targetChannel.send({
        content: '<@&1503023201402224780>',
        embeds: [embed],
      });

      return interaction.editReply({ content: `✅ ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)} notice posted in <#${targetChannel.id}> for **${flightNumber}**.` });
    }

    // Other status changes (scheduled, departed, ended) — no auto-post needed
    return interaction.editReply({ content: `✅ Flight **${flightNumber}** status updated to **${newStatus}**.` });
  },
};
