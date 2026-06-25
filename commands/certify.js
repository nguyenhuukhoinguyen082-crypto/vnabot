const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { issueCertification, getCertConfig } = require('../firebase');
require('dotenv').config();

const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

// A decorative gold-bordered "wax seal" style emoji set used to frame the cert
const CERT_BORDER = '✦ ─────────────────────────── ✦';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('certify')
    .setDescription('[STAFF] Issue a certification to a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(opt => opt.setName('user').setDescription('User to certify').setRequired(true))
    .addStringOption(opt => opt.setName('certification').setDescription('Certification type').setRequired(true)
      .addChoices(
        { name: '👨‍✈️ Pilot Certification', value: 'Pilot Certification' },
        { name: '🗼 ATC Certification', value: 'ATC Certification' },
        { name: '🧑‍✈️ Cabin Crew Certification', value: 'Cabin Crew Certification' },
        { name: '🛠️ Ground Crew Certification', value: 'Ground Crew Certification' },
      ))
    .addStringOption(opt => opt.setName('instructor').setDescription('Instructor / examiner name').setRequired(true))
    .addStringOption(opt => opt.setName('notes').setDescription('Additional notes (e.g. score, aircraft type)').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply();

    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
    }

    const target = interaction.options.getUser('user');
    const certType = interaction.options.getString('certification');
    const instructor = interaction.options.getString('instructor');
    const notes = interaction.options.getString('notes') || null;

    const { certId } = await issueCertification({
      discord_id: target.id,
      username: target.username,
      type: certType,
      instructor,
      notes,
      issued_by: interaction.user.id,
    });

    // Grant role if configured
    const config = await getCertConfig();
    const typeConfig = config.types.find(t => t.name === certType);
    let roleGranted = false;

    if (typeConfig?.role_id) {
      try {
        const member = await interaction.guild.members.fetch(target.id);
        await member.roles.add(typeConfig.role_id);
        roleGranted = true;
      } catch (err) {
        console.error('Cert role grant failed:', err.message);
      }
    }

    const typeEmoji = certType.includes('Pilot') ? '👨‍✈️' : certType.includes('ATC') ? '🗼' : certType.includes('Cabin') ? '🧑‍✈️' : '🛠️';
    const issueDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    // ── The certificate-style embed ─────────────────────────────────────────────
    const certEmbed = new EmbedBuilder()
      .setColor(0xC4972A) // Gold
      .setAuthor({ name: 'Vietnam Airlines Group | PTFS — Official Certification', iconURL: LOGO })
      .setTitle(`${CERT_BORDER}`)
      .setDescription([
        `## 🏆 Certificate of Achievement`,
        ``,
        `This certifies that`,
        ``,
        `# ${target.displayName || target.username}`,
        ``,
        `has successfully completed all requirements for`,
        ``,
        `### ${typeEmoji} ${certType}`,
        ``,
        `and is hereby certified by Vietnam Airlines Group | PTFS.`,
        ``,
        CERT_BORDER,
      ].join('\n'))
      .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '📅 Date Issued', value: issueDate, inline: true },
        { name: '👤 Instructor', value: instructor, inline: true },
        { name: '🔖 Certificate ID', value: `\`${certId}\``, inline: true },
      )
      .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao • This certificate is valid indefinitely' })
      .setTimestamp();

    if (notes) {
      certEmbed.addFields({ name: '📝 Notes', value: notes, inline: false });
    }
    if (roleGranted) {
      certEmbed.addFields({ name: '🎖️ Role Granted', value: `<@&${typeConfig.role_id}>`, inline: false });
    }

    await interaction.editReply({
      content: `🎉 Congratulations <@${target.id}>! You've earned a new certification!`,
      embeds: [certEmbed],
    });
  },
};
