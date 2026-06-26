const { SlashCommandBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const { FOOTER, COLORS } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('calculate')
    .setDescription('Evaluate a mathematical expression')
    .addStringOption(opt => opt.setName('expression').setDescription('e.g. 5 * (3 + 2) / 4').setRequired(true)),

  async execute(interaction) {
    const expr = interaction.options.getString('expression');

    if (!/^[0-9+\-*/().\s%]+$/.test(expr)) {
      return interaction.reply({ content: '❌ Invalid expression. Only numbers and + - * / ( ) % are allowed.', ephemeral: true });
    }

    try {
      const result = Function(`'use strict'; return (${expr})`)();
      if (!isFinite(result)) throw new Error('Invalid result');

      const container = new ContainerBuilder()
        .setAccentColor(COLORS.primary)
        .addTextDisplayComponents(td => td.setContent('# 🧮 Calculator'))
        .addTextDisplayComponents(td => td.setContent(`> **Expression:** \`${expr}\``))
        .addTextDisplayComponents(td => td.setContent(`> **Result:** **${result}**`))
        .addTextDisplayComponents(td => td.setContent('-# ' + FOOTER));

      await interaction.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch {
      await interaction.reply({ content: '❌ Could not evaluate that expression.', ephemeral: true });
    }
  },
};
