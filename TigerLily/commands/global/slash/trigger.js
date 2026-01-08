// (/trigger)
// (/trigger showlist)
// (/trigger showlist user:[user])
// (/trigger showlist server)
// (/trigger show trigger:[string])
// (/trigger show trigger:[string] user:[user])
// (/trigger show trigger:[string] server)
// (/trigger edit display)
// (/trigger edit trigger:[string])
// (/trigger edit group:[string])
// (/trigger edit grouporder
// (/trigger add trigger:[string])
// (/trigger add trigger:[string] group:[string])
// (/trigger add group:[string])
// (/trigger remove trigger:[string])
// (/trigger remove trigger:[string] group:[string])
// (/trigger remove group:[string])
// (/trigger move trigger:[string] newgroup:[string])

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const User = require('../../schemas/user');
const Guild = require('../../schemas/guild');
const mongoose = require('mongoose');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { trigR2 } = require('../../../../r2');
const crypto = require('crypto');
const config = require('../../../../config.js');

// Store active sessions
const activeSessions = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trigger')
        .setDescription('Manage your triggers')
        .addSubcommand(subcommand =>
            subcommand
                .setName('showlist')
                .setDescription('Show a list of triggers')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Show triggers for a specific user')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('server')
                        .setDescription('Show server triggers')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('Show details of a specific trigger')
                .addStringOption(option =>
                    option.setName('trigger')
                        .setDescription('The trigger name to show')
                        .setRequired(true))
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Show trigger from a specific user')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('server')
                        .setDescription('Show server trigger')
                        .setRequired(false)))
        .addSubcommandGroup(group =>
            group
                .setName('edit')
                .setDescription('Edit triggers or groups')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('display')
                        .setDescription('Edit the display settings of your trigger list'))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('trigger')
                        .setDescription('Edit a specific trigger')
                        .addStringOption(option =>
                            option.setName('name')
                                .setDescription('The trigger name to edit')
                                .setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('group')
                        .setDescription('Edit a trigger group')
                        .addStringOption(option =>
                            option.setName('name')
                                .setDescription('The group name to edit')
                                .setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('grouporder')
                        .setDescription('Reorder trigger groups')))
        .addSubcommandGroup(group =>
            group
                .setName('add')
                .setDescription('Add triggers or groups')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('trigger')
                        .setDescription('Add a new trigger')
                        .addStringOption(option =>
                            option.setName('group')
                                .setDescription('The group to add the trigger to (optional)')
                                .setRequired(false)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('group')
                        .setDescription('Add a new trigger group')))
        .addSubcommandGroup(group =>
            group
                .setName('remove')
                .setDescription('Remove triggers or groups')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('trigger')
                        .setDescription('Remove a trigger')
                        .addStringOption(option =>
                            option.setName('name')
                                .setDescription('The trigger name to remove')
                                .setRequired(true))
                        .addStringOption(option =>
                            option.setName('group')
                                .setDescription('Remove from specific group (moves to Unorganized)')
                                .setRequired(false)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('group')
                        .setDescription('Remove a trigger group')
                        .addStringOption(option =>
                            option.setName('name')
                                .setDescription('The group name to remove')
                                .setRequired(true))))
        .addSubcommand(subcommand =>
            subcommand
                .setName('move')
                .setDescription('Move a trigger to a different group')
                .addStringOption(option =>
                    option.setName('trigger')
                        .setDescription('The trigger name to move')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('newgroup')
                        .setDescription('The group to move the trigger to')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommandGroup = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();

        // Get or create user
        let user = await User.findOne({ discordId: interaction.user.id });
        let isNewUser = false;

        if (!user) {
            isNewUser = true;
            user = await createNewUser(interaction.user.id);

            const welcomeEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Welcome! 🎉')
                .setDescription('Welcome to our bot! You can now create your triggers using `/trigger add trigger`.')
                .setTimestamp();

            await interaction.reply({ embeds: [welcomeEmbed], ephemeral: true });
            return;
        }

        // Initialize Unorganized group if no trigger groups exist
        if (!user.trigger.triggerGroups || user.trigger.triggerGroups.length === 0) {
            user.trigger.triggerGroups = [{
                name: 'Unorganized',
                displayName: 'Unorganized',
                triggers: [],
                color: '#808080'
            }];
            await user.save();
        }

        // Route to appropriate handler
        if (subcommand === 'showlist') {
            await handleShowList(interaction, user);
        } else if (subcommand === 'show') {
            await handleShow(interaction, user);
        } else if (subcommandGroup === 'edit') {
            await handleEdit(interaction, user, subcommand);
        } else if (subcommandGroup === 'add') {
            await handleAdd(interaction, user, subcommand);
        } else if (subcommandGroup === 'remove') {
            await handleRemove(interaction, user, subcommand);
        } else if (subcommand === 'move') {
            await handleMove(interaction, user);
        }
    },
};

