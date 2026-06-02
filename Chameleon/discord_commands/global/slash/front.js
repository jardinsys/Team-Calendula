// (/front) - Systemiser Front Command
// Unified front management: view, switch, layers, per-entity editing
// Merges switch.js and quickswitch.js functionality

const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');

const mongoose = require('mongoose');
const System = require('../../../schemas/system');
const User = require('../../../schemas/user');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const Group = require('../../../schemas/group');
const { Shift } = require('../../../schemas/front');
const utils = require('../../functions/bot_utils');

const WEBAPP_URL = 'https://systemise.teamcalendula.net';
const ENTITY_COLORS = utils.ENTITY_COLORS;
const { getSystemTerm } = utils;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('front')
        .setDescription('View and manage front switching, layers, and shift statuses')
        .addStringOption(opt => opt
            .setName('action')
            .setDescription('What to do')
            .setRequired(false)
            .addChoices(
                { name: 'Switch - Change who is fronting', value: 'switch' },
                { name: 'Add - Add entity to current front', value: 'add' },
                { name: 'Remove - Remove entity from front', value: 'remove' },
                { name: 'Status - Update front status', value: 'status' },
                { name: 'Battery - Update social battery', value: 'battery' },
                { name: 'History - View recent switches', value: 'history' },
                { name: 'Layers - Manage layers', value: 'layers' }
            ))
        .addBooleanOption(opt => opt
            .setName('quick')
            .setDescription('Quick mode (no webapp link, no confirmation for simple actions)')
            .setRequired(false)),

    async execute(interaction) {
        const action = interaction.options.getString('action');
        const quick = interaction.options.getBoolean('quick') ?? false;
        const { user, system, isNew } = await utils.getOrCreateUserAndSystem(interaction);

        if (isNew) return utils.handleNewUserFlow(interaction, 'front');
        if (!system) return interaction.reply({ content: '❌ Not registered.', ephemeral: true });

        if (!action) return await handleView(interaction, system, user, quick);

        switch (action) {
            case 'switch': return await handleSwitch(interaction, system, quick);
            case 'add': return await handleAdd(interaction, system, quick);
            case 'remove': return await handleRemove(interaction, system, quick);
            case 'status': return await handleStatus(interaction, system, quick);
            case 'battery': return await handleBattery(interaction, system, quick);
            case 'history': return await handleHistory(interaction, system, quick);
            case 'layers': return await handleLayers(interaction, system, quick);
        }
    },

    async autocomplete(interaction) {
        return handleAutocomplete(interaction);
    },

    handleButtonInteraction,
    handleSelectMenu,
    handleModalSubmit
};

// ============================================
// VIEW - Shows current front state
// ============================================

async function handleView(interaction, system, user, quick) {
    await interaction.deferReply({ ephemeral: false });

    const closedCharAllowed = await utils.checkClosedCharAllowed(interaction.guild);
    const embed = await buildFrontEmbed(system, user, interaction, true, closedCharAllowed);
    const components = quick ? [] : [buildViewActionRow(system)];

    return interaction.editReply({ embeds: [embed], components });
}

function buildViewActionRow(system) {
    const buttons = [
        new ButtonBuilder().setCustomId(`front_switch_session_${system._id}`).setLabel('Switch').setStyle(ButtonStyle.Primary).setEmoji('🔄'),
        new ButtonBuilder().setCustomId(`front_add_btn_${system._id}`).setLabel('Add').setStyle(ButtonStyle.Success).setEmoji('➕'),
        new ButtonBuilder().setCustomId(`front_remove_btn_${system._id}`).setLabel('Remove').setStyle(ButtonStyle.Danger).setEmoji('➖'),
        new ButtonBuilder().setCustomId(`front_status_btn_${system._id}`).setLabel('Status').setStyle(ButtonStyle.Secondary).setEmoji('💬'),
        new ButtonBuilder().setCustomId(`front_battery_btn_${system._id}`).setLabel('Battery').setStyle(ButtonStyle.Secondary).setEmoji('🔋'),
    ];
    const row2 = [
        new ButtonBuilder().setCustomId(`front_history_btn_${system._id}`).setLabel('History').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
        new ButtonBuilder().setCustomId(`front_layers_btn_${system._id}`).setLabel('Layers').setStyle(ButtonStyle.Secondary).setEmoji('📑'),
        new ButtonBuilder().setLabel('Open Full Front').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/front`).setEmoji('🌐'),
    ];
    return [
        new ActionRowBuilder().addComponents(buttons),
        new ActionRowBuilder().addComponents(row2)
    ];
}

// ============================================
// SWITCH - Quick or guided session
// ============================================

async function handleSwitch(interaction, system, quick) {
    if (quick) {
        // Quick switch: single modal, one field
        const sessionId = utils.generateSessionId(interaction.user.id);
        utils.setSession(sessionId, { type: 'quick_switch', systemId: system._id });

        const modal = new ModalBuilder()
            .setCustomId(`front_quick_switch_modal_${sessionId}`)
            .setTitle('⚡ Quick Switch');

        // Build prefill with current fronters
        let prefill = '';
        for (const layer of system.front?.layers || []) {
            for (const shiftId of layer.shifts || []) {
                const shift = await Shift.findById(shiftId);
                if (shift && !shift.endTime) prefill += shift.type_name + ', ';
            }
        }
        prefill = prefill.replace(/, $/, '');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('entities')
                    .setLabel('Entities (comma-separated, replaces all)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(prefill)
                    .setPlaceholder('Pyra, Moss, Bird')
                    .setRequired(true)
                    .setMaxLength(500)
            )
        );

        return interaction.showModal(modal);
    } else {
        // Guided session
        const sessionId = utils.generateSessionId(interaction.user.id);
        utils.setSession(sessionId, {
            type: 'switch_session',
            systemId: system._id,
            entities: null,
            layerNames: null,
            status: null,
            battery: null
        });

        return await showSwitchSession(interaction, sessionId, system);
    }
}

async function showSwitchSession(interaction, sessionId, system) {
    const session = utils.getSession(sessionId);

    // Build current front summary
    let currentText = [];
    for (const layer of system.front?.layers || []) {
        const fronters = [];
        for (const shiftId of layer.shifts || []) {
            const shift = await Shift.findById(shiftId);
            if (shift && !shift.endTime) fronters.push(shift.type_name);
        }
        if (fronters.length) currentText.push(`${layer.name || 'Layer'}: ${fronters.join(', ')}`);
    }

    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS.system)
        .setTitle('🔄 Switch Front')
        .setDescription(currentText.length ? currentText.join('\n') : '*No one fronting*')
        .setTimestamp();

    if (system.front?.status) embed.addFields({ name: '💬 Status', value: system.front.status, inline: true });
    if (system.battery !== undefined && system.battery !== null) embed.addFields({ name: '🔋 Battery', value: `${system.battery}%`, inline: true });

    // Session progress fields
    let progress = [];
    progress.push(session.entities ? '✅ Entities' : '⬜ Entities');
    progress.push(session.layerNames ? '✅ Layer Names' : '⬜ Layer Names (optional)');
    progress.push(session.status !== null ? '✅ Status' : '⬜ Status (optional)');
    progress.push(session.battery !== null ? '✅ Battery' : '⬜ Battery (optional)');
    embed.addFields({ name: 'Progress', value: progress.join('\n'), inline: false });

    const buttons = [
        new ButtonBuilder().setCustomId(`front_ss_entities_${sessionId}`).setLabel('Select Entities').setStyle(ButtonStyle.Primary).setEmoji('🎭'),
        new ButtonBuilder().setCustomId(`front_ss_layers_${sessionId}`).setLabel('Set Layer Names').setStyle(ButtonStyle.Secondary).setEmoji('📑'),
        new ButtonBuilder().setCustomId(`front_ss_status_${sessionId}`).setLabel('Set Status').setStyle(ButtonStyle.Secondary).setEmoji('💬'),
        new ButtonBuilder().setCustomId(`front_ss_battery_${sessionId}`).setLabel('Set Battery').setStyle(ButtonStyle.Secondary).setEmoji('🔋'),
    ];
    const row2 = [
        new ButtonBuilder().setCustomId(`front_ss_confirm_${sessionId}`).setLabel('Confirm Switch').setStyle(ButtonStyle.Success).setEmoji('✅').setDisabled(!session.entities),
        new ButtonBuilder().setCustomId(`front_ss_cancel_${sessionId}`).setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('❌'),
        new ButtonBuilder().setLabel('Open Full Front').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/front`).setEmoji('🌐'),
    ];

    const components = [
        new ActionRowBuilder().addComponents(buttons),
        new ActionRowBuilder().addComponents(row2)
    ];

    if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ embeds: [embed], components });
    }
    return interaction.reply({ embeds: [embed], components, ephemeral: true });
}

