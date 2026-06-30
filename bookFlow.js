// bookFlow.js — Sends the full interactive seat map directly into a user's DM
// Place this file in your ROOT folder, same level as index.js
const {
  EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder,
  ButtonBuilder, ButtonStyle, AttachmentBuilder, ComponentType,
} = require('discord.js');
const {
  getFlight, getBookings, getUserBooking, createBooking,
} = require('./firebase');
const { detectConfig, getPageCount, getRowOptions } = require('./commands/seatmap');
const { generateSeatMapImage } = require('./seatMapImage');
const { awardMiles, updateCareerProgress } = require('./commands/ffhelper');

const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';
const VNA_NAVY = 0x006785;
const VNA_GOLD = 0xDC9D1F;

function buildMapEmbed(flight, config, takenSeats, seatClass, page, totalPages) {
  const classLabel = seatClass === 'business' ? '💼 Business Class'
    : seatClass === 'premium_economy' ? '🟧 Premium Economy'
    : '💺 Economy Class';

  return new EmbedBuilder()
    .setColor(VNA_NAVY)
    .setTitle(`🗺️ Seat Map — Flight ${flight.flight_number}`)
    .setThumbnail(LOGO)
    .setDescription([
      `**Route:** ${flight.origin || 'N/A'} ✈️ ${flight.destination || 'N/A'}`,
      `**Aircraft:** ${config.name}`,
      `**Class:** ${classLabel}`,
      `**Rows shown:** ${page * 10 + 1}–${Math.min((page + 1) * 10, config.totalRows)} of ${config.totalRows} (Page ${page + 1}/${totalPages})`,
      '',
      '📋 **Step 1:** Select a row from the dropdown',
      '📋 **Step 2:** Click your seat column button',
    ].join('\n'))
    .setImage('attachment://seatmap.png')
    .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
    .setTimestamp();
}

async function buildSeatMapAttachment(config, takenSeats, selectedSeat, page, flightNumber) {
  const imageBuffer = await generateSeatMapImage(config, takenSeats, selectedSeat, page, 10, flightNumber);
  return new AttachmentBuilder(imageBuffer, { name: 'seatmap.png' });
}

function buildRowSelect(config, page, takenSeats) {
  const options = getRowOptions(config, page, takenSeats);
  if (!options.length) return null;
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('bk_row')
      .setPlaceholder('① Pick a row...')
      .addOptions(options.slice(0, 25))
  );
}

function buildNavButtons(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bk_prev').setLabel('◀ Previous rows').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId('bk_next').setLabel('Next rows ▶').setStyle(ButtonStyle.Secondary).setDisabled(page === totalPages - 1),
    new ButtonBuilder().setCustomId('bk_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
  );
}

function buildColButtons(config, row, takenSeats, seatClass) {
  const takenSet = new Set(takenSeats.map(s => s.toUpperCase()));
  const isBiz = config.businessRows?.includes(row);
  const isPrem = config.premiumRows?.includes(row);
  const cols = isBiz ? (config.businessCols || config.cols)
    : isPrem ? (config.premiumCols || config.cols)
    : (config.economyCols || config.cols);

  const actionRows = [];
  for (let i = 0; i < cols.length; i += 4) {
    const chunk = cols.slice(i, i + 4);
    actionRows.push(
      new ActionRowBuilder().addComponents(
        chunk.map(col => {
          const seatId = `${row}${col}`;
          const taken = takenSet.has(seatId.toUpperCase());
          return new ButtonBuilder()
            .setCustomId(`bk_seat_${col}`)
            .setLabel(`${row}${col}`)
            .setStyle(taken ? ButtonStyle.Danger : ButtonStyle.Success)
            .setDisabled(taken);
        })
      )
    );
  }
  return actionRows;
}

/**
 * Sends the full interactive seat map booking flow directly into a DM channel.
 * @param {User} user - the Discord user to DM
 * @param {Guild} guild - the guild context (for role syncing, miles, etc.)
 * @param {string} flightNumber - flight number to book
 * @param {string} seatClass - 'economy' | 'premium_economy' | 'business'
 */
