const {
  SlashCommandBuilder, MessageFlags, PermissionFlagsBits,
  ContainerBuilder, SectionBuilder,
  TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} = require('discord.js');
const { getFlight, getBookings, cancelBooking } = require('../firebase');
const { LOGO, FOOTER, COLORS } = require('../config');
const utils = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checkin')
    .setDescription('[STAFF] Check in passengers for a flight')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt => opt.setName('flightnumber').setDescription('Flight number (e.g. VJ100)').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!utils.staffCheck(interaction)) {
      return interaction.editReply({ content: '> You do not have permission to use this command.' });
    }

    const flightNumber = interaction.options.getString('flightnumber').toUpperCase();
    const flight = await getFlight(flightNumber);
    if (!flight) return interaction.editReply({ content: `> Flight **${flightNumber}** not found.` });

    const bookings = await getBookings(flight.id);
    if (!bookings.length) {
      return interaction.editReply({ content: `> Flight **${flightNumber}** has no bookings to check in.` });
    }

    const sorted = [...bookings].sort((a, b) => (a.seat || '').localeCompare(b.seat || ''));

    let page = 0;
    const perPage = 5;
    const totalPages = Math.ceil(sorted.length / perPage);
    let checkedIn = new Set();

    function buildContainer(p) {
      const slice = sorted.slice(p * perPage, (p + 1) * perPage);
      const container = new ContainerBuilder()
        .setAccentColor(COLORS.primary)
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(td => td.setContent(`# Check-In - Flight ${flightNumber}`))
            .setThumbnailAccessory(thumb => thumb.setURL(LOGO))
        )
        .addTextDisplayComponents(td => td.setContent(
          `> **${bookings.length - checkedIn.size}** passenger(s) remaining to check in.\n` +
          `> Route: ${flight.origin} > ${flight.destination}`
        ))
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small));

      for (const b of slice) {
        const status = checkedIn.has(b.id) ? 'Checked In' : 'Pending';
        container.addTextDisplayComponents(td => td.setContent(
          `### Seat ${b.seat} — ${b.display_name || b.username}\n` +
          `> Code: \`${b.booking_code}\`\n` +
          `> Status: ${status}`
        ));
      }

      container.addTextDisplayComponents(td => td.setContent(`-# Page ${p + 1} of ${totalPages} - ${FOOTER}`));
      return container;
    }

    function buildRows(p) {
      const slice = sorted.slice(p * perPage, (p + 1) * perPage);
      const rows = [];

      const checkinRow = new ActionRowBuilder().addComponents(
        slice.map(b =>
          new ButtonBuilder()
            .setCustomId(`ci_check_${b.id}`)
            .setLabel(`Seat ${b.seat}`)
            .setStyle(checkedIn.has(b.id) ? ButtonStyle.Secondary : ButtonStyle.Success)
            .setDisabled(checkedIn.has(b.id))
        )
      );
      rows.push(checkinRow);

      const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ci_prev').setLabel('< Previous').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
        new ButtonBuilder().setCustomId('ci_next').setLabel('Next >').setStyle(ButtonStyle.Secondary).setDisabled(p === totalPages - 1),
        new ButtonBuilder().setCustomId('ci_done').setLabel('Finish Check-In').setStyle(ButtonStyle.Danger),
      );
      rows.push(navRow);

      return rows;
    }

    const msg = await interaction.editReply({
      components: [buildContainer(page), ...buildRows(page)],
      flags: MessageFlags.IsComponentsV2,
    });

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
          return await btn.update({
            components: [buildContainer(page), ...buildRows(page)],
            flags: MessageFlags.IsComponentsV2,
          });
        }
        if (id === 'ci_next') {
          page = Math.min(totalPages - 1, page + 1);
          return await btn.update({
            components: [buildContainer(page), ...buildRows(page)],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        if (id === 'ci_done') {
          collector.stop('done');
          const doneContainer = new ContainerBuilder()
            .setAccentColor(COLORS.success)
            .addTextDisplayComponents(td => td.setContent(`# Check-In Session Ended - Flight ${flightNumber}`))
            .addTextDisplayComponents(td => td.setContent(
              `> **${checkedIn.size}** passenger(s) checked in.\n` +
              `> Route: ${flight.origin} > ${flight.destination}`
            ))
            .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

          return await btn.update({
            components: [doneContainer],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        if (id.startsWith('ci_check_')) {
          const bookingId = id.replace('ci_check_', '');
          const booking = sorted.find(b => b.id === bookingId);
          if (!booking) {
            return await btn.reply({
              components: [new TextDisplayBuilder().setContent('> Booking not found.')],
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
          }
          if (checkedIn.has(bookingId)) {
            return await btn.update({
              components: [buildContainer(page), ...buildRows(page)],
              flags: MessageFlags.IsComponentsV2,
            });
          }

          await btn.deferUpdate();

          checkedIn.add(bookingId);
          await cancelBooking(bookingId);

          try {
            const passengerUser = await interaction.client.users.fetch(booking.discord_id).catch(() => null);
            if (passengerUser) {
              const dmContainer = new ContainerBuilder()
                .setAccentColor(COLORS.success)
                .addSectionComponents(section =>
                  section
                    .addTextDisplayComponents(td => td.setContent('# Checked In!'))
                    .setThumbnailAccessory(thumb => thumb.setURL(LOGO))
                )
                .addTextDisplayComponents(td => td.setContent('You have been checked in for your flight.'))
                .addTextDisplayComponents(td => td.setContent(
                  `> **Flight:** \`${flightNumber}\`\n` +
                  `> **Seat:** \`${booking.seat}\`\n` +
                  `> **Route:** ${flight.origin} > ${flight.destination}\n` +
                  `> **Checked In By:** ${interaction.user.username}`
                ))
                .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER} - Have a great flight!`));

              await passengerUser.send({
                components: [dmContainer],
                flags: MessageFlags.IsComponentsV2,
              }).catch(() => {
                console.log(`Could not DM ${booking.username} — DMs likely closed.`);
              });
            }
          } catch (err) {
            console.error('Check-in DM failed:', err.message);
          }

          return await interaction.editReply({
            components: [buildContainer(page), ...buildRows(page)],
            flags: MessageFlags.IsComponentsV2,
          });
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
