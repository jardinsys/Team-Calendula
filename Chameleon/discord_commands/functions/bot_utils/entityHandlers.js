/**
 * entityHandlers.js — Shared factory functions for entity field handlers
 * Eliminates copy-pasted handler code across alter.js, state.js, and group.js prefix commands.
 *
 * Every factory function returns an async handler with signature:
 *   (message: Message, parsed: ParsedCommand, entityName: string) => Promise<void>
 *
 * The `getter` signature is:
 *   (message: Message, entityName: string) => Promise<{ entity: BaseEntity, system: System } | null>
 *
 * @module entityHandlers
 */

const { EmbedBuilder } = require('discord.js');
const proxyMessageHandler = require('../../../global/proxy-message');
const utils = require('./');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Set a nested property on obj using a dot-separated path.
 * Creates intermediate objects as needed.
 * @param {Record<string, any>} obj - Target object
 * @param {string} dotPath - Dot-separated path (e.g. 'setting.default_status')
 * @param {any} value - Value to set
 * @example setNested(entity, 'setting.default_status', 'ok')
 */
function setNested(obj, dotPath, value) {
    const keys = dotPath.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        if (cur[keys[i]] == null || typeof cur[keys[i]] !== 'object') {
            cur[keys[i]] = {};
        }
        cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
}

/**
 * Get a nested property from obj using a dot-separated path.
 * Returns undefined if any part of the path is missing.
 * @param {Record<string, any>} obj - Source object
 * @param {string} dotPath - Dot-separated path
 * @returns {any | undefined}
 */
function getNested(obj, dotPath) {
    const keys = dotPath.split('.');
    let cur = obj;
    for (const key of keys) {
        if (cur == null) return undefined;
        cur = cur[key];
    }
    return cur;
}

// ── 1. simpleField ───────────────────────────────────────────────────────────
// For description, color, signoff, condition, caution
//
// Options:
//   parser:   (input, parsed) => transformedValue   — transforms the raw input
//   afterSave:(entity, system, value) => Promise     — runs after entity.save()
//   entityType: string                               — needed for ensureConditionExists etc.
//   successMsg: (value) => string                    — custom success message
//   clearMsg:   string                               — custom clear message
//   errorMsg:   string                               — custom error when no input
//   inputIndex: number                               — which positional to use (default 2)

function simpleField(getter, fieldPath, displayName, options = {}) {
    const {
        parser,
        afterSave,
        entityType,
        successMsg,
        clearMsg,
        errorMsg,
        inputIndex = 2,
    } = options;

    return async (message, parsed, entityName) => {
        const result = await getter(message, entityName);
        if (!result || !result.entity) return;
        const { entity, system } = result;

        // Clear
        if (parsed.clear) {
            setNested(entity, fieldPath, undefined);
            await entity.save();
            return utils.success(message, clearMsg || `${displayName} cleared.`);
        }

        // Gather input based on field type
        let value;
        const rawInput = parsed._positional.slice(inputIndex).join(' ');

        if (fieldPath === 'description') {
            value = rawInput;
        } else if (fieldPath === 'color') {
            value = utils.normalizeColor(parsed._positional[inputIndex]);
            if (!value) return utils.error(message, 'Please provide a valid hex color.');
        } else if (fieldPath === 'signoff') {
            if (!rawInput) return utils.error(message, errorMsg || `Please provide ${displayName.toLowerCase()}.`);
            value = utils.parseList(rawInput).join('\n');
        } else if (fieldPath === 'condition') {
            if (!rawInput) return utils.error(message, errorMsg || `Please provide a ${displayName.toLowerCase()}.`);
            value = rawInput;
        } else if (fieldPath === 'caution') {
            const type = parsed._positional[inputIndex];
            const detail = parsed._positional.slice(inputIndex + 1).join(' ');
            if (!type) return utils.error(message, errorMsg || `Please provide a caution type.`);
            value = { c_type: type, detail: detail || undefined };
        } else {
            value = rawInput;
        }

        // Allow custom parser
        if (parser) {
            value = parser(value, parsed);
        }

        // Validate non-empty (for simple string fields)
        if (fieldPath !== 'caution' && fieldPath !== 'color' && !value) {
            return utils.error(message, errorMsg || `Please provide a ${displayName.toLowerCase()}.`);
        }

        setNested(entity, fieldPath, value);
        await entity.save();

        // Post-save hook
        if (afterSave) {
            await afterSave(entity, system, value);
        } else if (fieldPath === 'condition' && entityType) {
            await utils.ensureConditionExists(system, entityType, value);
        }

        if (successMsg) {
            return utils.success(message, typeof successMsg === 'function' ? successMsg(value) : successMsg);
        }
        if (fieldPath === 'color') {
            return utils.success(message, `${displayName} set to **${value}**`);
        }
        if (fieldPath === 'caution') {
            return utils.success(message, `Caution set to **${value.c_type}**`);
        }
        if (fieldPath === 'description') {
            return utils.success(message, `${displayName} updated.`);
        }
        return utils.success(message, `${displayName} set to **${value}**`);
    };
}

