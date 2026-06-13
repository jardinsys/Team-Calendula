// sys!state - State management prefix command
// States are similar to alters but represent different modes/states of being
//
// USAGE:
//   sys!state <n>                              - View a state
//   sys!state new <n>                          - Create a state
//   sys!state list [-full]                     - List all states
//   sys!state <n> displayname|dn <name>        - Set display name
//   sys!state <n> closedname|cn <name>         - Set closed name display
//   sys!state <n> description <text>           - Set description
//   sys!state <n> avatar|banner <url>          - Set media
//   sys!state <n> alters add|remove <alter>    - Link alters
//   sys!state <n> proxy add|remove <tag>       - Manage proxies
//   sys!state <n> sync <true|false>            - Toggle Discord sync
//   sys!state <n> defaultstatus <s>            - Set default shift status
//   sys!state <n> defaultbattery <0-100>       - Set default shift battery
//   sys!state <n> caution <type> [detail]      - Set caution
//   sys!state <n> triggers add|remove <text>   - Manage triggers
//   sys!state <n> mask <field> <value>         - Edit mask mode
//   sys!state <n> remission                    - Toggle remission
//   sys!state <n> privacy <field> <pub|priv>   - Set privacy
//   sys!state <n> privacy bucket:<name> <f> <v> - Per-bucket privacy
//   sys!state <n> delete -confirm              - Delete state

const { EmbedBuilder } = require('discord.js');
const System = require('../../../schemas/system');
const User = require('../../../schemas/user');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const Group = require('../../../schemas/group');
const utils = require('../../functions/bot_utils');
const proxyMessageHandler = require('../proxy-message');

const { getSystemTerm } = utils;

module.exports = {
    name: 'state',
    aliases: ['st'],

    async executeMessage(message, args) {
        const parsed = utils.parseArgs(args);
        const firstArg = parsed._positional[0]?.toLowerCase();

        if (firstArg === 'new' || firstArg === 'create') return handleNew(message, parsed);
        if (firstArg === 'list') return handleList(message, parsed);
        if (firstArg === 'help' || !firstArg) return handleHelp(message);

        const stateName = parsed._positional[0];
        const subcommand = parsed._positional[1]?.toLowerCase();

        const handlers = {
            'rename': handleRename, 'name': handleRename,
            'displayname': handleDisplayName, 'dn': handleDisplayName,
            'closedname': handleClosedName, 'cn': handleClosedName,
            'description': handleDescription, 'desc': handleDescription,
            'avatar': handleAvatar, 'icon': handleAvatar, 'av': handleAvatar,
            'banner': handleBanner,
            'color': handleColor, 'colour': handleColor,
            'proxy': handleProxy,
            'signoff': handleSignoff, 'sign': handleSignoff,
            'aliases': handleAliases, 'alias': handleAliases,
            'groups': handleGroups, 'group': handleGroups,
            'alters': handleAlters, 'alter': handleAlters,
            'condition': handleCondition, 'cond': handleCondition,
            'caution': handleCaution,
            'triggers': handleTriggers, 'trigger': handleTriggers,
            'privacy': handlePrivacy,
            'sync': handleSync,
            'defaultstatus': handleDefaultStatus, 'ds': handleDefaultStatus,
            'defaultbattery': handleDefaultBattery, 'db': handleDefaultBattery,
            'mask': handleMask,
            'delete': handleDelete,
            'remission': handleRemission,
            'id': handleId
        };

        if (handlers[subcommand]) {
            const { system } = await utils.getOrCreateUserAndSystem(message);
            if (system && !system.sys_type?.isFragmented && !system.sys_type?.isDissociative) {
                return utils.error(message, 'Your current setup does not allow states. You can update this in `sys!system edit` if you need a change.');
            }
            return handlers[subcommand](message, parsed, stateName);
        }
        return handleShow(message, parsed, stateName);
    }
};

async function getState(message, stateName) {
    const { system } = await utils.getOrCreateUserAndSystem(message);
    if (!system) { await utils.error(message, 'Not registered yet.'); return { state: null, system: null }; }
    const result = await utils.findEntity(stateName, system, 'state');
    if (!result) { await utils.error(message, `State **${stateName}** not found.`); return { state: null, system }; }
    return { state: result.entity, system };
}

async function handleShow(message, parsed, stateName) {
    const { system, targetUserId } = await utils.resolveTargetSystem(message, parsed);
    if (!system) return utils.error(message, targetUserId === message.author.id ? 'Not registered yet.' : 'Not registered.');
    const result = await utils.findEntity(stateName, system, 'state');
    if (!result) return utils.error(message, `State **${stateName}** not found.`);
    const embed = await buildStateEmbed(result.entity, system, message.author?.displayName);
    const isSelf = targetUserId === message.author.id;
    if (isSelf && !system.sys_type?.isFragmented && !system.sys_type?.isDissociative) {
        embed.addFields({ name: '⚠️ Notice', value: 'Your current setup does not allow states. You can update this in `sys!system edit` if you need a change.' });
    }
    return message.reply({ embeds: [embed] });
}

