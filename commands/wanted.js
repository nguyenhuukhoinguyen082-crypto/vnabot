const { SlashCommandBuilder, MessageFlags, ContainerBuilder, SectionBuilder, TextDisplayBuilder } = require('discord.js');
const { FOOTER, COLORS } = require('../config');

const CRIMES = [
  'Smuggling duty-free goods past customs',
  'Impersonating a pilot on the PA system',
  'Sneaking into the Lotus Lounge without membership',
  'Stealing Business Class amenity kits',
  'Crashing the flight simulator',
  'Reclining seat during meal service',
  'Refusing to stow carry-on luggage properly',
  'Unauthorized cockpit selfies',
  'Using phone in airplane mode incorrectly',
  'Hoarding all the lotus-shaped bread rolls',
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wanted')
    .setDescription('Create a WANTED poster for a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to put on the poster').setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const crime = CRIMES[Math.floor(Math.random() * CRIMES.length)];
    const bounty = (Math.floor(Math.random() * 50) + 1) * 1000;

    await interaction.reply({
      components: [
        new ContainerBuilder()
          .setAccentColor(COLORS.primary)
          .addSectionComponents(section =>
            section
              .addTextDisplayComponents(td => td.setContent('# 🤠 WANTED'))
              .addTextDisplayComponents(td => td.setContent(`# ${target.username}`))
              .setThumbnailAccessory(tb => tb.setURL(target.displayAvatarURL({ dynamic: true })))
          )
          .addTextDisplayComponents(td => td.setContent([
            `**Crime:** ${crime}`,
            `**Bounty:** ${bounty.toLocaleString()} VND`,
            '',
            `*Dead or Alive — Approach with caution*`,
          ].join('\n')))
          .addTextDisplayComponents(td => td.setContent(`-# ${FOOTER}`))
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
