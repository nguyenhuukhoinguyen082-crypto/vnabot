const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ContainerBuilder, TextDisplayBuilder } = require('discord.js');
const { db } = require('../firebase');
const { ref, get, remove } = require('firebase/database');
const { FOOTER, COLORS } = require('../config');
const utils = require('../utils');
const CONFIRM_CODE = 'CONFIRM';

const TABLES = {
  all: ['flights', 'bookings', 'partnerships', 'events', 'deals', 'fleet', 'routes', 'destinations', 'economy', 'lotus_miles', 'career', 'certifications', 'trainings', 'suggestions', 'applications', 'application_types'],
  flights: ['flights'],
  bookings: ['bookings'],
  partnerships: ['partnerships'],
  events: ['events'],
  deals: ['deals'],
  fleet: ['fleet'],
  routes: ['routes'],
  destinations: ['destinations'],
  economy: ['economy'],
  miles: ['lotus_miles'],
  career: ['career'],
  certifications: ['certifications'],
  trainings: ['trainings'],
  suggestions: ['suggestions'],
  applications: ['applications', 'application_types'],
};

async function countAndClear(table) {
  const snap = await get(ref(db, table));
  if (!snap.exists()) return 0;
  const count = Object.keys(snap.val()).length;
  await remove(ref(db, table));
  return count;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cleardata')
    .setDescription('[STAFF] Permanently wipe data from the database')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt => opt.setName('category').setDescription('What to wipe').setRequired(true)
      .addChoices(
        { name: '⚠️ ALL DATA', value: 'all' },
        { name: '✈️ Flights', value: 'flights' },
        { name: '🎫 Bookings', value: 'bookings' },
        { name: '🤝 Partnerships', value: 'partnerships' },
        { name: '📅 Events', value: 'events' },
        { name: '🏷️ Deals', value: 'deals' },
        { name: '🛩️ Fleet', value: 'fleet' },
        { name: '�- �️ Routes', value: 'routes' },
        { name: '🌍 Destinations', value: 'destinations' },
        { name: '💰 Economy', value: 'economy' },
        { name: '✈️ LotusMiles', value: 'miles' },
        { name: '🎖️ Career', value: 'career' },
        { name: '🎓 Certifications', value: 'certifications' },
        { name: '📚 Trainings', value: 'trainings' },
        { name: '💡 Suggestions', value: 'suggestions' },
        { name: '📋 Applications', value: 'applications' },
      ))
    .addStringOption(opt => opt.setName('confirmcode').setDescription(`Type "${CONFIRM_CODE}" to confirm`).setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!utils.staffCheck(interaction)) {
      return interaction.editReply({ content: '❌ You do not have permission.' });
    }

    const category = interaction.options.getString('category');
    const code = interaction.options.getString('confirmcode');

    if (code !== CONFIRM_CODE) {
      return interaction.editReply({
        content: `❌ Wrong confirmation code. Type **${CONFIRM_CODE}** exactly to proceed. This action is permanent.`,
      });
    }

    const tables = TABLES[category];
    if (!tables) return interaction.editReply({ content: '❌ Unknown category.' });

    const results = [];
    for (const table of tables) {
      const count = await countAndClear(table);
      results.push({ table, count });
    }

    const totalDeleted = results.reduce((sum, r) => sum + r.count, 0);

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.danger)
      .addTextDisplayComponents(
        td => td.setContent(`# Data Cleared — ${category === 'all' ? 'ALL DATA' : category}`),
        td => td.setContent(`**${totalDeleted}** total record(s) permanently deleted.`),
        ...results.map(r => td => td.setContent(`> **${r.table}:** ${r.count} record(s) deleted`)),
        td => td.setContent(`-# Cleared by ${interaction.user.username} • ${FOOTER}`),
      );

    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
