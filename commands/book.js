const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, StringSelectMenuBuilder,
  ButtonBuilder, ButtonStyle, ComponentType,
} = require('discord.js');
const {
  getFlight, getBookings, getUserBooking, createBooking, cancelBooking,
} = require('../firebase');
const { detectConfig, buildSeatMap, getPageCount, getRowOptions } = require('./seatmap');
const { awardMiles, deductMiles, updateCareerProgress } = require('./ffhelper');

const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

// ─── Embed builder ────────────────────────────────────────────────────────────
function buildMapEmbed(flight, config, takenSeats, seatClass, page, totalPages) {
  const taken = takenSeats.length;
  const total = config.cols.length * config.totalRows
    - (config.gapRows?.length || 0) * config.cols.length;
  const available = total - taken;

  return new EmbedBuilder()
    .setColor(seatClass === 'business' ? 0x1E90FF : seatClass === 'premium_economy' ? 0xFF8C00 : 0x006785)
    .setTitle(`🗺️ Seat Map — Flight ${flight.flight_number}`)
    .setThumbnail(LOGO)
    .setDescription([
      `**Route:** ${flight.origin || 'N/A'} ✈️ ${flight.destination || 'N/A'}`,
      `**Aircraft:** ${config.name}`,
      `**Class:** ${seatClass === 'business' ? '💼 Business Class' : '💺 Economy Class'}`,
      `**Rows shown:** ${page * 10 + 1}–${Math.min((page + 1) * 10, config.totalRows)} of ${config.totalRows} (Page ${page + 1}/${totalPages})`,
      '',
      buildSeatMap(config, takenSeats, null, page),
    ].join('\n'))
    .addFields(
      { name: '🟩 Available', value: `${available}`, inline: true },
      { name: '🟥 Taken', value: `${taken}`, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: '📋 Instructions', value: '> **Step 1:** Select a row from the dropdown\n> **Step 2:** Click your seat column button', inline: false },
    )
    .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
    .setTimestamp();
}

// ─── Component builders ───────────────────────────────────────────────────────
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
    new ButtonBuilder()
      .setCustomId('bk_prev')
      .setLabel('◀ Previous rows')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('bk_next')
      .setLabel('Next rows ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === totalPages - 1),
    new ButtonBuilder()
      .setCustomId('bk_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger),
  );
}

function buildColButtons(config, row, takenSeats) {
  const takenSet = new Set(takenSeats.map(s => s.toUpperCase()));
  const cols = config.cols;
  const actionRows = [];

  // Up to 4 cols per ActionRow
  for (let i = 0; i < cols.length; i += 4) {
    const chunk = cols.slice(i, i + 4);
    actionRows.push(
      new ActionRowBuilder().addComponents(
        chunk.map(col => {
          const seatId = `${row}${col}`;
          const taken = takenSet.has(seatId);
          return new ButtonBuilder()
            .setCustomId(`bk_seat_${col}`)
            .setLabel(`${row}${col}`)
            .setStyle(taken ? ButtonStyle.Danger : ButtonStyle.Success)
            .setDisabled(taken)
            .setEmoji(taken ? '🟥' : '🟩');
        })
      )
    );
  }
  return actionRows;
}