// ============================================
// ADD - Add entity to current front
// ============================================

async function handleAdd(interaction, system, quick) {
    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, { type: 'add_entity', systemId: system._id, quick });

    const modal = new ModalBuilder()
        .setCustomId(`front_add_modal_${sessionId}`)
        .setTitle('➕ Add to Front');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('entity')
                .setLabel('Entity name')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Pyra, Bird, Moss...')
                .setRequired(true)
                .setMaxLength(100)
        )
    );

    return interaction.showModal(modal);
}

// ============================================
// REMOVE - Remove entity from front
// ============================================

async function handleRemove(interaction, system, quick) {
    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, { type: 'remove_entity', systemId: system._id, quick });

    const modal = new ModalBuilder()
        .setCustomId(`front_remove_modal_${sessionId}`)
        .setTitle('➖ Remove from Front');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('entity')
                .setLabel('Entity name')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Pyra, Bird, Moss...')
                .setRequired(true)
                .setMaxLength(100)
        )
    );

    return interaction.showModal(modal);
}

// ============================================
// STATUS - Update front status
// ============================================

async function handleStatus(interaction, system, quick) {
    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, { type: 'edit_status', systemId: system._id, quick });

    const modal = new ModalBuilder()
        .setCustomId(`front_status_modal_${sessionId}`)
        .setTitle('💬 Update Status');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('status')
                .setLabel('New status (leave blank to clear)')
                .setStyle(TextInputStyle.Short)
                .setValue(system.front?.status || '')
                .setPlaceholder('Working, Relaxing, In class...')
                .setRequired(false)
                .setMaxLength(100)
        )
    );

    return interaction.showModal(modal);
}

// ============================================
// BATTERY - Update social battery
// ============================================

async function handleBattery(interaction, system, quick) {
    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, { type: 'edit_battery', systemId: system._id, quick });

    const modal = new ModalBuilder()
        .setCustomId(`front_battery_modal_${sessionId}`)
        .setTitle('🔋 Update Battery');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('battery')
                .setLabel('Battery level 0-100 (leave blank to clear)')
                .setStyle(TextInputStyle.Short)
                .setValue(system.battery !== undefined && system.battery !== null ? String(system.battery) : '')
                .setPlaceholder('75')
                .setRequired(false)
                .setMaxLength(3)
        )
    );

    return interaction.showModal(modal);
}

// ============================================
// HISTORY - View recent switch history
// ============================================

async function handleHistory(interaction, system, quick) {
    await interaction.deferReply({ ephemeral: true });

    const allShiftIds = [];
    for (const layer of system.front?.layers || []) {
        allShiftIds.push(...(layer.shifts || []));
    }

    const shifts = await Shift.find({ _id: { $in: allShiftIds } }).sort({ startTime: -1 }).limit(15);

    if (shifts.length === 0) {
        return interaction.editReply({ content: '📋 No switch history found.' });
    }

    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS.system)
        .setTitle('📋 Recent Switch History')
        .setDescription(`Last ${shifts.length} switches:`);

    let historyText = '';
    for (const shift of shifts) {
        const startTime = Math.floor(shift.startTime.getTime() / 1000);
        const endTime = shift.endTime ? Math.floor(shift.endTime.getTime() / 1000) : null;
        const typeEmoji = shift.s_type === 'alter' ? '🎭' : (shift.s_type === 'state' ? '🔄' : '👥');
        const status = shift.statuses?.[shift.statuses.length - 1]?.status || 'No status';

        if (endTime) {
            historyText += `${typeEmoji} **${shift.type_name}** — <t:${startTime}:R> to <t:${endTime}:R>\n`;
        } else {
            historyText += `${typeEmoji} **${shift.type_name}** — <t:${startTime}:R> (still fronting)\n`;
        }
        historyText += `   └ Status: *${status}*\n`;
    }

    embed.addFields({ name: 'Switches', value: historyText || 'No data' });

    const components = quick ? [] : [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Open Full Front').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/front`).setEmoji('🌐')
        )
    ];

    return interaction.editReply({ embeds: [embed], components });
}

// ============================================
// LAYERS - Layer management interface
// ============================================

