# Spoiler Support + Full Components v2 Migration

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add a `spoiler` boolean to media objects, migrate all entity card displays from `EmbedBuilder` to Components v2 containers with spoiler-aware thumbnails/banners, and deprecate `original_bot_utils.js`.

**Architecture:** Traditional Discord embeds do NOT support image spoilers. Components v2 does via `ThumbnailBuilder.setSpoiler()`, `MediaGalleryItemBuilder.setSpoiler()`, and `ContainerBuilder.setSpoiler()`. Full migration to containers — no hybrid approach.

**Tech Stack:** discord.js 14.25.1, MongoDB/Mongoose, Node.js 25

---

## Step 1: Deprecate `original_bot_utils.js`

**Objective:** Mark the old monolithic file as deprecated so no one adds new code to it.

**Files:**
- Modify: `C:\Users\Jardin\Documents\GitHub\Team-Calendula\Chameleon\discord_commands\functions\original_bot_utils.js`

**Change:** Add at the very top of the file:
```js
/**
 * @deprecated This file is DEPRECATED. Do not add new code here.
 * All utilities have been migrated to the modular bot_utils/ directory:
 *   bot_utils/index.js — barrel exports
 *   bot_utils/display.js — display helpers
 *   bot_utils/r2Media.js — R2 media operations
 *   bot_utils/response.js — prefix command responses
 *   bot_utils/entityHandlers.js — entity field handlers
 *   bot_utils/entitySearch.js — entity search
 *   bot_utils/privacy.js — privacy/visibility
 *   bot_utils/formatting.js — formatting utilities
 *   bot_utils/sessions.js — session management
 *   bot_utils/args.js — argument parsing
 *   bot_utils/userSystem.js — user/system management
 *   bot_utils/helpers.js — misc helpers
 *   bot_utils/logging.js — guild logging
 *   bot_utils/embedColors.js — embed color helpers
 *   bot_utils/constants.js — constants
 *   bot_utils/proxyValidation.js — proxy validation
 *   bot_utils/entityLinking.js — entity linking
 *
 * Components v2 migration note: Entity card builders (buildAlterCard,
 * buildGroupCard, buildStateCard, buildSystemCard) now use
 * Components v2 containers instead of EmbedBuilder.
 *
 * This file is kept only for functions still referenced by legacy code.
 * New features should go in the appropriate bot_utils/ module.
 */
```

**Verification:** File still loads without syntax errors.

---

## Step 2: Add `spoiler` field to `mediaSchema`

**Objective:** Add a boolean `spoiler` field defaulting to `false` on the shared media schema.

**Files:**
- Modify: `C:\Users\Jardin\Documents\GitHub\Team-Calendula\media.js`

**Change:** Add after the `uploadedAt` field:
```js
spoiler: {
  type: Boolean,
  default: false
}
```

**Why this works everywhere:** `mediaSchema` is the sub-schema for ALL media fields (avatar, banner, proxyAvatar, etc.) across alters, states, groups, and systems. Existing documents without `spoiler` will default to `false`.

**Verification:** MongoDB documents still load. New field defaults to `false`.

---

## Step 3: Build Components v2 card builder in bot_utils

**Objective:** Create a reusable container-based card builder that replaces `EmbedBuilder` for entity displays.

**Files:**
- Create: `C:\Users\Jardin\Documents\GitHub\Team-Calendula\Chameleon\discord_commands\functions\bot_utils\containerCard.js`

