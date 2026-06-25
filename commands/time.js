const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x007B8A)
        .setTitle('🕐 World Clock')
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
        .setTimestamp()],
    });
  },
};