async function handleNew(message, parsed) {
    const { system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    if (!system.sys_type?.isFragmented && !system.sys_type?.isDissociative) {
        return utils.error(message, 'Your current setup does not allow states. You can update this in `sys!system edit` if you need a change.');
    }
    const name = parsed._positional.slice(1).join(' ');
    if (!name) return utils.error(message, 'Please provide a name: `sys!state new <n>`');
    const indexable = name.toLowerCase().replace(/[^a-z0-9\-_]/g, '') || undefined;

    if (indexable) {
        const existing = await utils.findEntity(indexable, system, 'state');
        if (existing) return utils.error(message, `A state with the name **${indexable}** already exists.`);
    }

    const state = new State({
        name: { ...(indexable && { indexable }), display: name },
        addedAt: new Date()
    });
    await utils.createAndLinkEntity(state, system, 'state');

    const embed = new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.success)
        .setTitle('✅ State Created!')
        .setDescription(`**${name}** has been created.`)
        .addFields({ name: 'ID', value: `\`${state._id}\``, inline: true });
    return message.reply({ embeds: [embed] });
}

async function handleRename(message, parsed, stateName) {
    const { state } = await getState(message, stateName);
    if (!state) return;
    const newName = parsed._positional.slice(2).join(' ');
    if (!newName) return utils.error(message, 'Please provide a new name.');
    if (!utils.isValidIndexableName(newName)) return utils.error(message, 'Invalid indexable name format.');
    state.name.indexable = newName;
    await state.save();
    await proxyMessageHandler.invalidateDisplayCache(state._id);
    return utils.success(message, `Indexable name changed to **${newName}**`);
}

async function handleDisplayName(message, parsed, stateName) {
    const { state } = await getState(message, stateName);
    if (!state) return;
    if (parsed.clear) { state.name.display = undefined; await state.save(); await proxyMessageHandler.invalidateDisplayCache(state._id); return utils.success(message, 'Display name cleared.'); }
    const newName = parsed._positional.slice(2).join(' ');
    if (!newName) return utils.error(message, 'Please provide a display name.');
    state.name.display = newName;
    await state.save();
    await proxyMessageHandler.invalidateDisplayCache(state._id);
    return utils.success(message, `Display name set to **${newName}**`);
}

async function handleDescription(message, parsed, stateName) {
    const { state } = await getState(message, stateName);
    if (!state) return;
    if (parsed.clear) { state.description = undefined; await state.save(); return utils.success(message, 'Description cleared.'); }
    const desc = parsed._positional.slice(2).join(' ');
    if (!desc) return utils.error(message, 'Please provide a description.');
    state.description = desc;
    await state.save();
    return utils.success(message, 'Description updated.');
}

async function handleAvatar(message, parsed, stateName) {
    const { state } = await getState(message, stateName);
    if (!state) return;
    if (parsed.clear) { if (state.avatar?.r2Key) await utils.deleteFromR2(state.avatar.r2Key, state.avatar.bucket || 'app'); state.avatar = undefined; await state.save(); await proxyMessageHandler.invalidateDisplayCache(state._id); return utils.success(message, 'Avatar cleared.'); }
    const attachment = message.attachments.first();
    const urlArg = parsed._positional[2];
    const result = await utils.handlePrefixMediaUpload(attachment, urlArg, 'avatar', 'State', message.author.id, 'app');
    if (!result.success) return utils.error(message, result.message);
    if (state.avatar?.r2Key) await utils.deleteFromR2(state.avatar.r2Key, state.avatar.bucket || 'app');
    state.avatar = result.media;
    await state.save();
    await proxyMessageHandler.invalidateDisplayCache(state._id);
    return utils.success(message, 'Avatar uploaded and updated.');
}

async function handleBanner(message, parsed, stateName) {
    const { state } = await getState(message, stateName);
    if (!state) return;
    const syncWithDiscord = state.syncWithApps?.discord;
    const bucket = utils.resolveUploadBucket(syncWithDiscord, 'discord');
    if (parsed.clear) { if (state.discord?.image?.banner?.r2Key) await utils.deleteFromR2(state.discord.image.banner.r2Key, state.discord.image.banner.bucket || 'app'); if (state.discord?.image) state.discord.image.banner = undefined; await state.save(); await proxyMessageHandler.invalidateDisplayCache(state._id); return utils.success(message, 'Banner cleared.'); }
    const attachment = message.attachments.first();
    const urlArg = parsed._positional[2];
    const result = await utils.handlePrefixMediaUpload(attachment, urlArg, 'banner', 'State', message.author.id, bucket);
    if (!result.success) return utils.error(message, result.message);
    if (state.discord?.image?.banner?.r2Key) await utils.deleteFromR2(state.discord.image.banner.r2Key, state.discord.image.banner.bucket || 'app');
    state.discord = state.discord || {}; state.discord.image = state.discord.image || {};
    state.discord.image.banner = result.media;
    await state.save();
    await proxyMessageHandler.invalidateDisplayCache(state._id);
    return utils.success(message, 'Banner uploaded and updated.');
}

