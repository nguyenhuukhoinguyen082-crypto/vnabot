const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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

const SKIP_FILES = ['seatmap.js'];

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
    console.log('📡 Registering slash commands...');

    let applicationId = process.env.CLIENT_ID;
    if (!applicationId) {
      try {
        const appInfo = await rest.get(Routes.oauth2CurrentApplication());
        applicationId = appInfo?.id;
        console.log('ℹ️ Fetched application id from Discord:', applicationId);
      } catch (e) {
        console.warn('⚠️ Could not fetch application id from Discord:', e?.message || e);
      }
    }

    if (!applicationId) throw new Error('Application ID not set and could not be fetched');

    await rest.put(
      Routes.applicationGuildCommands(applicationId, process.env.GUILD_ID),
      { body: commandsData }
    );
    console.log('✅ Slash commands registered!');
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
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
      const msg = { content: '❌ An error occurred.', ephemeral: true };
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

    // ── ALL collector-managed buttons — let the command's own collector handle them
    if (id.startsWith('bk_'))       return; // book.js seat map
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
    if (id === 'deal_prev' || id === 'deal_next' || id.startsWith('deal_book_post')) return; // deals.js

    // ── postflight how-to-book button ─────────────────────────────────────────
    // ── Application Accept/Reject buttons ─────────────────────────────────────
    if (id.startsWith('appaccept_') || id.startsWith('appreject_')) {
      const staffRoleId = process.env.STAFF_ROLE_ID;
      if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
        return interaction.reply({ content: '❌ Only staff can review applications.', ephemeral: true });
      }

      const isAccept = id.startsWith('appaccept_');
      const appId = id.replace('appaccept_', '').replace('appreject_', '');

      const { getApplication, updateApplication, getApplicationType } = require('./firebase');
      const app = await getApplication(appId);
      if (!app) return interaction.reply({ content: '❌ Application not found.', ephemeral: true });
      if (app.status !== 'pending') return interaction.reply({ content: `⚠️ This application is already **${app.status}**.`, ephemeral: true });

      if (isAccept) {
        // Accept flow
        await updateApplication(appId, { status: 'accepted', reviewed_by: interaction.user.id, reviewed_at: Date.now() });

        // Auto-assign role if configured
        const appType = await getApplicationType(app.type_id);
        let roleGranted = false;
        if (appType?.role_id) {
          try {
            const member = await interaction.guild.members.fetch(app.discord_id).catch(() => null);
            if (member) { await member.roles.add(appType.role_id); roleGranted = true; }
          } catch (err) { console.error('Role grant failed:', err.message); }
        }

        // Update embed to show accepted
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const accepted = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0x00B050)
          .setTitle(`✅ ACCEPTED — ${app.type_title}`)
          .addFields({ name: '✅ Reviewed By', value: `<@${interaction.user.id}>`, inline: true });

        await interaction.update({ embeds: [accepted], components: [] });

        // DM applicant
        try {
          const user = await interaction.client.users.fetch(app.discord_id);
          await user.send({
            embeds: [new EmbedBuilder()
              .setColor(0x00B050)
              .setTitle('🎉 Application Accepted!')
              .setThumbnail('https://i.postimg.cc/SRMftcKS/vna.jpg')
              .setDescription(`Congratulations! Your application for **${app.type_title}** at **Vietnam Airlines Group | PTFS** has been **accepted**!`)
              .addFields(
                { name: '🎖️ Role Granted', value: roleGranted ? `<@&${appType.role_id}>` : 'Staff will assign your role shortly.', inline: false },
              )
              .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
              .setTimestamp()],
          }).catch(() => {});
        } catch {}

      } else {
        // Reject flow — ask for reason via modal
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder: AR } = require('discord.js');
        const modal = new ModalBuilder().setCustomId(`appreject_reason_${appId}`).setTitle('Rejection Reason');
        modal.addComponents(
          new AR().addComponents(
            new TextInputBuilder().setCustomId('reason').setLabel('Reason for rejection').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)
          )
        );
        await interaction.showModal(modal);

        const submitted = await interaction.awaitModalSubmit({
          time: 120_000,
          filter: m => m.user.id === interaction.user.id && m.customId === `appreject_reason_${appId}`,
        }).catch(() => null);

        if (!submitted) return;
        const reason = submitted.fields.getTextInputValue('reason');

        await updateApplication(appId, { status: 'rejected', reviewed_by: interaction.user.id, reviewed_at: Date.now(), rejection_reason: reason });

        const { EmbedBuilder } = require('discord.js');
        const rejected = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0xFF0000)
          .setTitle(`❌ REJECTED — ${app.type_title}`)
          .addFields(
            { name: '❌ Reviewed By', value: `<@${interaction.user.id}>`, inline: true },
            { name: '📝 Reason', value: reason, inline: false },
          );

        await submitted.update({ embeds: [rejected], components: [] });

        // DM applicant with reason
        try {
          const user = await interaction.client.users.fetch(app.discord_id);
          await user.send({
            embeds: [new EmbedBuilder()
              .setColor(0xFF0000)
              .setTitle('❌ Application Not Successful')
              .setThumbnail('https://i.postimg.cc/SRMftcKS/vna.jpg')
              .setDescription(`Thank you for applying for **${app.type_title}** at **Vietnam Airlines Group | PTFS**.\n\nUnfortunately, your application was not successful at this time.`)
              .addFields(
                { name: '📝 Reason', value: reason, inline: false },
                { name: '🔄 Re-apply', value: 'You may re-apply after 24 hours.', inline: false },
              )
              .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
              .setTimestamp()],
          }).catch(() => {});
        } catch {}
      }
      return;
    }

    // ── Welcome message "Book a Flight" button ────────────────────────────────
    if (id === 'welcome_book') {
      return interaction.reply({
        content: '🎫 Use `/flights` to see what\'s scheduled, then `/book flight [flightnumber] [class]` to book your seat!',
        ephemeral: true,
      }).catch(() => {});
    }

    if (id.startsWith('howtobook_') || id.startsWith('quickbook_')) {
      const flightNumber = id.replace('howtobook_', '').replace('quickbook_', '');
      return interaction.reply({
        content: [
          `## 🎫 How to Book Flight **${flightNumber}**`,
          `Type this command in any channel:`,
          `\`/book flight flightnumber:${flightNumber} class:economy\``,
          '',
          '> 💺 Change `class:economy` to `class:business` for Business Class',
          '> 🗺️ You will then see an interactive seat map to pick your seat!',
        ].join('\n'),
        ephemeral: true,
      }).catch(() => {});
    }

    if (id.startsWith('pf_book_')) {
      const flightNumber = id.replace('pf_book_', '');

      try {
        await interaction.deferReply({ ephemeral: true });
      } catch (err) {
        return;
      }

      const { sendSeatMapDM } = require('./bookFlow');

      const sent = await sendSeatMapDM(interaction.user, interaction.guild, flightNumber, 'economy').catch(err => {
        console.error('sendSeatMapDM failed:', err.message);
        return false;
      });

      if (sent) {
        await interaction.editReply({ content: `✅ Check your DMs! I've sent you the seat map for **${flightNumber}**.` }).catch(() => {});
      } else {
        await interaction.editReply({
          content: [
            `❌ I couldn't send you a DM.`,
            ``,
            `**To fix this:**`,
            `> 1️⃣ Right-click the server icon → Privacy Settings → Enable "Direct Messages"`,
            `> 2️⃣ Click the button again, OR run \`/book flight flightnumber:${flightNumber} class:economy\` manually.`,
          ].join('\n'),
        }).catch(() => {});
      }
    }

    if (id === 'browse_deals') {
      return interaction.reply({
        content: '> 🏷️ Use `/deals` to browse all current deals!',
        ephemeral: true,
      }).catch(() => {});
    }
    if (id.startsWith('rsvp_')) {
      const eventId = id.replace('rsvp_', '');
      try {
        const { rsvpEvent } = require('./firebase');
        const result = await rsvpEvent(eventId, interaction.user.id, interaction.user.username);
        if (result === 'already') {
          return interaction.reply({ content: `⚠️ You've already RSVP'd to this event!`, ephemeral: true });
        }
        return interaction.reply({ content: `✅ RSVP confirmed! See you at the event! ✈️`, ephemeral: true });
      } catch (err) {
        console.error('RSVP error:', err);
        return interaction.reply({ content: '❌ Failed to RSVP. Try `/rsvp` instead.', ephemeral: true }).catch(() => {});
      }
    }

    // ── Catch-all ──────────────────────────────────────────────────────────────
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate().catch(() => {});
    }
  }
});