// ── 2. nameField ─────────────────────────────────────────────────────────────
// For rename (indexable), displayName (display), closedName (closedNameDisplay)
//
// Options:
//   validateIndexable: bool     — validate indexable name format
//   checkDuplicates:   bool     — check for duplicate indexable names
//   entityType:        string   — for duplicate check (e.g. 'alter')

function nameField(getter, namePath, displayName, options = {}) {
    const {
        validateIndexable = false,
        checkDuplicates = false,
        entityType,
    } = options;

    return async (message, parsed, entityName) => {
        const result = await getter(message, entityName);
        if (!result || !result.entity) return;
        const { entity, system } = result;

        // For rename, input is at index 2 (the new name)
        const newName = parsed._positional.slice(2).join(' ');

        // Clear
        if (parsed.clear) {
            setNested(entity, `name.${namePath}`, undefined);
            await entity.save();
            await proxyMessageHandler.invalidateDisplayCache(entity._id);
            return utils.success(message, `${displayName} cleared.`);
        }

        if (!newName) {
            return utils.error(message, `Please provide a ${displayName.toLowerCase()}.`);
        }

        // Validate indexable format
        if (validateIndexable && !utils.isValidIndexableName(newName)) {
            return utils.error(message, 'Invalid indexable name format.');
        }

        // Check for duplicates
        if (checkDuplicates && entityType && system) {
            const existing = await utils.findEntity(newName, system, entityType);
            if (existing && existing.entity._id.toString() !== entity._id.toString()) {
                return utils.error(message, `A ${entityType} with the name **${newName}** already exists.`);
            }
        }

        setNested(entity, `name.${namePath}`, newName);
        await entity.save();
        await proxyMessageHandler.invalidateDisplayCache(entity._id);
        return utils.success(message, `${displayName} changed to **${newName}**`);
    };
}

// ── 3. mediaField ────────────────────────────────────────────────────────────
// For avatar, banner, proxyAvatar
//
// Options:
//   bucket:     string    — R2 bucket name (default 'app')
//   entityType: string    — display name for upload (e.g. 'Alter', 'State', 'Group')
//   syncBucket: bool      — whether to resolve bucket from syncWithApps
//   mediaType:  string    — type passed to handlePrefixMediaUpload (e.g. 'avatar', 'banner')
//   fieldPath:  string    — actual field path on entity (e.g. 'avatar', 'discord.image.banner')

