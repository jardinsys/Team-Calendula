// Systemiser Shared Utilities
// Merged utilities for both slash commands and prefix commands
// Used by: alter.js, state.js, group.js, system.js, switch.js, autoproxy.js, etc.

const {
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
const https = require('https');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// Import schemas
const System = require('../../schemas/system');
const User = require('../../schemas/user');

// Import notification manager
const notificationManager = require('./notificationManager');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const Guild = require('../../schemas/guild');
const { PrivacyBucket } = require('../../schemas/settings');

// Import config for R2
const config = require('../../config.json');

// Initialize R2 Client for Systemiser media (app bucket)
const sysR2 = new S3Client({
    region: 'auto',
    endpoint: config.r2.system.app.endpoint,
    credentials: {
        accessKeyId: config.r2.system.app.accessKeyId,
        secretAccessKey: config.r2.system.app.secretAccessKey,
    },
});

// Initialize R2 Client for Discord-only media (discord bucket)
const discordR2 = new S3Client({
    region: 'auto',
    endpoint: config.r2.system.discord.endpoint,
    credentials: {
        accessKeyId: config.r2.system.discord.accessKeyId,
        secretAccessKey: config.r2.system.discord.secretAccessKey,
    },
});

// ==== CONSTANTS ===== 

const ITEMS_PER_PAGE = 10;
const INDEXABLE_NAME_REGEX = /^[a-zA-Z0-9\-_]+$/;

// Entity colors for consistent styling
const ENTITY_COLORS = {
    alter: '#fb4fd9',
    state: '#00e1da',
    group: '#ffdb28',
    system: '#007bd8',
    profile: '#f28200',
    error: '#e9162d',
    success: '#1fb819',
    info: '#8f2be7'
};

// DSM and ICD type definitions for system type validation
const DSM_TYPES = ['DID', 'Amnesia', 'Dereal/Depers', 'OSDD-1A', 'OSDD-1B', 'OSDD-2', 'OSDD-3', 'OSDD-4', 'UDD'];
const ICD_TYPES = ['P-DID', 'Trance', 'DNSD', 'Possession Trance'];

// ═══════════════════════════════════════════
// DISORDER MAP (CommonJS version for Discord bot)
// ═══════════════════════════════════════════

const DISORDER_MAP = {
    'DID':           { fullName: 'Dissociative Identity Disorder', source: 'DSM', isSystem: true, isFragmented: false },
    'OSDD-1A':       { fullName: 'Other Specified Dissociative Disorder, Type 1A', source: 'DSM', extraQuestion: true,
                       extraQuestionText: 'Do you experience distinct identity states (alters)?',
                       extraQuestionYes: { isSystem: true, isFragmented: false },
                       extraQuestionNo:  { isSystem: false, isFragmented: true } },
    'OSDD-1B':       { fullName: 'Other Specified Dissociative Disorder, Type 1B', source: 'DSM', isSystem: true, isFragmented: false },
    'OSDD-2':        { fullName: 'Other Specified Dissociative Disorder, Type 2', source: 'DSM', isSystem: false, isFragmented: true },
    'OSDD-3':        { fullName: 'Other Specified Dissociative Disorder, Type 3', source: 'DSM', isSystem: false, isFragmented: true },
    'OSDD-4':        { fullName: 'Other Specified Dissociative Disorder, Type 4', source: 'DSM', isSystem: false, isFragmented: true },
    'Amnesia':        { fullName: 'Dissociative Amnesia', source: 'DSM', isSystem: false, isFragmented: false },
    'Dereal/Depers': { fullName: 'Derealization/Depersonalization Disorder', source: 'DSM', isSystem: false, isFragmented: false, isDissociative: true },
    'UDD':           { fullName: 'Unspecified Dissociative Disorder', source: 'DSM', isSystem: false, isFragmented: false },
    'P-DID':         { fullName: 'Partial Dissociative Identity Disorder', source: 'ICD', isSystem: true, isFragmented: false },
    'Possession Trance': { fullName: 'Possession Trance Disorder', source: 'ICD', extraQuestion: true,
                       extraQuestionText: 'Do you experience distinct entities or spirits taking control of your body?',
                       extraQuestionYes: { isSystem: true, isFragmented: false },
                       extraQuestionNo:  { isSystem: false, isFragmented: true } },
    'Trance':        { fullName: 'Dissociative Trance Disorder', source: 'ICD', isSystem: false, isFragmented: true },
    'DNSD':          { fullName: 'Dissociative Neurological Symptom Disorder', source: 'ICD', extraQuestion: true,
                       extraQuestionText: 'Would you describe it as states you\'d want to track?',
                       extraQuestionYes: { isSystem: false, isFragmented: true },
                       extraQuestionNo:  { isSystem: false, isFragmented: false } },
};

const DSM_DISORDER_OPTIONS = ['DID', 'OSDD-1A', 'OSDD-1B', 'OSDD-2', 'OSDD-3', 'OSDD-4', 'Amnesia', 'Dereal/Depers', 'UDD'];
const ICD_DISORDER_OPTIONS = ['P-DID', 'Trance', 'Possession Trance', 'DNSD'];

// ==== TERMINOLOGY HELPERS ====

const NEUTRAL_TERMS = {
    label: 'Profile',
    title: '',
    error: 'Registration',
    ownership: 'profile',
    ownershipCap: 'Profile'
};

function getSystemTerm(system, { context = 'label' } = {}) {
    if (!system?.sys_type?.isSystem) {
        return NEUTRAL_TERMS[context] || NEUTRAL_TERMS.label;
    }
    const synonym = system.systemSynonym || 'system';
    switch (context) {
        case 'title': return synonym.charAt(0).toUpperCase() + synonym.slice(1);
        case 'error': return synonym.charAt(0).toUpperCase() + synonym.slice(1);
        case 'ownership': return synonym.toLowerCase();
        case 'ownershipCap': return synonym.charAt(0).toUpperCase() + synonym.slice(1);
        default: return synonym.charAt(0).toUpperCase() + synonym.slice(1);
    }
}

function getAlterTerm(system, { plural = false } = {}) {
    return plural
        ? (system?.alterSynonym?.plural || 'alters')
        : (system?.alterSynonym?.singular || 'alter');
}

// Session storage (for multi-step interactions)
const activeSessions = new Map();
const sessionTimeouts = new Map();

// ==== SESSION MANAGEMENT ====

// Generate Session ID
function generateSessionId(userId) { return `${userId}_${Date.now()}`; }

// Get a session by ID
function getSession(sessionId) { return activeSessions.get(sessionId); }

// Set/update a session
function setSession(sessionId, data) {
    // Clear any existing timeout for this session to prevent premature deletion
    if (sessionTimeouts.has(sessionId)) {
        clearTimeout(sessionTimeouts.get(sessionId));
    }
    activeSessions.set(sessionId, data);
    // Auto-cleanup after 15 minutes
    const timeout = setTimeout(() => {
        activeSessions.delete(sessionId);
        sessionTimeouts.delete(sessionId);
    }, 15 * 60 * 1000);
    sessionTimeouts.set(sessionId, timeout);
}

// Delete a session
function deleteSession(sessionId) { activeSessions.delete(sessionId); }

// Extract session ID from a custom ID string
function extractSessionId(customId) {
    const parts = customId.split('_');
    return parts.slice(-2).join('_');
}

// ==== PREFIX COMMAND ARGUMENT PARSING ====

/* Parse prefix command arguments into structured data
 * Supports: key:value pairs, flags (-flag), quoted strings, and positional args
 * ALL KEYS AND FLAGS ARE CASE-INSENSITIVE
 * 
 * Examples:
 *   "bird name:bird color:#FF0000" -> { _positional: ['bird'], name: 'bird', color: '#FF0000' }
 *   "bird -private" -> { _positional: ['bird'], private: true }
 *   'bird description:"Our little blue bird"' -> { _positional: ['bird'], description: 'Our little blue bird' }
 * 
 * @param {string[]} args - Array of arguments from message.content.split(' ')
 * @returns {Object} Parsed arguments object
 */
function parseArgs(args) {
    const result = { _positional: [] };
    let i = 0;

    while (i < args.length) {
        const arg = args[i];

        // Handle flags: -private, -clear, -full (case-insensitive)
        if (arg.startsWith('-') && !arg.includes(':')) {
            const flagName = arg.slice(1).toLowerCase();
            result[flagName] = true;
            i++;
            continue;
        }

        // Handle key:value pairs (key is case-insensitive)
        if (arg.includes(':')) {
            const colonIndex = arg.indexOf(':');
            const key = arg.slice(0, colonIndex).toLowerCase();
            let value = arg.slice(colonIndex + 1);

            // Handle quoted values that might span multiple args
            if (value.startsWith('"') && !value.endsWith('"')) {
                const parts = [value.slice(1)];
                i++;
                while (i < args.length) {
                    if (args[i].endsWith('"')) {
                        parts.push(args[i].slice(0, -1));
                        break;
                    }
                    parts.push(args[i]);
                    i++;
                }
                value = parts.join(' ');
            } else if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }

            result[key] = value;
            i++;
            continue;
        }

        // Handle quoted positional arguments
        if (arg.startsWith('"')) {
            const parts = [arg.slice(1)];
            if (!arg.endsWith('"') || arg.length === 1) {
                i++;
                while (i < args.length) {
                    if (args[i].endsWith('"')) {
                        parts.push(args[i].slice(0, -1));
                        break;
                    }
                    parts.push(args[i]);
                    i++;
                }
            } else {
                parts[0] = arg.slice(1, -1);
            }
            result._positional.push(parts.join(' '));
            i++;
            continue;
        }

        // Regular positional argument (preserve original case for names)
        result._positional.push(arg);
        i++;
    }

    return result;
}

/* Extract target system from args (handles @mention, user ID, or defaults to self)
 * @param {Message} message - Discord message object
 * @param {Object} parsedArgs - Parsed arguments
 * @returns {Promise<{user: User, system: System, targetUserId: string}|null>}
 */
async function resolveTargetSystem(message, parsedArgs) {
    let targetUserId = message.author.id;

    // Check for @mention
    const mention = message.mentions.users.first();
    if (mention) {
        targetUserId = mention.id;
    }
    // Check for explicit user ID in args
    else if (parsedArgs.user) {
        targetUserId = parsedArgs.user;
    }
    // Check first positional for user ID pattern
    else if (parsedArgs._positional[0]?.match(/^\d{17,19}$/)) {
        targetUserId = parsedArgs._positional[0];
        parsedArgs._positional.shift();
    }

    const user = await User.findOne({ discordID: targetUserId });
    if (!user) {
        return { user: null, system: null, targetUserId };
    }

    const system = await System.findById(user.systemID);
    return { user, system, targetUserId };
}

// ==== USER AND SYSTEM MANAGEMENT ====

/* Get or create user and system for an interaction or message
 * Works with both slash commands (interaction) and prefix commands (message)
 * @param {Interaction|Message} context - Discord interaction or message
 * @returns {Promise<{user: User, system: System, isNew: boolean}>}
 */
