// (/quickswitch) - Systemiser Quick Switch Command
// Fast front switching with activity launch button

const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, StringSelectMenuOptionBuilder
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quickswitch')
        .setDescription('Quickly switch front')
        .addSubcommand(sub => sub.setName('in').setDescription('Quick switch in')
            .addStringOption(opt => opt.setName('entities').setDescription('Entity names (comma-separated)').setRequired(true))
            .addStringOption(opt => opt.setName('status').setDescription('Status message').setRequired(false).setMaxLength(100))
            .addIntegerOption(opt => opt.setName('battery').setDescription('Social battery (0-100)').setRequired(false).setMinValue(0).setMaxValue(100)))
        .addSubcommand(sub => sub.setName('out').setDescription('Switch out (no one fronting)'))
        .addSubcommand(sub => sub.setName('add').setDescription('Add to current front')
            .addStringOption(opt => opt.setName('entity').setDescription('Entity to add').setRequired(true).setAutocomplete(true)))
        .addSubcommand(sub => sub.setName('remove').setDescription('Remove from current front')
            .addStringOption(opt => opt.setName('entity').setDescription('Entity to remove').setRequired(true).setAutocomplete(true)))
        .addSubcommand(sub => sub.setName('status').setDescription('Update status')
            .addStringOption(opt => opt.setName('status').setDescription('New status').setRequired(true).setMaxLength(100)))
        .addSubcommand(sub => sub.setName('battery').setDescription('Update battery')
            .addIntegerOption(opt => opt.setName('level').setDescription('Battery level').setRequired(true).setMinValue(0).setMaxValue(100)))
        .addSubcommand(sub => sub.setName('menu').setDescription('Interactive quick switch menu')),

    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        const subcommand = interaction.options.getSubcommand();
        const { system } = await utils.getOrCreateUserAndSystem(interaction);
        if (!system) return interaction.respond([]);
        
        let entities = [];
        if (subcommand === 'remove') {
            for (const layer of system.front?.layers || []) {
                for (const shiftId of layer.shifts || []) {
                    const shift = await Shift.findById(shiftId);
                    if (shift && !shift.endTime) entities.push({ name: shift.type_name, type: shift.s_type });
                }
            }
        } else {
            const alters = await Alter.find({ _id: { $in: system.alters?.IDs || [] } }).select('name');
            const states = await State.find({ _id: { $in: system.states?.IDs || [] } }).select('name');
            const groups = await Group.find({ _id: { $in: system.groups?.IDs || [] } }).select('name type');
            alters.forEach(a => entities.push({ name: utils.getDisplayName(a), type: 'alter' }));
            states.forEach(s => entities.push({ name: utils.getDisplayName(s), type: 'state' }));
            groups.filter(g => g.type?.canFront !== 'no').forEach(g => entities.push({ name: utils.getDisplayName(g), type: 'group' }));
        }
        
        const search = focusedOption.value.toLowerCase();
        return interaction.respond(
            entities.filter(e => e.name.toLowerCase().includes(search)).slice(0, 25)
                .map(e => ({ name: `${e.type === 'alter' ? '🎭' : e.type === 'state' ? '🔀' : '📁'} ${e.name}`, value: e.name }))
        );
    },

    async executeInteraction(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const { user, system } = await utils.getOrCreateUserAndSystem(interaction);
        if (!system) return utils.handleNewUserFlow(interaction, 'system');
        
        switch (subcommand) {
            case 'in': return handleIn(interaction, system);
            case 'out': return handleOut(interaction, system);
            case 'add': return handleAdd(interaction, system);
            case 'remove': return handleRemove(interaction, system);
            case 'status': return handleStatus(interaction, system);
            case 'battery': return handleBattery(interaction, system);
            case 'menu': return handleMenu(interaction, system);
        }
    }
};

