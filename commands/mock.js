const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mock')
    .setDescription('cOnVeRtS yOuR tExT tO sPoNgEbOb CaSe')
    .addStringOption(opt => opt.setName('text').setDescription('Text to mock').setRequired(true)),

  async execute(interaction) {
    const text = interaction.options.getString('text');
    let mocked = '';
    let upper = false;
    for (const char of text) {
      if (/[a-zA-Z]/.test(char)) {
        mocked += upper ? char.toUpperCase() : char.toLowerCase();
        upper = !upper;
      } else {
        mocked += char;
      }
    }
    await interaction.reply({ content: mocked });
  },
};