async function getOrCreateUserAndSystem(context) {
    // Handle both interaction and message contexts
    const discordId = context.user?.id || context.author?.id;

    let user = await User.findOne({ discordID: discordId });
    let system = null;
    let isNew = false;

    if (!user) {
        ({ user, system } = await createNewUserAndSystem(discordId));
        isNew = true;
    }

    if (user.systemID && !isNew) system = await System.findById(user.systemID);

    return { user, system, isNew };
}

async function getUser(context) {
    const discordId = context.user?.id || context.author?.id;
    let user = await User.findOne({ discordID: discordId });
    return user;
}

// Get or create user for an interaction or message
async function getOrCreateUser(context) {
    // Handle both interaction and message contexts
    const discordId = context.user?.id || context.author?.id;
    let user = await User.findOne({ discordID: discordId });
    let isNew = false;

    if (!user) {
        user = await createUser(discordId);
        isNew = true;
    }

    return { user, isNew };
}

// Create a new user and system
async function createNewUserAndSystem(discordId) {
    const user = new User({
        _id: new mongoose.Types.ObjectId(),
        discordID: discordId,
        joinedAt: new Date()
    });

    const system = new System({
        users: [user._id],
        metadata: { joinedAt: new Date() },
        privacyBuckets: [{ name: 'Default', friends: [] }]
    });

    user.systemID = system._id;

    await user.save();
    await system.save();

    return { user, system };
}

async function createSystem(discordId) {
    let user = await User.findOne({ discordID: discordId });
    if (!user) throw new Error(`User not found for Discord ID: ${discordId}`);

    const system = new System({
        users: [user._id],
        metadata: { joinedAt: new Date() }
    });

    user.systemID = system._id;

    await user.save();
    await system.save();

    return { user, system };
}

// Create a new user
async function createUser(discordId) {
    const user = new User({
        _id: new mongoose.Types.ObjectId(),
        discordID: discordId,
        joinedAt: new Date()
    });

    await user.save();
    return user;
}

/* Handle new user flow for slash commands
 * Shows disorder category selection (DSM-5 / ICD-10 / Other / None / Skip)
 * @param {Interaction} interaction 
 * @param {string} entityType - 'system', 'alter', 'state', or 'group'
 */
async function handleNewUserFlow(interaction, entityType) {
    const sessionId = generateSessionId(interaction.user.id);

    setSession(sessionId, {
        type: 'new_user_onboarding',
        step: 'category',
        entityType,
    });

    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS.system)
        .setTitle('Welcome to Systemiser!')
        .setDescription(
            'It looks like you don\'t have a profile set up yet.\n\n' +
            '**Do you identify with a dissociative condition?**\n' +
            'This helps us set up your profile with the right features.\n' +
            'You can always change this later in settings.'
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`new_user_cat_DSM_${sessionId}`)
            .setLabel('DSM-5')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`new_user_cat_ICD_${sessionId}`)
            .setLabel('ICD-10/11')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`new_user_cat_OTHER_${sessionId}`)
            .setLabel('Other')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`new_user_cat_NONE_${sessionId}`)
            .setLabel('None')
            .setStyle(ButtonStyle.Secondary),
    );

    const skipRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`new_user_cat_SKIP_${sessionId}`)
            .setLabel('Skip for now')
            .setStyle(ButtonStyle.Link),
    );

    await interaction.reply({ embeds: [embed], components: [row, skipRow], ephemeral: true });
}

/* Build a select menu for disorders in a given category
 * @param {string} category - 'DSM' or 'ICD'
 * @param {string} sessionId
 * @returns {ActionRowBuilder}
 */
function buildDisorderSelectMenu(category, sessionId) {
    const options = category === 'DSM' ? DSM_DISORDER_OPTIONS : ICD_DISORDER_OPTIONS;

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`new_user_disorder_${sessionId}`)
        .setPlaceholder('Select your condition...')
        .addOptions(
            options.map(key => {
                const mapping = DISORDER_MAP[key];
                const desc = mapping.fullName.length > 100
                    ? mapping.fullName.substring(0, 97) + '...'
                    : mapping.fullName;
                return new StringSelectMenuOptionBuilder()
                    .setLabel(mapping.fullName)
                    .setValue(key)
                    .setDescription(desc);
            })
        );

    return new ActionRowBuilder().addComponents(selectMenu);
}

// Handle new user button interaction
async function handleNewUserButton(interaction) {
    const customId = interaction.customId;

    // ═══ STEP 1: Category selection ═══
    if (customId.startsWith('new_user_cat_')) {
        const parts = customId.split('_');
        // new_user_cat_{CATEGORY}_{sessionId}
        const category = parts[3];
        const sessionId = parts.slice(4).join('_');

        const session = getSession(sessionId);
        if (!session || session.type !== 'new_user_onboarding') {
            return await interaction.reply({ content: '❌ Session expired. Please try again.', ephemeral: true });
        }

        // Skip — just close
        if (category === 'SKIP') {
            deleteSession(sessionId);
            return await interaction.update({
                content: 'No problem! Come back when you\'re ready. 💙',
                embeds: [],
                components: []
            });
        }

        // None — both false
        if (category === 'NONE') {
            session.resolvedIsSystem = false;
            session.resolvedIsFragmented = false;
            session.isDissociative = false;
            session.selectedDisorder = null;
            session.step = 'name';
            setSession(sessionId, session);

            return await showNameStep(interaction, sessionId, session);
        }

        // Other — show manual selection modal
        if (category === 'OTHER') {
            session.step = 'other';
            session.selectedDisorder = null;
            setSession(sessionId, session);

            const modal = new ModalBuilder()
                .setCustomId(`new_user_other_modal_${sessionId}`)
                .setTitle('Custom Profile Setup');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('other_name')
                        .setLabel('What might you call it? (optional)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                        .setMaxLength(100)
                        .setPlaceholder('e.g. Complex Trauma Response')
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('other_is_system')
                        .setLabel('Are you a system? (yes/no)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMaxLength(3)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('other_is_fragmented')
                        .setLabel('Do you experience fragmented states? (yes/no)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMaxLength(3)
                ),
            );

            return await interaction.showModal(modal);
        }

        // DSM or ICD — show disorder select menu
        session.category = category;
        session.step = 'disorder';
        setSession(sessionId, session);

        const embed = new EmbedBuilder()
            .setColor(ENTITY_COLORS.system)
            .setTitle(category === 'DSM' ? 'DSM-5 Conditions' : 'ICD-10/11 Conditions')
            .setDescription('Select the condition that best describes your experience:');

        const selectRow = buildDisorderSelectMenu(category, sessionId);
        const backRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`new_user_cat_BACK_${sessionId}`)
                .setLabel('← Back')
                .setStyle(ButtonStyle.Link),
        );

        return await interaction.update({ embeds: [embed], components: [selectRow, backRow] });
    }

    // ═══ Back button from disorder select ═══
    if (customId.startsWith('new_user_cat_BACK_')) {
        const sessionId = customId.replace('new_user_cat_BACK_', '');
        const session = getSession(sessionId);
        if (!session) {
            return await interaction.reply({ content: '❌ Session expired.', ephemeral: true });
        }

        session.step = 'category';
        setSession(sessionId, session);

        const embed = new EmbedBuilder()
            .setColor(ENTITY_COLORS.system)
            .setTitle('Welcome to Systemiser!')
            .setDescription(
                'It looks like you don\'t have a profile set up yet.\n\n' +
                '**Do you identify with a dissociative condition?**\n' +
                'This helps us set up your profile with the right features.\n' +
                'You can always change this later in settings.'
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`new_user_cat_DSM_${sessionId}`)
                .setLabel('DSM-5')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`new_user_cat_ICD_${sessionId}`)
                .setLabel('ICD-10/11')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`new_user_cat_OTHER_${sessionId}`)
                .setLabel('Other')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`new_user_cat_NONE_${sessionId}`)
                .setLabel('None')
                .setStyle(ButtonStyle.Secondary),
        );

        const skipRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`new_user_cat_SKIP_${sessionId}`)
                .setLabel('Skip for now')
                .setStyle(ButtonStyle.Link),
        );

        return await interaction.update({ embeds: [embed], components: [row, skipRow] });
    }

    // ═══ STEP 2: Disorder selected ═══
    if (customId.startsWith('new_user_disorder_')) {
        const sessionId = customId.replace('new_user_disorder_', '');
        const session = getSession(sessionId);
        if (!session) {
            return await interaction.reply({ content: '❌ Session expired.', ephemeral: true });
        }

        const selectedKey = interaction.values[0];
        const mapping = DISORDER_MAP[selectedKey];
        if (!mapping) {
            return await interaction.reply({ content: '❌ Unknown condition selected.', ephemeral: true });
        }

        session.selectedDisorder = selectedKey;
        setSession(sessionId, session);

        // Check if extra question needed
        if (mapping.extraQuestion) {
            session.step = 'extra_question';
            setSession(sessionId, session);

            const embed = new EmbedBuilder()
                .setColor(ENTITY_COLORS.system)
                .setTitle('One more question...')
                .setDescription(mapping.extraQuestionText);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`new_user_extra_YES_${sessionId}`)
                    .setLabel('Yes')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`new_user_extra_NO_${sessionId}`)
                    .setLabel('No')
                    .setStyle(ButtonStyle.Secondary),
            );

            return await interaction.update({ embeds: [embed], components: [row] });
        }

        // No extra question — auto-resolve
        session.resolvedIsSystem = mapping.isSystem || false;
        session.resolvedIsFragmented = mapping.isFragmented || false;
        session.isDissociative = mapping.isDissociative || false;
        session.step = 'name';
        setSession(sessionId, session);

        return await showNameStep(interaction, sessionId, session);
    }

    // ═══ STEP 3: Extra question answer ═══
    if (customId.startsWith('new_user_extra_')) {
        const parts = customId.split('_');
        // new_user_extra_{YES|NO}_{sessionId}
        const answer = parts[3] === 'YES';
        const sessionId = parts.slice(4).join('_');

        const session = getSession(sessionId);
        if (!session || session.step !== 'extra_question') {
            return await interaction.reply({ content: '❌ Session expired.', ephemeral: true });
        }

        const mapping = DISORDER_MAP[session.selectedDisorder];
        const result = answer ? mapping.extraQuestionYes : mapping.extraQuestionNo;

        session.resolvedIsSystem = result.isSystem;
        session.resolvedIsFragmented = result.isFragmented;
        session.isDissociative = mapping.isDissociative || false;
        session.step = 'name';
        setSession(sessionId, session);

        return await showNameStep(interaction, sessionId, session);
    }

    // ═══ STEP 4: Old "Yes, register my profile!" button (backward compat) ═══
    if (customId.startsWith('new_user_has_system_')) {
        const user = await User.findOne({ discordID: interaction.user.id });
        const system = await System.findById(user?.systemID);

        if (!system) {
            return await interaction.update({
                content: '❌ Something went wrong. Please try again.',
                embeds: [],
                components: []
            });
        }

        if (!system.privacyBuckets?.some(b => b.name === 'Default')) {
            if (!system.privacyBuckets) system.privacyBuckets = [];
            system.privacyBuckets.push({ name: 'Default', friends: [] });
            await system.save();
        }

        const embed = new EmbedBuilder()
            .setColor(ENTITY_COLORS.success)
            .setTitle('✅ Profile Created!')
            .setDescription(
                'Your profile has been registered! 👍\n\n' +
                'Use `/system edit` to customize your profile, or `/alter new` to register your first alter.\n' +
                'If you need any help, feel free to use `/help`'
            );
        await interaction.update({ embeds: [embed], components: [] });

    } else if (customId.startsWith('new_user_no_system_')) {
        await interaction.update({
            content: 'No problem! Come back when you\'re ready. 💙',
            embeds: [],
            components: []
        });
    }

    // ═══ STEP 4: Name step buttons ═══
    if (customId.startsWith('new_user_name_custom_')) {
        const sessionId = customId.replace('new_user_name_custom_', '');
        const session = getSession(sessionId);
        if (!session) {
            return await interaction.reply({ content: '❌ Session expired.', ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId(`new_user_name_modal_${sessionId}`)
            .setTitle('Name Your Profile');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('profile_name')
                    .setLabel('Profile name (optional)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setMaxLength(100)
                    .setPlaceholder('e.g. The Colorwheel')
            ),
        );

        return await interaction.showModal(modal);
    }

    if (customId.startsWith('new_user_name_save_')) {
        const sessionId = customId.replace('new_user_name_save_', '');
        const session = getSession(sessionId);
        if (!session) {
            return await interaction.reply({ content: '❌ Session expired.', ephemeral: true });
        }

        return await finalizeOnboarding(interaction, sessionId, session, null);
    }

    // Import from another tool (after registration)
    if (customId.startsWith('new_user_import_start_')) {
        const sessionId = customId.replace('new_user_import_start_', '');
        const session = getSession(sessionId);
        if (!session) {
            return await interaction.reply({ content: '❌ Session expired. Use `sys!import` to import later.', ephemeral: true });
        }

        deleteSession(sessionId);

        const WEBAPP_URL = 'https://systemise.teamcalendula.net';
        const sourceTerm = session.resolvedIsSystem ? 'alters' : 'states';
        const embed = new EmbedBuilder()
            .setColor(ENTITY_COLORS.system)
            .setTitle('📥 Import Data')
            .setDescription(
                `Choose where you're importing from, or open the full import tool in the app for preview and selection.\n\n` +
                `*Imported members will be created as **${sourceTerm}** to match your profile type.*`
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('import_help_pluralkit')
                .setLabel('PluralKit')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('import_help_simplyplural')
                .setLabel('Simply Plural')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('import_help_octocon')
                .setLabel('Octocon')
                .setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('import_help_tupperbox')
                .setLabel('Tupperbox')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('import_help_autodetect')
                .setLabel('Auto-detect (file)')
                .setStyle(ButtonStyle.Secondary)
        );

        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Open Import Tool in App')
                .setStyle(ButtonStyle.Link)
                .setURL(`${WEBAPP_URL}/app/import`)
                .setEmoji('🌐')
        );

        return await interaction.update({ embeds: [embed], components: [row, row2, row3] });
    }

    // Skip import after registration
    if (customId.startsWith('new_user_import_skip_')) {
        const sessionId = customId.replace('new_user_import_skip_', '');
        deleteSession(sessionId);

        return await interaction.update({
            embeds: [new EmbedBuilder()
                .setColor(ENTITY_COLORS.success)
                .setTitle('✅ All Set!')
                .setDescription('You can import later with `sys!import`. Check `sys!import` for help.')],
            components: []
        });
    }

    // Import help buttons — redirect to sys!import usage
    if (customId.startsWith('import_help_')) {
        const source = customId.replace('import_help_', '');
        const tips = {
            pluralkit: 'Run `sys!import pluralkit` and enter your token when prompted.\n\nGet your token: DM PluralKit with `pk;token`',
            simplyplural: 'Run `sys!import simplyplural` and enter your token when prompted.\n\nGet your token: Settings → Developer → Add Token',
            octocon: 'Run `sys!import octocon` and enter your system ID when prompted.\n\nFind it at: `octocon.app/u/yourid`',
            tupperbox: 'Run `sys!import tupperbox` and attach your export file.\n\nExport with: `tul!export`',
            autodetect: 'Attach a JSON export file and run `sys!import` (without specifying a source).\n\nThe format will be auto-detected.'
        };

        return await interaction.reply({
            content: tips[source] || 'Run `sys!import` for help.',
            ephemeral: true
        });
    }
}