async function handleIn(interaction, system) {
    await interaction.deferReply({ ephemeral: true });
    const entitiesInput = interaction.options.getString('entities');
    const status = interaction.options.getString('status');
    const battery = interaction.options.getInteger('battery');
    const entityNames = entitiesInput.split(',').map(n => n.trim()).filter(Boolean);
    
    await closeAllActiveShifts(system);
    const now = new Date();
    const successes = [], errors = [];
    
    if (!system.front) system.front = {};
    if (!system.front.layers?.length) system.front.layers = [{ _id: new mongoose.Types.ObjectId(), name: 'Main', shifts: [] }];
    system.front.layers[0].shifts = [];
    
    for (const name of entityNames) {
        const { entity, type } = await findEntityByName(name, system);
        if (!entity) { errors.push(name); continue; }
        
        const shift = new Shift({
            _id: new mongoose.Types.ObjectId(), s_type: type, ID: entity._id.toString(),
            type_name: utils.getDisplayName(entity), startTime: now, endTime: null,
            statuses: [{ status: null, startTime: now, endTime: null, hidden: 'n' }]
        });
        await shift.save();
        system.front.layers[0].shifts.push(shift._id);
        successes.push({ name: utils.getDisplayName(entity), type, color: entity.color });
        updateRecentProxies(system, entity, type);
    }
    
    if (status) system.front.status = status;
    if (battery !== null) system.battery = battery;
    await system.save();
    
    const embed = new EmbedBuilder()
        .setColor(successes[0]?.color || utils.ENTITY_COLORS.success)
        .setTitle('🔄 Switch Complete').setTimestamp();
    
    if (successes.length > 0) {
        embed.setDescription(`**Now Fronting:**\n${successes.map(s => `${s.type === 'alter' ? '🎭' : s.type === 'state' ? '🔀' : '📁'} ${s.name}`).join('\n')}`);
    }
    if (status) embed.addFields({ name: 'Status', value: status, inline: true });
    if (battery !== null) embed.addFields({ name: '🔋 Battery', value: `${battery}%`, inline: true });
    if (errors.length > 0) embed.addFields({ name: '⚠️ Not Found', value: errors.join(', ') });
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('qs_menu').setLabel('Change Front').setStyle(ButtonStyle.Primary).setEmoji('🔄'),
        new ButtonBuilder().setLabel('Open Full Front').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/front`).setEmoji('🌐')
    );
    
    return interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleOut(interaction, system) {
    await interaction.deferReply({ ephemeral: true });
    await closeAllActiveShifts(system);
    if (system.front?.layers) system.front.layers.forEach(l => l.shifts = []);
    await system.save();
    
    const embed = new EmbedBuilder().setColor(utils.ENTITY_COLORS.info).setTitle('📭 Switched Out').setDescription('No one is currently fronting.');
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('qs_menu').setLabel('Switch In').setStyle(ButtonStyle.Primary).setEmoji('🔄'),
        new ButtonBuilder().setLabel('Open Full Front').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/front`).setEmoji('🌐')
    );
    
    return interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleAdd(interaction, system) {
    await interaction.deferReply({ ephemeral: true });
    const entityName = interaction.options.getString('entity');
    const { entity, type } = await findEntityByName(entityName, system);
    if (!entity) return interaction.editReply({ content: `❌ "${entityName}" not found.` });
    
    const existing = await findActiveShift(entity._id, type, system);
    if (existing) return interaction.editReply({ content: `⚠️ ${utils.getDisplayName(entity)} is already fronting.` });
    
    if (!system.front?.layers?.length) {
        system.front = system.front || {};
        system.front.layers = [{ _id: new mongoose.Types.ObjectId(), name: 'Main', shifts: [] }];
    }
    
    const now = new Date();
    const shift = new Shift({
        _id: new mongoose.Types.ObjectId(), s_type: type, ID: entity._id.toString(),
        type_name: utils.getDisplayName(entity), startTime: now, endTime: null,
        statuses: [{ status: null, startTime: now, endTime: null, hidden: 'n' }]
    });
    await shift.save();
    system.front.layers[0].shifts.push(shift._id);
    updateRecentProxies(system, entity, type);
    await system.save();
    
    const emoji = type === 'alter' ? '🎭' : type === 'state' ? '🔀' : '📁';
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Open Full Front').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/front`).setEmoji('🌐')
    );
    return interaction.editReply({ content: `✅ ${emoji} **${utils.getDisplayName(entity)}** added to front.`, components: [row] });
}