function mediaField(getter, fieldPath, displayName, options = {}) {
    const {
        bucket = 'app',
        entityType = 'Entity',
        syncBucket = false,
        mediaType,
        uploadFieldName,
    } = options;

    return async (message, parsed, entityName) => {
        const result = await getter(message, entityName);
        if (!result || !result.entity) return;
        const { entity } = result;

        // Determine actual bucket
        let actualBucket = bucket;
        if (syncBucket) {
            const syncWithDiscord = entity.syncWithApps?.discord;
            actualBucket = utils.resolveUploadBucket(syncWithDiscord, 'discord');
        }

        // Get the old media object for cleanup
        const oldMedia = getNested(entity, fieldPath);

        // Clear
        if (parsed.clear) {
            if (oldMedia?.r2Key) {
                await utils.deleteFromR2(oldMedia.r2Key, oldMedia.bucket || 'app');
            }
            // Special handling for nested discord.image paths
            if (fieldPath.includes('.')) {
                const parts = fieldPath.split('.');
                const lastKey = parts.pop();
                const parent = getNested(entity, parts.join('.'));
                if (parent) parent[lastKey] = undefined;
            } else {
                setNested(entity, fieldPath, undefined);
            }
            await entity.save();
            await proxyMessageHandler.invalidateDisplayCache(entity._id);
            return utils.success(message, `${displayName} cleared.`);
        }

        // Upload
        const attachment = message.attachments.first();
        const urlArg = parsed._positional[2];
        const uploadType = uploadFieldName || mediaType || fieldPath.split('.').pop();
        const result2 = await utils.handlePrefixMediaUpload(
            attachment, urlArg, uploadType, entityType, message.author.id, actualBucket
        );
        if (!result2.success) return utils.error(message, result2.message);

        // Clean up old media
        if (oldMedia?.r2Key) {
            await utils.deleteFromR2(oldMedia.r2Key, oldMedia.bucket || 'app');
        }

        // Set new media — handle nested paths like 'discord.image.banner'
        if (fieldPath.includes('.')) {
            const parts = fieldPath.split('.');
            const lastKey = parts.pop();
            let parent = entity;
            for (const part of parts) {
                if (parent[part] == null) parent[part] = {};
                parent = parent[part];
            }
            parent[lastKey] = result2.media;
        } else {
            setNested(entity, fieldPath, result2.media);
        }

        await entity.save();
        await proxyMessageHandler.invalidateDisplayCache(entity._id);
        return utils.success(message, `${displayName} uploaded and updated.`);
    };
}

// ── 4. booleanField ──────────────────────────────────────────────────────────
// For sync (syncWithApps.discord)
//
// Options:
//   fieldPath: string     — path to the boolean field (default 'syncWithApps')
//   subKey:    string     — sub-key within the field (e.g. 'discord')

function booleanField(getter, fieldPath, displayName, options = {}) {
    return async (message, parsed, entityName) => {
        const result = await getter(message, entityName);
        if (!result || !result.entity) return;
        const { entity } = result;

        const val = parsed._positional[2]?.toLowerCase();
        if (!val || !['true', 'false', 'on', 'off', 'yes', 'no'].includes(val)) {
            return utils.error(message, 'Specify `true` or `false`.');
        }
        const boolVal = ['true', 'on', 'yes'].includes(val);

        setNested(entity, fieldPath, boolVal);
        await entity.save();
        return utils.success(message, `${displayName} is now **${boolVal ? 'enabled' : 'disabled'}**`);
    };
}

// ── 5. nestedField ───────────────────────────────────────────────────────────
// For defaultStatus (setting.default_status), defaultBattery (setting.default_battery)
//
// Options:
//   parser:    (rawInput) => value     — transform the raw input
//   validator: (value) => bool         — validate the parsed value
//   inputIndex: number                 — positional index (default 2)

function nestedField(getter, parentPath, fieldName, displayName, options = {}) {
    const {
        parser,
        validator,
        inputIndex = 2,
        errorMsg,
    } = options;

    return async (message, parsed, entityName) => {
        const result = await getter(message, entityName);
        if (!result || !result.entity) return;
        const { entity } = result;

        const fullPath = `${parentPath}.${fieldName}`;

        // Clear
        if (parsed.clear) {
            setNested(entity, fullPath, undefined);
            await entity.save();
            return utils.success(message, `${displayName} cleared.`);
        }

        let value = parsed._positional.slice(inputIndex).join(' ');

        // Apply parser
        if (parser) {
            value = parser(value, parsed);
        }

        // Validate
        if (validator && !validator(value)) {
            return utils.error(message, errorMsg || `Invalid ${displayName.toLowerCase()} value.`);
        }

        if (!value && value !== 0) {
            return utils.error(message, errorMsg || `Please provide a ${displayName.toLowerCase()}.`);
        }

        setNested(entity, fullPath, value);
        await entity.save();
        return utils.success(message, `${displayName} set to **${value}**`);
    };
}