// ─── Main command ─────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('book')
    .setDescription('Book or cancel a Vietnam Airlines Group | PTFS flight')
    .addSubcommand(sub =>
      sub.setName('flight')
        .setDescription('Book a seat — interactive seat map!')
        .addStringOption(opt =>
          opt.setName('flightnumber').setDescription('Flight number (e.g. VJ100)').setRequired(true))
        .addStringOption(opt =>
          opt.setName('class').setDescription('Travel class').setRequired(true)
            .addChoices(
              { name: '💺 Economy', value: 'economy' },
              { name: '💼 Business', value: 'business' },
            )))
    .addSubcommand(sub =>
      sub.setName('cancel')
        .setDescription('Cancel your booking')
        .addStringOption(opt =>
          opt.setName('flightnumber').setDescription('Flight number (e.g. VJ100)').setRequired(true))
        .addBooleanOption(opt =>
          opt.setName('confirm').setDescription('Confirm cancellation').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ══════════════════════════════════════════════════════════════════════════
    // /book cancel
    // ══════════════════════════════════════════════════════════════════════════
    if (sub === 'cancel') {
      await interaction.deferReply({ ephemeral: true });

      const flightNumber = interaction.options.getString('flightnumber').toUpperCase();
      const confirm = interaction.options.getBoolean('confirm');

      if (!confirm) {
        return interaction.editReply({ content: '⚠️ Set `confirm` to `true` to cancel.' });
      }

      const flight = await getFlight(flightNumber);
      if (!flight) return interaction.editReply({ content: `❌ Flight **${flightNumber}** not found.` });

      const booking = await getUserBooking(interaction.user.id, flight.id);
      if (!booking) return interaction.editReply({ content: `❌ You have no booking on **${flightNumber}**.` });

      await cancelBooking(booking.id);

      // ── Deduct LotusMiles miles and career progress for cancellation ──────
      let milesResult = null;
      try {
        milesResult = await deductMiles(interaction.guild, interaction.user.id, booking.seat_class);
        await updateCareerProgress(interaction.guild, interaction.user.id, null, -1);
      } catch (err) {
        console.error('Miles/career deduction failed:', err.message);
      }

      const cancelEmbed = new EmbedBuilder()
        .setColor(0x006785)
        .setTitle('✅ Booking Cancelled')
        .setThumbnail(LOGO)
        .addFields(
          { name: '✈️ Flight', value: flightNumber, inline: true },
          { name: '💺 Seat', value: booking.seat || 'N/A', inline: true },
          { name: '🎫 Code', value: booking.booking_code || 'N/A', inline: true },
        )
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
        .setTimestamp();

      if (milesResult) {
        cancelEmbed.addFields({
          name: '✈️ LotusMiles Lost',
          value: `> -${milesResult.deducted.toLocaleString()} mi${milesResult.tierChanged ? `\n> ⚠️ Tier dropped: ${milesResult.oldTier.name} → ${milesResult.newTier.name}` : ''}`,
          inline: false,
        });
      }

      return interaction.editReply({ embeds: [cancelEmbed] });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // /book flight — Interactive seat map
    // ══════════════════════════════════════════════════════════════════════════
    if (sub === 'flight') {
      await interaction.deferReply({ ephemeral: true });

      const flightNumber = interaction.options.getString('flightnumber').toUpperCase();
      const seatClass = interaction.options.getString('class');

      // Validate flight
      const flight = await getFlight(flightNumber);
      if (!flight) return interaction.editReply({ content: `❌ Flight **${flightNumber}** not found. Use \`/flights\` to see available flights.` });
      if (!flight.bookings_open) return interaction.editReply({ content: `❌ Bookings for **${flightNumber}** are closed.` });
      if (flight.status === 'cancelled' || flight.status === 'ended') return interaction.editReply({ content: `❌ Flight **${flightNumber}** is ${flight.status}.` });
      if (seatClass === 'business' && !flight.has_business) return interaction.editReply({ content: `❌ Flight **${flightNumber}** has no Business Class.` });

      // Check existing booking
      const existing = await getUserBooking(interaction.user.id, flight.id);
      if (existing) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0x007B8A)
            .setTitle('⚠️ Already Booked')
            .setThumbnail(LOGO)
            .setDescription(`You already have booking **${existing.booking_code}** on **${flightNumber}** (Seat **${existing.seat}**).\nUse \`/book cancel ${flightNumber} true\` to cancel first.`)
            .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })],
        });
      }

      // Get taken seats & config
      const allBookings = await getBookings(flight.id);
      const takenSeats = allBookings.map(b => b.seat?.toUpperCase()).filter(Boolean);
      const config = detectConfig(flight.aircraft);
      const totalPages = getPageCount(config);

      // State variables
      let page = 0;
      let selectedRow = null;

      // Initial render
      const initialComponents = [
        buildRowSelect(config, page, takenSeats),
        buildNavButtons(page, totalPages),
      ].filter(Boolean);

      const msg = await interaction.editReply({
        embeds: [buildMapEmbed(flight, config, takenSeats, seatClass, page, totalPages)],
        components: initialComponents,
      });

      // ── Collector — ONLY listens to this user, on this message ──────────────
      const collector = msg.createMessageComponentCollector({
        filter: i => {
          // Always acknowledge wrong-user interactions to prevent "interaction failed"
          if (i.user.id !== interaction.user.id) {
            i.reply({ content: '❌ This seat map is not for you!', ephemeral: true }).catch(() => {});
            return false;
          }
          return true;
        },
        time: 300_000,
      });

      collector.on('collect', async (i) => {
        const id = i.customId;

        try {
          // ── Cancel ──────────────────────────────────────────────────────
          if (id === 'bk_cancel') {
            collector.stop('cancelled');
            return await i.update({ content: '❌ Booking cancelled.', embeds: [], components: [] });
          }

          // ── Page prev ───────────────────────────────────────────────────
          if (id === 'bk_prev') {
            page = Math.max(0, page - 1);
            selectedRow = null;
            return await i.update({
              embeds: [buildMapEmbed(flight, config, takenSeats, seatClass, page, totalPages)],
              components: [buildRowSelect(config, page, takenSeats), buildNavButtons(page, totalPages)].filter(Boolean),
            });
          }

          // ── Page next ───────────────────────────────────────────────────
          if (id === 'bk_next') {
            page = Math.min(totalPages - 1, page + 1);
            selectedRow = null;
            return await i.update({
              embeds: [buildMapEmbed(flight, config, takenSeats, seatClass, page, totalPages)],
              components: [buildRowSelect(config, page, takenSeats), buildNavButtons(page, totalPages)].filter(Boolean),
            });
          }

          // ── Row selected ─────────────────────────────────────────────────
          if (id === 'bk_row') {
            selectedRow = parseInt(i.values[0]);

            const isBizRow = config.businessRows.includes(selectedRow);
            if (seatClass === 'business' && !isBizRow) {
              return await i.update({
                embeds: [buildMapEmbed(flight, config, takenSeats, seatClass, page, totalPages)
                  .setDescription(`⚠️ Row **${selectedRow}** is Economy. Pick a Business row (${config.businessRows.join(', ')}).\n\n` +
                    buildSeatMap(config, takenSeats, null, page))],
                components: [buildRowSelect(config, page, takenSeats), buildNavButtons(page, totalPages)].filter(Boolean),
              });
            }
            if (seatClass === 'economy' && isBizRow) {
              return await i.update({
                embeds: [buildMapEmbed(flight, config, takenSeats, seatClass, page, totalPages)
                  .setDescription(`⚠️ Row **${selectedRow}** is Business Class. Pick an Economy row.\n\n` +
                    buildSeatMap(config, takenSeats, null, page))],
                components: [buildRowSelect(config, page, takenSeats), buildNavButtons(page, totalPages)].filter(Boolean),
              });
            }

            // Show col buttons (max 5 ActionRows: 1 select + up to 2 col rows + 1 nav + 1 back)
            const colBtns = buildColButtons(config, selectedRow, takenSeats);
            const backRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('bk_back').setLabel('↩️ Back to rows').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('bk_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
            );

            const comps = [buildRowSelect(config, page, takenSeats), ...colBtns, backRow].filter(Boolean).slice(0, 5);

            const mapWithHighlight = buildSeatMap(config, takenSeats, null, page);
            return await i.update({
              embeds: [new EmbedBuilder()
                .setColor(seatClass === 'business' ? 0x1E90FF : seatClass === 'premium_economy' ? 0xFF8C00 : 0x006785)
                .setTitle(`🗺️ Pick Your Seat — Row ${selectedRow}`)
                .setThumbnail(LOGO)
                .setDescription([
                  `**Flight:** ${flight.flight_number} | **Route:** ${flight.origin} ✈️ ${flight.destination}`,
                  `**Row selected:** ${selectedRow}${config.businessRows.includes(selectedRow) ? ' 💼 Business' : ' 💺 Economy'}`,
                  '',
                  mapWithHighlight,
                  '',
                  '> ② Now click your seat column below:',
                ].join('\n'))
                .setFooter({ text: 'Green = available • Red = taken • Vietnam Airlines Group | PTFS' })
                .setTimestamp()],
              components: comps,
            });
          }

          // ── Back button ──────────────────────────────────────────────────
          if (id === 'bk_back') {
            selectedRow = null;
            return await i.update({
              embeds: [buildMapEmbed(flight, config, takenSeats, seatClass, page, totalPages)],
              components: [buildRowSelect(config, page, takenSeats), buildNavButtons(page, totalPages)].filter(Boolean),
            });
          }

          // ── Seat column selected ─────────────────────────────────────────
          if (id.startsWith('bk_seat_') && selectedRow) {
            const col = id.replace('bk_seat_', '');
            const seatId = `${selectedRow}${col}`;

            // Re-check taken
            if (takenSeats.includes(seatId.toUpperCase())) {
              return await i.reply({ content: `❌ Seat **${seatId}** is taken! Pick another.`, ephemeral: true });
            }

            const classLabel = seatClass === 'business' ? '💼 Business Class' : '💺 Economy Class';
            const timeDisplay = flight.timestamp
              ? `<t:${Math.floor(flight.timestamp / 1000)}:F>`
              : flight.time || 'TBA';

            const confirmEmbed = new EmbedBuilder()
              .setColor(0xDC9D1F)
              .setTitle('✅ Confirm Your Booking')
              .setThumbnail(LOGO)
              .setDescription([
                `You selected **Seat ${seatId}** on flight **${flightNumber}**.`,
                '',
                buildSeatMap(config, takenSeats, seatId, page),
                '',
                '> 🟨 = Your selected seat',
                '> Click **Confirm** to finalize your booking.',
              ].join('\n'))
              .addFields(
                { name: '✈️ Flight', value: flightNumber, inline: true },
                { name: '🗺️ Route', value: `${flight.origin} ✈️ ${flight.destination}`, inline: true },
                { name: '🕐 Time', value: timeDisplay, inline: true },
                { name: '🛩️ Aircraft', value: config.name, inline: true },
                { name: '🚪 Gate', value: flight.gate || 'TBA', inline: true },
                { name: '💺 Seat', value: `**${seatId}** (${classLabel})`, inline: true },
              )
              .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
              .setTimestamp();

            const confirmRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('bk_confirm').setLabel('Confirm Booking ✅').setStyle(ButtonStyle.Success),
              new ButtonBuilder().setCustomId('bk_back').setLabel('↩️ Back').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('bk_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
            );

            // Store seat choice on the interaction for confirm step
            i.client._pendingSeat = i.client._pendingSeat || {};
            i.client._pendingSeat[interaction.user.id] = seatId;

            return await i.update({ embeds: [confirmEmbed], components: [confirmRow] });
          }

          // ── Confirm booking ──────────────────────────────────────────────
          if (id === 'bk_confirm') {
            const seatId = i.client._pendingSeat?.[interaction.user.id];
            if (!seatId) {
              return await i.update({
                content: '❌ Seat selection lost. Please restart `/book flight`.',
                embeds: [], components: [],
              });
            }

            // ── Defer immediately before slow Firebase operations ────────────
            await i.deferUpdate();

            // Final race-condition check
            const freshBookings = await getBookings(flight.id);
            const freshTaken = freshBookings.map(b => b.seat?.toUpperCase()).filter(Boolean);
            if (freshTaken.includes(seatId.toUpperCase())) {
              return await interaction.editReply({
                embeds: [new EmbedBuilder()
                  .setColor(0xFF0000)
                  .setTitle('❌ Seat Just Taken!')
                  .setDescription(`Someone just booked seat **${seatId}**! Please go back and pick another.`)
                  .setThumbnail(LOGO)],
                components: [buildRowSelect(config, page, takenSeats), buildNavButtons(page, totalPages)].filter(Boolean),
              });
            }

            const { code } = await createBooking({
              flight_id: flight.id,
              flight_number: flightNumber,
              discord_id: interaction.user.id,
              username: interaction.user.username,
              display_name: interaction.user.displayName || interaction.user.username,
              seat_class: seatClass,
              seat: seatId,
              origin: flight.origin,
              destination: flight.destination,
              time: flight.time,
              timestamp: flight.timestamp,
              aircraft: flight.aircraft,
              gate: flight.gate,
            });

            // Cleanup pending seat
            if (i.client._pendingSeat) delete i.client._pendingSeat[interaction.user.id];

            // ── Award LotusMiles miles and career progress ──────────────────
            let milesResult = null;
            let careerResult = null;
            try {
              milesResult = await awardMiles(interaction.guild, interaction.user.id, seatClass);
              careerResult = await updateCareerProgress(interaction.guild, interaction.user.id, interaction.member?.joinedTimestamp, 1);
            } catch (err) {
              console.error('Miles/career award failed:', err.message);
            }

            const classLabel = seatClass === 'business' ? '💼 Business Class' : '💺 Economy Class';
            const timeDisplay = flight.timestamp
              ? `<t:${Math.floor(flight.timestamp / 1000)}:F>`
              : flight.time || 'TBA';

            const successEmbed = new EmbedBuilder()
              .setColor(0x006785)
              .setTitle('🎉 Booking Confirmed!')
              .setThumbnail(LOGO)
              .setDescription(`Welcome aboard, **${interaction.user.displayName || interaction.user.username}**! Your seat is reserved.`)
              .addFields(
                { name: '🎫 Booking Code', value: `\`\`\`${code}\`\`\``, inline: false },
                { name: '✈️ Flight', value: flightNumber, inline: true },
                { name: '🗺️ Route', value: `${flight.origin} ✈️ ${flight.destination}`, inline: true },
                { name: '🕐 Time', value: timeDisplay, inline: true },
                { name: '🛩️ Aircraft', value: config.name, inline: true },
                { name: '🚪 Gate', value: flight.gate || 'TBA', inline: true },
                { name: '💺 Seat', value: `**${seatId}** (${classLabel})`, inline: true },
                { name: '\u200b', value: '> 🔖 Keep your booking code safe!\n> ❌ Use `/book cancel` to cancel (this will remove earned miles).', inline: false },
              )
              .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
              .setTimestamp();

            if (milesResult) {
              successEmbed.addFields({
                name: '✈️ LotusMiles Earned',
                value: `> +${milesResult.earned.toLocaleString()} mi${milesResult.tierChanged ? `\n> 🎉 Tier upgraded: ${milesResult.oldTier.name} → ${milesResult.newTier.name}!` : ''}`,
                inline: false,
              });
            }
            if (careerResult?.rankChanged) {
              successEmbed.addFields({
                name: '🎖️ Career Rank Up!',
                value: `> ${careerResult.oldRank.name} → ${careerResult.newRank.name}`,
                inline: false,
              });
            }

            collector.stop('booked');
            return await interaction.editReply({ embeds: [successEmbed], components: [] });
          }

          // ── Fallthrough — acknowledge to prevent "interaction failed" ────
          if (!i.replied && !i.deferred) {
            await i.deferUpdate().catch(() => {});
          }

        } catch (err) {
          console.error('Seat map error:', err);
          // Always acknowledge to prevent "interaction failed"
          if (!i.replied && !i.deferred) {
            await i.reply({ content: '❌ Something went wrong. Please try again.', ephemeral: true }).catch(() => {});
          }
        }
      });

      collector.on('end', (_, reason) => {
        if (reason === 'time') {
          interaction.editReply({
            content: '⏱️ Timed out after 5 minutes. Run `/book flight` again.',
            embeds: [], components: [],
          }).catch(() => {});
        }
      });
    }
  },
};