// ── Birthday Checker — runs once a day, posts to configured channel ──────────
async function checkBirthdays() {
  try {
    const { getBirthdays, getBirthdayConfig, updateBirthdayConfig } = require('./firebase');
    const config = await getBirthdayConfig();
    if (!config.channel_id) return;

    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const dateKey = `${month}-${day}`;
    const lastAnnounced = config.last_announced || {};

    if (lastAnnounced[dateKey]) return; // already posted today

    const birthdays = await getBirthdays();
    const todaysBirthdays = birthdays.filter(b => b.day === day && b.month === month);

    if (!todaysBirthdays.length) return;

    const channel = await client.channels.fetch(config.channel_id).catch(() => null);
    if (!channel) return;

    const { EmbedBuilder } = require('discord.js');
    const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

    for (const b of todaysBirthdays) {
      const embed = new EmbedBuilder()
        .setColor(0xC4972A)
        .setTitle('🎉 Happy Birthday!')
        .setThumbnail(LOGO)
        .setDescription(`🎂 Everyone wish <@${b.discord_id}> a very happy birthday today! 🎈`)
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
        .setTimestamp();
      await channel.send({ content: `<@${b.discord_id}>`, embeds: [embed] }).catch(() => {});
    }

    await updateBirthdayConfig({ last_announced: { ...lastAnnounced, [dateKey]: true } });
  } catch (err) {
    console.error('Birthday check failed:', err.message);
  }
}