/* Show the name entry step (step 4) — shared by normal and extra-question paths
 * @param {Interaction} interaction
 * @param {string} sessionId
 * @param {Object} session
 */
async function showNameStep(interaction, sessionId, session) {
    const typeName = session.selectedDisorder
        ? DISORDER_MAP[session.selectedDisorder]?.fullName
        : (session.otherName || 'None');

    const statusParts = [];
    if (session.resolvedIsSystem) statusParts.push('System');
    if (session.resolvedIsFragmented) statusParts.push('Fragmented');
    if (session.isDissociative) statusParts.push('Dissociative');
    if (statusParts.length === 0) statusParts.push('Basic');

    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS.system)
        .setTitle('Almost done!')
        .setDescription(
            `**Condition:** ${typeName || 'Custom'}\n` +
            `**Profile type:** ${statusParts.join(', ')}\n\n` +
            'Would you like to give your profile a custom name?\n' +
            'You can also leave it blank and use the default.'
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`new_user_name_save_${sessionId}`)
            .setLabel('Continue without a name')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`new_user_name_custom_${sessionId}`)
            .setLabel('Set a custom name')
            .setStyle(ButtonStyle.Primary),
    );

    await interaction.update({ embeds: [embed], components: [row] });
}

/* Handle modal submissions for the onboarding flow
 * Called from bot.js when a modal submit comes in with new_user_ prefix
 * @param {Interaction} interaction
 */
async function handleNewUserModal(interaction) {
    const customId = interaction.customId;

    // ═══ Other path modal ═══
    if (customId.startsWith('new_user_other_modal_')) {
        const sessionId = customId.replace('new_user_other_modal_', '');
        const session = getSession(sessionId);
        if (!session) {
            return await interaction.reply({ content: '❌ Session expired.', ephemeral: true });
        }

        const otherName = interaction.fields.getTextInputValue('other_name');
        const isSystemStr = interaction.fields.getTextInputValue('other_is_system').toLowerCase();
        const isFragStr = interaction.fields.getTextInputValue('other_is_fragmented').toLowerCase();

        const resolvedIsSystem = isSystemStr === 'yes' || isSystemStr === 'y';
        const resolvedIsFragmented = isFragStr === 'yes' || isFragStr === 'y';

        // Validation: at least one tracking type must be enabled
        if (!resolvedIsSystem && !resolvedIsFragmented) {
            return await interaction.reply({
                content: '❌ You need at least one tracking type to use Systemiser. Please answer **yes** to at least one of "Are you a system?" or "Do you experience fragmented states?"',
                ephemeral: true
            });
        }

        session.resolvedIsSystem = resolvedIsSystem;
        session.resolvedIsFragmented = resolvedIsFragmented;
        session.isDissociative = false;
        session.otherName = otherName || null;
        session.step = 'name';
        setSession(sessionId, session);

        return await showNameStep(interaction, sessionId, session);
    }
}

/* Handle the name modal submission
 * Called from bot.js when a modal with new_user_name_modal_ prefix is submitted
 * @param {Interaction} interaction
 */
async function handleNewUserNameModal(interaction) {
    const customId = interaction.customId;

    if (customId.startsWith('new_user_name_modal_')) {
        const sessionId = customId.replace('new_user_name_modal_', '');
        const session = getSession(sessionId);
        if (!session) {
            return await interaction.reply({ content: '❌ Session expired.', ephemeral: true });
        }

        const customName = interaction.fields.getTextInputValue('profile_name');
        return await finalizeOnboarding(interaction, sessionId, session, customName || null);
    }
}

/* Finalize the onboarding — create the system with resolved sys_type
 * @param {Interaction} interaction
 * @param {string} sessionId
 * @param {Object} session
 * @param {string|null} customName
 */
async function finalizeOnboarding(interaction, sessionId, session, customName) {
    await interaction.deferUpdate();

    try {
        const user = await User.findOne({ discordID: interaction.user.id });
        if (!user) {
            return await interaction.editReply({ content: '❌ Something went wrong. Please try again.', embeds: [], components: [] });
        }

        // If user already has a system, just complete
        let system = user.systemID ? await System.findById(user.systemID) : null;
        if (system) {
            return await interaction.editReply({
                content: '✅ Profile already exists! You can update your type with `/system edit`.',
                embeds: [],
                components: []
            });
        }

        // Build sys_type
        const sysType = {
            isSystem: session.resolvedIsSystem || false,
            isFragmented: session.resolvedIsFragmented || false,
            isDissociative: session.isDissociative || false,
            onboardingCompleted: true,
        };

        // Set name and dd from disorder selection
        if (session.selectedDisorder && DISORDER_MAP[session.selectedDisorder]) {
            const mapping = DISORDER_MAP[session.selectedDisorder];
            sysType.name = customName || mapping.fullName;
            sysType.dd = mapping.source === 'DSM'
                ? { DSM: session.selectedDisorder }
                : { ICD: session.selectedDisorder };
        } else {
            // Other or None path
            sysType.name = customName || 'None';
            sysType.dd = {};
        }

        // Create system
        system = new System({
            users: [user._id],
            metadata: { joinedAt: new Date() },
            sys_type: sysType,
            privacyBuckets: [{ name: 'Default', friends: [] }],
            alters: { IDs: [] },
            states: { IDs: [] },
            groups: { IDs: [] },
        });

        if (customName) {
            const idx = customName.toLowerCase().replace(/[^a-z0-9]/g, '') || undefined;
            system.name = {
                display: customName,
                ...(idx && { indexable: idx }),
            };
        }

        await system.save();
        user.systemID = system._id;
        await user.save();

        // Auto-create "Dissociated" state for Dereal/Depers users
        if (session.isDissociative) {
            const dissociatedState = new State({
                systemID: system._id,
                name: { display: 'Dissociated', indexable: 'dissociated' },
                description: 'A dissociative state',
                proxy: ['dissociated'],
            });
            await dissociatedState.save();
            system.states.IDs.push(dissociatedState._id);
            await system.save();
        }

        deleteSession(sessionId);

        // Build success message
        const statusParts = [];
        if (session.resolvedIsSystem) statusParts.push('System');
        if (session.resolvedIsFragmented) statusParts.push('Fragmented');
        if (session.isDissociative) statusParts.push('Dissociative');
        if (statusParts.length === 0) statusParts.push('Basic');

        const importLine = session.resolvedIsSystem
            ? '\n\n📥 **Coming from another tool?** You can import your data from PluralKit, Simply Plural, Octocon, or Tupperbox!'
            : '\n\n📥 **Coming from another tool?** You can import your data — imported members will be set as **states** to match your profile.';

        const successEmbed = new EmbedBuilder()
            .setColor(ENTITY_COLORS.success)
            .setTitle('✅ Profile Created!')
            .setDescription(
                `**Type:** ${statusParts.join(', ')}\n` +
                (sysType.dd?.DSM || sysType.dd?.ICD
                    ? `**Condition:** ${sysType.name}\n`
                    : '') +
                (session.isDissociative
                    ? '**Note:** A "Dissociated" state has been created for you.\n'
                    : '') +
                importLine +
                '\n\nUse `/system edit` to customize your profile further, ' +
                'or `/alter new` to register your first alter.\n' +
                'If you need any help, feel free to use `/help`'
            );

        // Build components with optional import button
        const components = [];
        if (session.resolvedIsSystem || session.resolvedIsFragmented || session.isDissociative) {
            components.push(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`new_user_import_start_${sessionId}`)
                        .setLabel('Import from Another Tool')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`new_user_import_skip_${sessionId}`)
                        .setLabel('Skip for Now')
                        .setStyle(ButtonStyle.Secondary)
                )
            );
        }

        await interaction.editReply({ embeds: [successEmbed], components });

    } catch (err) {
        console.error('[Onboarding] Finalize error:', err);
        await interaction.editReply({
            content: '❌ Something went wrong during setup. Please try `/system edit` to set your type.',
            embeds: [],
            components: []
        });
    }
}

