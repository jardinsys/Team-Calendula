// (/system) - Systemiser System Management Command
// Uses shared utilities from systemiser-utils.js

// (/system)
// (/system show) (click button to show all info in ephemeral)
// (/system show user:[@user] userID:[string])
// (/system edit)
// (/system settings)

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

const System = require('../../schemas/system');
const User = require('../../schemas/user');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');

// Import shared utilities
const utils = require('./systemiser-utils');

// Use DSM and ICD types from utils
const { DSM_TYPES, ICD_TYPES, ENTITY_COLORS, getSystemEmbedColor } = utils;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('system')
        .setDescription('Manage your system')
        .addSubcommand(sub => sub
            .setName('menu')
            .setDescription('Open the system management menu'))
        .addSubcommand(sub => sub
            .setName('show')
            .setDescription('Show system details')
            .addUserOption(opt => opt
                .setName('user')
                .setDescription('Show system for a specific user'))
            .addStringOption(opt => opt
                .setName('userid')
                .setDescription('Discord User ID (for users outside the server)')))
        .addSubcommand(sub => sub
            .setName('edit')
            .setDescription('Edit your system'))
        .addSubcommand(sub => sub
            .setName('settings')
            .setDescription('Open system settings')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const { user, system, isNew } = await utils.getOrCreateUserAndSystem(interaction);

        // Handle new users
        if (isNew) {
            return await utils.handleNewUserFlow(interaction, 'system');
        }

        // Check for system (except for viewing commands)
        if (!system && subcommand !== 'show') {
            return await interaction.reply({
                content: '❌ You need to set up a system first. Use the buttons below to get started.',
                ephemeral: true
            });
        }

        // Route to appropriate handler
        const handlers = {
            menu: handleMenu,
            show: handleShow,
            edit: handleEdit,
            settings: handleSettings
        };

        await handlers[subcommand](interaction, user, system);
    },

    // Export interaction handlers for bot.js
    handleButtonInteraction,
    handleModalSubmit,
    handleSelectMenu
};

// ============================================
// EMBED BUILDERS
// ============================================

/**
 * Build the system card embed
 */
async function buildSystemCard(system, privacyBucket, closedCharAllowed = true, showFull = false) {
    const embed = new EmbedBuilder();

    // Get display values - system.color or none
    const color = getSystemEmbedColor(system);
    const description = utils.getDiscordOrDefault(system, 'description');
    const displayName = closedCharAllowed
        ? (system.name?.display || system.name?.indexable)
        : (system.name?.closedNameDisplay || system.name?.display || system.name?.indexable);

    // Header/Author
    const avatar = system.discord?.image?.avatar?.url || system.avatar?.url;

    embed.setAuthor({
        name: system.name?.indexable || 'Unknown System',
        iconURL: avatar || undefined
    });

    embed.setTitle(displayName || 'Unknown System');
    if (color) embed.setColor(color);

    if (description) {
        embed.setDescription(description);
    }

    // Get counts
    const alterCount = system.alters?.IDs?.length || 0;
    const stateCount = system.states?.IDs?.length || 0;
    const groupCount = system.groups?.IDs?.length || 0;

    // Basic Info field
    let basicInfo = '';
    basicInfo += `**${system.alterSynonym?.plural || 'Alters'}:** ${alterCount}\n`;
    basicInfo += `**States:** ${stateCount}\n`;
    basicInfo += `**Groups:** ${groupCount}\n`;

    if (system.birthday) {
        basicInfo += `**Birthday:** ${utils.formatDate(system.birthday)}\n`;
    }
    if (system.timezone) {
        basicInfo += `**Timezone:** ${system.timezone}\n`;
    }

    embed.addFields({
        name: '📊 Overview',
        value: basicInfo.trim() || 'No info',
        inline: false
    });

    // System Type field
    let typeInfo = '';
    if (system.sys_type?.name && system.sys_type.name !== 'None') {
        typeInfo += `**Type:** ${system.sys_type.name}\n`;
    }
    if (system.sys_type?.dd?.DSM) {
        typeInfo += `**DSM:** ${system.sys_type.dd.DSM}\n`;
    }
    if (system.sys_type?.dd?.ICD) {
        typeInfo += `**ICD:** ${system.sys_type.dd.ICD}\n`;
    }
    if (system.sys_type?.isSystem !== undefined) {
        typeInfo += `**Is a system:** ${system.sys_type.isSystem ? 'Yes' : 'No'}\n`;
    }

    if (typeInfo) {
        embed.addFields({
            name: '🏷️ System Type',
            value: typeInfo.trim(),
            inline: false
        });
    }

    // Terminology field
    if (system.alterSynonym?.singular || system.alterSynonym?.plural) {
        let termInfo = '';
        if (system.alterSynonym.singular) {
            termInfo += `**Singular:** ${system.alterSynonym.singular}\n`;
        }
        if (system.alterSynonym.plural) {
            termInfo += `**Plural:** ${system.alterSynonym.plural}\n`;
        }
        embed.addFields({
            name: '📝 Terminology',
            value: termInfo.trim(),
            inline: true
        });
    }

    // Front Status field
    if (system.front?.status || system.front?.caution) {
        let frontInfo = '';
        if (system.front.status) {
            frontInfo += `**Status:** ${system.front.status}\n`;
        }
        if (system.front.caution) {
            frontInfo += `**Caution:** ${system.front.caution}\n`;
        }
        embed.addFields({
            name: '🎭 Current Front',
            value: frontInfo.trim(),
            inline: true
        });
    }

    // Battery/Social Battery
    if (system.battery !== undefined && system.battery !== null) {
        embed.addFields({
            name: '🔋 Social Battery',
            value: `${system.battery}%`,
            inline: true
        });
    }

    // Caution field
    if (system.caution && (system.caution.c_type || system.caution.detail || system.caution.triggers?.length > 0)) {
        let cautionInfo = '';

        if (system.caution.c_type) {
            cautionInfo += `**Type:** ${system.caution.c_type}\n`;
        }
        if (system.caution.detail) {
            cautionInfo += `**Details:** ${system.caution.detail}\n`;
        }
        if (system.caution.triggers?.length > 0) {
            const triggerNames = system.caution.triggers.map(t => t.name).filter(Boolean);
            if (triggerNames.length > 0) {
                cautionInfo += `**Triggers:** ${triggerNames.join(', ')}\n`;
            }
        }

        if (cautionInfo) {
            embed.addFields({
                name: '⚠️ Caution',
                value: cautionInfo.trim(),
                inline: false
            });
        }
    }

    // Show additional info if full view
    if (showFull) {
        // Metadata
        let metadataInfo = '';
        if (system.metadata?.joinedAt) {
            metadataInfo += `**Joined:** ${utils.formatDate(system.metadata.joinedAt)}\n`;
        }
        if (system.proxy?.lastProxyTime) {
            metadataInfo += `**Last Proxy:** ${utils.formatDate(system.proxy.lastProxyTime)}\n`;
        }

        if (metadataInfo) {
            embed.addFields({
                name: '📅 Metadata',
                value: metadataInfo.trim(),
                inline: false
            });
        }

        // Proxy Settings (owner only)
        let proxyInfo = '';
        if (system.proxy?.layout) {
            proxyInfo += `**Layout:** \`${system.proxy.layout}\`\n`;
        }
        if (system.proxy?.style) {
            proxyInfo += `**Style:** ${system.proxy.style}\n`;
        }
        if (system.proxy?.break !== undefined) {
            proxyInfo += `**On Break:** ${system.proxy.break ? 'Yes' : 'No'}\n`;
        }

        if (proxyInfo) {
            embed.addFields({
                name: '💬 Proxy Settings',
                value: proxyInfo.trim(),
                inline: false
            });
        }

        // Privacy Buckets
        if (system.privacyBuckets?.length > 0) {
            const bucketNames = system.privacyBuckets.map(b => b.name).join(', ');
            embed.addFields({
                name: '🔒 Privacy Buckets',
                value: bucketNames,
                inline: false
            });
        }
    }

    // Thumbnail/Avatar
    if (avatar) {
        embed.setThumbnail(avatar);
    }

    // Banner
    const banner = system.discord?.image?.banner?.url;
    if (banner) {
        embed.setImage(banner);
    }

    return embed;
}

