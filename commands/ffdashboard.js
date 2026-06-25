const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, RoleSelectMenuBuilder, ComponentType,
} = require('discord.js');
const { getFFConfig, updateFFConfig } = require('../firebase');
require('dotenv').config();

const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';
const TIER_EMOJI = { Member: '⚪', Silver: '⚪', Gold: '🟡', Platinum: '💎' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ffdashboard')
    .setDescription('[STAFF] Configure the LotusMiles miles program')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.editReply({ content: '❌ You do not have permission.' });
    }

    let config = await getFFConfig();

    function buildEmbed() {
      const tierLines = config.tiers.map(t =>
        `${TIER_EMOJI[t.name] || '⚪'} **${t.name}** — ${t.threshold.toLocaleString()} lifetime miles${t.role_id ? ` → <@&${t.role_id}>` : ' (no role set)'}`
      ).join('\n');

      return new EmbedBuilder()
        .setColor(0x007B8A)
        .setTitle('✈️ LotusMiles Dashboard')
        .setThumbnail(LOGO)
        .setDescription('Configure miles earning rates and tier role rewards.')
        .addFields(
          { name: '🎫 Miles Per Flight (Economy)', value: `${config.miles_per_flight} mi`, inline: true },
          { name: '💼 Business Bonus', value: `+${config.miles_per_business_bonus} mi`, inline: true },
          { name: '\u200b', value: '\u200b', inline: true },
          { name: '🏆 Tiers & Role Rewards', value: tierLines, inline: false },
        )
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Click buttons below to configure' })
        .setTimestamp();
    }

    function buildRows() {
      const tierButtons = config.tiers.map((t, i) =>
        new ButtonBuilder().setCustomId(`eco_fftier_${i}`).setLabel(`Edit ${t.name}`).setStyle(ButtonStyle.Primary)
      );

      const rows = [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('eco_ffrate').setLabel('Edit Miles Rates').setStyle(ButtonStyle.Secondary).setEmoji('🎫'),
        ),
      ];

      // Tier buttons — max 5 per row
      for (let i = 0; i < tierButtons.length; i += 4) {
        rows.push(new ActionRowBuilder().addComponents(tierButtons.slice(i, i + 4)));
      }

      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('eco_ffdone').setLabel('Done ✅').setStyle(ButtonStyle.Success),
      ));

      return rows.slice(0, 5);
    }

    const msg = await interaction.editReply({ embeds: [buildEmbed()], components: buildRows() });

    const collector = msg.createMessageComponentCollector({ time: 300_000, filter: i => i.user.id === interaction.user.id });

    collector.on('collect', async (i) => {
      try {
        const id = i.customId;

        if (id === 'eco_ffdone') {
          collector.stop('done');
          return await i.update({ embeds: [buildEmbed().setTitle('✅ LotusMiles Config Saved').setColor(0x00B050)], components: [] });
        }

        // Edit miles rate
        if (id === 'eco_ffrate') {
          const modal = new ModalBuilder().setCustomId('ffrate_modal').setTitle('Edit Miles Rates');
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('base').setLabel('Miles per flight (Economy)').setStyle(TextInputStyle.Short).setValue(String(config.miles_per_flight)).setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('bonus').setLabel('Business class bonus miles').setStyle(TextInputStyle.Short).setValue(String(config.miles_per_business_bonus)).setRequired(true)
            ),
          );
          await i.showModal(modal);

          const submitted = await i.awaitModalSubmit({ time: 120_000, filter: m => m.user.id === interaction.user.id }).catch(() => null);
          if (!submitted) return;

          const base = parseInt(submitted.fields.getTextInputValue('base'));
          const bonus = parseInt(submitted.fields.getTextInputValue('bonus'));
          if (!isNaN(base)) config.miles_per_flight = base;
          if (!isNaN(bonus)) config.miles_per_business_bonus = bonus;

          await updateFFConfig({ miles_per_flight: config.miles_per_flight, miles_per_business_bonus: config.miles_per_business_bonus });
          return await submitted.update({ embeds: [buildEmbed()], components: buildRows() });
        }

        // Edit tier
        if (id.startsWith('eco_fftier_')) {
          const tierIndex = parseInt(id.replace('eco_fftier_', ''));
          const tier = config.tiers[tierIndex];

          const modal = new ModalBuilder().setCustomId(`fftier_modal_${tierIndex}`).setTitle(`Edit ${tier.name} Tier`);
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('threshold').setLabel('Lifetime miles threshold').setStyle(TextInputStyle.Short).setValue(String(tier.threshold)).setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('roleid').setLabel('Role ID to grant (leave empty for none)').setStyle(TextInputStyle.Short).setValue(tier.role_id || '').setRequired(false)
            ),
          );
          await i.showModal(modal);

          const submitted = await i.awaitModalSubmit({ time: 120_000, filter: m => m.user.id === interaction.user.id }).catch(() => null);
          if (!submitted) return;

          const threshold = parseInt(submitted.fields.getTextInputValue('threshold'));
          const roleId = submitted.fields.getTextInputValue('roleid').trim() || null;

          if (!isNaN(threshold)) config.tiers[tierIndex].threshold = threshold;
          config.tiers[tierIndex].role_id = roleId;

          await updateFFConfig({ tiers: config.tiers });
          return await submitted.update({ embeds: [buildEmbed()], components: buildRows() });
        }
      } catch (err) {
        console.error('FF Dashboard error:', err.message);
      }
    });

    collector.on('end', (_, reason) => {
      if (reason !== 'done') interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};
