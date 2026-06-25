const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('randomuser')
    .setDescription('Select a random user from the server'),

  async execute(interaction) {
    await interaction.deferReply();
    await interaction.guild.members.fetch();
    const members = interaction.guild.members.cache.filter(m => !m.user.bot);

    if (!members.size) return interaction.editReply({ content: '❌ No members found.' });

    const randomMember = members.random();

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x007B8A)
        .setTitle('🎲 Random User Selected!')
        .setDescription(`🎉 **${randomMember.displayName || randomMember.user.username}** has been chosen!`)
        .setThumbnail(randomMember.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `Selected from ${members.size} members • Vietnam Airlines Group | PTFS` })],
    });
  },
};