async function createNewUser(discordId) {
    const user = new User({
        _id: new mongoose.Types.ObjectId(),
        discordId: discordId,
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

// SHOW LISTS
async function handleShowList(interaction, currentUser) {
    const specifiedUser = interaction.options.getUser('user');
    const isServer = interaction.options.getBoolean('server');

    let targetData, targetType, targetAvatar, targetName;

    if (isServer) {
        // Show server triggers
        const guild = await Guild.findOne({ discordId: interaction.guildId });
        if (!guild || !guild.trigger?.triggerGroups || guild.trigger.triggerGroups.length === 0) {
            return await interaction.reply({
                content: '❌ There are no triggers listed for this server.',
                ephemeral: true
            });
        }
        targetData = guild;
        targetType = 'server';
        targetAvatar = interaction.guild.iconURL({ dynamic: true });
        targetName = interaction.guild.name;
    } else if (specifiedUser) {
        // Show specified user's triggers
        const user = await User.findOne({ discordId: specifiedUser.id });
        if (!user || !user.trigger?.triggerGroups || user.trigger.triggerGroups.length === 0) {
            return await interaction.reply({
                content: `❌ ${specifiedUser.username} does not have triggers they are willing to display.`,
                ephemeral: true
            });
        }
        targetData = user;
        targetType = 'user';
        targetAvatar = specifiedUser.displayAvatarURL({ dynamic: true });
        targetName = specifiedUser.username;
    } else {
        // Show current user's triggers
        targetData = currentUser;
        targetType = 'user';
        targetAvatar = interaction.user.displayAvatarURL({ dynamic: true });
        targetName = interaction.user.username;
    }

    const embed = buildTriggerListEmbed(targetData, targetAvatar, targetName);
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// SHOW SPECIFIC TRIGGER
async function handleShow(interaction, currentUser) {
    const triggerName = interaction.options.getString('trigger');
    const specifiedUser = interaction.options.getUser('user');
    const isServer = interaction.options.getBoolean('server');

    let targetData, targetAvatar;

    if (isServer) {
        const guild = await Guild.findOne({ discordId: interaction.guildId });
        if (!guild) {
            return await interaction.reply({
                content: '❌ Trigger not found in server triggers.',
                ephemeral: true
            });
        }
        targetData = guild;
        targetAvatar = interaction.guild.iconURL({ dynamic: true });
    } else if (specifiedUser) {
        const user = await User.findOne({ discordId: specifiedUser.id });
        if (!user) {
            return await interaction.reply({
                content: `❌ Trigger not found for ${specifiedUser.username}.`,
                ephemeral: true
            });
        }
        targetData = user;
        targetAvatar = specifiedUser.displayAvatarURL({ dynamic: true });
    } else {
        targetData = currentUser;
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

// EDIT HANDLERS
async function handleEdit(interaction, user, subcommand) {
    const hasPremium = user.premium?.active || false;

    if (subcommand === 'display') {
        await handleEditDisplay(interaction, user, hasPremium);
    } else if (subcommand === 'trigger') {
        await handleEditTrigger(interaction, user);
    } else if (subcommand === 'group') {
        await handleEditGroup(interaction, user, hasPremium);
    } else if (subcommand === 'grouporder') {
        await handleEditGroupOrder(interaction, user);
    }
}

async function handleEditDisplay(interaction, user, hasPremium) {
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
        .setMaxLength(7);

    if (user.trigger?.color) {
        colorInput.setValue(user.trigger.color);
    }

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
            .setMaxLength(256);

        if (user.trigger?.title) {
            titleInput.setValue(user.trigger.title);
        }

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

async function handleEditTrigger(interaction, user) {
    const triggerName = interaction.options.getString('name');
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

        const embed = buildTriggerEmbed(result.trigger, result.group, user, interaction.user.displayAvatarURL({ dynamic: true }));
        const buttons = buildEditSaveButtons();

        await submitted.reply({ embeds: [embed], components: [buttons], ephemeral: true });

        const collector = submitted.channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 180000
        });

        collector.on('collect', async i => {
            if (i.customId === 'edit_trigger') {
                const modal = buildTriggerModal(result.trigger, 'edit_trigger_modal_2');
                await i.showModal(modal);

                try {
                    const submitted2 = await i.awaitModalSubmit({
                        filter: i2 => i2.user.id === interaction.user.id,
                        time: 180000
                    });

                    updateTriggerFromModal(result.trigger, submitted2);
                    const newEmbed = buildTriggerEmbed(result.trigger, result.group, user, interaction.user.displayAvatarURL({ dynamic: true }));
                    await submitted2.update({ embeds: [newEmbed], components: [buttons] });

                } catch (error) {
                    if (!error.message.includes('time')) {
                        console.error('Error in edit trigger modal:', error);
                    }
                }
            } else if (i.customId === 'save_trigger') {
                await user.save();
                await i.reply({ content: '✅ Trigger saved!', ephemeral: true });
            }
        });

    } catch (error) {
        if (!error.message.includes('time')) {
            console.error('Error in handleEditTrigger:', error);
        }
    }
}

async function handleEditGroup(interaction, user, hasPremium) {
    const groupName = interaction.options.getString('name');
    const group = user.trigger.triggerGroups.find(g => g.name === groupName);

    if (!group) {
        return await interaction.reply({
            content: `❌ Group "${groupName}" not found.`,
            ephemeral: true
        });
    }

    const modal = buildGroupModal(group, 'edit_group_modal');
    await interaction.showModal(modal);

    try {
        const submitted = await interaction.awaitModalSubmit({
            filter: i => i.user.id === interaction.user.id,
            time: 180000
        });

        updateGroupFromModal(group, submitted);

        const embed = buildGroupEmbed(group, user, interaction.user.displayAvatarURL({ dynamic: true }));
        const buttons = hasPremium ? buildGroupEditButtons() : buildEditSaveButtons();

        await submitted.reply({ embeds: [embed], components: [buttons], ephemeral: true });

        const collector = submitted.channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 180000
        });

        collector.on('collect', async i => {
            if (i.customId === 'edit_group') {
                const modal = buildGroupModal(group, 'edit_group_modal_2');
                await i.showModal(modal);

                try {
                    const submitted2 = await i.awaitModalSubmit({
                        filter: i2 => i2.user.id === interaction.user.id,
                        time: 180000
                    });

                    updateGroupFromModal(group, submitted2);
                    const newEmbed = buildGroupEmbed(group, user, interaction.user.displayAvatarURL({ dynamic: true }));
                    await submitted2.update({ embeds: [newEmbed], components: [buttons] });

                } catch (error) {
                    if (!error.message.includes('time')) {
                        console.error('Error in edit group modal:', error);
                    }
                }
            } else if (i.customId === 'add_banner') {
                await handleGroupBannerUpload(i, user, group);
            } else if (i.customId === 'save_group') {
                await user.save();
                await i.reply({ content: '✅ Group saved!', ephemeral: true });
            }
        });

    } catch (error) {
        if (!error.message.includes('time')) {
            console.error('Error in handleEditGroup:', error);
        }
    }
}

async function handleEditGroupOrder(interaction, user) {
    const groupNames = user.trigger.triggerGroups.map(g => g.name).join('\n');

    const modal = new ModalBuilder()
        .setCustomId('edit_grouporder_modal')
        .setTitle('Reorder Trigger Groups');

    const orderInput = new TextInputBuilder()
        .setCustomId('group_order')
        .setLabel('Group names (one per line, in desired order)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setValue(groupNames);

    modal.addComponents(new ActionRowBuilder().addComponents(orderInput));

    await interaction.showModal(modal);

    try {
        const submitted = await interaction.awaitModalSubmit({
            filter: i => i.user.id === interaction.user.id,
            time: 180000
        });

        const newOrder = submitted.fields.getTextInputValue('group_order')
            .split('\n')
            .map(name => name.trim())
            .filter(name => name.length > 0);

        // Validate all groups are included
        const originalNames = user.trigger.triggerGroups.map(g => g.name).sort();
        const newNames = [...newOrder].sort();

        if (JSON.stringify(originalNames) !== JSON.stringify(newNames)) {
            return await submitted.reply({
                content: '❌ Error: All groups must be included in the new order. Please try again.',
                ephemeral: true
            });
        }

        // Reorder groups
        const reorderedGroups = newOrder.map(name =>
            user.trigger.triggerGroups.find(g => g.name === name)
        );

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

// ADD HANDLERS
async function handleAdd(interaction, user, subcommand) {
    if (subcommand === 'trigger') {
        await handleAddTrigger(interaction, user);
    } else if (subcommand === 'group') {
        await handleAddGroup(interaction, user);
    }
}

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
            help: submitted.fields.getTextInputValue('trigger_help')
        };

        let targetGroup;
        let addMessage = '';

        if (groupName) {
            targetGroup = user.trigger.triggerGroups.find(g => g.name === groupName);
            if (targetGroup) {
                targetGroup.triggers.push(newTrigger);
                addMessage = `✅ Trigger added to group "${groupName}".`;
            } else {
                // Group not found, add to Unorganized
                const unorganized = getOrCreateUnorganized(user);
                unorganized.triggers.push(newTrigger);
                addMessage = `⚠️ Group "${groupName}" not found. Trigger added to "Unorganized".`;
                targetGroup = unorganized;
            }
        } else {
            // No group specified, add to Unorganized
            const unorganized = getOrCreateUnorganized(user);
            unorganized.triggers.push(newTrigger);
            addMessage = `✅ Trigger added to "Unorganized".`;
            targetGroup = unorganized;
        }

        const embed = buildTriggerEmbed(newTrigger, targetGroup, user, interaction.user.displayAvatarURL({ dynamic: true }));
        const buttons = buildEditSaveButtons();

        await submitted.reply({ content: addMessage, embeds: [embed], components: [buttons], ephemeral: true });

        const collector = submitted.channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 180000
        });

        collector.on('collect', async i => {
            if (i.customId === 'edit_trigger') {
                const modal = buildTriggerModal(newTrigger, 'edit_trigger_modal');
                await i.showModal(modal);

                try {
                    const submitted2 = await i.awaitModalSubmit({
                        filter: i2 => i2.user.id === interaction.user.id,
                        time: 180000
                    });

                    updateTriggerFromModal(newTrigger, submitted2);
                    const newEmbed = buildTriggerEmbed(newTrigger, targetGroup, user, interaction.user.displayAvatarURL({ dynamic: true }));
                    await submitted2.update({ embeds: [newEmbed], components: [buttons] });

                } catch (error) {
                    if (!error.message.includes('time')) {
                        console.error('Error in edit trigger modal:', error);
                    }
                }
            } else if (i.customId === 'save_trigger') {
                await user.save();
                await i.reply({ content: '✅ Trigger saved!', ephemeral: true });
            }
        });

    } catch (error) {
        if (!error.message.includes('time')) {
            console.error('Error in handleAddTrigger:', error);
        }
    }
}

