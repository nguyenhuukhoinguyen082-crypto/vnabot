const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getCertifications } = require('../firebase');

const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

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
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x007B8A)
          .setTitle(`🎓 ${target.displayName || target.username}'s Certifications`)
          .setDescription('No certifications earned yet. Attend a training session to get certified!')
          .setThumbnail(target.displayAvatarURL({ dynamic: true }) || LOGO)
          .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })],
      });
    }

    let page = 0;
    const total = certs.length;

    function buildEmbed(index) {
      const cert = certs[index];
      const typeEmoji = cert.type.includes('Pilot') ? '👨‍✈️' : cert.type.includes('ATC') ? '🗼' : cert.type.includes('Cabin') ? '🧑‍✈️' : '🛠️';
      const issueDate = new Date(cert.issued_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

      const embed = new EmbedBuilder()
        .setColor(0xC4972A)
        .setTitle(`🎓 ${target.displayName || target.username}'s Certifications`)
        .setDescription([
          `## ${typeEmoji} ${cert.type}`,
          `Certified pilot of Vietnam Airlines Group | PTFS`,
        ].join('\n'))
        .setThumbnail(target.displayAvatarURL({ dynamic: true }) || LOGO)
        .addFields(
          { name: '📅 Date Issued', value: issueDate, inline: true },
          { name: '👤 Instructor', value: cert.instructor || 'N/A', inline: true },
          { name: '🔖 Certificate ID', value: `\`${cert.cert_id}\``, inline: true },
        )
        .setFooter({ text: `Certificate ${index + 1} of ${total} • Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao` })
        .setTimestamp();

      if (cert.notes) embed.addFields({ name: '📝 Notes', value: cert.notes, inline: false });
      return embed;
    }

    function buildRow(index) {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cert_prev').setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
        new ButtonBuilder().setCustomId('cert_next').setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(index === total - 1),
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
        if (btn.customId === 'cert_prev') page = Math.max(0, page - 1);
        if (btn.customId === 'cert_next') page = Math.min(total - 1, page + 1);
        await btn.update({ embeds: [buildEmbed(page)], components: [buildRow(page)] });
      } catch (err) {
        console.error('Certifications collector error:', err.message);
      }
    });

    collector.on('end', () => { interaction.editReply({ components: [] }).catch(() => {}); });
  },
};
