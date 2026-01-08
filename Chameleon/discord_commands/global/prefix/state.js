// sys!state - State management prefix command
// States are similar to alters but represent different modes/states of being

const { EmbedBuilder } = require('discord.js');
const System = require('../../schemas/system');
const User = require('../../schemas/user');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const utils = require('../../functions/bot_utils');

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
            'privacy': handlePrivacy,
            'delete': handleDelete,
            'remission': handleRemission,
            'id': handleId
        };

        if (handlers[subcommand]) return handlers[subcommand](message, parsed, stateName);
        return handleShow(message, parsed, stateName);
    }
};

async function getState(message, stateName) {
    const { system } = await utils.getOrCreateUserAndSystem(message);
    if (!system) { await utils.error(message, 'You don\'t have a system yet.'); return { state: null, system: null }; }
    const result = await utils.findEntity(stateName, system, 'state');
    if (!result) { await utils.error(message, `State **${stateName}** not found.`); return { state: null, system }; }
    return { state: result.entity, system };
}

async function handleShow(message, parsed, stateName) {
    const { system, targetUserId } = await utils.resolveTargetSystem(message, parsed);
    if (!system) return utils.error(message, targetUserId === message.author.id ? 'You don\'t have a system.' : 'That user doesn\'t have a system.');
    const result = await utils.findEntity(stateName, system, 'state');
    if (!result) return utils.error(message, `State **${stateName}** not found.`);
    const embed = await buildStateEmbed(result.entity, system);
    return message.reply({ embeds: [embed] });
}