/* Require that the user has a system, send error if not
 * Works with both interactions and messages
 * @param {Interaction|Message} context - Discord interaction or message
 * @param {System} system - System object
 * @returns {Promise<boolean>} True if system exists, false if error was sent
 */
async function requireSystem(context, system) {
    if (!system) {
        const errorMsg = 'Not registered yet. Use `sys!system new` or `/system` to create one.';

        // Check if it's an interaction or message
        if (context.reply && context.author) { // It's a message
            await error(context, errorMsg);
        } else if (context.reply) { // It's an interaction
            await context.reply({ content: `❌ ${errorMsg}`, ephemeral: true });
        }
        return false;
    }
    return true;
}

// ==== ENTITY SEARCH (CASE-INSENSITIVE) ====

// Escape special regex characters
function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* Find an entity (alter/state/group) by name or ID (case-insensitive)
 * @param {string} identifier - Name, alias, or ID
 * @param {System} system - System to search in
 * @param {string} entityType - 'alter', 'state', 'group', or 'any'
 * @returns {Promise<{entity: Object, type: string}|null>}
 */
async function findEntity(identifier, system, entityType = 'any') {
    if (!identifier || !system) return null;

    const searchName = identifier.toLowerCase();

    const findInCollection = async (Model, ids) => {
        return await Model.findOne({
            _id: { $in: ids || [] },
            $or: [
                { _id: identifier },
                { 'name.indexable': { $regex: new RegExp(`^${escapeRegex(searchName)}$`, 'i') } },
                { 'name.display': { $regex: new RegExp(`^${escapeRegex(searchName)}$`, 'i') } },
                { 'name.aliases': { $elemMatch: { $regex: new RegExp(`^${escapeRegex(searchName)}$`, 'i') } } }
            ]
        });
    };

    if (entityType === 'alter' || entityType === 'any') {
        const alter = await findInCollection(Alter, system.alters?.IDs);
        if (alter) return { entity: alter, type: 'alter' };
    }

    if (entityType === 'state' || entityType === 'any') {
        const state = await findInCollection(State, system.states?.IDs);
        if (state) return { entity: state, type: 'state' };
    }

    if (entityType === 'group' || entityType === 'any') {
        const group = await findInCollection(Group, system.groups?.IDs);
        if (group) return { entity: group, type: 'group' };
    }

    return null;
}

/* Find an alter by name (case-insensitive) - backward compatibility
 * @param {string} name - Name to search for
 * @param {System} system - System to search in
 * @returns {Promise<Alter|null>}
 */
async function findAlterByName(name, system) {
    const result = await findEntity(name, system, 'alter');
    return result?.entity || null;
}

/* Find a state by name (case-insensitive) - backward compatibility
 * @returns {Promise<State|null>}
 */
async function findStateByName(name, system) {
    const result = await findEntity(name, system, 'state');
    return result?.entity || null;
}

/* Find a group by name (case-insensitive) - backward compatibility
 * @returns {Promise<Group|null>}
 */
async function findGroupByName(name, system) {
    const result = await findEntity(name, system, 'group');
    return result?.entity || null;
}

/* Find as many entities as possible by names/IDs
 * @param {string[]} identifiers - Array of names, aliases, or IDs
 * @param {System} system - System to search in
 * @returns {Promise<{found: Array<{entity: Object, type: string}>, notFound: string[]}>}
 */
async function findMultipleEntities(identifiers, system) {
    const found = [];
    const notFound = [];

    for (const identifier of identifiers) {
        const result = await findEntity(identifier, system);
        if (result) {
            found.push(result);
        } else {
            notFound.push(identifier);
        }
    }

    return { found, notFound };
}

// ==== PRIVACY AND VISIBILITY ====

/* Get the privacy bucket for a viewer
 * @param {System} system - The system being viewed
 * @param {string} viewerDiscordId - The viewer's Discord ID
 * @param {string} viewerFriendId - The viewer's Friend ID (optional)
 * @returns {PrivacyBucket|null}
 */
function getPrivacyBucket(system, viewerDiscordId, viewerFriendId) {
    if (!system?.privacyBuckets) return null;

    for (const bucket of system.privacyBuckets) {
        const inBucket = bucket.friends?.some(f =>
            f.discordUserID === viewerDiscordId || f.friendID === viewerFriendId
        );
        if (inBucket) return bucket;
    }

    return null;
}

/* Check if an entity should be visible based on privacy settings
 * @param {Object} entity - The entity (alter/state/group) to check
 * @param {PrivacyBucket} privacyBucket - The viewer's privacy bucket
 * @param {boolean} isOwner - Whether the viewer is the owner
 * @param {boolean} showFullList - Whether to show hidden items (owner only)
 * @returns {boolean}
 */
function shouldShowEntity(entity, privacyBucket, isOwner, showFullList = false) {
    if (isOwner) return true;
    if (!privacyBucket) return false;

    const entityPrivacy = entity.setting?.privacy?.find(p => p.bucket === privacyBucket.name);
    if (entityPrivacy?.settings?.hidden === true) return false;

    return true;
}

/* Check if pinging an entity is allowed
 * Priority: user master switch > entity master switch > privacy bucket restriction
 * @param {Object} entity - The entity being pinged (alter/state/group)
 * @param {string} pingedUserId - Discord ID of the user who sent the proxied message
 * @param {string} viewerDiscordId - Discord ID of the person sending the ping command
 * @returns {Promise<boolean>}
 */
async function isPingAllowed(entity, pingedUserId, viewerDiscordId) {
    // 1. Check entity-level master toggle
    if (entity.setting?.allowPing === false) return false;

    // 2. Get the entity's owner system and user
    const system = await System.findById(entity.systemID);
    if (!system) return false;

    const ownerUser = await User.findOne({ systemID: system._id.toString() });
    if (!ownerUser) return false;

    // 3. Check user-level master toggle
    if (ownerUser.settings?.allowPing === false) return false;

    // 4. Check privacy bucket restriction (only applies to friends, not strangers)
    const privacyBucket = getPrivacyBucket(system, viewerDiscordId);
    if (privacyBucket) {
        const entityPrivacy = entity.setting?.privacy?.find(p => p.bucket === privacyBucket.name);
        if (entityPrivacy?.settings?.allowPing === false) return false;
    }

    return true;
}

/* Check if user is blocked by another user
 * @param {User} targetUser - The user being viewed
 * @param {string} viewerDiscordId - The viewer's Discord ID
 * @param {string} viewerFriendId - The viewer's Friend ID
 * @returns {boolean}
 */
function isBlocked(targetUser, viewerDiscordId, viewerFriendId) {
    if (!targetUser?.blocked) return false;
    return targetUser.blocked.some(b =>
        b.discordID === viewerDiscordId || b.friendID === viewerFriendId
    );
}

// ==== DISPLAY HELPERS ====

/* Get the display name for an entity, respecting closedChar settings
 * @param {Object} entity - Entity with name property
 * @param {boolean} closedCharAllowed - Whether closed characters are allowed
 * @returns {string}
 */
function getDisplayName(entity, closedCharAllowed = true) {
    if (!closedCharAllowed && entity.name?.closedNameDisplay) return entity.name.closedNameDisplay;
    return entity.name?.display || entity.name?.indexable || '';
}

/* Get a fallback display name using Discord user info when entity/system name is missing
 * @param {Object|null} fallbackUser - Discord user object (interaction.user or message.author)
 * @param {string|null} fallbackDisplayName - Pre-resolved display name (e.g. interaction.user?.displayName)
 * @returns {string}
 */
function getFallbackName(fallbackUser, fallbackDisplayName) {
    return fallbackDisplayName || fallbackUser?.displayName || fallbackUser?.username || 'Unknown';
}

/* Get a property from discord element or fall back to base property
 * @param {Object} entity - The entity
 * @param {string} property - Property name to get
 * @returns {*}
 */
function getDiscordOrDefault(entity, property) {
    const discordValue = entity.discord?.[property];
    if (discordValue !== undefined && discordValue !== null && discordValue !== '') return discordValue;
    return entity[property];
}

// Check if closedCharAllowed for a guild
async function checkClosedCharAllowed(guild) {
    if (!guild) return true;
    const guildSettings = await Guild.findOne({ discordId: guild.id });
    return guildSettings?.settings?.closedCharAllowed !== false;
}

// Validate an indexable name
function isValidIndexableName(name) { return INDEXABLE_NAME_REGEX.test(name); }

// ============================================
// PREFIX COMMAND RESPONSE HELPERS
//  * @param {Message} message - Discord message to reply to
//  * @param {string} text - message text
// ============================================

// Success Message
async function success(message, text) {
    return message.reply({
        embeds: [new EmbedBuilder()
            .setColor(ENTITY_COLORS.success)
            .setDescription(`✅ ${text}`)]
    });
}

// Error Message
async function error(message, text) {
    return message.reply({
        embeds: [new EmbedBuilder()
            .setColor(ENTITY_COLORS.error)
            .setDescription(`❌ ${text}`)]
    });
}

// Info
async function info(message, text) {
    return message.reply({
        embeds: [new EmbedBuilder()
            .setColor(ENTITY_COLORS.info)
            .setDescription(`ℹ️ ${text}`)]
    });
}

/* Build a help embed for a command
 * @param {string} commandName - Name of the command
 * @param {string} description - Command description
 * @param {Array<{usage: string, description: string}>} subcommands - List of subcommands
 * @returns {EmbedBuilder}
 */
