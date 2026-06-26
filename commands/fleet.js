const { SlashCommandBuilder, MessageFlags, ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getFleet } = require('../firebase');
const { LOGO, FOOTER, COLORS, STATUS_EMOJI } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fleet')
    .setDescription('View the Vietnam Airlines Group | PTFS fleet'),

  async execute(interaction) {
    await interaction.deferReply();
    const fleet = await getFleet();
    if (!fleet.length) return interaction.editReply({ content: '> No aircraft in the fleet yet.' });

    let page = 0;
    const total = fleet.length;

    function buildFleetCard(index) {
      const p = fleet[index];
      const statusEmoji = STATUS_EMOJI[(p.service_status || p.status || '').toLowerCase()] || '🟢';

      const container = new ContainerBuilder()
        .setAccentColor(COLORS.primary)
        .addTextDisplayComponents(
          td => td.setContent(`# ${statusEmoji} ${p.display_name || p.aircraft_type} — VN-${p.tail_registration || p.registration}`)
        )
        .addSeparatorComponents(
          sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          td => td.setContent([
            `> **Type:** \`${p.aircraft_type || 'N/A'}\``,
            `> **Registration:** \`VN-${p.tail_registration || p.registration}\``,
            `> **Capacity:** \`${p.passenger_capacity || p.seats || 'N/A'} seats\``,
            `> **Seat Config:** \`${p.seat_config || 'N/A'}\``,
            `> **Business Class:** \`${p.has_business ? `${p.business_rows || 0} rows` : 'No'}\``,
            `> **Status:** \`${p.service_status || p.status || 'N/A'}\``,
          ].join('\n'))
        );

      if (p.description) {
        container.addTextDisplayComponents(
          td => td.setContent(p.description)
        );
      }

      if (p.image_url) {
        container.addSeparatorComponents(
          sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        );
        container.addSectionComponents(section =>
          section
            .addTextDisplayComponents(td => td.setContent('### Aircraft Image'))
            .setThumbnailAccessory(thumb => thumb.setURL(p.image_url))
        );
      }

      container.addSeparatorComponents(
        sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
      );
      container.addTextDisplayComponents(
        td => td.setContent(`-# ${FOOTER} — Aircraft ${index + 1} of ${total}`)
      );

      return container;
    }

    function buildRow(index) {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('fl_prev').setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
        new ButtonBuilder().setCustomId('fl_next').setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(index === total - 1),
      );
    }

    const msg = await interaction.editReply({
      components: total > 1 ? [buildFleetCard(page), buildRow(page)] : [buildFleetCard(page)],
      flags: MessageFlags.IsComponentsV2,
    });

    if (total <= 1) return;

    const collector = msg.createMessageComponentCollector({
      time: 120_000,
      filter: i => i.user.id === interaction.user.id,
    });

    collector.on('collect', async (btn) => {
      try {
        if (btn.customId === 'fl_prev') page = Math.max(0, page - 1);
        if (btn.customId === 'fl_next') page = Math.min(total - 1, page + 1);
        await btn.update({ components: [buildFleetCard(page), buildRow(page)], flags: MessageFlags.IsComponentsV2 });
      } catch (err) {
        console.error('Fleet collector error:', err.message);
      }
    });

    collector.on('end', () => { interaction.editReply({ components: [] }).catch(() => {}); });
  },
};
