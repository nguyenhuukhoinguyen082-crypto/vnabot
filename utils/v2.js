const {
  ContainerBuilder, SectionBuilder,
  TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ThumbnailBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder,
} = require('discord.js');
const { LOGO, FOOTER, COLORS } = require('../config');

const VNA_FOOTER = FOOTER;

function ts() {
  return `<t:${Math.floor(Date.now() / 1000)}:R>`;
}

function tsFull(unix) {
  return unix ? `<t:${Math.floor(unix / 1000)}:F>` : 'TBA';
}

function brandedFooter(text) {
  return text ? `-# ${text} · ${VNA_FOOTER}` : `-# ${VNA_FOOTER}`;
}

function addFooter(container, text) {
  return container.addTextDisplayComponents(td => td.setContent(brandedFooter(text)));
}

function addTimestamp(container) {
  return container.addTextDisplayComponents(td => td.setContent(`-# ${ts()}`));
}

function addDivider(container, showLine = true, size = SeparatorSpacingSize.Small) {
  return container.addSeparatorComponents(sep => sep.setDivider(showLine).setSpacing(size));
}

function addSpacer(container, size = SeparatorSpacingSize.Large) {
  return container.addSeparatorComponents(sep => sep.setDivider(false).setSpacing(size));
}

function card(title, description, accentColor = COLORS.primary) {
  const c = new ContainerBuilder().setAccentColor(accentColor);
  if (title) c.addTextDisplayComponents(td => td.setContent(title));
  if (description) c.addTextDisplayComponents(td => td.setContent(description));
  return c;
}

function cardWithFooter(title, description, footer, accentColor = COLORS.primary) {
  const c = card(title, description, accentColor);
  addFooter(c, footer);
  return c;
}

function infoCard(title, description) {
  return card(title, description, COLORS.primary);
}

function successCard(title, description) {
  return card(title, description, COLORS.success);
}

function errorCard(description) {
  return card(null, `❌ ${description}`, COLORS.danger);
}

function warnCard(title, description) {
  return card(title, description, COLORS.warning);
}

function boostCard(description) {
  return card(null, description, COLORS.boost);
}

function fieldText(label, value) {
  return `**${label}:** ${value}`;
}

function fieldsText(entries) {
  return entries.map(([label, value]) => fieldText(label, value)).join('\n');
}

function infoText(heading, bodyLines) {
  const lines = Array.isArray(bodyLines) ? bodyLines : [bodyLines];
  return [`### ${heading}`, ...lines.map(l => `> ${l}`)].join('\n');
}

function sectionCard(title, description, thumbnailUrl, accentColor = COLORS.primary) {
  const section = new SectionBuilder();
  if (title) section.addTextDisplayComponents(td => td.setContent(title));
  if (description) section.addTextDisplayComponents(td => td.setContent(description));
  if (thumbnailUrl) section.setThumbnailAccessory(tb => tb.setURL(thumbnailUrl));
  return new ContainerBuilder()
    .setAccentColor(accentColor)
    .addSectionComponents(() => section);
}

function fieldContainer(entries, accentColor = COLORS.primary) {
  const c = new ContainerBuilder().setAccentColor(accentColor);
  for (const [label, value] of entries) {
    c.addTextDisplayComponents(td => td.setContent(fieldText(label, value)));
  }
  return c;
}

function fieldCard(title, entries, accentColor = COLORS.primary) {
  const c = new ContainerBuilder().setAccentColor(accentColor);
  if (title) c.addTextDisplayComponents(td => td.setContent(title));
  for (const [label, value] of entries) {
    addDivider(c, false, SeparatorSpacingSize.Small);
    c.addTextDisplayComponents(td => td.setContent(fieldText(label, value)));
  }
  return c;
}

function fieldSectionCard(title, fieldGroups, accentColor = COLORS.primary) {
  const c = new ContainerBuilder().setAccentColor(accentColor);
  if (title) c.addTextDisplayComponents(td => td.setContent(title));
  for (const [heading, entries] of fieldGroups) {
    addDivider(c, true, SeparatorSpacingSize.Small);
    c.addTextDisplayComponents(td => td.setContent(`## ${heading}`));
    for (const [label, value] of entries) {
      c.addTextDisplayComponents(td => td.setContent(`> ${fieldText(label, value)}`));
    }
  }
  return c;
}

function spacer(size = SeparatorSpacingSize.Large) {
  return new SeparatorBuilder().setDivider(false).setSpacing(size);
}

function divider(showLine = true, size = SeparatorSpacingSize.Small) {
  return new SeparatorBuilder().setDivider(showLine).setSpacing(size);
}