/**
 * Build the edit interface for a system
 */
function buildEditInterface(system, session) {
    const embed = new EmbedBuilder()
        .setTitle(`Editing: ${utils.getDisplayName(system)}`)
        .setDescription(session.mode
            ? `Currently in **${session.mode.toUpperCase()} MODE**\n\nSelect what you would like to edit.`
            : 'Select what you would like to edit from the dropdown menu below.'
        );

    // Use system color if available
    const color = getSystemEmbedColor(system);
    if (color) embed.setColor(color);

    // Edit options dropdown
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`system_edit_select_${session.id}`)
        .setPlaceholder('Choose what to edit...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Card Info')
                .setDescription('Edit name, description, color')
                .setValue('card_info')
                .setEmoji('🎴'),
            new StringSelectMenuOptionBuilder()
                .setLabel('System Type')
                .setDescription('Edit system type (DSM/ICD classification)')
                .setValue('type_info')
                .setEmoji('🏷️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Terminology')
                .setDescription('Edit alter synonyms')
                .setValue('terminology_info')
                .setEmoji('📝'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Personal Info')
                .setDescription('Edit birthday, timezone')
                .setValue('personal_info')
                .setEmoji('👤'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Image Info')
                .setDescription('Edit avatar and banner URLs')
                .setValue('image_info')
                .setEmoji('🖼️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Caution Info')
                .setDescription('Edit caution type, details, and triggers')
                .setValue('caution_info')
                .setEmoji('⚠️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Proxy Settings')
                .setDescription('Edit proxy layout and style')
                .setValue('proxy_info')
                .setEmoji('💬'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Front Status')
                .setDescription('Edit current front status and caution')
                .setValue('front_info')
                .setEmoji('🎭')
        );

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    // Mode toggle buttons
    const modeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`system_edit_mode_mask_${session.id}`)
            .setLabel(session.mode === 'mask' ? 'Exit Mask Mode' : 'Enter Mask Mode')
            .setStyle(session.mode === 'mask' ? ButtonStyle.Danger : ButtonStyle.Secondary)
            .setEmoji('🎭'),
        new ButtonBuilder()
            .setCustomId(`system_edit_mode_server_${session.id}`)
            .setLabel(session.mode === 'server' ? 'Exit Server Mode' : 'Enter Server Mode')
            .setStyle(session.mode === 'server' ? ButtonStyle.Danger : ButtonStyle.Secondary)
            .setEmoji('🏠')
    );

    // Action buttons
    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`system_edit_settings_${session.id}`)
            .setLabel('System Settings')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⚙️'),
        new ButtonBuilder()
            .setCustomId(`system_edit_conditions_${session.id}`)
            .setLabel('Conditions')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📋'),
        new ButtonBuilder()
            .setCustomId(`system_edit_proxy_help_${session.id}`)
            .setLabel('Proxy Help')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❓'),
        new ButtonBuilder()
            .setCustomId(`system_edit_done_${session.id}`)
            .setLabel('Done')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
    );

    return { embed, components: [selectRow, modeRow, actionRow] };
}

/**
 * Build the settings interface
 */
function buildSettingsInterface(system, session) {
    const embed = new EmbedBuilder()

        .setTitle(`⚙️ System Settings`)
        .setDescription('Configure your system settings below.');

    // Current settings
    embed.addFields(
        {
            name: 'Closed Name Display',
            value: system.name?.closedNameDisplay || '*Not set*',
            inline: true
        },
        {
            name: 'Proxy Cooldown',
            value: system.setting?.proxyCoolDown ? `${system.setting.proxyCoolDown}s` : '3600s (default)',
            inline: true
        },
        {
            name: 'Auto-share Notes',
            value: system.setting?.autoshareNotestoUsers ? 'Yes' : 'No',
            inline: true
        },
        {
            name: 'Friend Auto-Bucket',
            value: system.setting?.friendAutoBucket || '*Not set*',
            inline: true
        }
    );

    // Privacy Buckets
    const bucketCount = system.privacyBuckets?.length || 0;
    embed.addFields({
        name: 'Privacy Buckets',
        value: `${bucketCount} bucket(s) configured`,
        inline: true
    });

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`system_settings_closedname_${session.id}`)
            .setLabel('Closed Name')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`system_settings_cooldown_${session.id}`)
            .setLabel('Proxy Cooldown')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`system_settings_autoshare_${session.id}`)
            .setLabel('Toggle Auto-share')
            .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`system_settings_buckets_${session.id}`)
            .setLabel('Privacy Buckets')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔒'),
        new ButtonBuilder()
            .setCustomId(`system_settings_friendbucket_${session.id}`)
            .setLabel('Friend Auto-Bucket')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`system_settings_mask_${session.id}`)
            .setLabel('Mask Settings')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🎭')
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`system_settings_privacy_${session.id}`)
            .setLabel('Default Privacy')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('👁️'),
        new ButtonBuilder()
            .setCustomId(`system_settings_back_${session.id}`)
            .setLabel('Back to Edit')
            .setStyle(ButtonStyle.Danger)
    );

    return { embed, components: [row1, row2, row3] };
}

/**
 * Build privacy buckets management interface
 */
function buildBucketsInterface(system, session) {
    const embed = new EmbedBuilder()

        .setTitle('🔒 Privacy Buckets')
        .setDescription('Manage your privacy buckets. Each bucket can contain friends with specific privacy levels.');

    if (system.privacyBuckets?.length > 0) {
        for (const bucket of system.privacyBuckets) {
            const friendCount = bucket.friends?.length || 0;
            embed.addFields({
                name: bucket.name,
                value: `${friendCount} friend(s)`,
                inline: true
            });
        }
    } else {
        embed.addFields({
            name: 'No buckets',
            value: 'You have no privacy buckets configured.',
            inline: false
        });
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`system_buckets_add_${session.id}`)
            .setLabel('Add Bucket')
            .setStyle(ButtonStyle.Success)
            .setEmoji('➕'),
        new ButtonBuilder()
            .setCustomId(`system_buckets_edit_${session.id}`)
            .setLabel('Edit Bucket')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✏️'),
        new ButtonBuilder()
            .setCustomId(`system_buckets_delete_${session.id}`)
            .setLabel('Delete Bucket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️'),
        new ButtonBuilder()
            .setCustomId(`system_buckets_back_${session.id}`)
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embed, components: [row] };
}

/**
 * Build conditions management interface
 */
function buildConditionsInterface(system, session) {
    const embed = new EmbedBuilder()

        .setTitle('📋 Conditions Management')
        .setDescription('Manage conditions for alters and states.');

    // Alter conditions
    let alterConditions = 'None';
    if (system.alters?.conditions?.length > 0) {
        alterConditions = system.alters.conditions.map(c => {
            let info = `**${c.name}**`;
            if (c.settings?.hide_to_self) info += ' (hidden)';
            if (!c.settings?.include_in_Count) info += ' (not counted)';
            return info;
        }).join('\n');
    }
    embed.addFields({
        name: `${system.alterSynonym?.singular || 'Alter'} Conditions`,
        value: alterConditions,
        inline: false
    });

    // State conditions
    let stateConditions = 'None';
    if (system.states?.conditions?.length > 0) {
        stateConditions = system.states.conditions.map(c => {
            let info = `**${c.name}**`;
            if (c.settings?.hide_to_self) info += ' (hidden)';
            if (!c.settings?.include_in_Count) info += ' (not counted)';
            return info;
        }).join('\n');
    }
    embed.addFields({
        name: 'State Conditions',
        value: stateConditions,
        inline: false
    });

    // Group types
    let groupTypes = 'None';
    if (system.groups?.types?.length > 0) {
        groupTypes = system.groups.types.join(', ');
    }
    embed.addFields({
        name: 'Group Types',
        value: groupTypes,
        inline: false
    });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`system_conditions_alter_add_${session.id}`)
            .setLabel(`Add ${system.alterSynonym?.singular || 'Alter'} Condition`)
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`system_conditions_state_add_${session.id}`)
            .setLabel('Add State Condition')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`system_conditions_back_${session.id}`)
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embed, components: [row] };
}

