const { MessageFlags, ContainerBuilder, SectionBuilder } = require('discord.js');
const { getWelcomeConfig } = require('../firebase');
const { LOGO, FOOTER, COLORS } = require('../config');
const { linkButton, successButton, actionRow } = require('../utils/v2');

async function handleWelcome(member) {
  try {
    const config = await getWelcomeConfig();
    if (!config.channel_id) return;

    if (config.role_id) {
      await member.roles.add(config.role_id).catch(err => {
        console.error('Welcome role assignment failed:', err.message);
      });
    }

    const memberCount = member.guild.memberCount;

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.primary)
      .addSectionComponents(section =>
        section
          .addTextDisplayComponents(td => td.setContent('# Welcome to Vietnam Airlines Group | PTFS!'))
          .setThumbnailAccessory(tb => tb.setURL(member.user.displayAvatarURL({ dynamic: true }) || LOGO))
      )
      .addTextDisplayComponents(td => td.setContent([
        `Welcome aboard, <@${member.id}>!`,
        '',
        `We're thrilled to have you join **Vietnam Airlines Group | PTFS** - *Sải Cánh Vươn Cao*.`,
        `You're our **${memberCount.toLocaleString()}** member!`,
        '',
        'Use the buttons below to get started, and `/help` any time to see all bot commands.',
      ].join('\n')))
      .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`))
      .addTextDisplayComponents(td => td.setContent(`-# <t:${Math.floor(Date.now() / 1000)}:R>`));

    const rowButtons = [];
    if (config.rules_url) rowButtons.push(linkButton('Rules', config.rules_url));
    if (config.handbook_url) rowButtons.push(linkButton('Handbook', config.handbook_url));
    rowButtons.push(successButton('welcome_book', 'Book a Flight'));
    const row = actionRow(...rowButtons);

    const channel = await member.guild.channels.fetch(config.channel_id).catch(() => null);
    if (channel) {
      await channel.send({
        content: `<@${member.id}>`,
        components: [container, row],
        flags: MessageFlags.IsComponentsV2,
      }).catch(() => {});
    }

    if (config.dm_enabled) {
      const dmContainer = new ContainerBuilder()
        .setAccentColor(COLORS.primary)
        .addSectionComponents(section =>
          section
            .addTextDisplayComponents(td => td.setContent('# Welcome to Vietnam Airlines Group | PTFS!'))
            .setThumbnailAccessory(tb => tb.setURL(LOGO))
        )
        .addTextDisplayComponents(td => td.setContent([
          `Hey ${member.user.username}!`,
          '',
          `Thanks for joining **Vietnam Airlines Group | PTFS**. Here's how to get started:`,
          '',
          '> `/flights` - see what\'s currently scheduled',
          '> `/book flight` - book your first flight with an interactive seat map',
          '> `/help` - browse all commands',
          '',
          config.rules_url ? `> Rules: ${config.rules_url}` : '',
          config.handbook_url ? `> Handbook: ${config.handbook_url}` : '',
        ].filter(Boolean).join('\n')))
        .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`))
        .addTextDisplayComponents(td => td.setContent(`-# <t:${Math.floor(Date.now() / 1000)}:R>`));

      await member.send({
        components: [dmContainer],
        flags: MessageFlags.IsComponentsV2,
      }).catch(() => {
        console.log(`Could not DM new member ${member.user.username} - DMs likely closed.`);
      });
    }
  } catch (err) {
    console.error('Welcome handler error:', err.message);
  }
}

module.exports = { handleWelcome };