async function handleAddGroup(interaction, user) {
    const modal = buildGroupModal(null, 'add_group_modal');
    await interaction.showModal(modal);

    try {
        const submitted = await interaction.awaitModalSubmit({
            filter: i => i.user.id === interaction.user.id,
            time: 180000
        });

        const newGroup = {
            name: submitted.fields.getTextInputValue('group_name'),
            displayName: submitted.fields.getTextInputValue('group_displayname'),
            color: submitted.fields.getTextInputValue('group_color') || '#808080',
            triggers: []
        };

        user.trigger.triggerGroups.push(newGroup);

        const embed = buildGroupEmbed(newGroup, user, interaction.user.displayAvatarURL({ dynamic: true }));
        const buttons = buildEditSaveButtons();

        await submitted.reply({ embeds: [embed], components: [buttons], ephemeral: true });

        const collector = submitted.channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 180000
        });

        collector.on('collect', async i => {
            if (i.customId === 'edit_group') {
                const modal = buildGroupModal(newGroup, 'edit_group_modal');
                await i.showModal(modal);

                try {
                    const submitted2 = await i.awaitModalSubmit({
                        filter: i2 => i2.user.id === interaction.user.id,
                        time: 180000
                    });

                    updateGroupFromModal(newGroup, submitted2);
                    const newEmbed = buildGroupEmbed(newGroup, user, interaction.user.displayAvatarURL({ dynamic: true }));
                    await submitted2.update({ embeds: [newEmbed], components: [buttons] });

                } catch (error) {
                    if (!error.message.includes('time')) {
                        console.error('Error in edit group modal:', error);
                    }
                }
            } else if (i.customId === 'save_group') {
                await user.save();
                await i.reply({ content: '✅ Group saved!', ephemeal: true });
            }
        });

    } catch (error) {
        if (!error.message.includes('time')) {
            console.error('Error in handleAddGroup:', error);
        }
    }
}