function buildHelpEmbed(commandName, description, subcommands) {
    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS.info)
        .setTitle(`📖 ${commandName} Command Help`)
        .setDescription(description);

    let usageText = '';
    for (const sub of subcommands) {
        usageText += `\`${sub.usage}\`\n${sub.description}\n\n`;
    }

    embed.addFields({ name: 'Usage', value: usageText.trim() });

    return embed;
}

// ============================================
// SETTINGS / PROXY UTILITIES
// ============================================

// Find entity by name across alters, states, and groups
async function findEntityByNameForSystem(name, system) {
    const searchName = name.toLowerCase();

    const alters = await Alter.find({ _id: { $in: system.alters?.IDs || [] } });
    let entity = alters.find(a => a.name?.indexable?.toLowerCase() === searchName || a.name?.display?.toLowerCase() === searchName);
    if (entity) return { entity, type: 'alter' };

    const states = await State.find({ _id: { $in: system.states?.IDs || [] } });
    entity = states.find(s => s.name?.indexable?.toLowerCase() === searchName || s.name?.display?.toLowerCase() === searchName);
    if (entity) return { entity, type: 'state' };

    const groups = await Group.find({ _id: { $in: system.groups?.IDs || [] } });
    entity = groups.find(g => g.name?.indexable?.toLowerCase() === searchName || g.name?.display?.toLowerCase() === searchName);
    if (entity) return { entity, type: 'group' };

    return { entity: null, type: null };
}

// Build proxy settings embed
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
            }
        );
}

// Build proxy settings components (select menu + back button)
function buildProxySettingsComponents(sessionId, prefix = 'system_edit') {
    const proxySelect = new StringSelectMenuBuilder()
        .setCustomId(`${prefix}_proxy_select_${sessionId}`)
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
                .setDescription('Edit auto-proxy style and break patterns')
                .setValue('style_break')
                .setEmoji('⚙️')
        );

    const proxySelectRow = new ActionRowBuilder().addComponents(proxySelect);
    const proxyBackRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${prefix}_proxy_back_${sessionId}`)
            .setLabel('Back to Edit')
            .setStyle(ButtonStyle.Secondary)
    );

    return [proxySelectRow, proxyBackRow];
}

// Build proxy layout modal for a specific entity type
function buildProxyLayoutModal(type, sessionId, system, prefix = 'system_edit') {
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
    const placeholders = {
        alter: '{a-sign1}{name}{tag1} - Use {name}, {sys-name}, {tag#}, {a-sign#}, {pronouns}, {caution}',
        state: '{st-sign1}{name}{tag1} - Use {name}, {sys-name}, {tag#}, {st-sign#}, {pronouns}, {caution}',
        group: '{g-sign1}{name}{tag1} - Use {name}, {sys-name}, {tag#}, {g-sign#}, {pronouns}, {caution}'
    };

    const modal = new ModalBuilder()
        .setCustomId(`${prefix}_proxy_layout_${type}_modal_${sessionId}`)
        .setTitle(`Edit ${typeLabel} Proxy Layout`);

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('layout')
                .setLabel(`${typeLabel} Layout`)
                .setStyle(TextInputStyle.Paragraph)
                .setValue(system.proxy?.layout?.[type] || '')
                .setPlaceholder(placeholders[type])
                .setRequired(false)
                .setMaxLength(200)
        )
    );

    return modal;
}

// Build proxy style & break modal
function buildProxyStyleModal(sessionId, system, prefix = 'system_edit') {
    const modal = new ModalBuilder()
        .setCustomId(`${prefix}_proxy_style_modal_${sessionId}`)
        .setTitle('Edit Proxy Style & Break');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('proxy_style')
                .setLabel('Proxy Style (off/last/front/state/[entity name])')
                .setStyle(TextInputStyle.Short)
                .setValue(system.proxy?.style || 'off')
                .setPlaceholder('off, last, front, state, or an entity indexable name')
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

    return modal;
}

// Validate proxy style string (pure logic, no DB calls)
function validateProxyStyle(style) {
    const normalized = style?.toLowerCase()?.trim();
    const validStyles = ['off', 'last', 'front', 'state'];
    if (validStyles.includes(normalized)) {
        return { valid: true, finalStyle: normalized, isEntityName: false };
    }
    if (normalized) {
        return { valid: true, finalStyle: normalized, isEntityName: true };
    }
    return { valid: true, finalStyle: 'off', isEntityName: false };
}

// ============================================
// NOTIFICATION SETTINGS UTILITIES
// ============================================

function getDeliveryLabel(method) {
    const labels = { dm: '📨 Discord DM', command: '💬 In Command', none: '❌ Disabled' };
    return labels[method] || '📨 Discord DM (Default)';
}

// Build notification settings embed
function buildNotificationSettingsEmbed(user) {
    const prefs = user.settings?.notificationPreferences || {};
    return new EmbedBuilder()
        .setColor('#00d4ff')
        .setTitle('🔔 Notification Settings')
        .setDescription('Configure how you receive notifications.')
        .addFields(
            { name: 'Delivery Method', value: getDeliveryLabel(prefs.friendNotifications), inline: true },
            { name: 'Friend Requests', value: prefs.friendRequests !== false ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'Friend Switches', value: prefs.friendSwitches !== false ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'App Messages', value: prefs.appMessages !== false ? '✅ Enabled' : '❌ Disabled', inline: true }
        );
}

// Build notification settings components (delivery select + toggle buttons)
function buildNotificationSettingsComponents(sessionId, prefs) {
    const deliveryRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`settings_notif_method_${sessionId}`)
            .setPlaceholder('Choose delivery method')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Discord DM')
                    .setValue('dm')
                    .setDefault(prefs.friendNotifications === 'dm' || prefs.friendNotifications === undefined),
                new StringSelectMenuOptionBuilder()
                    .setLabel('In Command')
                    .setValue('command')
                    .setDefault(prefs.friendNotifications === 'command'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('None')
                    .setValue('none')
                    .setDefault(prefs.friendNotifications === 'none')
            )
    );

    const toggleRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`settings_notif_toggle_friendRequests_${sessionId}`)
            .setLabel('Friend Requests')
            .setStyle(prefs.friendRequests !== false ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`settings_notif_toggle_friendSwitches_${sessionId}`)
            .setLabel('Friend Switches')
            .setStyle(prefs.friendSwitches !== false ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`settings_notif_toggle_appMessages_${sessionId}`)
            .setLabel('App Messages')
            .setStyle(prefs.appMessages !== false ? ButtonStyle.Success : ButtonStyle.Danger)
    );

    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`settings_notif_back_${sessionId}`)
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
    );

    return [deliveryRow, toggleRow, backRow];
}

// ==== FORMATTING UTILITIES ====

// Capitalize
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/* Format a field value, handling empty/null values
 * @param {*} value - Value to format
 * @param {string} defaultText - Default text if value is empty
 * @returns {string}
 */
function formatValue(value, defaultText = '*Not set*') {
    if (value === null || value === undefined || value === '') { return defaultText; }
    if (Array.isArray(value)) { return value.length > 0 ? value.join(', ') : defaultText; }
    return String(value);
}

/* Format a date for display
 * @param {Date|string} date 
 * @returns {string}
 */
function formatDate(date) {
    if (!date) return '*Not set*';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/* Format proxies for display (with code formatting)
 * @param {string[]} proxies 
 * @returns {string}
 */
function formatProxies(proxies) {
    if (!proxies || proxies.length === 0) return '*No proxies*';
    return proxies.map(p => `\`${p}\``).join(', ');
}

/* Parse comma-separated string into array
 * @param {string} str 
 * @returns {string[]}
 */
function parseCommaSeparated(str) {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(Boolean);
}

// Alias for parseCommaSeparated
const parseList = parseCommaSeparated;

/* Parse newline-separated string into array
 * @param {string} str 
 * @returns {string[]}
 */
function parseNewlineSeparated(str) {
    if (!str) return [];
    return str.split('\n').map(s => s.trim()).filter(Boolean);
}

// Alias for parseNewlineSeparated
const parseNewlineList = parseNewlineSeparated;

// ==== VALIDATION HELPERS (colors for now) ====

// Check if a string is a valid hex color
function isValidColor(str) {
    if (!str) return false;
    return /^#?[0-9A-Fa-f]{6}$/.test(str);
}

// Normalize a hex color (ensure # prefix, uppercase)
function normalizeColor(color) {
    if (!color) return null;
    color = color.replace('#', '');
    if (/^[0-9A-Fa-f]{6}$/.test(color)) {
        return `#${color.toLowerCase()}`;
    }
    return null;
}

// ==== LIST BUILDING HELPERS ====

/* Build pagination buttons for lists
 * @param {number} totalItems - Total number of items
 * @param {number} currentPage - Current page (0-indexed)
 * @param {boolean} isOwner - Whether viewer is owner
 * @param {boolean} showFullList - Whether showing full list
 * @param {string} sessionId - Session ID
 * @param {string} prefix - Button ID prefix
 * @returns {ActionRowBuilder[]}
 */
function buildListButtons(totalItems, currentPage, isOwner, showFullList, sessionId, prefix) {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
    const rows = [];

    const navRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`${prefix}_list_prev_${sessionId}`)
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(`${prefix}_list_next_${sessionId}`)
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage >= totalPages - 1)
        );
    rows.push(navRow);

    if (isOwner) {
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`${prefix}_list_toggle_${sessionId}`)
                    .setLabel(showFullList ? 'Hide Full List' : 'See Full List')
                    .setStyle(ButtonStyle.Primary)
            );
        rows.push(actionRow);
    }

    return rows;
}

/* Get items for current page
 * @param {Array} items - All items
 * @param {number} page - Current page (0-indexed)
 * @returns {Array}
 */
function getPageItems(items, page) {
    const startIndex = page * ITEMS_PER_PAGE;
    return items.slice(startIndex, startIndex + ITEMS_PER_PAGE);
}

// Calculate total pages
function getTotalPages(totalItems) { return Math.ceil(totalItems / ITEMS_PER_PAGE) || 1; }

// ============================================
// SYNC HELPERS
// ============================================

/* Build the sync confirmation embed and buttons
 * @param {string} entityType - 'alter', 'state', 'group', or 'system'
 * @param {string} entityName - Name of the entity
 * @param {string} sessionId - Session ID
 * @param {string} action - 'new' or 'edit'
 * @returns {{embed: EmbedBuilder, buttons: ActionRowBuilder}}
 */
