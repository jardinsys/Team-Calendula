// containerCard.js — Components v2 entity card builder
// Replaces EmbedBuilder-based card construction for alter/state/group/system displays.
// Supports spoiler on thumbnails and media galleries.

const {
    ContainerBuilder,
    TextDisplayBuilder,
    SectionBuilder,
    MediaGalleryBuilder,
    SeparatorBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    MessageFlags,
} = require('discord.js');

const display = require('./display');
const formatting = require('./formatting');
const { capitalize } = formatting;

/**
 * Build a Components v2 container card for an entity.
 *
 * @param {Object} options
 * @param {Object} options.entity - The entity document
 * @param {string} options.type - 'alter' | 'state' | 'group' | 'system'
 * @param {Object} [options.system] - The system document (for color fallback)
 * @param {string} options.displayName - Resolved display name
 * @param {string} [options.description] - Entity description
 * @param {string} [options.avatarUrl] - Resolved avatar URL
 * @param {boolean} [options.avatarSpoiler=false] - Whether avatar is spoilered
 * @param {string} [options.bannerUrl] - Resolved banner URL
 * @param {boolean} [options.bannerSpoiler=false] - Whether banner is spoilered
 * @param {string} [options.authorName] - Author text (e.g. system name)
 * @param {string} [options.authorIconUrl] - Author icon URL
 * @param {Array<{name: string, value: string}>} [options.fields] - Info fields as {name, value}
 * @param {Object} [options.caution] - Caution data { c_type, detail, triggers[] }
 * @param {string} [options.signoff] - Entity signoff
 * @param {string[]} [options.proxies] - Proxy list
 * @param {string[]} [options.aliases] - Alias list
 * @param {string[]} [options.pronouns] - Pronoun list
 * @param {string} [options.birthday] - Formatted birthday string
 * @param {Array} [options.buttons] - Button defs: { customId, label, style?, emoji?, disabled? }
 * @returns {{ components: ContainerBuilder[], flags: number }}
 */
function buildEntityCard(options) {
    const {
        entity, type, system,
        displayName, description,
        avatarUrl, avatarSpoiler = false,
        bannerUrl, bannerSpoiler = false,
        authorName, authorIconUrl,
        fields = [],
        caution, signoff, proxies, aliases, pronouns, birthday,
        buttons = [],
    } = options;

    const container = new ContainerBuilder();
    const accentColor = entity?.color || system?.color;
    if (accentColor) container.setAccentColor(accentColor);

    // --- Author line ---
    if (authorName) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                authorIconUrl
                    ? `[${authorName}](${authorIconUrl})`
                    : authorName
            )
        );
    }

    // --- Title ---
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${displayName}`)
    );

    // --- Description ---
    if (description) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(description.substring(0, 2000))
        );
    }

    // --- Build info field lines ---
    const infoLines = [];
    for (const field of fields) {
        infoLines.push(`**${field.name}:** ${field.value}`);
    }
    if (pronouns?.length) infoLines.push(`**Pronouns:** ${pronouns.join(', ')}`);
    if (birthday) infoLines.push(`**Birthday:** ${birthday}`);
    if (aliases?.length) infoLines.push(`**Aliases:** ${aliases.join(', ')}`);
    if (signoff) infoLines.push(`**Sign-off:** ${signoff}`);
    if (proxies?.length) infoLines.push(`**Proxies:** ${proxies.join(', ')}`);

    // --- Section: info + thumbnail ---
    if (infoLines.length > 0) {
        // SectionBuilder allows max 3 TextDisplays
        // Chunk info lines into groups of 3, create sections with thumbnail on first
        const chunks = [];
        for (let i = 0; i < infoLines.length; i += 3) {
            chunks.push(infoLines.slice(i, i + 3));
        }

        for (let ci = 0; ci < chunks.length; ci++) {
            const section = new SectionBuilder();
            for (const line of chunks[ci]) {
                section.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(line)
                );
            }

            // Thumbnail accessory only on first section
            if (ci === 0 && avatarUrl) {
                section.setThumbnailAccessory((thumb) => {
                    thumb.setURL(avatarUrl);
                    if (avatarSpoiler) thumb.setSpoiler(true);
                });
            }

            container.addSectionComponents(section);
        }
    } else if (avatarUrl) {
        // No info fields but have avatar — create a minimal section
        const section = new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`*${capitalize(type)}*`)
            )
            .setThumbnailAccessory((thumb) => {
                thumb.setURL(avatarUrl);
                if (avatarSpoiler) thumb.setSpoiler(true);
            });
        container.addSectionComponents(section);
    }

    // --- Caution ---
    if (caution && (caution.c_type || caution.detail || caution.triggers?.length)) {
        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true)
        );

        let cautionText = '### ⚠️ Caution\n';
        if (caution.c_type) cautionText += `**Type:** ${caution.c_type}\n`;
        if (caution.detail) cautionText += `**Details:** ${caution.detail}\n`;
        if (caution.triggers?.length) {
            const triggerNames = caution.triggers.map(t => t.name).filter(Boolean);
            if (triggerNames.length) cautionText += `**Triggers:** ${triggerNames.join(', ')}\n`;
        }

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(cautionText.trim())
        );
    }

    // --- Banner as media gallery (supports spoiler) ---
    if (bannerUrl) {
        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true)
        );

        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems((item) => {
                item.setURL(bannerUrl);
                if (bannerSpoiler) item.setSpoiler(true);
            })
        );
    }

    // --- Action buttons ---
    if (buttons.length > 0) {
        const actionRow = new ActionRowBuilder();
        for (const btn of buttons) {
            const button = new ButtonBuilder()
                .setCustomId(btn.customId)
                .setLabel(btn.label)
                .setStyle(btn.style || 2); // ButtonStyle.Secondary = 2
            if (btn.emoji) button.setEmoji(btn.emoji);
            if (btn.disabled) button.setDisabled(true);
            actionRow.addComponents(button);
        }
        container.addActionRowComponents(actionRow);
    }

    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    };
}

module.exports = { buildEntityCard };
