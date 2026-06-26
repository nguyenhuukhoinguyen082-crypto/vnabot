const { SlashCommandBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const { FOOTER, COLORS } = require('../config');

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

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.primary)
      .addSectionComponents(section =>
        section
          .addTextDisplayComponents(td => td.setContent('# 🎲 Random User Selected!'))
          .setThumbnailAccessory(tb => tb.setURL(randomMember.user.displayAvatarURL({ dynamic: true })))
      )
      .addTextDisplayComponents(td => td.setContent(`🎉 **${randomMember.displayName || randomMember.user.username}** has been chosen!`))
      .addTextDisplayComponents(td => td.setContent('-# Selected from ' + members.size + ' members • ' + FOOTER));

    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
