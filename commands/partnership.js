const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} = require('discord.js');
const { getPartnerships, getPartnership, addPartnership, removePartnership } = require('../firebase');
require('dotenv').config();

const LOGO = 'https://i.postimg.cc/SRMftcKS/vna.jpg';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('partnership')
    .setDescription('Manage Vietnam Airlines Group | PTFS airline partnerships')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('[STAFF] Add a new partner airline')
        .addStringOption(opt => opt.setName('name').setDescription('Partner airline name').setRequired(true))
        .addStringOption(opt => opt.setName('logo').setDescription('Partner airline logo URL').setRequired(true))
        .addStringOption(opt => opt.setName('discordlink').setDescription('Partner Discord invite link').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('Description of the partnership').setRequired(true))
        .addStringOption(opt => opt.setName('banner').setDescription('Banner image URL (optional)').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Browse all Vietnam Airlines Group | PTFS partner airlines'))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('[STAFF] Remove a partnership')
        .addStringOption(opt => opt.setName('name').setDescription('Partner airline name').setRequired(true))
        .addBooleanOption(opt => opt.setName('confirm').setDescription('Confirm removal').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('post')
        .setDescription('[STAFF] Post a partnership announcement')
        .addStringOption(opt => opt.setName('name').setDescription('Partner airline name').setRequired(true))
        .addStringOption(opt => opt.setName('channel').setDescription('Channel ID (leave empty for current)').setRequired(false))
        .addRoleOption(opt => opt.setName('ping').setDescription('Role to ping').setRequired(false))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const staffRoleId = process.env.STAFF_ROLE_ID;

    // ══════════════════════════════════════════════════════════════════════════
    // ADD
    // ══════════════════════════════════════════════════════════════════════════
    if (sub === 'add') {
      await interaction.deferReply({ ephemeral: true });
      if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
        return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
      }

      const name = interaction.options.getString('name');
      const logo = interaction.options.getString('logo');
      const discordLink = interaction.options.getString('discordlink');
      const description = interaction.options.getString('description');
      const banner = interaction.options.getString('banner') || null;

      const id = await addPartnership({ name, logo, discord_link: discordLink, description, banner });

      const embed = new EmbedBuilder()
        .setColor(0x00B050)
        .setTitle('✅ Partnership Added')
        .setThumbnail(logo)
        .addFields(
          { name: '🤝 Partner', value: name, inline: true },
          { name: '🔗 Discord', value: `[Join Server](${discordLink})`, inline: true },
          { name: '📝 Description', value: description, inline: false },
          { name: '🔑 ID', value: `\`${id}\``, inline: false },
          { name: '\u200b', value: `> Use \`/partnership post ${name}\` to announce this partnership!`, inline: false },
        )
        .setFooter({ text: `Added by ${interaction.user.username} • Vietnam Airlines Group | PTFS` })
        .setTimestamp();

      if (banner) embed.setImage(banner);
      return interaction.editReply({ embeds: [embed] });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LIST
    // ══════════════════════════════════════════════════════════════════════════
    if (sub === 'list') {
      await interaction.deferReply();
      const partnerships = (await getPartnerships()).filter(p => p.status !== 'removed');

      if (!partnerships.length) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0x007B8A)
            .setTitle('🤝 Vietnam Airlines Group | PTFS — Partnerships')
            .setDescription('No partnerships yet. Check back soon!')
            .setThumbnail(LOGO)
            .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })],
        });
      }

      let page = 0;
      const total = partnerships.length;

      function buildEmbed(index) {
        const p = partnerships[index];
        const embed = new EmbedBuilder()
          .setColor(0x007B8A)
          .setTitle(`🤝 ${p.name}`)
          .setDescription(p.description || 'No description provided.')
          .setThumbnail(p.logo || LOGO)
          .addFields(
            { name: '🔗 Discord Server', value: p.discord_link ? `[Join Here](${p.discord_link})` : 'N/A', inline: false },
          )
          .setFooter({ text: `Partner ${index + 1} of ${total} • Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao` })
          .setTimestamp();
        if (p.banner) embed.setImage(p.banner);
        return embed;
      }

      function buildRow(index) {
        const p = partnerships[index];
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('pt_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
        );
        if (p.discord_link) {
          row.addComponents(
            new ButtonBuilder().setLabel('Join Partner Server').setStyle(ButtonStyle.Link).setURL(p.discord_link).setEmoji('🔗'),
          );
        }
        row.addComponents(
          new ButtonBuilder().setCustomId('pt_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(index === total - 1),
        );
        return row;
      }

      const msg = await interaction.editReply({ embeds: [buildEmbed(page)], components: [buildRow(page)] });

      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120_000,
        filter: i => i.user.id === interaction.user.id,
      });

      collector.on('collect', async (btn) => {
        try {
          if (btn.customId === 'pt_prev') page = Math.max(0, page - 1);
          if (btn.customId === 'pt_next') page = Math.min(total - 1, page + 1);
          await btn.update({ embeds: [buildEmbed(page)], components: [buildRow(page)] });
        } catch (err) {
          console.error('Partnership list collector error:', err.message);
        }
      });

      collector.on('end', () => { interaction.editReply({ components: [] }).catch(() => {}); });
      return;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // REMOVE
    // ══════════════════════════════════════════════════════════════════════════
    if (sub === 'remove') {
      await interaction.deferReply({ ephemeral: true });
      if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
        return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
      }

      const name = interaction.options.getString('name');
      const confirm = interaction.options.getBoolean('confirm');

      if (!confirm) return interaction.editReply({ content: '⚠️ Set `confirm` to `true` to proceed.' });

      const partnership = await getPartnership(name);
      if (!partnership) {
        const list = (await getPartnerships()).map(p => `• **${p.name}**`).join('\n');
        return interaction.editReply({ content: `❌ Partnership **"${name}"** not found.\n\nExisting:\n${list || 'None'}` });
      }

      await removePartnership(partnership.id);

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🗑️ Partnership Removed')
        .setThumbnail(partnership.logo || LOGO)
        .addFields({ name: '🤝 Partner', value: partnership.name, inline: true })
        .setFooter({ text: `Removed by ${interaction.user.username} • Vietnam Airlines Group | PTFS` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // POST
    // ══════════════════════════════════════════════════════════════════════════
    if (sub === 'post') {
      await interaction.deferReply({ ephemeral: true });
      if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
        return interaction.editReply({ content: '❌ You do not have permission to use this command.' });
      }

      const name = interaction.options.getString('name');
      const channelId = interaction.options.getString('channel');
      const pingRole = interaction.options.getRole('ping');

      const partnership = await getPartnership(name);
      if (!partnership) {
        const list = (await getPartnerships()).map(p => `• **${p.name}**`).join('\n');
        return interaction.editReply({ content: `❌ Partnership **"${name}"** not found.\n\nExisting:\n${list || 'None'}` });
      }

      const embed = new EmbedBuilder()
        .setColor(0x007B8A)
        .setTitle(`🤝 New Partnership — ${partnership.name}`)
        .setDescription([
          `📢 We're excited to announce our new partnership with **${partnership.name}**!`,
          '',
          partnership.description || '',
        ].join('\n'))
        .setThumbnail(partnership.logo || LOGO)
        .addFields(
          { name: '🔗 Join Their Server', value: partnership.discord_link ? `[Click Here](${partnership.discord_link})` : 'N/A', inline: false },
        )
        .setFooter({ text: 'Vietnam Airlines Group | PTFS • Sải Cánh Vươn Cao' })
        .setTimestamp();

      if (partnership.banner) embed.setImage(partnership.banner);

      const row = new ActionRowBuilder();
      if (partnership.discord_link) {
        row.addComponents(
          new ButtonBuilder().setLabel(`Join ${partnership.name}`).setStyle(ButtonStyle.Link).setURL(partnership.discord_link).setEmoji('🔗'),
        );
      }

      let targetChannel;
      if (channelId) {
        targetChannel = await interaction.client.channels.fetch(channelId).catch(() => null);
        if (!targetChannel) return interaction.editReply({ content: `❌ Channel \`${channelId}\` not found.` });
      } else {
        targetChannel = interaction.channel;
      }

      const pingContent = pingRole ? `<@&${pingRole.id}>` : null;
      await targetChannel.send({
        content: pingContent,
        embeds: [embed],
        components: row.components.length ? [row] : [],
      });

      return interaction.editReply({ content: `✅ Partnership announcement posted in <#${targetChannel.id}>!` });
    }
  },
};
