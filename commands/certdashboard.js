const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { getCertConfig, updateCertConfig } = require('../firebase');
require('dotenv').config();

const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('certdashboard')
    .setDescription('[STAFF] Configure which role each certification grants')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.editReply({ content: '❌ You do not have permission.' });
    }

    let config = await getCertConfig();

    function buildEmbed() {
      const lines = config.types.map(t =>
        `🎓 **${t.name}** ${t.role_id ? `→ <@&${t.role_id}>` : '(no role set)'}`
      ).join('\n');

      return new EmbedBuilder()
        .setColor(0xC4972A)
        .setTitle('🎓 Certification Dashboard')
        .setThumbnail(LOGO)
        .setDescription('Configure which Discord role each certification type grants when issued.')
        .addFields({ name: '🎖️ Certification Types', value: lines, inline: false })
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Click a button to set its role' })
        .setTimestamp();
    }

    function buildRows() {
      const buttons = config.types.map((t, i) =>
        new ButtonBuilder().setCustomId(`eco_certtype_${i}`).setLabel(`Edit ${t.name}`).setStyle(ButtonStyle.Primary)
      );
      const rows = [];
      for (let i = 0; i < buttons.length; i += 4) {
        rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 4)));
      }
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('eco_certdone').setLabel('Done ✅').setStyle(ButtonStyle.Success),
      ));
      return rows.slice(0, 5);
    }

    const msg = await interaction.editReply({ embeds: [buildEmbed()], components: buildRows() });

    const collector = msg.createMessageComponentCollector({ time: 300_000, filter: i => i.user.id === interaction.user.id });

    collector.on('collect', async (i) => {
      try {
        const id = i.customId;

        if (id === 'eco_certdone') {
          collector.stop('done');
          return await i.update({ embeds: [buildEmbed().setTitle('✅ Certification Config Saved').setColor(0x00B050)], components: [] });
        }

        if (id.startsWith('eco_certtype_')) {
          const index = parseInt(id.replace('eco_certtype_', ''));
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
          return await submitted.update({ embeds: [buildEmbed()], components: buildRows() });
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
