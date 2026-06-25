const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');

const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

const CATEGORIES = {
  flights: {
    label: '✈️ Flights & Booking',
    emoji: '✈️',
    fields: [
      { name: '✈️ Flight Info', value: [
        '> `/flights` — View all scheduled flights',
        '> `/fleet` — View our aircraft fleet',
        '> `/routes` — View all routes',
        '> `/destinations` — Browse destinations',
        '> `/network` — Route network overview',
      ].join('\n') },
      { name: '🎫 Booking', value: [
        '> `/book flight [flight] [class]` — Book a seat (interactive seat map)',
        '> `/book cancel [flight] [confirm]` — Cancel your booking',
        '> `/mybooking` — View your active bookings',
        '> `/logbook [user?]` — View flight history',
      ].join('\n') },
    ],
  },
  events: {
    label: '📅 Events & Deals',
    emoji: '📅',
    fields: [
      { name: '📅 Events', value: [
        '> `/events` — Browse upcoming events',
        '> `/rsvp [event]` — RSVP to an event',
      ].join('\n') },
      { name: '🏷️ Deals & Menu', value: [
        '> `/deals` — Browse current deals',
        '> `/menu` — Browse inflight menu',
        '> `/order food` — Order inflight food',
      ].join('\n') },
      { name: '🤝 Partnerships', value: [
        '> `/partnership list` — Browse partner airlines',
      ].join('\n') },
    ],
  },
  career: {
    label: '👨‍✈️ Career & LotusMiles',
    emoji: '👨‍✈️',
    fields: [
      { name: '✈️ LotusMiles', value: [
        '> `/miles balance [user?]` — Check your miles & tier',
        '> `/miles redeem [amount]` — Redeem miles for VND',
        '> `/miles leaderboard` — Top LotusMiless',
      ].join('\n') },
      { name: '🎖️ Career', value: [
        '> `/career info [user?]` — View rank progress',
        '> `/career leaderboard` — Top pilots by flights',
      ].join('\n') },
      { name: '🎓 Training & Certs', value: [
        '> `/training list` — View upcoming training sessions',
        '> `/mycertifications [user?]` — View earned certifications',
      ].join('\n') },
    ],
  },
  economy: {
    label: '💰 Economy',
    emoji: '💰',
    fields: [
      { name: '💰 Earning', value: [
        '> `/daily` `/work` `/mine` `/fish` `/beg` `/sidejob`',
        '> `/crime` — Risky, higher reward',
        '> `/gamble [amount]` — Slot machine',
      ].join('\n') },
      { name: '🏦 Banking & Shop', value: [
        '> `/balance [user?]` `/deposit [amount]` `/withdraw [amount]`',
        '> `/pay [user] [amount]` `/rob [user]`',
        '> `/inventory` `/shop browse` `/buy [item]`',
        '> `/eleaderboard` — Top 10 richest',
      ].join('\n') },
    ],
  },
  fun: {
    label: '🎮 Fun & Tools',
    emoji: '🎮',
    fields: [
      { name: '🎮 Fun', value: [
        '> `/flip` `/roll [dice]` `/fact` `/mock [text]` `/reverse [text]`',
        '> `/ship [user1] [user2]` `/fight [opponent]` `/wanted [user]`',
      ].join('\n') },
      { name: '🛠️ Tools', value: [
        '> `/poll [question] [options]` `/countdown [title] [date] [time]`',
        '> `/calculate [expression]` `/time` `/randomuser`',
        '> `/remindme [time] [message]`',
      ].join('\n') },
      { name: '🎂 Birthday', value: [
        '> `/birthday set/info/list/next/remove`',
      ].join('\n') },
      { name: '🎮 Voice Activities', value: [
        '> Join any voice channel → click the 🚀 rocket icon → pick a game',
        '> (Chess, Poker, Sketch Heads, Watch Together, and more — no command needed)',
      ].join('\n') },
    ],
  },
  staff: {
    label: '🔒 Staff Only',
    emoji: '🔒',
    fields: [
      { name: '✈️ Flight Management', value: [
        '> `/createflight` `/cancelflight` `/deleteflight` `/endflight`',
        '> `/updateflight` `/postflight` `/checkin [flight]`',
      ].join('\n') },
      { name: '📅 Events, Deals, Destinations & Routes', value: [
        '> `/createevent` `/deleteevent` `/postevent`',
        '> `/createdeal` `/enddeal` `/postdeal`',
        '> `/adddest` `/removedest` `/addroute` `/deleteroute`',
      ].join('\n') },
      { name: '🛩️ Fleet & Partnerships', value: [
        '> `/createplane` `/editplane`',
        '> `/partnership add/remove/post`',
      ].join('\n') },
      { name: '🎓 Training, Career & FF', value: [
        '> `/training schedule/cancel` `/certify` `/certdashboard`',
        '> `/ffdashboard` `/careerdashboard`',
      ].join('\n') },
      { name: '💰 Economy & Other', value: [
        '> `/addmoney` `/removemoney` `/economy dashboard` `/shop add`',
        '> `/staff add/remove` `/announce` `/embedbuilder` `/setbirthdaychannel`',
      ].join('\n') },
    ],
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View all Vietnam Airlines Group | PTFS bot commands'),

  async execute(interaction) {
    function buildOverviewEmbed() {
      return new EmbedBuilder()
        .setColor(0x007B8A)
        .setTitle('🇻🇳 Vietnam Airlines Group | PTFS — Bot Help')
        .setThumbnail(LOGO)
        .setDescription('Use the dropdown below to browse commands by category.')
        .addFields(Object.values(CATEGORIES).map(c => ({ name: c.label, value: `${c.fields.length} section(s)`, inline: true })))
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
        .setTimestamp();
    }

    function buildCategoryEmbed(key) {
      const cat = CATEGORIES[key];
      return new EmbedBuilder()
        .setColor(0x007B8A)
        .setTitle(`${cat.emoji} ${cat.label}`)
        .setThumbnail(LOGO)
        .addFields(cat.fields)
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
        .setTimestamp();
    }

    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('help_category')
        .setPlaceholder('📂 Choose a category...')
        .addOptions(
          { label: 'Overview', value: 'overview', emoji: '📋' },
          ...Object.entries(CATEGORIES).map(([key, c]) => ({ label: c.label, value: key, emoji: c.emoji }))
        )
    );

    const msg = await interaction.reply({ embeds: [buildOverviewEmbed()], components: [selectRow], fetchReply: true });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 180_000,
      filter: i => i.user.id === interaction.user.id,
    });

    collector.on('collect', async (i) => {
      try {
        const choice = i.values[0];
        const embed = choice === 'overview' ? buildOverviewEmbed() : buildCategoryEmbed(choice);
        await i.update({ embeds: [embed], components: [selectRow] });
      } catch (err) {
        console.error('Help collector error:', err.message);
      }
    });

    collector.on('end', () => { interaction.editReply({ components: [] }).catch(() => {}); });
  },
};
