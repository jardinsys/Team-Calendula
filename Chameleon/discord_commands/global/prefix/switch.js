// sys!switch - Switch/front management
const { EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const System = require('../../../schemas/system');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const Group = require('../../../schemas/group');
const utils = require('../../functions/bot_utils');

module.exports = {
    name: 'switch',
    aliases: ['sw'],

    async executeMessage(message, args) {
        const parsed = utils.parseArgs(args);
        const firstArg = parsed._positional[0]?.toLowerCase();
        if (!firstArg || firstArg === 'help') return handleHelp(message);
        if (firstArg === 'out') return handleSwitchOut(message, parsed);
        if (firstArg === 'edit') return handleEdit(message, parsed);
        if (firstArg === 'delete') return handleDelete(message, parsed);
        if (firstArg === 'copy') return handleCopy(message, parsed);
        return handleSwitch(message, parsed);
    }
};

async function handleSwitch(message, parsed) {
    const { system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    const memberNames = parsed._positional;
    if (!memberNames.length) return utils.error(message, 'Provide member(s): `sys!switch <member>...`');

    const fronters = [];
    const notFound = [];
    for (const name of memberNames) {
        const result = await utils.findEntity(name, system);
        if (!result) { notFound.push(name); continue; }
        fronters.push({ entityId: result.entity._id, type: result.type, name: result.entity.name?.display || name });
    }
    if (notFound.length) return utils.error(message, `Not found: ${notFound.join(', ')}`);
    if (!fronters.length) return utils.error(message, 'No valid members.');

    system.front = system.front || { layers: [] };
    if (!system.front.layers.length) system.front.layers.push({ _id: new mongoose.Types.ObjectId(), name: 'Main', fronters: [] });

    const fronterObjs = fronters.map(f => {
        const obj = { startTime: new Date() };
        if (f.type === 'alter') obj.alterID = f.entityId;
        else if (f.type === 'state') obj.stateID = f.entityId;
        else if (f.type === 'group') obj.groupID = f.entityId;
        return obj;
    });

    system.front.layers[0].fronters = fronterObjs;
    system.proxy = system.proxy || {};
    system.proxy.recentProxies = system.proxy.recentProxies || [];
    system.proxy.recentProxies.unshift(`${fronters[0].type}:${fronters[0].entityId}`);
    system.proxy.recentProxies = system.proxy.recentProxies.slice(0, 10);
    await system.save();

    const embed = new EmbedBuilder().setColor(utils.ENTITY_COLORS.success).setTitle('✅ Switch Registered')
        .setDescription(`Now fronting: **${fronters.map(f => f.name).join(', ')}**`).setTimestamp();
    return message.reply({ embeds: [embed] });
}

async function handleSwitchOut(message, parsed) {
    const { system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    system.front = system.front || { layers: [] };
    if (!system.front.layers.length) system.front.layers.push({ _id: new mongoose.Types.ObjectId(), name: 'Main', fronters: [] });
    system.front.layers[0].fronters = [];
    await system.save();
    return utils.success(message, 'Switched out. No one fronting.');
}

async function handleEdit(message, parsed) {
    const { system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    const memberNames = parsed._positional.slice(1);
    if (!memberNames.length) return utils.error(message, 'Provide member(s) for the switch.');
    if (memberNames[0]?.toLowerCase() === 'out') {
        system.front.layers[0].fronters = [];
        await system.save();
        return utils.success(message, 'Switch edited to switch-out.');
    }
    const fronters = [];
    for (const name of memberNames) {
        const result = await utils.findEntity(name, system);
        if (!result) continue;
        const obj = { startTime: new Date() };
        if (result.type === 'alter') obj.alterID = result.entity._id;
        else if (result.type === 'state') obj.stateID = result.entity._id;
        else if (result.type === 'group') obj.groupID = result.entity._id;
        fronters.push({ obj, name: result.entity.name?.display || name });
    }
    if (!fronters.length) return utils.error(message, 'No valid members.');
    system.front = system.front || { layers: [{ _id: new mongoose.Types.ObjectId(), name: 'Main', fronters: [] }] };
    system.front.layers[0].fronters = fronters.map(f => f.obj);
    await system.save();
    return utils.success(message, `Switch edited. Now fronting: **${fronters.map(f => f.name).join(', ')}**`);
}

async function handleCopy(message, parsed) {
    const { system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    const currentFronters = system.front?.layers?.[0]?.fronters || [];
    const memberNames = parsed._positional.slice(1);
    if (!memberNames.length) return utils.error(message, 'Provide member(s) to toggle.');
    const fronterIds = new Set(currentFronters.map(f => f.alterID || f.stateID || f.groupID));
    for (const name of memberNames) {
        const result = await utils.findEntity(name, system);
        if (!result) continue;
        fronterIds.has(result.entity._id) ? fronterIds.delete(result.entity._id) : fronterIds.add(result.entity._id);
    }
    const newFronters = [];
    for (const id of fronterIds) {
        const alter = await Alter.findById(id);
        if (alter) { newFronters.push({ alterID: id, startTime: new Date() }); continue; }
        const state = await State.findById(id);
        if (state) { newFronters.push({ stateID: id, startTime: new Date() }); continue; }
        const group = await Group.findById(id);
        if (group) newFronters.push({ groupID: id, startTime: new Date() });
    }
    system.front.layers[0].fronters = newFronters;
    await system.save();
    if (!newFronters.length) return utils.success(message, 'Switch-out registered.');
    const names = [];
    for (const f of newFronters) {
        const id = f.alterID || f.stateID || f.groupID;
        const e = await Alter.findById(id) || await State.findById(id) || await Group.findById(id);
        if (e) names.push(e.name?.display || e.name?.indexable);
    }
    return utils.success(message, `Now fronting: **${names.join(', ')}**`);
}

async function handleDelete(message, parsed) {
    const { system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    if (parsed._positional[1]?.toLowerCase() === 'all') {
        if (!parsed.confirm) return utils.error(message, '⚠️ Delete ALL switches?\nConfirm: `sys!switch delete all -confirm`');
        system.front = { layers: [{ _id: new mongoose.Types.ObjectId(), name: 'Main', fronters: [] }] };
        await system.save();
        return utils.success(message, 'All switch history deleted.');
    }
    if (system.front?.layers?.[0]) system.front.layers[0].fronters = [];
    await system.save();
    return utils.success(message, 'Latest switch deleted.');
}

async function handleHelp(message) {
    const embed = utils.buildHelpEmbed('switch', 'Manage front switching.', [
        { usage: 'sys!switch <member>...', description: 'Register a switch' },
        { usage: 'sys!switch out', description: 'Switch-out (no fronters)' },
        { usage: 'sys!switch edit <member>...|out', description: 'Edit latest switch' },
        { usage: 'sys!switch copy <member>...', description: 'Toggle members in current switch' },
        { usage: 'sys!switch delete', description: 'Delete latest switch' },
        { usage: 'sys!switch delete all -confirm', description: 'Delete all switches' },
    ]);
    return message.reply({ embeds: [embed] });
}