async function handleLayers(interaction, system, quick) {
    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS.system)
        .setTitle('⚙️ Layer Management');

    const layers = system.front?.layers || [];
    if (layers.length === 0) {
        embed.setDescription('No layers configured. Add one to get started.');
    } else {
        let layerText = '';
        for (const layer of layers) {
            const fronters = [];
            for (const shiftId of layer.shifts || []) {
                const shift = await Shift.findById(shiftId);
                if (shift && !shift.endTime) fronters.push(shift.type_name);
            }
            const cautionEmoji = layer.caution?.c_type ? '⚠️' : '';
            const batteryText = layer.battery !== undefined && layer.battery !== null ? ` | 🔋${layer.battery}%` : '';
            const statusText = layer.status ? ` | *${layer.status}*` : '';
            layerText += `🔵 **${layer.name}**${statusText}${batteryText}${cautionEmoji}\n`;
            layerText += fronters.length ? `   ${fronters.join(', ')}\n` : '   *Empty*\n';
        }
        embed.setDescription(layerText);
    }

    const buttons = [
        new ButtonBuilder().setCustomId(`front_layer_add_${system._id}`).setLabel('Add Layer').setStyle(ButtonStyle.Success).setEmoji('➕'),
        new ButtonBuilder().setCustomId(`front_layer_rename_${system._id}`).setLabel('Rename Layer').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
        new ButtonBuilder().setCustomId(`front_layer_delete_${system._id}`).setLabel('Delete Layer').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
        new ButtonBuilder().setCustomId(`front_layer_move_${system._id}`).setLabel('Move Entity').setStyle(ButtonStyle.Secondary).setEmoji('↔️'),
    ];
    const row2 = quick ? [] : [
        new ButtonBuilder().setLabel('Open Full Front').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/front`).setEmoji('🌐'),
    ];

    const components = [new ActionRowBuilder().addComponents(buttons)];
    if (row2.length) components.push(new ActionRowBuilder().addComponents(row2));

    return interaction.editReply({ embeds: [embed], components });
}

// ============================================
// AUTOCOMPLETE
// ============================================

async function handleAutocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const { system } = await utils.getOrCreateUserAndSystem(interaction);
    if (!system) return interaction.respond([]);

    let entities = [];
    const alters = await Alter.find({ _id: { $in: system.alters?.IDs || [] } }).select('name');
    const states = await State.find({ _id: { $in: system.states?.IDs || [] } }).select('name');
    const groups = await Group.find({ _id: { $in: system.groups?.IDs || [] } }).select('name type');

    alters.forEach(a => entities.push({ name: utils.getDisplayName(a), type: 'alter' }));
    states.forEach(s => entities.push({ name: utils.getDisplayName(s), type: 'state' }));
    groups.filter(g => g.type?.canFront !== 'no').forEach(g => entities.push({ name: utils.getDisplayName(g), type: 'group' }));

    const search = focusedOption.value.toLowerCase();
    return interaction.respond(
        entities.filter(e => e.name.toLowerCase().includes(search)).slice(0, 25)
            .map(e => ({ name: `${e.type === 'alter' ? '🎭' : e.type === 'state' ? '🔀' : '📁'} ${e.name}`, value: e.name }))
    );
}

// ============================================
// BUTTON HANDLER
// ============================================

async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;

    // Handle new user flow buttons
    if (customId.startsWith('new_user_')) return await utils.handleNewUserButton(interaction);

    // View action buttons
    if (customId.startsWith('front_switch_session_')) {
        const systemId = customId.replace('front_switch_session_', '');
        const system = await System.findById(systemId);
        if (!system) return interaction.reply({ content: '❌ Not registered.', ephemeral: true });
        return await handleSwitch(interaction, system, false);
    }

    if (customId.startsWith('front_add_btn_')) {
        const systemId = customId.replace('front_add_btn_', '');
        const system = await System.findById(systemId);
        if (!system) return interaction.reply({ content: '❌ Not registered.', ephemeral: true });
        return await handleAdd(interaction, system, false);
    }

    if (customId.startsWith('front_remove_btn_')) {
        const systemId = customId.replace('front_remove_btn_', '');
        const system = await System.findById(systemId);
        if (!system) return interaction.reply({ content: '❌ Not registered.', ephemeral: true });
        return await handleRemove(interaction, system, false);
    }

    if (customId.startsWith('front_status_btn_')) {
        const systemId = customId.replace('front_status_btn_', '');
        const system = await System.findById(systemId);
        if (!system) return interaction.reply({ content: '❌ Not registered.', ephemeral: true });
        return await handleStatus(interaction, system, false);
    }

    if (customId.startsWith('front_battery_btn_')) {
        const systemId = customId.replace('front_battery_btn_', '');
        const system = await System.findById(systemId);
        if (!system) return interaction.reply({ content: '❌ Not registered.', ephemeral: true });
        return await handleBattery(interaction, system, false);
    }

    if (customId.startsWith('front_history_btn_')) {
        const systemId = customId.replace('front_history_btn_', '');
        const system = await System.findById(systemId);
        if (!system) return interaction.reply({ content: '❌ Not registered.', ephemeral: true });
        return await handleHistory(interaction, system, false);
    }

    if (customId.startsWith('front_layers_btn_')) {
        const systemId = customId.replace('front_layers_btn_', '');
        const system = await System.findById(systemId);
        if (!system) return interaction.reply({ content: '❌ Not registered.', ephemeral: true });
        return await handleLayers(interaction, system, false);
    }

    // Switch session buttons
    if (customId.startsWith('front_ss_')) {
        return await handleSwitchSessionButton(interaction);
    }

    // Layer management buttons
    if (customId.startsWith('front_layer_')) {
        return await handleLayerButton(interaction);
    }

    // Front refresh button
    if (customId.startsWith('front_refresh_')) {
        return await handleRefreshButton(interaction);
    }

    // Front switch button (legacy)
    if (customId.startsWith('front_switch_') && !customId.includes('session')) {
        return interaction.reply({ content: '💡 Use `/front action:switch` to change who is fronting.', ephemeral: true });
    }

    return false;
}

// ============================================
// SWITCH SESSION BUTTON HANDLER
// ============================================

async function handleSwitchSessionButton(interaction) {
    const parts = interaction.customId.split('_');
    const action = parts[2]; // entities, layers, status, battery, confirm, cancel
    const sessionId = parts.slice(3).join('_');
    const session = utils.getSession(sessionId);

    if (!session || session.type !== 'switch_session') {
        return interaction.reply({ content: '❌ Session expired. Please try again.', ephemeral: true });
    }

    const system = await System.findById(session.systemId);
    if (!system) return interaction.reply({ content: '❌ Not registered.', ephemeral: true });

    if (action === 'cancel') {
        utils.deleteSession(sessionId);
        return interaction.update({ content: '❌ Switch cancelled.', components: [], embeds: [] });
    }

    if (action === 'confirm') {
        return await executeSwitchSession(interaction, session, system, sessionId);
    }

    // Open modal for the selected field
    const modal = new ModalBuilder().setCustomId(`front_ss_modal_${action}_${sessionId}`);

    switch (action) {
        case 'entities':
            modal.setTitle('Select Entities');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('value')
                        .setLabel('Entities (comma = same layer, newline = next layer)')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Pyra, Bird\nMoss')
                        .setRequired(true)
                        .setMaxLength(500)
                )
            );
            break;
        case 'layers':
            modal.setTitle('Set Layer Names');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('value')
                        .setLabel('Layer names (comma-separated)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Main, Co-con, Background')
                        .setRequired(true)
                        .setMaxLength(200)
                )
            );
            break;
        case 'status':
            modal.setTitle('Set Status');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('value')
                        .setLabel('Status (leave blank to clear)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(session.status || '')
                        .setPlaceholder('Working, Relaxing...')
                        .setRequired(false)
                        .setMaxLength(100)
                )
            );
            break;
        case 'battery':
            modal.setTitle('Set Battery');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('value')
                        .setLabel('Battery 0-100 (leave blank to clear)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(session.battery !== null ? String(session.battery) : '')
                        .setPlaceholder('75')
                        .setRequired(false)
                        .setMaxLength(3)
                )
            );
            break;
    }

    return interaction.showModal(modal);
}

async function executeSwitchSession(interaction, session, system, sessionId) {
    await interaction.deferUpdate();

    if (!session.entities) {
        return interaction.followUp({ content: '❌ Please select entities first.', ephemeral: true });
    }

    const layerLines = session.entities.split('\n').map(line => line.trim()).filter(Boolean);
    const frontersByLayer = layerLines.map(line => line.split(',').map(n => n.trim()).filter(Boolean));
    const layerNames = session.layerNames
        ? session.layerNames.split(',').map(n => n.trim()).filter(Boolean)
        : [];

    // Pad layer names if needed
    while (layerNames.length < frontersByLayer.length) {
        layerNames.push(`Layer ${layerNames.length + 1}`);
    }

    await closeAllActiveShifts(system);

    const newLayers = [];
    const errors = [];
    const successfulFronters = [];
    const now = new Date();

    for (let layerIndex = 0; layerIndex < frontersByLayer.length; layerIndex++) {
        const fronterNames = frontersByLayer[layerIndex];
        const layerName = layerNames[layerIndex] || `Layer ${layerIndex + 1}`;

        const layer = {
            _id: new mongoose.Types.ObjectId(),
            name: layerName,
            color: null,
            shifts: []
        };

        for (const fronterName of fronterNames) {
            const { entity, type } = await findEntityByName(fronterName, system);
            if (!entity) { errors.push(`"${fronterName}" not found`); continue; }

            const shift = new Shift({
                _id: new mongoose.Types.ObjectId(),
                s_type: type,
                ID: entity._id.toString(),
                type_name: utils.getDisplayName(entity),
                startTime: now,
                endTime: null,
                statuses: [{
                    status: entity.setting?.default_status || null,
                    battery: entity.setting?.default_battery || null,
                    caution: entity.caution ? { c_type: entity.caution.c_type, detail: entity.caution.detail } : null,
                    startTime: now,
                    endTime: null,
                    layerID: layer._id,
                    hidden: 'n'
                }]
            });

            await shift.save();
            layer.shifts.push(shift._id);
            successfulFronters.push({ name: utils.getDisplayName(entity), type, layer: layerName });
            utils.updateRecentProxies(system, entity, type);
        }

        if (layer.shifts.length > 0) newLayers.push(layer);
    }

    if (!system.front) system.front = {};
    system.front.layers = newLayers;
    if (session.status !== null) system.front.status = session.status || undefined;
    if (session.battery !== null) {
        const batt = parseInt(session.battery);
        if (!isNaN(batt) && batt >= 0 && batt <= 100) system.battery = batt;
    }

    await system.save();
    utils.deleteSession(sessionId);

    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS.system)
        .setTitle('🔄 Switch Complete')
        .setTimestamp();

    if (session.status) embed.setDescription(`**Status:** ${session.status}`);

    for (const layer of newLayers) {
        const layerFronters = successfulFronters.filter(f => f.layer === layer.name);
        const fronterList = layerFronters.map(f => {
            const emoji = f.type === 'alter' ? '🎭' : (f.type === 'state' ? '🔄' : '👥');
            return `${emoji} ${f.name}`;
        }).join('\n');
        embed.addFields({ name: layer.name, value: fronterList || '*Empty*', inline: true });
    }

    if (system.battery !== undefined && system.battery !== null) {
        embed.addFields({ name: '🔋 Social Battery', value: `${system.battery}%`, inline: true });
    }

    if (errors.length > 0) {
        embed.addFields({ name: '⚠️ Not Found', value: errors.join(', '), inline: false });
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Open Full Front').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/front`).setEmoji('🌐')
    );

    return interaction.followUp({ embeds: [embed], components: [row], ephemeral: true });
}