// REMOVE HANDLERS
async function handleRemove(interaction, user, subcommand) {
    if (subcommand === 'trigger') {
        await handleRemoveTrigger(interaction, user);
    } else if (subcommand === 'group') {
        await handleRemoveGroup(interaction, user);
    }
}

async function handleRemoveTrigger(interaction, user) {
    const triggerName = interaction.options.getString('name');
    const groupName = interaction.options.getString('group');

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
        // Delete trigger completely - ask for confirmation
        const result = findTrigger(user, triggerName);
        if (!result) {
            return await interaction.reply({
                content: `❌ Trigger "${triggerName}" not found.`,
                ephemeral: true
            });
        }

        const confirmButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_delete_trigger')
                    .setLabel('Confirm Delete')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_delete')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.reply({
            content: `⚠️ Are you sure you want to delete the trigger "${triggerName}"? This cannot be undone.`,
            components: [confirmButton],
            ephemeral: true
        });

        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 180000,
            max: 1
        });

        collector.on('collect', async i => {
            if (i.customId === 'confirm_delete_trigger') {
                const triggerIndex = result.group.triggers.findIndex(t => t.name === triggerName);
                result.group.triggers.splice(triggerIndex, 1);
                await user.save();
                await i.update({
                    content: `✅ Trigger "${triggerName}" deleted.`,
                    components: []
                });
            } else {
                await i.update({
                    content: '❌ Deletion cancelled.',
                    components: []
                });
            }
        });
    }
}

