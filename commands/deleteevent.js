const { SlashCommandBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, PermissionFlagsBits } = require('discord.js');
const { getEvents, deleteEvent } = require('../firebase');
const { FOOTER, COLORS } = require('../config');
const utils = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deleteevent')
    .setDescription('[STAFF] Delete an event')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt => opt.setName('name').setDescription('Event name or ID').setRequired(true))
    .addBooleanOption(opt => opt.setName('confirm').setDescription('Confirm deletion').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!utils.staffCheck(interaction)) {
      return interaction.editReply({ content: '> You do not have permission to use this command.' });
    }

    const query = interaction.options.getString('name');
    const confirm = interaction.options.getBoolean('confirm');

    if (!confirm) return interaction.editReply({ content: '> Set `confirm` to `true` to proceed.' });

    const events = await getEvents();
    const event = events.find(e =>
      e.id === query ||
      (e.name || '').toLowerCase().includes(query.toLowerCase())
    );

    if (!event) {
      const list = events.map(e => `- **${e.name}** — \`${e.id}\``).join('\n');
      return interaction.editReply({ content: `❌ Event not found.\n\nAvailable events:\n${list || 'None'}` });
    }

    if (event.discord_event_id) {
      try {
        const discordEvent = await interaction.guild.scheduledEvents.fetch(event.discord_event_id).catch(() => null);
        if (discordEvent) await discordEvent.delete();
      } catch (err) {
        console.error('Failed to delete Discord event:', err.message);
      }
    }

    await deleteEvent(event.id);

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.danger)
      .addTextDisplayComponents(td => td.setContent('# Event Deleted'))
      .addTextDisplayComponents(td => td.setContent(`> **Name:** \`${event.name || 'N/A'}\``))
      .addTextDisplayComponents(td => td.setContent(`> **Type:** \`${event.event_type || 'N/A'}\``))
      .addTextDisplayComponents(td => td.setContent(`> **Discord Event:** ${event.discord_event_id ? 'Also deleted from Discord' : 'N/A'}`))
      .addTextDisplayComponents(td => td.setContent('-# Deleted by ' + interaction.user.username + ' • ' + FOOTER));

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