async function handleColor(message, parsed, stateName) {
    const { state } = await getState(message, stateName);
    if (!state) return;
    if (parsed.clear) { state.color = undefined; await state.save(); return utils.success(message, 'Color cleared.'); }
    const color = utils.normalizeColor(parsed._positional[2]);
    if (!color) return utils.error(message, 'Please provide a valid hex color.');
    state.color = color;
    await state.save();
    return utils.success(message, `Color set to **${color}**`);
}

async function handleProxy(message, parsed, stateName) {
    const { state, system } = await getState(message, stateName);
    if (!state) return;
    const action = parsed._positional[2]?.toLowerCase();
    if (parsed.clear || action === 'clear') { state.proxy = []; await state.save(); return utils.success(message, 'Proxy tags cleared.'); }
    if (action === 'add') {
        const tag = parsed._positional.slice(3).join(' ');
        if (!tag) return utils.error(message, 'Please provide a proxy tag.');
        const { exists, entity, type } = await utils.checkProxyExists(tag, system, state._id.toString());
        if (exists) return utils.error(message, `Proxy \`${tag}\` is already used by ${type} **${utils.getDisplayName(entity)}**.`);
        state.proxy = state.proxy || []; state.proxy.push(tag); await state.save();
        return utils.success(message, `Proxy tag \`${tag}\` added.`);
    }
    if (action === 'remove') {
        const tag = parsed._positional.slice(3).join(' ');
        state.proxy = state.proxy || [];
        const idx = state.proxy.findIndex(p => p.toLowerCase() === tag.toLowerCase());
        if (idx === -1) return utils.error(message, `Proxy tag not found.`);
        state.proxy.splice(idx, 1); await state.save();
        return utils.success(message, `Proxy tag removed.`);
    }
    const tag = parsed._positional.slice(2).join(' ');
    if (!tag) {
        const proxies = state.proxy || [];
        return proxies.length ? utils.info(message, `Proxy tags: ${utils.formatProxies(proxies)}`) : utils.info(message, 'No proxy tags set.');
    }
    const { exists, entity, type } = await utils.checkProxyExists(tag, system, state._id.toString());
    if (exists) return utils.error(message, `Proxy \`${tag}\` is already used by ${type} **${utils.getDisplayName(entity)}**.`);
    const oldCount = state.proxy?.length || 0;
    state.proxy = [tag]; await state.save();
    return utils.success(message, oldCount > 0
        ? `Proxy tag set to \`${tag}\` (replaced ${oldCount} previous proxy${oldCount > 1 ? 's' : ''}).`
        : `Proxy tag set to \`${tag}\`.`);
}

async function handleSignoff(message, parsed, stateName) {
    const { state } = await getState(message, stateName);
    if (!state) return;
    if (parsed.clear) { state.signoff = undefined; await state.save(); return utils.success(message, 'Sign-offs cleared.'); }
    const input = parsed._positional.slice(2).join(' ');
    if (!input) return utils.error(message, 'Please provide sign-offs.');
    state.signoff = utils.parseList(input).join('\n');
    await state.save();
    return utils.success(message, 'Sign-offs updated.');
}

async function handleAliases(message, parsed, stateName) {
    const { state } = await getState(message, stateName);
    if (!state) return;
    const action = parsed._positional[2]?.toLowerCase();
    if (parsed.clear || action === 'clear') { state.name.aliases = []; await state.save(); return utils.success(message, 'Aliases cleared.'); }
    if (action === 'add') {
        const alias = parsed._positional.slice(3).join(' ');
        if (!alias) return utils.error(message, 'Please provide an alias.');
        state.name.aliases = state.name.aliases || []; state.name.aliases.push(alias); await state.save();
        return utils.success(message, `Alias **${alias}** added.`);
    }
    if (action === 'remove') {
        const alias = parsed._positional.slice(3).join(' ');
        state.name.aliases = state.name.aliases || [];
        const idx = state.name.aliases.findIndex(a => a.toLowerCase() === alias.toLowerCase());
        if (idx === -1) return utils.error(message, `Alias not found.`);
        state.name.aliases.splice(idx, 1); await state.save();
        return utils.success(message, `Alias removed.`);
    }
    const aliases = state.name?.aliases || [];
    return aliases.length ? utils.info(message, `Aliases: ${aliases.join(', ')}`) : utils.info(message, 'No aliases set.');
}