async function handleRemove(interaction, system) {
    await interaction.deferReply({ ephemeral: true });
    const entityName = interaction.options.getString('entity');
    const { entity, type } = await findEntityByName(entityName, system);
    if (!entity) return interaction.editReply({ content: `❌ "${entityName}" not found.` });
    
    const shift = await findActiveShift(entity._id, type, system);
    if (!shift) return interaction.editReply({ content: `⚠️ ${utils.getDisplayName(entity)} is not fronting.` });
    
    shift.endTime = new Date();
    if (shift.statuses?.length > 0) shift.statuses[shift.statuses.length - 1].endTime = new Date();
    await shift.save();
    
    const emoji = type === 'alter' ? '🎭' : type === 'state' ? '🔀' : '📁';
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Open Full Front').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/front`).setEmoji('🌐')
    );
    return interaction.editReply({ content: `✅ ${emoji} **${utils.getDisplayName(entity)}** removed from front.`, components: [row] });
}

async function handleStatus(interaction, system) {
    const status = interaction.options.getString('status');
    if (!system.front) system.front = {};
    system.front.status = status;
    await system.save();
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Open Full Front').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/front`).setEmoji('🌐')
    );
    return interaction.reply({ content: `✅ Status: **${status}**`, components: [row], ephemeral: true });
}

async function handleBattery(interaction, system) {
    const level = interaction.options.getInteger('level');
    system.battery = level;
    await system.save();
    const emoji = level >= 70 ? '🔋' : level >= 30 ? '🪫' : '⚠️';
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Open Full Front').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/front`).setEmoji('🌐')
    );
    return interaction.reply({ content: `${emoji} Battery: **${level}%**`, components: [row], ephemeral: true });
}

