const { SlashCommandBuilder, MessageFlags, ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ThumbnailBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getCertifications } = require('../firebase');
const { LOGO, FOOTER, COLORS } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mycertifications')
    .setDescription('View certifications earned by you or another user')
    .addUserOption(opt => opt.setName('user').setDescription('User to check').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') || interaction.user;
    const certs = await getCertifications(target.id);

    if (!certs.length) {
      const container = new ContainerBuilder()
        .setAccentColor(COLORS.primary)
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(
              td => td.setContent(`# 🎓 ${target.displayName || target.username}'s Certifications`),
              td => td.setContent('No certifications earned yet. Attend a training session to get certified!'),
            )
            .setThumbnailAccessory(tb => tb.setURL(target.displayAvatarURL({ dynamic: true }) || LOGO))
        )
        .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));
      return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    let page = 0;
    const total = certs.length;

    function buildContainerWithPage(index) {
      const cert = certs[index];
      const typeEmoji = cert.type.includes('Pilot') ? '👨‍✈️' : cert.type.includes('ATC') ? '🎧' : cert.type.includes('Cabin') ? '🧑‍✈️' : '🛠️';
      const issueDate = new Date(cert.issued_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

      const container = new ContainerBuilder()
        .setAccentColor(COLORS.warning)
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(
              td => td.setContent(`# 🎓 ${target.displayName || target.username}'s Certifications`),
              td => td.setContent(`## ${typeEmoji} ${cert.type}\nCertified pilot of Vietnam Airlines Group | PTFS`),
            )
            .setThumbnailAccessory(tb => tb.setURL(target.displayAvatarURL({ dynamic: true }) || LOGO))
        )
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td => td.setContent([
          `> **📅 Date Issued:** ${issueDate}`,
          `> **👤 Instructor:** ${cert.instructor || 'N/A'}`,
          `> **🔖 Certificate ID:** \`${cert.cert_id}\``,
        ].join('\n')));

      if (cert.notes) {
        container.addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        container.addTextDisplayComponents(td => td.setContent(`> **📝 Notes:** ${cert.notes}`));
      }

      container.addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
      container.addTextDisplayComponents(td => td.setContent(`-# Certificate ${index + 1} of ${total} • ${FOOTER}`));

      return container;
    }

    function buildRow(index) {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cert_prev').setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
        new ButtonBuilder().setCustomId('cert_next').setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(index === total - 1),
      );
    }

    const msg = await interaction.editReply({
      components: [buildContainerWithPage(page), ...(total > 1 ? [buildRow(page)] : [])],
      flags: MessageFlags.IsComponentsV2,
    });

    if (total <= 1) return;

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
      filter: i => i.user.id === interaction.user.id,
    });

    collector.on('collect', async (btn) => {
      try {
        if (btn.customId === 'cert_prev') page = Math.max(0, page - 1);
        if (btn.customId === 'cert_next') page = Math.min(total - 1, page + 1);
        await btn.update({ components: [buildContainerWithPage(page), buildRow(page)], flags: MessageFlags.IsComponentsV2 });
      } catch (err) {
        console.error('Certifications collector error:', err.message);
      }
    });

    collector.on('end', () => { interaction.editReply({ components: [] }).catch(() => {}); });
  },
};