// ============================================
// LAYER MANAGEMENT BUTTON HANDLER
// ============================================

async function handleLayerButton(interaction) {
    const parts = interaction.customId.split('_');
    const action = parts[2]; // add, rename, delete, move
    const systemId = parts.slice(3).join('_');

    const system = await System.findById(systemId);
    if (!system) return interaction.reply({ content: '❌ Not registered.', ephemeral: true });

    if (action === 'add') {
        const sessionId = utils.generateSessionId(interaction.user.id);
        utils.setSession(sessionId, { type: 'layer_add', systemId });

        // Build position options
        const layers = system.front?.layers || [];
        let positionOptions = 'Top';
        for (const layer of layers) {
            positionOptions += `\nBelow: ${layer.name}`;
        }
        positionOptions += '\nBottom';

        const modal = new ModalBuilder()
            .setCustomId(`front_layer_add_modal_${sessionId}`)
            .setTitle('➕ Add Layer');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('name')
                    .setLabel('Layer name')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Co-con, Background...')
                    .setRequired(true)
                    .setMaxLength(50)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('position')
                    .setLabel('Position (Top, Below: LayerName, or Bottom)')
                    .setStyle(TextInputStyle.Short)
                    .setValue('Bottom')
                    .setPlaceholder('Top, Below: Main, Bottom')
                    .setRequired(true)
                    .setMaxLength(100)
            )
        );

        return interaction.showModal(modal);
    }

    if (action === 'rename' || action === 'delete' || action === 'move') {
        const layers = system.front?.layers || [];
        if (layers.length === 0) {
            return interaction.reply({ content: '❌ No layers to manage. Add a layer first.', ephemeral: true });
        }

        const sessionId = utils.generateSessionId(interaction.user.id);
        utils.setSession(sessionId, { type: `layer_${action}`, systemId });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`front_layer_select_${action}_${sessionId}`)
            .setPlaceholder('Select a layer...')
            .setMinValues(1)
            .setMaxValues(1);

        layers.forEach((layer, i) => {
            selectMenu.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(layer.name || `Layer ${i + 1}`)
                    .setValue(layer._id.toString())
            );
        });

        const row = new ActionRowBuilder().addComponents(selectMenu);
        return interaction.reply({ components: [row], ephemeral: true });
    }

    return false;
}

