const { SlashCommandBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const { FOOTER, COLORS } = require('../config');

const FACTS = [
  "Vietnam Airlines was founded in 1956, making it one of Asia's oldest airlines.",
  "The Boeing 787-9 Dreamliner used by Vietnam Airlines can fly up to 14,140 km non-stop.",
  "Vietnam Airlines is a member of the SkyTeam global airline alliance.",
  "The Airbus A350-900 features a cabin humidity level higher than older aircraft, reducing passenger fatigue.",
  "Vietnam Airlines' Lotus Business class on the 787 and A350 features fully-flat beds.",
  "Tan Son Nhat International Airport in Ho Chi Minh City is the busiest airport in Vietnam.",
  "The cruising altitude of most commercial aircraft is around 35,000 feet.",
  "A Boeing 787's wings can flex up to 25 feet upward during flight — by design.",
  "Vietnam has over 22 airports, with Noi Bai in Hanoi and Tan Son Nhat in HCMC being the busiest.",
  "Turbulence is caused by changes in air movement and is rarely dangerous despite feeling scary.",
  "The Airbus A330 can carry over 266 passengers in Vietnam Airlines configuration.",
  "Pilots and co-pilots often eat different meals before a flight to avoid simultaneous food poisoning.",
  "The first commercial jet airliner, the de Havilland Comet, entered service in 1952.",
  "Cabin pressure at cruising altitude is equivalent to being at about 8,000 feet above sea level.",
  "Airports use the ICAO phonetic alphabet (Alpha, Bravo, Charlie...) to avoid miscommunication.",
  "Vietnam Airlines' LotusMiles program lets LotusMiless earn and redeem miles across SkyTeam partners.",
  "The Boeing 787 Dreamliner uses composite materials for about 50% of its airframe by weight.",
  "Noi Bai International Airport in Hanoi was designed by acclaimed architect Vo Trong Nghia.",
];

module.exports = {
  data: new SlashCommandBuilder().setName('fact').setDescription('Get a random aviation fact'),
  async execute(interaction) {
    const fact = FACTS[Math.floor(Math.random() * FACTS.length)];

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.primary)
      .addTextDisplayComponents(td => td.setContent('# ✈️ Aviation Fact'))
      .addTextDisplayComponents(td => td.setContent(fact))
      .addTextDisplayComponents(td => td.setContent('-# ' + FOOTER));

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
