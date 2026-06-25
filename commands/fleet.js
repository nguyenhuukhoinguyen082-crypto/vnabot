const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getFleet } = require('../firebase');

const STATUS_EMOJI = {
  'active (airworthy)': '🟢', 'active': '🟢',
  'maintenance': '🟡', 'grounded': '🔴', 'retired': '⚫',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fleet')
    .setDescription('View the Vietnam Airlines Group | PTFS fleet'),

  async execute(interaction) {
    await interaction.deferReply();
    const fleet = await getFleet();
    if (!fleet.length) return interaction.editReply({ content: '✈️ No aircraft in the fleet yet.' });

    let page = 0;
    const total = fleet.length;

    function buildEmbed(index) {
      const p = fleet[index];
      const statusEmoji = STATUS_EMOJI[(p.service_status || p.status || '').toLowerCase()] || '🟢';
      const embed = new EmbedBuilder()
        .setColor(0x007B8A)
        .setTitle(`${statusEmoji} ${p.display_name || p.aircraft_type} — VN-${p.tail_registration || p.registration}`)
        .addFields(
          { name: '✈️ Type', value: p.aircraft_type || 'N/A', inline: true },
          { name: '🔖 Registration', value: `VN-${p.tail_registration || p.registration}`, inline: true },
          { name: '💺 Capacity', value: `${p.passenger_capacity || p.seats || 'N/A'} seats`, inline: true },
          { name: '🪑 Seat Config', value: p.seat_config || 'N/A', inline: true },
          { name: '💼 Business Class', value: p.has_business ? `✅ ${p.business_rows || 0} rows` : '❌ No', inline: true },
          { name: '🔧 Status', value: p.service_status || p.status || 'N/A', inline: true },
          { name: '📝 Description', value: p.description || 'N/A', inline: false },
        )
        .setFooter({ text: `Aircraft ${index + 1} of ${total} • Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao` })
        .setTimestamp();
      if (p.image_url) embed.setImage(p.image_url);
      return embed;
    }

    function buildRow(index) {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('fl_prev').setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
        new ButtonBuilder().setCustomId('fl_next').setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(index === total - 1),
      );
    }

    const msg = await interaction.editReply({
      embeds: [buildEmbed(page)],
      components: total > 1 ? [buildRow(page)] : [],
    });

    if (total <= 1) return;

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
      filter: i => i.user.id === interaction.user.id,
    });

    collector.on('collect', async (btn) => {
      try {
        if (btn.customId === 'fl_prev') page = Math.max(0, page - 1);
        if (btn.customId === 'fl_next') page = Math.min(total - 1, page + 1);
        await btn.update({ embeds: [buildEmbed(page)], components: [buildRow(page)] });
      } catch (err) {
        console.error('Fleet collector error:', err.message);
      }
    });

    collector.on('end', () => { interaction.editReply({ components: [] }).catch(() => {}); });
  },
};
