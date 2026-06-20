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
const { simpleField, nameField, mediaField, booleanField, nestedField, listField, proxyHandler, privacyHandler, idHandler, maskHandler } = require('../../functions/bot_utils/entityHandlers');

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

        // Getter wrapper: returns { entity, system } for factory functions
        async function getStateEntity(message, name) {
            const { state, system } = await getState(message, name || stateName);
            if (!state) return null;
            return { entity: state, system };
        }

        const handlers = {
            'rename': nameField(getStateEntity, 'indexable', 'Indexable name', { validateIndexable: true }),
            'name': nameField(getStateEntity, 'indexable', 'Indexable name', { validateIndexable: true }),
            'displayname': nameField(getStateEntity, 'display', 'Display name'),
            'dn': nameField(getStateEntity, 'display', 'Display name'),
            'closedname': nameField(getStateEntity, 'closedNameDisplay', 'Closed name display'),
            'cn': nameField(getStateEntity, 'closedNameDisplay', 'Closed name display'),
            'description': simpleField(getStateEntity, 'description', 'Description'),
            'desc': simpleField(getStateEntity, 'description', 'Description'),
            'avatar': mediaField(getStateEntity, 'avatar', 'Avatar', { entityType: 'State', uploadFieldName: 'avatar' }),
            'icon': mediaField(getStateEntity, 'avatar', 'Avatar', { entityType: 'State', uploadFieldName: 'avatar' }),
            'av': mediaField(getStateEntity, 'avatar', 'Avatar', { entityType: 'State', uploadFieldName: 'avatar' }),
            'banner': mediaField(getStateEntity, 'discord.image.banner', 'Banner', { syncBucket: true, entityType: 'State', uploadFieldName: 'banner' }),
            'color': simpleField(getStateEntity, 'color', 'Color'),
            'colour': simpleField(getStateEntity, 'color', 'Color'),
            'proxy': proxyHandler(getStateEntity),
            'signoff': simpleField(getStateEntity, 'signoff', 'Sign-offs'),
            'sign': simpleField(getStateEntity, 'signoff', 'Sign-offs'),
            'aliases': listField(getStateEntity, 'name.aliases', 'Aliases'),
            'alias': listField(getStateEntity, 'name.aliases', 'Aliases'),
            'condition': simpleField(getStateEntity, 'condition', 'Condition', { entityType: 'state' }),
            'cond': simpleField(getStateEntity, 'condition', 'Condition', { entityType: 'state' }),
            'caution': simpleField(getStateEntity, 'caution', 'Caution'),
            'triggers': listField(getStateEntity, 'caution.triggers', 'Triggers', { matchKey: 'text', itemFactory: (text) => ({ text }) }),
            'trigger': listField(getStateEntity, 'caution.triggers', 'Triggers', { matchKey: 'text', itemFactory: (text) => ({ text }) }),
            'privacy': privacyHandler(getStateEntity, 'state', ['description', 'avatar', 'banner', 'metadata', 'proxies', 'caution', 'hidden', 'aliases'], utils.ENTITY_COLORS.state),
            'sync': booleanField(getStateEntity, 'syncWithApps.discord', 'Discord sync'),
            'defaultstatus': nestedField(getStateEntity, 'setting', 'default_status', 'Default status'),
            'ds': nestedField(getStateEntity, 'setting', 'default_status', 'Default status'),
            'defaultbattery': nestedField(getStateEntity, 'setting', 'default_battery', 'Default battery', { parser: (v) => parseInt(v), validator: (v) => !isNaN(v) && v >= 0 && v <= 100, errorMsg: 'Please provide a battery level (0-100).' }),
            'db': nestedField(getStateEntity, 'setting', 'default_battery', 'Default battery', { parser: (v) => parseInt(v), validator: (v) => !isNaN(v) && v >= 0 && v <= 100, errorMsg: 'Please provide a battery level (0-100).' }),
            'mask': maskHandler(getStateEntity, 'state', utils.ENTITY_COLORS.state),
            'id': idHandler(getStateEntity),
            // Entity-specific handlers
            'groups': handleGroups, 'group': handleGroups,
            'alters': handleAlters, 'alter': handleAlters,
            'delete': handleDelete,
            'remission': handleRemission,
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
    const indexable = name.toLowerCase().replace(/[^a-z0-9\\-_]/g, '') || undefined;

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
    return embed;
}