**Design:**
```js
// containerCard.js — Components v2 entity card builder
// Replaces EmbedBuilder-based card construction for alter/state/group/system displays.

const {
    ContainerBuilder,
    TextDisplayBuilder,
    SectionBuilder,
    ThumbnailBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SeparatorBuilder,
    SeparatorSpacing,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} = require('discord.js');

/**
 * Build a Components v2 container card for an entity.
 *
 * @param {Object} options
 * @param {Object} options.entity - The entity document
 * @param {string} options.type - 'alter' | 'state' | 'group' | 'system'
 * @param {Object} options.system - The system document (for color fallback)
 * @param {string} options.displayName - Resolved display name
 * @param {string} [options.description] - Entity description
 * @param {string} [options.avatarUrl] - Resolved avatar URL
 * @param {boolean} [options.avatarSpoiler=false] - Whether avatar is spoilered
 * @param {string} [options.bannerUrl] - Resolved banner URL
 * @param {boolean} [options.bannerSpoiler=false] - Whether banner is spoilered
 * @param {string} [options.authorName] - Author text (e.g. system name)
 * @param {string} [options.authorIconUrl] - Author icon URL
 * @param {Array<{name: string, value: string, inline?: boolean}>} [options.fields] - Info fields
 * @param {Object} [options.caution] - Caution data { type, detail, triggers[] }
 * @param {string} [options.signoff] - Entity signoff
 * @param {string[]} [options.proxies] - Proxy list
 * @param {string[]} [options.aliases] - Alias list
 * @param {string[]} [options.pronouns] - Pronoun list
 * @param {string} [options.birthday] - Formatted birthday
 * @param {Array} [options.buttons] - Button definitions for action rows
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

    // --- Author line (if provided) ---
    if (authorName) {
        const authorText = authorIconUrl
            ? `[${authorName}](${authorIconUrl})`
            : authorName;
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(authorText)
        );
    }

    // --- Title ---
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${displayName}`)
    );

    // --- Description ---
    if (description) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(description)
        );
    }

    // --- Section: info fields + thumbnail accessory ---
    const fieldTexts = [];
    for (const field of fields) {
        const prefix = field.inline ? '' : '';
        fieldTexts.push(`**${field.name}:** ${field.value}`);
    }
    // Add pronouns, birthday, aliases, signoff, proxies to field text
    if (pronouns?.length) fieldTexts.push(`**Pronouns:** ${pronouns.join(', ')}`);
    if (birthday) fieldTexts.push(`**Birthday:** ${birthday}`);
    if (aliases?.length) fieldTexts.push(`**Aliases:** ${aliases.join(', ')}`);
    if (signoff) fieldTexts.push(`**Sign-off:** ${signoff}`);
    if (proxies?.length) fieldTexts.push(`**Proxies:** ${proxies.join(', ')}`);

    if (fieldTexts.length > 0) {
        const section = new SectionBuilder();

        // Add up to 3 TextDisplays per section limit
        const chunks = [];
        for (let i = 0; i < fieldTexts.length; i += 3) {
            chunks.push(fieldTexts.slice(i, i + 3));
        }

        for (const chunk of chunks) {
            section.addTextDisplayComponents(
                ...chunk.map(text => new TextDisplayBuilder().setContent(text))
            );
        }

        // Thumbnail accessory (avatar)
        if (avatarUrl) {
            section.setThumbnailAccessory((thumb) => {
                thumb.setURL(avatarUrl);
                if (avatarSpoiler) thumb.setSpoiler(true);
            });
        }

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
                .setStyle(btn.style || ButtonStyle.Secondary);
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
```

**Verification:** File loads without errors. `buildEntityCard()` returns `{ components, flags }`.

---

## Step 4: Add spoiler toggle to entity handler factories

**Objective:** Add a `spoilerToggle` handler factory in `entityHandlers.js`.

**Files:**
- Modify: `C:\Users\Jardin\Documents\GitHub\Team-Calendula\Chameleon\discord_commands\functions\bot_utils\entityHandlers.js`

**Add new factory function:**
```js
/**
 * Create a handler that toggles the spoiler boolean on a media field.
 * @param {Function} getter - (message, entityName) => { entity, system } | null
 * @param {string} mediaFieldPath - Dot path to the media object (e.g. 'discord.image.banner')
 * @param {string} displayName - Human-readable name for messages
 * @returns {Function} async (message, parsed, entityName) => void
 */
function spoilerToggle(getter, mediaFieldPath, displayName) {
    return async (message, parsed, entityName) => {
        const result = await getter(message, entityName);
        if (!result || !result.entity) return;
        const { entity } = result;

        const mediaObj = getNested(entity, mediaFieldPath);
        if (!mediaObj || !mediaObj.url) {
            return utils.error(message, `No ${displayName.toLowerCase()} set to spoiler.`);
        }

        const currentSpoiler = mediaObj.spoiler || false;
        mediaObj.spoiler = !currentSpoiler;
        await entity.save();

        return utils.success(message,
            `${displayName} spoiler: **${!currentSpoiler ? 'ON' : 'OFF'}**`
        );
    };
}
```

**Export it** in `module.exports`.

**Verification:** Function is importable and handles missing media gracefully.

---

## Step 5: Register spoiler commands in prefix command files

**Objective:** Add `spoiler` subcommands to alter, state, group, and system prefix commands.

**Files:**
- Modify: `C:\Users\Jardin\Documents\GitHub\Team-Calendula\Chameleon\discord_commands\global\prefix\alter.js`
- Modify: `C:\Users\Jardin\Documents\GitHub\Team-Calendula\Chameleon\discord_commands\global\prefix\state.js`
- Modify: `C:\Users\Jardin\Documents\GitHub\Team-Calendula\Chameleon\discord_commands\global\prefix\group.js`
- Modify: `C:\Users\Jardin\Documents\GitHub\Team-Calendula\Chameleon\discord_commands\global\prefix\system.js`

**Pattern for each** (example for alter.js):
```js
// In the subcommand map, alongside 'banner', 'avatar', etc:
'spoiler': {
    'banner': spoilerToggle(getAlterEntity, 'discord.image.banner', 'Banner'),
    'avatar': spoilerToggle(getAlterEntity, 'discord.image.avatar', 'Avatar'),
    'proxyavatar': spoilerToggle(getAlterEntity, 'discord.image.proxyAvatar', 'Proxy Avatar'),
    'pav': spoilerToggle(getAlterEntity, 'discord.image.proxyAvatar', 'Proxy Avatar'),
},
```

**Usage:** `!alter spoiler banner [entity name]` — toggles spoiler on/off.

---

## Step 6: Register spoiler commands in slash command files

**Objective:** Add spoiler toggle subcommand to each entity's slash command.

**Files:**
- Modify: `C:\Users\Jardin\Documents\GitHub\Team-Calendula\Chameleon\discord_commands\global\slash\alter.js`
- Modify: `C:\Users\Jardin\Documents\GitHub\Team-Calendula\Chameleon\discord_commands\global\slash\state.js`
- Modify: `C:\Users\Jardin\Documents\GitHub\Team-Calendula\Chameleon\discord_commands\global\slash\group.js`
- Modify: `C:\Users\Jardin\Documents\GitHub\Team-Calendula\Chameleon\discord_commands\global\slash\system.js`

**Approach:** Add a `spoiler` subcommand group with `banner`, `avatar`, `proxyavatar` sub-options, each taking an entity name argument.

---

## Step 7: Migrate card builders to use `buildEntityCard()`

**Objective:** Replace `EmbedBuilder`-based card construction with the new container builder.

**Files:**
- Modify: `C:\Users\Jardin\Documents\GitHub\Team-Calendula\Chameleon\discord_commands\global\slash\alter.js` — `buildAlterCard()`
- Modify: `C:\Users\Jardin\Documents\GitHub\Team-Calendula\Chameleon\discord_commands\global\slash\state.js` — `buildStateCard()`
- Modify: `C:\Users\Jardin\Documents\GitHub\Team-Calendula\Chameleon\discord_commands\global\slash\group.js` — `buildGroupCard()`
- Modify: `C:\Users\Jardin\Documents\GitHub\Team-Calendula\Chameleon\discord_commands\global\slash\system.js` — `buildSystemCard()`
- Modify: `C:\Users\Jardin\Documents\GitHub\Team-Calendula\Chameleon\discord_commands\global\prefix\alter.js` — alter card builder
- Modify: `C:\Users\Jardin\Documents\GitHub\Team-Calendula\Chameleon\discord_commands\global\prefix\group.js` — group card builder
- Modify: `C:\Users\Jardin\Documents\GitHub\Team-Calendula\Chameleon\discord_commands\global\prefix\system.js` — system card builder
- Modify: `C:\Users\Jardin\Documents\GitHub\Team-Calendula\Chameleon\discord_commands\global\slash\whois.js` — `buildDMEmbed()`

**Pattern:**
```js
// BEFORE:
const embed = new EmbedBuilder().setColor(color).setTitle(name);
if (avatarUrl) embed.setThumbnail(avatarUrl);
if (bannerUrl) embed.setImage(bannerUrl);
return embed;

// AFTER:
return buildEntityCard({
    entity, type: 'alter', system,
    displayName, description,
    avatarUrl,
    avatarSpoiler: alter.discord?.image?.avatar?.spoiler || false,
    bannerUrl,
    bannerSpoiler: alter.discord?.image?.banner?.spoiler || false,
    caution: alter.caution,
    pronouns: alter.pronouns,
    birthday: alter.birthday ? utils.formatDate(alter.birthday) : null,
    aliases: alter.name?.aliases,
    signoff: alter.signoff,
    proxies: alter.proxy,
});
```

**Send change:**
```js
// BEFORE:
message.channel.send({ embeds: [embed] });

// AFTER:
const card = buildEntityCard({ ... });
message.channel.send(card);
```

---

## Step 8: Update log embeds comment

**Objective:** Log embeds (`buildLogEmbed` in `logging.js`) use `EmbedBuilder` for proxy/edit/delete/reproxy events. These don't show entity banners and don't need spoilers. Add a comment explaining this is intentional.

**Files:**
- Modify: `C:\Users\Jardin\Documents\GitHub\Team-Calendula\Chameleon\discord_commands\functions\bot_utils\logging.js`

**Add comment above `buildLogEmbed`:**
```js
// NOTE: Log embeds intentionally use EmbedBuilder (not Components v2)
// because they don't display entity banners/thumbnails and don't need
// spoiler support. Entity card displays use buildEntityCard() from containerCard.js.
```

---

## Step 9: Test end-to-end

**Test cases:**
1. Set banner: `!alter banner [entity] [image]`
2. Toggle spoiler: `!alter spoiler banner [entity]` → "Banner spoiler: **ON**"
3. View card: `!alter card [entity]` → banner shows with blur overlay
4. Toggle off: `!alter spoiler banner [entity]` → "Banner spoiler: **OFF**"
5. Same for avatar, proxyAvatar
6. Same for groups, states, system
7. Slash commands: `/alter card [entity]`, `/alter spoiler banner [entity]`
8. Verify `!whois` card still works with containers

---

## Risks & Trade-offs

1. **Visual change** — Cards switch from embed style to container style. Accent-colored sidebar instead of thin embed border. Slightly different spacing.

2. **Section 3-textDisplay limit** — Each `SectionBuilder` can hold max 3 `TextDisplay` components. Cards with many fields need multiple sections or field consolidation.

3. **4000 char text limit** — All text across all TextDisplays in a message must be under 4000 chars. Entity cards with long descriptions may need truncation.

4. **Components v2 messages can't have embeds** — If any code path sends both an embed and a container in the same message, it will break. Review all `message.channel.send()` calls.

5. **Message editing** — Editing a Components v2 message to opt into v2 requires setting `content`, `embeds`, `poll`, `stickers` to `null`.

6. **Privacy gating** — `buildPrivacyGatedFields()` in whois.js produces embed fields. Adapt to produce fields array for `buildEntityCard()`.

---

## Files Summary

| File | Action |
|------|--------|
| `media.js` | Add `spoiler` field |
| `original_bot_utils.js` | Add deprecation comment |
| `bot_utils/containerCard.js` | **NEW** — Components v2 card builder |
| `bot_utils/entityHandlers.js` | Add `spoilerToggle` factory |
| `bot_utils/logging.js` | Add intentional-embeds comment |
| `slash/alter.js` | Migrate card builder + add spoiler command |
| `slash/state.js` | Migrate card builder + add spoiler command |
| `slash/group.js` | Migrate card builder + add spoiler command |
| `slash/system.js` | Migrate card builder + add spoiler command |
| `slash/whois.js` | Migrate card builder |
| `prefix/alter.js` | Migrate card builder + add spoiler command |
| `prefix/group.js` | Migrate card builder + add spoiler command |
| `prefix/system.js` | Migrate card builder + add spoiler command |
