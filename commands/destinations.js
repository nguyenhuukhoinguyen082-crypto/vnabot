const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getDestinations } = require('../firebase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('destinations')
    .setDescription('Browse all Vietnam Airlines Group | PTFS destinations'),

  async execute(interaction) {
    await interaction.deferReply();
    const destinations = await getDestinations();
    if (!destinations.length) return interaction.editReply({ content: '🌍 No destinations added yet.' });

    let page = 0;
    const total = destinations.length;

    function buildEmbed(index) {
      const dest = destinations[index];
      const embed = new EmbedBuilder()
        .setColor(0x007B8A)
        .setTitle(`🌍 ${dest.name || 'Destination'}`)
        .setDescription(dest.description || 'No description available.')
        .addFields(
          { name: '🛬 Airport Code', value: dest.code || 'N/A', inline: true },
          { name: '🌏 Country', value: dest.country || 'N/A', inline: true },
        )
        .setFooter({ text: `Destination ${index + 1} of ${total} • Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao` })
        .setTimestamp();
      if (dest.image_url) embed.setImage(dest.image_url);
      return embed;
    }

    function buildRow(index) {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('dest_prev').setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
        new ButtonBuilder().setCustomId('dest_next').setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(index === total - 1),
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
        if (btn.customId === 'dest_prev') page = Math.max(0, page - 1);
        if (btn.customId === 'dest_next') page = Math.min(total - 1, page + 1);
        await btn.update({ embeds: [buildEmbed(page)], components: [buildRow(page)] });
      } catch (err) {
        console.error('Destinations collector error:', err.message);
      }
    });

    collector.on('end', () => { interaction.editReply({ components: [] }).catch(() => {}); });
  },
};
