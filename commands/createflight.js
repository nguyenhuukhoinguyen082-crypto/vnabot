const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, StringSelectMenuBuilder, ComponentType,
} = require('discord.js');
const { createFlight, getFleet } = require('../firebase');
require('dotenv').config();

const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';
const CREW_ROLE = process.env.CREW_ROLE_ID || '1504118227910000781';

const AIRLINE_EMOJI = {
  vna: '🇻🇳',
  pacific: '<:BLTail:1514151520936136734>',
  vasco: '<:VAS:1514151545745182841>',
};

function ictToTimestamp(dateStr, timeStr) {
  try {
    const [day, month, year] = dateStr.split('/').map(Number);
    const [hour, min] = timeStr.split(':').map(Number);
    return Date.UTC(year, month - 1, day, hour - 7, min);
  } catch { return null; }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createflight')
    .setDescription('[STAFF] Create a new flight using an aircraft from your fleet')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption(opt => opt.setName('flightnumber').setDescription('Flight number including prefix (e.g. VN100, BL200, OV301)').setRequired(true))
    .addStringOption(opt => opt.setName('origin').setDescription('Origin airport code (e.g. HAN)').setRequired(true))
    .addStringOption(opt => opt.setName('destination').setDescription('Destination airport code (e.g. SGN)').setRequired(true))
    .addStringOption(opt => opt.setName('date').setDescription('Date (dd/mm/yyyy)').setRequired(true))
    .addStringOption(opt => opt.setName('time').setDescription('Departure time ICT (HH:mm)').setRequired(true))
    .addStringOption(opt => opt.setName('gate').setDescription('Gate (e.g. A1)').setRequired(false))
    .addStringOption(opt => opt.setName('flighttype').setDescription('Flight type (e.g. Group Flight, Training Flight)').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.editReply({ content: '❌ You do not have permission.' });
    }

    const flightNumber = interaction.options.getString('flightnumber').toUpperCase();
    const origin = interaction.options.getString('origin').toUpperCase();
    const destination = interaction.options.getString('destination').toUpperCase();
    const date = interaction.options.getString('date');
    const time = interaction.options.getString('time');
    const gate = interaction.options.getString('gate') || 'TBA';
    const flightType = interaction.options.getString('flighttype') || 'Group Flight';

    const ts = ictToTimestamp(date, time);
    if (!ts) return interaction.editReply({ content: '❌ Invalid date/time. Use dd/mm/yyyy and HH:mm (ICT).' });

    // Auto-detect sub-airline from callsign prefix
    let airlineKey = 'vna';
    if (flightNumber.startsWith('BL')) airlineKey = 'pacific';
    else if (flightNumber.startsWith('OV')) airlineKey = 'vasco';

    const fleet = await getFleet();
    if (!fleet.length) {
      return interaction.editReply({ content: '❌ No aircraft in the fleet yet. Use `/createplane` first.' });
    }

    // Filter fleet to matching airline or show all active
    const activeFleet = fleet.filter(p => {
      const active = (p.service_status || p.status || '').toLowerCase() !== 'retired';
      if (airlineKey !== 'vna') {
        return active && (p.airline === airlineKey || (!p.airline && airlineKey === 'vna'));
      }
      return active && (!p.airline || p.airline === 'vna');
    });

    const displayFleet = activeFleet.length > 0 ? activeFleet : fleet.filter(p => (p.service_status || p.status || '').toLowerCase() !== 'retired');

    if (!displayFleet.length) {
      return interaction.editReply({ content: `❌ No active aircraft found for **${flightNumber}**. Check your fleet with \`/fleet\`.` });
    }

    const options = displayFleet.slice(0, 25).map(p => ({
      label: `${p.display_name || p.aircraft_type} — VN-${p.tail_registration || p.registration}`,
      description: `${p.passenger_capacity || '?'} seats | ${p.seat_config || '?'} | ${p.airline_name || 'Vietnam Airlines'} | ${p.image_url ? '🖼️ Has image' : '⚠️ No image'}`,
      value: p.id,
    }));

    const airlineEmoji = AIRLINE_EMOJI[airlineKey] || '✈️';

    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('cf_aircraft')
        .setPlaceholder('Select aircraft from fleet...')
        .addOptions(options)
    );

    const previewEmbed = new EmbedBuilder()
      .setColor(0x007B8A)
      .setTitle('✈️ Create Flight — Select Aircraft')
      .setThumbnail(LOGO)
      .addFields(
        { name: '✈️ Flight', value: flightNumber, inline: true },
        { name: '🗺️ Route', value: `${origin} → ${destination}`, inline: true },
        { name: '🕐 Time (ICT)', value: `${date} ${time} → <t:${Math.floor(ts / 1000)}:F>`, inline: false },
        { name: '🚪 Gate', value: gate, inline: true },
        { name: '🛫 Type', value: flightType, inline: true },
        { name: '🏢 Airline', value: `${airlineEmoji} ${airlineKey === 'vna' ? 'Vietnam Airlines' : airlineKey === 'pacific' ? 'Pacific Airlines' : 'VASCO'}`, inline: true },
      )
      .setDescription('Select the aircraft for this flight. Aircraft with 🖼️ will use their image as the Discord Event banner.')
      .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
      .setTimestamp();

    const msg = await interaction.editReply({ embeds: [previewEmbed], components: [selectRow] });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 120_000,
      filter: i => i.user.id === interaction.user.id,
    });

    collector.on('collect', async (sel) => {
      try {
        await sel.deferUpdate();
        const selectedPlane = displayFleet.find(p => p.id === sel.values[0]);
        if (!selectedPlane) return;

        const flightId = await createFlight({
          flight_number: flightNumber,
          origin,
          destination,
          date,
          time: `${date} ${time}`,
          timestamp: ts,
          gate,
          flight_type: flightType,
          aircraft: selectedPlane.display_name || selectedPlane.aircraft_type,
          aircraft_id: selectedPlane.id,
          aircraft_type: selectedPlane.aircraft_type,
          aircraft_image: selectedPlane.image_url || null,
          tail_registration: `VN-${selectedPlane.tail_registration || selectedPlane.registration}`,
          has_business: selectedPlane.has_business || false,
          seat_config: selectedPlane.seat_config || 'N/A',
          passenger_capacity: selectedPlane.passenger_capacity || 0,
          airline: selectedPlane.airline || 'vna',
          airline_name: selectedPlane.airline_name || 'Vietnam Airlines',
        });

        // Create Discord Scheduled Event with aircraft image as banner
        let discordEvent = null;
        try {
          const eventPayload = {
            name: `${flightType} | ${flightNumber} | ${origin} → ${destination}`,
            scheduledStartTime: new Date(ts),
            scheduledEndTime: new Date(ts + 60 * 60 * 1000),
            privacyLevel: 2,
            entityType: 3,
            entityMetadata: { location: `Gate ${gate} — ${origin} → ${destination}` },
            description: `Vietnam Airlines Group | PTFS\nFlight ${flightNumber} from ${origin} to ${destination}\nAircraft: ${selectedPlane.display_name || selectedPlane.aircraft_type}\nCapacity: ${selectedPlane.passenger_capacity || '?'} seats`,
          };

          // Add aircraft image as banner if available
          if (selectedPlane.image_url) {
            eventPayload.image = selectedPlane.image_url;
          }

          discordEvent = await interaction.guild.scheduledEvents.create(eventPayload);
        } catch (err) {
          console.error('Discord event creation failed:', err.message);
        }

        // Ping crew
        try {
          await interaction.channel.send({
            content: `<@&${CREW_ROLE}> ✈️ Flight **${flightNumber}** (${origin} → ${destination}) has been created! Use \`/book flight\` to book your seat.`,
          });
        } catch {}

        collector.stop('done');

        const successEmbed = new EmbedBuilder()
          .setColor(0x00B050)
          .setTitle('✅ Flight Created!')
          .setThumbnail(LOGO)
          .addFields(
            { name: '✈️ Flight', value: flightNumber, inline: true },
            { name: '🗺️ Route', value: `${origin} → ${destination}`, inline: true },
            { name: '🕐 Time', value: `<t:${Math.floor(ts / 1000)}:F>`, inline: false },
            { name: '🛩️ Aircraft', value: `${selectedPlane.display_name || selectedPlane.aircraft_type} (VN-${selectedPlane.tail_registration || selectedPlane.registration})`, inline: true },
            { name: '💺 Capacity', value: `${selectedPlane.passenger_capacity || '?'} seats`, inline: true },
            { name: '💼 Business', value: selectedPlane.has_business ? '✅ Yes' : '❌ No', inline: true },
            { name: '🚪 Gate', value: gate, inline: true },
            { name: '🖼️ Event Banner', value: selectedPlane.image_url ? '✅ Aircraft image used!' : '⚠️ No image — add one with `/editplane`', inline: true },
            { name: '📅 Discord Event', value: discordEvent ? `[View Event](${discordEvent.url})` : '⚠️ Failed (check Manage Events permission)', inline: false },
            { name: '📢 Next Step', value: `Use \`/postflight flightnumber:${flightNumber} flighttype:${flightType} host:YOUR NAME\` to announce!`, inline: false },
          )
          .setFooter({ text: `Created by ${interaction.user.username} • Vietnam Airlines Group | PTFS` })
          .setTimestamp();

        if (selectedPlane.image_url) successEmbed.setImage(selectedPlane.image_url);
        await interaction.editReply({ embeds: [successEmbed], components: [] });
      } catch (err) {
        console.error('createflight error:', err.message);
      }
    });

    collector.on('end', (_, reason) => {
      if (reason !== 'done') {
        interaction.editReply({ content: '⏱️ Timed out. Run `/createflight` again.', embeds: [], components: [] }).catch(() => {});
      }
    });
  },
};