// ============================================
// COMMAND HANDLERS
// ============================================

/**
 * Handle /system menu
 */
async function handleMenu(interaction, user, system) {
    const embed = new EmbedBuilder()

        .setTitle('🎡 System Management')
        .setDescription('Select a button to start managing your system.')
        .setFooter({ text: 'Use the buttons below to navigate' });

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('system_menu_show')
            .setLabel('Show System')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('👁️'),
        new ButtonBuilder()
            .setCustomId('system_menu_edit')
            .setLabel('Edit System')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✏️'),
        new ButtonBuilder()
            .setCustomId('system_menu_settings')
            .setLabel('Settings')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⚙️')
    );

    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
}

/**
 * Handle /system show
 */
async function handleShow(interaction, currentUser, currentSystem) {
    const targetUser = interaction.options.getUser('user');
    const targetUserId = interaction.options.getString('userid');

    let targetSystem = currentSystem;
    let isOwner = true;
    let privacyBucket = null;

    // If viewing another user's system
    if (targetUser || targetUserId) {
        isOwner = false;
        const discordId = targetUser?.id || targetUserId;

        const otherUser = await User.findOne({ discordID: discordId });

        if (!otherUser || !otherUser.systemID) {
            return await interaction.reply({
                content: '❌ This user does not have a system to show. They may not have set up a system in this application...',
                ephemeral: true
            });
        }

        targetSystem = await System.findById(otherUser.systemID);

        if (!targetSystem) {
            return await interaction.reply({
                content: '❌ This user does not have a system to show. They may not have set up a system in this application...',
                ephemeral: true
            });
        }

        // Check if blocked
        if (currentUser && utils.isBlocked(otherUser, interaction.user.id, currentUser.friendID)) {
            return await interaction.reply({
                content: '❌ This user does not have a system to show. They may not have set up a system in this application...',
                ephemeral: true
            });
        }

        privacyBucket = utils.getPrivacyBucket(targetSystem, interaction.user.id, interaction.guildId);
    }

    if (!targetSystem) {
        return await interaction.reply({
            content: '❌ No system found. Use `/system` to set up your system first.',
            ephemeral: true
        });
    }

    // Check closed character settings
    const closedCharAllowed = await utils.checkClosedCharAllowed(interaction.guild);

    // Build the card
    const embed = await buildSystemCard(targetSystem, privacyBucket, closedCharAllowed, false);

    // Create session
    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, {
        type: 'show',
        systemId: targetSystem._id,
        isOwner
    });

    // Only show action buttons if owner
    const buttons = isOwner ? [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`system_show_full_${sessionId}`)
                .setLabel('Show All Info')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📄'),
            new ButtonBuilder()
                .setCustomId(`system_show_edit_${sessionId}`)
                .setLabel('Edit')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('✏️')
        )
    ] : [];

    await interaction.reply({ embeds: [embed], components: buttons, ephemeral: true });
}

/**
 * Handle /system edit
 */
async function handleEdit(interaction, user, system) {
    // Create session
    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, {
        type: 'edit',
        systemId: system._id,
        userId: user._id,
        mode: null,
        syncWithDiscord: system.syncWithApps?.discord || false
    });

    // Show sync confirmation
    const { embed, buttons } = utils.buildSyncConfirmation('system', utils.getDisplayName(system), sessionId, 'edit');
    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
}

/**
 * Handle /system settings
 */
async function handleSettings(interaction, user, system) {
    // Create session
    const sessionId = utils.generateSessionId(interaction.user.id);
    utils.setSession(sessionId, {
        type: 'settings',
        systemId: system._id,
        userId: user._id
    });

    const { embed, components } = buildSettingsInterface(system, { id: sessionId });
    await interaction.reply({ embeds: [embed], components, ephemeral: true });
}

// ============================================
// BUTTON INTERACTION HANDLER
// ============================================

