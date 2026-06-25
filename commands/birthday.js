const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getBirthday, getBirthdays, setBirthday, removeBirthday, getBirthdayConfig } = require('../firebase');

const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function daysUntilBirthday(day, month) {
  const now = new Date();
  const thisYear = now.getFullYear();
  let next = new Date(thisYear, month - 1, day);
  if (next < now) next = new Date(thisYear + 1, month - 1, day);
  const diff = Math.ceil((next - now) / 86400000);
  return diff;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Vietnam Airlines Group | PTFS birthday tracker')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set your birthday')
        .addIntegerOption(opt => opt.setName('day').setDescription('Day (1-31)').setRequired(true).setMinValue(1).setMaxValue(31))
        .addIntegerOption(opt => opt.setName('month').setDescription('Month (1-12)').setRequired(true).setMinValue(1).setMaxValue(12)))
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('View birthday information')
        .addUserOption(opt => opt.setName('user').setDescription('User to check').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all birthdays in the server'))
    .addSubcommand(sub =>
      sub.setName('next')
        .setDescription('Show upcoming birthdays'))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove your birthday')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ══════════════════════════════════════════════════════════════════════════
    // SET
    // ══════════════════════════════════════════════════════════════════════════
    if (sub === 'set') {
      await interaction.deferReply({ ephemeral: true });
      const day = interaction.options.getInteger('day');
      const month = interaction.options.getInteger('month');

      const daysInMonth = [31,29,31,30,31,30,31,31,30,31,30,31][month - 1];
      if (day > daysInMonth) {
        return interaction.editReply({ content: `❌ ${MONTHS[month - 1]} doesn't have ${day} days.` });
      }

      await setBirthday(interaction.user.id, day, month, interaction.user.username);

      const embed = new EmbedBuilder()
        .setColor(0x00B050)
        .setTitle('🎂 Birthday Set!')
        .setThumbnail(LOGO)
        .setDescription(`Your birthday is set to **${MONTHS[month - 1]} ${day}**.\nIt will be announced in community news on this date! 🎉`)
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // INFO
    // ══════════════════════════════════════════════════════════════════════════
    if (sub === 'info') {
      await interaction.deferReply();
      const target = interaction.options.getUser('user') || interaction.user;
      const bday = await getBirthday(target.id);

      if (!bday) {
        return interaction.editReply({ content: `🎂 ${target.id === interaction.user.id ? 'You haven\'t' : `${target.username} hasn't`} set a birthday yet. Use \`/birthday set\`!` });
      }

      const daysUntil = daysUntilBirthday(bday.day, bday.month);
      const embed = new EmbedBuilder()
        .setColor(0x007B8A)
        .setTitle(`🎂 ${target.displayName || target.username}'s Birthday`)
        .setThumbnail(target.displayAvatarURL({ dynamic: true }) || LOGO)
        .addFields(
          { name: '📅 Date', value: `${MONTHS[bday.month - 1]} ${bday.day}`, inline: true },
          { name: '⏳ Days Until', value: daysUntil === 0 ? '🎉 Today!' : `${daysUntil} day(s)`, inline: true },
        )
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LIST
    // ══════════════════════════════════════════════════════════════════════════
    if (sub === 'list') {
      await interaction.deferReply();
      const birthdays = await getBirthdays();
      if (!birthdays.length) return interaction.editReply({ content: '🎂 No birthdays set in this server yet.' });

      // Sort by month then day
      const sorted = [...birthdays].sort((a, b) => a.month - b.month || a.day - b.day);

      const lines = sorted.map(b => `🎂 **${b.username}** — ${MONTHS[b.month - 1]} ${b.day}`);

      const embed = new EmbedBuilder()
        .setColor(0x007B8A)
        .setTitle('🎂 Vietnam Airlines Group | PTFS — All Birthdays')
        .setThumbnail(LOGO)
        .setDescription(lines.slice(0, 30).join('\n'))
        .setFooter({ text: `${birthdays.length} birthday(s) registered • Vietnam Airlines Group | PTFS` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // NEXT
    // ══════════════════════════════════════════════════════════════════════════
    if (sub === 'next') {
      await interaction.deferReply();
      const birthdays = await getBirthdays();
      if (!birthdays.length) return interaction.editReply({ content: '🎂 No birthdays set in this server yet.' });

      const withDays = birthdays.map(b => ({ ...b, daysUntil: daysUntilBirthday(b.day, b.month) }));
      const sorted = withDays.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 10);

      const lines = sorted.map(b =>
        `🎂 **${b.username}** — ${MONTHS[b.month - 1]} ${b.day} ${b.daysUntil === 0 ? '(🎉 Today!)' : `(in ${b.daysUntil} day(s))`}`
      );

      const embed = new EmbedBuilder()
        .setColor(0x007B8A)
        .setTitle('🎂 Upcoming Birthdays')
        .setThumbnail(LOGO)
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // REMOVE
    // ══════════════════════════════════════════════════════════════════════════
    if (sub === 'remove') {
      await interaction.deferReply({ ephemeral: true });
      const bday = await getBirthday(interaction.user.id);
      if (!bday) return interaction.editReply({ content: '❌ You don\'t have a birthday set.' });

      await removeBirthday(interaction.user.id);
      return interaction.editReply({ content: '✅ Your birthday has been removed.' });
    }
  },
};