// ============================================
// SELECT MENU HANDLER
// ============================================

async function handleSelectMenu(interaction) {
    const customId = interaction.customId;

    // Layer selection
    if (customId.startsWith('front_layer_select_')) {
        return await handleLayerSelect(interaction);
    }

    // Delete target layer selection
    if (customId.startsWith('front_layer_delete_target_')) {
        return await handleDeleteTargetSelect(interaction);
    }

    // Move entity selection
    if (customId.startsWith('front_layer_move_entity_')) {
        return await handleMoveEntitySelect(interaction);
    }

    // Move target layer selection (after entity selected)
    if (customId.startsWith('front_layer_move_target_')) {
        return await handleMoveTargetSelect(interaction);
    }

    return false;
}

async function handleLayerSelect(interaction) {
    const parts = interaction.customId.split('_');
    const action = parts[3]; // rename, delete, move
    const sessionId = parts.slice(4).join('_');
    const session = utils.getSession(sessionId);

    if (!session) return interaction.reply({ content: '❌ Session expired.', ephemeral: true });

    const system = await System.findById(session.systemId);
    if (!system) return interaction.reply({ content: '❌ Not registered.', ephemeral: true });

    const layerId = interaction.values[0];
    const layer = system.front?.layers?.find(l => l._id.toString() === layerId);
    if (!layer) return interaction.reply({ content: '❌ Layer not found.', ephemeral: true });

    if (action === 'rename') {
        const modal = new ModalBuilder()
            .setCustomId(`front_layer_rename_modal_${sessionId}`)
            .setTitle('✏️ Rename Layer');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('value')
                    .setLabel('New layer name')
                    .setStyle(TextInputStyle.Short)
                    .setValue(layer.name)
                    .setRequired(true)
                    .setMaxLength(50)
            )
        );

        session.layerId = layerId;
        utils.setSession(sessionId, session);
        return interaction.showModal(modal);
    }

    if (action === 'delete') {
        const layers = system.front?.layers || [];
        if (layers.length <= 1) {
            return interaction.reply({ content: '❌ Cannot delete the only layer. Add another first or clear the front.', ephemeral: true });
        }

        // Show select menu for target layer
        const targetSelect = new StringSelectMenuBuilder()
            .setCustomId(`front_layer_delete_target_${sessionId}`)
            .setPlaceholder(`Move entities from "${layer.name}" to...`)
            .setMinValues(1)
            .setMaxValues(1);

        layers.filter(l => l._id.toString() !== layerId).forEach(l => {
            targetSelect.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(l.name)
                    .setValue(l._id.toString())
            );
        });

        session.layerId = layerId;
        utils.setSession(sessionId, session);

        const row = new ActionRowBuilder().addComponents(targetSelect);
        return interaction.update({ components: [row] });
    }

    if (action === 'move') {
        // Show entity select menu
        const fronters = [];
        for (const l of system.front?.layers || []) {
            for (const shiftId of l.shifts || []) {
                const shift = await Shift.findById(shiftId);
                if (shift && !shift.endTime) {
                    fronters.push({ name: shift.type_name, type: shift.s_type, id: shift.ID, shiftId: shift._id.toString(), layerId: l._id.toString() });
                }
            }
        }

        if (fronters.length === 0) {
            return interaction.reply({ content: '❌ No entities currently fronting to move.', ephemeral: true });
        }

        const entitySelect = new StringSelectMenuBuilder()
            .setCustomId(`front_layer_move_entity_${sessionId}`)
            .setPlaceholder('Select entity to move...')
            .setMinValues(1)
            .setMaxValues(Math.min(fronters.length, 25));

        fronters.forEach(f => {
            const emoji = f.type === 'alter' ? '🎭' : f.type === 'state' ? '🔀' : '📁';
            entitySelect.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(f.name)
                    .setValue(f.shiftId.toString())
                    .setEmoji(emoji)
            );
        });

        session.fronters = fronters;
        utils.setSession(sessionId, session);

        const row = new ActionRowBuilder().addComponents(entitySelect);
        return interaction.update({ components: [row] });
    }

    return false;
}

// Delete target layer selection handler
async function handleDeleteTargetSelect(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);
    if (!session) return interaction.reply({ content: '❌ Session expired.', ephemeral: true });

    const system = await System.findById(session.systemId);
    if (!system) return interaction.reply({ content: '❌ Not registered.', ephemeral: true });

    const targetLayerId = interaction.values[0];
    const sourceLayerId = session.layerId;
    const sourceLayer = system.front?.layers?.find(l => l._id.toString() === sourceLayerId);
    const targetLayer = system.front?.layers?.find(l => l._id.toString() === targetLayerId);

    if (!sourceLayer || !targetLayer) return interaction.reply({ content: '❌ Layer not found.', ephemeral: true });

    // Move all shifts from source to target
    targetLayer.shifts.push(...sourceLayer.shifts);

    // Close all shifts in the deleted layer
    for (const shiftId of sourceLayer.shifts) {
        const shift = await Shift.findById(shiftId);
        if (shift && !shift.endTime) {
            shift.endTime = new Date();
            if (shift.statuses?.length > 0) shift.statuses[shift.statuses.length - 1].endTime = new Date();
            await shift.save();
        }
    }

    // Remove source layer
    system.front.layers = system.front.layers.filter(l => l._id.toString() !== sourceLayerId);

    // Clear layer-level fields on target if all entities removed (not applicable here since we're adding)
    await system.save();
    utils.deleteSession(sessionId);

    return interaction.update({ content: `✅ Layer "**${sourceLayer.name}**" deleted. Entities moved to **${targetLayer.name}**.`, components: [] });
}

// Move entity selection handler
async function handleMoveEntitySelect(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);
    if (!session) return interaction.reply({ content: '❌ Session expired.', ephemeral: true });

    const system = await System.findById(session.systemId);
    if (!system) return interaction.reply({ content: '❌ Not registered.', ephemeral: true });

    const selectedShiftIds = interaction.values;
    session.selectedShiftIds = selectedShiftIds;
    utils.setSession(sessionId, session);

    // Show target layer select
    const layers = system.front?.layers || [];
    const targetSelect = new StringSelectMenuBuilder()
        .setCustomId(`front_layer_move_target_${sessionId}`)
        .setPlaceholder('Select target layer...')
        .setMinValues(1)
        .setMaxValues(1);

    layers.forEach(l => {
        targetSelect.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(l.name)
                .setValue(l._id.toString())
        );
    });

    const row = new ActionRowBuilder().addComponents(targetSelect);
    return interaction.update({ components: [row] });
}

