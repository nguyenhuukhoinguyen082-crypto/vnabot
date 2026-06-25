const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} = require('discord.js');
const { getFlight, getBookings, cancelBooking } = require('../firebase');
require('dotenv').config();

const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checkin')
    .setDescription('[STAFF] Check in passengers for a flight')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt => opt.setName('flightnumber').setDescription('Flight number (e.g. VJ100)').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
    }

    const flightNumber = interaction.options.getString('flightnumber').toUpperCase();
    const flight = await getFlight(flightNumber);
    if (!flight) return interaction.editReply({ content: `❌ Flight **${flightNumber}** not found.` });

    const bookings = await getBookings(flight.id);
    if (!bookings.length) {
      return interaction.editReply({ content: `📋 Flight **${flightNumber}** has no bookings to check in.` });
    }

    // Sort by seat for readability
    const sorted = [...bookings].sort((a, b) => (a.seat || '').localeCompare(b.seat || ''));

    let page = 0;
    const perPage = 5;
    const totalPages = Math.ceil(sorted.length / perPage);
    let checkedIn = new Set();

    function buildEmbed(p) {
      const slice = sorted.slice(p * perPage, (p + 1) * perPage);
      const embed = new EmbedBuilder()
        .setColor(0x007B8A)
        .setTitle(`🛂 Check-In — Flight ${flightNumber}`)
        .setThumbnail(LOGO)
        .setDescription(`**${bookings.length - checkedIn.size}** passenger(s) remaining to check in.\nRoute: ${flight.origin} ✈️ ${flight.destination}`)
        .setFooter({ text: `Page ${p + 1} of ${totalPages} • Vietnam Airlines Group | PTFS` })
        .setTimestamp();

      for (const b of slice) {
        const status = checkedIn.has(b.id) ? '✅ Checked In' : '⏳ Pending';
        embed.addFields({
          name: `💺 Seat ${b.seat} — ${b.display_name || b.username}`,
          value: `> 🎫 Code: \`${b.booking_code}\`\n> 📋 Status: ${status}`,
          inline: false,
        });
      }
      return embed;
    }

    function buildRows(p) {
      const slice = sorted.slice(p * perPage, (p + 1) * perPage);
      const rows = [];

      // Check-in buttons (up to 5 per row, one row per booking on this page — max 5 bookings per page)
      const checkinRow = new ActionRowBuilder().addComponents(
        slice.map(b =>
          new ButtonBuilder()
            .setCustomId(`ci_check_${b.id}`)
            .setLabel(`Seat ${b.seat}`)
            .setStyle(checkedIn.has(b.id) ? ButtonStyle.Secondary : ButtonStyle.Success)
            .setDisabled(checkedIn.has(b.id))
            .setEmoji(checkedIn.has(b.id) ? '✅' : '🛂')
        )
      );
      rows.push(checkinRow);

      const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ci_prev').setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
        new ButtonBuilder().setCustomId('ci_next').setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(p === totalPages - 1),
        new ButtonBuilder().setCustomId('ci_done').setLabel('Finish Check-In').setStyle(ButtonStyle.Danger),
      );
      rows.push(navRow);

      return rows;
    }

    const msg = await interaction.editReply({ embeds: [buildEmbed(page)], components: buildRows(page) });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 600_000,
      filter: i => i.user.id === interaction.user.id,
    });

    collector.on('collect', async (btn) => {
      try {
        const id = btn.customId;

        if (id === 'ci_prev') {
          page = Math.max(0, page - 1);
          return await btn.update({ embeds: [buildEmbed(page)], components: buildRows(page) });
        }
        if (id === 'ci_next') {
          page = Math.min(totalPages - 1, page + 1);
          return await btn.update({ embeds: [buildEmbed(page)], components: buildRows(page) });
        }

        if (id === 'ci_done') {
          collector.stop('done');
          return await btn.update({
            embeds: [buildEmbed(page).setTitle(`✅ Check-In Session Ended — Flight ${flightNumber}`).setColor(0x00B050)],
            components: [],
          });
        }

        if (id.startsWith('ci_check_')) {
          const bookingId = id.replace('ci_check_', '');
          const booking = sorted.find(b => b.id === bookingId);
          if (!booking) {
            return await btn.reply({ content: '❌ Booking not found.', ephemeral: true });
          }
          if (checkedIn.has(bookingId)) {
            return await btn.update({ embeds: [buildEmbed(page)], components: buildRows(page) });
          }

          // ── Acknowledge IMMEDIATELY before any slow operations ──────────────
          // Discord requires a response within 3 seconds. cancelBooking() and
          // the DM send below can both take longer than that, so we defer
          // first and use editReply() afterward instead of update().
          await btn.deferUpdate();

          // Mark checked in, remove booking, notify passenger via DM
          checkedIn.add(bookingId);
          await cancelBooking(bookingId);

          // Notify passenger via DM
          try {
            const passengerUser = await interaction.client.users.fetch(booking.discord_id).catch(() => null);
            if (passengerUser) {
              const dmEmbed = new EmbedBuilder()
                .setColor(0x00B050)
                .setTitle('✅ You\'ve Been Checked In!')
                .setThumbnail(LOGO)
                .setDescription(`You have been successfully checked in for your flight.`)
                .addFields(
                  { name: '✈️ Flight', value: flightNumber, inline: true },
                  { name: '💺 Seat', value: booking.seat, inline: true },
                  { name: '🗺️ Route', value: `${flight.origin} ✈️ ${flight.destination}`, inline: true },
                  { name: '🛂 Checked In By', value: interaction.user.username, inline: false },
                )
                .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao • Have a great flight!' })
                .setTimestamp();

              await passengerUser.send({ embeds: [dmEmbed] }).catch(() => {
                console.log(`Could not DM ${booking.username} — DMs likely closed.`);
              });
            }
          } catch (err) {
            console.error('Check-in DM failed:', err.message);
          }

          return await interaction.editReply({ embeds: [buildEmbed(page)], components: buildRows(page) });
        }
      } catch (err) {
        console.error('Check-in collector error:', err.message);
      }
    });

    collector.on('end', (_, reason) => {
      if (reason !== 'done') {
        interaction.editReply({ components: [] }).catch(() => {});
      }
    });
  },
};
