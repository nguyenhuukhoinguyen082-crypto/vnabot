const {
  SlashCommandBuilder, MessageFlags,
  ContainerBuilder, SectionBuilder,
  TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  ActionRowBuilder, StringSelectMenuBuilder,
  ButtonBuilder, ButtonStyle, ComponentType,
} = require('discord.js');
const {
  getFlight, getBookings, getUserBooking, createBooking, cancelBooking,
  getFlightClasses,
} = require('../firebase');
const { detectConfig, buildSeatMap, getPageCount, getRowOptions } = require('./seatmap');
const { awardMiles, deductMiles, updateCareerProgress } = require('./ffhelper');
const { LOGO, FOOTER, COLORS, CLASS_CONFIG } = require('../config');
const { isUBEnabled, getUBBalance, deductUB } = require('../services/unbelievaboat');

const pendingSeats = new Map();

function getClassMeta(seatClass) {
  const map = {
    economy:         { emoji: '■', label: 'Economy',       color: COLORS.primary },
    premium_economy: { emoji: '🔵', label: 'Premium Economy', color: 0x3498DB },
    business:        { emoji: '★', label: 'Business',      color: COLORS.warning },
  };
  return map[seatClass] || map.economy;
}

// ─── Component builder ─────────────────────────────────────────────────────────
function buildMapContainer(flight, config, takenSeats, seatClass, page, totalPages, warning) {
  const taken = takenSeats.length;
  const total = config.cols.length * config.totalRows
    - (config.gapRows?.length || 0) * config.cols.length;
  const available = total - taken;
  const cls = getClassMeta(seatClass);

  const container = new ContainerBuilder()
    .setAccentColor(cls.color)
    .addSectionComponents(section =>
      section
        .addTextDisplayComponents(td => td.setContent(`# Seat Map - Flight ${flight.flight_number}`))
        .setThumbnailAccessory(thumb => thumb.setURL(LOGO))
    )
    .addTextDisplayComponents(td => td.setContent(
      `**Route:** ${flight.origin || 'N/A'} → ${flight.destination || 'N/A'}\n` +
      `**Aircraft:** ${config.name}\n` +
      `**Class:** ${cls.emoji} ${cls.label}\n` +
      `**Rows shown:** ${page * 10 + 1}–${Math.min((page + 1) * 10, config.totalRows)} of ${config.totalRows} (Page ${page + 1}/${totalPages})`
    ))
    .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));

  if (warning) {
    container.addTextDisplayComponents(td => td.setContent(warning));
  }

  container
    .addTextDisplayComponents(td => td.setContent(buildSeatMap(config, takenSeats, null, page)))
    .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(td => td.setContent(`> **Available** \`${available}\` **Taken** \`${taken}\``))
    .addTextDisplayComponents(td => td.setContent(`> **Instructions**\n> **Step 1:** Select a row from the dropdown\n> **Step 2:** Click your seat column button`))
    .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

  return [container];
}

// ─── Component builders ───────────────────────────────────────────────────────
function buildRowSelect(config, page, takenSeats) {
  const options = getRowOptions(config, page, takenSeats);
  if (!options.length) return null;
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('bk_row')
      .setPlaceholder('Pick a row...')
      .addOptions(options.slice(0, 25))
  );
}

