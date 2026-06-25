const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBookings } = require('../firebase');

const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logbook')
    .setDescription('View your or someone\'s flight history')
    .addUserOption(opt => opt.setName('user').setDescription('User to check').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') || interaction.user;

    const allBookings = await getBookings();
    const userBookings = allBookings
      .filter(b => b.discord_id === target.id)
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    if (!userBookings.length) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x007B8A)
          .setTitle(`📖 ${target.displayName || target.username}'s Logbook`)
          .setDescription('No flights logged yet. Book a flight with `/book flight`!')
          .setThumbnail(target.displayAvatarURL({ dynamic: true }) || LOGO)
          .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })],
      });
    }

    const economyCount = userBookings.filter(b => b.seat_class === 'economy').length;
    const businessCount = userBookings.filter(b => b.seat_class === 'business').length;

    const embed = new EmbedBuilder()
      .setColor(0x007B8A)
      .setTitle(`📖 ${target.displayName || target.username}'s Flight Logbook`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }) || LOGO)
      .setDescription(`**${userBookings.length}** total flight(s) logged.`)
      .addFields(
        { name: '💺 Economy Flights', value: `${economyCount}`, inline: true },
        { name: '💼 Business Flights', value: `${businessCount}`, inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
      )
      .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
      .setTimestamp();

    const recent = userBookings.slice(0, 10);
    const lines = recent.map(b => {
      const date = b.created_at ? new Date(b.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
      const classEmoji = b.seat_class === 'business' ? '💼' : '💺';
      return `${classEmoji} **${b.flight_number}** — ${b.origin} ✈️ ${b.destination} — Seat ${b.seat} — *${date}*`;
    });

    embed.addFields({ name: '🕐 Recent Flights', value: lines.join('\n'), inline: false });

    if (userBookings.length > 10) {
      embed.addFields({ name: '\u200b', value: `*...and ${userBookings.length - 10} more flight(s).*`, inline: false });
    }

    return interaction.editReply({ embeds: [embed] });
  },
};
