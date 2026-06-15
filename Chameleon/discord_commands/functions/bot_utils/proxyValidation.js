// Proxy Validation & Settings Utilities
// Proxy existence checking, validation, layout/modal builders, and style validation

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');

const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');

const display = require('./display');
const { getDisplayName, capitalize } = display;

const constants = require('./constants');
const { ITEMS_PER_PAGE } = constants;

// Find entity by name across alters, states, and groups
async function findEntityByNameForSystem(name, system) {
    const searchName = name.toLowerCase();

    const alters = await Alter.find({ _id: { $in: system.alters?.IDs || [] } });
    let entity = alters.find(a => a.name?.indexable?.toLowerCase() === searchName || a.name?.display?.toLowerCase() === searchName);
    if (entity) return { entity, type: 'alter' };

    const states = await State.find({ _id: { $in: system.states?.IDs || [] } });
    entity = states.find(s => s.name?.indexable?.toLowerCase() === searchName || s.name?.display?.toLowerCase() === searchName);
    if (entity) return { entity, type: 'state' };

    const groups = await Group.find({ _id: { $in: system.groups?.IDs || [] } });
    entity = groups.find(g => g.name?.indexable?.toLowerCase() === searchName || g.name?.display?.toLowerCase() === searchName);
    if (entity) return { entity, type: 'group' };

    return { entity: null, type: null };
}

// Build proxy settings embed
function buildProxySettingsEmbed(system) {
    const getLayoutDisplay = (layout) => {
        if (!layout) return '*Not set*';
        return layout.length > 50 ? layout.substring(0, 47) + '...' : layout;
    };

    return new EmbedBuilder()
        .setTitle('💬 Proxy Settings')
        .setDescription('Select which proxy setting you want to edit.')
        .addFields(
            {
                name: '🎭 Alter Layout',
                value: getLayoutDisplay(system.proxy?.layout?.alter),
                inline: false
            },
            {
                name: '🔄 State Layout',
                value: getLayoutDisplay(system.proxy?.layout?.state),
                inline: false
            },
            {
                name: '👥 Group Layout',
                value: getLayoutDisplay(system.proxy?.layout?.group),
                inline: false
            },
            {
                name: '⚙️ Proxy Style',
                value: system.proxy?.style || 'off',
                inline: true
            }
        );
}