// ── 6. listField ─────────────────────────────────────────────────────────────
// For triggers (caution.triggers) and aliases (name.aliases)
//
// Options:
//   matchKey:     string    — key to match items by (e.g. 'text' for triggers)
//   itemFactory:  (item) => obj — creates list items from raw input
//   parentPath:   string    — intermediate path (e.g. 'caution' for triggers)
//   clearMsg:     string    — message on clear
//   label:        string    — display name for items (e.g. 'Trigger', 'Alias')

function listField(getter, fieldPath, displayName, options = {}) {
    const {
        matchKey,
        itemFactory,
        clearMsg,
        label,
    } = options;

    return async (message, parsed, entityName) => {
        const result = await getter(message, entityName);
        if (!result || !result.entity) return;
        const { entity } = result;

        const action = parsed._positional[2]?.toLowerCase();
        const itemLabel = label || displayName.replace(/s$/, '');

        // Get the list — ensure parent exists
        let list = getNested(entity, fieldPath);
        if (!Array.isArray(list)) {
            setNested(entity, fieldPath, []);
            list = getNested(entity, fieldPath);
        }

        // Clear
        if (parsed.clear || action === 'clear') {
            setNested(entity, fieldPath, []);
            await entity.save();
            return utils.success(message, clearMsg || `All ${displayName} cleared.`);
        }

        // Add
        if (action === 'add') {
            const rawItem = parsed._positional.slice(3).join(' ');
            if (!rawItem) return utils.error(message, `Please provide a ${itemLabel.toLowerCase()}.`);
            const item = itemFactory ? itemFactory(rawItem) : rawItem;
            list.push(item);
            await entity.save();
            const displayItem = matchKey ? rawItem : `**${rawItem}**`;
            return utils.success(message, `${itemLabel} ${displayItem} added.`);
        }

        // Remove
        if (action === 'remove') {
            const rawItem = parsed._positional.slice(3).join(' ');
            if (!rawItem) return utils.error(message, `Please provide a ${itemLabel.toLowerCase()} to remove.`);
            let idx;
            if (matchKey) {
                idx = list.findIndex(item => item[matchKey]?.toLowerCase() === rawItem.toLowerCase());
            } else {
                idx = list.findIndex(item =>
                    (typeof item === 'string' ? item : item)?.toLowerCase?.() === rawItem.toLowerCase()
                );
            }
            if (idx === -1) return utils.error(message, `${itemLabel} \`${rawItem}\` not found.`);
            list.splice(idx, 1);
            await entity.save();
            return utils.success(message, `${itemLabel} \`${rawItem}\` removed.`);
        }

        // List
        if (matchKey) {
            // Items are objects with a text/display field
            if (!list.length) return utils.info(message, `No ${displayName} set.`);
            return utils.info(message, `${displayName}: ${list.map(item => item[matchKey] || item.text || item).join(', ')}`);
        } else {
            // Items are plain strings
            if (!list.length) return utils.info(message, `No ${displayName} set.`);
            return utils.info(message, `${displayName}: ${list.join(', ')}`);
        }
    };
}

// ── 7. proxyHandler ──────────────────────────────────────────────────────────
// Shared proxy handler for add/remove/clear/set/list
// Uses system from getter for checkProxyExists