async function handleGroups(message, parsed, stateName) {
    const { state, system } = await getState(message, stateName);
    if (!state) return;
    const action = parsed._positional[2]?.toLowerCase();
    const groupName = parsed._positional.slice(3).join(' ');
    if (action === 'add') {
        if (!groupName) return utils.error(message, 'Please provide a group name.');
        const gr = await utils.findEntity(groupName, system, 'group');
        if (!gr) return utils.error(message, `Group **${groupName}** not found.`);
        state.groupIDs = state.groupIDs || [];
        if (state.groupIDs.includes(gr.entity._id)) return utils.error(message, 'Already in that group.');
        state.groupIDs.push(gr.entity._id); await state.save();
        // Bidirectional linking: also add state to group's stateIDs
        gr.entity.stateIDs = gr.entity.stateIDs || [];
        if (!gr.entity.stateIDs.includes(state._id)) {
            gr.entity.stateIDs.push(state._id);
            await gr.entity.save();
        }
        return utils.success(message, `Added to group **${gr.entity.name?.display || groupName}**`);
    }
    if (action === 'remove') {
        if (!groupName) return utils.error(message, 'Please provide a group name.');
        const gr = await utils.findEntity(groupName, system, 'group');
        if (!gr) return utils.error(message, `Group **${groupName}** not found.`);
        state.groupIDs = state.groupIDs || [];
        const idx = state.groupIDs.indexOf(gr.entity._id);
        if (idx === -1) return utils.error(message, 'Not in that group.');
        state.groupIDs.splice(idx, 1); await state.save();
        // Bidirectional linking: also remove state from group's stateIDs
        gr.entity.stateIDs = gr.entity.stateIDs || [];
        const groupIdx = gr.entity.stateIDs.indexOf(state._id);
        if (groupIdx !== -1) {
            gr.entity.stateIDs.splice(groupIdx, 1);
            await gr.entity.save();
        }
        return utils.success(message, `Removed from group.`);
    }
    const groups = await Group.find({ _id: { $in: state.groupIDs || [] } });
    return groups.length ? utils.info(message, `Groups: ${groups.map(g => g.name?.display || g.name?.indexable).join(', ')}`) : utils.info(message, 'Not in any groups.');
}

async function handleAlters(message, parsed, stateName) {
    const { state, system } = await getState(message, stateName);
    if (!state) return;
    const action = parsed._positional[2]?.toLowerCase();
    const alterName = parsed._positional.slice(3).join(' ');
    if (action === 'add') {
        if (!alterName) return utils.error(message, 'Please provide an alter name.');
        const al = await utils.findEntity(alterName, system, 'alter');
        if (!al) return utils.error(message, `Alter **${alterName}** not found.`);
        state.alters = state.alters || [];
        if (state.alters.includes(al.entity._id)) return utils.error(message, 'Already linked.');
        state.alters.push(al.entity._id); await state.save();
        // Bidirectional linking: also add state to alter's states array
        al.entity.states = al.entity.states || [];
        const stateIdStr = state._id.toString();
        if (!al.entity.states.some(s => s.connected_id === stateIdStr)) {
            al.entity.states.push({
                connected_id: stateIdStr,
                name: { indexable: state.name?.indexable, display: state.name?.display }
            });
            await al.entity.save();
        }
        return utils.success(message, `Linked to alter **${al.entity.name?.display || alterName}**`);
    }
    if (action === 'remove') {
        if (!alterName) return utils.error(message, 'Please provide an alter name.');
        const al = await utils.findEntity(alterName, system, 'alter');
        if (!al) return utils.error(message, `Alter **${alterName}** not found.`);
        state.alters = state.alters || [];
        const idx = state.alters.indexOf(al.entity._id);
        if (idx === -1) return utils.error(message, 'Not linked.');
        state.alters.splice(idx, 1); await state.save();
        // Bidirectional linking: also remove state from alter's states array
        al.entity.states = al.entity.states || [];
        const stateIdStr = state._id.toString();
        const alterIdx = al.entity.states.findIndex(s => s.connected_id === stateIdStr);
        if (alterIdx !== -1) {
            al.entity.states.splice(alterIdx, 1);
            await al.entity.save();
        }
        return utils.success(message, `Unlinked from alter.`);
    }
    const alters = await Alter.find({ _id: { $in: state.alters || [] } });
    return alters.length ? utils.info(message, `Linked alters: ${alters.map(a => a.name?.display || a.name?.indexable).join(', ')}`) : utils.info(message, 'No linked alters.');
}