// Build proxy settings components (select menu + back button)
function buildProxySettingsComponents(sessionId, prefix = 'system_edit') {
    const proxySelect = new StringSelectMenuBuilder()
        .setCustomId(`${prefix}_proxy_select_${sessionId}`)
        .setPlaceholder('Choose what to edit...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Alter Layout')
                .setDescription('Edit proxy layout for alters')
                .setValue('layout_alter')
                .setEmoji('🎭'),
            new StringSelectMenuOptionBuilder()
                .setLabel('State Layout')
                .setDescription('Edit proxy layout for states')
                .setValue('layout_state')
                .setEmoji('🔄'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Group Layout')
                .setDescription('Edit proxy layout for groups')
                .setValue('layout_group')
                .setEmoji('👥'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Proxy Style & Break')
                .setDescription('Edit auto-proxy style and break patterns')
                .setValue('style_break')
                .setEmoji('⚙️')
        );

    const proxySelectRow = new ActionRowBuilder().addComponents(proxySelect);
    const proxyBackRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${prefix}_proxy_back_${sessionId}`)
            .setLabel('Back to Edit')
            .setStyle(ButtonStyle.Secondary)
    );

    return [proxySelectRow, proxyBackRow];
}

// Build proxy layout modal for a specific entity type
function buildProxyLayoutModal(type, sessionId, system, prefix = 'system_edit') {
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
    const placeholders = {
        alter: '{a-sign1}{name}{tag1} - Use {name}, {sys-name}, {tag#}, {a-sign#}, {pronouns}, {caution}',
        state: '{st-sign1}{name}{tag1} - Use {name}, {sys-name}, {tag#}, {st-sign#}, {pronouns}, {caution}',
        group: '{g-sign1}{name}{tag1} - Use {name}, {sys-name}, {tag#}, {g-sign#}, {pronouns}, {caution}'
    };

    const modal = new ModalBuilder()
        .setCustomId(`${prefix}_proxy_layout_${type}_modal_${sessionId}`)
        .setTitle(`Edit ${typeLabel} Proxy Layout`);

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('layout')
                .setLabel(`${typeLabel} Layout`)
                .setStyle(TextInputStyle.Paragraph)
                .setValue(system.proxy?.layout?.[type] || '')
                .setPlaceholder(placeholders[type])
                .setRequired(false)
                .setMaxLength(200)
        )
    );

    return modal;
}

// Build proxy style & break modal
function buildProxyStyleModal(sessionId, system, prefix = 'system_edit') {
    const modal = new ModalBuilder()
        .setCustomId(`${prefix}_proxy_style_modal_${sessionId}`)
        .setTitle('Edit Proxy Style & Break');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('proxy_style')
                .setLabel('Proxy Style (off/last/front/state/[entity name])')
                .setStyle(TextInputStyle.Short)
                .setValue(system.proxy?.style || 'off')
                .setPlaceholder('off, last, front, state, or an entity indexable name')
                .setRequired(false)
                .setMaxLength(50)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('proxy_break')
                .setLabel('On Proxy Break? (yes/no)')
                .setStyle(TextInputStyle.Short)
                .setValue(system.proxy?.break ? 'yes' : 'no')
                .setRequired(false)
                .setMaxLength(3)
        )
    );

    return modal;
}

// Validate proxy style string (pure logic, no DB calls)
function validateProxyStyle(style) {
    const normalized = style?.toLowerCase()?.trim();
    const validStyles = ['off', 'last', 'front', 'state'];
    if (validStyles.includes(normalized)) {
        return { valid: true, finalStyle: normalized, isEntityName: false };
    }
    if (normalized) {
        return { valid: true, finalStyle: normalized, isEntityName: true };
    }
    return { valid: true, finalStyle: 'off', isEntityName: false };
}

// ============================================
// PROXY VALIDATION (DB-backed)
// ============================================

/* Check if a proxy pattern already exists in the system
 * @param {string} proxy - The proxy pattern to check
 * @param {System} system - The system to check
 * @param {string} excludeEntityId - Entity ID to exclude from check
 * @returns {Promise<{exists: boolean, entity: Object|null, type: string|null}>}
 */
async function checkProxyExists(proxy, system, excludeEntityId = null) {
    const proxyLower = proxy.toLowerCase();

    // Check alters
    const alters = await Alter.find({ _id: { $in: system.alters?.IDs || [] } });
    for (const alter of alters) {
        if (alter._id.toString() === excludeEntityId) continue;
        if (alter.proxy?.some(p => p.toLowerCase() === proxyLower))
            return { exists: true, entity: alter, type: 'alter' };
    }

    // Check states
    const states = await State.find({ _id: { $in: system.states?.IDs || [] } });
    for (const state of states) {
        if (state._id.toString() === excludeEntityId) continue;
        if (state.proxy?.some(p => p.toLowerCase() === proxyLower))
            return { exists: true, entity: state, type: 'state' };
    }

    // Check groups
    const groups = await Group.find({ _id: { $in: system.groups?.IDs || [] } });
    for (const group of groups) {
        if (group._id.toString() === excludeEntityId) continue;
        if (group.proxy?.some(p => p.toLowerCase() === proxyLower))
            return { exists: true, entity: group, type: 'group' };
    }

    return { exists: false, entity: null, type: null };
}

/* Validate proxy patterns — format + cross-entity uniqueness
 * @param {string[]} proxies - Array of proxy patterns
 * @param {System} system - The system to check duplicates against
 * @param {string} excludeEntityId - Entity ID to exclude from duplicate check
 * @param {string} entityType - Entity type ('alter', 'state', 'group')
 * @returns {Promise<{valid: string[], errors: string[], duplicates: Array<{proxy: string, owner: string}>}>}
 */
async function validateProxies(proxies, system, excludeEntityId, entityType) {
    const valid = [];
    const errors = [];
    const duplicates = [];

    for (const proxy of proxies) {
        if (!proxy.includes('text')) {
            errors.push(`Proxy "${proxy}" must contain "text" as a placeholder`);
            continue;
        }
        if (proxy.length > 100) {
            errors.push(`Proxy "${proxy}" is too long (max 100 characters)!!! How would you even remember that??? 😰`);
            continue;
        }

        const { exists, entity, type } = await checkProxyExists(proxy, system, excludeEntityId);
        if (exists) {
            duplicates.push({ proxy, owner: `${type} ${getDisplayName(entity)}` });
        } else {
            valid.push(proxy);
        }
    }

    return { valid, errors, duplicates };
}

/* Get proxy layout help text
 * @returns {string}
 */
function getProxyLayoutHelp() {
    return `**Available Placeholders:**
\`{name}\` - Display name
\`{sys-name}\` - System name
\`{tag1}\`, \`{tag2}\`... - System tags
\`{pronouns}\` - Pronouns
\`{caution}\` - Caution type

**Signoffs (per-entity):**
\`{a-sign1}\`, \`{a-sign2}\`... - Alter signoffs
\`{st-sign1}\`, \`{st-sign2}\`... - State signoffs
\`{g-sign1}\`, \`{g-sign2}\`... - Group signoffs

You can mix signoff types! E.g., \`{tag1}{a-sign1}{name}{g-sign1}\``;
}

/* Get proxy style options for select menu
 * @returns {Array<{label: string, value: string, description: string}>}
 */
function getProxyStyleOptions() {
    return [
        { label: 'Off', value: 'off', description: 'Only proxy when a proxy pattern is matched' },
        { label: 'Last', value: 'last', description: 'Auto-proxy as the most recent proxy used' },
        { label: 'Front', value: 'front', description: 'Auto-proxy as the current fronter (if single)' },
        { label: 'Specify', value: 'specify', description: 'Always proxy as a specific alter/state/group' }
    ];
}

module.exports = {
    findEntityByNameForSystem,
    buildProxySettingsEmbed,
    buildProxySettingsComponents,
    buildProxyLayoutModal,
    buildProxyStyleModal,
    validateProxyStyle,
    checkProxyExists,
    validateProxies,
    getProxyLayoutHelp,
    getProxyStyleOptions,
};