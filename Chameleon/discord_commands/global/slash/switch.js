// (/switch) - Systemiser Switch Command
// Manages front switching, layers, and shift statuses

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
const System = require('../../schemas/system');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const { Shift } = require('../../schemas/front');

// Import shared utilities
const utils = require('../functions/bot_utils');

// Constants
const ENTITY_COLORS = utils.ENTITY_COLORS || {
    system: '#9B59B6',
    alter: '#3498DB',
    state: '#2ECC71',
    group: '#E74C3C'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('switch')
        .setDescription('Manage front switching and shift statuses')
        .addSubcommand(sub => sub
            .setName('in')
            .setDescription('Open the switch-in form to change who is fronting'))
        .addSubcommand(sub => sub
            .setName('out')
            .setDescription('Switch out an entity from front')
            .addStringOption(opt => opt
                .setName('entity')
                .setDescription('Name of alter/state/group to switch out')
                .setRequired(true)
                .setAutocomplete(true)))
        .addSubcommand(sub => sub
            .setName('status')
            .setDescription('Update shift status for a fronting entity')
            .addStringOption(opt => opt
                .setName('entity')
                .setDescription('Name of alter/state/group currently fronting')
                .setRequired(true)
                .setAutocomplete(true))
            .addStringOption(opt => opt
                .setName('new_status')
                .setDescription('New status for this shift')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('history')
            .setDescription('View recent switch history')
            .addIntegerOption(opt => opt
                .setName('limit')
                .setDescription('Number of recent switches to show (default: 10)')
                .setMinValue(1)
                .setMaxValue(50))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const { user, system, isNew } = await utils.getOrCreateUserAndSystem(interaction);
        
        if (isNew) {
            return utils.handleNewUserFlow(interaction, 'switch');
        }

        if (!system) {
            return interaction.reply({
                content: '❌ You need to set up a system first. Use `/system` to get started.',
                ephemeral: true
            });
        }

        switch (subcommand) {
            case 'in':
                return handleSwitchIn(interaction, system);
            case 'out':
                return handleSwitchOut(interaction, system);
            case 'status':
                return handleStatus(interaction, system);
            case 'history':
                return handleHistory(interaction, system);
            default:
                return interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
        }
    },

    async autocomplete(interaction) {
        const { system } = await utils.getOrCreateUserAndSystem(interaction);
        if (!system) return interaction.respond([]);

        const focusedOption = interaction.options.getFocused(true);
        const searchValue = focusedOption.value.toLowerCase();

        // Get all fronting entities for autocomplete
        const fronters = await getFrontingEntities(system);
        
        const choices = fronters
            .filter(f => f.name.toLowerCase().includes(searchValue))
            .slice(0, 25)
            .map(f => ({
                name: `${f.name} (${f.type})`,
                value: f.name
            }));

        return interaction.respond(choices);
    },

    // Export handlers for bot.js
    handleButtonInteraction,
    handleSelectMenu,
    handleModalSubmit
};

// ============================================
// SWITCH IN - Main switching form
// ============================================

async function handleSwitchIn(interaction, system) {
    const sessionId = utils.generateSessionId();
    
    // Get current front data for prefilling
    const currentLayers = system.front?.layers || [];
    const layerNames = currentLayers.map(l => l.name || 'Unnamed').join(', ');
    
    // Build prefilled fronter list
    let prefillFronters = '';
    for (const layer of currentLayers) {
        const fronterNames = [];
        for (const shift of layer.shifts || []) {
            const shiftDoc = await Shift.findById(shift);
            if (shiftDoc && !shiftDoc.endTime) {
                fronterNames.push(shiftDoc.type_name || shiftDoc.ID);
            }
        }
        if (fronterNames.length > 0) {
            prefillFronters += fronterNames.join(', ') + '\n';
        }
    }
    prefillFronters = prefillFronters.trim();

    // Store session data
    utils.setSession(sessionId, {
        systemId: system._id,
        type: 'switch_in'
    });

    // Create modal
    const modal = new ModalBuilder()
        .setCustomId(`switch_in_modal_${sessionId}`)
        .setTitle('Switch Front');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('main_status')
                .setLabel('Main Status (optional)')
                .setStyle(TextInputStyle.Short)
                .setValue(system.front?.status || '')
                .setPlaceholder('e.g., Working, Relaxing, In class')
                .setRequired(false)
                .setMaxLength(100)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('layer_names')
                .setLabel('Layer Names (comma-separated, first = top)')
                .setStyle(TextInputStyle.Short)
                .setValue(layerNames || 'Main')
                .setPlaceholder('Main, Co-con, Background')
                .setRequired(true)
                .setMaxLength(200)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('fronters')
                .setLabel('Who is fronting? (comma = same layer, newline = next)')
                .setStyle(TextInputStyle.Paragraph)
                .setValue(prefillFronters || '')
                .setPlaceholder('Luna, Alex\nStar\nHeart, Moon')
                .setRequired(true)
                .setMaxLength(1000)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('social_battery')
                .setLabel('Social Battery (0-100, optional)')
                .setStyle(TextInputStyle.Short)
                .setValue(system.battery !== undefined ? String(system.battery) : '')
                .setPlaceholder('75')
                .setRequired(false)
                .setMaxLength(3)
        )
    );

    await interaction.showModal(modal);
}

