const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const { FOOTER, COLORS } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff')
    .setDescription('[STAFF] Grant staff permissions to a user or role')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Grant staff to a user or role')
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to grant staff to').setRequired(false))
        .addRoleOption(opt =>
          opt.setName('role').setDescription('Role to grant staff to').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove staff from a user or role')
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to remove staff from').setRequired(false))
        .addRoleOption(opt =>
          opt.setName('role').setDescription('Role to remove staff from').setRequired(false))),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (!staffRoleId) {
      return interaction.editReply({ content: '❌ `STAFF_ROLE_ID` is not set in the bot config.' });
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.editReply({ content: '❌ You need **Manage Roles** permission to use this command.' });
    }

    const sub = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user');
    const targetRole = interaction.options.getRole('role');

    if (!targetUser && !targetRole) {
      return interaction.editReply({ content: '❌ Please specify a user or role.' });
    }

    const staffRole = await interaction.guild.roles.fetch(staffRoleId).catch(() => null);
    if (!staffRole) {
      return interaction.editReply({ content: `❌ Staff role \`${staffRoleId}\` not found in this server.` });
    }

    const isAdd = sub === 'add';
    const results = [];

    if (targetUser) {
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) {
        results.push(`❌ Could not find member **${targetUser.username}** in this server.`);
      } else {
        try {
          if (isAdd) {
            await member.roles.add(staffRole);
            results.push(`✅ Granted **${staffRole.name}** to **${targetUser.username}**`);
          } else {
            await member.roles.remove(staffRole);
            results.push(`✅ Removed **${staffRole.name}** from **${targetUser.username}**`);
          }
        } catch {
          results.push(`❌ Failed to update roles for **${targetUser.username}** — check bot permissions.`);
        }
      }
    }

    if (targetRole) {
      try {
        await interaction.guild.members.fetch();
        const membersWithRole = interaction.guild.members.cache.filter(m => m.roles.cache.has(targetRole.id));
        let count = 0;
        for (const [, member] of membersWithRole) {
          if (isAdd && !member.roles.cache.has(staffRoleId)) {
            await member.roles.add(staffRole).catch(() => {});
            count++;
          } else if (!isAdd && member.roles.cache.has(staffRoleId)) {
            await member.roles.remove(staffRole).catch(() => {});
            count++;
          }
        }
        results.push(`✅ ${isAdd ? 'Granted' : 'Removed'} **${staffRole.name}** ${isAdd ? 'to' : 'from'} **${count}** member(s) with role <@&${targetRole.id}>`);
      } catch {
        results.push(`❌ Failed to update members with role **${targetRole.name}**.`);
      }
    }

    const container = new ContainerBuilder()
      .setAccentColor(isAdd ? COLORS.success : COLORS.danger)
      .addTextDisplayComponents(
        td => td.setContent(isAdd ? '# ✅ Staff Granted' : '# ❌ Staff Removed'),
        td => td.setContent(results.join('\n')),
      )
      .addSeparatorComponents(sep => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(td => td.setContent(`-# Action by ${interaction.user.username} • ${FOOTER}`));

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};
