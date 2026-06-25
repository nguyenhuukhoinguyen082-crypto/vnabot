const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { getCareerConfig, updateCareerConfig } = require('../firebase');
require('dotenv').config();

const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('careerdashboard')
    .setDescription('[STAFF] Configure the pilot career/rank system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.editReply({ content: '❌ You do not have permission.' });
    }

    let config = await getCareerConfig();

    function buildEmbed() {
      const rankLines = config.ranks.map(r =>
        `🎖️ **${r.name}** — ${r.days_required}d in server + ${r.flights_required} flights${r.role_id ? ` → <@&${r.role_id}>` : ' (no role set)'}`
      ).join('\n');

      return new EmbedBuilder()
        .setColor(0x007B8A)
        .setTitle('👨‍✈️ Career Dashboard')
        .setThumbnail(LOGO)
        .setDescription('Configure pilot rank requirements and role rewards.\nUsers need BOTH the days-in-server AND flights requirement to rank up.')
        .addFields({ name: '🎖️ Ranks & Role Rewards', value: rankLines, inline: false })
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Click buttons below to configure' })
        .setTimestamp();
    }

    function buildRows() {
      const rankButtons = config.ranks.map((r, i) =>
        new ButtonBuilder().setCustomId(`eco_ranktier_${i}`).setLabel(`Edit ${r.name}`).setStyle(ButtonStyle.Primary)
      );

      const rows = [];
      for (let i = 0; i < rankButtons.length; i += 4) {
        rows.push(new ActionRowBuilder().addComponents(rankButtons.slice(i, i + 4)));
      }

      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('eco_rankdone').setLabel('Done ✅').setStyle(ButtonStyle.Success),
      ));

      return rows.slice(0, 5);
    }

    const msg = await interaction.editReply({ embeds: [buildEmbed()], components: buildRows() });

    const collector = msg.createMessageComponentCollector({ time: 300_000, filter: i => i.user.id === interaction.user.id });

    collector.on('collect', async (i) => {
      try {
        const id = i.customId;

        if (id === 'eco_rankdone') {
          collector.stop('done');
          return await i.update({ embeds: [buildEmbed().setTitle('✅ Career Config Saved').setColor(0x00B050)], components: [] });
        }

        if (id.startsWith('eco_ranktier_')) {
          const rankIndex = parseInt(id.replace('eco_ranktier_', ''));
          const rank = config.ranks[rankIndex];

          const modal = new ModalBuilder().setCustomId(`rank_modal_${rankIndex}`).setTitle(`Edit ${rank.name} Rank`);
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('days').setLabel('Days in server required').setStyle(TextInputStyle.Short).setValue(String(rank.days_required)).setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('flights').setLabel('Flights required').setStyle(TextInputStyle.Short).setValue(String(rank.flights_required)).setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('roleid').setLabel('Role ID to grant (leave empty for none)').setStyle(TextInputStyle.Short).setValue(rank.role_id || '').setRequired(false)
            ),
          );
          await i.showModal(modal);

          const submitted = await i.awaitModalSubmit({ time: 120_000, filter: m => m.user.id === interaction.user.id }).catch(() => null);
          if (!submitted) return;

          const days = parseInt(submitted.fields.getTextInputValue('days'));
          const flights = parseInt(submitted.fields.getTextInputValue('flights'));
          const roleId = submitted.fields.getTextInputValue('roleid').trim() || null;

          if (!isNaN(days)) config.ranks[rankIndex].days_required = days;
          if (!isNaN(flights)) config.ranks[rankIndex].flights_required = flights;
          config.ranks[rankIndex].role_id = roleId;

          await updateCareerConfig({ ranks: config.ranks });
          return await submitted.update({ embeds: [buildEmbed()], components: buildRows() });
        }
      } catch (err) {
        console.error('Career Dashboard error:', err.message);
      }
    });

    collector.on('end', (_, reason) => {
      if (reason !== 'done') interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};
