const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll dice using standard notation (e.g. 2d20, 1d6+5)')
    .addStringOption(opt => opt.setName('dice').setDescription('Dice notation (e.g. 2d6, 1d20+3)').setRequired(true)),

  async execute(interaction) {
    const notation = interaction.options.getString('dice').toLowerCase().replace(/\s/g, '');
    const match = notation.match(/^(\d+)d(\d+)([+-]\d+)?$/);

    if (!match) {
      return interaction.reply({ content: '❌ Invalid format. Use notation like `2d20` or `1d6+5`.', ephemeral: true });
    }

    const [, countStr, sidesStr, modifierStr] = match;
    const count = parseInt(countStr);
    const sides = parseInt(sidesStr);
    const modifier = modifierStr ? parseInt(modifierStr) : 0;

    if (count > 100 || sides > 1000) {
      return interaction.reply({ content: '❌ Too many dice or sides! Max 100 dice, 1000 sides.', ephemeral: true });
    }

    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
    const total = rolls.reduce((a, b) => a + b, 0) + modifier;

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x007B8A)
        .setTitle(`🎲 Dice Roll — ${notation}`)
        .addFields(
          { name: 'Rolls', value: rolls.join(', '), inline: false },
          { name: 'Total', value: `**${total}**${modifier !== 0 ? ` (${modifier > 0 ? '+' : ''}${modifier} modifier)` : ''}`, inline: false },
        )
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })],
    });
  },
};