function text(content) {
  return new TextDisplayBuilder().setContent(content);
}

function navRow(customIdPrefix, currentIndex, total, userId) {
  const encoded = (action, idx) => `${customIdPrefix}:${action}:${idx}:${userId}`;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(encoded('prev', currentIndex))
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentIndex === 0),
    new ButtonBuilder()
      .setCustomId(encoded('indicator', currentIndex))
      .setLabel(`${currentIndex + 1} / ${total}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(encoded('next', currentIndex))
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentIndex === total - 1),
  );
}

function navRowCustom(label, currentIndex, total, userId) {
  const encoded = (action, idx) => `${label}:${action}:${idx}:${userId}`;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(encoded('prev', currentIndex))
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentIndex === 0),
    new ButtonBuilder()
      .setCustomId(encoded('indicator', currentIndex))
      .setLabel(`${currentIndex + 1} / ${total}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(encoded('next', currentIndex))
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentIndex === total - 1),
  );
}

function actionRow(...buttons) {
  return new ActionRowBuilder().addComponents(...buttons);
}

function button(customId, label, style = ButtonStyle.Secondary, disabled = false) {
  return new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(style)
    .setDisabled(disabled);
}

function linkButton(label, url) {
  return new ButtonBuilder()
    .setLabel(label)
    .setURL(url)
    .setStyle(ButtonStyle.Link);
}

function primaryButton(customId, label, disabled = false) {
  return button(customId, label, ButtonStyle.Primary, disabled);
}

function successButton(customId, label, disabled = false) {
  return button(customId, label, ButtonStyle.Success, disabled);
}

function dangerButton(customId, label, disabled = false) {
  return button(customId, label, ButtonStyle.Danger, disabled);
}

function selectMenu(customId, placeholder, options) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder);
  const opts = options.map(({ label, value, description, emoji, default: def }) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(label)
      .setValue(value)
      .setDescription(description || '')
      .setDefault(def || false)
  );
  menu.addOptions(...opts);
  return new ActionRowBuilder().addComponents(menu);
}

function mediaGallery(urls) {
  const gallery = new MediaGalleryBuilder();
  for (const url of urls) {
    gallery.addItems(item => item.setURL(url));
  }
  return gallery;
}

function confirmDialog(action, targetId, accentColor = COLORS.danger) {
  const c = new ContainerBuilder()
    .setAccentColor(accentColor)
    .addTextDisplayComponents(td => td.setContent(
      `## ⚠️ Confirm Action\nAre you sure you want to **${action}**? This cannot be undone.`
    ));
  addDivider(c, true, SeparatorSpacingSize.Small);
  c.addActionRowComponents(row =>
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_yes_${targetId}`)
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`confirm_no_${targetId}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    )
  );
  return c;
}

function profileCard(userData) {
  const c = new ContainerBuilder().setAccentColor(COLORS.primary);
  if (userData.avatarURL) {
    c.addSectionComponents(section =>
      section
        .addTextDisplayComponents(
          td => td.setContent(`# ${userData.displayName || 'User'}`),
          ...(userData.bio ? [td => td.setContent(userData.bio)] : []),
          ...(userData.fields?.length
            ? userData.fields.slice(0, 3).map(([label, value]) =>
                td => td.setContent(`> **${label}:** ${value}`)
              )
            : []
          ),
        )
        .setThumbnailAccessory(tb => tb.setURL(userData.avatarURL))
    );
  } else {
    c.addTextDisplayComponents(td => td.setContent(`# ${userData.displayName || 'User'}`));
    if (userData.bio) c.addTextDisplayComponents(td => td.setContent(userData.bio));
    for (const [label, value] of userData.fields?.slice(0, 5) || []) {
      c.addTextDisplayComponents(td => td.setContent(`> **${label}:** ${value}`));
    }
  }
  return c;
}

function removeNavButtons(components) {
  return components.filter(c =>
    !(c.data?.type === 1 &&
      c.data?.components?.some(b => b.custom_id?.includes(':prev:') || b.custom_id?.includes(':next:')))
  );
}

module.exports = {
  VNA_FOOTER,
  ts, tsFull,
  brandedFooter, addFooter, addTimestamp,
  addDivider, addSpacer,
  card, cardWithFooter,
  infoCard, successCard, errorCard, warnCard, boostCard,
  fieldText, fieldsText, infoText,
  sectionCard, fieldContainer, fieldCard, fieldSectionCard,
  spacer, divider, text,
  navRow, navRowCustom,
  actionRow, button,
  linkButton, primaryButton, successButton, dangerButton,
  selectMenu, mediaGallery,
  confirmDialog, profileCard,
  removeNavButtons,
};