async function handleCondition(message, parsed, stateName) {
    const { state, system } = await getState(message, stateName);
    if (!state) return;
    if (parsed.clear) { state.condition = undefined; await state.save(); return utils.success(message, 'Condition cleared.'); }
    const cond = parsed._positional.slice(2).join(' ');
    if (!cond) return utils.error(message, 'Please provide a condition.');
    state.condition = cond; await state.save();
    await utils.ensureConditionExists(system, 'state', cond);
    return utils.success(message, `Condition set to **${cond}**`);
}

async function handleCaution(message, parsed, stateName) {
    const { state } = await getState(message, stateName);
    if (!state) return;
    if (parsed.clear) { state.caution = undefined; await state.save(); return utils.success(message, 'Caution cleared.'); }
    const type = parsed._positional[2];
    const detail = parsed._positional.slice(3).join(' ');
    if (!type) return utils.error(message, 'Please provide a caution type.');
    state.caution = { c_type: type, detail: detail || undefined }; await state.save();
    return utils.success(message, `Caution set to **${type}**`);
}

async function handleClosedName(message, parsed, stateName) {
    const { state } = await getState(message, stateName);
    if (!state) return;
    if (parsed.clear) { state.name.closedNameDisplay = undefined; await state.save(); await proxyMessageHandler.invalidateDisplayCache(state._id); return utils.success(message, 'Closed name display cleared.'); }
    const newName = parsed._positional.slice(2).join(' ');
    if (!newName) return utils.error(message, 'Please provide a closed name display.');
    state.name.closedNameDisplay = newName;
    await state.save();
    await proxyMessageHandler.invalidateDisplayCache(state._id);
    return utils.success(message, `Closed name display set to **${newName}**`);
}

async function handleSync(message, parsed, stateName) {
    const { state } = await getState(message, stateName);
    if (!state) return;
    const val = parsed._positional[2]?.toLowerCase();
    if (!val || !['true', 'false', 'on', 'off', 'yes', 'no'].includes(val)) return utils.error(message, 'Specify `true` or `false`.');
    state.syncWithApps = state.syncWithApps || {};
    state.syncWithApps.discord = ['true', 'on', 'yes'].includes(val);
    await state.save();
    return utils.success(message, `Discord sync is now **${state.syncWithApps.discord ? 'enabled' : 'disabled'}**`);
}

async function handleDefaultStatus(message, parsed, stateName) {
    const { state } = await getState(message, stateName);
    if (!state) return;
    if (parsed.clear) { state.setting = state.setting || {}; state.setting.default_status = undefined; await state.save(); return utils.success(message, 'Default status cleared.'); }
    const status = parsed._positional.slice(2).join(' ');
    if (!status) return utils.error(message, 'Please provide a default status.');
    state.setting = state.setting || {};
    state.setting.default_status = status;
    await state.save();
    return utils.success(message, `Default status set to **${status}**`);
}

async function handleDefaultBattery(message, parsed, stateName) {
    const { state } = await getState(message, stateName);
    if (!state) return;
    if (parsed.clear) { state.setting = state.setting || {}; state.setting.default_battery = undefined; await state.save(); return utils.success(message, 'Default battery cleared.'); }
    const val = parseInt(parsed._positional[2]);
    if (isNaN(val) || val < 0 || val > 100) return utils.error(message, 'Please provide a battery level (0-100).');
    state.setting = state.setting || {};
    state.setting.default_battery = val;
    await state.save();
    return utils.success(message, `Default battery set to **${val}**`);
}

async function handleTriggers(message, parsed, stateName) {
    const { state } = await getState(message, stateName);
    if (!state) return;
    const action = parsed._positional[2]?.toLowerCase();
    if (action === 'add') {
        const trigger = parsed._positional.slice(3).join(' ');
        if (!trigger) return utils.error(message, 'Please provide a trigger.');
        state.caution = state.caution || {};
        state.caution.triggers = state.caution.triggers || [];
        state.caution.triggers.push({ text: trigger });
        await state.save();
        return utils.success(message, `Trigger \`${trigger}\` added.`);
    }
    if (action === 'remove') {
        const trigger = parsed._positional.slice(3).join(' ');
        if (!trigger) return utils.error(message, 'Please provide a trigger to remove.');
        state.caution = state.caution || {};
        state.caution.triggers = state.caution.triggers || [];
        const idx = state.caution.triggers.findIndex(t => t.text?.toLowerCase() === trigger.toLowerCase());
        if (idx === -1) return utils.error(message, `Trigger \`${trigger}\` not found.`);
        state.caution.triggers.splice(idx, 1);
        await state.save();
        return utils.success(message, `Trigger \`${trigger}\` removed.`);
    }
    if (action === 'clear') {
        state.caution = state.caution || {};
        state.caution.triggers = [];
        await state.save();
        return utils.success(message, 'All triggers cleared.');
    }
    const triggers = state.caution?.triggers || [];
    if (!triggers.length) return utils.info(message, 'No caution triggers set.');
    return utils.info(message, `Triggers: ${triggers.map(t => t.text || t).join(', ')}`);
}