// Move target layer selection handler
async function handleMoveTargetSelect(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);
    if (!session) return interaction.reply({ content: '❌ Session expired.', ephemeral: true });

    const system = await System.findById(session.systemId);
    if (!system) return interaction.reply({ content: '❌ Not registered.', ephemeral: true });

    const targetLayerId = interaction.values[0];
    const targetLayer = system.front?.layers?.find(l => l._id.toString() === targetLayerId);
    if (!targetLayer) return interaction.reply({ content: '❌ Target layer not found.', ephemeral: true });

    const selectedShiftIds = session.selectedShiftIds || [];
    const movedNames = [];

    // Remove shifts from source layers and add to target
    for (const shiftId of selectedShiftIds) {
        for (const layer of system.front.layers) {
            const idx = layer.shifts.indexOf(shiftId);
            if (idx >= 0) {
                layer.shifts.splice(idx, 1);
                targetLayer.shifts.push(shiftId);

                const shift = await Shift.findById(shiftId);
                if (shift) movedNames.push(shift.type_name);
                break;
            }
        }
    }

    // Clear layer-level fields on empty layers
    for (const layer of system.front.layers) {
        if (layer.shifts.length === 0) {
            layer.status = undefined;
            layer.battery = undefined;
            layer.caution = undefined;
        }
    }

    await system.save();
    utils.deleteSession(sessionId);

    return interaction.update({ content: `✅ Moved **${movedNames.join(', ')}** to **${targetLayer.name}**.`, components: [] });
}

// ============================================
// MODAL SUBMIT HANDLER
// ============================================

async function handleModalSubmit(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);

    if (!session) {
        return interaction.reply({ content: '❌ Session expired. Please try again.', ephemeral: true });
    }

    const system = await System.findById(session.systemId);
    if (!system) return interaction.reply({ content: '❌ Not registered.', ephemeral: true });

    // Quick switch modal
    if (interaction.customId.startsWith('front_quick_switch_modal_')) {
        return await handleQuickSwitchModal(interaction, session, system);
    }

    // Switch session field modals
    if (interaction.customId.startsWith('front_ss_modal_')) {
        return await handleSwitchSessionModal(interaction, session, system);
    }

    // Add entity modal
    if (interaction.customId.startsWith('front_add_modal_')) {
        return await handleAddModal(interaction, session, system);
    }

    // Remove entity modal
    if (interaction.customId.startsWith('front_remove_modal_')) {
        return await handleRemoveModal(interaction, session, system);
    }

    // Status modal
    if (interaction.customId.startsWith('front_status_modal_')) {
        return await handleStatusModal(interaction, session, system);
    }

    // Battery modal
    if (interaction.customId.startsWith('front_battery_modal_')) {
        return await handleBatteryModal(interaction, session, system);
    }

    // Layer add modal
    if (interaction.customId.startsWith('front_layer_add_modal_')) {
        return await handleLayerAddModal(interaction, session, system);
    }

    // Layer rename modal
    if (interaction.customId.startsWith('front_layer_rename_modal_')) {
        return await handleLayerRenameModal(interaction, session, system);
    }

    return false;
}

// ============================================
// QUICK SWITCH MODAL
// ============================================

async function handleQuickSwitchModal(interaction, session, system) {
    await interaction.deferReply({ ephemeral: true });

    const entitiesInput = interaction.fields.getTextInputValue('entities');
    const entityNames = entitiesInput.split(',').map(n => n.trim()).filter(Boolean);

    await closeAllActiveShifts(system);
    const now = new Date();
    const successes = [], errors = [];

    // Ensure top layer exists
    if (!system.front) system.front = {};
    if (!system.front.layers?.length) {
        system.front.layers = [{ _id: new mongoose.Types.ObjectId(), name: 'Main', shifts: [] }];
    }
    system.front.layers[0].shifts = [];

    for (const name of entityNames) {
        const { entity, type } = await findEntityByName(name, system);
        if (!entity) { errors.push(name); continue; }

        const shift = new Shift({
            _id: new mongoose.Types.ObjectId(),
            s_type: type,
            ID: entity._id.toString(),
            type_name: utils.getDisplayName(entity),
            startTime: now,
            endTime: null,
            statuses: [{
                status: entity.setting?.default_status || null,
                battery: entity.setting?.default_battery || null,
                caution: entity.caution ? { c_type: entity.caution.c_type, detail: entity.caution.detail } : null,
                startTime: now,
                endTime: null,
                layerID: system.front.layers[0]._id,
                hidden: 'n'
            }]
        });

        await shift.save();
        system.front.layers[0].shifts.push(shift._id);
        successes.push({ name: utils.getDisplayName(entity), type, color: entity.color });
        utils.updateRecentProxies(system, entity, type);
    }

    await system.save();
    utils.deleteSession(session.id);

    const embed = new EmbedBuilder()
        .setColor(successes[0]?.color || ENTITY_COLORS.success)
        .setTitle('🔄 Switch Complete')
        .setTimestamp();

    if (successes.length > 0) {
        embed.setDescription(`**Now Fronting:**\n${successes.map(s => `${s.type === 'alter' ? '🎭' : s.type === 'state' ? '🔀' : '📁'} ${s.name}`).join('\n')}`);
    }
    if (errors.length > 0) embed.addFields({ name: '⚠️ Not Found', value: errors.join(', ') });

    return interaction.editReply({ embeds: [embed] });
}

// ============================================
// SWITCH SESSION MODAL
// ============================================

async function handleSwitchSessionModal(interaction, session, system) {
    await interaction.deferUpdate();

    const parts = interaction.customId.split('_');
    const field = parts[4]; // entities, layers, status, battery
    const value = interaction.fields.getTextInputValue('value');

    switch (field) {
        case 'entities':
            session.entities = value;
            break;
        case 'layers':
            session.layerNames = value;
            break;
        case 'status':
            session.status = value || null;
            break;
        case 'battery':
            session.battery = value ? parseInt(value) : null;
            break;
    }

    utils.setSession(session.id, session);
    return showSwitchSession(interaction, session.id, system);
}

// ============================================
// ADD ENTITY MODAL
// ============================================

