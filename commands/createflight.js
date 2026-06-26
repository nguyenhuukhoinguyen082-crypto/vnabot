const {
  SlashCommandBuilder, PermissionFlagsBits, MessageFlags,
  ContainerBuilder, TextDisplayBuilder,
  ActionRowBuilder, StringSelectMenuBuilder, ComponentType,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { createFlight, getFleet, setFlightClasses } = require('../firebase');
const { FOOTER, COLORS, STATUS_EMOJI, CLASS_CONFIG } = require('../config');
require('dotenv').config();


const CREW_ROLE = process.env.CREW_ROLE_ID;

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
    if (!utils.staffCheck(interaction)) {
      return interaction.editReply({ content: '> You do not have permission.' });
    }

    const flightNumber = interaction.options.getString('flightnumber').toUpperCase();
    const origin = interaction.options.getString('origin').toUpperCase();
    const destination = interaction.options.getString('destination').toUpperCase();
    const date = interaction.options.getString('date');
    const time = interaction.options.getString('time');
    const gate = interaction.options.getString('gate') || 'TBA';
    const flightType = interaction.options.getString('flighttype') || 'Group Flight';

    const ts = ictToTimestamp(date, time);
    if (!ts) return interaction.editReply({ content: '> Invalid date/time. Use dd/mm/yyyy and HH:mm (ICT).' });

    // Auto-detect sub-airline from callsign prefix
    let airlineKey = 'vna';
    if (flightNumber.startsWith('BL')) airlineKey = 'pacific';
    else if (flightNumber.startsWith('OV')) airlineKey = 'vasco';

    const fleet = await getFleet();
    if (!fleet.length) {
      return interaction.editReply({ content: '> No aircraft in the fleet yet. Use `/createplane` first.' });
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
      label: `${p.display_name || p.aircraft_type} - VN-${p.tail_registration || p.registration}`,
      description: `${p.passenger_capacity || '?'} seats | ${p.seat_config || '?'} | ${p.airline_name || 'Vietnam Airlines'} | ${p.image_url ? 'Has image' : 'No image'}`,
      value: p.id,
    }));

    const airlineEmoji = AIRLINE_EMOJI[airlineKey] || '\u2708\ufe0f';

    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('cf_aircraft')
        .setPlaceholder('Select aircraft from fleet...')
        .addOptions(options)
    );

    const previewContainer = new ContainerBuilder()
      .setAccentColor(COLORS.primary)
      .addTextDisplayComponents(
        td => td.setContent('# Create Flight - Select Aircraft'),
        td => td.setContent(`> **Flight:** \`${flightNumber}\``),
        td => td.setContent(`> **Route:** ${origin} \u2192 ${destination}`),
        td => td.setContent(`> **Time (ICT):** ${date} ${time} > <t:${Math.floor(ts / 1000)}:F>`),
        td => td.setContent(`> **Gate:** \`${gate}\``),
        td => td.setContent(`> **Type:** \`${flightType}\``),
        td => td.setContent(`> **Airline:** ${airlineEmoji} ${airlineKey === 'vna' ? 'Vietnam Airlines' : airlineKey === 'pacific' ? 'Pacific Airlines' : 'VASCO'}`),
        td => td.setContent('Select the aircraft for this flight. Aircraft with images will use their image as the Discord Event banner.'),
        td => td.setContent('-# Vietnam Airlines Group | PTFS - Sai Canh Vuon Cao'),
      );

    const msg = await interaction.editReply({ components: [previewContainer, selectRow], flags: MessageFlags.IsComponentsV2 });

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
            content: `<@&${CREW_ROLE}> Flight **${flightNumber}** (${origin} \u2192 ${destination}) has been created! Use \`/book flight\` to book your seat.`,
          });
        } catch {}

        collector.stop('done');

        const successContainer = new ContainerBuilder()
          .setAccentColor(COLORS.success)
          .addTextDisplayComponents(
            td => td.setContent('# Flight Created!'),
            td => td.setContent(`> **Flight:** \`${flightNumber}\``),
            td => td.setContent(`> **Route:** ${origin} \u2192 ${destination}`),
            td => td.setContent(`> **Time:** <t:${Math.floor(ts / 1000)}:F>`),
            td => td.setContent(`> **Aircraft:** ${selectedPlane.display_name || selectedPlane.aircraft_type} (VN-${selectedPlane.tail_registration || selectedPlane.registration})`),
            td => td.setContent(`> **Capacity:** ${selectedPlane.passenger_capacity || '?'} seats`),
            td => td.setContent(`> **Business:** ${selectedPlane.has_business ? 'Yes' : 'No'}`),
            td => td.setContent(`> **Gate:** \`${gate}\``),
            td => td.setContent(`> **Event Banner:** ${selectedPlane.image_url ? 'Aircraft image used!' : 'No image - add one with \`/editplane\`'}`),
            td => td.setContent(`> **Discord Event:** ${discordEvent ? `[View Event](${discordEvent.url})` : 'Failed (check Manage Events permission)'}`),
            td => td.setContent(`> **Next Step:** Use \`/postflight flightnumber:${flightNumber} flighttype:${flightType} host:YOUR NAME\` to announce!`),
            td => td.setContent(`-# ${FOOTER} - Created by ${interaction.user.username}`),
          );

        const configBtnRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`cf_config_${flightId}`)
            .setLabel('Configure Class Pricing')
            .setStyle(ButtonStyle.Secondary),
        );

        await interaction.editReply({ components: [successContainer, configBtnRow], flags: MessageFlags.IsComponentsV2 });
      } catch (err) {
        console.error('createflight error:', err.message);
      }
    });

    collector.on('end', (_, reason) => {
      if (reason !== 'done') {
        interaction.editReply({ content: '> Timed out. Run `/createflight` again.', embeds: [], components: [] }).catch(() => {});
      }
    });
  },
};
