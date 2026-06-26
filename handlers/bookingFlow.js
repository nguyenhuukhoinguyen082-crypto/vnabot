const {
  MessageFlags,
  ActionRowBuilder, ContainerBuilder, SectionBuilder,
  TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} = require('discord.js');
const { getFlight, getBookings, getFlightClasses, getUserBooking, createBooking, getFlights } = require('../firebase');
const { detectConfig, buildSeatMap, getPageCount, getRowOptions } = require('../commands/seatmap');
const { LOGO, FOOTER, COLORS, CLASS_CONFIG } = require('../config');
const { isUBEnabled, getUBBalance, deductUB } = require('../services/unbelievaboat');

const pendingBookings = new Map();

// -- Entry: "Book Now" button on announce message --
async function handleBookingButton(interaction, client) {
  const flightId = interaction.customId.replace('ann_book_', '');
  const flight = await resolveFlight(flightId, interaction);
  if (!flight) return;

  const existing = await getUserBooking(interaction.user.id, flight.id);
  if (existing) {
    return interaction.reply({
      components: [
        new ContainerBuilder()
          .setAccentColor(COLORS.warning)
          .addTextDisplayComponents(td => td.setContent(
            `## Already Booked\nYou have booking **${existing.booking_code}** on **${flight.flight_number}**.\nUse \`/book cancel ${flight.flight_number} true\` first.`
          ))
      ],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  }

  await showClassSelector(interaction, flight, client);
}

// -- Step 1: Class Selector (V2 Ephemeral) --
async function showClassSelector(interaction, flight, client) {
  const classes = await resolveFlightClasses(flight);
  const classOptions = buildClassOptions(classes);
  const selectId = `ann_cls:${flight.id}:${interaction.user.id}`;

  const classLines = Object.entries(classes).map(([key, cfg]) =>
    `\n${cfg.emoji || '•'} **${cfg.label}** - ${cfg.cost > 0 ? `${cfg.cost.toLocaleString()}₫` : 'FREE'}`
  ).join('');

  const msg = [
    new ContainerBuilder()
      .setAccentColor(COLORS.primary)
      .addTextDisplayComponents(td => td.setContent(
        `## ${flight.flight_number} - ${flight.origin} to ${flight.destination}\nSelect your travel class below.`
      ))
      .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(td => td.setContent(
        `### Class Options${classLines}\n-# Have the class role? You ride free!`
      ))
      .addActionRowComponents(row =>
        row.addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(selectId)
            .setPlaceholder('Choose your class...')
            .addOptions(...classOptions)
        )
      ),
  ];

  await interaction.reply({
    components: msg,
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

// -- Step 1b: Handle class selection --
async function handleClassSelect(interaction, client) {
  const [, flightId, userId] = interaction.customId.split(':');
  if (interaction.user.id !== userId) {
    return interaction.reply({
      components: [new TextDisplayBuilder().setContent('> This selection is not for you.')],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  }

  const selectedClass = interaction.values[0];
  const flight = await resolveFlight(flightId, interaction);
  if (!flight) return;

  const classes = await resolveFlightClasses(flight);
  const classCfg = classes[selectedClass];
  if (!classCfg) {
    return interaction.update({
      components: [new TextDisplayBuilder().setContent('> Invalid class selection.')],
      flags: MessageFlags.IsComponentsV2,
    });
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  const hasRole = member && classCfg.role_id && member.roles.cache.has(classCfg.role_id);

  if (hasRole) {
    return proceedToSeatMap(interaction, flight, selectedClass, classes, classCfg, 0, true, client);
  }

  const paymentResult = await processPayment(interaction, flight, selectedClass, classCfg, client);
  if (!paymentResult) return;

  return proceedToSeatMap(interaction, flight, selectedClass, classes, classCfg, classCfg.cost, false, client);
}

// -- Payment processing --
async function processPayment(interaction, flight, selectedClass, classCfg, client) {
  const cost = classCfg.cost;
  if (cost <= 0) return true;

  const label = classCfg.label || selectedClass;

  if (!isUBEnabled()) {
    await interaction.update({
      components: [
        new ContainerBuilder()
          .setAccentColor(COLORS.danger)
          .addTextDisplayComponents(td => td.setContent(
            `Economy system is handled by Unbelievaboat. Make sure the bot is configured.`
          ))
      ],
      flags: MessageFlags.IsComponentsV2,
    });
    return false;
  }

  try {
    const balance = await getUBBalance(interaction.guildId, interaction.user.id);
    if (balance.cash >= cost) {
      await deductUB(interaction.guildId, interaction.user.id, cost, `Flight ${flight.flight_number} ${label}`);
      return true;
    }

    await interaction.update({
      components: [
        new ContainerBuilder()
          .setAccentColor(COLORS.danger)
          .addTextDisplayComponents(td => td.setContent(
            `## Insufficient Funds via Unbelievaboat\n**${label}** costs **${cost.toLocaleString()} VND**.\nYour balance: **${balance.total.toLocaleString()} VND**`
          ))
      ],
      flags: MessageFlags.IsComponentsV2,
    });
    return false;

  } catch (err) {
    console.error('Payment error:', err.message);
    await interaction.update({
      components: [
        new ContainerBuilder()
          .setAccentColor(COLORS.danger)
          .addTextDisplayComponents(td => td.setContent(`## Payment Failed\n${err.message}`))
      ],
      flags: MessageFlags.IsComponentsV2,
    });
    return false;
  }
}

// -- Step 2: Proceed to Seat Map --
async function proceedToSeatMap(interaction, flight, seatClass, classes, classCfg, paidAmount, wasFree, client) {
  const classLabel = classCfg.label;

  const paymentLines = [
    `### Payment Summary`,
    `**Class:** ${classCfg.emoji || ''} ${classLabel}`,
  ];
  if (wasFree) {
    paymentLines.push(`**Cost:** 0₫ (Role Perk - you have the ${classLabel} role!)`);
  } else if (paidAmount > 0) {
    paymentLines.push(`**Paid:** ${paidAmount.toLocaleString()}₫`);
  } else {
    paymentLines.push(`**Cost:** 0₫`);
  }

  const paymentContainer = new ContainerBuilder()
    .setAccentColor(COLORS.success)
    .addTextDisplayComponents(td => td.setContent(paymentLines.join('\n')));

  await interaction.update({
    components: [
      paymentContainer,
      new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small),
      new TextDisplayBuilder().setContent('Loading seat map...'),
    ],
    flags: MessageFlags.IsComponentsV2,
  });

  await launchSeatMapEphemeral(interaction, flight, seatClass, classCfg, paidAmount, wasFree, client);
}

// ─── Seat Map (extracted from book.js) ─────────────────────────────────
async function launchSeatMapEphemeral(interaction, flight, seatClass, classCfg, paidAmount, wasFree, client) {
  const allBookings = await getBookings(flight.id);
  const takenSeats = allBookings.map(b => b.seat?.toUpperCase()).filter(Boolean);
  const config = detectConfig(flight.aircraft);
  const totalPages = getPageCount(config);
  const classLabel = classCfg.label;

  let page = 0;
  let selectedRow = null;

  function buildMapEmbed(warning) {
    const taken = takenSeats.length;
    const total = config.cols.length * config.totalRows -
      (config.gapRows?.length || 0) * config.cols.length;
    const available = total - taken;

    const container = new ContainerBuilder()
      .setAccentColor(seatClass === 'business' ? COLORS.warning : COLORS.primary)
      .addSectionComponents(section =>
        section
          .addTextDisplayComponents(td => td.setContent(`# Seat Map - Flight ${flight.flight_number}`))
          .setThumbnailAccessory(thumb => thumb.setURL(LOGO))
      )
      .addTextDisplayComponents(td => td.setContent(
        `**Route:** ${flight.origin} → ${flight.destination}\n` +
        `**Aircraft:** ${config.name}\n` +
        `**Class:** ${classCfg.emoji || ''} ${classLabel}\n` +
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

  function buildRowSelect() {
    const options = getRowOptions(config, page, takenSeats);
    if (!options.length) return null;
    return new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('bk_row')
        .setPlaceholder('Pick a row...')
        .addOptions(options.slice(0, 25))
    );
  }

  function buildNavButtons() {
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

  function buildColButtons(row) {
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

  const initialComponents = [
    buildRowSelect(),
    buildNavButtons(),
  ].filter(Boolean);

  const seatMsg = await interaction.followUp({
    components: [...buildMapEmbed(), ...initialComponents],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });

  let seatMessage = seatMsg;

  const collector = seatMsg.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id,
    time: 300_000,
  });

  collector.on('collect', async (i) => {
    seatMessage = i.message;
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
          components: [...buildMapEmbed(), buildRowSelect(), buildNavButtons()].filter(Boolean),
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (id === 'bk_next') {
        page = Math.min(totalPages - 1, page + 1);
        selectedRow = null;
        return await i.update({
          components: [...buildMapEmbed(), buildRowSelect(), buildNavButtons()].filter(Boolean),
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (id === 'bk_row') {
        selectedRow = parseInt(i.values[0]);

        const isBizRow = config.businessRows.includes(selectedRow);
        if (seatClass === 'business' && !isBizRow) {
          return await i.update({
            components: [
              ...buildMapEmbed(`> Row **${selectedRow}** is Economy. Pick a Business row (${config.businessRows.join(', ')}).`),
              buildRowSelect(),
              buildNavButtons(),
            ].filter(Boolean),
            flags: MessageFlags.IsComponentsV2,
          });
        }
        if (seatClass !== 'business' && isBizRow) {
          return await i.update({
            components: [
              ...buildMapEmbed(`> Row **${selectedRow}** is Business Class. Pick an Economy row.`),
              buildRowSelect(),
              buildNavButtons(),
            ].filter(Boolean),
            flags: MessageFlags.IsComponentsV2,
          });
        }

        const colBtns = buildColButtons(selectedRow);
        const backRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('bk_back').setLabel('Back to rows').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('bk_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
        );

        const comps = [buildRowSelect(), ...colBtns, backRow].filter(Boolean).slice(0, 5);
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
          components: [...buildMapEmbed(), buildRowSelect(), buildNavButtons()].filter(Boolean),
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

        const timeDisplay = flight.timestamp
          ? `<t:${Math.floor(flight.timestamp / 1000)}:F>`
          : flight.time || 'TBA';

        const confirmContainer = new ContainerBuilder()
          .setAccentColor(COLORS.success)
          .addTextDisplayComponents(td => td.setContent('# Confirm Your Booking'))
          .addTextDisplayComponents(td => td.setContent(
            `You selected **Seat ${seatId}** on flight **${flight.flight_number}**.`
          ))
          .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(td => td.setContent(buildSeatMap(config, takenSeats, seatId, page)))
          .addTextDisplayComponents(td => td.setContent(
            `> \`==\` = Your selected seat\n> Click **Confirm** to finalize your booking.`
          ))
          .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(td => td.setContent(
            `> **Flight:** \`${flight.flight_number}\`\n` +
            `> **Route:** ${flight.origin} → ${flight.destination}\n` +
            `> **Time:** \`${timeDisplay}\`\n` +
            `> **Aircraft:** \`${config.name}\`\n` +
            `> **Gate:** \`${flight.gate || 'TBA'}\`\n` +
            `> **Seat:** \`${seatId}\` (${classCfg.emoji || ''} ${classLabel})`
          ))
          .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('bk_confirm_seat').setLabel('Confirm Booking').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('bk_back').setLabel('Back').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('bk_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
        );

        pendingBookings.set(interaction.user.id, {
          flightId: flight.id,
          seatId,
          seatClass,
          paidAmount,
          wasFree,
          classCfg,
        });

        return await i.update({
          components: [confirmContainer, confirmRow],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (id === 'bk_confirm_seat') {
        const pending = pendingBookings.get(interaction.user.id);
        if (!pending || pending.flightId !== flight.id) {
          return await i.update({
            components: [new TextDisplayBuilder().setContent('> Session expired. Please start over.')],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        const { seatId, paidAmount: pay, wasFree: free, classCfg: cfg } = pending;

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
              buildRowSelect(),
              buildNavButtons(),
            ].filter(Boolean),
            flags: MessageFlags.IsComponentsV2,
          });
        }

        const { code } = await createBooking({
          flight_id: flight.id,
          flight_number: flight.flight_number,
          discord_id: interaction.user.id,
          username: interaction.user.username,
          display_name: interaction.user.displayName || interaction.user.username,
          seat_class: pending.seatClass,
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

        pendingBookings.delete(interaction.user.id);

        const timeDisplay = flight.timestamp
          ? `<t:${Math.floor(flight.timestamp / 1000)}:F>`
          : flight.time || 'TBA';

        const dmContainer = new ContainerBuilder()
          .setAccentColor(COLORS.success)
          .addSectionComponents(section =>
            section
              .addTextDisplayComponents(td => td.setContent('# Booking Confirmed!'))
              .setThumbnailAccessory(thumb => thumb.setURL(LOGO))
          )
          .addTextDisplayComponents(td => td.setContent(
            `Your seat is confirmed on flight **${flight.flight_number}**.`
          ))
          .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(td => td.setContent(
            `> **Booking Code:** \`${code}\`\n` +
            `> **Flight:** \`${flight.flight_number}\`\n` +
            `> **Route:** ${flight.origin} → ${flight.destination}\n` +
            `> **Seat:** \`${seatId}\`\n` +
            `> **Class:** ${cfg.emoji || ''} ${cfg.label}\n` +
            `> **Paid:** \`${free ? '0 VND (Role Perk)' : `${(pay || 0).toLocaleString()} VND`}\`\n` +
            `> **Departure:** ${timeDisplay}\n` +
            `> **Aircraft:** \`${config.name}\`\n` +
            `> **Gate:** \`${flight.gate || 'TBA'}\``
          ))
          .addTextDisplayComponents(td => td.setContent('-# Keep this code for check-in - Vietnam Airlines Group | PTFS'));

        try {
          await interaction.user.send({
            components: [dmContainer],
            flags: MessageFlags.IsComponentsV2,
          }).catch(() => {
            console.log(`Could not DM ${interaction.user.username} - DMs likely closed.`);
          });
        } catch (dmErr) {
          console.error('DM error:', dmErr.message);
        }

        collector.stop('booked');

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
            `> **Flight:** \`${flight.flight_number}\`\n` +
            `> **Route:** ${flight.origin} → ${flight.destination}\n` +
            `> **Time:** \`${timeDisplay}\`\n` +
            `> **Aircraft:** \`${config.name}\`\n` +
            `> **Gate:** \`${flight.gate || 'TBA'}\`\n` +
            `> **Seat:** \`${seatId}\` (${cfg.emoji || ''} ${cfg.label})\n` +
            `> **Amount Paid:** \`${free ? '0 VND (Role Perk)' : `${(pay || 0).toLocaleString()} VND`}\``
          ))
          .addTextDisplayComponents(td => td.setContent(
            free
              ? '> Free booking - class role perk applied!\n> Keep your booking code safe!'
              : '> Keep your booking code safe!\n> Use \`/book cancel\` to cancel.'
          ))
          .addTextDisplayComponents(td => td.setContent(
            `-# ${free ? 'Role Perk Applied' : `Paid ${(pay || 0).toLocaleString()} VND - ${FOOTER}`}`
          ));

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
      seatMessage.edit({
        components: [new TextDisplayBuilder().setContent('> Timed out after 5 minutes. Run the booking again.')],
      }).catch(() => {});
    }
  });
}

// -- Helpers --
async function resolveFlight(flightId, interaction) {
  const flight = await getFlight(flightId);
  if (flight) return flight;

  const all = await getFlights();
  const found = all.find(f => f.id === flightId || f.flight_number === flightId);
  if (!found) {
    await interaction.reply({
      components: [new TextDisplayBuilder().setContent('> Flight not found.')],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return null;
  }
  return found;
}

async function resolveFlightClasses(flight) {
  const dbClasses = await getFlightClasses(flight.id);
  if (dbClasses) return dbClasses;

  const classes = {};
  if (flight.has_business) {
    classes.business = { ...CLASS_CONFIG.business, role_id: process.env.BUSINESS_ROLE_ID || null };
  }
  classes.economy = { ...CLASS_CONFIG.economy, role_id: process.env.ECONOMY_ROLE_ID || null };
  classes.premium_economy = { ...CLASS_CONFIG.premium_economy, role_id: process.env.PREMIUM_ECONOMY_ROLE_ID || null };
  return classes;
}

function buildClassOptions(classes) {
  return Object.entries(classes).map(([key, cfg]) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(`${cfg.emoji || '•'} ${cfg.label}`)
      .setDescription(`${cfg.cost > 0 ? `${cfg.cost.toLocaleString()}₫` : 'FREE'}${cfg.role_id ? ' · Role perk available' : ''}`)
      .setValue(key)
      .setEmoji(cfg.emoji || '✈️')
  ).slice(0, 25);
}

module.exports = {
  handleBookingButton,
  handleClassSelect,
};
