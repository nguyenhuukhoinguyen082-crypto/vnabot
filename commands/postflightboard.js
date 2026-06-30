const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { getFlights, getBookings, getConfig } = require('../firebase');
let generateFlightBoard;
try {
  generateFlightBoard = require('../Flightboard').generateFlightBoard;
} catch (e) {
  console.error('Failed to load Flightboard:', e.message);
  generateFlightBoard = () => Buffer.alloc(0); // Fallback
}
require('dotenv').config();

const VNA_NAVY = 0x006785;
const VNA_GOLD = 0xDC9D1F;
const LOGO     = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

async function buildAndPostBoard(client, guild, channelId) {
  const now24 = Date.now() + 24 * 60 * 60 * 1000;

  // Get all flights in next 24 hours
  const allFlights = await getFlights();
  const upcoming   = allFlights.filter(f =>
    f.timestamp &&
    f.timestamp >= Date.now() &&
    f.timestamp <= now24 &&
    f.status !== 'cancelled' &&
    f.status !== 'ended'
  ).sort((a, b) => a.timestamp - b.timestamp);

  // Build bookings map: flight_id -> count
  const allBookings = await getBookings();
  const bookingsMap = {};
  for (const b of allBookings) {
    bookingsMap[b.flight_id] = (bookingsMap[b.flight_id] || 0) + 1;
  }

  const imageBuffer = await generateFlightBoard(upcoming, bookingsMap, guild.name);
  const attachment  = new AttachmentBuilder(imageBuffer, { name: 'flightboard.png' });

  const embed = new EmbedBuilder()
    .setColor(VNA_NAVY)
    .setTitle('✈️ Vietnam Airlines Group | PTFS — Live Flight Board')
    .setDescription(`**${upcoming.length}** flight(s) scheduled in the next 24 hours.`)
    .setImage('attachment://flightboard.png')
    .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao • Updates daily at 06:00 ICT' })
    .setTimestamp();

  const targetChannel = await client.channels.fetch(channelId).catch(() => null);
  if (!targetChannel) return false;

  await targetChannel.send({ embeds: [embed], files: [attachment] });
  return true;
}

module.exports = {
  buildAndPostBoard,
  data: new SlashCommandBuilder()
    .setName('postflightboard')
    .setDescription('[STAFF] Manually post the flight board now')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(opt => opt.setName('channel').setDescription('Override channel (leave empty for configured channel)').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.editReply({ content: '❌ You do not have permission.' });
    }

    const config    = await getConfig();
    const channelId = interaction.options.getChannel('channel')?.id || config.flightboard_channel_id;

    if (!channelId) {
      return interaction.editReply({ content: '❌ No flight board channel set. Run `/setflightboardchannel` first.' });
    }

    const success = await buildAndPostBoard(interaction.client, interaction.guild, channelId);
    if (!success) return interaction.editReply({ content: '❌ Could not find the configured channel.' });

    return interaction.editReply({ content: `✅ Flight board posted in <#${channelId}>!` });
  },
};
