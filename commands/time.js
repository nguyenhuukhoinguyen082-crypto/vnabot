const { SlashCommandBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const { FOOTER, COLORS } = require('../config');

const TIMEZONES = [
  { name: '🇻🇳 Vietnam (ICT)', tz: 'Asia/Ho_Chi_Minh' },
  { name: '🇬🇧 London (GMT/BST)', tz: 'Europe/London' },
  { name: '🇺🇸 New York (ET)', tz: 'America/New_York' },
  { name: '🇺🇸 Los Angeles (PT)', tz: 'America/Los_Angeles' },
  { name: '🇯🇵 Tokyo (JST)', tz: 'Asia/Tokyo' },
  { name: '🇦🇺 Sydney (AEST)', tz: 'Australia/Sydney' },
  { name: '🇦🇪 Dubai (GST)', tz: 'Asia/Dubai' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('time')
    .setDescription('Get the current time in different timezones'),

  async execute(interaction) {
    const now = new Date();
    const lines = TIMEZONES.map(({ name, tz }) => {
      const formatted = now.toLocaleString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
      return `${name}: **${formatted}**`;
    });

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.primary)
      .addTextDisplayComponents(td => td.setContent('# 🕐 World Clock'))
      .addTextDisplayComponents(td => td.setContent(lines.join('\n')))
      .addTextDisplayComponents(td => td.setContent('-# ' + FOOTER));

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
