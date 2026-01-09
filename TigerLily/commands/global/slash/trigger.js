// (/trigger) - TigerLily Trigger Management Command
// Structure: Groups as subcommands, actions as string options

const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');

const User = require('../../../schemas/user');
const Guild = require('../../../schemas/guild');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trigger')
        .setDescription('Manage your triggers')
        
        // VIEW subcommand with action option
        .addSubcommand(subcommand => subcommand
            .setName('view')
            .setDescription('View trigger information')
            .addStringOption(option => option
                .setName('action')
                .setDescription('What to view')
                .setRequired(true)
                .addChoices(
                    { name: 'List - Show all triggers', value: 'list' },
                    { name: 'Show - View specific trigger', value: 'show' }
                ))
            .addStringOption(option => option
                .setName('trigger')
                .setDescription('Trigger name (required for "show")')
                .setRequired(false))
            .addUserOption(option => option
                .setName('user')
                .setDescription('View triggers for another user')
                .setRequired(false))
            .addBooleanOption(option => option
                .setName('server')
                .setDescription('View server-wide triggers')
                .setRequired(false)))
        
        // MANAGE subcommand with action option
        .addSubcommand(subcommand => subcommand
            .setName('manage')
            .setDescription('Add, edit, remove, or move triggers')
            .addStringOption(option => option
                .setName('action')
                .setDescription('What to do')
                .setRequired(true)
                .addChoices(
                    { name: 'Add - Create new trigger', value: 'add' },
                    { name: 'Edit - Modify existing trigger', value: 'edit' },
                    { name: 'Remove - Delete trigger', value: 'remove' },
                    { name: 'Move - Move trigger to another group', value: 'move' }
                ))
            .addStringOption(option => option
                .setName('trigger')
                .setDescription('Trigger name (required for edit/remove/move)')
                .setRequired(false))
            .addStringOption(option => option
                .setName('group')
                .setDescription('Group name (optional for add, required for move)')
                .setRequired(false)))
        
        // SETTINGS subcommand with action option
        .addSubcommand(subcommand => subcommand
            .setName('settings')
            .setDescription('Configure trigger display and groups')
            .addStringOption(option => option
                .setName('action')
                .setDescription('What to configure')
                .setRequired(true)
                .addChoices(
                    { name: 'Display - Edit list display settings', value: 'display' },
                    { name: 'Group Order - Reorder groups', value: 'grouporder' },
                    { name: 'Add Group - Create new group', value: 'addgroup' },
                    { name: 'Remove Group - Delete group', value: 'removegroup' }
                ))
            .addStringOption(option => option
                .setName('group')
                .setDescription('Group name (required for removegroup)')
                .setRequired(false))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const action = interaction.options.getString('action');

        // Get or create user
        let user = await User.findOne({ discordID: interaction.user.id });

        if (!user) {
            user = await createNewUser(interaction.user.id);
            
            const welcomeEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('Welcome! 🎉')
                .setDescription('Welcome to TigerLily! You can now create your triggers using `/trigger manage add`.')
                .setTimestamp();

            await interaction.reply({ embeds: [welcomeEmbed], ephemeral: true });
            return;
        }

        // Initialize trigger groups if needed
        if (!user.trigger?.triggerGroups || user.trigger.triggerGroups.length === 0) {
            user.trigger = user.trigger || {};
            user.trigger.triggerGroups = [{
                name: 'Unorganized',
                displayName: 'Unorganized',
                triggers: [],
                color: '#808080'
            }];
            await user.save();
        }

        // Route based on subcommand and action
        if (subcommand === 'view') {
            if (action === 'list') {
                return await handleShowList(interaction, user);
            } else if (action === 'show') {
                return await handleShow(interaction, user);
            }
        } else if (subcommand === 'manage') {
            if (action === 'add') {
                return await handleAddTrigger(interaction, user);
            } else if (action === 'edit') {
                return await handleEditTrigger(interaction, user);
            } else if (action === 'remove') {
                return await handleRemoveTrigger(interaction, user);
            } else if (action === 'move') {
                return await handleMove(interaction, user);
            }
        } else if (subcommand === 'settings') {
            if (action === 'display') {
                return await handleEditDisplay(interaction, user);
            } else if (action === 'grouporder') {
                return await handleEditGroupOrder(interaction, user);
            } else if (action === 'addgroup') {
                return await handleAddGroup(interaction, user);
            } else if (action === 'removegroup') {
                return await handleRemoveGroup(interaction, user);
            }
        }

        return interaction.reply({
            content: '❌ Unknown command',
            ephemeral: true
        });
    },

    handleButtonInteraction,
    handleModalSubmit
};