async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;

    // Handle new user flow buttons
    if (customId.startsWith('new_user_')) {
        return await utils.handleNewUserButton(interaction, 'system');
    }

    // Handle menu buttons
    if (customId === 'system_menu_show') {
        const { user, system } = await utils.getOrCreateUserAndSystem(interaction);
        const mockInteraction = {
            ...interaction,
            options: { getUser: () => null, getString: () => null }
        };
        return await handleShow(mockInteraction, user, system);
    }

    if (customId === 'system_menu_edit') {
        const { user, system } = await utils.getOrCreateUserAndSystem(interaction);
        return await handleEdit(interaction, user, system);
    }

    if (customId === 'system_menu_settings') {
        const { user, system } = await utils.getOrCreateUserAndSystem(interaction);
        return await handleSettings(interaction, user, system);
    }

    // Extract session ID from custom ID
    const sessionId = utils.extractSessionId(customId);
    const session = utils.getSession(sessionId);

    if (!session) {
        return await interaction.reply({
            content: '❌ Session expired. Please start again.',
            ephemeral: true
        });
    }

    const system = await System.findById(session.systemId);

    // Handle show full info
    if (customId.startsWith('system_show_full_')) {
        const closedCharAllowed = await utils.checkClosedCharAllowed(interaction.guild);
        const embed = await buildSystemCard(system, null, closedCharAllowed, true);
        return await interaction.update({ embeds: [embed], components: [] });
    }

    // Handle show -> edit transition
    if (customId.startsWith('system_show_edit_')) {
        session.type = 'edit';
        session.mode = null;
        session.syncWithDiscord = system.syncWithApps?.discord || false;

        const { embed, buttons } = utils.buildSyncConfirmation('system', utils.getDisplayName(system), sessionId, 'edit');
        return await interaction.update({ embeds: [embed], components: [buttons] });
    }

    // Handle sync buttons for edit
    if (customId.startsWith('system_edit_sync_')) {
        session.syncWithDiscord = customId.includes('_yes_');
        session.id = sessionId;

        // Update system's sync setting
        system.syncWithApps = { discord: session.syncWithDiscord };
        await system.save();

        // Show edit interface
        const { embed, components } = buildEditInterface(system, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // Handle mode toggles
    if (customId.startsWith('system_edit_mode_mask_')) {
        session.mode = session.mode === 'mask' ? null : 'mask';
        const { embed, components } = buildEditInterface(system, session);
        return await interaction.update({ embeds: [embed], components });
    }

    if (customId.startsWith('system_edit_mode_server_')) {
        session.mode = session.mode === 'server' ? null : 'server';
        const { embed, components } = buildEditInterface(system, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // Handle edit -> settings transition
    if (customId.startsWith('system_edit_settings_')) {
        session.type = 'settings';
        const { embed, components } = buildSettingsInterface(system, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // Handle edit -> conditions transition
    if (customId.startsWith('system_edit_conditions_')) {
        const { embed, components } = buildConditionsInterface(system, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // Handle proxy layout help
    if (customId.startsWith('system_edit_proxy_help_')) {
        const helpEmbed = new EmbedBuilder()

            .setTitle('📝 Proxy Layout Help')
            .setDescription('Each entity type (alter, state, group) has its own layout. The layout determines how the sender name appears when proxying messages.')
            .addFields(
                {
                    name: '📋 Available Placeholders',
                    value: '`{name}` - Display name of the alter/state/group\n' +
                        '`{sys-name}` - System display name\n' +
                        '`{tag1}`, `{tag2}`, `{tag3}`... - **System** tag array items\n' +
                        '`{pronouns}` - Entity pronouns joined by separator\n' +
                        '`{caution}` - Entity caution type',
                    inline: false
                },
                {
                    name: '✍️ Signoff Placeholders',
                    value: '`{a-sign1}`, `{a-sign2}`... - Alter signoffs\n' +
                        '`{st-sign1}`, `{st-sign2}`... - State signoffs\n' +
                        '`{g-sign1}`, `{g-sign2}`... - Group signoffs\n\n' +
                        '**You can mix signoffs!** E.g., `{tag1}{a-sign1}{name}{g-sign1}`\n' +
                        '*Only the current entity type\'s signoffs fill in; others become empty.*',
                    inline: false
                },
                {
                    name: '💡 Example Layouts',
                    value: 'System tags: 🌙, ✨\nAlter "Luna" signoffs: 💫\n\n' +
                        '`{tag1} {name} {a-sign1}` → 🌙 Luna 💫\n' +
                        '`{tag1}{name}{tag2}` → 🌙Luna✨\n' +
                        '`[{sys-name}] {name}` → [My System] Luna',
                    inline: false
                },
                {
                    name: '⚙️ Proxy Style Options',
                    value: '`off` - Only proxy when a pattern is matched\n' +
                        '`last` - Auto-proxy as most recent proxy used\n' +
                        '`front` - Auto-proxy as current fronter (if single)\n' +
                        '`[entity name]` - Always proxy as specific entity',
                    inline: false
                },
                {
                    name: '📝 Setting Up Tags & Signoffs',
                    value: '**System Tags:** Edit in System → Card Info or Proxy Settings\n' +
                        '**Entity Signoffs:** Edit in alter/state/group Proxy Info\n' +
                        '• Enter one per line (emojis recommended!)\n' +
                        '• They become `{tag1}`, `{a-sign1}`, etc.',
                    inline: false
                }
            );

        const backButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`system_edit_proxy_help_back_${sessionId}`)
                .setLabel('Back to Edit')
                .setStyle(ButtonStyle.Secondary)
        );

        return await interaction.update({ embeds: [helpEmbed], components: [backButton] });
    }

    // Handle back from proxy help
    if (customId.startsWith('system_edit_proxy_help_back_')) {
        session.id = sessionId;
        const { embed, components } = buildEditInterface(system, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // Handle back from proxy settings
    if (customId.startsWith('system_edit_proxy_back_')) {
        session.id = sessionId;
        const { embed, components } = buildEditInterface(system, session);
        return await interaction.update({ content: null, embeds: [embed], components });
    }

    // Handle edit done
    if (customId.startsWith('system_edit_done_')) {
        utils.deleteSession(sessionId);
        return await interaction.update({
            content: '✅ Editing complete!',
            embeds: [],
            components: []
        });
    }

    // ============================================
    // SETTINGS BUTTONS
    // ============================================

    // Closed name
    if (customId.startsWith('system_settings_closedname_')) {
        const modal = new ModalBuilder()
            .setCustomId(`system_settings_closedname_modal_${sessionId}`)
            .setTitle('Edit Closed Name Display');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('closed_name')
                    .setLabel('Closed Name Display')
                    .setStyle(TextInputStyle.Short)
                    .setValue(system.name?.closedNameDisplay || '')
                    .setRequired(false)
                    .setMaxLength(100)
            )
        );

        return await interaction.showModal(modal);
    }

    // Proxy cooldown
    if (customId.startsWith('system_settings_cooldown_')) {
        const modal = new ModalBuilder()
            .setCustomId(`system_settings_cooldown_modal_${sessionId}`)
            .setTitle('Edit Proxy Cooldown');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('cooldown')
                    .setLabel('Cooldown (in seconds)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(String(system.setting?.proxyCoolDown || 3600))
                    .setRequired(true)
                    .setMaxLength(10)
            )
        );

        return await interaction.showModal(modal);
    }

    // Toggle auto-share
    if (customId.startsWith('system_settings_autoshare_')) {
        if (!system.setting) system.setting = {};
        system.setting.autoshareNotestoUsers = !system.setting.autoshareNotestoUsers;
        await system.save();

        const { embed, components } = buildSettingsInterface(system, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // Privacy buckets
    if (customId.startsWith('system_settings_buckets_')) {
        const { embed, components } = buildBucketsInterface(system, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // Friend auto-bucket
    if (customId.startsWith('system_settings_friendbucket_')) {
        const bucketOptions = system.privacyBuckets?.map(b =>
            new StringSelectMenuOptionBuilder()
                .setLabel(b.name)
                .setValue(b.name)
                .setDefault(system.setting?.friendAutoBucket === b.name)
        ) || [];

        if (bucketOptions.length === 0) {
            return await interaction.reply({
                content: '❌ You need to create privacy buckets first.',
                ephemeral: true
            });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`system_friendbucket_select_${sessionId}`)
            .setPlaceholder('Select default bucket for new friends...')
            .addOptions(bucketOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        return await interaction.update({
            content: 'Select the default privacy bucket for new friends:',
            embeds: [],
            components: [row]
        });
    }

    // Back to edit from settings
    if (customId.startsWith('system_settings_back_')) {
        session.type = 'edit';
        const { embed, components } = buildEditInterface(system, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // ============================================
    // PRIVACY BUCKETS BUTTONS
    // ============================================

    // Add bucket
    if (customId.startsWith('system_buckets_add_')) {
        const modal = new ModalBuilder()
            .setCustomId(`system_buckets_add_modal_${sessionId}`)
            .setTitle('Add Privacy Bucket');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('bucket_name')
                    .setLabel('Bucket Name')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(50)
            )
        );

        return await interaction.showModal(modal);
    }

    // Edit bucket (show selection)
    if (customId.startsWith('system_buckets_edit_')) {
        if (!system.privacyBuckets?.length) {
            return await interaction.reply({
                content: '❌ No buckets to edit.',
                ephemeral: true
            });
        }

        const bucketOptions = system.privacyBuckets.map(b =>
            new StringSelectMenuOptionBuilder()
                .setLabel(b.name)
                .setValue(b.name)
        );

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`system_buckets_editselect_${sessionId}`)
            .setPlaceholder('Select bucket to edit...')
            .addOptions(bucketOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        return await interaction.update({
            content: 'Select a bucket to edit:',
            embeds: [],
            components: [row]
        });
    }

    // Delete bucket (show selection)
    if (customId.startsWith('system_buckets_delete_')) {
        if (!system.privacyBuckets?.length) {
            return await interaction.reply({
                content: '❌ No buckets to delete.',
                ephemeral: true
            });
        }

        // Don't allow deleting Default or Friends buckets
        const deletableBuckets = system.privacyBuckets.filter(b =>
            b.name !== 'Default' && b.name !== 'Friends'
        );

        if (deletableBuckets.length === 0) {
            return await interaction.reply({
                content: '❌ Cannot delete Default or Friends buckets.',
                ephemeral: true
            });
        }

        const bucketOptions = deletableBuckets.map(b =>
            new StringSelectMenuOptionBuilder()
                .setLabel(b.name)
                .setValue(b.name)
        );

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`system_buckets_deleteselect_${sessionId}`)
            .setPlaceholder('Select bucket to delete...')
            .addOptions(bucketOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        return await interaction.update({
            content: '⚠️ Select a bucket to delete:',
            embeds: [],
            components: [row]
        });
    }

    // Back to settings from buckets
    if (customId.startsWith('system_buckets_back_')) {
        const { embed, components } = buildSettingsInterface(system, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // ============================================
    // CONDITIONS BUTTONS
    // ============================================

    // Add alter condition
    if (customId.startsWith('system_conditions_alter_add_')) {
        const modal = new ModalBuilder()
            .setCustomId(`system_conditions_alter_modal_${sessionId}`)
            .setTitle(`Add ${system.alterSynonym?.singular || 'Alter'} Condition`);

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('condition_name')
                    .setLabel('Condition Name')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(50)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('hide_to_self')
                    .setLabel('Hide to self? (yes/no)')
                    .setStyle(TextInputStyle.Short)
                    .setValue('no')
                    .setRequired(false)
                    .setMaxLength(3)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('include_in_count')
                    .setLabel('Include in count? (yes/no)')
                    .setStyle(TextInputStyle.Short)
                    .setValue('yes')
                    .setRequired(false)
                    .setMaxLength(3)
            )
        );

        return await interaction.showModal(modal);
    }

    // Add state condition
    if (customId.startsWith('system_conditions_state_add_')) {
        const modal = new ModalBuilder()
            .setCustomId(`system_conditions_state_modal_${sessionId}`)
            .setTitle('Add State Condition');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('condition_name')
                    .setLabel('Condition Name')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(50)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('hide_to_self')
                    .setLabel('Hide to self? (yes/no)')
                    .setStyle(TextInputStyle.Short)
                    .setValue('no')
                    .setRequired(false)
                    .setMaxLength(3)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('include_in_count')
                    .setLabel('Include in count? (yes/no)')
                    .setStyle(TextInputStyle.Short)
                    .setValue('yes')
                    .setRequired(false)
                    .setMaxLength(3)
            )
        );

        return await interaction.showModal(modal);
    }

    // Back to edit from conditions
    if (customId.startsWith('system_conditions_back_')) {
        const { embed, components } = buildEditInterface(system, session);
        return await interaction.update({ embeds: [embed], components });
    }
}

// ============================================
// SELECT MENU HANDLER
// ============================================

async function handleSelectMenu(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);

    if (!session) {
        return await interaction.reply({
            content: '❌ Session expired. Please start again.',
            ephemeral: true
        });
    }

    const system = await System.findById(session.systemId);
    const value = interaction.values[0];

    // Handle friend auto-bucket selection
    if (interaction.customId.startsWith('system_friendbucket_select_')) {
        if (!system.setting) system.setting = {};
        system.setting.friendAutoBucket = value;
        await system.save();

        const { embed, components } = buildSettingsInterface(system, session);
        return await interaction.update({
            content: null,
            embeds: [embed],
            components
        });
    }

    // Handle bucket edit selection
    if (interaction.customId.startsWith('system_buckets_editselect_')) {
        session.editingBucket = value;

        const bucket = system.privacyBuckets.find(b => b.name === value);

        const modal = new ModalBuilder()
            .setCustomId(`system_buckets_editmodal_${sessionId}`)
            .setTitle(`Edit Bucket: ${value}`);

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('bucket_name')
                    .setLabel('Bucket Name')
                    .setStyle(TextInputStyle.Short)
                    .setValue(bucket.name)
                    .setRequired(true)
                    .setMaxLength(50)
            )
        );

        return await interaction.showModal(modal);
    }

    // Handle bucket delete selection
    if (interaction.customId.startsWith('system_buckets_deleteselect_')) {
        const bucketIndex = system.privacyBuckets.findIndex(b => b.name === value);
        if (bucketIndex !== -1) {
            system.privacyBuckets.splice(bucketIndex, 1);
            await system.save();
        }

        const { embed, components } = buildBucketsInterface(system, session);
        return await interaction.update({
            content: `✅ Bucket "${value}" deleted.`,
            embeds: [embed],
            components
        });
    }

    // Handle proxy settings select menu
    if (interaction.customId.startsWith('system_edit_proxy_select_')) {
        let modal;
        const signPrefixHelp = {
            alter: '{a-sign1}, {a-sign2}...',
            state: '{st-sign1}, {st-sign2}...',
            group: '{g-sign1}, {g-sign2}...'
        };

        switch (value) {
            case 'layout_alter':
                modal = new ModalBuilder()
                    .setCustomId(`system_edit_proxy_layout_alter_modal_${sessionId}`)
                    .setTitle('Edit Alter Proxy Layout');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('layout')
                            .setLabel('Alter Layout')
                            .setStyle(TextInputStyle.Paragraph)
                            .setValue(system.proxy?.layout?.alter || '')
                            .setPlaceholder('{tag1}{name}{a-sign1} - Use {name}, {sys-name}, {tag#}, {a-sign#}, {pronouns}, {caution}')
                            .setRequired(false)
                            .setMaxLength(200)
                    )
                );
                break;

            case 'layout_state':
                modal = new ModalBuilder()
                    .setCustomId(`system_edit_proxy_layout_state_modal_${sessionId}`)
                    .setTitle('Edit State Proxy Layout');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('layout')
                            .setLabel('State Layout')
                            .setStyle(TextInputStyle.Paragraph)
                            .setValue(system.proxy?.layout?.state || '')
                            .setPlaceholder('{tag1}{name}{st-sign1} - Use {name}, {sys-name}, {tag#}, {st-sign#}, {pronouns}, {caution}')
                            .setRequired(false)
                            .setMaxLength(200)
                    )
                );
                break;

            case 'layout_group':
                modal = new ModalBuilder()
                    .setCustomId(`system_edit_proxy_layout_group_modal_${sessionId}`)
                    .setTitle('Edit Group Proxy Layout');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('layout')
                            .setLabel('Group Layout')
                            .setStyle(TextInputStyle.Paragraph)
                            .setValue(system.proxy?.layout?.group || '')
                            .setPlaceholder('{tag1}{name}{g-sign1} - Use {name}, {sys-name}, {tag#}, {g-sign#}, {pronouns}, {caution}')
                            .setRequired(false)
                            .setMaxLength(200)
                    )
                );
                break;

            case 'style_break':
                modal = new ModalBuilder()
                    .setCustomId(`system_edit_proxy_style_modal_${sessionId}`)
                    .setTitle('Edit Proxy Style & Break');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('proxy_style')
                            .setLabel('Proxy Style (off/last/front/[entity name])')
                            .setStyle(TextInputStyle.Short)
                            .setValue(system.proxy?.style || 'off')
                            .setPlaceholder('off, last, front, or an entity indexable name')
                            .setRequired(false)
                            .setMaxLength(50)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('proxy_break')
                            .setLabel('On Proxy Break? (yes/no)')
                            .setStyle(TextInputStyle.Short)
                            .setValue(system.proxy?.break ? 'yes' : 'no')
                            .setRequired(false)
                            .setMaxLength(3)
                    )
                );
                break;

            default:
                return;
        }

        return await interaction.showModal(modal);
    }

    // Handle edit menu selection
    if (!interaction.customId.startsWith('system_edit_select_')) {
        return;
    }

    let modal;

    switch (value) {
        case 'card_info':
            modal = new ModalBuilder()
                .setCustomId(`system_edit_card_modal_${sessionId}`)
                .setTitle('Edit Card Info');

            const cardTarget = utils.getEditTarget(system, session);

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('display_name')
                        .setLabel('Display Name')
                        .setStyle(TextInputStyle.Short)
                        .setValue(cardTarget?.name?.display || system.name?.display || '')
                        .setRequired(false)
                        .setMaxLength(100)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('description')
                        .setLabel('Description')
                        .setStyle(TextInputStyle.Paragraph)
                        .setValue(cardTarget?.description || system.description || '')
                        .setRequired(false)
                        .setMaxLength(2000)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('color')
                        .setLabel('Color (hex code)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(cardTarget?.color || system.color || '')
                        .setRequired(false)
                        .setMaxLength(7)
                )
            );
            break;

        case 'type_info':
            modal = new ModalBuilder()
                .setCustomId(`system_edit_type_modal_${sessionId}`)
                .setTitle('Edit System Type');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('type_name')
                        .setLabel('System Type Name')
                        .setStyle(TextInputStyle.Short)
                        .setValue(system.sys_type?.name || '')
                        .setPlaceholder('e.g., Traumagenic, Endogenic, Mixed')
                        .setRequired(false)
                        .setMaxLength(50)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('dsm_type')
                        .setLabel(`DSM Type (${DSM_TYPES.join(', ')})`)
                        .setStyle(TextInputStyle.Short)
                        .setValue(system.sys_type?.dd?.DSM || '')
                        .setRequired(false)
                        .setMaxLength(20)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('icd_type')
                        .setLabel(`ICD Type (${ICD_TYPES.join(', ')})`)
                        .setStyle(TextInputStyle.Short)
                        .setValue(system.sys_type?.dd?.ICD || '')
                        .setRequired(false)
                        .setMaxLength(20)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('called_system')
                        .setLabel('Calls self a system? (yes/no)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(system.sys_type?.isSystem ? 'yes' : 'no')
                        .setRequired(false)
                        .setMaxLength(3)
                )
            );
            break;

        case 'terminology_info':
            modal = new ModalBuilder()
                .setCustomId(`system_edit_terminology_modal_${sessionId}`)
                .setTitle('Edit Terminology');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('singular')
                        .setLabel('Singular Term (e.g., alter, headmate, part)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(system.alterSynonym?.singular || 'alter')
                        .setRequired(false)
                        .setMaxLength(30)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('plural')
                        .setLabel('Plural Term (e.g., alters, headmates, parts)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(system.alterSynonym?.plural || 'alters')
                        .setRequired(false)
                        .setMaxLength(30)
                )
            );
            break;

        case 'personal_info':
            modal = new ModalBuilder()
                .setCustomId(`system_edit_personal_modal_${sessionId}`)
                .setTitle('Edit Personal Info');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('birthday')
                        .setLabel('Birthday (YYYY-MM-DD)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(system.birthday ? system.birthday.toISOString().split('T')[0] : '')
                        .setRequired(false)
                        .setMaxLength(10)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('timezone')
                        .setLabel('Timezone (e.g., America/New_York, UTC)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(system.timezone || '')
                        .setRequired(false)
                        .setMaxLength(50)
                )
            );
            break;

        case 'image_info':
            modal = new ModalBuilder()
                .setCustomId(`system_edit_image_modal_${sessionId}`)
                .setTitle('Edit Image Info');

            const imageTarget = utils.getEditTarget(system, session);

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('avatar_url')
                        .setLabel('Avatar URL')
                        .setStyle(TextInputStyle.Short)
                        .setValue(imageTarget?.avatar?.url || imageTarget?.image?.avatar?.url || system.avatar?.url || '')
                        .setRequired(false)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('banner_url')
                        .setLabel('Banner URL')
                        .setStyle(TextInputStyle.Short)
                        .setValue(imageTarget?.image?.banner?.url || system.discord?.image?.banner?.url || '')
                        .setRequired(false)
                )
            );
            break;

        case 'caution_info':
            modal = new ModalBuilder()
                .setCustomId(`system_edit_caution_modal_${sessionId}`)
                .setTitle('Edit Caution Info');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('caution_type')
                        .setLabel('Caution Type')
                        .setStyle(TextInputStyle.Short)
                        .setValue(system.caution?.c_type || '')
                        .setRequired(false)
                        .setMaxLength(100)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('caution_detail')
                        .setLabel('Caution Details')
                        .setStyle(TextInputStyle.Paragraph)
                        .setValue(system.caution?.detail || '')
                        .setRequired(false)
                        .setMaxLength(1000)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('trigger_names')
                        .setLabel('Trigger Names (comma-separated)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(system.caution?.triggers?.map(t => t.name).join(', ') || '')
                        .setRequired(false)
                        .setMaxLength(500)
                )
            );
            break;

        case 'proxy_info':
            // Instead of a modal, show a select menu to choose which proxy setting to edit
            const proxyEmbed = new EmbedBuilder()

                .setTitle('💬 Proxy Settings')
                .setDescription('Select which proxy setting you want to edit.')
                .addFields(
                    {
                        name: 'Alter Layout',
                        value: system.proxy?.layout?.alter || '*Not set*',
                        inline: true
                    },
                    {
                        name: 'State Layout',
                        value: system.proxy?.layout?.state || '*Not set*',
                        inline: true
                    },
                    {
                        name: 'Group Layout',
                        value: system.proxy?.layout?.group || '*Not set*',
                        inline: true
                    },
                    {
                        name: 'Proxy Style',
                        value: system.proxy?.style || 'off',
                        inline: true
                    },
                    {
                        name: 'On Break',
                        value: system.proxy?.break ? 'Yes' : 'No',
                        inline: true
                    }
                );

            const proxySelect = new StringSelectMenuBuilder()
                .setCustomId(`system_edit_proxy_select_${sessionId}`)
                .setPlaceholder('Choose what to edit...')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Alter Layout')
                        .setDescription('Edit proxy layout for alters')
                        .setValue('layout_alter')
                        .setEmoji('🎭'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('State Layout')
                        .setDescription('Edit proxy layout for states')
                        .setValue('layout_state')
                        .setEmoji('🔄'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Group Layout')
                        .setDescription('Edit proxy layout for groups')
                        .setValue('layout_group')
                        .setEmoji('👥'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Proxy Style & Break')
                        .setDescription('Edit auto-proxy style and break status')
                        .setValue('style_break')
                        .setEmoji('⚙️')
                );

            const proxySelectRow = new ActionRowBuilder().addComponents(proxySelect);
            const proxyBackRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`system_edit_proxy_back_${sessionId}`)
                    .setLabel('Back to Edit')
                    .setStyle(ButtonStyle.Secondary)
            );

            return await interaction.update({
                embeds: [proxyEmbed],
                components: [proxySelectRow, proxyBackRow]
            });

        case 'front_info':
            modal = new ModalBuilder()
                .setCustomId(`system_edit_front_modal_${sessionId}`)
                .setTitle('Edit Front Status');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('front_status')
                        .setLabel('Current Status')
                        .setStyle(TextInputStyle.Short)
                        .setValue(system.front?.status || '')
                        .setRequired(false)
                        .setMaxLength(100)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('front_caution')
                        .setLabel('Current Caution')
                        .setStyle(TextInputStyle.Short)
                        .setValue(system.front?.caution || '')
                        .setRequired(false)
                        .setMaxLength(100)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('social_battery')
                        .setLabel('Social Battery (0-100)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(system.battery !== undefined ? String(system.battery) : '')
                        .setRequired(false)
                        .setMaxLength(3)
                )
            );
            break;

        default:
            return await interaction.reply({
                content: '❌ Unknown option selected.',
                ephemeral: true
            });
    }

    await interaction.showModal(modal);
}