function buildSyncConfirmation(entityType, entityName, sessionId, action = 'edit') {
    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS[entityType] || '#FFA500')
        .setTitle(action === 'new'
            ? `✅ ${capitalize(entityType)} Created!`
            : `✅ ${capitalize(entityType)} Updated!`)
        .setDescription(
            `**${entityName}** has been ${action === 'new' ? 'created' : 'updated'}.\n\n` +
            `Would you like to sync ${capitalize(entityType)} app settings with Discord?` //Check if this doesnt need to be "entityName"
        );

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${entityType}_sync_yes_${sessionId}`)
            .setLabel('Yes, sync now')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`${entityType}_sync_no_${sessionId}`)
            .setLabel('Not now')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embed, buttons };
}

// ==== EDIT HELPERS ====

/* Get the correct target for editing based on current mode
 * @param {Object} entity - The entity being edited
 * @param {Object} session - Session data containing mode
 * @returns {Object}
 */
function getEditTarget(entity, session) {
    if (session?.mode === 'mask') return entity.mask || entity;
    if (session?.mode === 'server' && session?.serverId) {
        const serverSettings = entity.discord?.server?.find(s => s.id === session.serverId);
        return serverSettings || entity.discord || entity;
    }
    return entity.discord || entity;
}

/* Update an entity property based on current mode
 * @param {Object} entity - The entity to update
 * @param {Object} session - Session data
 * @param {string} property - Property path to update
 * @param {*} value - New value
 */
function updateEntityProperty(entity, session, property, value) {
    if (session?.mode === 'server' && session?.serverId) {
        if (!entity.discord) entity.discord = {};
        if (!entity.discord.server) entity.discord.server = [];
        let serverEntry = entity.discord.server.find(s => s.id === session.serverId);
        if (!serverEntry) {
            serverEntry = { id: session.serverId };
            entity.discord.server.push(serverEntry);
        }
        const parts = property.split('.');
        let current = serverEntry;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
        return;
    }

    const target = session?.mode === 'mask' ? 'mask' : 'discord';
    if (!entity[target]) entity[target] = {};

    const parts = property.split('.');
    let current = entity[target];

    for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
}

// ==== CONDITION MANAGEMENT ====

/* Ensure a condition exists in the system
 * @param {System} system - System to update
 * @param {string} entityType - 'alter', 'state', or 'group'
 * @param {string} conditionName - Name of the condition
 */
async function ensureConditionExists(system, entityType, conditionName) {
    const conditionsPath = `${entityType}s.conditions`;
    const conditions = system[`${entityType}s`]?.conditions || [];

    const exists = conditions.some(c => c.name?.toLowerCase() === conditionName.toLowerCase());
    if (!exists) {
        if (!system[`${entityType}s`]) system[`${entityType}s`] = { conditions: [], IDs: [] };
        
        system[`${entityType}s`].conditions.push({
            name: conditionName,
            settings: {
                hide_to_self: false,
                include_in_Count: false
            }
        });
        await system.save();
    }
}

// ==== PROXY VALIDATION ====

/* Check if a proxy pattern already exists in the system
 * @param {string} proxy - The proxy pattern to check
 * @param {System} system - The system to check
 * @param {string} excludeEntityId - Entity ID to exclude from check
 * @returns {Promise<{exists: boolean, entity: Object|null, type: string|null}>}
 */
async function checkProxyExists(proxy, system, excludeEntityId = null) {
    const proxyLower = proxy.toLowerCase();

    // Check alters
    const alters = await Alter.find({ _id: { $in: system.alters?.IDs || [] } });
    for (const alter of alters) {
        if (alter._id.toString() === excludeEntityId) continue;
        if (alter.proxy?.some(p => p.toLowerCase() === proxyLower))
            return { exists: true, entity: alter, type: 'alter' };
    }

    // Check states
    const states = await State.find({ _id: { $in: system.states?.IDs || [] } });
    for (const state of states) {
        if (state._id.toString() === excludeEntityId) continue;
        if (state.proxy?.some(p => p.toLowerCase() === proxyLower)) 
            return { exists: true, entity: state, type: 'state' };
    }

    // Check groups
    const groups = await Group.find({ _id: { $in: system.groups?.IDs || [] } });
    for (const group of groups) {
        if (group._id.toString() === excludeEntityId) continue;
        if (group.proxy?.some(p => p.toLowerCase() === proxyLower)) 
            return { exists: true, entity: group, type: 'group' };
    }

    return { exists: false, entity: null, type: null };
}

/* Validate proxy patterns — format + cross-entity uniqueness
 * @param {string[]} proxies - Array of proxy patterns
 * @param {System} system - The system to check duplicates against
 * @param {string} excludeEntityId - Entity ID to exclude from duplicate check
 * @param {string} entityType - Entity type ('alter', 'state', 'group')
 * @returns {Promise<{valid: string[], errors: string[], duplicates: Array<{proxy: string, owner: string}>}>}
 */
async function validateProxies(proxies, system, excludeEntityId, entityType) {
    const valid = [];
    const errors = [];
    const duplicates = [];

    for (const proxy of proxies) {
        if (!proxy.includes('text')) {
            errors.push(`Proxy "${proxy}" must contain "text" as a placeholder`);
            continue;
        }
        if (proxy.length > 100) {
            errors.push(`Proxy "${proxy}" is too long (max 100 characters)!!! How would you even remember that??? 😰`);
            continue;
        }

        const { exists, entity, type } = await checkProxyExists(proxy, system, excludeEntityId);
        if (exists) {
            duplicates.push({ proxy, owner: `${type} ${getDisplayName(entity)}` });
        } else {
            valid.push(proxy);
        }
    }

    return { valid, errors, duplicates };
}

/* Get proxy layout help text
 * @returns {string}
 */
function getProxyLayoutHelp() {
    return `**Available Placeholders:**
\`{name}\` - Display name
\`{sys-name}\` - System name
\`{tag1}\`, \`{tag2}\`... - System tags
\`{pronouns}\` - Pronouns
\`{caution}\` - Caution type

**Signoffs (per-entity):**
\`{a-sign1}\`, \`{a-sign2}\`... - Alter signoffs
\`{st-sign1}\`, \`{st-sign2}\`... - State signoffs
\`{g-sign1}\`, \`{g-sign2}\`... - Group signoffs

You can mix signoff types! E.g., \`{tag1}{a-sign1}{name}{g-sign1}\``;
}

/* Get proxy style options for select menu
 * @returns {Array<{label: string, value: string, description: string}>}
 */
function getProxyStyleOptions() {
    return [
        { label: 'Off', value: 'off', description: 'Only proxy when a proxy pattern is matched' },
        { label: 'Last', value: 'last', description: 'Auto-proxy as the most recent proxy used' },
        { label: 'Front', value: 'front', description: 'Auto-proxy as the current fronter (if single)' },
        { label: 'Specify', value: 'specify', description: 'Always proxy as a specific alter/state/group' }
    ];
}

// ============================================
// R2 MEDIA UTILITIES
// ============================================

/* Upload a file buffer to Cloudflare R2
 * @param {Buffer} buffer - File content buffer
 * @param {string} filename - Original filename
 * @param {string} mimeType - MIME type (e.g., 'image/png', 'image/gif')
 * @param {string} userId - User's MongoDB _id
 * @param {string} entityType - 'system', 'alter', 'state', or 'group'
 * @param {string} field - 'avatar', 'banner', or 'proxyAvatar'
 * @returns {Object} mediaSchema-compatible object { r2Key, url, filename, mimeType, size, uploadedAt }
 */
/* Upload media to the correct R2 bucket
 * @param {Buffer} buffer - File content buffer
 * @param {string} filename - Original filename
 * @param {string} mimeType - MIME type
 * @param {string} userId - Discord user ID for R2 path
 * @param {string} entityType - Entity type for R2 path (e.g., 'Alter', 'State')
 * @param {string} field - Field label for R2 path
 * @param {string} bucket - Which bucket to use ('app' or 'discord', default 'app')
 * @returns {Object} mediaSchema object
 */
async function uploadMediaToR2(buffer, filename, mimeType, userId, entityType, field, bucket = 'app') {
    try {
        const ext = filename.split('.').pop() || 'bin';
        const timestamp = Date.now();
        const r2Key = `media/${entityType}/${userId}/${field}_${timestamp}.${ext}`;

        const bucketConfig = bucket === 'discord' ? config.r2.system.discord : config.r2.system.app;
        const r2Client = bucket === 'discord' ? discordR2 : sysR2;

        const command = new PutObjectCommand({
            Bucket: bucketConfig.bucketName,
            Key: r2Key,
            Body: buffer,
            ContentType: mimeType,
        });

        await r2Client.send(command);

        const publicUrl = `${bucketConfig.publicURL}/${r2Key}`;

        return {
            r2Key: r2Key,
            bucket: bucket,
            url: publicUrl,
            filename: filename,
            mimeType: mimeType,
            size: buffer.length,
            uploadedAt: new Date()
        };
    } catch (error) {
        console.error('Error uploading media to R2:', error);
        throw error;
    }
}

/* Delete a file from Cloudflare R2
 * @param {string} r2Key - The R2 object key to delete
 * @param {string} bucket - Which bucket to delete from ('app' or 'discord', default 'app')
 */
async function deleteFromR2(r2Key, bucket = 'app') {
    try {
        if (!r2Key) return;
        const bucketConfig = bucket === 'discord' ? config.r2.system.discord : config.r2.system.app;
        const r2Client = bucket === 'discord' ? discordR2 : sysR2;
        const command = new DeleteObjectCommand({
            Bucket: bucketConfig.bucketName,
            Key: r2Key,
        });
        await r2Client.send(command);
    } catch (error) {
        console.error('Error deleting from R2:', error);
    }
}

/* Download a file from a URL (e.g., Discord attachment)
 * @param {string} url - URL to download from
 * @returns {Promise<Buffer>} File content buffer
 */
function downloadFromUrl(url, redirects = 0) {
    if (redirects > 5) return Promise.reject(new Error('Too many redirects'));
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            if (res.statusCode === 302 || res.statusCode === 301) {
                downloadFromUrl(res.headers.location, redirects + 1).then(resolve, reject);
                return;
            }
            if (res.statusCode && res.statusCode >= 400) {
                reject(new Error(`Download failed with status ${res.statusCode}`));
                return;
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('Download timed out')); });
    });
}

/* Process an already-collected attachment: validate, download, upload to R2
 * @param {Attachment} attachment - Discord attachment object
 * @param {string} fieldLabel - Label for R2 path (e.g., 'avatar', 'banner')
 * @param {string} entityType - Entity type for R2 path (e.g., 'Alter', 'State')
 * @param {string} userId - Discord user ID for R2 path
 * @param {string} bucket - Which R2 bucket to use ('app' or 'discord', default 'app')
 * @returns {Promise<Object>} { success, media?, message }
 */
async function handleAttachmentUpload(attachment, fieldLabel, entityType, userId, bucket = 'app') {
    if (!attachment?.contentType?.startsWith('image/')) {
        return { success: false, message: '❌ Not a valid image file. Please send PNG, JPG, GIF, or WEBP.' };
    }

    try {
        const buffer = await downloadFromUrl(attachment.url);
        const media = await uploadMediaToR2(
            buffer,
            attachment.name || 'image',
            attachment.contentType,
            userId,
            entityType,
            fieldLabel,
            bucket
        );
        return { success: true, media, message: '✅ Image uploaded successfully!' };
    } catch (error) {
        console.error('Error processing attachment upload:', error);
        return { success: false, message: '❌ Failed to upload image. Try again later.' };
    }
}