// ============================================
// SWITCH OUT - Remove entity from front
// ============================================

async function handleSwitchOut(interaction, system) {
    const entityName = interaction.options.getString('entity');
    
    await interaction.deferReply({ ephemeral: true });

    // Find the entity
    const { entity, type } = await findEntityByName(entityName, system);
    if (!entity) {
        return interaction.editReply({
            content: `❌ Could not find an alter, state, or group named "${entityName}".`
        });
    }

    // Find and close the active shift for this entity
    const closed = await closeEntityShift(entity._id, type, system);
    
    if (!closed) {
        return interaction.editReply({
            content: `❌ **${utils.getDisplayName(entity)}** is not currently fronting.`
        });
    }

    // Build confirmation
    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS[type] || '#888888')
        .setTitle('🔄 Switched Out')
        .setDescription(`**${utils.getDisplayName(entity)}** has been switched out.`)
        .setTimestamp();

    if (entity.avatar?.url || entity.discord?.image?.avatar?.url) {
        embed.setThumbnail(entity.avatar?.url || entity.discord?.image?.avatar?.url);
    }

    return interaction.editReply({ embeds: [embed] });
}

// ============================================
// STATUS - Update shift status
// ============================================

async function handleStatus(interaction, system) {
    const entityName = interaction.options.getString('entity');
    const newStatus = interaction.options.getString('new_status');
    
    await interaction.deferReply({ ephemeral: true });

    // Find the entity
    const { entity, type } = await findEntityByName(entityName, system);
    if (!entity) {
        return interaction.editReply({
            content: `❌ Could not find an alter, state, or group named "${entityName}".`
        });
    }

    // Find the active shift
    const activeShift = await findActiveShift(entity._id, type, system);
    if (!activeShift) {
        return interaction.editReply({
            content: `❌ **${utils.getDisplayName(entity)}** is not currently fronting.`
        });
    }

    // Close the current status and add new one
    const now = new Date();
    
    // Close the last status entry
    if (activeShift.statuses && activeShift.statuses.length > 0) {
        const lastStatus = activeShift.statuses[activeShift.statuses.length - 1];
        if (!lastStatus.endTime) {
            lastStatus.endTime = now;
        }
    }

    // Add new status entry
    activeShift.statuses.push({
        status: newStatus,
        startTime: now,
        endTime: null,
        layerID: activeShift.statuses?.[activeShift.statuses.length - 1]?.layerID,
        hidden: 'n'
    });

    await activeShift.save();

    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS[type] || '#888888')
        .setTitle('📝 Status Updated')
        .setDescription(`**${utils.getDisplayName(entity)}**'s status is now: *${newStatus}*`)
        .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
}

// ============================================
// HISTORY - View switch history
// ============================================

