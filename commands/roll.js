const { SlashCommandBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const { FOOTER, COLORS } = require('../config');

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

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.primary)
      .addTextDisplayComponents(td => td.setContent(`# 🎲 Dice Roll — ${notation}`))
      .addTextDisplayComponents(td => td.setContent(`> **Rolls:** ${rolls.join(', ')}`))
      .addTextDisplayComponents(td => td.setContent(`> **Total:** **${total}**${modifier !== 0 ? ` (${modifier > 0 ? '+' : ''}${modifier} modifier)` : ''}`))
      .addTextDisplayComponents(td => td.setContent('-# ' + FOOTER));

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
