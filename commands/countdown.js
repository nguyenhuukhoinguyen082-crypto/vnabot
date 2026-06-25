const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('countdown')
    .setDescription('Start a countdown timer')
    .addStringOption(opt => opt.setName('title').setDescription('What is this countdown for?').setRequired(true))
    .addStringOption(opt => opt.setName('date').setDescription('Target date (dd/mm/yyyy)').setRequired(true))
    .addStringOption(opt => opt.setName('time').setDescription('Target time ICT (HH:mm)').setRequired(true)),

  async execute(interaction) {
    const title = interaction.options.getString('title');
    const date = interaction.options.getString('date');
    const time = interaction.options.getString('time');

    let ts;
    try {
      const [day, month, year] = date.split('/').map(Number);
      const [hour, min] = time.split(':').map(Number);
      ts = Date.UTC(year, month - 1, day, hour - 7, min);
    } catch { ts = null; }

    if (!ts || isNaN(ts)) {
      return interaction.reply({ content: '❌ Invalid date/time. Use dd/mm/yyyy and HH:mm.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x007B8A)
      .setTitle(`⏳ ${title}`)
      .setDescription(`**Target:** <t:${Math.floor(ts / 1000)}:F>\n**Countdown:** <t:${Math.floor(ts / 1000)}:R>`)
      .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