async function handleMask(message, parsed, stateName) {
    const { state } = await getState(message, stateName);
    if (!state) return;
    const field = parsed._positional[2]?.toLowerCase();
    if (!field) {
        const embed = new EmbedBuilder().setColor(utils.ENTITY_COLORS.state).setTitle('🎭 Mask Settings')
            .setDescription(`Use \`sys!state <n> mask <field> <value>\`\nFields: name, displayname (dn), description, color, avatar, banner, proxyavatar (pav)`)
            .addFields(
                { name: 'Current Mask', value: `Name: ${state.mask?.name?.display || state.mask?.name?.indexable || '*not set*'}\nColor: ${state.mask?.color || '*not set*'}\nDescription: ${state.mask?.description || '*not set*'}`, inline: false }
            );
        return message.reply({ embeds: [embed] });
    }
    state.mask = state.mask || {};
    if (field === 'name') {
        const val = parsed._positional.slice(3).join(' ');
        if (!val) return utils.error(message, 'Please provide a mask name.');
        state.mask.name = state.mask.name || {};
        state.mask.name.indexable = val.toLowerCase().replace(/[^a-z0-9\-_]/g, '') || undefined;
        state.mask.name.display = val;
        await state.save();
        await proxyMessageHandler.invalidateDisplayCache(state._id);
        return utils.success(message, `Mask name set to **${val}**`);
    }
    if (field === 'displayname' || field === 'dn') {
        if (parsed.clear) { state.mask.name = state.mask.name || {}; state.mask.name.display = undefined; await state.save(); await proxyMessageHandler.invalidateDisplayCache(state._id); return utils.success(message, 'Mask display name cleared.'); }
        const val = parsed._positional.slice(3).join(' ');
        if (!val) return utils.error(message, 'Please provide a mask display name.');
        state.mask.name = state.mask.name || {};
        state.mask.name.display = val;
        await state.save();
        await proxyMessageHandler.invalidateDisplayCache(state._id);
        return utils.success(message, `Mask display name set to **${val}**`);
    }
    if (field === 'description' || field === 'desc') {
        if (parsed.clear) { state.mask.description = undefined; await state.save(); return utils.success(message, 'Mask description cleared.'); }
        const val = parsed._positional.slice(3).join(' ');
        if (!val) return utils.error(message, 'Please provide a mask description.');
        state.mask.description = val;
        await state.save();
        return utils.success(message, 'Mask description updated.');
    }
    if (field === 'color' || field === 'colour') {
        if (parsed.clear) { state.mask.color = undefined; await state.save(); return utils.success(message, 'Mask color cleared.'); }
        const val = utils.normalizeColor(parsed._positional[3]);
        if (!val) return utils.error(message, 'Please provide a valid hex color.');
        state.mask.color = val;
        await state.save();
        return utils.success(message, `Mask color set to **${val}**`);
    }
    if (field === 'avatar' || field === 'icon' || field === 'av') {
        if (parsed.clear) { state.mask.avatar = undefined; await state.save(); await proxyMessageHandler.invalidateDisplayCache(state._id); return utils.success(message, 'Mask avatar cleared.'); }
        const url = message.attachments.first()?.url || parsed._positional[3];
        if (!url) return utils.error(message, 'Please provide a URL or upload an image.');
        state.mask.avatar = { url };
        await state.save();
        await proxyMessageHandler.invalidateDisplayCache(state._id);
        return utils.success(message, 'Mask avatar updated.');
    }
    if (field === 'banner') {
        if (parsed.clear) { state.mask.discord = state.mask.discord || {}; state.mask.discord.image = state.mask.discord.image || {}; state.mask.discord.image.banner = undefined; await state.save(); await proxyMessageHandler.invalidateDisplayCache(state._id); return utils.success(message, 'Mask banner cleared.'); }
        const url = message.attachments.first()?.url || parsed._positional[3];
        if (!url) return utils.error(message, 'Please provide a URL or upload an image.');
        state.mask.discord = state.mask.discord || {};
        state.mask.discord.image = state.mask.discord.image || {};
        state.mask.discord.image.banner = { url };
        await state.save();
        await proxyMessageHandler.invalidateDisplayCache(state._id);
        return utils.success(message, 'Mask banner updated.');
    }
    if (field === 'proxyavatar' || field === 'pav') {
        if (parsed.clear) { state.mask.discord = state.mask.discord || {}; state.mask.discord.image = state.mask.discord.image || {}; state.mask.discord.image.proxyAvatar = undefined; await state.save(); await proxyMessageHandler.invalidateDisplayCache(state._id); return utils.success(message, 'Mask proxy avatar cleared.'); }
        const url = message.attachments.first()?.url || parsed._positional[3];
        if (!url) return utils.error(message, 'Please provide a URL.');
        state.mask.discord = state.mask.discord || {};
        state.mask.discord.image = state.mask.discord.image || {};
        state.mask.discord.image.proxyAvatar = { url };
        await state.save();
        await proxyMessageHandler.invalidateDisplayCache(state._id);
        return utils.success(message, 'Mask proxy avatar updated.');
    }
    return utils.error(message, `Unknown mask field: ${field}. Use: name, displayname, description, color, avatar, banner, proxyavatar`);
}