async function sendSeatMapDM(user, guild, flightNumber, seatClass = 'economy') {
  const flight = await getFlight(flightNumber);
  if (!flight) {
    return user.send({ content: `❌ Flight **${flightNumber}** not found.` }).catch(() => {});
  }
  if (!flight.bookings_open) {
    return user.send({ content: `❌ Bookings for **${flightNumber}** are closed.` }).catch(() => {});
  }
  if (seatClass === 'business' && !flight.has_business) {
    return user.send({ content: `❌ Flight **${flightNumber}** has no Business Class. Booking as Economy instead.` }).catch(() => {});
  }

  const existing = await getUserBooking(user.id, flight.id);
  if (existing) {
    return user.send({
      embeds: [new EmbedBuilder()
        .setColor(0xFF6600)
        .setTitle('⚠️ Already Booked')
        .setDescription(`You already have booking **${existing.booking_code}** on **${flightNumber}** (Seat **${existing.seat}**).\nUse \`/book cancel\` in the server to cancel first.`)
        .setThumbnail(LOGO)],
    }).catch(() => {});
  }

  const allBookings = await getBookings(flight.id);
  const takenSeats = allBookings.map(b => b.seat?.toUpperCase()).filter(Boolean);
  const config = detectConfig(flight.aircraft);
  const totalPages = getPageCount(config);

  let page = 0;
  let selectedRow = null;

  const initialComponents = [
    buildRowSelect(config, page, takenSeats),
    buildNavButtons(page, totalPages),
  ].filter(Boolean);

  const dmChannel = await user.createDM().catch(() => null);
  if (!dmChannel) return false;

  const msg = await dmChannel.send({
    embeds: [buildMapEmbed(flight, config, takenSeats, seatClass, page, totalPages)],
    components: initialComponents,
    files: [await buildSeatMapAttachment(config, takenSeats, null, page, flightNumber)],
  }).catch(() => null);

  if (!msg) return false;

  const collector = msg.createMessageComponentCollector({
    filter: i => i.user.id === user.id,
    time: 300_000,
  });

  collector.on('collect', async (i) => {
    try {
      const id = i.customId;

      if (id === 'bk_cancel') {
        collector.stop('cancelled');
        return await i.update({ content: '❌ Booking cancelled.', embeds: [], components: [], files: [] });
      }

      if (id === 'bk_prev' || id === 'bk_next') {
        page = id === 'bk_prev' ? Math.max(0, page - 1) : Math.min(totalPages - 1, page + 1);
        selectedRow = null;
        return await i.update({
          embeds: [buildMapEmbed(flight, config, takenSeats, seatClass, page, totalPages)],
          components: [buildRowSelect(config, page, takenSeats), buildNavButtons(page, totalPages)].filter(Boolean),
          files: [await buildSeatMapAttachment(config, takenSeats, null, page, flightNumber)],
        });
      }

      if (id === 'bk_row') {
        selectedRow = parseInt(i.values[0]);
        const colBtns = buildColButtons(config, selectedRow, takenSeats, seatClass);
        const backRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('bk_back').setLabel('↩️ Back to rows').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('bk_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
        );
        const comps = [buildRowSelect(config, page, takenSeats), ...colBtns, backRow].filter(Boolean).slice(0, 5);

        return await i.update({
          embeds: [buildMapEmbed(flight, config, takenSeats, seatClass, page, totalPages)
            .setDescription(`**Row ${selectedRow} selected.** Now click your seat column below:`)],
          components: comps,
          files: [await buildSeatMapAttachment(config, takenSeats, null, page, flightNumber)],
        });
      }

      if (id === 'bk_back') {
        selectedRow = null;
        return await i.update({
          embeds: [buildMapEmbed(flight, config, takenSeats, seatClass, page, totalPages)],
          components: [buildRowSelect(config, page, takenSeats), buildNavButtons(page, totalPages)].filter(Boolean),
          files: [await buildSeatMapAttachment(config, takenSeats, null, page, flightNumber)],
        });
      }

      if (id.startsWith('bk_seat_') && selectedRow) {
        const col = id.replace('bk_seat_', '');
        const seatId = `${selectedRow}${col}`;

        if (takenSeats.includes(seatId.toUpperCase())) {
          return await i.reply({ content: `❌ Seat **${seatId}** is taken! Pick another.`, ephemeral: true });
        }

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('bk_confirm').setLabel('Confirm Booking ✅').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('bk_back').setLabel('↩️ Back').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('bk_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
        );

        i.client._pendingSeat = i.client._pendingSeat || {};
        i.client._pendingSeat[user.id] = seatId;

        return await i.update({
          embeds: [new EmbedBuilder()
            .setColor(VNA_GOLD)
            .setTitle('✅ Confirm Your Booking')
            .setDescription(`You selected **Seat ${seatId}** on flight **${flightNumber}**.\nClick **Confirm** to finalize.`)
            .setImage('attachment://seatmap.png')
            .addFields(
              { name: '✈️ Flight', value: flightNumber, inline: true },
              { name: '🗺️ Route', value: `${flight.origin} ✈️ ${flight.destination}`, inline: true },
              { name: '💺 Seat', value: seatId, inline: true },
            )
            .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })],
          components: [confirmRow],
          files: [await buildSeatMapAttachment(config, takenSeats, seatId, page, flightNumber)],
        });
      }

      if (id === 'bk_confirm') {
        const seatId = i.client._pendingSeat?.[user.id];
        if (!seatId) {
          return await i.update({ content: '❌ Seat selection lost. Please restart by clicking Book Flight again.', embeds: [], components: [], files: [] });
        }

        await i.deferUpdate();

        const freshBookings = await getBookings(flight.id);
        const freshTaken = freshBookings.map(b => b.seat?.toUpperCase()).filter(Boolean);
        if (freshTaken.includes(seatId.toUpperCase())) {
          return await dmChannel.send({ content: `❌ Seat **${seatId}** was just taken by someone else! Please click Book Flight again to pick another.` });
        }

        const { code } = await createBooking({
          flight_id: flight.id,
          flight_number: flightNumber,
          discord_id: user.id,
          username: user.username,
          display_name: user.displayName || user.username,
          seat_class: seatClass,
          seat: seatId,
          origin: flight.origin,
          destination: flight.destination,
          time: flight.time,
          timestamp: flight.timestamp,
          aircraft: flight.aircraft,
          gate: flight.gate,
        });

        if (i.client._pendingSeat) delete i.client._pendingSeat[user.id];

        let milesResult = null, careerResult = null;
        try {
          milesResult = await awardMiles(guild, user.id, seatClass);
          careerResult = await updateCareerProgress(guild, user.id, null, 1);
        } catch (err) {
          console.error('Miles/career award failed:', err.message);
        }

        const successEmbed = new EmbedBuilder()
          .setColor(VNA_NAVY)
          .setTitle('🎉 Booking Confirmed!')
          .setThumbnail(LOGO)
          .setDescription(`Welcome aboard, **${user.displayName || user.username}**! Your seat is reserved.`)
          .addFields(
            { name: '🎫 Booking Code', value: `\`\`\`${code}\`\`\``, inline: false },
            { name: '✈️ Flight', value: flightNumber, inline: true },
            { name: '🗺️ Route', value: `${flight.origin} ✈️ ${flight.destination}`, inline: true },
            { name: '💺 Seat', value: seatId, inline: true },
          )
          .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
          .setTimestamp();

        if (milesResult) {
          successEmbed.addFields({ name: '✈️ LotusMiles Earned', value: `+${milesResult.earned.toLocaleString()} mi`, inline: false });
        }

        collector.stop('booked');
        return await dmChannel.send({ embeds: [successEmbed] });
      }
    } catch (err) {
      console.error('DM booking flow error:', err.message);
    }
  });

  collector.on('end', (_, reason) => {
    if (reason === 'time') {
      dmChannel.send({ content: '⏱️ Booking session timed out.' }).catch(() => {});
    }
  });

  return true;
}

module.exports = { sendSeatMapDM };