// ── Welcome New Members ───────────────────────────────────────────────────────
client.on('guildMemberAdd', async (member) => {
  try {
    const { getWelcomeConfig } = require('./firebase');
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

    const config = await getWelcomeConfig();
    if (!config.channel_id) return; // Not set up yet

    // Auto-assign role
    if (config.role_id) {
      await member.roles.add(config.role_id).catch(err => {
        console.error('Welcome role assignment failed:', err.message);
      });
    }

    const memberCount = member.guild.memberCount;

    const embed = new EmbedBuilder()
      .setColor(0x007B8A)
      .setTitle('🇻🇳 Welcome to Vietnam Airlines Group | PTFS!')
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }) || LOGO)
      .setDescription([
        `👋 Welcome aboard, <@${member.id}>!`,
        '',
        `We're thrilled to have you join **Vietnam Airlines Group | PTFS** — *Sải Cánh Vươn Cao*.`,
        `You're our **${memberCount.toLocaleString()}** member!`,
        '',
        'Use the buttons below to get started, and `/help` any time to see all bot commands.',
      ].join('\n'))
      .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
      .setTimestamp();

    const row = new ActionRowBuilder();
    if (config.rules_url) {
      row.addComponents(new ButtonBuilder().setLabel('📋 Rules').setStyle(ButtonStyle.Link).setURL(config.rules_url));
    }
    if (config.handbook_url) {
      row.addComponents(new ButtonBuilder().setLabel('📖 Handbook').setStyle(ButtonStyle.Link).setURL(config.handbook_url));
    }
    row.addComponents(
      new ButtonBuilder().setCustomId('welcome_book').setLabel('✈️ Book a Flight').setStyle(ButtonStyle.Success),
    );

    // Post in welcome channel
    const channel = await client.channels.fetch(config.channel_id).catch(() => null);
    if (channel) {
      await channel.send({
        content: `<@${member.id}>`,
        embeds: [embed],
        components: row.components.length ? [row] : [],
      }).catch(() => {});
    }

    // DM the new member
    if (config.dm_enabled) {
      const dmEmbed = new EmbedBuilder()
        .setColor(0x007B8A)
        .setTitle('🇻🇳 Welcome to Vietnam Airlines Group | PTFS!')
        .setThumbnail(LOGO)
        .setDescription([
          `Hey ${member.user.username}! 👋`,
          '',
          `Thanks for joining **Vietnam Airlines Group | PTFS**. Here's how to get started:`,
          '',
          '✈️ Use `/flights` to see what\'s currently scheduled',
          '🎫 Use `/book flight` to book your first flight with an interactive seat map',
          '📖 Use `/help` any time to browse all commands',
          '',
          config.rules_url ? `📋 Please read the rules: ${config.rules_url}` : '',
          config.handbook_url ? `📖 Full guide: ${config.handbook_url}` : '',
        ].filter(Boolean).join('\n'))
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
        .setTimestamp();

      await member.send({ embeds: [dmEmbed] }).catch(() => {
        console.log(`Could not DM new member ${member.user.username} — DMs likely closed.`);
      });
    }
  } catch (err) {
    console.error('Welcome handler error:', err.message);
  }
});