function buildNavButtons(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('bk_prev')
      .setLabel('< Previous rows')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('bk_next')
      .setLabel('Next rows >')
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
        .setDescription('Book a seat - interactive seat map!')
        .addStringOption(opt =>
          opt.setName('flightnumber').setDescription('Flight number (e.g. VJ100)').setRequired(true))
        .addStringOption(opt =>
          opt.setName('class').setDescription('Travel class').setRequired(true)
            .addChoices(
              { name: 'Economy', value: 'economy' },
              { name: 'Premium Economy', value: 'premium_economy' },
              { name: 'Business', value: 'business' },
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

    // /book cancel
    if (sub === 'cancel') {
      await interaction.deferReply({ ephemeral: true });

      const flightNumber = interaction.options.getString('flightnumber').toUpperCase();
      const confirm = interaction.options.getBoolean('confirm');

      if (!confirm) {
        return interaction.editReply({ content: '> Set `confirm` to `true` to cancel.' });
      }

      const flight = await getFlight(flightNumber);
      if (!flight) return interaction.editReply({ content: `> Flight **${flightNumber}** not found.` });

      const booking = await getUserBooking(interaction.user.id, flight.id);
      if (!booking) return interaction.editReply({ content: `> You have no booking on **${flightNumber}**.` });

      await cancelBooking(booking.id);

      let milesResult = null;
      try {
        milesResult = await deductMiles(interaction.guild, interaction.user.id, booking.seat_class);
        await updateCareerProgress(interaction.guild, interaction.user.id, null, -1);
      } catch (err) {
        console.error('Miles/career deduction failed:', err.message);
      }

      const cancelContainer = new ContainerBuilder()
        .setAccentColor(COLORS.danger)
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(td => td.setContent('# Booking Cancelled'))
            .setThumbnailAccessory(thumb => thumb.setURL(LOGO))
        )
        .addTextDisplayComponents(td => td.setContent(
          `> **Flight:** \`${flightNumber}\` **Seat:** \`${booking.seat || 'N/A'}\` **Code:** \`${booking.booking_code || 'N/A'}\``
        ));

      if (milesResult) {
        cancelContainer.addTextDisplayComponents(td => td.setContent(
          `> **LotusMiles Lost:** -${milesResult.deducted.toLocaleString()} mi${milesResult.tierChanged ? `\n> Tier dropped: ${milesResult.oldTier.name} > ${milesResult.newTier.name}` : ''}`
        ));
      }

      cancelContainer.addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

      return interaction.editReply({
        components: [cancelContainer],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // /book flight -- Interactive seat map
    if (sub === 'flight') {
      await interaction.deferReply({ ephemeral: true });

      const flightNumber = interaction.options.getString('flightnumber').toUpperCase();
      const seatClass = interaction.options.getString('class');

      const flight = await getFlight(flightNumber);
      if (!flight) return interaction.editReply({ content: `> Flight **${flightNumber}** not found. Use \`/flights\` to see available flights.` });
      if (!flight.bookings_open) return interaction.editReply({ content: `> Bookings for **${flightNumber}** are closed.` });
      if (flight.status === 'cancelled' || flight.status === 'ended') return interaction.editReply({ content: `> Flight **${flightNumber}** is ${flight.status}.` });
      if (seatClass === 'business' && !flight.has_business) return interaction.editReply({ content: `> Flight **${flightNumber}** has no Business Class.` });

      const existing = await getUserBooking(interaction.user.id, flight.id);
      if (existing) {
        return interaction.editReply({
          components: [
            new ContainerBuilder()
              .setAccentColor(COLORS.primary)
              .addSectionComponents(section =>
                section
                  .addTextDisplayComponents(td => td.setContent('# Already Booked'))
                  .setThumbnailAccessory(thumb => thumb.setURL(LOGO))
              )
              .addTextDisplayComponents(td => td.setContent(
                `You already have booking **${existing.booking_code}** on **${flightNumber}** (Seat **${existing.seat}**).\nUse \`/book cancel ${flightNumber} true\` to cancel first.`
              ))
              .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`)),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      // -- Payment processing --
      let paidAmount = 0;
      let wasFree = false;

      const classes = await getFlightClasses(flight.id);
      const classCfg = classes?.[seatClass] || CLASS_CONFIG[seatClass];
      const cost = classCfg?.cost || 0;

      if (cost > 0) {
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        const hasRole = member && classCfg?.role_id && member.roles.cache.has(classCfg.role_id);

        if (hasRole) {
          wasFree = true;
        } else {
          if (!isUBEnabled()) {
            return interaction.editReply({ content: '> Economy system is handled by Unbelievaboat. Make sure the bot is configured.' });
          }
          try {
            const balance = await getUBBalance(interaction.guildId, interaction.user.id);
            if (balance.cash >= cost) {
              await deductUB(interaction.guildId, interaction.user.id, cost, `Flight ${flightNumber} ${getClassMeta(seatClass).label}`);
              paidAmount = cost;
            } else {
              return interaction.editReply({ content: `> Insufficient funds via Unbelievaboat. **${getClassMeta(seatClass).label}** costs **${cost.toLocaleString()} VND**.` });
            }
          } catch (err) {
            console.error('Payment error:', err.message);
            return interaction.editReply({ content: `> Payment failed: ${err.message}` });
          }
        }
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
        components: [
          ...buildMapContainer(flight, config, takenSeats, seatClass, page, totalPages),
          ...initialComponents,
        ],
        flags: MessageFlags.IsComponentsV2,
      });

      // -- Collector --
      const collector = msg.createMessageComponentCollector({
        filter: i => {
          if (i.user.id !== interaction.user.id) {
            i.reply({
              components: [new TextDisplayBuilder().setContent('> This seat map is not for you!')],
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            }).catch(() => {});
            return false;
          }
          return true;
        },
        time: 300_000,
      });

      collector.on('collect', async (i) => {
        const id = i.customId;

        try {
          if (id === 'bk_cancel') {
            collector.stop('cancelled');
            return await i.update({
              components: [new TextDisplayBuilder().setContent('> Booking cancelled.')],
              flags: MessageFlags.IsComponentsV2,
            });
          }

          if (id === 'bk_prev') {
            page = Math.max(0, page - 1);
            selectedRow = null;
            return await i.update({
              components: [
                ...buildMapContainer(flight, config, takenSeats, seatClass, page, totalPages),
                buildRowSelect(config, page, takenSeats),
                buildNavButtons(page, totalPages),
              ].filter(Boolean),
              flags: MessageFlags.IsComponentsV2,
            });
          }

          if (id === 'bk_next') {
            page = Math.min(totalPages - 1, page + 1);
            selectedRow = null;
            return await i.update({
              components: [
                ...buildMapContainer(flight, config, takenSeats, seatClass, page, totalPages),
                buildRowSelect(config, page, takenSeats),
                buildNavButtons(page, totalPages),
              ].filter(Boolean),
              flags: MessageFlags.IsComponentsV2,
            });
          }

          if (id === 'bk_row') {
            selectedRow = parseInt(i.values[0]);

            const isBizRow = config.businessRows.includes(selectedRow);
            if (seatClass === 'business' && !isBizRow) {
              const warning = `> Row **${selectedRow}** is Economy. Pick a Business row (${config.businessRows.join(', ')}).`;
              return await i.update({
                components: [
                  ...buildMapContainer(flight, config, takenSeats, seatClass, page, totalPages, warning),
                  buildRowSelect(config, page, takenSeats),
                  buildNavButtons(page, totalPages),
                ].filter(Boolean),
                flags: MessageFlags.IsComponentsV2,
              });
            }
            if (seatClass === 'economy' && isBizRow) {
              const warning = `> Row **${selectedRow}** is Business Class. Pick an Economy row.`;
              return await i.update({
                components: [
                  ...buildMapContainer(flight, config, takenSeats, seatClass, page, totalPages, warning),
                  buildRowSelect(config, page, takenSeats),
                  buildNavButtons(page, totalPages),
                ].filter(Boolean),
                flags: MessageFlags.IsComponentsV2,
              });
            }

            const colBtns = buildColButtons(config, selectedRow, takenSeats);
            const backRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('bk_back').setLabel('Back to rows').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('bk_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
            );

            const comps = [buildRowSelect(config, page, takenSeats), ...colBtns, backRow].filter(Boolean).slice(0, 5);
            const mapWithHighlight = buildSeatMap(config, takenSeats, null, page);

            const rowContainer = new ContainerBuilder()
              .setAccentColor(seatClass === 'business' ? COLORS.warning : COLORS.primary)
              .addSectionComponents(section =>
                section
                  .addTextDisplayComponents(td => td.setContent(`# Pick Your Seat - Row ${selectedRow}`))
                  .setThumbnailAccessory(thumb => thumb.setURL(LOGO))
              )
              .addTextDisplayComponents(td => td.setContent(
                `**Flight:** ${flight.flight_number} | **Route:** ${flight.origin} → ${flight.destination}\n` +
                `**Row selected:** ${selectedRow}${config.businessRows.includes(selectedRow) ? ' (Business)' : ' (Economy)'}`
              ))
              .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
              .addTextDisplayComponents(td => td.setContent(mapWithHighlight))
              .addTextDisplayComponents(td => td.setContent('> Now click your seat column below:'))
              .addTextDisplayComponents(td => td.setContent('-# Green = available - Red = taken - Vietnam Airlines Group | PTFS'));

            return await i.update({
              components: [rowContainer, ...comps].filter(Boolean),
              flags: MessageFlags.IsComponentsV2,
            });
          }

          if (id === 'bk_back') {
            selectedRow = null;
            return await i.update({
              components: [
                ...buildMapContainer(flight, config, takenSeats, seatClass, page, totalPages),
                buildRowSelect(config, page, takenSeats),
                buildNavButtons(page, totalPages),
              ].filter(Boolean),
              flags: MessageFlags.IsComponentsV2,
            });
          }

          if (id.startsWith('bk_seat_') && selectedRow) {
            const col = id.replace('bk_seat_', '');
            const seatId = `${selectedRow}${col}`;

            if (takenSeats.includes(seatId.toUpperCase())) {
              return await i.reply({
                components: [new TextDisplayBuilder().setContent(`> Seat **${seatId}** is taken! Pick another.`)],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
              });
            }

            const clsMeta = getClassMeta(seatClass);
            const timeDisplay = flight.timestamp
              ? `<t:${Math.floor(flight.timestamp / 1000)}:F>`
              : flight.time || 'TBA';

            const confirmContainer = new ContainerBuilder()
              .setAccentColor(COLORS.success)
              .addTextDisplayComponents(td => td.setContent('# Confirm Your Booking'))
              .addTextDisplayComponents(td => td.setContent(
                `You selected **Seat ${seatId}** on flight **${flightNumber}**.`
              ))
              .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
              .addTextDisplayComponents(td => td.setContent(buildSeatMap(config, takenSeats, seatId, page)))
              .addTextDisplayComponents(td => td.setContent(
                `> \`==\` = Your selected seat\n> Click **Confirm** to finalize your booking.`
              ))
              .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
              .addTextDisplayComponents(td => td.setContent(
                `> **Flight:** \`${flightNumber}\`\n` +
                `> **Route:** ${flight.origin} → ${flight.destination}\n` +
                `> **Time:** \`${timeDisplay}\`\n` +
                `> **Aircraft:** \`${config.name}\`\n` +
                `> **Gate:** \`${flight.gate || 'TBA'}\`\n` +
                `> **Seat:** \`${seatId}\` (${clsMeta.emoji} ${clsMeta.label})`
              ))
              .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

            const confirmRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('bk_confirm').setLabel('Confirm Booking').setStyle(ButtonStyle.Success),
              new ButtonBuilder().setCustomId('bk_back').setLabel('Back').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('bk_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
            );

            pendingSeats.set(interaction.user.id, { seatId, paidAmount, wasFree, seatClass });

            return await i.update({
              components: [confirmContainer, confirmRow],
              flags: MessageFlags.IsComponentsV2,
            });
          }

          if (id === 'bk_confirm') {
            const pending = pendingSeats.get(interaction.user.id);
            if (!pending || !pending.seatId) {
              return await i.update({
                components: [new TextDisplayBuilder().setContent('> Seat selection lost. Please restart `/book flight`.')],
                flags: MessageFlags.IsComponentsV2,
              });
            }

            const { seatId, paidAmount: pay, wasFree: free, seatClass: cls } = pending;

            await i.deferUpdate();

            const freshBookings = await getBookings(flight.id);
            const freshTaken = freshBookings.map(b => b.seat?.toUpperCase()).filter(Boolean);
            if (freshTaken.includes(seatId.toUpperCase())) {
              return await i.editReply({
                components: [
                  new ContainerBuilder()
                    .setAccentColor(COLORS.danger)
                    .addSectionComponents(section =>
                      section
                        .addTextDisplayComponents(td => td.setContent('# Seat Just Taken!'))
                        .setThumbnailAccessory(thumb => thumb.setURL(LOGO))
                    )
                    .addTextDisplayComponents(td => td.setContent(`Someone just booked seat **${seatId}**! Please go back and pick another.`)),
                  buildRowSelect(config, page, takenSeats),
                  buildNavButtons(page, totalPages),
                ].filter(Boolean),
                flags: MessageFlags.IsComponentsV2,
              });
            }

            const { code } = await createBooking({
              flight_id: flight.id,
              flight_number: flightNumber,
              discord_id: interaction.user.id,
              username: interaction.user.username,
              display_name: interaction.user.displayName || interaction.user.username,
              seat_class: cls,
              seat: seatId,
              origin: flight.origin,
              destination: flight.destination,
              time: flight.time,
              timestamp: flight.timestamp,
              aircraft: flight.aircraft,
              gate: flight.gate,
              amount_paid: pay || 0,
              payment_method: free ? 'role_perk' : 'unbelievaboat',
            });

            pendingSeats.delete(interaction.user.id);

            let milesResult = null;
            let careerResult = null;
            try {
              milesResult = await awardMiles(interaction.guild, interaction.user.id, cls);
              careerResult = await updateCareerProgress(interaction.guild, interaction.user.id, interaction.member?.joinedTimestamp, 1);
            } catch (err) {
              console.error('Miles/career award failed:', err.message);
            }

            const clsMeta = getClassMeta(cls);
            const timeDisplay = flight.timestamp
              ? `<t:${Math.floor(flight.timestamp / 1000)}:F>`
              : flight.time || 'TBA';

            const successContainer = new ContainerBuilder()
              .setAccentColor(COLORS.success)
              .addSectionComponents(section =>
                section
                  .addTextDisplayComponents(td => td.setContent('# Booking Confirmed!'))
                  .setThumbnailAccessory(thumb => thumb.setURL(LOGO))
              )
              .addTextDisplayComponents(td => td.setContent(
                `Welcome aboard, **${interaction.user.displayName || interaction.user.username}**! Your seat is reserved.`
              ))
              .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
              .addTextDisplayComponents(td => td.setContent(
                `> **Booking Code:** \`${code}\`\n` +
                `> **Flight:** \`${flightNumber}\`\n` +
                `> **Route:** ${flight.origin} → ${flight.destination}\n` +
                `> **Time:** \`${timeDisplay}\`\n` +
                `> **Aircraft:** \`${config.name}\`\n` +
                `> **Gate:** \`${flight.gate || 'TBA'}\`\n` +
                `> **Seat:** \`${seatId}\` (${clsMeta.emoji} ${clsMeta.label})\n` +
                `> **Amount Paid:** \`${free ? '0 VND (Role Perk)' : `${(pay || 0).toLocaleString()} VND`}\``
              ))
              .addTextDisplayComponents(td => td.setContent(
                free
                  ? '> Free booking - class role perk applied!\n> Keep your booking code safe!'
                  : '> Keep your booking code safe!\n> Use \`/book cancel\` to cancel (this will remove earned miles).'
              ));

            if (milesResult) {
              successContainer.addTextDisplayComponents(td => td.setContent(
                `> **LotusMiles Earned:** +${milesResult.earned.toLocaleString()} mi${milesResult.tierChanged ? `\n> Tier upgraded: ${milesResult.oldTier.name} > ${milesResult.newTier.name}!` : ''}`
              ));
            }
            if (careerResult?.rankChanged) {
              successContainer.addTextDisplayComponents(td => td.setContent(
                `> **Career Rank Up!** ${careerResult.oldRank.name} > ${careerResult.newRank.name}`
              ));
            }

            successContainer.addTextDisplayComponents(td => td.setContent(
              `-# ${free ? 'Role Perk Applied' : `Paid ${(pay || 0).toLocaleString()} VND - ${FOOTER}`}`
            ));

            collector.stop('booked');
            return await i.editReply({
              components: [successContainer],
              flags: MessageFlags.IsComponentsV2,
            });
          }

          if (!i.replied && !i.deferred) {
            await i.deferUpdate().catch(() => {});
          }

        } catch (err) {
          console.error('Seat map error:', err);
          if (!i.replied && !i.deferred) {
            await i.reply({
              components: [new TextDisplayBuilder().setContent('> Something went wrong. Please try again.')],
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            }).catch(() => {});
          }
        }
      });

      collector.on('end', (_, reason) => {
        if (reason === 'time') {
          interaction.editReply({
            components: [new TextDisplayBuilder().setContent('> Timed out after 5 minutes. Run `/book flight` again.')],
            flags: MessageFlags.IsComponentsV2,
          }).catch(() => {});
        }
      });
    }
  },
};
