const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder,
  ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ComponentType,
} = require('discord.js');
const { getFleet, updatePlane } = require('../firebase');
require('dotenv').config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editplane')
    .setDescription('[STAFF] Edit an aircraft in the fleet via interactive dashboard')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt => opt.setName('registration').setDescription('Tail registration (e.g. A123 or VN-A123)').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
    }

    const regInput = interaction.options.getString('registration').toUpperCase().replace('VN-', '');
    const fleet = await getFleet();
    const plane = fleet.find(p =>
      (p.tail_registration || '').toUpperCase() === regInput ||
      (p.full_registration || '').toUpperCase() === `VN-${regInput}`
    );

    if (!plane) {
      const list = fleet.map(p => `• **${p.display_name}** — VN-${p.tail_registration}`).join('\n');
      return interaction.editReply({ content: `❌ Aircraft **VN-${regInput}** not found.\n\nFleet:\n${list || 'Empty'}` });
    }

    function buildDashboard(p) {
      return new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`✏️ Editing: ${p.display_name} — VN-${p.tail_registration}`)
        .setDescription('Use the buttons below to edit this aircraft.')
        .addFields(
          { name: '✈️ Type', value: p.aircraft_type || 'N/A', inline: true },
          { name: '🏷️ Display Name', value: p.display_name || 'N/A', inline: true },
          { name: '🔖 Registration', value: `VN-${p.tail_registration}`, inline: true },
          { name: '💺 Capacity', value: `${p.passenger_capacity || 'N/A'}`, inline: true },
          { name: '🪑 Seat Config', value: p.seat_config || 'N/A', inline: true },
          { name: '💼 Business Class', value: p.has_business ? `✅ ${p.business_rows || 0} rows` : '❌ No', inline: true },
          { name: '🔧 Status', value: p.service_status || p.status || 'N/A', inline: true },
          { name: '📝 Description', value: (p.description || 'N/A').slice(0, 200), inline: false },
          { name: '🖼️ Image', value: p.image_url ? `[View Image](${p.image_url})` : 'None', inline: false },
        )
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Click a button to edit that field' })
        .setTimestamp();
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
    const msg = await interaction.editReply({ embeds: [buildDashboard(current)], components: buildRows() });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300_000,
      filter: i => i.user.id === interaction.user.id,
    });

    collector.on('collect', async (btn) => {
      // Status buttons — no modal needed
      if (btn.customId.startsWith('ep_status_')) {
        const statusMap = {
          ep_status_active: 'Active (Airworthy)',
          ep_status_maintenance: 'Maintenance',
          ep_status_grounded: 'Grounded',
          ep_status_retired: 'Retired',
        };
        current.service_status = statusMap[btn.customId];
        await updatePlane(plane.id, { service_status: current.service_status });
        return btn.update({ embeds: [buildDashboard(current)], components: buildRows() });
      }

      // Business toggle
      if (btn.customId === 'ep_business_yes') {
        current.has_business = true;
        await updatePlane(plane.id, { has_business: true });
        return btn.update({ embeds: [buildDashboard(current)], components: buildRows() });
      }
      if (btn.customId === 'ep_business_no') {
        current.has_business = false;
        await updatePlane(plane.id, { has_business: false });
        return btn.update({ embeds: [buildDashboard(current)], components: buildRows() });
      }

      // Done
      if (btn.customId === 'ep_done') {
        collector.stop('done');
        return btn.update({
          embeds: [buildDashboard(current).setTitle(`✅ Saved: ${current.display_name} — VN-${current.tail_registration}`).setColor(0x00B050)],
          components: [],
        });
      }

      // Modal fields
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

      // Wait for modal submit
      const submitted = await btn.awaitModalSubmit({ time: 120_000, filter: i => i.user.id === interaction.user.id }).catch(() => null);
      if (!submitted) return;

      let value = submitted.fields.getTextInputValue('value');
      if (config.field === 'passenger_capacity') value = parseInt(value) || current.passenger_capacity;

      current[config.field] = value;
      await updatePlane(plane.id, { [config.field]: value });

      await submitted.update({ embeds: [buildDashboard(current)], components: buildRows() });
    });

    collector.on('end', (_, reason) => {
      if (reason !== 'done') {
        interaction.editReply({ components: [] }).catch(() => {});
      }
    });
  },
};
