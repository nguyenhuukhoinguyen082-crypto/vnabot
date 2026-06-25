const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getEvents, deleteEvent } = require('../firebase');
require('dotenv').config();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deleteevent')
    .setDescription('[STAFF] Delete an event')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt => opt.setName('name').setDescription('Event name or ID').setRequired(true))
    .addBooleanOption(opt => opt.setName('confirm').setDescription('Confirm deletion').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
    }

    const query = interaction.options.getString('name');
    const confirm = interaction.options.getBoolean('confirm');

    if (!confirm) return interaction.editReply({ content: '⚠️ Set `confirm` to `true` to proceed.' });

    const events = await getEvents();
    const event = events.find(e =>
      e.id === query ||
      (e.name || '').toLowerCase().includes(query.toLowerCase())
    );

    if (!event) {
      const list = events.map(e => `• **${e.name}** — \`${e.id}\``).join('\n');
      return interaction.editReply({ content: `❌ Event not found.\n\nAvailable events:\n${list || 'None'}` });
    }

    // Delete Discord scheduled event if it exists
    if (event.discord_event_id) {
      try {
        const discordEvent = await interaction.guild.scheduledEvents.fetch(event.discord_event_id).catch(() => null);
        if (discordEvent) await discordEvent.delete();
      } catch (err) {
        console.error('Failed to delete Discord event:', err.message);
      }
    }

    await deleteEvent(event.id);

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🗑️ Event Deleted')
      .addFields(
        { name: '📅 Name', value: event.name || 'N/A', inline: true },
        { name: '🎭 Type', value: event.event_type || 'N/A', inline: true },
        { name: '🔗 Discord Event', value: event.discord_event_id ? '✅ Also deleted from Discord' : 'N/A', inline: false },
      )
      .setFooter({ text: `Deleted by ${interaction.user.username} • Vietnam Airlines Group | PTFS` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
