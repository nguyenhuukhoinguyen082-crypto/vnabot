const {
  SlashCommandBuilder, PermissionFlagsBits, MessageFlags,
  ContainerBuilder, SectionBuilder, TextDisplayBuilder,
  SeparatorBuilder, SeparatorSpacingSize, ThumbnailBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { getFFConfig, updateFFConfig } = require('../firebase');
const { LOGO, FOOTER, COLORS } = require('../config');
const utils = require('../utils');
const TIER_EMOJI = { Member: '⚪', Silver: '⚪', Gold: '🟡', Platinum: '💎' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ffdashboard')
    .setDescription('[STAFF] Configure the LotusMiles miles program')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    if (!utils.staffCheck(interaction)) {
      return interaction.editReply({ content: '❌ You do not have permission.' });
    }

    let config = await getFFConfig();

    function buildContainer(title = '✈️ LotusMiles Dashboard', color = COLORS.primary) {
      const tierLines = config.tiers.map(t =>
        `${TIER_EMOJI[t.name] || '⚪'} **${t.name}** — ${t.threshold.toLocaleString()} lifetime miles${t.role_id ? ` → <@&${t.role_id}>` : ' (no role set)'}`
      ).join('\n');

      return new ContainerBuilder()
        .setAccentColor(color)
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(
              td => td.setContent(`# ${title}`),
              td => td.setContent('Configure miles earning rates and tier role rewards.'),
            )
            .setThumbnailAccessory(tb => tb.setURL(LOGO))
        )
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td => td.setContent([
          `> **🎫 Miles Per Flight (Economy):** ${config.miles_per_flight} mi`,
          `> **💼 Business Bonus:** +${config.miles_per_business_bonus} mi`,
        ].join('\n')))
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td => td.setContent(`> **🏆 Tiers & Role Rewards**\n${tierLines}`))
        .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER} • Click buttons below to configure`));
    }

    function buildRows() {
      const tierButtons = config.tiers.map((t, i) =>
        new ButtonBuilder().setCustomId(`ff_tier_${i}`).setLabel(`Edit ${t.name}`).setStyle(ButtonStyle.Primary)
      );

      const rows = [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ff_rate').setLabel('Edit Miles Rates').setStyle(ButtonStyle.Secondary).setEmoji('🎫'),
        ),
      ];

      for (let i = 0; i < tierButtons.length; i += 4) {
        rows.push(new ActionRowBuilder().addComponents(tierButtons.slice(i, i + 4)));
      }

      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ff_done').setLabel('Done ✅').setStyle(ButtonStyle.Success),
      ));

      return rows.slice(0, 5);
    }

    const msg = await interaction.editReply({ components: [buildContainer(), ...buildRows()], flags: MessageFlags.IsComponentsV2 });

    const collector = msg.createMessageComponentCollector({ time: 300_000, filter: i => i.user.id === interaction.user.id });

    collector.on('collect', async (i) => {
      try {
        const id = i.customId;

        if (id === 'ff_done') {
          collector.stop('done');
          return await i.update({ components: [buildContainer('✅ LotusMiles Config Saved', COLORS.success)], flags: MessageFlags.IsComponentsV2 });
        }

        if (id === 'ff_rate') {
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
          return await submitted.update({ components: [buildContainer(), ...buildRows()], flags: MessageFlags.IsComponentsV2 });
        }

        if (id.startsWith('ff_tier_')) {
          const tierIndex = parseInt(id.replace('ff_tier_', ''));
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
          return await submitted.update({ components: [buildContainer(), ...buildRows()], flags: MessageFlags.IsComponentsV2 });
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
