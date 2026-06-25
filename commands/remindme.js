const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

function parseDuration(input) {
  const match = input.match(/^(\d+)\s*(s|sec|m|min|h|hr|hour|d|day)s?$/i);
  if (!match) return null;
  const amount = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers = {
    s: 1000, sec: 1000,
    m: 60000, min: 60000,
    h: 3600000, hr: 3600000, hour: 3600000,
    d: 86400000, day: 86400000,
  };

  return amount * (multipliers[unit] || 0);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remindme')
    .setDescription('Set a personal reminder')
    .addStringOption(opt => opt.setName('time').setDescription('When (e.g. 10m, 2h, 1d, 30s)').setRequired(true))
    .addStringOption(opt => opt.setName('message').setDescription('What to remind you about').setRequired(true)),

  async execute(interaction) {
    const timeInput = interaction.options.getString('time');
    const message = interaction.options.getString('message');

    const ms = parseDuration(timeInput);
    if (!ms || ms <= 0) {
      return interaction.reply({
        content: '❌ Invalid time format. Use formats like `10m`, `2h`, `1d`, or `30s`.',
        ephemeral: true,
      });
    }

    if (ms > 7 * 86400000) {
      return interaction.reply({ content: '❌ Maximum reminder time is 7 days.', ephemeral: true });
    }

    const triggerAt = Date.now() + ms;

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x00B050)
        .setTitle('⏰ Reminder Set!')
        .setThumbnail(LOGO)
        .setDescription(`I'll remind you: **${message}**`)
        .addFields({ name: '🕐 When', value: `<t:${Math.floor(triggerAt / 1000)}:R> (<t:${Math.floor(triggerAt / 1000)}:F>)`, inline: false })
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })],
      ephemeral: true,
    });

    setTimeout(async () => {
      try {
        const embed = new EmbedBuilder()
          .setColor(0x007B8A)
          .setTitle('⏰ Reminder!')
          .setThumbnail(LOGO)
          .setDescription(message)
          .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
          .setTimestamp();

        await interaction.user.send({ embeds: [embed] }).catch(async () => {
          // DM failed (user has DMs off) — fallback to the channel
          await interaction.followUp({ content: `<@${interaction.user.id}> ⏰ **Reminder:** ${message}`, ephemeral: false }).catch(() => {});
        });
      } catch (err) {
        console.error('Reminder delivery failed:', err.message);
      }
    }, ms);
  },
};
