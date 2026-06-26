const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const { LOGO, FOOTER, COLORS, STATUS_EMOJI } = require('../config');

const CATEGORIES = {
  flights: {
    label: 'Flights & Booking',
    emoji: '\u2708\ufe0f',
    fields: [
      { name: 'Flight Info', value: [
        '> `/flights` - View all scheduled flights',
        '> `/fleet` - View our aircraft fleet',
        '> `/routes` - View all routes',
        '> `/destinations` - Browse destinations',
        '> `/network` - Route network overview',
      ].join('\n') },
      { name: 'Booking', value: [
        '> `/book flight [flight] [class]` - Book a seat (interactive seat map)',
        '> `/book cancel [flight] [confirm]` - Cancel your booking',
        '> `/mybooking` - View your active bookings',
        '> `/logbook [user?]` - View flight history',
      ].join('\n') },
    ],
  },
  events: {
    label: 'Events & Deals',
    emoji: '\U0001f4c5',
    fields: [
      { name: 'Events', value: [
        '> `/events` - Browse upcoming events',
        '> `/rsvp [event]` - RSVP to an event',
      ].join('\n') },
      { name: 'Deals & Menu', value: [
        '> `/deals` - Browse current deals',
        '> `/menu` - Browse inflight menu',
        '> `/order food` - Order inflight food',
      ].join('\n') },
      { name: 'Partnerships', value: [
        '> `/partnership list` - Browse partner airlines',
      ].join('\n') },
    ],
  },
  career: {
    label: 'Career & LotusMiles',
    emoji: '\U0001f468\u200d\u2708\ufe0f',
    fields: [
      { name: 'LotusMiles', value: [
        '> `/miles balance [user?]` - Check your miles & tier',
        '> `/miles redeem [amount]` - Redeem miles for VND',
        '> `/miles leaderboard` - Top LotusMiless',
      ].join('\n') },
      { name: 'Career', value: [
        '> `/career info [user?]` - View rank progress',
        '> `/career leaderboard` - Top pilots by flights',
      ].join('\n') },
      { name: 'Training & Certs', value: [
        '> `/training list` - View upcoming training sessions',
        '> `/mycertifications [user?]` - View earned certifications',
      ].join('\n') },
    ],
  },
  fun: {
    label: 'Fun & Tools',
    emoji: '\U0001f3ae',
    fields: [
      { name: 'Fun', value: [
        '> `/flip` `/roll [dice]` `/fact` `/mock [text]` `/reverse [text]`',
        '> `/ship [user1] [user2]` `/fight [opponent]` `/wanted [user]`',
      ].join('\n') },
      { name: 'Tools', value: [
        '> `/poll [question] [options]` `/countdown [title] [date] [time]`',
        '> `/calculate [expression]` `/time` `/randomuser`',
        '> `/remindme [time] [message]`',
      ].join('\n') },
      { name: 'Birthday', value: [
        '> `/birthday set/info/list/next/remove`',
      ].join('\n') },
      { name: 'Voice Activities', value: [
        '> Join any voice channel, click the rocket icon, pick a game',
        '> (Chess, Poker, Sketch Heads, Watch Together, and more - no command needed)',
      ].join('\n') },
    ],
  },
  staff: {
    label: 'Staff Only',
    emoji: '\U0001f512',
    fields: [
      { name: 'Flight Management', value: [
        '> `/createflight` `/cancelflight` `/deleteflight` `/endflight`',
        '> `/updateflight` `/postflight` `/checkin [flight]`',
      ].join('\n') },
      { name: 'Events, Deals, Destinations & Routes', value: [
        '> `/createevent` `/deleteevent` `/postevent`',
        '> `/createdeal` `/enddeal` `/postdeal`',
        '> `/adddest` `/removedest` `/addroute` `/deleteroute`',
      ].join('\n') },
      { name: 'Fleet & Partnerships', value: [
        '> `/createplane` `/editplane`',
        '> `/partnership add/remove/post`',
      ].join('\n') },
      { name: 'Training, Career & FF', value: [
        '> `/training schedule/cancel` `/certify` `/certdashboard`',
        '> `/ffdashboard` `/careerdashboard`',
      ].join('\n') },
      { name: 'Other', value: [
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
    function buildOverviewContainer() {
      const content = [
        '# Vietnam Airlines Group | PTFS - Bot Help',
        '',
        'Use the dropdown below to browse commands by category.',
        '',
        ...Object.values(CATEGORIES).map(c => `> **${c.label}:** ${c.fields.length} section(s)`),
        '',
        `-# ${FOOTER}`,
        `<t:${Math.floor(Date.now() / 1000)}:R>`,
      ].join('\n');

      return new ContainerBuilder()
        .setAccentColor(COLORS.primary)
        .addComponents(
          new SectionBuilder().addComponents(
            new TextDisplayBuilder().setContent(content)
          )
        );
    }

    function buildCategoryContainer(key) {
      const cat = CATEGORIES[key];
      const parts = [`# ${cat.emoji} ${cat.label}`, ''];

      for (const field of cat.fields) {
        parts.push(`> **${field.name}**`);
        parts.push(field.value);
        parts.push('');
      }

      parts.push(`-# ${FOOTER}`);
      parts.push(`<t:${Math.floor(Date.now() / 1000)}:R>`);

      return new ContainerBuilder()
        .setAccentColor(COLORS.primary)
        .addComponents(
          new SectionBuilder().addComponents(
            new TextDisplayBuilder().setContent(parts.join('\n'))
          )
        );
    }

    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('help_category')
        .setPlaceholder('Choose a category...')
        .addOptions(
          { label: 'Overview', value: 'overview' },
          ...Object.entries(CATEGORIES).map(([key, c]) => ({ label: c.label, value: key }))
        )
    );

    const msg = await interaction.reply({
      components: [buildOverviewContainer(), selectRow],
      flags: MessageFlags.IsComponentsV2,
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({
      time: 180_000,
      filter: i => i.customId === 'help_category' && i.user.id === interaction.user.id,
    });

    collector.on('collect', async (i) => {
      try {
        const choice = i.values[0];
        const container = choice === 'overview' ? buildOverviewContainer() : buildCategoryContainer(choice);
        await i.update({ components: [container, selectRow], flags: MessageFlags.IsComponentsV2 });
      } catch (err) {
        console.error('Help collector error:', err.message);
      }
    });

    collector.on('end', () => {
      interaction.editReply({ components: [], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    });
  },
};
