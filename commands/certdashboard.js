const {
  SlashCommandBuilder, PermissionFlagsBits, MessageFlags,
  ContainerBuilder, SectionBuilder, TextDisplayBuilder,
  SeparatorBuilder, SeparatorSpacingSize, ThumbnailBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { getCertConfig, updateCertConfig } = require('../firebase');
const { LOGO, FOOTER, COLORS } = require('../config');
const utils = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('certdashboard')
    .setDescription('[STAFF] Configure which role each certification grants')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    if (!utils.staffCheck(interaction)) {
      return interaction.editReply({ content: '❌ You do not have permission.' });
    }

    let config = await getCertConfig();

    function buildContainer(title = '🎓 Certification Dashboard', color = COLORS.warning) {
      const lines = config.types.map(t =>
        `🎓 **${t.name}** ${t.role_id ? `→ <@&${t.role_id}>` : '(no role set)'}`
      ).join('\n');

      return new ContainerBuilder()
        .setAccentColor(color)
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(
              td => td.setContent(`# ${title}`),
              td => td.setContent('Configure which Discord role each certification type grants when issued.'),
            )
            .setThumbnailAccessory(tb => tb.setURL(LOGO))
        )
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td => td.setContent(`> **🎖️ Certification Types**\n${lines}`))
        .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER} • Click a button to set its role`));
    }

    function buildRows() {
      const buttons = config.types.map((t, i) =>
        new ButtonBuilder().setCustomId(`cert_type_${i}`).setLabel(`Edit ${t.name}`).setStyle(ButtonStyle.Primary)
      );
      const rows = [];
      for (let i = 0; i < buttons.length; i += 4) {
        rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 4)));
      }
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cert_done').setLabel('Done ✅').setStyle(ButtonStyle.Success),
      ));
      return rows.slice(0, 5);
    }

    const msg = await interaction.editReply({ components: [buildContainer(), ...buildRows()], flags: MessageFlags.IsComponentsV2 });

    const collector = msg.createMessageComponentCollector({ time: 300_000, filter: i => i.user.id === interaction.user.id });

    collector.on('collect', async (i) => {
      try {
        const id = i.customId;

        if (id === 'cert_done') {
          collector.stop('done');
          return await i.update({ components: [buildContainer('✅ Certification Config Saved', COLORS.success)], flags: MessageFlags.IsComponentsV2 });
        }

        if (id.startsWith('cert_type_')) {
          const index = parseInt(id.replace('cert_type_', ''));
          const type = config.types[index];

          const modal = new ModalBuilder().setCustomId(`cert_modal_${index}`).setTitle(`Edit ${type.name}`);
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('roleid').setLabel('Role ID to grant (leave empty for none)').setStyle(TextInputStyle.Short).setValue(type.role_id || '').setRequired(false)
            ),
          );
          await i.showModal(modal);

          const submitted = await i.awaitModalSubmit({ time: 120_000, filter: m => m.user.id === interaction.user.id }).catch(() => null);
          if (!submitted) return;

          const roleId = submitted.fields.getTextInputValue('roleid').trim() || null;
          config.types[index].role_id = roleId;

          await updateCertConfig({ types: config.types });
          return await submitted.update({ components: [buildContainer(), ...buildRows()], flags: MessageFlags.IsComponentsV2 });
        }
      } catch (err) {
        console.error('Cert Dashboard error:', err.message);
      }
    });

    collector.on('end', (_, reason) => {
      if (reason !== 'done') interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};