// ============================================
// MODAL SUBMIT HANDLER
// ============================================

async function handleModalSubmit(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);

    if (!session) {
        return await interaction.reply({
            content: '❌ Session expired. Please start again.',
            ephemeral: true
        });
    }

    const system = await System.findById(session.systemId);

    // ============================================
    // SETTINGS MODALS
    // ============================================

    // Closed name modal
    if (interaction.customId.startsWith('system_settings_closedname_modal_')) {
        const closedName = interaction.fields.getTextInputValue('closed_name');

        if (!system.name) system.name = {};
        system.name.closedNameDisplay = closedName || null;

        await system.save();

        const { embed, components } = buildSettingsInterface(system, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // Cooldown modal
    if (interaction.customId.startsWith('system_settings_cooldown_modal_')) {
        const cooldown = parseInt(interaction.fields.getTextInputValue('cooldown'));

        if (isNaN(cooldown) || cooldown < 0) {
            return await interaction.reply({
                content: '❌ Invalid cooldown value. Please enter a positive number.',
                ephemeral: true
            });
        }

        if (!system.setting) system.setting = {};
        system.setting.proxyCoolDown = cooldown;

        await system.save();

        const { embed, components } = buildSettingsInterface(system, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // ============================================
    // BUCKETS MODALS
    // ============================================

    // Add bucket modal
    if (interaction.customId.startsWith('system_buckets_add_modal_')) {
        const bucketName = interaction.fields.getTextInputValue('bucket_name');

        // Check if bucket already exists
        if (system.privacyBuckets?.some(b => b.name === bucketName)) {
            return await interaction.reply({
                content: '❌ A bucket with this name already exists.',
                ephemeral: true
            });
        }

        if (!system.privacyBuckets) system.privacyBuckets = [];
        system.privacyBuckets.push({
            name: bucketName,
            friends: []
        });

        await system.save();

        const { embed, components } = buildBucketsInterface(system, session);
        return await interaction.update({
            content: `✅ Bucket "${bucketName}" created.`,
            embeds: [embed],
            components
        });
    }

    // Edit bucket modal
    if (interaction.customId.startsWith('system_buckets_editmodal_')) {
        const newName = interaction.fields.getTextInputValue('bucket_name');
        const oldName = session.editingBucket;

        const bucket = system.privacyBuckets.find(b => b.name === oldName);
        if (bucket) {
            bucket.name = newName;
            await system.save();
        }

        delete session.editingBucket;

        const { embed, components } = buildBucketsInterface(system, session);
        return await interaction.update({
            content: `✅ Bucket renamed to "${newName}".`,
            embeds: [embed],
            components
        });
    }

    // ============================================
    // CONDITIONS MODALS
    // ============================================

    // Alter condition modal
    if (interaction.customId.startsWith('system_conditions_alter_modal_')) {
        const conditionName = interaction.fields.getTextInputValue('condition_name');
        const hideToSelf = interaction.fields.getTextInputValue('hide_to_self')?.toLowerCase() === 'yes';
        const includeInCount = interaction.fields.getTextInputValue('include_in_count')?.toLowerCase() !== 'no';

        if (!system.alters) system.alters = { conditions: [], IDs: [] };
        if (!system.alters.conditions) system.alters.conditions = [];

        // Check if condition exists
        const existingIndex = system.alters.conditions.findIndex(c => c.name === conditionName);
        if (existingIndex !== -1) {
            system.alters.conditions[existingIndex].settings = {
                hide_to_self: hideToSelf,
                include_in_Count: includeInCount
            };
        } else {
            system.alters.conditions.push({
                name: conditionName,
                settings: {
                    hide_to_self: hideToSelf,
                    include_in_Count: includeInCount
                }
            });
        }

        await system.save();

        const { embed, components } = buildConditionsInterface(system, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // State condition modal
    if (interaction.customId.startsWith('system_conditions_state_modal_')) {
        const conditionName = interaction.fields.getTextInputValue('condition_name');
        const hideToSelf = interaction.fields.getTextInputValue('hide_to_self')?.toLowerCase() === 'yes';
        const includeInCount = interaction.fields.getTextInputValue('include_in_count')?.toLowerCase() !== 'no';

        if (!system.states) system.states = { conditions: [], IDs: [] };
        if (!system.states.conditions) system.states.conditions = [];

        // Check if condition exists
        const existingIndex = system.states.conditions.findIndex(c => c.name === conditionName);
        if (existingIndex !== -1) {
            system.states.conditions[existingIndex].settings = {
                hide_to_self: hideToSelf,
                include_in_Count: includeInCount
            };
        } else {
            system.states.conditions.push({
                name: conditionName,
                settings: {
                    hide_to_self: hideToSelf,
                    include_in_Count: includeInCount
                }
            });
        }

        await system.save();

        const { embed, components } = buildConditionsInterface(system, session);
        return await interaction.update({ embeds: [embed], components });
    }

    // ============================================
    // EDIT MODALS
    // ============================================

    // Card info modal
    if (interaction.customId.startsWith('system_edit_card_modal_')) {
        const displayName = interaction.fields.getTextInputValue('display_name');
        const description = interaction.fields.getTextInputValue('description');
        const color = interaction.fields.getTextInputValue('color');

        utils.updateEntityProperty(system, session, 'name.display', displayName);
        utils.updateEntityProperty(system, session, 'description', description);
        utils.updateEntityProperty(system, session, 'color', color);

        await system.save();
    }

    // Type info modal
    if (interaction.customId.startsWith('system_edit_type_modal_')) {
        const typeName = interaction.fields.getTextInputValue('type_name');
        const dsmType = interaction.fields.getTextInputValue('dsm_type');
        const icdType = interaction.fields.getTextInputValue('icd_type');
        const isSystem = interaction.fields.getTextInputValue('called_system');

        if (!system.sys_type) system.sys_type = { dd: {} };
        if (!system.sys_type.dd) system.sys_type.dd = {};

        system.sys_type.name = typeName || 'None';

        // Validate DSM type
        if (dsmType && DSM_TYPES.includes(dsmType)) {
            system.sys_type.dd.DSM = dsmType;
        } else if (!dsmType) {
            system.sys_type.dd.DSM = undefined;
        }

        // Validate ICD type
        if (icdType && ICD_TYPES.includes(icdType)) {
            system.sys_type.dd.ICD = icdType;
        } else if (!icdType) {
            system.sys_type.dd.ICD = undefined;
        }

        system.sys_type.isSystem = isSystem?.toLowerCase() === 'yes';

        await system.save();
    }

    // Terminology modal
    if (interaction.customId.startsWith('system_edit_terminology_modal_')) {
        const singular = interaction.fields.getTextInputValue('singular');
        const plural = interaction.fields.getTextInputValue('plural');

        if (!system.alterSynonym) system.alterSynonym = {};
        system.alterSynonym.singular = singular || 'alter';
        system.alterSynonym.plural = plural || 'alters';

        await system.save();
    }

    // Personal info modal
    if (interaction.customId.startsWith('system_edit_personal_modal_')) {
        const birthday = interaction.fields.getTextInputValue('birthday');
        const timezone = interaction.fields.getTextInputValue('timezone');

        if (birthday) {
            const date = new Date(birthday);
            if (!isNaN(date.getTime())) {
                system.birthday = date;
            }
        } else {
            system.birthday = undefined;
        }

        system.timezone = timezone || undefined;

        await system.save();
    }

    // Image info modal
    if (interaction.customId.startsWith('system_edit_image_modal_')) {
        const avatarUrl = interaction.fields.getTextInputValue('avatar_url');
        const bannerUrl = interaction.fields.getTextInputValue('banner_url');

        if (session.mode === 'mask') {
            if (!system.mask) system.mask = { discord: { image: {} } };
            if (!system.mask.discord) system.mask.discord = { image: {} };
            if (!system.mask.discord.image) system.mask.discord.image = {};
            if (avatarUrl) system.mask.avatar = { url: avatarUrl };
            if (bannerUrl) system.mask.discord.image.banner = { url: bannerUrl };
        } else if (!session.syncWithDiscord) {
            if (!system.discord) system.discord = { image: {} };
            if (!system.discord.image) system.discord.image = {};
            if (avatarUrl) system.discord.image.avatar = { url: avatarUrl };
            if (bannerUrl) system.discord.image.banner = { url: bannerUrl };
        } else {
            if (avatarUrl) system.avatar = { url: avatarUrl };
            if (!system.discord) system.discord = { image: {} };
            if (!system.discord.image) system.discord.image = {};
            if (bannerUrl) system.discord.image.banner = { url: bannerUrl };
        }

        await system.save();
    }

    // Caution info modal
    if (interaction.customId.startsWith('system_edit_caution_modal_')) {
        if (!system.caution) system.caution = {};

        const cautionType = interaction.fields.getTextInputValue('caution_type');
        const cautionDetail = interaction.fields.getTextInputValue('caution_detail');
        const triggerNames = interaction.fields.getTextInputValue('trigger_names');

        system.caution.c_type = cautionType || undefined;
        system.caution.detail = cautionDetail || undefined;

        if (triggerNames) {
            system.caution.triggers = utils.parseCommaSeparated(triggerNames).map(name => ({ name }));
        } else {
            system.caution.triggers = [];
        }

        await system.save();
    }

    // Proxy layout modals (alter, state, group)
    if (interaction.customId.startsWith('system_edit_proxy_layout_')) {
        if (!system.proxy) system.proxy = {};
        if (!system.proxy.layout || typeof system.proxy.layout === 'string') {
            // Convert from legacy string format to object format
            const oldLayout = typeof system.proxy.layout === 'string' ? system.proxy.layout : '';
            system.proxy.layout = {
                alter: oldLayout,
                state: oldLayout,
                group: oldLayout
            };
        }

        const layout = interaction.fields.getTextInputValue('layout');

        if (interaction.customId.includes('_alter_modal_')) {
            system.proxy.layout.alter = layout || '';
        } else if (interaction.customId.includes('_state_modal_')) {
            system.proxy.layout.state = layout || '';
        } else if (interaction.customId.includes('_group_modal_')) {
            system.proxy.layout.group = layout || '';
        }

        await system.save();

        // Return to proxy settings interface
        session.id = sessionId;
        const proxyEmbed = buildProxySettingsEmbed(system);
        const proxyComponents = buildProxySettingsComponents(sessionId);
        return await interaction.update({
            content: '✅ Layout saved!',
            embeds: [proxyEmbed],
            components: proxyComponents
        });
    }

    // Proxy style modal
    if (interaction.customId.startsWith('system_edit_proxy_style_modal_')) {
        if (!system.proxy) system.proxy = {};

        const style = interaction.fields.getTextInputValue('proxy_style')?.toLowerCase()?.trim();
        const onBreak = interaction.fields.getTextInputValue('proxy_break');

        // Validate proxy style
        const validStyles = ['off', 'last', 'front'];
        if (validStyles.includes(style)) {
            system.proxy.style = style;
        } else if (style) {
            // Check if it's an entity name (specify mode)
            const { entity, type } = await findEntityByNameForSystem(style, system);
            if (entity) {
                system.proxy.style = entity.name?.indexable || style;
            } else {
                // Invalid entity name, show warning
                system.proxy.break = onBreak?.toLowerCase() === 'yes';
                await system.save();

                session.id = sessionId;
                const proxyEmbed = buildProxySettingsEmbed(system);
                const proxyComponents = buildProxySettingsComponents(sessionId);
                return await interaction.update({
                    content: `⚠️ Could not find an alter/state/group named "${style}". Proxy style was not changed.\n\nValid options: \`off\`, \`last\`, \`front\`, or an entity's indexable name.`,
                    embeds: [proxyEmbed],
                    components: proxyComponents
                });
            }
        } else {
            system.proxy.style = 'off';
        }

        system.proxy.break = onBreak?.toLowerCase() === 'yes';

        await system.save();

        // Return to proxy settings interface
        session.id = sessionId;
        const proxyEmbed = buildProxySettingsEmbed(system);
        const proxyComponents = buildProxySettingsComponents(sessionId);
        return await interaction.update({
            content: '✅ Settings saved!',
            embeds: [proxyEmbed],
            components: proxyComponents
        });
    }

    // Front info modal
    if (interaction.customId.startsWith('system_edit_front_modal_')) {
        if (!system.front) system.front = {};

        const status = interaction.fields.getTextInputValue('front_status');
        const caution = interaction.fields.getTextInputValue('front_caution');
        const battery = interaction.fields.getTextInputValue('social_battery');

        system.front.status = status || undefined;
        system.front.caution = caution || undefined;

        if (battery) {
            const batteryNum = parseInt(battery);
            if (!isNaN(batteryNum) && batteryNum >= 0 && batteryNum <= 100) {
                system.battery = batteryNum;
            }
        } else {
            system.battery = undefined;
        }

        await system.save();
    }

    // Return to edit interface for edit modals
    if (interaction.customId.includes('_edit_') && !interaction.customId.includes('settings') && !interaction.customId.includes('proxy_layout') && !interaction.customId.includes('proxy_style')) {
        session.id = sessionId;
        const { embed, components } = buildEditInterface(system, session);
        return await interaction.update({ embeds: [embed], components });
    }
}

/**
 * Build the proxy settings embed
 */
function buildProxySettingsEmbed(system) {
    const getLayoutDisplay = (layout) => {
        if (!layout) return '*Not set*';
        return layout.length > 50 ? layout.substring(0, 47) + '...' : layout;
    };

    return new EmbedBuilder()

        .setTitle('💬 Proxy Settings')
        .setDescription('Select which proxy setting you want to edit.')
        .addFields(
            {
                name: '🎭 Alter Layout',
                value: getLayoutDisplay(system.proxy?.layout?.alter),
                inline: false
            },
            {
                name: '🔄 State Layout',
                value: getLayoutDisplay(system.proxy?.layout?.state),
                inline: false
            },
            {
                name: '👥 Group Layout',
                value: getLayoutDisplay(system.proxy?.layout?.group),
                inline: false
            },
            {
                name: '⚙️ Proxy Style',
                value: system.proxy?.style || 'off',
                inline: true
            },
            {
                name: '🛑 On Break',
                value: system.proxy?.break ? 'Yes' : 'No',
                inline: true
            }
        );
}

/**
 * Build proxy settings components
 */
function buildProxySettingsComponents(sessionId) {
    const proxySelect = new StringSelectMenuBuilder()
        .setCustomId(`system_edit_proxy_select_${sessionId}`)
        .setPlaceholder('Choose what to edit...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Alter Layout')
                .setDescription('Edit proxy layout for alters')
                .setValue('layout_alter')
                .setEmoji('🎭'),
            new StringSelectMenuOptionBuilder()
                .setLabel('State Layout')
                .setDescription('Edit proxy layout for states')
                .setValue('layout_state')
                .setEmoji('🔄'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Group Layout')
                .setDescription('Edit proxy layout for groups')
                .setValue('layout_group')
                .setEmoji('👥'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Proxy Style & Break')
                .setDescription('Edit auto-proxy style and break status')
                .setValue('style_break')
                .setEmoji('⚙️')
        );

    const proxySelectRow = new ActionRowBuilder().addComponents(proxySelect);
    const proxyBackRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`system_edit_proxy_back_${sessionId}`)
            .setLabel('Back to Edit')
            .setStyle(ButtonStyle.Secondary)
    );

    return [proxySelectRow, proxyBackRow];
}

/**
 * Helper to find entity by name for system proxy style validation
 */
async function findEntityByNameForSystem(name, system) {
    const searchName = name.toLowerCase();

    // Search alters
    const alters = await Alter.find({ _id: { $in: system.alters?.IDs || [] } });
    let entity = alters.find(a => a.name?.indexable?.toLowerCase() === searchName);
    if (entity) return { entity, type: 'alter' };

    // Search states
    const states = await State.find({ _id: { $in: system.states?.IDs || [] } });
    entity = states.find(s => s.name?.indexable?.toLowerCase() === searchName);
    if (entity) return { entity, type: 'state' };

    // Search groups
    const groups = await Group.find({ _id: { $in: system.groups?.IDs || [] } });
    entity = groups.find(g => g.name?.indexable?.toLowerCase() === searchName);
    if (entity) return { entity, type: 'group' };

    return { entity: null, type: null };
}