async function handlePrivacy(message, parsed, stateName) {
    const { state } = await getState(message, stateName);
    if (!state) return;
    const bucketArg = parsed._positional[2]?.toLowerCase();
    const field = parsed._positional[3]?.toLowerCase();
    const value = parsed._positional[4]?.toLowerCase();
    const validFields = ['description', 'avatar', 'banner', 'metadata', 'proxies', 'caution', 'hidden', 'aliases'];
    if (!bucketArg || !validFields.includes(bucketArg)) {
        const embed = new EmbedBuilder().setColor(utils.ENTITY_COLORS.state).setTitle('🔒 State Privacy')
            .setDescription(`Use \`sys!state <n> privacy <field> <public|private>\`\nor \`sys!state <n> privacy bucket:<name> <field> <public|private>\`\nFields: ${validFields.join(', ')}`);
        return message.reply({ embeds: [embed] });
    }
    const bucketName = bucketArg.startsWith('bucket:') ? bucketArg.slice(7) : 'default';
    const actualField = bucketArg.startsWith('bucket:') ? field : bucketArg;
    const actualValue = bucketArg.startsWith('bucket:') ? value : field;
    if (!validFields.includes(actualField)) return utils.error(message, `Invalid field.`);
    if (!actualValue || !['public', 'private'].includes(actualValue)) return utils.error(message, 'Specify `public` or `private`.');
    state.setting = state.setting || {}; state.setting.privacy = state.setting.privacy || [];
    let priv = state.setting.privacy.find(p => p.bucket === bucketName);
    if (!priv) { priv = { bucket: bucketName, settings: {} }; state.setting.privacy.push(priv); }
    priv.settings[actualField] = actualValue === 'private'; await state.save();
    return utils.success(message, `**${actualField}** is now **${actualValue}** in bucket **${bucketName}**`);
}

async function handleDelete(message, parsed, stateName) {
    const { state, system } = await getState(message, stateName);
    if (!state) return;
    if (!parsed.confirm) return utils.error(message, `⚠️ This will permanently delete **${state.name?.display || stateName}**.\nConfirm: \`sys!state ${stateName} delete -confirm\``);

    // Clean up bidirectional links
    for (const alterId of state.alters || []) {
        const alter = await Alter.findById(alterId);
        if (alter) { alter.states = alter.states?.filter(s => s.connected_id?.toString() !== state._id.toString()) || []; await alter.save(); }
    }
    for (const groupId of state.groupIDs || []) {
        const group = await Group.findById(groupId);
        if (group) { group.stateIDs = group.stateIDs?.filter(id => id !== state._id) || []; await group.save(); }
    }

    system.states.IDs = system.states.IDs?.filter(id => id !== state._id) || [];
    await system.save(); await State.deleteOne({ _id: state._id });
    utils.publishDeleteEvent(system._id, 'state', state._id);
    return utils.success(message, `**${state.name?.display || stateName}** deleted.`);
}

async function handleRemission(message, parsed, stateName) {
    const { state, system } = await getState(message, stateName);
    if (!state) return;
    state.condition = 'Remission'; await state.save();
    return utils.success(message, `**${state.name?.display || stateName}** marked as in remission.`);
}

async function handleId(message, parsed, stateName) {
    const { state } = await getState(message, stateName);
    if (!state) return;
    return message.reply(`\`${state._id}\``);
}