async function handleHistory(interaction, system) {
    const limit = interaction.options.getInteger('limit') || 10;
    
    await interaction.deferReply({ ephemeral: true });

    // Get all shift IDs from all layers
    const allShiftIds = [];
    for (const layer of system.front?.layers || []) {
        allShiftIds.push(...(layer.shifts || []));
    }

    // Fetch recent shifts (sorted by start time descending)
    const shifts = await Shift.find({ _id: { $in: allShiftIds } })
        .sort({ startTime: -1 })
        .limit(limit);

    if (shifts.length === 0) {
        return interaction.editReply({
            content: '📋 No switch history found.'
        });
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
            historyText += `${typeEmoji} **${shift.type_name}** - <t:${startTime}:R> to <t:${endTime}:R>\n`;
        } else {
            historyText += `${typeEmoji} **${shift.type_name}** - <t:${startTime}:R> (still fronting)\n`;
        }
        historyText += `   └ Status: *${status}*\n`;
    }

    embed.addFields({ name: 'Switches', value: historyText || 'No data' });

    return interaction.editReply({ embeds: [embed] });
}

// ============================================
// BUTTON HANDLER
// ============================================

async function handleButtonInteraction(interaction) {
    // Currently no buttons for switch, but placeholder for future
}

// ============================================
// SELECT MENU HANDLER
// ============================================

async function handleSelectMenu(interaction) {
    // Currently no select menus, placeholder for future
}

// ============================================
// MODAL SUBMIT HANDLER
// ============================================

async function handleModalSubmit(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);

    if (!session) {
        return interaction.reply({ 
            content: '❌ Session expired. Please try again.', 
            ephemeral: true 
        });
    }

    const system = await System.findById(session.systemId);

    // Handle switch in modal
    if (interaction.customId.startsWith('switch_in_modal_')) {
        await interaction.deferReply({ ephemeral: true });

        const mainStatus = interaction.fields.getTextInputValue('main_status');
        const layerNamesInput = interaction.fields.getTextInputValue('layer_names');
        const frontersInput = interaction.fields.getTextInputValue('fronters');
        const batteryInput = interaction.fields.getTextInputValue('social_battery');

        // Parse layer names
        const layerNames = layerNamesInput.split(',').map(n => n.trim()).filter(Boolean);
        
        // Parse fronters (comma = same layer, newline = next layer)
        const layerLines = frontersInput.split('\n').map(line => line.trim()).filter(Boolean);
        const frontersByLayer = layerLines.map(line => 
            line.split(',').map(name => name.trim()).filter(Boolean)
        );

        // Validate we have enough layers
        if (frontersByLayer.length > layerNames.length) {
            // Add default names for extra layers
            for (let i = layerNames.length; i < frontersByLayer.length; i++) {
                layerNames.push(`Layer ${i + 1}`);
            }
        }

        // Close all current active shifts
        await closeAllActiveShifts(system);

        // Create new layers with shifts
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
                // Find the entity
                const { entity, type } = await findEntityByName(fronterName, system);
                
                if (!entity) {
                    errors.push(`"${fronterName}" not found`);
                    continue;
                }

                // Create a new shift
                const shift = new Shift({
                    _id: new mongoose.Types.ObjectId(),
                    s_type: type,
                    ID: entity._id.toString(),
                    type_name: utils.getDisplayName(entity),
                    startTime: now,
                    endTime: null,
                    statuses: [{
                        status: entity.setting?.default_status || null,
                        startTime: now,
                        endTime: null,
                        layerID: layer._id,
                        hidden: 'n'
                    }]
                });

                await shift.save();
                layer.shifts.push(shift._id);
                successfulFronters.push({
                    name: utils.getDisplayName(entity),
                    type: type,
                    layer: layerName
                });
            }

            if (layer.shifts.length > 0) {
                newLayers.push(layer);
            }
        }

        // Update system front
        if (!system.front) system.front = {};
        system.front.layers = newLayers;
        system.front.status = mainStatus || undefined;

        // Update battery if provided
        if (batteryInput) {
            const batteryNum = parseInt(batteryInput);
            if (!isNaN(batteryNum) && batteryNum >= 0 && batteryNum <= 100) {
                system.battery = batteryNum;
            }
        }

        await system.save();
        utils.deleteSession(sessionId);

        // Build response embed
        const embed = new EmbedBuilder()
            .setColor(ENTITY_COLORS.system)
            .setTitle('🔄 Switch Complete')
            .setTimestamp();

        if (mainStatus) {
            embed.setDescription(`**Status:** ${mainStatus}`);
        }

        // Add fields for each layer
        for (const layer of newLayers) {
            const layerFronters = successfulFronters.filter(f => f.layer === layer.name);
            const fronterList = layerFronters.map(f => {
                const emoji = f.type === 'alter' ? '🎭' : (f.type === 'state' ? '🔄' : '👥');
                return `${emoji} ${f.name}`;
            }).join('\n');
            
            embed.addFields({
                name: layer.name,
                value: fronterList || '*Empty*',
                inline: true
            });
        }

        // Add battery if set
        if (system.battery !== undefined) {
            embed.addFields({
                name: '🔋 Social Battery',
                value: `${system.battery}%`,
                inline: true
            });
        }

        // Add errors if any
        if (errors.length > 0) {
            embed.addFields({
                name: '⚠️ Not Found',
                value: errors.join(', '),
                inline: false
            });
        }

        return interaction.editReply({ embeds: [embed] });
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Find entity by name across all entity types
 */
