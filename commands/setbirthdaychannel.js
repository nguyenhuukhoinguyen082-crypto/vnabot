const { SlashCommandBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, PermissionFlagsBits } = require('discord.js');
const { updateBirthdayConfig } = require('../firebase');
const { FOOTER, COLORS } = require('../config');
const utils = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setbirthdaychannel')
    .setDescription('[STAFF] Set the channel where birthday announcements are posted')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel for birthday announcements').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    if (!utils.staffCheck(interaction)) {
      return interaction.editReply({ content: '❌ You do not have permission.' });
    }

    const channel = interaction.options.getChannel('channel');
    await updateBirthdayConfig({ channel_id: channel.id });

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.success)
      .addTextDisplayComponents(td => td.setContent('# ✅ Birthday Channel Set'))
      .addTextDisplayComponents(td => td.setContent(`Birthday announcements will now be posted in <#${channel.id}>.`))
      .addTextDisplayComponents(td => td.setContent('-# ' + FOOTER));

    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