async function handleRemoveGroup(interaction, user) {
    const groupName = interaction.options.getString('name');
    const group = user.trigger.triggerGroups.find(g => g.name === groupName);

    if (!group) {
        return await interaction.reply({
            content: `❌ Group "${groupName}" not found.`,
            ephemeral: true
        });
    }

    const confirmButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('delete_group_and_triggers')
                .setLabel('Delete Group & Triggers')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('delete_group_keep_triggers')
                .setLabel('Delete Group (Keep Triggers)')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('cancel_delete')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
        );

    await interaction.reply({
        content: `⚠️ What would you like to do with the group "${groupName}"?`,
        components: [confirmButtons],
        ephemeral: true
    });

    const collector = interaction.channel.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 180000,
        max: 1
    });

    collector.on('collect', async i => {
        if (i.customId === 'delete_group_and_triggers') {
            // Ask for final confirmation
            const finalConfirm = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('final_confirm_delete')
                        .setLabel('Yes, Delete Everything')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('cancel_delete')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary)
                );

            await i.update({
                content: `⚠️ **FINAL CONFIRMATION**: Delete group "${groupName}" and all ${group.triggers.length} triggers? This cannot be undone.`,
                components: [finalConfirm]
            });

            const finalCollector = interaction.channel.createMessageComponentCollector({
                filter: i2 => i2.user.id === interaction.user.id,
                time: 180000,
                max: 1
            });

            finalCollector.on('collect', async i2 => {
                if (i2.customId === 'final_confirm_delete') {
                    const groupIndex = user.trigger.triggerGroups.findIndex(g => g.name === groupName);
                    user.trigger.triggerGroups.splice(groupIndex, 1);
                    await user.save();
                    await i2.update({
                        content: `✅ Group "${groupName}" and all its triggers deleted.`,
                        components: []
                    });
                } else {
                    await i2.update({
                        content: '❌ Deletion cancelled.',
                        components: []
                    });
                }
            });

        } else if (i.customId === 'delete_group_keep_triggers') {
            // Move triggers to Unorganized
            const unorganized = getOrCreateUnorganized(user);
            unorganized.triggers.push(...group.triggers);

            const groupIndex = user.trigger.triggerGroups.findIndex(g => g.name === groupName);
            user.trigger.triggerGroups.splice(groupIndex, 1);

            await user.save();
            await i.update({
                content: `✅ Group "${groupName}" deleted. ${group.triggers.length} triggers moved to "Unorganized".`,
                components: []
            });
        } else {
            await i.update({
                content: '❌ Deletion cancelled.',
                components: []
            });
        }
    });
}

