const { MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getApplication, updateApplication, getApplicationType } = require('../firebase');
const { staffCheck } = require('../utils');
const { LOGO, FOOTER, COLORS } = require('../config');

async function handleApplication(interaction) {
  const id = interaction.customId;
  if (!id.startsWith('appaccept_') && !id.startsWith('appreject_')) return false;

  if (!staffCheck(interaction)) {
    await interaction.reply({ content: '> Only staff can review applications.', ephemeral: true });
    return true;
  }

  const isAccept = id.startsWith('appaccept_');
  const appId = id.replace('appaccept_', '').replace('appreject_', '');

  const app = await getApplication(appId);
  if (!app) {
    await interaction.reply({ content: '> Application not found.', ephemeral: true });
    return true;
  }
  if (app.status !== 'pending') {
    await interaction.reply({ content: `> This application is already **${app.status}**.`, ephemeral: true });
    return true;
  }

  if (isAccept) {
    await handleAccept(interaction, app, appId);
  } else {
    await handleReject(interaction, app, appId);
  }
  return true;
}

async function handleAccept(interaction, app, appId) {
  await updateApplication(appId, { status: 'accepted', reviewed_by: interaction.user.id, reviewed_at: Date.now() });

  const appType = await getApplicationType(app.type_id);
  let roleGranted = false;
  if (appType?.role_id) {
    try {
      const member = await interaction.guild.members.fetch(app.discord_id).catch(() => null);
      if (member) { await member.roles.add(appType.role_id); roleGranted = true; }
    } catch (err) { console.error('Role grant failed:', err.message); }
  }

  const accepted = new ContainerBuilder()
    .setAccentColor(COLORS.success)
    .addTextDisplayComponents(td => td.setContent(`# ✅ ACCEPTED - ${app.type_title}`))
    .addTextDisplayComponents(td => td.setContent(`> **Reviewed By:** <@${interaction.user.id}>`))
    .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

  await interaction.update({ components: [accepted] });

  try {
    const user = await interaction.client.users.fetch(app.discord_id);
    await user.send({
      components: [new ContainerBuilder()
        .setAccentColor(COLORS.success)
        .addTextDisplayComponents(td => td.setContent('# ✅ Application Accepted!'))
        .addTextDisplayComponents(td => td.setContent(`Congratulations! Your application for **${app.type_title}** at **Vietnam Airlines Group | PTFS** has been **accepted**!`))
        .addTextDisplayComponents(td => td.setContent(`> **Role Granted:** ${roleGranted ? `<@&${appType.role_id}>` : 'Staff will assign your role shortly.'}`))
        .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`))],
    }).catch(() => {});
  } catch {}
}

async function handleReject(interaction, app, appId) {
  const modal = new ModalBuilder().setCustomId(`appreject_reason_${appId}`).setTitle('Rejection Reason');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('reason').setLabel('Reason for rejection').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)
    )
  );
  await interaction.showModal(modal);

  const submitted = await interaction.awaitModalSubmit({
    time: 120_000,
    filter: m => m.user.id === interaction.user.id && m.customId === `appreject_reason_${appId}`,
  }).catch(() => null);

  if (!submitted) return;
  const reason = submitted.fields.getTextInputValue('reason');

  await updateApplication(appId, { status: 'rejected', reviewed_by: interaction.user.id, reviewed_at: Date.now(), rejection_reason: reason });

  const rejected = new ContainerBuilder()
    .setAccentColor(COLORS.danger)
    .addTextDisplayComponents(td => td.setContent(`# ❌ REJECTED - ${app.type_title}`))
    .addTextDisplayComponents(td => td.setContent(`> **Reviewed By:** <@${interaction.user.id}>`))
    .addTextDisplayComponents(td => td.setContent(`> **Reason:** ${reason}`))
    .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

  await submitted.update({ components: [rejected] });

  try {
    const user = await interaction.client.users.fetch(app.discord_id);
    await user.send({
      components: [new ContainerBuilder()
        .setAccentColor(COLORS.danger)
        .addTextDisplayComponents(td => td.setContent('# ❌ Application Not Successful'))
        .addTextDisplayComponents(td => td.setContent(`Thank you for applying for **${app.type_title}** at **Vietnam Airlines Group | PTFS**.\n\nUnfortunately, your application was not successful at this time.`))
        .addTextDisplayComponents(td => td.setContent(`> **Reason:** ${reason}`))
        .addTextDisplayComponents(td => td.setContent(`> **Re-apply:** You may re-apply after 24 hours.`))
        .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`))],
    }).catch(() => {});
  } catch {}
}

module.exports = { handleApplication };
