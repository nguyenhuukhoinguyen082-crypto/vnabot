const {
  SlashCommandBuilder, MessageFlags, PermissionFlagsBits,
  ContainerBuilder, SectionBuilder,
  TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
} = require('discord.js');
const { issueCertification, getCertConfig } = require('../firebase');
const { LOGO, FOOTER, COLORS } = require('../config');
const utils = require('../utils');

const CERT_BORDER = '✦ ─────────────────────────── ✦';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('certify')
    .setDescription('[STAFF] Issue a certification to a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(opt => opt.setName('user').setDescription('User to certify').setRequired(true))
    .addStringOption(opt => opt.setName('certification').setDescription('Certification type').setRequired(true)
      .addChoices(
        { name: 'Pilot Certification', value: 'Pilot Certification' },
        { name: 'ATC Certification', value: 'ATC Certification' },
        { name: 'Cabin Crew Certification', value: 'Cabin Crew Certification' },
        { name: 'Ground Crew Certification', value: 'Ground Crew Certification' },
      ))
    .addStringOption(opt => opt.setName('instructor').setDescription('Instructor / examiner name').setRequired(true))
    .addStringOption(opt => opt.setName('notes').setDescription('Additional notes (e.g. score, aircraft type)').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply();

    if (!utils.staffCheck(interaction)) {
      return interaction.editReply({ content: '> You do not have permission to use this command.' });
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

    const typeEmoji = certType.includes('Pilot') ? '👨\u200d✈️' : certType.includes('ATC') ? '�- �' : certType.includes('Cabin') ? '🧑\u200d✈️' : '🛠️';
    const issueDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.warning)
      .addSectionComponents(section =>
        section
          .addTextDisplayComponents(td => td.setContent('**Vietnam Airlines Group | PTFS — Official Certification**'))
          .setThumbnailAccessory(thumb => thumb.setURL(target.displayAvatarURL({ dynamic: true, size: 256 })))
      )
      .addTextDisplayComponents(td => td.setContent(CERT_BORDER))
      .addTextDisplayComponents(td => td.setContent([
        '## Certificate of Achievement',
        '',
        'This certifies that',
        '',
        `# ${target.displayName || target.username}`,
        '',
        'has successfully completed all requirements for',
        '',
        `### ${typeEmoji} ${certType}`,
        '',
        'and is hereby certified by Vietnam Airlines Group | PTFS.',
        '',
        CERT_BORDER,
      ].join('\n')))
      .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(td => td.setContent(
        `> **Date Issued:** ${issueDate}\n` +
        `> **Instructor:** ${instructor}\n` +
        `> **Certificate ID:** \`${certId}\``
      ));

    if (notes) {
      container.addTextDisplayComponents(td => td.setContent(`> **Notes:** ${notes}`));
    }
    if (roleGranted) {
      container.addTextDisplayComponents(td => td.setContent(`> **Role Granted:** <@&${typeConfig.role_id}>`));
    }

    container.addTextDisplayComponents(td => td.setContent(`-# ${FOOTER} • This certificate is valid indefinitely`));

    await interaction.editReply({
      content: `Congratulations <@${target.id}>, you've earned a new certification!`,
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
