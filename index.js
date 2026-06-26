const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { handleWelcome } = require('./handlers/welcome');
const { handleBoost } = require('./handlers/boost');
const { handleApplication } = require('./handlers/applications');
const { checkBirthdays } = require('./services/birthdayChecker');
const { handleBookingButton, handleClassSelect } = require('./handlers/bookingFlow');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

const SKIP_FILES = ['seatmap.js', 'ffhelper.js'];

const commandsData = [];
for (const file of commandFiles) {
  if (SKIP_FILES.includes(file)) continue;
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    commandsData.push(command.data.toJSON());
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('[INIT] Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commandsData }
    );
    console.log('[OK] Slash commands registered!');
  } catch (err) {
    console.error('[ERR] Failed to register commands:', err);
  }
})();

client.on('interactionCreate', async (interaction) => {

  // ── Slash commands ──────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(`Error in /${interaction.commandName}:`, err);
      const msg = { content: '> An error occurred.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg).catch(() => {});
      } else {
        await interaction.reply(msg).catch(() => {});
      }
    }
    return;
  }

  // ── Buttons & Selects ───────────────────────────────────────────────────────
  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    const id = interaction.customId;

    // -- ALL collector-managed buttons -- let the command's own collector handle them
    if (id.startsWith('bk_'))       return; // book.js seat map / bookingFlow.js seat map
    if (id.startsWith('ann_book_')) return await handleBookingButton(interaction, client); // bookingFlow.js
    if (id.startsWith('ann_cls:'))  return await handleClassSelect(interaction, client);   // bookingFlow.js
    if (id.startsWith('fl_'))       return; // fleet.js
    if (id.startsWith('dest_'))     return; // destinations.js
    if (id.startsWith('route_'))    return; // routes.js
    if (id.startsWith('ev_'))       return; // events.js
    if (id.startsWith('shop_'))     return; // shop.js
    if (id.startsWith('ep_'))       return; // editplane.js
    if (id.startsWith('eco_'))      return; // economy.js
    if (id.startsWith('food_'))     return; // order.js
    if (id.startsWith('pt_'))       return; // partnership.js
    if (id.startsWith('ci_'))       return; // checkin.js
    if (id === 'help_category')     return; // help.js
    if (id === 'cf_aircraft')       return; // createflight.js
    if (id.startsWith('cf_config_')) { // createflight.js -- class pricing modal
      const flightId = id.replace('cf_config_', '');
      const { ModalBuilder, TextInputBuilder, TextInputStyle, LabelBuilder, TextDisplayBuilder } = require('discord.js');
      const { CLASS_CONFIG } = require('./config');

      const modal = new ModalBuilder()
        .setCustomId(`cf_modal_${flightId}`)
        .setTitle('Configure Class Pricing');

      // 3 cost inputs (3 Labels)
      for (const cls of ['economy', 'premium_economy', 'business']) {
        const def = CLASS_CONFIG[cls];
        modal.addLabelComponents(
          new LabelBuilder()
            .setLabel(`${def.emoji} ${def.label} Cost`)
            .setTextInputComponent(
              new TextInputBuilder()
                .setCustomId(`cf_cost_${cls}`)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(`Default: ${def.cost}`)
                .setValue(String(def.cost))
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(10)
            )
        );
      }

      // 1 combined roles field (1 Label)
      modal.addLabelComponents(
        new LabelBuilder()
          .setLabel('Role IDs (one per line)')
          .setDescription('Format: class:role_id per line. Empty = no perk.')
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId('cf_roles')
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder('economy:123\npremium_economy:456\nbusiness:789')
              .setRequired(false)
              .setMaxLength(200)
          )
      );

      // 1 TextDisplay for context (5th component)
      modal.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('-# Prices in VND. Role IDs give free booking for that class.')
      );

      await interaction.showModal(modal);
      return;
    }
    if (id === 'deal_prev' || id === 'deal_next' || id.startsWith('deal_book_post')) return; // deals.js

    // ── Application Accept/Reject buttons ─────────────────────────────────────
    if (id.startsWith('appaccept_') || id.startsWith('appreject_')) {
      return await handleApplication(interaction);
    }

    // -- Welcome message "Book a Flight" button --
    if (id === 'welcome_book') {
      return interaction.reply({
        content: '> Use `/flights` to see what\'s scheduled, then `/book flight [flightnumber] [class]` to book your seat!',
        ephemeral: true,
      }).catch(() => {});
    }

    if (id.startsWith('howtobook_') || id.startsWith('quickbook_')) {
      const flightNumber = id.replace('howtobook_', '').replace('quickbook_', '');
      return interaction.reply({
        content: [
          `## How to Book Flight **${flightNumber}**`,
          `Type this command in any channel:`,
          `\`/book flight flightnumber:${flightNumber} class:economy\``,
          '',
          '> Change `class:economy` to `class:business` for Business Class',
          '> You will then see an interactive seat map to pick your seat!',
        ].join('\n'),
        ephemeral: true,
      }).catch(() => {});
    }

    if (id.startsWith('deal_book_')) {
      return interaction.reply({
        content: '> Use `/book flight` to book! Check `/flights` for available flight numbers.',
        ephemeral: true,
      }).catch(() => {});
    }

    if (id === 'browse_deals') {
      return interaction.reply({
        content: '> Use `/deals` to browse all current deals!',
        ephemeral: true,
      }).catch(() => {});
    }

    if (id.startsWith('rsvp_')) {
      const eventId = id.replace('rsvp_', '');
      try {
        const { rsvpEvent } = require('./firebase');
        const result = await rsvpEvent(eventId, interaction.user.id, interaction.user.username);
        if (result === 'already') {
          return interaction.reply({ content: `> You've already RSVP'd to this event!`, ephemeral: true });
        }
        return interaction.reply({ content: '> RSVP confirmed! See you at the event.', ephemeral: true });
      } catch (err) {
        console.error('RSVP error:', err);
        return interaction.reply({ content: '> Failed to RSVP. Try `/rsvp` instead.', ephemeral: true }).catch(() => {});
      }
    }

    // ── Catch-all ──────────────────────────────────────────────────────────────
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate().catch(() => {});
    }
  }

  // ── Modal Submits ──────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('cf_modal_')) {
      const { setFlightClasses, getFlight } = require('./firebase');
      const flightId = interaction.customId.replace('cf_modal_', '');
      const flight = await getFlight(flightId);

      const classes = {};
      for (const cls of ['economy', 'premium_economy', 'business']) {
        const raw = interaction.fields.getTextInputValue(`cf_cost_${cls}`);
        const cost = parseInt(raw) || 0;
        if (cost > 0) {
          classes[cls] = { cost };
        }
      }

      // Parse role IDs
      const rolesRaw = interaction.fields.getTextInputValue('cf_roles');
      if (rolesRaw) {
        for (const line of rolesRaw.split('\n')) {
          const [cls, roleId] = line.trim().split(':');
          if (cls && roleId && classes[cls]) {
            classes[cls].role_id = roleId.trim();
          }
        }
      }

      // Merge with CLASS_CONFIG defaults
      const { CLASS_CONFIG } = require('./config');
      for (const cls of ['economy', 'premium_economy', 'business']) {
        if (classes[cls]) {
          classes[cls] = { ...CLASS_CONFIG[cls], ...classes[cls] };
        }
      }

      await setFlightClasses(flightId, classes);

      const { MessageFlags, ContainerBuilder, TextDisplayBuilder } = require('discord.js');
      const { COLORS, FOOTER } = require('./config');

      await interaction.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(COLORS.success)
            .addTextDisplayComponents(td => td.setContent('# ✅ Class Pricing Configured'))
            .addTextDisplayComponents(td => td.setContent([
              `**Flight:** ${flight?.flight_number || flightId}`,
            ...Object.entries(classes).map(([k, v]) =>
              `> ${v.emoji || '•'} **${v.label}** - ${(v.cost || 0).toLocaleString()}₫${v.role_id ? ' · <@&' + v.role_id + '>' : ''}`
            ),
            ].join('\n')))
            .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`))
        ],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      return;
    }
  }
});

// ── Welcome New Members ───────────────────────────────────────────────────────
client.on('guildMemberAdd', (member) => { handleWelcome(member); });


// ── Boost Detection ───────────────────────────────────────────────────────────
client.on('guildMemberUpdate', (oldMember, newMember) => { handleBoost(oldMember, newMember); });

client.once('ready', () => {
  console.log(`[READY] Vietnam Airlines Group | PTFS Bot is online as ${client.user.tag}`);
  client.user.setActivity('Vietnam Airlines Group | PTFS | /help', { type: 0 });

  checkBirthdays(client);
  setInterval(() => checkBirthdays(client), 6 * 60 * 60 * 1000);
});

client.login(process.env.DISCORD_TOKEN);
