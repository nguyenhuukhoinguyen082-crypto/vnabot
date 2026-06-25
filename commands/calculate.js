const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('calculate')
    .setDescription('Evaluate a mathematical expression')
    .addStringOption(opt => opt.setName('expression').setDescription('e.g. 5 * (3 + 2) / 4').setRequired(true)),

  async execute(interaction) {
    const expr = interaction.options.getString('expression');

    // Only allow safe math characters
    if (!/^[0-9+\-*/().\s%]+$/.test(expr)) {
      return interaction.reply({ content: '❌ Invalid expression. Only numbers and + - * / ( ) % are allowed.', ephemeral: true });
    }

    try {
      const result = Function(`'use strict'; return (${expr})`)();
      if (!isFinite(result)) throw new Error('Invalid result');

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x007B8A)
          .setTitle('🧮 Calculator')
          .addFields(
            { name: 'Expression', value: `\`${expr}\``, inline: false },
            { name: 'Result', value: `**${result}**`, inline: false },
          )
          .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })],
      });
    } catch {
      await interaction.reply({ content: '❌ Could not evaluate that expression.', ephemeral: true });
    }
  },
};