async function handleAddModal(interaction, session, system) {
    await interaction.deferReply({ ephemeral: !session.quick });

    const entityName = interaction.fields.getTextInputValue('entity');
    const { entity, type } = await findEntityByName(entityName, system);
    if (!entity) return interaction.editReply({ content: `❌ "${entityName}" not found.` });

    // Check if already fronting
    const existing = await findActiveShift(entity._id, type, system);
    if (existing) return interaction.editReply({ content: `⚠️ ${utils.getDisplayName(entity)} is already fronting.` });

    // Ensure top layer exists
    if (!system.front?.layers?.length) {
        system.front = system.front || {};
        system.front.layers = [{ _id: new mongoose.Types.ObjectId(), name: 'Main', shifts: [] }];
    }

    const now = new Date();
    const shift = new Shift({
        _id: new mongoose.Types.ObjectId(),
        s_type: type,
        ID: entity._id.toString(),
        type_name: utils.getDisplayName(entity),
        startTime: now,
        endTime: null,
        statuses: [{
            status: entity.setting?.default_status || null,
            battery: entity.setting?.default_battery || null,
            caution: entity.caution ? { c_type: entity.caution.c_type, detail: entity.caution.detail } : null,
            startTime: now,
            endTime: null,
            layerID: system.front.layers[0]._id,
            hidden: 'n'
        }]
    });

    await shift.save();
    system.front.layers[0].shifts.push(shift._id);
    utils.updateRecentProxies(system, entity, type);
    await system.save();
    utils.deleteSession(session.id);

    const emoji = type === 'alter' ? '🎭' : type === 'state' ? '🔀' : '📁';
    const components = session.quick ? [] : [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Open Full Front').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/front`).setEmoji('🌐')
        )
    ];

    return interaction.editReply({ content: `✅ ${emoji} **${utils.getDisplayName(entity)}** added to front.`, components });
}

// ============================================
// REMOVE ENTITY MODAL
// ============================================

async function handleRemoveModal(interaction, session, system) {
    await interaction.deferReply({ ephemeral: !session.quick });

    const entityName = interaction.fields.getTextInputValue('entity');
    const { entity, type } = await findEntityByName(entityName, system);
    if (!entity) return interaction.editReply({ content: `❌ "${entityName}" not found.` });

    const shift = await findActiveShift(entity._id, type, system);
    if (!shift) return interaction.editReply({ content: `⚠️ ${utils.getDisplayName(entity)} is not fronting.` });

    shift.endTime = new Date();
    if (shift.statuses?.length > 0) shift.statuses[shift.statuses.length - 1].endTime = new Date();
    await shift.save();
    utils.deleteSession(session.id);

    const emoji = type === 'alter' ? '🎭' : type === 'state' ? '🔀' : '📁';
    const components = session.quick ? [] : [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Open Full Front').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/front`).setEmoji('🌐')
        )
    ];

    return interaction.editReply({ content: `✅ ${emoji} **${utils.getDisplayName(entity)}** removed from front.`, components });
}

// ============================================
// STATUS MODAL
// ============================================

async function handleStatusModal(interaction, session, system) {
    await interaction.deferReply({ ephemeral: !session.quick });

    const status = interaction.fields.getTextInputValue('status');
    system.front = system.front || {};
    system.front.status = status || undefined;
    await system.save();
    utils.deleteSession(session.id);

    const components = session.quick ? [] : [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Open Full Front').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/front`).setEmoji('🌐')
        )
    ];

    return interaction.editReply({
        content: status ? `✅ Status: **${status}**` : '✅ Status cleared.',
        components
    });
}

// ============================================
// BATTERY MODAL
// ============================================

async function handleBatteryModal(interaction, session, system) {
    await interaction.deferReply({ ephemeral: !session.quick });

    const batteryInput = interaction.fields.getTextInputValue('battery');
    if (batteryInput) {
        const level = parseInt(batteryInput);
        if (isNaN(level) || level < 0 || level > 100) {
            return interaction.editReply({ content: '❌ Battery must be between 0 and 100.' });
        }
        system.battery = level;
    } else {
        system.battery = undefined;
    }

    await system.save();
    utils.deleteSession(session.id);

    const emoji = utils.getBatteryEmoji(system.battery);
    const components = session.quick ? [] : [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Open Full Front').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/front`).setEmoji('🌐')
        )
    ];

    return interaction.editReply({
        content: system.battery !== undefined ? `${emoji} Battery: **${system.battery}%**` : '✅ Battery cleared.',
        components
    });
}

// ============================================
// LAYER ADD MODAL
// ============================================

async function handleLayerAddModal(interaction, session, system) {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.fields.getTextInputValue('name');
    const positionInput = interaction.fields.getTextInputValue('position');

    const newLayer = {
        _id: new mongoose.Types.ObjectId(),
        name: name,
        color: null,
        shifts: []
    };

    if (!system.front) system.front = {};
    if (!system.front.layers) system.front.layers = [];

    const layers = system.front.layers;
    const posLower = positionInput.toLowerCase().trim();

    if (posLower === 'top') {
        layers.unshift(newLayer);
    } else if (posLower === 'bottom') {
        layers.push(newLayer);
    } else if (posLower.startsWith('below:')) {
        const targetName = positionInput.substring(6).trim().toLowerCase();
        const idx = layers.findIndex(l => (l.name || '').toLowerCase() === targetName);
        if (idx >= 0) {
            layers.splice(idx + 1, 0, newLayer);
        } else {
            layers.push(newLayer);
        }
    } else {
        layers.push(newLayer);
    }

    await system.save();
    utils.deleteSession(session.id);

    return interaction.editReply({ content: `✅ Layer "**${name}**" added.`, components: [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Open Full Front').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/front`).setEmoji('🌐')
        )
    ]});
}

// ============================================
// LAYER RENAME MODAL
// ============================================

async function handleLayerRenameModal(interaction, session, system) {
    await interaction.deferReply({ ephemeral: true });

    const newName = interaction.fields.getTextInputValue('value');
    const layer = system.front?.layers?.find(l => l._id.toString() === session.layerId);
    if (!layer) return interaction.editReply({ content: '❌ Layer not found.' });

    layer.name = newName;
    await system.save();
    utils.deleteSession(session.id);

    return interaction.editReply({ content: `✅ Layer renamed to "**${newName}**".`, components: [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Open Full Front').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/front`).setEmoji('🌐')
        )
    ]});
}

// ============================================
// REFRESH BUTTON
// ============================================

async function handleRefreshButton(interaction) {
    const systemId = interaction.customId.replace('front_refresh_', '');
    const system = await System.findById(systemId);
    if (!system) return interaction.reply({ content: '❌ Not registered.', ephemeral: true });

    const user = await User.findOne({ systemID: systemId, discordID: interaction.user.id });
    if (!user) return interaction.reply({ content: '❌ You can only refresh your own front view.', ephemeral: true });

    const closedCharAllowed = await utils.checkClosedCharAllowed(interaction.guild);
    const embed = await buildFrontEmbed(system, user, interaction, true, closedCharAllowed);

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`front_switch_${system._id}`).setLabel('Switch').setStyle(ButtonStyle.Primary).setEmoji('🔄'),
        new ButtonBuilder().setCustomId(`front_refresh_${system._id}`).setLabel('Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔃')
    );

    return interaction.update({ embeds: [embed], components: [actionRow] });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Find entity by name across all entity types
 */
