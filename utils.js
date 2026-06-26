const { MessageFlags } = require('discord.js');
const { LOGO, FOOTER, COLORS } = require('./config');
const v2 = require('./utils/v2');

function staffCheck(interaction) {
  const staffRoleId = process.env.STAFF_ROLE_ID;
  if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
    return false;
  }
  return true;
}

function ictToTimestamp(dateStr, timeStr) {
  try {
    const [day, month, year] = dateStr.split('/').map(Number);
    const [hour, min] = timeStr.split(':').map(Number);
    return Date.UTC(year, month - 1, day, hour - 7, min);
  } catch {
    return null;
  }
}

function buildErrorEmbed(message) {
  const { ContainerBuilder } = require('discord.js');
  return new ContainerBuilder()
    .setAccentColor(COLORS.danger)
    .addTextDisplayComponents(td => td.setContent(`❌ ${message}`))
    .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));
}

function buildSuccessEmbed(title, description) {
  const { ContainerBuilder } = require('discord.js');
  return new ContainerBuilder()
    .setAccentColor(COLORS.success)
    .addTextDisplayComponents(td => td.setContent(`✅ ${title}`))
    .addTextDisplayComponents(td => td.setContent(description))
    .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`));
}

function detectAirlineKey(flightNumber) {
  if (flightNumber.startsWith('BL')) return 'pacific';
  if (flightNumber.startsWith('OV')) return 'vasco';
  return 'vna';
}

module.exports = { staffCheck, ictToTimestamp, buildErrorEmbed, buildSuccessEmbed, detectAirlineKey };
