const {
  SlashCommandBuilder, MessageFlags, PermissionFlagsBits,
  ContainerBuilder, SectionBuilder,
  TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder,
  ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ComponentType,
} = require('discord.js');
const { getFleet, updatePlane } = require('../firebase');
const { FOOTER, COLORS } = require('../config');
const utils = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editplane')
    .setDescription('[STAFF] Edit an aircraft in the fleet via interactive dashboard')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt => opt.setName('registration').setDescription('Tail registration (e.g. A123 or VN-A123)').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!utils.staffCheck(interaction)) {
      return interaction.editReply({ content: '> You do not have permission to use this command.' });
    }

    const regInput = interaction.options.getString('registration').toUpperCase().replace('VN-', '');
    const fleet = await getFleet();
    const plane = fleet.find(p =>
      (p.tail_registration || '').toUpperCase() === regInput ||
      (p.full_registration || '').toUpperCase() === `VN-${regInput}`
    );

    if (!plane) {
      const list = fleet.map(p => `• **${p.display_name}** — VN-${p.tail_registration}`).join('\n');
      return interaction.editReply({ content: `> Aircraft **VN-${regInput}** not found.\n\nFleet:\n${list || 'Empty'}` });
    }

    function buildDashboard(p) {
      const container = new ContainerBuilder()
        .setAccentColor(0x0099FF)
        .addTextDisplayComponents(td => td.setContent(`# Editing: ${p.display_name} — VN-${p.tail_registration}`))
        .addTextDisplayComponents(td => td.setContent('Use the buttons below to edit this aircraft.'))
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td => td.setContent(
          `> **Type:** ${p.aircraft_type || 'N/A'}\n` +
          `> **Display Name:** ${p.display_name || 'N/A'}\n` +
          `> **Registration:** VN-${p.tail_registration}\n` +
          `> **Capacity:** ${p.passenger_capacity || 'N/A'}\n` +
          `> **Seat Config:** ${p.seat_config || 'N/A'}\n` +
          `> **Business Class:** ${p.has_business ? `Yes ${p.business_rows || 0} rows` : 'No'}\n` +
          `> **Status:** ${p.service_status || p.status || 'N/A'}`
        ))
        .addTextDisplayComponents(td => td.setContent(`> **Description:** ${(p.description || 'N/A').slice(0, 200)}`))
        .addTextDisplayComponents(td => td.setContent(
          p.image_url ? `> **Image:** [View Image](${p.image_url})` : '> **Image:** None'
        ))
        .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER} • Click a button to edit that field`));

      return [container];
    }

    function buildRows() {
      return [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ep_name').setLabel('Display Name').setStyle(ButtonStyle.Primary).setEmoji('🏷️'),
          new ButtonBuilder().setCustomId('ep_type').setLabel('Aircraft Type').setStyle(ButtonStyle.Primary).setEmoji('✈️'),
          new ButtonBuilder().setCustomId('ep_capacity').setLabel('Capacity').setStyle(ButtonStyle.Primary).setEmoji('💺'),
          new ButtonBuilder().setCustomId('ep_config').setLabel('Seat Config').setStyle(ButtonStyle.Primary).setEmoji('🪑'),
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ep_status_active').setLabel('Active').setStyle(ButtonStyle.Success).setEmoji('🟢'),
          new ButtonBuilder().setCustomId('ep_status_maintenance').setLabel('Maintenance').setStyle(ButtonStyle.Secondary).setEmoji('🟡'),
          new ButtonBuilder().setCustomId('ep_status_grounded').setLabel('Grounded').setStyle(ButtonStyle.Danger).setEmoji('🔴'),
          new ButtonBuilder().setCustomId('ep_status_retired').setLabel('Retired').setStyle(ButtonStyle.Secondary).setEmoji('⚫'),
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ep_image').setLabel('Livery Image URL').setStyle(ButtonStyle.Secondary).setEmoji('🖼️'),
          new ButtonBuilder().setCustomId('ep_desc').setLabel('Description').setStyle(ButtonStyle.Secondary).setEmoji('📝'),
          new ButtonBuilder().setCustomId('ep_business_yes').setLabel('Business: ON').setStyle(ButtonStyle.Success).setEmoji('💼'),
          new ButtonBuilder().setCustomId('ep_business_no').setLabel('Business: OFF').setStyle(ButtonStyle.Danger).setEmoji('💼'),
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ep_done').setLabel('Done ✅').setStyle(ButtonStyle.Success),
        ),
      ];
    }

    let current = { ...plane };
    const msg = await interaction.editReply({
      components: [...buildDashboard(current), ...buildRows()],
      flags: MessageFlags.IsComponentsV2,
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300_000,
      filter: i => i.user.id === interaction.user.id,
    });

    collector.on('collect', async (btn) => {
      if (btn.customId.startsWith('ep_status_')) {
        const statusMap = {
          ep_status_active: 'Active (Airworthy)',
          ep_status_maintenance: 'Maintenance',
          ep_status_grounded: 'Grounded',
          ep_status_retired: 'Retired',
        };
        current.service_status = statusMap[btn.customId];
        await updatePlane(plane.id, { service_status: current.service_status });
        return btn.update({
          components: [...buildDashboard(current), ...buildRows()],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (btn.customId === 'ep_business_yes') {
        current.has_business = true;
        await updatePlane(plane.id, { has_business: true });
        return btn.update({
          components: [...buildDashboard(current), ...buildRows()],
          flags: MessageFlags.IsComponentsV2,
        });
      }
      if (btn.customId === 'ep_business_no') {
        current.has_business = false;
        await updatePlane(plane.id, { has_business: false });
        return btn.update({
          components: [...buildDashboard(current), ...buildRows()],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (btn.customId === 'ep_done') {
        collector.stop('done');
        const doneContainer = new ContainerBuilder()
          .setAccentColor(COLORS.success)
          .addTextDisplayComponents(td => td.setContent(`# Saved: ${current.display_name} — VN-${current.tail_registration}`))
          .addTextDisplayComponents(td => td.setContent('Use the buttons below to edit this aircraft.'))
          .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(td => td.setContent(
            `> **Type:** ${current.aircraft_type || 'N/A'}\n` +
            `> **Display Name:** ${current.display_name || 'N/A'}\n` +
            `> **Registration:** VN-${current.tail_registration}\n` +
            `> **Capacity:** ${current.passenger_capacity || 'N/A'}\n` +
            `> **Seat Config:** ${current.seat_config || 'N/A'}\n` +
            `> **Business Class:** ${current.has_business ? `Yes ${current.business_rows || 0} rows` : 'No'}\n` +
            `> **Status:** ${current.service_status || current.status || 'N/A'}`
          ))
          .addTextDisplayComponents(td => td.setContent(`> **Description:** ${(current.description || 'N/A').slice(0, 200)}`))
          .addTextDisplayComponents(td => td.setContent(
            current.image_url ? `> **Image:** [View Image](${current.image_url})` : '> **Image:** None'
          ))
          .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

        return btn.update({
          components: [doneContainer],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const modalMap = {
        ep_name: { title: 'Edit Display Name', label: 'Display Name', field: 'display_name', current: current.display_name },
        ep_type: { title: 'Edit Aircraft Type', label: 'Aircraft Type', field: 'aircraft_type', current: current.aircraft_type },
        ep_capacity: { title: 'Edit Capacity', label: 'Passenger Capacity (number)', field: 'passenger_capacity', current: String(current.passenger_capacity) },
        ep_config: { title: 'Edit Seat Config', label: 'Seat Config (e.g. 3-3 or 2-4-2)', field: 'seat_config', current: current.seat_config },
        ep_image: { title: 'Edit Livery Image', label: 'Image URL', field: 'image_url', current: current.image_url || '' },
        ep_desc: { title: 'Edit Description', label: 'Description', field: 'description', current: current.description || '', long: true },
      };

      const config = modalMap[btn.customId];
      if (!config) return;

      const modal = new ModalBuilder()
        .setCustomId(`ep_modal_${config.field}`)
        .setTitle(config.title);

      const input = new TextInputBuilder()
        .setCustomId('value')
        .setLabel(config.label)
        .setStyle(config.long ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setValue(config.current || '')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await btn.showModal(modal);

      const submitted = await btn.awaitModalSubmit({ time: 120_000, filter: i => i.user.id === interaction.user.id }).catch(() => null);
      if (!submitted) return;

      let value = submitted.fields.getTextInputValue('value');
      if (config.field === 'passenger_capacity') value = parseInt(value) || current.passenger_capacity;

      current[config.field] = value;
      await updatePlane(plane.id, { [config.field]: value });

      await submitted.update({
        components: [...buildDashboard(current), ...buildRows()],
        flags: MessageFlags.IsComponentsV2,
      });
    });

    collector.on('end', (_, reason) => {
      if (reason !== 'done') {
        interaction.editReply({ components: [] }).catch(() => {});
      }
    });
  },
};