async function findEntityByName(name, system) {
    const searchName = name.toLowerCase().trim();

    const alters = await Alter.find({ _id: { $in: system.alters?.IDs || [] } });
    let entity = alters.find(a => a.name?.indexable?.toLowerCase() === searchName || a.name?.display?.toLowerCase() === searchName || a.name?.aliases?.some(al => al.toLowerCase() === searchName));
    if (entity) return { entity, type: 'alter' };

    const states = await State.find({ _id: { $in: system.states?.IDs || [] } });
    entity = states.find(s => s.name?.indexable?.toLowerCase() === searchName || s.name?.display?.toLowerCase() === searchName);
    if (entity) return { entity, type: 'state' };

    const groups = await Group.find({ _id: { $in: system.groups?.IDs || [] } });
    entity = groups.find(g => (g.name?.indexable?.toLowerCase() === searchName || g.name?.display?.toLowerCase() === searchName) && g.type?.canFront !== 'no');
    if (entity) return { entity, type: 'group' };

    return { entity: null, type: null };
}

/**
 * Find active shift for an entity
 */
async function findActiveShift(entityId, type, system) {
    for (const layer of system.front?.layers || []) {
        for (const shiftId of layer.shifts || []) {
            const shift = await Shift.findById(shiftId);
            if (shift && !shift.endTime && shift.ID === entityId.toString() && shift.s_type === type) return shift;
        }
    }
    return null;
}

/**
 * Close all active shifts in the system
 */
async function closeAllActiveShifts(system) {
    const now = new Date();
    for (const layer of system.front?.layers || []) {
        for (const shiftId of layer.shifts || []) {
            const shift = await Shift.findById(shiftId);
            if (shift && !shift.endTime) {
                shift.endTime = now;
                if (shift.statuses?.length > 0) shift.statuses[shift.statuses.length - 1].endTime = now;
                await shift.save();
            }
        }
    }
}

// ============================================
// BUILD FRONT EMBED (enhanced from original)
// ============================================

async function buildFrontEmbed(system, user, interaction, isOwner, closedCharAllowed = true) {
    let systemName;
    if (!closedCharAllowed && system.name?.closedNameDisplay) systemName = system.name.closedNameDisplay;
    else systemName = system.name?.display || system.name?.indexable || 'Unknown';

    const userName = user.discord?.name?.display || interaction.user?.displayName || 'Unknown User';

    const embed = new EmbedBuilder()
        .setTitle(`🎭 Currently Fronting for ${systemName}`)
        .setTimestamp();

    const frontColor = utils.getSystemEmbedColor(system);
    if (frontColor) embed.setColor(frontColor);

    if (system.avatar?.url || system.discord?.image?.avatar?.url) embed.setThumbnail(system.avatar?.url || system.discord?.image?.avatar?.url);

    let description = '';
    if (system.front?.status) description += `**Status:** ${system.front.status}\n`;
    if (system.battery !== undefined && system.battery !== null) {
        const batteryEmoji = utils.getBatteryEmoji(system.battery);
        description += `**Social Battery:** ${batteryEmoji} ${system.battery}%\n`;
    }
    if (system.front?.caution) description += `**⚠️ Caution:** ${system.front.caution}\n`;
    if (description) embed.setDescription(description.trim());

    const layers = system.front?.layers || [];

    if (layers.length === 0) {
        embed.addFields({
            name: '📭 No Front Data',
            value: 'No one is currently marked as fronting.\nUse `/front action:switch` to set the current front.',
            inline: false
        });
    } else {
        for (const layer of layers) {
            const layerName = layer.name || 'Front';
            const fronters = [];

            for (const shiftId of layer.shifts || []) {
                const shift = await Shift.findById(shiftId);
                if (!shift || shift.endTime) continue;

                const entityInfo = await getEntityInfo(shift.ID, shift.s_type, system, closedCharAllowed);
                const currentStatus = shift.statuses?.[shift.statuses.length - 1];

                const emoji = shift.s_type === 'alter' ? '🎭' : (shift.s_type === 'state' ? '🔄' : '👥');
                const displayName = entityInfo?.name || shift.type_name;
                let fronterLine = `${emoji} **${displayName}**`;

                if (entityInfo?.pronouns?.length > 0) fronterLine += ` (${entityInfo.pronouns.join('/')})`;

                // Status
                if (currentStatus?.status) fronterLine += `\n   └ *${currentStatus.status}*`;

                // Battery
                if (currentStatus?.battery !== undefined && currentStatus?.battery !== null) {
                    const battEmoji = utils.getBatteryEmoji(currentStatus.battery);
                    fronterLine += ` | ${battEmoji} ${currentStatus.battery}%`;
                }

                // Caution
                if (currentStatus?.caution?.c_type) {
                    fronterLine += `\n   └ ⚠️ ${currentStatus.caution.c_type}${currentStatus.caution.detail ? `: ${currentStatus.caution.detail}` : ''}`;
                }

                // Duration
                const duration = getShiftDuration(shift.startTime);
                fronterLine += `\n   └ 🕐 ${duration}`;

                fronters.push(fronterLine);
            }

            // Layer-level status/battery/caution (if set)
            let layerExtras = [];
            if (layer.status) layerExtras.push(`*${layer.status}*`);
            if (layer.battery !== undefined && layer.battery !== null) layerExtras.push(`🔋${layer.battery}%`);
            // Aggregate caution from entities if layer caution not set
            if (layer.caution?.c_type) {
                layerExtras.push(`⚠️ ${layer.caution.c_type}`);
            }

            const fieldName = layerExtras.length > 0 ? `${layerName} (${layerExtras.join(' | ')})` : layerName;

            embed.addFields({
                name: fieldName,
                value: fronters.length > 0 ? fronters.join('\n\n') : '*Empty*',
                inline: layers.length > 1
            });
        }
    }

    embed.setFooter({
        text: isOwner ? `Your ${getSystemTerm(system, {context:'ownership'})}` : `${userName}'s ${getSystemTerm(system, {context:'ownership'})}`,
        iconURL: interaction.user.displayAvatarURL()
    });

    return embed;
}

// Get entity info for a fronter
async function getEntityInfo(entityId, type, system, closedCharAllowed = true) {
    try {
        let entity = null;
        switch (type) {
            case 'alter': entity = await Alter.findById(entityId); break;
            case 'state': entity = await State.findById(entityId); break;
            case 'group': entity = await Group.findById(entityId); break;
        }
        if (!entity) return null;

        let displayName;
        if (!closedCharAllowed && entity.name?.closedNameDisplay) displayName = entity.name.closedNameDisplay;
        else displayName = entity.name?.display || entity.name?.indexable || 'Unknown';

        return {
            name: displayName,
            pronouns: entity.pronouns || entity.identity?.pronouns || [],
            avatar: entity.avatar?.url || entity.discord?.image?.avatar?.url,
            color: entity.color
        };
    } catch (error) { return null; }
}

// Get human-readable shift duration
function getShiftDuration(startTime) {
    const now = new Date();
    const start = new Date(startTime);
    const diffMs = now - start;
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
}
