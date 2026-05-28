// sys!switch - Switch/front management
// Creates Shift documents and supports dual layer syntax
//
// USAGE:
//   sys!switch Bird Moss                          # Quick switch, layer 0
//   sys!switch Bird | Moss | Peter                # Sequential layers (0, 1, 2)
//   sys!switch layer:1 Bird layer:3 Moss Peter    # Explicit layers (1, 3)
//   sys!switch Bird | Moss layer:3 Peter          # Combined
//   sys!switch out                                # Switch out
//   sys!switch edit <members...>|out              # Edit latest switch
//   sys!switch copy <members...>                  # Toggle members
//   sys!switch delete [all]                       # Delete latest or all
//   sys!switch status:"feeling good" battery:80   # With overrides

const { EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const System = require('../../../schemas/system');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const Group = require('../../../schemas/group');
const { Shift } = require('../../../schemas/front');
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

// Parse raw args into layer assignments
// Supports: | (pipe = next layer), layer:N (explicit layer), entity names
function parseLayerAssignments(args) {
    const layers = {};
    let currentLayer = 0;
    const entityNames = [];
    
    for (const arg of args) {
        const layerMatch = arg.match(/^layer:(\d+)$/i);
        if (layerMatch) {
            currentLayer = parseInt(layerMatch[1]);
            if (!layers[currentLayer]) layers[currentLayer] = [];
        } else if (arg === '|') {
            currentLayer++;
            if (!layers[currentLayer]) layers[currentLayer] = [];
        } else if (arg.startsWith('-')) {
            // Skip flags (handled by parseArgs)
        } else {
            if (!layers[currentLayer]) layers[currentLayer] = [];
            layers[currentLayer].push(arg);
            entityNames.push(arg);
        }
    }
    
    // If no layers were explicitly created but we have entities, put them in layer 0
    if (entityNames.length > 0 && Object.keys(layers).length === 0) {
        layers[0] = entityNames;
    }
    
    return { layers, entityNames };
}

async function handleSwitch(message, parsed) {
    const { system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    // Parse layer assignments from raw args
    const { layers, entityNames } = parseLayerAssignments(parsed._positional);
    if (!entityNames.length) return utils.error(message, 'Provide member(s): `sys!switch <member>...`');

    // Get optional overrides
    const statusOverride = parsed.status || null;
    const batteryOverride = parsed.battery ? parseInt(parsed.battery) : null;
    const cautionOverride = parsed.caution ? parsed.caution : null;

    // Resolve all entities
    const resolved = {};
    const notFound = [];
    for (const name of entityNames) {
        if (resolved[name]) continue; // Already resolved
        const result = await utils.findEntity(name, system);
        if (!result) { notFound.push(name); continue; }
        resolved[name] = { entity: result.entity, type: result.type };
    }
    if (notFound.length) return utils.error(message, `Not found: ${notFound.join(', ')}`);

    // Ensure system.front.layers exists
    system.front = system.front || { layers: [] };

    // Process each layer
    for (const [layerNum, names] of Object.entries(layers)) {
        const layerIdx = parseInt(layerNum);
        
        // Ensure layer exists
        while (system.front.layers.length <= layerIdx) {
            system.front.layers.push({
                _id: new mongoose.Types.ObjectId(),
                name: layerIdx === 0 ? 'Main' : `Layer ${layerIdx}`,
                shifts: [],
                fronters: []
            });
        }
        
        const layer = system.front.layers[layerIdx];
        layer.fronters = [];
        layer.shifts = layer.shifts || [];

        // Create Shift documents for each entity in this layer
        for (const name of names) {
            const { entity, type } = resolved[name];
            
            // Build initial status from entity presets + overrides
            const initialStatus = {
                status: statusOverride || entity.setting?.default_status || null,
                battery: batteryOverride ?? entity.setting?.default_battery ?? null,
                caution: cautionOverride ? { c_type: cautionOverride } : (entity.caution || null),
                startTime: new Date(),
                endTime: null,
                layerID: layer._id,
                hidden: 'n'
            };

            // Create Shift document
            const shift = new Shift({
                id: new mongoose.Types.ObjectId(),
                s_type: type,
                ID: entity._id.toString(),
                type_name: entity.name?.display || entity.name?.indexable || name,
                startTime: new Date(),
                endTime: null,
                statuses: [initialStatus]
            });
            await shift.save();

            // Add shift reference to layer
            layer.shifts.push(shift._id);

            // Add fronter reference
            const fronterObj = { startTime: new Date() };
            if (type === 'alter') fronterObj.alterID = entity._id;
            else if (type === 'state') fronterObj.stateID = entity._id;
            else if (type === 'group') fronterObj.groupID = entity._id;
            layer.fronters.push(fronterObj);
        }
    }

    // Update recent proxies
    system.proxy = system.proxy || {};
    system.proxy.recentProxies = system.proxy.recentProxies || [];
    const firstEntity = resolved[entityNames[0]];
    if (firstEntity) {
        system.proxy.recentProxies.unshift(`${firstEntity.type}:${firstEntity.entity._id}`);
        system.proxy.recentProxies = system.proxy.recentProxies.slice(0, 10);
    }

    await system.save();

    // Build response
    const layerDesc = Object.entries(layers).map(([num, names]) => {
        const resolvedNames = names.map(n => resolved[n]?.entity?.name?.display || n);
        return `Layer ${num}: **${resolvedNames.join(', ')}**`;
    }).join('\n');

    const embed = new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.success)
        .setTitle('✅ Switch Registered')
        .setDescription(layerDesc)
        .setTimestamp();

    if (statusOverride) embed.addFields({ name: 'Status', value: statusOverride, inline: true });
    if (batteryOverride !== null) embed.addFields({ name: 'Battery', value: `${batteryOverride} ${utils.getBatteryEmoji(batteryOverride)}`, inline: true });

    return message.reply({ embeds: [embed] });
}

async function handleSwitchOut(message, parsed) {
    const { system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    system.front = system.front || { layers: [] };
    
    // End all active shifts in all layers
    for (const layer of system.front.layers) {
        if (layer.shifts?.length) {
            await Shift.updateMany(
                { _id: { $in: layer.shifts }, endTime: null },
                { $set: { endTime: new Date() } }
            );
        }
        layer.fronters = [];
    }

    await system.save();
    return utils.success(message, 'Switched out. No one fronting.');
}

async function handleEdit(message, parsed) {
    const { system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    const memberNames = parsed._positional.slice(1);
    if (!memberNames.length) return utils.error(message, 'Provide member(s) for the switch.');

    // Find the last layer with fronters
    let targetLayer = null;
    let targetLayerIdx = -1;
    for (let i = system.front?.layers?.length - 1; i >= 0; i--) {
        if (system.front.layers[i]?.fronters?.length > 0) {
            targetLayer = system.front.layers[i];
            targetLayerIdx = i;
            break;
        }
    }
    if (!targetLayer) return utils.error(message, 'No active switch to edit.');

    if (memberNames[0]?.toLowerCase() === 'out') {
        // End shifts and clear fronters
        if (targetLayer.shifts?.length) {
            await Shift.updateMany(
                { _id: { $in: targetLayer.shifts }, endTime: null },
                { $set: { endTime: new Date() } }
            );
        }
        targetLayer.fronters = [];
        await system.save();
        return utils.success(message, 'Switch edited to switch-out.');
    }

    // End existing shifts
    if (targetLayer.shifts?.length) {
        await Shift.updateMany(
            { _id: { $in: targetLayer.shifts }, endTime: null },
            { $set: { endTime: new Date() } }
        );
    }

    // Create new shifts
    targetLayer.shifts = [];
    targetLayer.fronters = [];

    for (const name of memberNames) {
        const result = await utils.findEntity(name, system);
        if (!result) continue;

        const initialStatus = {
            status: result.entity.setting?.default_status || null,
            battery: result.entity.setting?.default_battery ?? null,
            caution: result.entity.caution || null,
            startTime: new Date(),
            endTime: null,
            layerID: targetLayer._id,
            hidden: 'n'
        };

        const shift = new Shift({
            id: new mongoose.Types.ObjectId(),
            s_type: result.type,
            ID: result.entity._id.toString(),
            type_name: result.entity.name?.display || result.entity.name?.indexable || name,
            startTime: new Date(),
            statuses: [initialStatus]
        });
        await shift.save();

        targetLayer.shifts.push(shift._id);

        const fronterObj = { startTime: new Date() };
        if (result.type === 'alter') fronterObj.alterID = result.entity._id;
        else if (result.type === 'state') fronterObj.stateID = result.entity._id;
        else if (result.type === 'group') fronterObj.groupID = result.entity._id;
        targetLayer.fronters.push(fronterObj);
    }

    await system.save();
    const names = targetLayer.fronters.map(f => {
        const id = f.alterID || f.stateID || f.groupID;
        return resolvedNameCache[id] || 'Unknown';
    }).filter(Boolean);

    return utils.success(message, `Switch edited. Now fronting: **${names.join(', ') || 'nobody'}**`);
}

// Simple name cache for edit response
const resolvedNameCache = {};

async function handleCopy(message, parsed) {
    const { system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    // Find the last layer with fronters
    let targetLayer = null;
    for (let i = system.front?.layers?.length - 1; i >= 0; i--) {
        if (system.front.layers[i]?.fronters?.length > 0) {
            targetLayer = system.front.layers[i];
            break;
        }
    }
    if (!targetLayer) return utils.error(message, 'No active switch to copy.');

    const memberNames = parsed._positional.slice(1);
    if (!memberNames.length) return utils.error(message, 'Provide member(s) to toggle.');

    // Get current fronter IDs
    const currentIds = new Set(targetLayer.fronters.map(f => f.alterID || f.stateID || f.groupID));
    
    // Toggle: remove if present, add if not
    for (const name of memberNames) {
        const result = await utils.findEntity(name, system);
        if (!result) continue;
        
        const id = result.entity._id.toString();
        if (currentIds.has(id)) {
            currentIds.delete(id);
        } else {
            currentIds.add(id);
        }
    }

    // End old shifts
    if (targetLayer.shifts?.length) {
        await Shift.updateMany(
            { _id: { $in: targetLayer.shifts }, endTime: null },
            { $set: { endTime: new Date() } }
        );
    }

    // Create new shifts for current set
    targetLayer.shifts = [];
    targetLayer.fronters = [];

    for (const id of currentIds) {
        const entity = await Alter.findById(id) || await State.findById(id) || await Group.findById(id);
        if (!entity) continue;
        
        const type = await Alter.findById(id) ? 'alter' : (await State.findById(id) ? 'state' : 'group');
        
        const initialStatus = {
            status: entity.setting?.default_status || null,
            battery: entity.setting?.default_battery ?? null,
            caution: entity.caution || null,
            startTime: new Date(),
            endTime: null,
            layerID: targetLayer._id,
            hidden: 'n'
        };

        const shift = new Shift({
            id: new mongoose.Types.ObjectId(),
            s_type: type,
            ID: entity._id.toString(),
            type_name: entity.name?.display || entity.name?.indexable || 'Unknown',
            startTime: new Date(),
            statuses: [initialStatus]
        });
        await shift.save();

        targetLayer.shifts.push(shift._id);

        const fronterObj = { startTime: new Date() };
        if (type === 'alter') fronterObj.alterID = entity._id;
        else if (type === 'state') fronterObj.stateID = entity._id;
        else if (type === 'group') fronterObj.groupID = entity._id;
        targetLayer.fronters.push(fronterObj);
    }

    await system.save();

    const names = targetLayer.fronters.map(f => {
        const id = f.alterID || f.stateID || f.groupID;
        return resolvedNameCache[id] || 'Unknown';
    }).filter(Boolean);

    if (!targetLayer.fronters.length) return utils.success(message, 'Switch-out registered.');
    return utils.success(message, `Now fronting: **${names.join(', ')}**`);
}

async function handleDelete(message, parsed) {
    const { system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed._positional[1]?.toLowerCase() === 'all') {
        if (!parsed.confirm) return utils.error(message, 'Delete ALL switches?\nConfirm: `sys!switch delete all -confirm`');
        
        // End all shifts
        await Shift.updateMany(
            { endTime: null },
            { $set: { endTime: new Date() } }
        );

        system.front = { layers: [{ _id: new mongoose.Types.ObjectId(), name: 'Main', shifts: [], fronters: [] }] };
        await system.save();
        return utils.success(message, 'All switch history deleted.');
    }

    // Find the last layer with fronters
    let targetLayer = null;
    for (let i = system.front?.layers?.length - 1; i >= 0; i--) {
        if (system.front.layers[i]?.fronters?.length > 0) {
            targetLayer = system.front.layers[i];
            break;
        }
    }
    if (!targetLayer) return utils.error(message, 'No active switch to delete.');

    // End shifts
    if (targetLayer.shifts?.length) {
        await Shift.updateMany(
            { _id: { $in: targetLayer.shifts }, endTime: null },
            { $set: { endTime: new Date() } }
        );
    }

    targetLayer.fronters = [];
    targetLayer.shifts = [];
    await system.save();
    return utils.success(message, 'Latest switch deleted.');
}

async function handleHelp(message) {
    const embed = utils.buildHelpEmbed('switch', 'Manage front switching.', [
        { usage: 'sys!switch <member>...', description: 'Register a switch' },
        { usage: 'sys!switch <m1> | <m2> | <m3>', description: 'Multi-layer switch (sequential)' },
        { usage: 'sys!switch layer:1 <m1> layer:3 <m2>', description: 'Explicit layer assignment' },
        { usage: 'sys!switch status:"..." battery:80', description: 'Switch with status/battery' },
        { usage: 'sys!switch out', description: 'Switch-out (no fronters)' },
        { usage: 'sys!switch edit <member>...|out', description: 'Edit latest switch' },
        { usage: 'sys!switch copy <member>...', description: 'Toggle members in current switch' },
        { usage: 'sys!switch delete', description: 'Delete latest switch' },
        { usage: 'sys!switch delete all -confirm', description: 'Delete all switches' },
    ]);
    return message.reply({ embeds: [embed] });
}
