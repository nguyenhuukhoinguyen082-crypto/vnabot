const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const NUMBER_EMOJIS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a simple poll with up to 10 options')
    .addStringOption(opt => opt.setName('question').setDescription('Poll question').setRequired(true))
    .addStringOption(opt => opt.setName('options').setDescription('Options separated by | (e.g. Yes|No|Maybe)').setRequired(true)),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const optionsRaw = interaction.options.getString('options');
    const options = optionsRaw.split('|').map(o => o.trim()).filter(Boolean).slice(0, 10);

    if (options.length < 2) {
      return interaction.reply({ content: '❌ Provide at least 2 options separated by `|` (e.g. `Yes|No`).', ephemeral: true });
    }

    const description = options.map((opt, i) => `${NUMBER_EMOJIS[i]} ${opt}`).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x007B8A)
      .setTitle(`📊 ${question}`)
      .setDescription(description)
      .setFooter({ text: `Poll by ${interaction.user.username} • Vietnam Airlines Group | PTFS` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    const msg = await interaction.fetchReply();

    for (let i = 0; i < options.length; i++) {
      await msg.react(NUMBER_EMOJIS[i]).catch(() => {});
    }
  },
};