async function handleList(message, parsed) {
    const { system, targetUserId } = await utils.resolveTargetSystem(message, parsed);
    if (!system) return utils.error(message, targetUserId === message.author.id ? 'Not registered yet.' : 'Not registered.');
    const states = await State.find({ _id: { $in: system.states?.IDs || [] } });
    if (!states.length) return utils.info(message, 'No states found.');
    const embed = new EmbedBuilder().setColor(utils.ENTITY_COLORS.state).setTitle(`States (${states.length})`);
    if (parsed.full) {
        let desc = states.slice(0, 25).map(s => `**${s.name?.display || s.name?.indexable}** (\`${s.name?.indexable || s._id}\`)`).join('\n');
        if (states.length > 25) desc += `\n*...and ${states.length - 25} more*`;
        embed.setDescription(desc);
    } else {
        embed.setDescription(states.map(s => s.name?.display || s.name?.indexable).join(', '));
    }
    const isSelf = targetUserId === message.author.id;
    if (isSelf && !system.sys_type?.isFragmented && !system.sys_type?.isDissociative) {
        embed.addFields({ name: '⚠️ Notice', value: 'Your current setup does not allow states. You can update this in `sys!system edit` if you need a change.' });
    }
    return message.reply({ embeds: [embed] });
}

async function handleHelp(message) {
    const embed = utils.buildHelpEmbed('state', 'Manage states in your profile.', [
        { usage: 'sys!state <n>', description: 'Show state info' },
        { usage: 'sys!state new <n>', description: 'Create new state' },
        { usage: 'sys!state <n> rename <new>', description: 'Change name' },
        { usage: 'sys!state <n> displayname <n>', description: 'Set display name' },
        { usage: 'sys!state <n> closedname <n>', description: 'Set closed name display' },
        { usage: 'sys!state <n> description <text>', description: 'Set description' },
        { usage: 'sys!state <n> avatar <url>', description: 'Set avatar' },
        { usage: 'sys!state <n> proxy [add|remove] <tag>', description: 'Manage proxies' },
        { usage: 'sys!state <n> alters [add|remove] <alter>', description: 'Link alters' },
        { usage: 'sys!state <n> groups [add|remove] <group>', description: 'Manage groups' },
        { usage: 'sys!state <n> caution <type> [detail]', description: 'Set caution' },
        { usage: 'sys!state <n> triggers add|remove <text>', description: 'Manage caution triggers' },
        { usage: 'sys!state <n> privacy <field> <pub|priv>', description: 'Set privacy (default bucket)' },
        { usage: 'sys!state <n> privacy bucket:<name> <field> <pub|priv>', description: 'Set privacy (named bucket)' },
        { usage: 'sys!state <n> sync <true|false>', description: 'Toggle Discord sync' },
        { usage: 'sys!state <n> defaultstatus <status>', description: 'Set default shift status' },
        { usage: 'sys!state <n> defaultbattery <0-100>', description: 'Set default shift battery' },
        { usage: 'sys!state <n> mask <field> <value>', description: 'Edit mask mode settings' },
        { usage: 'sys!state <n> remission', description: 'Mark as in remission' },
        { usage: 'sys!state <n> delete -confirm', description: 'Delete state' },
        { usage: 'sys!state list [-full]', description: 'List all states' },
    ]);
    return message.reply({ embeds: [embed] });
}

async function buildStateEmbed(state, system, fallbackName = null) {
    const embed = new EmbedBuilder().setColor(state.color || utils.ENTITY_COLORS.state);
    const displayName = state.name?.display || state.name?.indexable || fallbackName || '(no name)';
    if (state.name?.indexable) embed.setAuthor({ name: state.name.indexable, iconURL: state.avatar?.url });
    embed.setTitle(displayName);
    if (state.description) embed.setDescription(state.description);
    if (state.avatar?.url) embed.setThumbnail(state.avatar.url);
    
    let info = '';
    if (state.condition) info += `**Condition:** ${state.condition}\n`;
    if (info) embed.addFields({ name: '🔄 Info', value: info.trim(), inline: true });
    
    if (state.proxy?.length) embed.addFields({ name: '💬 Proxies', value: utils.formatProxies(state.proxy), inline: true });
    
    if (state.alters?.length) {
        const alters = await Alter.find({ _id: { $in: state.alters } });
        if (alters.length) embed.addFields({ name: '🎭 Linked Alters', value: alters.map(a => a.name?.display || a.name?.indexable).join(', '), inline: true });
    }
    if (state.groupIDs?.length) {
        const groups = await Group.find({ _id: { $in: state.groupIDs } });
        if (groups.length) embed.addFields({ name: '👥 Groups', value: groups.map(g => g.name?.display || g.name?.indexable).join(', '), inline: true });
    }
    if (state.name?.aliases?.length) embed.addFields({ name: '📝 Aliases', value: state.name.aliases.join(', '), inline: true });
    if (state.caution?.c_type) embed.addFields({ name: '⚠️ Caution', value: state.caution.c_type + (state.caution.detail ? `\n${state.caution.detail}` : ''), inline: false });
    //embed.setFooter({ text: `ID: ${state._id}` });
    return embed;
}