// MOVE
async function handleMove(interaction, user) {
    const triggerName = interaction.options.getString('trigger');
    const newGroupName = interaction.options.getString('newgroup');

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
    await interaction.reply({
        content: `✅ Trigger "${triggerName}" moved from "${result.group.name}" to "${newGroupName}".`,
        ephemeral: true
    });
}

// BANNER UPLOADS
async function handleGroupBannerUpload(interaction, user, group) {
    await interaction.reply({
        content: '📸 Please send an image for the group banner (or type "skip" to cancel).\n\n⚠️ Image must be under 8MB.',
        ephemeral: true
    });

    const sessionId = `${interaction.user.id}-${Date.now()}`;
    activeSessions.set(interaction.user.id, {
        id: sessionId,
        type: 'banner',
        interaction: interaction,
        user: user,
        group: group
    });

    const filter = m => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({
        filter,
        max: 1,
        time: 180000
    });

    collector.on('collect', async message => {
        try {
            await message.delete().catch(() => {});

            if (message.content.toLowerCase() === 'skip') {
                activeSessions.delete(interaction.user.id);
                return await interaction.followUp({
                    content: '❌ Banner upload cancelled.',
                    ephemeral: true
                });
            }

            if (message.attachments.size === 0) {
                activeSessions.delete(interaction.user.id);
                return await interaction.followUp({
                    content: '❌ Please send an image.',
                    ephemeral: true
                });
            }

            const attachment = message.attachments.first();

            if (attachment.size > 8 * 1024 * 1024) {
                activeSessions.delete(interaction.user.id);
                return await interaction.followUp({
                    content: '❌ Image must be under 8MB.',
                    ephemeral: true
                });
            }

            if (!attachment.contentType?.startsWith('image/')) {
                activeSessions.delete(interaction.user.id);
                return await interaction.followUp({
                    content: '❌ Please send a valid image file.',
                    ephemeral: true
                });
            }

            const mediaData = await uploadToR2(attachment, 'trigger-banners');
            group.banner = mediaData;

            activeSessions.delete(interaction.user.id);

            const embed = buildGroupEmbed(group, user, interaction.user.displayAvatarURL({ dynamic: true }));
            await interaction.followUp({
                content: '✅ Banner uploaded!',
                embeds: [embed],
                ephemeral: true
            });

        } catch (error) {
            console.error('Error uploading banner:', error);
            activeSessions.delete(interaction.user.id);
            await interaction.followUp({
                content: '❌ Error uploading banner.',
                ephemeral: true
            });
        }
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time') {
            activeSessions.delete(interaction.user.id);
        }
    });
}