async function handleMenu(interaction, system) {
    const currentFronters = [];
    for (const layer of system.front?.layers || []) {
        for (const shiftId of layer.shifts || []) {
            const shift = await Shift.findById(shiftId);
            if (shift && !shift.endTime) currentFronters.push({ name: shift.type_name, type: shift.s_type });
        }
    }
    
    const recentEntities = [];
    for (const proxy of system.proxy?.recentProxies?.slice(0, 15) || []) {
        const [type, id] = proxy.split(':');
        let entity = type === 'alter' ? await Alter.findById(id) : type === 'state' ? await State.findById(id) : await Group.findById(id);
        if (entity) recentEntities.push({ name: utils.getDisplayName(entity), type, id: entity._id.toString(), color: entity.color });
    }
    
    const embed = new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.system)
        .setTitle('⚡ Quick Switch')
        .setDescription('Select entities or use buttons below.');
    
    if (currentFronters.length > 0) {
        embed.addFields({ name: '🎭 Current Front', value: currentFronters.map(f => `${f.type === 'alter' ? '🎭' : f.type === 'state' ? '🔀' : '📁'} ${f.name}`).join('\n'), inline: true });
    } else {
        embed.addFields({ name: '🎭 Current Front', value: '*No one fronting*', inline: true });
    }
    if (system.front?.status) embed.addFields({ name: '💬 Status', value: system.front.status, inline: true });
    if (system.battery !== undefined) embed.addFields({ name: '🔋 Battery', value: `${system.battery}%`, inline: true });
    
    const components = [];
    if (recentEntities.length > 0) {
        const selectMenu = new StringSelectMenuBuilder().setCustomId('qs_select').setPlaceholder('Select entities...').setMinValues(1).setMaxValues(Math.min(recentEntities.length, 10));
        recentEntities.forEach(e => selectMenu.addOptions(
            new StringSelectMenuOptionBuilder().setLabel(e.name).setValue(`${e.type}:${e.id}`).setEmoji(e.type === 'alter' ? '🎭' : e.type === 'state' ? '🔀' : '📁')
        ));
        components.push(new ActionRowBuilder().addComponents(selectMenu));
    }
    
    components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('qs_switchout').setLabel('Switch Out').setStyle(ButtonStyle.Secondary).setEmoji('📭'),
        new ButtonBuilder().setCustomId('qs_refresh').setLabel('Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
        new ButtonBuilder().setLabel('Open Full Front').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/front`).setEmoji('🌐')
    ));
    
    return interaction.reply({ embeds: [embed], components, ephemeral: true });
}

// Helper functions
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

async function findActiveShift(entityId, type, system) {
    for (const layer of system.front?.layers || []) {
        for (const shiftId of layer.shifts || []) {
            const shift = await Shift.findById(shiftId);
            if (shift && !shift.endTime && shift.ID === entityId.toString() && shift.s_type === type) return shift;
        }
    }
    return null;
}

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

function updateRecentProxies(system, entity, type) {
    const proxyKey = `${type}:${entity._id}`;
    if (!system.proxy) system.proxy = {};
    if (!system.proxy.recentProxies) system.proxy.recentProxies = [];
    system.proxy.recentProxies = system.proxy.recentProxies.filter(p => !p.startsWith(proxyKey));
    system.proxy.recentProxies.unshift(proxyKey);
    system.proxy.recentProxies = system.proxy.recentProxies.slice(0, 15);
}

// Component handlers
module.exports.handleSelectMenu = async function(interaction) {
    if (interaction.customId !== 'qs_select') return false;
    await interaction.deferUpdate();
    
    const { system } = await utils.getOrCreateUserAndSystem(interaction);
    if (!system) return;
    
    await closeAllActiveShifts(system);
    if (!system.front) system.front = {};
    if (!system.front.layers?.length) system.front.layers = [{ _id: new mongoose.Types.ObjectId(), name: 'Main', shifts: [] }];
    system.front.layers[0].shifts = [];
    
    const now = new Date();
    const successes = [];
    for (const value of interaction.values) {
        const [type, id] = value.split(':');
        let entity = type === 'alter' ? await Alter.findById(id) : type === 'state' ? await State.findById(id) : await Group.findById(id);
        if (!entity) continue;
        
        const shift = new Shift({
            _id: new mongoose.Types.ObjectId(), s_type: type, ID: entity._id.toString(),
            type_name: utils.getDisplayName(entity), startTime: now, endTime: null,
            statuses: [{ status: null, startTime: now, endTime: null, hidden: 'n' }]
        });
        await shift.save();
        system.front.layers[0].shifts.push(shift._id);
        successes.push({ name: utils.getDisplayName(entity), type });
        updateRecentProxies(system, entity, type);
    }
    await system.save();
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Open Full Front').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/front`).setEmoji('🌐')
    );
    return interaction.followUp({ content: `✅ Switched to: ${successes.map(s => s.name).join(', ')}`, components: [row], ephemeral: true });
};

module.exports.handleButton = async function(interaction) {
    if (!interaction.customId.startsWith('qs_')) return false;
    const { system } = await utils.getOrCreateUserAndSystem(interaction);
    if (!system) return;
    
    if (interaction.customId === 'qs_switchout') {
        await interaction.deferUpdate();
        await closeAllActiveShifts(system);
        if (system.front?.layers) system.front.layers.forEach(l => l.shifts = []);
        await system.save();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Open Full Front').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/front`).setEmoji('🌐')
        );
        return interaction.followUp({ content: '📭 Switched out.', components: [row], ephemeral: true });
    }
    
    if (interaction.customId === 'qs_refresh' || interaction.customId === 'qs_menu') {
        return handleMenu(interaction, system);
    }
    return false;
};
