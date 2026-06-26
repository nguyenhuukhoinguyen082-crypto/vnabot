const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ThumbnailBuilder } = require('discord.js');
const { createTraining, getTrainings, getTraining, deleteTraining, updateTraining } = require('../firebase');
const { LOGO, FOOTER, COLORS } = require('../config');
const utils = require('../utils');

function ictToTimestamp(dateStr, timeStr) {
  try {
    const [day, month, year] = dateStr.split('/').map(Number);
    const [hour, min] = timeStr.split(':').map(Number);
    return Date.UTC(year, month - 1, day, hour - 7, min);
  } catch { return null; }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('training')
    .setDescription('Vietnam Airlines Group | PTFS training sessions')
    .addSubcommand(sub =>
      sub.setName('schedule')
        .setDescription('[STAFF] Schedule a new training session')
        .addStringOption(opt => opt.setName('type').setDescription('Training type').setRequired(true)
          .addChoices(
            { name: '👨‍✈️ Pilot Training', value: 'Pilot Training' },
            { name: '🎧 ATC Training', value: 'ATC Training' },
            { name: '🧑‍✈️ Cabin Crew Training', value: 'Cabin Crew Training' },
            { name: '🛠️ Ground Crew Training', value: 'Ground Crew Training' },
          ))
        .addStringOption(opt => opt.setName('date').setDescription('Date (dd/mm/yyyy)').setRequired(true))
        .addStringOption(opt => opt.setName('time').setDescription('Time ICT (HH:mm)').setRequired(true))
        .addStringOption(opt => opt.setName('host').setDescription('Instructor name').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('Training description').setRequired(false))
        .addStringOption(opt => opt.setName('channel').setDescription('Channel ID to announce in (leave empty for current)').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('View all upcoming training sessions'))
    .addSubcommand(sub =>
      sub.setName('cancel')
        .setDescription('[STAFF] Cancel a training session')
        .addStringOption(opt => opt.setName('id').setDescription('Training ID').setRequired(true))
        .addBooleanOption(opt => opt.setName('confirm').setDescription('Confirm cancellation').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'schedule') {
      await interaction.deferReply({ ephemeral: true });
      if (!utils.staffCheck(interaction)) {
        return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
      }

      const type = interaction.options.getString('type');
      const date = interaction.options.getString('date');
      const time = interaction.options.getString('time');
      const host = interaction.options.getString('host');
      const description = interaction.options.getString('description') || `Join us for ${type} hosted by ${host}!`;
      const channelId = interaction.options.getString('channel');

      const ts = ictToTimestamp(date, time);
      if (!ts) return interaction.editReply({ content: '❌ Invalid date/time. Use dd/mm/yyyy and HH:mm.' });

      const id = await createTraining({ type, date, time, timestamp: ts, host, description });

      const typeEmoji = type.includes('Pilot') ? '👨‍✈️' : type.includes('ATC') ? '🎧' : type.includes('Cabin') ? '🧑‍✈️' : '🛠️';

      const trainingContainer = new ContainerBuilder()
        .setAccentColor(COLORS.primary)
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(
              td => td.setContent(`# ${typeEmoji} Training Scheduled — ${type}`),
              td => td.setContent(description),
              td => td.setContent([
                `> **🕐 Date & Time:** <t:${Math.floor(ts / 1000)}:F>`,
                `> **👤 Instructor:** ${host}`,
              ].join('\n')),
            )
            .setThumbnailAccessory(tb => tb.setURL(LOGO))
        )
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td => td.setContent(`> **🔑 Training ID:** \`${id}\``))
        .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

      let targetChannel;
      if (channelId) {
        targetChannel = await interaction.client.channels.fetch(channelId).catch(() => null);
        if (!targetChannel) return interaction.editReply({ content: `❌ Channel \`${channelId}\` not found.` });
      } else {
        targetChannel = interaction.channel;
      }

      await targetChannel.send({ components: [trainingContainer], flags: MessageFlags.IsComponentsV2 });
      return interaction.editReply({ content: `✅ Training scheduled and announced in <#${targetChannel.id}>!` });
    }

    if (sub === 'list') {
      await interaction.deferReply();
      const trainings = (await getTrainings()).filter(t => t.status !== 'cancelled');

      if (!trainings.length) return interaction.editReply({ content: '📚 No training sessions scheduled right now.' });

      const container = new ContainerBuilder()
        .setAccentColor(COLORS.primary)
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(
              td => td.setContent('# 📚 Vietnam Airlines Group | PTFS — Training Sessions'),
            )
            .setThumbnailAccessory(tb => tb.setURL(LOGO))
        )
        .addSeparatorComponents(sep => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small));

      for (const t of trainings) {
        const typeEmoji = t.type.includes('Pilot') ? '👨‍✈️' : t.type.includes('ATC') ? '🎧' : t.type.includes('Cabin') ? '🧑‍✈️' : '🛠️';
        container.addTextDisplayComponents(td => td.setContent([
          `> **${typeEmoji} ${t.type}**`,
          `> 🕐 ${t.timestamp ? `<t:${Math.floor(t.timestamp / 1000)}:F>` : `${t.date} ${t.time}`}`,
          `> 👤 **Instructor:** ${t.host}`,
          `> 🔑 **ID:** \`${t.id}\``,
        ].join('\n')));
        container.addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small));
      }

      container.addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

      return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    if (sub === 'cancel') {
      await interaction.deferReply({ ephemeral: true });
      if (!utils.staffCheck(interaction)) {
        return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
      }

      const id = interaction.options.getString('id');
      const confirm = interaction.options.getBoolean('confirm');
      if (!confirm) return interaction.editReply({ content: '⚠️ Set `confirm` to `true` to proceed.' });

      const training = await getTraining(id);
      if (!training) return interaction.editReply({ content: `❌ Training \`${id}\` not found.` });

      await deleteTraining(id);

      const cancelContainer = new ContainerBuilder()
        .setAccentColor(COLORS.danger)
        .addTextDisplayComponents(
          td => td.setContent('# ❌ Training Cancelled'),
          td => td.setContent(`> **📚 Type:** ${training.type}`),
        )
        .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));

      return interaction.editReply({
        components: [cancelContainer],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};