client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    const oldBoostedAt = oldMember.premiumSinceTimestamp;
    const newBoostedAt = newMember.premiumSinceTimestamp;

    // Member just started boosting (wasn't boosting before, is now)
    if (!oldBoostedAt && newBoostedAt) {
      const { EmbedBuilder } = require('discord.js');
      const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

      const channelId = process.env.BOOST_CHANNEL_ID;
      const channel = channelId
        ? await client.channels.fetch(channelId).catch(() => null)
        : newMember.guild.systemChannel;

      if (!channel) return;

      const boostCount = newMember.guild.premiumSubscriptionCount || 0;

      const embed = new EmbedBuilder()
        .setColor(0xFF73FA)
        .setTitle('🚀 Thank You for Boosting!')
        .setThumbnail(LOGO)
        .setDescription(`💖 <@${newMember.id}> just boosted **Vietnam Airlines Group | PTFS**! Thank you so much for your support!`)
        .addFields({ name: '✨ Total Server Boosts', value: `${boostCount}`, inline: true })
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
        .setTimestamp();

      await channel.send({ content: `<@${newMember.id}>`, embeds: [embed] }).catch(() => {});
    }
  } catch (err) {
    console.error('Boost handler error:', err.message);
  }
});

client.once('ready', () => {
    console.log(`✈️ Vietnam Airlines Group | PTFS Bot is online as ${client.user.tag}`);
    client.user.setActivity('Vietnam Airlines Group | PTFS | /help', { type: 3 });

    // Check birthdays on startup, then every 6 hours
    checkBirthdays();
    setInterval(checkBirthdays, 6 * 60 * 60 * 1000);

    // ── Daily flight board at 06:00 ICT ──────────────────────────────────────────
    async function scheduleDailyFlightBoard() {
      const { getConfig } = require('./firebase');
      const { buildAndPostBoard } = require('./commands/postflightboard');

      const now = new Date(Date.now() + 7 * 60 * 60 * 1000); // current ICT time
      const next6AM = new Date(now);
      next6AM.setUTCHours(23, 0, 0, 0); // 23:00 UTC = 06:00 ICT next day

      // If 06:00 ICT hasn't passed yet today, post today
      if (now.getUTCHours() < 23) {
        next6AM.setUTCDate(next6AM.getUTCDate()); // keep today
      } else {
        next6AM.setUTCDate(next6AM.getUTCDate() + 1); // move to tomorrow
      }

      const msUntilNext = next6AM.getTime() - (Date.now() + 7 * 60 * 60 * 1000);

      setTimeout(async () => {
        try {
          const config = await getConfig();
          if (config.flightboard_channel_id) {
            const guild = client.guilds.cache.first();
            await buildAndPostBoard(client, guild, config.flightboard_channel_id);
            console.log('✅ Daily flight board posted');
          }
        } catch (err) {
          console.error('Daily flight board failed:', err.message);
        }
        // Reschedule every 24 hours after first run
        setInterval(async () => {
          try {
            const config = await getConfig();
            if (config.flightboard_channel_id) {
              const guild = client.guilds.cache.first();
              await buildAndPostBoard(client, guild, config.flightboard_channel_id);
            }
          } catch (err) {
            console.error('Daily flight board failed:', err.message);
          }
        }, 24 * 60 * 60 * 1000);
      }, msUntilNext);

      console.log(`✅ Flight board scheduled — next post in ${Math.round(msUntilNext / 60000)} minutes`);
    }

    scheduleDailyFlightBoard();
});

    // ── Login to Discord ────────────────────────────────────────────────────────
    if (!process.env.DISCORD_TOKEN) {
      console.error('❌ DISCORD_TOKEN is not set — bot cannot go online.');
    } else {
      client.login(process.env.DISCORD_TOKEN).catch(err => {
        console.error('❌ Discord login failed:', err);
        process.exit(1);
      });
    }
