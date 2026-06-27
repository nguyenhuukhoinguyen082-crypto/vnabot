const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getFlight, getEvents } = require('../firebase');
require('dotenv').config();

// Sub-airline emoji mapping by callsign prefix
const AIRLINE_TAIL_EMOJI = {
  VN: '<:hvntail:1519977376044286072>',
  BL: '<:BLTail:1514151520936136734>',
  OV: '<:VAS:1514151545745182841>',
};
const AIRLINE_GOLD_EMOJI = '<:goldvna:1514151658014118018>';
const CREW_PING = '<@&1503023201402224780>';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('postflight')
    .setDescription('[STAFF] Post a flight announcement in the VNA format')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt => opt.setName('flightnumber').setDescription('Flight number (e.g. VN100, BL200, OV301)').setRequired(true))
    .addStringOption(opt => opt.setName('flighttype').setDescription('Flight type (e.g. Group Flight, Training Flight, Charter)').setRequired(true))
    .addStringOption(opt => opt.setName('host').setDescription('Host / pilot name').setRequired(true))
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post in (leave empty for current)').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.editReply({ content: '❌ You do not have permission.' });
    }

    const flightNumber = interaction.options.getString('flightnumber').toUpperCase();
    const flightType = interaction.options.getString('flighttype');
    const host = interaction.options.getString('host');
    const channelOpt = interaction.options.getChannel('channel');

    const flight = await getFlight(flightNumber);
    if (!flight) {
      return interaction.editReply({ content: `❌ Flight **${flightNumber}** not found. Create it first with \`/createflight\`.` });
    }

    // Detect sub-airline from callsign prefix
    let prefix = 'VN';
    if (flightNumber.startsWith('BL')) prefix = 'BL';
    else if (flightNumber.startsWith('OV')) prefix = 'OV';

    const tailEmoji = AIRLINE_TAIL_EMOJI[prefix] || AIRLINE_TAIL_EMOJI['VN'];

    // Find Discord Event link
    let eventLink = null;
    try {
      const allEvents = await getEvents();
      const linked = allEvents.find(e =>
        (e.flight_number || '').toUpperCase() === flightNumber ||
        e.flight_id === flight.id
      );
      if (linked?.discord_event_id) {
        eventLink = `https://discord.com/events/${interaction.guild.id}/${linked.discord_event_id}`;
      } else {
        const guildEvents = await interaction.guild.scheduledEvents.fetch().catch(() => null);
        if (guildEvents) {
          const match = guildEvents.find(e =>
            e.name?.toUpperCase().includes(flightNumber) ||
            e.description?.toUpperCase().includes(flightNumber)
          );
          if (match) eventLink = match.url;
        }
      }
    } catch (err) {
      console.error('Event link fetch failed:', err.message);
    }

    const timeDisplay = flight.timestamp
      ? `<t:${Math.floor(flight.timestamp / 1000)}:F>`
      : flight.time || 'TBA';

    const postContent = [
      `${CREW_PING}`,
      ``,
      `## ${tailEmoji} | ${flightNumber} | ${flightType}`,
      `> Xin Chào! A new flight has been scheduled from ${flight.origin_name || flight.origin} to ${flight.destination_name || flight.destination}, flying onboard our ${flight.aircraft || 'aircraft'}.`,
      ``,
      `> Host: ${host}`,
      `> Flight Time: ${timeDisplay}`,
      `> Origin Airport: ${flight.origin_name || flight.origin}`,
      `> Destination Airport: ${flight.destination_name || flight.destination}`,
      ``,
      `> To book your flight, please use the command \`/book flight ${flightNumber}\``,
      `> We hope to see you there!`,
      eventLink ? `> [Event Link](${eventLink})` : `> [Event Link](https://discord.com/channels/${interaction.guild.id})`,
      `-# ${AIRLINE_GOLD_EMOJI} Vietnam Airlines | Reach Further`,
    ].join('\n');

    const targetChannel = channelOpt
      ? await interaction.client.channels.fetch(channelOpt.id).catch(() => interaction.channel)
      : interaction.channel;

    await targetChannel.send({ content: postContent });
    return interaction.editReply({ content: `✅ Flight **${flightNumber}** posted in <#${targetChannel.id}>!` });
  },
};