async function findEntityByName(name, system) {
    const searchName = name.toLowerCase();

    // Search alters
    const alters = await Alter.find({ _id: { $in: system.alters?.IDs || [] } });
    let entity = alters.find(a => a.name?.indexable?.toLowerCase() === searchName);
    if (!entity) {
        entity = alters.find(a => a.name?.aliases?.some(alias => alias.toLowerCase() === searchName));
    }
    if (entity) return { entity, type: 'alter' };

    // Search states
    const states = await State.find({ _id: { $in: system.states?.IDs || [] } });
    entity = states.find(s => s.name?.indexable?.toLowerCase() === searchName);
    if (!entity) {
        entity = states.find(s => s.name?.aliases?.some(alias => alias.toLowerCase() === searchName));
    }
    if (entity) return { entity, type: 'state' };

    // Search groups
    const groups = await Group.find({ _id: { $in: system.groups?.IDs || [] } });
    entity = groups.find(g => g.name?.indexable?.toLowerCase() === searchName);
    if (!entity) {
        entity = groups.find(g => g.name?.aliases?.some(alias => alias.toLowerCase() === searchName));
    }
    if (entity) return { entity, type: 'group' };

    return { entity: null, type: null };
}

/**
 * Get all currently fronting entities
 */
async function getFrontingEntities(system) {
    const fronters = [];
    
    for (const layer of system.front?.layers || []) {
        for (const shiftId of layer.shifts || []) {
            const shift = await Shift.findById(shiftId);
            if (shift && !shift.endTime) {
                fronters.push({
                    id: shift.ID,
                    name: shift.type_name,
                    type: shift.s_type,
                    layerName: layer.name
                });
            }
        }
    }
    
    return fronters;
}

/**
 * Find active shift for an entity
 */
async function findActiveShift(entityId, type, system) {
    for (const layer of system.front?.layers || []) {
        for (const shiftId of layer.shifts || []) {
            const shift = await Shift.findById(shiftId);
            if (shift && !shift.endTime && shift.ID === entityId.toString() && shift.s_type === type) {
                return shift;
            }
        }
    }
    return null;
}

/**
 * Close shift for a specific entity
 */
async function closeEntityShift(entityId, type, system) {
    const shift = await findActiveShift(entityId, type, system);
    if (!shift) return false;

    const now = new Date();
    shift.endTime = now;
    
    // Close last status
    if (shift.statuses && shift.statuses.length > 0) {
        const lastStatus = shift.statuses[shift.statuses.length - 1];
        if (!lastStatus.endTime) {
            lastStatus.endTime = now;
        }
    }

    await shift.save();
    return true;
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
                
                // Close last status
                if (shift.statuses && shift.statuses.length > 0) {
                    const lastStatus = shift.statuses[shift.statuses.length - 1];
                    if (!lastStatus.endTime) {
                        lastStatus.endTime = now;
                    }
                }
                
                await shift.save();
            }
        }
    }
}