/* Prefix command media upload: handles attachment OR URL → R2 → mediaSchema
 * @param {Attachment|null} attachment - Discord attachment (or null)
 * @param {string|null} urlArg - URL string from command args (or null)
 * @param {string} fieldLabel - Label for R2 path (e.g., 'avatar', 'banner')
 * @param {string} entityType - Entity type for R2 path (e.g., 'Alter', 'State')
 * @param {string} userId - Discord user ID for R2 path
 * @param {string} bucket - Which R2 bucket to use ('app' or 'discord', default 'app')
 * @returns {Promise<Object>} { success, media?, message }
 */
async function handlePrefixMediaUpload(attachment, urlArg, fieldLabel, entityType, userId, bucket = 'app') {
    if (attachment) {
        if (!attachment?.contentType?.startsWith('image/')) {
            return { success: false, message: 'Not a valid image file. Please send PNG, JPG, GIF, or WEBP.' };
        }
        return handleAttachmentUpload(attachment, fieldLabel, entityType, userId, bucket);
    }
    if (urlArg) {
        try {
            const buffer = await downloadFromUrl(urlArg);
            const extMatch = urlArg.split('.').pop()?.split('?')[0];
            const ext = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extMatch?.toLowerCase()) ? extMatch.toLowerCase() : 'png';
            const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
            const filename = `${fieldLabel}_${Date.now()}.${ext}`;
            const media = await uploadMediaToR2(buffer, filename, mimeType, userId, entityType, fieldLabel, bucket);
            return { success: true, media, message: 'Image uploaded successfully!' };
        } catch (error) {
            console.error('Error downloading/uploading from URL:', error);
            return { success: false, message: 'Failed to download image from URL. Check the link and try again.' };
        }
    }
    return { success: false, message: 'Please provide a URL or upload an image.' };
}

/* Determine which R2 bucket to use based on sync state and media context
 * @param {boolean} syncWithDiscord - Whether Discord is synced with the app
 * @param {string} mediaCategory - 'primary' | 'discord' | 'server' | 'mask' | 'mask_discord'
 * @returns {string} 'app' or 'discord'
 */
function resolveUploadBucket(syncWithDiscord, mediaCategory) {
    const isDiscordContext = ['discord', 'server', 'mask', 'mask_discord'].includes(mediaCategory);
    if (syncWithDiscord === false && isDiscordContext) return 'discord';
    return 'app';
}

/* Resolve the correct nested path for a media field based on session mode + sync
 * @param {Object} entity - The entity document
 * @param {Object} session - Session data with mode, syncWithDiscord, serverId
 * @param {string} mediaType - 'avatar' | 'banner' | 'proxyAvatar'
 * @returns {Object} { target, pathParts } — target is the nested object, pathParts for setting
 */
function resolveMediaTarget(entity, session, mediaType) {
    if (session.mode === 'mask') {
        if (!entity.mask) entity.mask = {};
        if (mediaType === 'avatar') return { target: entity.mask, path: ['mask', 'avatar'] };
        if (!entity.mask.discord) entity.mask.discord = { image: {} };
        if (!entity.mask.discord.image) entity.mask.discord.image = {};
        return { target: entity.mask.discord.image, path: ['mask', 'discord', 'image', mediaType] };
    }

    if (session.mode === 'server' && session.serverId) {
        if (!entity.discord) entity.discord = {};
        if (!entity.discord.server) entity.discord.server = [];
        let serverEntry = entity.discord.server.find(s => s.id === session.serverId);
        if (!serverEntry) {
            serverEntry = { id: session.serverId };
            entity.discord.server.push(serverEntry);
        }
        return { target: serverEntry, path: ['discord', 'server', session.serverId, mediaType], serverEntry };
    }

    if (session.syncWithDiscord && mediaType === 'avatar') {
        return { target: entity, path: ['avatar'] };
    }

    if (!entity.discord) entity.discord = {};
    if (!entity.discord.image) entity.discord.image = {};
    return { target: entity.discord.image, path: ['discord', 'image', mediaType] };
}

/* Set a media field on an entity, handling R2 cleanup of old media
 * @param {Object} entity - The entity document
 * @param {Object} session - Session data
 * @param {string} mediaType - 'avatar' | 'banner' | 'proxyAvatar'
 * @param {Object} mediaObj - The mediaSchema object to set
 */
async function setMediaField(entity, session, mediaType, mediaObj) {
    const { target, path } = resolveMediaTarget(entity, session, mediaType);

    const oldMedia = target[mediaType];
    if (oldMedia?.r2Key) {
        await deleteFromR2(oldMedia.r2Key, oldMedia.bucket || 'app');
    }

    target[mediaType] = mediaObj;
}

/* Resolve avatar URL with priority chain:
 * Server > Mask Proxy > Mask > Proxy > Discord/Primary (sync-dependent) > none
 * @param {Object} entity - The entity document
 * @param {Object} session - Session data
 * @returns {string|null}
 */
function resolveAvatarUrl(entity, session) {
    const serverId = session?.mode === 'server' ? session.serverId : null;
    const syncWithDiscord = session?.syncWithDiscord ?? entity.syncWithApps?.discord;
    const serverAvatar = serverId ? entity.discord?.server?.find(s => s.id === serverId)?.avatar?.url : null;

    return serverAvatar
        || entity.mask?.discord?.image?.proxyAvatar?.url
        || entity.mask?.avatar?.url
        || entity.discord?.image?.proxyAvatar?.url
        || (syncWithDiscord ? entity.avatar?.url : entity.discord?.image?.avatar?.url)
        || entity.avatar?.url
        || null;
}

/* Resolve banner URL with priority chain:
 * Server > Mask > Discord
 * @param {Object} entity - The entity document
 * @param {Object} session - Session data
 * @returns {string|null}
 */
function resolveBannerUrl(entity, session) {
    const serverId = session?.mode === 'server' ? session.serverId : null;
    const serverBanner = serverId ? entity.discord?.server?.find(s => s.id === serverId)?.banner?.url : null;

    return serverBanner
        || entity.mask?.discord?.image?.banner?.url
        || entity.discord?.image?.banner?.url
        || null;
}

/* Resolve proxy avatar URL with priority chain:
 * Mask Proxy > Proxy > Primary Avatar
 * @param {Object} entity - The entity document
 * @param {Object} session - Session data
 * @returns {string|null}
 */
function resolveProxyAvatarUrl(entity, session) {
    return entity.mask?.discord?.image?.proxyAvatar?.url
        || entity.discord?.image?.proxyAvatar?.url
        || entity.avatar?.url
        || null;
}

/* Ensure a discord.server entry exists for the current guild
 * @param {Object} entity - The entity document
 * @param {string} guildId - Discord guild ID
 * @param {string} guildName - Discord guild name
 * @returns {Object} The server entry
 */
function ensureServerEntry(entity, guildId, guildName = null) {
    if (!entity.discord) entity.discord = {};
    if (!entity.discord.server) entity.discord.server = [];
    let serverEntry = entity.discord.server.find(s => s.id === guildId);
    if (!serverEntry) {
        serverEntry = { id: guildId, name: guildName || 'Unknown Server' };
        entity.discord.server.push(serverEntry);
    }
    return serverEntry;
}

/* Build upload select menu options based on session mode + sync
 * @param {Object} session - Session data
 * @param {string} prefix - Custom ID prefix (e.g., 'alter')
 * @returns {Array<StringSelectMenuOptionBuilder>}
 */
function buildUploadOptions(session) {
    const options = [];

    if (session.mode === 'mask') {
        options.push(
            new StringSelectMenuOptionBuilder().setLabel('Mask Avatar').setValue('mask_avatar').setEmoji('🎭'),
            new StringSelectMenuOptionBuilder().setLabel('Mask Discord Avatar').setValue('mask_davatar').setEmoji('🎭'),
            new StringSelectMenuOptionBuilder().setLabel('Mask Proxy Avatar').setValue('mask_proxy').setEmoji('🎭'),
            new StringSelectMenuOptionBuilder().setLabel('Mask Banner').setValue('mask_banner').setEmoji('🖼️')
        );
    } else if (session.mode === 'server') {
        options.push(
            new StringSelectMenuOptionBuilder().setLabel('Server Avatar').setValue('server_avatar').setEmoji('🏠'),
            new StringSelectMenuOptionBuilder().setLabel('Server Banner').setValue('server_banner').setEmoji('🖼️'),
            new StringSelectMenuOptionBuilder().setLabel('Server Proxy Avatar').setValue('server_proxy').setEmoji('🏠')
        );
    } else {
        if (session.syncWithDiscord) {
            options.push(
                new StringSelectMenuOptionBuilder().setLabel('Primary Avatar').setValue('primary_avatar').setEmoji('👤'),
                new StringSelectMenuOptionBuilder().setLabel('Discord Avatar').setValue('discord_avatar').setEmoji('💬')
            );
        } else {
            options.push(
                new StringSelectMenuOptionBuilder().setLabel('Discord Avatar').setValue('discord_avatar').setEmoji('💬')
            );
        }
        options.push(
            new StringSelectMenuOptionBuilder().setLabel('Proxy Avatar').setValue('proxy_avatar').setEmoji('🗣️'),
            new StringSelectMenuOptionBuilder().setLabel('Banner').setValue('banner').setEmoji('🖼️')
        );
    }

    return options;
}

/* Get embed color for a system
 * @param {Object} system - System document
 * @returns {string|null}
 */
function getSystemEmbedColor(system) {
    return system?.color || ENTITY_COLORS.system || null;
}

/* Get embed color for an entity with priority: entity.color > system.color > default
 * @param {Object} entity - Entity document (alter/state/group)
 * @param {Object} system - System document
 * @returns {string|null}
 */
function getEntityEmbedColor(entity, system) {
    return entity?.color || system?.color || ENTITY_COLORS.system || null;
}

/**
 * Resolve display fields for an alter with active states.
 * Priority: activeStates.all[0] (priority) > activeStates.all[1..n] > alter's own fields.
 * @param {Object} alter - Alter document
 * @param {Object} system - System document (unused, kept for API consistency)
 * @returns {Object} Merged display: { name, avatar, color, description, signoff, pronouns, proxy, caution }
 */