async function uploadToR2(attachment, folder = 'triggers') {
    try {
        const response = await fetch(attachment.url);
        const buffer = Buffer.from(await response.arrayBuffer());

        const hash = crypto.randomBytes(16).toString('hex');
        const ext = attachment.name.split('.').pop();
        const r2Key = `${folder}/${hash}.${ext}`;

        const command = new PutObjectCommand({
            Bucket: config.r2.trigin.bucketName,
            Key: r2Key,
            Body: buffer,
            ContentType: attachment.contentType,
        });

        await trigR2.send(command);

        const publicUrl = `${config.r2.trigin.publicURL}/${r2Key}`;

        return {
            r2Key: r2Key,
            url: publicUrl,
            filename: attachment.name,
            mimeType: attachment.contentType,
            size: attachment.size,
            uploadedAt: new Date()
        };

    } catch (error) {
        console.error('Error uploading to R2:', error);
        throw error;
    }
}

// FIND + GET
function findTrigger(data, triggerName) {
    for (const group of data.trigger.triggerGroups) {
        const trigger = group.triggers.find(t => t.name === triggerName);
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

// BUILD EMBEDS
function buildTriggerListEmbed(data, avatarUrl, displayName) {
    const hasPremium = data.premium?.active || false;
    const trigger = data.trigger;

    const embed = new EmbedBuilder();

    // Color
    embed.setColor(trigger.color || '#0099ff');

    // Title
    if (hasPremium && trigger.title) {
        embed.setTitle(trigger.title);
    } else {
        embed.setTitle(`${displayName}'s Triggers`);
    }

    // Author/Header
    if (trigger.header?.text) {
        const authorOptions = { name: trigger.header.text };
        if (trigger.header.icon?.url) {
            authorOptions.iconURL = trigger.header.icon.url;
        } else {
            authorOptions.iconURL = avatarUrl;
        }
        embed.setAuthor(authorOptions);
    } else {
        embed.setAuthor({
            name: displayName,
            iconURL: avatarUrl
        });
    }

    // Footer
    if (trigger.footer?.text) {
        const footerOptions = { text: trigger.footer.text };
        if (trigger.footer.icon?.url) {
            footerOptions.iconURL = trigger.footer.icon.url;
        }
        embed.setFooter(footerOptions);
    }

    // Thumbnail
    if (trigger.thumbnail?.url) {
        embed.setThumbnail(trigger.thumbnail.url);
    }

    // Banner
    if (hasPremium && trigger.banner?.url) {
        embed.setImage(trigger.banner.url);
    }

    // Build trigger list
    const bullet = trigger.bullet || '-';
    const unorganized = trigger.triggerGroups.find(g => g.name === 'Unorganized');
    const organizedGroups = trigger.triggerGroups.filter(g => g.name !== 'Unorganized');

    // Add unorganized triggers to description
    let description = '';
    if (unorganized && unorganized.triggers.length > 0) {
        description = unorganized.triggers
            .map(t => `${bullet} ||${t.name}||`)
            .join('\n');
    }

    if (description) {
        embed.setDescription(description);
    }

    // Add organized groups as fields
    for (const group of organizedGroups) {
        if (group.triggers.length > 0) {
            const fieldValue = group.triggers
                .map(t => `${bullet} ||${t.name}||`)
                .join('\n');

            embed.addFields({
                name: group.displayName || group.name,
                value: fieldValue,
                inline: false
            });
        }
    }

    return embed;
}

function buildTriggerEmbed(trigger, group, data, avatarUrl) {
    const embed = new EmbedBuilder();

    // Color from group, fallback to trigger list color
    embed.setColor(group.color || data.trigger.color || '#0099ff');

    // Title (spoilered)
    embed.setTitle(`||${trigger.name}||`);

    // Description (spoilered)
    if (trigger.description) {
        embed.setDescription(`||${trigger.description}||`);
    }

    // Help field
    if (trigger.help) {
        embed.addFields({
            name: 'How to Help',
            value: trigger.help,
            inline: false
        });
    }

    // Header icon
    const headerIcon = data.trigger.header?.icon?.url || avatarUrl;
    if (data.trigger.header?.text) {
        embed.setAuthor({
            name: data.trigger.header.text,
            iconURL: headerIcon
        });
    } else {
        embed.setAuthor({
            name: 'Trigger',
            iconURL: headerIcon
        });
    }

    // Banner from group
    if (group.banner?.url) {
        embed.setImage(group.banner.url);
    }

    return embed;
}

function buildGroupEmbed(group, data, avatarUrl) {
    const embed = new EmbedBuilder();

    embed.setColor(group.color || '#808080');
    embed.setTitle(group.displayName || group.name);

    const bullet = data.trigger.bullet || '-';
    if (group.triggers.length > 0) {
        const description = group.triggers
            .map(t => `${bullet} ||${t.name}||`)
            .join('\n');
        embed.setDescription(description);
    } else {
        embed.setDescription('*No triggers in this group*');
    }

    // Header icon
    const headerIcon = data.trigger.header?.icon?.url || avatarUrl;
    if (data.trigger.header?.text) {
        embed.setAuthor({
            name: data.trigger.header.text,
            iconURL: headerIcon
        });
    }

    // Banner
    if (group.banner?.url) {
        embed.setImage(group.banner.url);
    }

    return embed;
}

// BUILD FORM MODALS
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

function buildGroupModal(group, customId) {
    const modal = new ModalBuilder()
        .setCustomId(customId)
        .setTitle(group ? 'Edit Group' : 'Add Group');

    const nameInput = new TextInputBuilder()
        .setCustomId('group_name')
        .setLabel('Group Name (internal identifier)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(50);

    const displayNameInput = new TextInputBuilder()
        .setCustomId('group_displayname')
        .setLabel('Display Name)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

    const colorInput = new TextInputBuilder()
        .setCustomId('group_color')
        .setLabel('Color (hex)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

    if (group) {
        nameInput.setValue(group.name);
        displayNameInput.setValue(group.displayName || group.name);
        if (group.color) colorInput.setValue(group.color);
    }

    modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(displayNameInput),
        new ActionRowBuilder().addComponents(colorInput)
    );

    return modal;
}

// FORM MODAL UPDATES
function updateTriggerFromModal(trigger, interaction) {
    trigger.name = interaction.fields.getTextInputValue('trigger_name');
    trigger.description = interaction.fields.getTextInputValue('trigger_description');
    const help = interaction.fields.getTextInputValue('trigger_help');
    if (help) trigger.help = help;
}

function updateGroupFromModal(group, interaction) {
    group.name = interaction.fields.getTextInputValue('group_name');
    group.displayName = interaction.fields.getTextInputValue('group_displayname');
    const color = interaction.fields.getTextInputValue('group_color');
    if (color) group.color = color;
}

// BUTTON BUILDERS
function buildEditSaveButtons() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('edit_trigger')
                .setLabel('Edit')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✏️'),
            new ButtonBuilder()
                .setCustomId('save_trigger')
                .setLabel('Save')
                .setStyle(ButtonStyle.Success)
                .setEmoji('💾')
        );
}

function buildGroupEditButtons() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('edit_group')
                .setLabel('Edit')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✏️'),
            new ButtonBuilder()
                .setCustomId('add_banner')
                .setLabel('Add Banner')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🖼️'),
            new ButtonBuilder()
                .setCustomId('save_group')
                .setLabel('Save')
                .setStyle(ButtonStyle.Success)
                .setEmoji('💾')
        );
}