async function handleNew(message, parsed) {
    const { system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    const name = parsed._positional.slice(1).join(' ');
    if (!name) return utils.error(message, 'Please provide a name: `sys!state new <n>`');
    const indexable = name.toLowerCase().replace(/[^a-z0-9\-_]/g, '');
    if (!indexable) return utils.error(message, 'Name must contain at least one alphanumeric character.');
    const existing = await utils.findEntity(indexable, system, 'state');
    if (existing) return utils.error(message, `A state with the name **${indexable}** already exists.`);

    const state = new State({
        systemID: system._id,
        name: { indexable, display: name },
        addedAt: new Date()
    });
    await state.save();

    system.states = system.states || { IDs: [] };
    system.states.IDs.push(state._id);
    await system.save();

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
    return utils.success(message, `Indexable name changed to **${newName}**`);
}

async function handleDisplayName(message, parsed, stateName) {
    const { state } = await getState(message, stateName);
    if (!state) return;
    if (parsed.clear) { state.name.display = undefined; await state.save(); return utils.success(message, 'Display name cleared.'); }
    const newName = parsed._positional.slice(2).join(' ');
    if (!newName) return utils.error(message, 'Please provide a display name.');
    state.name.display = newName;
    await state.save();
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
    if (parsed.clear) { state.avatar = undefined; await state.save(); return utils.success(message, 'Avatar cleared.'); }
    const url = message.attachments.first()?.url || parsed._positional[2];
    if (!url) return utils.error(message, 'Please provide a URL or upload an image.');
    state.avatar = { url };
    await state.save();
    return utils.success(message, 'Avatar updated.');
}

async function handleBanner(message, parsed, stateName) {
    const { state } = await getState(message, stateName);
    if (!state) return;
    if (parsed.clear) { if (state.discord?.image) state.discord.image.banner = undefined; await state.save(); return utils.success(message, 'Banner cleared.'); }
    const url = message.attachments.first()?.url || parsed._positional[2];
    if (!url) return utils.error(message, 'Please provide a URL or upload an image.');
    state.discord = state.discord || {}; state.discord.image = state.discord.image || {};
    state.discord.image.banner = { url };
    await state.save();
    return utils.success(message, 'Banner updated.');
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
    const { state } = await getState(message, stateName);
    if (!state) return;
    const action = parsed._positional[2]?.toLowerCase();
    if (parsed.clear || action === 'clear') { state.proxy = []; await state.save(); return utils.success(message, 'Proxy tags cleared.'); }
    if (action === 'add') {
        const tag = parsed._positional.slice(3).join(' ');
        if (!tag) return utils.error(message, 'Please provide a proxy tag.');
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
    state.proxy = [tag]; await state.save();
    return utils.success(message, `Proxy tag set to \`${tag}\``);
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
        return utils.success(message, `Unlinked from alter.`);
    }
    const alters = await Alter.find({ _id: { $in: state.alters || [] } });
    return alters.length ? utils.info(message, `Linked alters: ${alters.map(a => a.name?.display || a.name?.indexable).join(', ')}`) : utils.info(message, 'No linked alters.');
}

async function handleCondition(message, parsed, stateName) {
    const { state } = await getState(message, stateName);
    if (!state) return;
    if (parsed.clear) { state.condition = undefined; await state.save(); return utils.success(message, 'Condition cleared.'); }
    const cond = parsed._positional.slice(2).join(' ');
    if (!cond) return utils.error(message, 'Please provide a condition.');
    state.condition = cond; await state.save();
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

async function handlePrivacy(message, parsed, stateName) {
    const { state } = await getState(message, stateName);
    if (!state) return;
    const field = parsed._positional[2]?.toLowerCase();
    const value = parsed._positional[3]?.toLowerCase();
    const validFields = ['description', 'avatar', 'banner', 'metadata', 'proxies', 'caution', 'hidden', 'aliases'];
    if (!field) {
        const embed = new EmbedBuilder().setColor(utils.ENTITY_COLORS.state).setTitle('🔒 State Privacy')
            .setDescription(`Use \`sys!state <n> privacy <field> <public|private>\`\nFields: ${validFields.join(', ')}`);
        return message.reply({ embeds: [embed] });
    }
    if (!validFields.includes(field)) return utils.error(message, `Invalid field.`);
    if (!value || !['public', 'private'].includes(value)) return utils.error(message, 'Specify `public` or `private`.');
    state.setting = state.setting || {}; state.setting.privacy = state.setting.privacy || [];
    let priv = state.setting.privacy.find(p => p.bucket === 'default');
    if (!priv) { priv = { bucket: 'default', settings: {} }; state.setting.privacy.push(priv); }
    priv.settings[field] = value === 'private'; await state.save();
    return utils.success(message, `**${field}** is now **${value}**`);
}

async function handleDelete(message, parsed, stateName) {
    const { state, system } = await getState(message, stateName);
    if (!state) return;
    if (!parsed.confirm) return utils.error(message, `⚠️ This will permanently delete **${state.name?.display || stateName}**.\nConfirm: \`sys!state ${stateName} delete -confirm\``);
    system.states.IDs = system.states.IDs?.filter(id => id !== state._id) || [];
    await system.save(); await State.deleteOne({ _id: state._id });
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
    if (!system) return utils.error(message, targetUserId === message.author.id ? 'You don\'t have a system.' : 'That user doesn\'t have a system.');
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
    return message.reply({ embeds: [embed] });
}

async function handleHelp(message) {
    const embed = utils.buildHelpEmbed('state', 'Manage states in your system.', [
        { usage: 'sys!state <n>', description: 'Show state info' },
        { usage: 'sys!state new <n>', description: 'Create new state' },
        { usage: 'sys!state <n> rename <new>', description: 'Change name' },
        { usage: 'sys!state <n> displayname <n>', description: 'Set display name' },
        { usage: 'sys!state <n> description <text>', description: 'Set description' },
        { usage: 'sys!state <n> avatar <url>', description: 'Set avatar' },
        { usage: 'sys!state <n> proxy [add|remove] <tag>', description: 'Manage proxies' },
        { usage: 'sys!state <n> alters [add|remove] <alter>', description: 'Link alters' },
        { usage: 'sys!state <n> groups [add|remove] <group>', description: 'Manage groups' },
        { usage: 'sys!state <n> remission', description: 'Mark as in remission' },
        { usage: 'sys!state <n> delete -confirm', description: 'Delete state' },
        { usage: 'sys!state list [-full]', description: 'List all states' },
    ]);
    return message.reply({ embeds: [embed] });
}

async function buildStateEmbed(state, system) {
    const embed = new EmbedBuilder().setColor(state.color || utils.ENTITY_COLORS.state);
    const displayName = state.name?.display || state.name?.indexable || 'Unknown';
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
    embed.setFooter({ text: `ID: ${state._id}` });
    return embed;
}