function proxyHandler(getter) {
    return async (message, parsed, entityName) => {
        const result = await getter(message, entityName);
        if (!result || !result.entity) return;
        const { entity, system } = result;

        const action = parsed._positional[2]?.toLowerCase();

        // Clear
        if (parsed.clear || action === 'clear') {
            entity.proxy = [];
            await entity.save();
            return utils.success(message, 'Proxy tags cleared.');
        }

        // Add
        if (action === 'add') {
            const tag = parsed._positional.slice(3).join(' ');
            if (!tag) return utils.error(message, 'Please provide a proxy tag.');
            const { exists, entity: proxyEntity, type } = await utils.checkProxyExists(tag, system, entity._id.toString());
            if (exists) {
                return utils.error(message, `Proxy \`${tag}\` is already used by ${type} **${utils.getDisplayName(proxyEntity)}**.`);
            }
            entity.proxy = entity.proxy || [];
            entity.proxy.push(tag);
            await entity.save();
            return utils.success(message, `Proxy tag \`${tag}\` added.`);
        }

        // Remove
        if (action === 'remove') {
            const tag = parsed._positional.slice(3).join(' ');
            if (!tag) return utils.error(message, 'Please provide a proxy tag to remove.');
            entity.proxy = entity.proxy || [];
            const idx = entity.proxy.findIndex(p => p.toLowerCase() === tag.toLowerCase());
            if (idx === -1) return utils.error(message, `Proxy tag \`${tag}\` not found.`);
            entity.proxy.splice(idx, 1);
            await entity.save();
            return utils.success(message, `Proxy tag \`${tag}\` removed.`);
        }

        // Direct set (no action keyword — just a tag)
        const tag = parsed._positional.slice(2).join(' ');
        if (!tag) {
            // List proxies
            const proxies = entity.proxy || [];
            return proxies.length
                ? utils.info(message, `Proxy tags: ${utils.formatProxies(proxies)}`)
                : utils.info(message, 'No proxy tags set.');
        }

        // Check uniqueness and set
        const { exists, entity: proxyEntity, type } = await utils.checkProxyExists(tag, system, entity._id.toString());
        if (exists) {
            return utils.error(message, `Proxy \`${tag}\` is already used by ${type} **${utils.getDisplayName(proxyEntity)}**.`);
        }
        const oldCount = entity.proxy?.length || 0;
        entity.proxy = [tag];
        await entity.save();
        return utils.success(message, oldCount > 0
            ? `Proxy tag set to \`${tag}\` (replaced ${oldCount} previous proxy${oldCount > 1 ? 's' : ''}).`
            : `Proxy tag set to \`${tag}\`.`);
    };
}

// ── 8. privacyHandler ────────────────────────────────────────────────────────
// Shared privacy handler with bucket:<name> syntax
//
// entityType: display name (e.g. 'alter', 'state', 'group')
// validFields: array of allowed field names
// color: embed color

function privacyHandler(getter, entityType, validFields, color) {
    return async (message, parsed, entityName) => {
        const result = await getter(message, entityName);
        if (!result || !result.entity) return;
        const { entity } = result;

        const bucketArg = parsed._positional[2]?.toLowerCase();
        const field = parsed._positional[3]?.toLowerCase();
        const value = parsed._positional[4]?.toLowerCase();

        // Show help if invalid
        if (!bucketArg || !validFields.includes(bucketArg)) {
            const embed = new EmbedBuilder()
                .setColor(color || utils.ENTITY_COLORS[entityType] || '#FFA500')
                .setTitle(`🔒 ${entityType.charAt(0).toUpperCase() + entityType.slice(1)} Privacy`)
                .setDescription(
                    `Use \`sys!${entityType} <n> privacy <field> <public|private>\`\n` +
                    `or \`sys!${entityType} <n> privacy bucket:<name> <field> <public|private>\`\n` +
                    `Fields: ${validFields.join(', ')}`
                );
            return message.reply({ embeds: [embed] });
        }

        const bucketName = bucketArg.startsWith('bucket:') ? bucketArg.slice(7) : 'default';
        const actualField = bucketArg.startsWith('bucket:') ? field : bucketArg;
        const actualValue = bucketArg.startsWith('bucket:') ? value : field;

        if (!validFields.includes(actualField)) {
            return utils.error(message, `Invalid field. Valid: ${validFields.join(', ')}`);
        }
        if (!actualValue || !['public', 'private'].includes(actualValue)) {
            return utils.error(message, 'Specify `public` or `private`.');
        }

        entity.setting = entity.setting || {};
        entity.setting.privacy = entity.setting.privacy || [];
        let priv = entity.setting.privacy.find(p => p.bucket === bucketName);
        if (!priv) {
            priv = { bucket: bucketName, settings: {} };
            entity.setting.privacy.push(priv);
        }
        priv.settings[actualField] = actualValue === 'private';
        await entity.save();
        return utils.success(message, `**${actualField}** is now **${actualValue}** in bucket **${bucketName}**`);
    };
}