// ============================================
// USER CREATION
// ============================================

async function createNewUser(discordId) {
    const user = new User({
        _id: new mongoose.Types.ObjectId(),
        discordID: discordId,
        createdAt: new Date(),
        intro: {},
        trigger: {
            bullet: '-',
            triggerGroups: [{
                name: 'Unorganized',
                displayName: 'Unorganized',
                triggers: [],
                color: '#808080'
            }]
        },
        affirmations: [],
        premium: {
            active: false
        },
        sponsor: {
            available: 0,
            guildIDs: [],
            userIDs: []
        }
    });
    await user.save();
    return user;
}

// ============================================
// VIEW HANDLERS
// ============================================

async function handleShowList(interaction, currentUser) {
    const specifiedUser = interaction.options.getUser('user');
    const isServer = interaction.options.getBoolean('server');

    let targetData, targetAvatar, targetName;

    if (isServer) {
        // Show server triggers
        const guild = await Guild.findOne({ discordID: interaction.guildId });
        if (!guild || !guild.trigger?.triggerGroups || guild.trigger.triggerGroups.length === 0) {
            return await interaction.reply({
                content: '❌ There are no triggers listed for this server.',
                ephemeral: true
            });
        }
        targetData = guild;
        targetAvatar = interaction.guild.iconURL({ dynamic: true });
        targetName = interaction.guild.name;
    } else if (specifiedUser) {
        const user = await User.findOne({ discordID: specifiedUser.id });
        if (!user || !user.trigger?.triggerGroups || user.trigger.triggerGroups.length === 0) {
            return await interaction.reply({
                content: `❌ Trigger not found for ${specifiedUser.username}.`,
                ephemeral: true
            });
        }
        targetData = user;
        targetAvatar = specifiedUser.displayAvatarURL({ dynamic: true });
        targetName = specifiedUser.username;
    } else {
        targetData = currentUser;
        targetAvatar = interaction.user.displayAvatarURL({ dynamic: true });
        targetName = interaction.user.username;
    }

    const embed = buildTriggerListEmbed(targetData, targetAvatar, targetName);
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleShow(interaction, user) {
    const triggerName = interaction.options.getString('trigger');
    
    if (!triggerName) {
        return await interaction.reply({
            content: '❌ Please provide a trigger name using the `trigger` option.',
            ephemeral: true
        });
    }

    const specifiedUser = interaction.options.getUser('user');
    const isServer = interaction.options.getBoolean('server');

    let targetData, targetAvatar;

    if (isServer) {
        const guild = await Guild.findOne({ discordID: interaction.guildId });
        if (!guild) {
            return await interaction.reply({
                content: '❌ Server triggers not found.',
                ephemeral: true
            });
        }
        targetData = guild;
        targetAvatar = interaction.guild.iconURL({ dynamic: true });
    } else if (specifiedUser) {
        const targetUser = await User.findOne({ discordID: specifiedUser.id });
        if (!targetUser) {
            return await interaction.reply({
                content: `❌ Trigger not found for ${specifiedUser.username}.`,
                ephemeral: true
            });
        }
        targetData = targetUser;
        targetAvatar = specifiedUser.displayAvatarURL({ dynamic: true });
    } else {
        targetData = user;
        targetAvatar = interaction.user.displayAvatarURL({ dynamic: true });
    }

    // Find the trigger
    const result = findTrigger(targetData, triggerName);
    if (!result) {
        return await interaction.reply({
            content: `❌ Trigger "${triggerName}" not found.`,
            ephemeral: true
        });
    }

    const embed = buildTriggerEmbed(result.trigger, result.group, targetData, targetAvatar);
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ============================================
// MANAGE HANDLERS
// ============================================

async function handleAddTrigger(interaction, user) {
    const groupName = interaction.options.getString('group');

    const modal = buildTriggerModal(null, 'add_trigger_modal');
    await interaction.showModal(modal);

    try {
        const submitted = await interaction.awaitModalSubmit({
            filter: i => i.user.id === interaction.user.id,
            time: 180000
        });

        const newTrigger = {
            name: submitted.fields.getTextInputValue('trigger_name'),
            description: submitted.fields.getTextInputValue('trigger_description'),
            help: submitted.fields.getTextInputValue('trigger_help') || undefined
        };

        let targetGroup;
        let addMessage = '';

        if (groupName) {
            targetGroup = user.trigger.triggerGroups.find(g => g.name === groupName);
            if (targetGroup) {
                targetGroup.triggers.push(newTrigger);
                addMessage = `✅ Trigger added to group "${groupName}".`;
            } else {
                const unorganized = getOrCreateUnorganized(user);
                unorganized.triggers.push(newTrigger);
                addMessage = `⚠️ Group "${groupName}" not found. Trigger added to "Unorganized".`;
            }
        } else {
            const unorganized = getOrCreateUnorganized(user);
            unorganized.triggers.push(newTrigger);
            addMessage = `✅ Trigger added to "Unorganized".`;
        }

        await user.save();

        const embed = buildTriggerEmbed(newTrigger, targetGroup || getOrCreateUnorganized(user), user, interaction.user.displayAvatarURL({ dynamic: true }));
        await submitted.reply({
            content: addMessage,
            embeds: [embed],
            ephemeral: true
        });

    } catch (error) {
        if (!error.message.includes('time')) {
            console.error('Error in handleAddTrigger:', error);
        }
    }
}

async function handleEditTrigger(interaction, user) {
    const triggerName = interaction.options.getString('trigger');
    
    if (!triggerName) {
        return await interaction.reply({
            content: '❌ Please provide a trigger name using the `trigger` option.',
            ephemeral: true
        });
    }

    const result = findTrigger(user, triggerName);

    if (!result) {
        return await interaction.reply({
            content: `❌ Trigger "${triggerName}" not found.`,
            ephemeral: true
        });
    }

    const modal = buildTriggerModal(result.trigger, 'edit_trigger_modal');
    await interaction.showModal(modal);

    try {
        const submitted = await interaction.awaitModalSubmit({
            filter: i => i.user.id === interaction.user.id,
            time: 180000
        });

        updateTriggerFromModal(result.trigger, submitted);
        await user.save();

        const embed = buildTriggerEmbed(result.trigger, result.group, user, interaction.user.displayAvatarURL({ dynamic: true }));
        await submitted.reply({
            content: '✅ Trigger updated!',
            embeds: [embed],
            ephemeral: true
        });

    } catch (error) {
        if (!error.message.includes('time')) {
            console.error('Error in handleEditTrigger:', error);
        }
    }
}

async function handleRemoveTrigger(interaction, user) {
    const triggerName = interaction.options.getString('trigger');
    const groupName = interaction.options.getString('group');
    
    if (!triggerName) {
        return await interaction.reply({
            content: '❌ Please provide a trigger name using the `trigger` option.',
            ephemeral: true
        });
    }

    if (groupName) {
        // Move trigger from specified group to Unorganized
        const group = user.trigger.triggerGroups.find(g => g.name === groupName);
        if (!group) {
            return await interaction.reply({
                content: `❌ Group "${groupName}" not found.`,
                ephemeral: true
            });
        }

        const triggerIndex = group.triggers.findIndex(t => t.name === triggerName);
        if (triggerIndex === -1) {
            return await interaction.reply({
                content: `❌ Trigger "${triggerName}" not found in group "${groupName}".`,
                ephemeral: true
            });
        }

        const [trigger] = group.triggers.splice(triggerIndex, 1);
        const unorganized = getOrCreateUnorganized(user);
        unorganized.triggers.push(trigger);

        await user.save();
        return await interaction.reply({
            content: `✅ Trigger "${triggerName}" moved from "${groupName}" to "Unorganized".`,
            ephemeral: true
        });
    } else {
        // Delete trigger completely
        const result = findTrigger(user, triggerName);
        if (!result) {
            return await interaction.reply({
                content: `❌ Trigger "${triggerName}" not found.`,
                ephemeral: true
            });
        }

        const confirmRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`trigger_delete_confirm_${triggerName}`)
                    .setLabel('Confirm Delete')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('trigger_delete_cancel')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.reply({
            content: `⚠️ Are you sure you want to delete the trigger "${triggerName}"? This cannot be undone.`,
            components: [confirmRow],
            ephemeral: true
        });
    }
}

async function handleMove(interaction, user) {
    const triggerName = interaction.options.getString('trigger');
    const newGroupName = interaction.options.getString('group');
    
    if (!triggerName) {
        return await interaction.reply({
            content: '❌ Please provide a trigger name using the `trigger` option.',
            ephemeral: true
        });
    }
    
    if (!newGroupName) {
        return await interaction.reply({
            content: '❌ Please provide a target group name using the `group` option.',
            ephemeral: true
        });
    }

    const result = findTrigger(user, triggerName);
    if (!result) {
        return await interaction.reply({
            content: `❌ Trigger "${triggerName}" not found.`,
            ephemeral: true
        });
    }

    const newGroup = user.trigger.triggerGroups.find(g => g.name === newGroupName);
    if (!newGroup) {
        return await interaction.reply({
            content: `❌ Group "${newGroupName}" not found.`,
            ephemeral: true
        });
    }

    // Remove from old group
    const triggerIndex = result.group.triggers.findIndex(t => t.name === triggerName);
    const [trigger] = result.group.triggers.splice(triggerIndex, 1);

    // Add to new group
    newGroup.triggers.push(trigger);

    await user.save();
    return await interaction.reply({
        content: `✅ Trigger "${triggerName}" moved from "${result.group.name}" to "${newGroupName}".`,
        ephemeral: true
    });
}

// ============================================
// SETTINGS HANDLERS
// ============================================

async function handleEditDisplay(interaction, user) {
    const hasPremium = user.premium?.active || false;

    const modal = new ModalBuilder()
        .setCustomId('edit_display_modal')
        .setTitle('Edit Trigger List Display');

    const bulletInput = new TextInputBuilder()
        .setCustomId('bullet')
        .setLabel('Bullet Character')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(5)
        .setValue(user.trigger?.bullet || '-');

    const colorInput = new TextInputBuilder()
        .setCustomId('color')
        .setLabel('Embed Color (hex code, e.g., #ff0000)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(7)
        .setValue(user.trigger?.color || '');

    modal.addComponents(
        new ActionRowBuilder().addComponents(bulletInput),
        new ActionRowBuilder().addComponents(colorInput)
    );

    if (hasPremium) {
        const titleInput = new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Title')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(256)
            .setValue(user.trigger?.title || '');

        modal.addComponents(new ActionRowBuilder().addComponents(titleInput));
    }

    await interaction.showModal(modal);

    try {
        const submitted = await interaction.awaitModalSubmit({
            filter: i => i.user.id === interaction.user.id,
            time: 180000
        });

        user.trigger.bullet = submitted.fields.getTextInputValue('bullet') || '-';
        const color = submitted.fields.getTextInputValue('color');
        if (color) user.trigger.color = color;

        if (hasPremium) {
            const title = submitted.fields.getTextInputValue('title');
            if (title) user.trigger.title = title;
        }

        await user.save();

        const embed = buildTriggerListEmbed(user, interaction.user.displayAvatarURL({ dynamic: true }), interaction.user.username);
        await submitted.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
        if (!error.message.includes('time')) {
            console.error('Error in handleEditDisplay:', error);
        }
    }
}

async function handleEditGroupOrder(interaction, user) {
    const modal = new ModalBuilder()
        .setCustomId('edit_grouporder_modal')
        .setTitle('Edit Group Order');

    const currentOrder = user.trigger.triggerGroups.map(g => g.name).join(', ');
    
    const orderInput = new TextInputBuilder()
        .setCustomId('group_order')
        .setLabel('Group Order (comma-separated)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(currentOrder)
        .setMaxLength(500);

    modal.addComponents(new ActionRowBuilder().addComponents(orderInput));

    await interaction.showModal(modal);

    try {
        const submitted = await interaction.awaitModalSubmit({
            filter: i => i.user.id === interaction.user.id,
            time: 180000
        });

        const newOrderString = submitted.fields.getTextInputValue('group_order');
        const newOrder = newOrderString.split(',').map(s => s.trim()).filter(Boolean);

        if (newOrder.length !== user.trigger.triggerGroups.length) {
            return await submitted.reply({
                content: '❌ Invalid group order. Please include all groups.',
                ephemeral: true
            });
        }

        // Reorder groups
        const reorderedGroups = newOrder.map(name =>
            user.trigger.triggerGroups.find(g => g.name === name)
        ).filter(Boolean);

        if (reorderedGroups.length !== user.trigger.triggerGroups.length) {
            return await submitted.reply({
                content: '❌ One or more group names not found. Please try again.',
                ephemeral: true
            });
        }

        user.trigger.triggerGroups = reorderedGroups;
        await user.save();

        const embed = buildTriggerListEmbed(user, interaction.user.displayAvatarURL({ dynamic: true }), interaction.user.username);
        await submitted.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
        if (!error.message.includes('time')) {
            console.error('Error in handleEditGroupOrder:', error);
        }
    }
}

async function handleAddGroup(interaction, user) {
    const modal = new ModalBuilder()
        .setCustomId('add_group_modal')
        .setTitle('Add Trigger Group');

    const nameInput = new TextInputBuilder()
        .setCustomId('group_name')
        .setLabel('Group Name')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

    const displayNameInput = new TextInputBuilder()
        .setCustomId('display_name')
        .setLabel('Display Name')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(100);

    const colorInput = new TextInputBuilder()
        .setCustomId('color')
        .setLabel('Color (hex code, e.g., #ff0000)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(7);

    modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(displayNameInput),
        new ActionRowBuilder().addComponents(colorInput)
    );

    await interaction.showModal(modal);

    try {
        const submitted = await interaction.awaitModalSubmit({
            filter: i => i.user.id === interaction.user.id,
            time: 180000
        });

        const groupName = submitted.fields.getTextInputValue('group_name');
        const displayName = submitted.fields.getTextInputValue('display_name') || groupName;
        const color = submitted.fields.getTextInputValue('color') || '#808080';

        // Check if group already exists
        if (user.trigger.triggerGroups.find(g => g.name === groupName)) {
            return await submitted.reply({
                content: `❌ A group named "${groupName}" already exists.`,
                ephemeral: true
            });
        }

        const newGroup = {
            name: groupName,
            displayName: displayName,
            triggers: [],
            color: color
        };

        user.trigger.triggerGroups.push(newGroup);
        await user.save();

        await submitted.reply({
            content: `✅ Group "${groupName}" created!`,
            ephemeral: true
        });

    } catch (error) {
        if (!error.message.includes('time')) {
            console.error('Error in handleAddGroup:', error);
        }
    }
}

async function handleRemoveGroup(interaction, user) {
    const groupName = interaction.options.getString('group');
    
    if (!groupName) {
        return await interaction.reply({
            content: '❌ Please provide a group name using the `group` option.',
            ephemeral: true
        });
    }

    if (groupName === 'Unorganized') {
        return await interaction.reply({
            content: '❌ Cannot delete the "Unorganized" group.',
            ephemeral: true
        });
    }

    const groupIndex = user.trigger.triggerGroups.findIndex(g => g.name === groupName);
    if (groupIndex === -1) {
        return await interaction.reply({
            content: `❌ Group "${groupName}" not found.`,
            ephemeral: true
        });
    }

    const group = user.trigger.triggerGroups[groupIndex];
    
    // Move triggers to Unorganized
    if (group.triggers && group.triggers.length > 0) {
        const unorganized = getOrCreateUnorganized(user);
        unorganized.triggers.push(...group.triggers);
    }

    // Remove group
    user.trigger.triggerGroups.splice(groupIndex, 1);
    await user.save();

    return await interaction.reply({
        content: `✅ Group "${groupName}" deleted. Triggers moved to "Unorganized".`,
        ephemeral: true
    });
}

// ============================================
// BUTTON INTERACTION HANDLER
// ============================================

async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;

    // Handle delete confirmation
    if (customId.startsWith('trigger_delete_confirm_')) {
        const triggerName = customId.replace('trigger_delete_confirm_', '');
        const user = await User.findOne({ discordID: interaction.user.id });

        if (!user) {
            return interaction.update({
                content: '❌ User not found.',
                components: []
            });
        }

        const result = findTrigger(user, triggerName);
        if (!result) {
            return interaction.update({
                content: `❌ Trigger "${triggerName}" not found.`,
                components: []
            });
        }

        const triggerIndex = result.group.triggers.findIndex(t => t.name === triggerName);
        result.group.triggers.splice(triggerIndex, 1);
        await user.save();

        return interaction.update({
            content: `✅ Trigger "${triggerName}" deleted.`,
            components: []
        });
    }

    if (customId === 'trigger_delete_cancel') {
        return interaction.update({
            content: '❌ Deletion cancelled.',
            components: []
        });
    }

    return interaction.reply({
        content: '❌ Unknown button interaction.',
        ephemeral: true
    });
}

// ============================================
// MODAL SUBMIT HANDLER
// ============================================

async function handleModalSubmit(interaction) {
    // Handled inline in handler functions
    return;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function findTrigger(data, triggerName) {
    if (!data.trigger?.triggerGroups) return null;

    for (const group of data.trigger.triggerGroups) {
        const trigger = group.triggers?.find(t => 
            t.name?.toLowerCase() === triggerName.toLowerCase()
        );
        if (trigger) {
            return { trigger, group };
        }
    }
    return null;
}

function getOrCreateUnorganized(user) {
    let unorganized = user.trigger.triggerGroups.find(g => g.name === 'Unorganized');
    if (!unorganized) {
        unorganized = {
            name: 'Unorganized',
            displayName: 'Unorganized',
            triggers: [],
            color: '#808080'
        };
        user.trigger.triggerGroups.push(unorganized);
    }
    return unorganized;
}

function updateTriggerFromModal(trigger, submitted) {
    trigger.name = submitted.fields.getTextInputValue('trigger_name');
    trigger.description = submitted.fields.getTextInputValue('trigger_description');
    const help = submitted.fields.getTextInputValue('trigger_help');
    trigger.help = help || undefined;
}

// ============================================
// MODAL BUILDERS
// ============================================

function buildTriggerModal(trigger, customId) {
    const modal = new ModalBuilder()
        .setCustomId(customId)
        .setTitle(trigger ? 'Edit Trigger' : 'Add Trigger');

    const nameInput = new TextInputBuilder()
        .setCustomId('trigger_name')
        .setLabel('Trigger Name')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

    const descInput = new TextInputBuilder()
        .setCustomId('trigger_description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1024);

    const helpInput = new TextInputBuilder()
        .setCustomId('trigger_help')
        .setLabel('How to Help')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1024);

    if (trigger) {
        nameInput.setValue(trigger.name);
        descInput.setValue(trigger.description);
        if (trigger.help) helpInput.setValue(trigger.help);
    }

    modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(helpInput)
    );

    return modal;
}

// ============================================
// EMBED BUILDERS
// ============================================

function buildTriggerListEmbed(data, avatarUrl, displayName) {
    const hasPremium = data.premium?.active || false;
    const trigger = data.trigger;

    const embed = new EmbedBuilder();
    embed.setColor(trigger.color || '#5865F2');

    if (hasPremium && trigger.title) {
        embed.setTitle(trigger.title);
    } else {
        embed.setTitle(`${displayName}'s Triggers`);
    }

    if (trigger.header?.text) {
        const authorOptions = { name: trigger.header.text };
        if (trigger.header.iconURL) {
            authorOptions.iconURL = trigger.header.iconURL;
        }
        embed.setAuthor(authorOptions);
    }

    if (avatarUrl) {
        embed.setThumbnail(avatarUrl);
    }

    const bullet = trigger.bullet || '-';

    for (const group of trigger.triggerGroups) {
        if (!group.triggers || group.triggers.length === 0) continue;

        const triggerList = group.triggers
            .map(t => `${bullet} **${t.name}**\n  ${t.description}`)
            .join('\n\n');

        embed.addFields({
            name: group.displayName || group.name,
            value: triggerList || 'No triggers',
            inline: false
        });
    }

    if (trigger.footer?.text) {
        const footerOptions = { text: trigger.footer.text };
        if (trigger.footer.iconURL) {
            footerOptions.iconURL = trigger.footer.iconURL;
        }
        embed.setFooter(footerOptions);
    }

    return embed;
}

function buildTriggerEmbed(trigger, group, data, avatarUrl) {
    const embed = new EmbedBuilder()
        .setTitle(trigger.name)
        .setDescription(trigger.description)
        .setColor(group.color || data.trigger?.color || '#5865F2');

    if (trigger.help) {
        embed.addFields({
            name: 'How to Help',
            value: trigger.help,
            inline: false
        });
    }

    embed.addFields({
        name: 'Group',
        value: group.displayName || group.name,
        inline: true
    });

    if (avatarUrl) {
        embed.setThumbnail(avatarUrl);
    }

    return embed;
}