async function resolveAlterDisplay(alter, system) {
    const display = {
        name: alter.name?.display || alter.name?.indexable || null,
        avatar: alter.avatar?.url || null,
        color: alter.color || null,
        description: alter.description || null,
        signoff: alter.signoff || null,
        pronouns: alter.pronouns || null,
        proxy: alter.proxy || null,
        caution: alter.caution || null,
        hasActiveStates: false
    };

    const activeIds = alter.activeStates?.all;
    if (!activeIds || activeIds.length === 0) return display;

    display.hasActiveStates = true;

    let states;
    try {
        states = await State.find({ _id: { $in: activeIds } });
    } catch {
        return display;
    }

    const stateMap = new Map();
    for (const s of states) {
        stateMap.set(s._id.toString(), s);
    }

    for (const stateId of activeIds) {
        const state = stateMap.get(stateId.toString());
        if (!state) continue;

        if (!display.name && (state.name?.display || state.name?.indexable)) {
            display.name = state.name?.display || state.name?.indexable;
        }
        if (!display.avatar && state.avatar?.url) {
            display.avatar = state.avatar.url;
        }
        if (!display.color && state.color) {
            display.color = state.color;
        }
        if (!display.description && state.description) {
            display.description = state.description;
        }
        if (!display.signoff && state.signoff) {
            display.signoff = state.signoff;
        }
        if (!display.proxy && state.proxy?.length) {
            display.proxy = state.proxy;
        }
        if (!display.caution && state.caution?.c_type) {
            display.caution = state.caution;
        }
    }

    return display;
}

// ==== GUILD LOGGING ====

async function sendGuildLog(guildId, eventType, logData, client) {
    try {
        let guildDoc = await Guild.findOne({ discordId: guildId });
        if (!guildDoc) return;

        const logChannelId = guildDoc.channels?.logChannel;
        if (!logChannelId) return;

        const logEvents = guildDoc.channels?.logEvents || {};
        if (eventType === 'proxy' && logEvents.proxy === false) return;
        if (eventType === 'edit' && !logEvents.edit) return;
        if (eventType === 'delete' && !logEvents.delete) return;
        if (eventType === 'reproxy' && !logEvents.reproxy) return;

        const channel = await client.channels.fetch(logChannelId).catch(() => null);
        if (!channel) return;

        const embed = buildLogEmbed(eventType, logData);
        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error('[GuildLog] Error sending log:', err.message);
    }
}

function buildLogEmbed(eventType, data) {
    const embed = new EmbedBuilder().setTimestamp();

    switch (eventType) {
        case 'proxy': {
            const avatarUrl = data.avatarUrl || null;
            const displayName = data.displayName || data.fallbackDisplayName || 'Unknown';
            const entityName = data.entity?.name?.display || data.entity?.name?.indexable || data.fallbackDisplayName || 'Unknown';
            const systemName = data.system?.name?.display || data.system?.name?.indexable || data.fallbackDisplayName || 'Unknown';
            const content = (data.content || '').substring(0, 1024);
            const color = data.entity?.color || data.system?.color || ENTITY_COLORS.success;

            embed
                .setColor(color)
                .setTitle('📤 Message Proxied')
                .setThumbnail(avatarUrl)
                .addFields(
                    { name: 'Entity', value: `${capitalize(data.type)}: **${entityName}**`, inline: true },
                    { name: 'System', value: systemName, inline: true },
                    { name: 'Channel', value: `<#${data.channelId}>`, inline: true },
                    { name: 'Content', value: content || '*empty*', inline: false }
                )
                .setFooter({ text: `Displayed as: ${displayName}` });

            if (data.messageLink) {
                embed.setURL(data.messageLink);
            }
            break;
        }

        case 'edit': {
            const avatarUrl = data.avatarUrl || null;
            const entityName = data.entityName || data.fallbackDisplayName || 'Unknown';
            const oldContent = (data.oldContent || '').substring(0, 1024);
            const newContent = (data.newContent || '').substring(0, 1024);
            const color = ENTITY_COLORS.group;

            embed
                .setColor(color)
                .setTitle('✏️ Message Edited')
                .setThumbnail(avatarUrl)
                .addFields(
                    { name: 'Entity', value: `${capitalize(data.entityType)}: **${entityName}**`, inline: true },
                    { name: 'Channel', value: `<#${data.channelId}>`, inline: true },
                    { name: 'Original', value: oldContent || '*empty*', inline: false },
                    { name: 'New', value: newContent || '*empty*', inline: false }
                );

            if (data.messageLink) {
                embed.setURL(data.messageLink);
            }
            break;
        }

        case 'delete': {
            const avatarUrl = data.avatarUrl || null;
            const entityName = data.entityName || data.fallbackDisplayName || 'Unknown';
            const content = (data.content || '').substring(0, 1024);
            const color = ENTITY_COLORS.error;

            embed
                .setColor(color)
                .setTitle('🗑️ Message Deleted')
                .setThumbnail(avatarUrl)
                .addFields(
                    { name: 'Entity', value: `${capitalize(data.entityType)}: **${entityName}**`, inline: true },
                    { name: 'Channel', value: `<#${data.channelId}>`, inline: true },
                    { name: 'Content', value: content || '*empty*', inline: false }
                );

            if (data.messageLink) {
                embed.setURL(data.messageLink);
            }
            break;
        }

        case 'reproxy': {
            const avatarUrl = data.avatarUrl || null;
            const oldEntityName = data.oldEntityName || data.fallbackDisplayName || 'Unknown';
            const newEntityName = data.newEntityName || data.fallbackDisplayName || 'Unknown';
            const color = ENTITY_COLORS.info;

            embed
                .setColor(color)
                .setTitle('🔄 Message Reproxied')
                .setThumbnail(avatarUrl)
                .addFields(
                    { name: 'From', value: `${capitalize(data.oldEntityType)}: **${oldEntityName}**`, inline: true },
                    { name: 'To', value: `${capitalize(data.newEntityType)}: **${newEntityName}**`, inline: true },
                    { name: 'Channel', value: `<#${data.channelId}>`, inline: true }
                );

            if (data.messageLink) {
                embed.setURL(data.messageLink);
            }
            break;
        }
    }

    return embed;
}

// ==== EXPORTS ====
module.exports = {
    // Constants
    ITEMS_PER_PAGE,
    INDEXABLE_NAME_REGEX,
    ENTITY_COLORS,
    DSM_TYPES,
    ICD_TYPES,
    DISORDER_MAP,
    DSM_DISORDER_OPTIONS,
    ICD_DISORDER_OPTIONS,

    // Terminology helpers
    getSystemTerm,
    getAlterTerm,

    // Session management
    generateSessionId,
    getSession,
    setSession,
    deleteSession,
    extractSessionId,
    activeSessions,

    // Prefix command parsing
    parseArgs,
    resolveTargetSystem,

    // User and system management
    getOrCreateUserAndSystem,
    createNewUserAndSystem,
    handleNewUserFlow,
    handleNewUserButton,
    handleNewUserModal,
    handleNewUserNameModal,
    requireSystem,

    // Entity search (case-insensitive)
    findEntity,
    findAlterByName,
    findStateByName,
    findGroupByName,
    findMultipleEntities,
    escapeRegex,

    // Privacy and visibility
    getPrivacyBucket,
    shouldShowEntity,
    isPingAllowed,
    isBlocked,

    // Display helpers
    getDisplayName,
    getFallbackName,
    getDiscordOrDefault,
    checkClosedCharAllowed,
    isValidIndexableName,

    // Prefix command response helpers
    success,
    error,
    info,
    buildHelpEmbed,

    // Formatting utilities
    capitalize,
    formatValue,
    formatDate,
    formatProxies,
    parseCommaSeparated,
    parseList, // alias
    parseNewlineSeparated,
    parseNewlineList, // alias

    // Validation helpers
    isValidColor,
    normalizeColor,

    // List helpers
    buildListButtons,
    getPageItems,
    getTotalPages,

    // Sync helpers
    buildSyncConfirmation,

    // Edit helpers
    getEditTarget,
    updateEntityProperty,

    // Condition management
    ensureConditionExists,

    // Proxy validation
    checkProxyExists,
    validateProxies,
    getProxyLayoutHelp,
    getProxyStyleOptions,

    // R2 media utilities
    uploadMediaToR2,
    deleteFromR2,
    downloadFromUrl,
    handleAttachmentUpload,
    handlePrefixMediaUpload,
    resolveUploadBucket,
    resolveMediaTarget,
    setMediaField,
    resolveAvatarUrl,
    resolveBannerUrl,
    resolveProxyAvatarUrl,
    ensureServerEntry,
    buildUploadOptions,

    // Embed color helpers
    getSystemEmbedColor,
    getEntityEmbedColor,
    resolveAlterDisplay,

    // Front management helpers
    updateRecentProxies,
    getBatteryEmoji,

    // Notification system
    notificationManager,
    getAndClearNotifications,
    formatNotificationEmbed,

    // Settings / proxy utilities
    findEntityByNameForSystem,
    buildProxySettingsEmbed,
    buildProxySettingsComponents,
    buildProxyLayoutModal,
    buildProxyStyleModal,
    validateProxyStyle,

    // Notification settings utilities
    getDeliveryLabel,
    buildNotificationSettingsEmbed,
    buildNotificationSettingsComponents,

    // Guild logging
    sendGuildLog
};

// Update recent proxies for quick switch menu
function updateRecentProxies(system, entity, type) {
    const proxyKey = `${type}:${entity._id}`;
    if (!system.proxy) system.proxy = {};
    if (!system.proxy.recentProxies) system.proxy.recentProxies = [];
    system.proxy.recentProxies = system.proxy.recentProxies.filter(p => !p.startsWith(proxyKey));
    system.proxy.recentProxies.unshift(proxyKey);
    system.proxy.recentProxies = system.proxy.recentProxies.slice(0, 15);
}

// Battery level emoji
function getBatteryEmoji(battery) {
    if (battery >= 70) return '🔋';
    if (battery >= 30) return '🪫';
    return '⚠️';
}

// Get and clear notifications for a user
function getAndClearNotifications(userId) {
    const notifications = notificationManager.getNotifications(userId);
    notificationManager.clearNotifications(userId);
    return notifications;
}

// Format notifications as an embed
function formatNotificationEmbed(notifications) {
    if (!notifications || notifications.length === 0) return null;

    const embed = new EmbedBuilder()
        .setColor('#00d4ff')
        .setTitle('📬 Notifications')
        .setFooter({ text: 'Type /settings to manage notifications' });

    const groupedByType = {};
    notifications.forEach(notif => {
        if (!groupedByType[notif.type]) {
            groupedByType[notif.type] = [];
        }
        groupedByType[notif.type].push(notif.data);
    });

    // Format each notification type
    if (groupedByType['friend-request']) {
        const requests = groupedByType['friend-request'];
        embed.addFields({
            name: '👥 Friend Requests',
            value: requests.map(r => `• ${r.senderName} (@${r.senderId})`).join('\n') || 'None',
            inline: false
        });
    }

    if (groupedByType['app-message']) {
        const messages = groupedByType['app-message'];
        embed.addFields({
            name: '💬 Messages from Sucre',
            value: messages.map(m => `• ${m.message}`).join('\n') || 'None',
            inline: false
        });
    }

    if (groupedByType['friend-switch']) {
        const switches = groupedByType['friend-switch'];
        embed.addFields({
            name: '🔄 Friend Switches',
            value: switches.map(s => `• ${s.friendName} switched to ${s.switched}`).join('\n') || 'None',
            inline: false
        });
    }

    return embed;
}