// ── 9. idHandler ─────────────────────────────────────────────────────────────
// Simply returns the entity's _id

function idHandler(getter) {
    return async (message, parsed, entityName) => {
        const result = await getter(message, entityName);
        if (!result || !result.entity) return;
        return message.reply(`\`${result.entity._id}\``);
    };
}

// ── 10. maskHandler ──────────────────────────────────────────────────────────
// Shared mask handler for name, displayname/dn, description/desc, color/colour,
// avatar/icon/av/pfp, banner, proxyavatar/pav
//
// entityType: display name (e.g. 'alter', 'state', 'group')
// color: embed color for the help embed

function maskHandler(getter, entityType, color) {
    const term = entityType.charAt(0).toUpperCase() + entityType.slice(1);

    return async (message, parsed, entityName) => {
        const result = await getter(message, entityName);
        if (!result || !result.entity) return;
        const { entity } = result;

        const field = parsed._positional[2]?.toLowerCase();

        // No field specified — show help
        if (!field) {
            const embed = new EmbedBuilder()
                .setColor(color || utils.ENTITY_COLORS[entityType] || '#FFA500')
                .setTitle('🎭 Mask Settings')
                .setDescription(
                    `Use \`sys!${entityType} <n> mask <field> <value>\`\n` +
                    `Fields: name, displayname (dn), description, color, avatar, banner, proxyavatar (pav)`
                )
                .addFields({
                    name: 'Current Mask',
                    value:
                        `Name: ${entity.mask?.name?.display || entity.mask?.name?.indexable || '*not set*'}\n` +
                        `Color: ${entity.mask?.color || '*not set*'}\n` +
                        `Description: ${entity.mask?.description || '*not set*'}`,
                    inline: false,
                });
            return message.reply({ embeds: [embed] });
        }

        // Ensure mask object exists
        entity.mask = entity.mask || {};

        // ── name ──
        if (field === 'name') {
            const val = parsed._positional.slice(3).join(' ');
            if (!val) return utils.error(message, 'Please provide a mask name.');
            entity.mask.name = entity.mask.name || {};
            entity.mask.name.indexable = val.toLowerCase().replace(/[^a-z0-9\-_]/g, '') || undefined;
            entity.mask.name.display = val;
            await entity.save();
            await proxyMessageHandler.invalidateDisplayCache(entity._id);
            return utils.success(message, `Mask name set to **${val}**`);
        }

        // ── displayname / dn ──
        if (field === 'displayname' || field === 'dn') {
            if (parsed.clear) {
                entity.mask.name = entity.mask.name || {};
                entity.mask.name.display = undefined;
                await entity.save();
                await proxyMessageHandler.invalidateDisplayCache(entity._id);
                return utils.success(message, 'Mask display name cleared.');
            }
            const val = parsed._positional.slice(3).join(' ');
            if (!val) return utils.error(message, 'Please provide a mask display name.');
            entity.mask.name = entity.mask.name || {};
            entity.mask.name.display = val;
            await entity.save();
            await proxyMessageHandler.invalidateDisplayCache(entity._id);
            return utils.success(message, `Mask display name set to **${val}**`);
        }

        // ── description / desc ──
        if (field === 'description' || field === 'desc') {
            if (parsed.clear) {
                entity.mask.description = undefined;
                await entity.save();
                return utils.success(message, 'Mask description cleared.');
            }
            const val = parsed._positional.slice(3).join(' ');
            if (!val) return utils.error(message, 'Please provide a mask description.');
            entity.mask.description = val;
            await entity.save();
            return utils.success(message, 'Mask description updated.');
        }

        // ── color / colour ──
        if (field === 'color' || field === 'colour') {
            if (parsed.clear) {
                entity.mask.color = undefined;
                await entity.save();
                return utils.success(message, 'Mask color cleared.');
            }
            const val = utils.normalizeColor(parsed._positional[3]);
            if (!val) return utils.error(message, 'Please provide a valid hex color.');
            entity.mask.color = val;
            await entity.save();
            return utils.success(message, `Mask color set to **${val}**`);
        }

        // ── avatar / icon / av / pfp ──
        if (field === 'avatar' || field === 'icon' || field === 'av' || field === 'pfp') {
            if (parsed.clear) {
                entity.mask.avatar = undefined;
                await entity.save();
                await proxyMessageHandler.invalidateDisplayCache(entity._id);
                return utils.success(message, 'Mask avatar cleared.');
            }
            const url = message.attachments.first()?.url || parsed._positional[3];
            if (!url) return utils.error(message, 'Please provide a URL or upload an image.');
            entity.mask.avatar = { url };
            await entity.save();
            await proxyMessageHandler.invalidateDisplayCache(entity._id);
            return utils.success(message, 'Mask avatar updated.');
        }

        // ── banner ──
        if (field === 'banner') {
            if (parsed.clear) {
                entity.mask.discord = entity.mask.discord || {};
                entity.mask.discord.image = entity.mask.discord.image || {};
                entity.mask.discord.image.banner = undefined;
                await entity.save();
                await proxyMessageHandler.invalidateDisplayCache(entity._id);
                return utils.success(message, 'Mask banner cleared.');
            }
            const url = message.attachments.first()?.url || parsed._positional[3];
            if (!url) return utils.error(message, 'Please provide a URL or upload an image.');
            entity.mask.discord = entity.mask.discord || {};
            entity.mask.discord.image = entity.mask.discord.image || {};
            entity.mask.discord.image.banner = { url };
            await entity.save();
            await proxyMessageHandler.invalidateDisplayCache(entity._id);
            return utils.success(message, 'Mask banner updated.');
        }

        // ── proxyavatar / pav ──
        if (field === 'proxyavatar' || field === 'pav') {
            if (parsed.clear) {
                entity.mask.discord = entity.mask.discord || {};
                entity.mask.discord.image = entity.mask.discord.image || {};
                entity.mask.discord.image.proxyAvatar = undefined;
                await entity.save();
                await proxyMessageHandler.invalidateDisplayCache(entity._id);
                return utils.success(message, 'Mask proxy avatar cleared.');
            }
            const url = message.attachments.first()?.url || parsed._positional[3];
            if (!url) return utils.error(message, 'Please provide a URL.');
            entity.mask.discord = entity.mask.discord || {};
            entity.mask.discord.image = entity.mask.discord.image || {};
            entity.mask.discord.image.proxyAvatar = { url };
            await entity.save();
            await proxyMessageHandler.invalidateDisplayCache(entity._id);
            return utils.success(message, 'Mask proxy avatar updated.');
        }

        // Unknown field
        return utils.error(message, `Unknown mask field: ${field}. Use: name, displayname, description, color, avatar, banner, proxyavatar`);
    };
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    // Helpers (for use by callers if needed)
    setNested,
    getNested,

    // Factory functions
    simpleField,
    nameField,
    mediaField,
    booleanField,
    nestedField,
    listField,
    proxyHandler,
    privacyHandler,
    idHandler,
    maskHandler,
};
