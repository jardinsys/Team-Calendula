// User and system management extracted from `bot_utils/index.js`.
// Re-exported through the `bot_utils` barrel so all consumers keep the same API.

const {
    generateSessionId,
    setSession,
    getSession,
    deleteSession,
} = require('./sessions');

const { ENTITY_COLORS, DSM_TYPES, ICD_TYPES, DISORDER_MAP, DSM_DISORDER_OPTIONS, ICD_DISORDER_OPTIONS } = require('./constants');

const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const User = require('../../../schemas/user');
const System = require('../../../schemas/system');
const PrivacyBucket = require('../../../schemas/settings').PrivacyBucket;
const mongoose = require('mongoose');

// Bot session manager for staged onboarding/import
const BotSessionManager = require('./BotSessionManager');

// Shared system creation from staged payload
const { createSystemFromPayload } = require('../../../api/utils/createSystemFromPayload');

/* Get or create user and system for an interaction or message
 * Works with both slash commands (interaction) and prefix commands (message)
 * @param {Interaction|Message} context - Discord interaction or message
 * @returns {Promise<{user: User, system: System, isNew: boolean}>}
 */
async function getOrCreateUserAndSystem(context) {
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

async function getOrCreateUser(context) {
    const discordId = context.user?.id || context.author?.id;
    let user = await User.findOne({ discordID: discordId });
    let isNew = false;

    if (!user) {
        user = await createUser(discordId);
        isNew = true;
    }

    return { user, isNew };
}

async function createNewUserAndSystem(discordId) {
    const user = new User({
        _id: new mongoose.Types.ObjectId(),
        discordID: discordId,
        joinedAt: new Date()
    });

    const strangersBucket = new PrivacyBucket({ name: 'Strangers', friends: [] });
    const friendsBucket = new PrivacyBucket({ name: 'Friends', friends: [] });
    await strangersBucket.save();
    await friendsBucket.save();

    const system = new System({
        users: [user._id],
        metadata: { joinedAt: new Date() },
        privacyBuckets: [strangersBucket._id, friendsBucket._id],
        setting: {
            friendAutoBucket: 'Friends',
            privacy: [
                {
                    bucket: 'Strangers',
                    settings: { mask: false, description: false, banner: false, avatar: false, birthday: false, pronouns: false, metadata: false, caution: false, hidden: true }
                },
                {
                    bucket: 'Friends',
                    settings: { mask: false, description: true, banner: true, avatar: true, birthday: false, pronouns: true, metadata: false, caution: false, hidden: false }
                }
            ]
        }
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
    const sessionId = BotSessionManager.start(interaction.user.id);

    const session = BotSessionManager.get(interaction.user.id);
    session.type = 'new_user_onboarding';
    session.step = 'category';
    session.entityType = entityType;
    BotSessionManager.set(sessionId, session);

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

/* Handle new user button interaction
 * @param {Interaction} interaction
 */
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
        session.dissociativeStateName = mapping.dissociativeStateName || 'Dissociated';
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

        // Handle key override (e.g., Amnesia → Amnesia-Fugue)
        if (result.key) {
            session.selectedDisorder = result.key;
        }

        session.resolvedIsSystem = result.isSystem;
        session.resolvedIsFragmented = result.isFragmented;
        session.isDissociative = result.isDissociative || mapping.isDissociative || false;
        session.dissociativeStateName = (result.key ? DISORDER_MAP[result.key] : mapping).dissociativeStateName || 'Dissociated';
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

        // Populate privacyBuckets to check names (they are ObjectId refs)
        await system.populate('privacyBuckets');
        if (!system.privacyBuckets?.some(b => b?.name === 'Strangers')) {
            if (!system.privacyBuckets) system.privacyBuckets = [];
            const strangersBucket = new PrivacyBucket({ name: 'Strangers', friends: [] });
            await strangersBucket.save();
            system.privacyBuckets.push(strangersBucket._id);
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
            BotSessionManager.clear(interaction.user.id);
            return await interaction.editReply({
                content: '✅ Profile already exists! You can update your type with `/system edit`.',
                embeds: [],
                components: []
            });
        }

        // Apply custom name to session before commit
        if (customName) {
            session.systemName = customName;
        }

        // Commit staged session using shared transactional creation
        const result = await BotSessionManager.commit(interaction.user.id, async (payload) => {
            return await createSystemFromPayload(user._id, payload);
        });

        system = result.system;

        // Build success message
        const sysType = session.resolvedIsSystem || session.resolvedIsFragmented || session.isDissociative 
            ? { isSystem: session.resolvedIsSystem, isFragmented: session.resolvedIsFragmented, isDissociative: session.isDissociative }
            : {};
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
                (session.selectedDisorder && DISORDER_MAP[session.selectedDisorder]
                    ? `**Condition:** ${DISORDER_MAP[session.selectedDisorder].fullName}\n`
                    : (session.otherName ? `**Condition:** ${session.otherName}\n` : '')) +
                (session.isDissociative
                    ? `**Note:** A "${session.dissociativeStateName || 'Dissociated'}" state has been created for you.\n`
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

module.exports = {
    getOrCreateUserAndSystem,
    getUser,
    getOrCreateUser,
    createNewUserAndSystem,
    createSystem,
    createUser,
    handleNewUserFlow,
    buildDisorderSelectMenu,
    handleNewUserButton,
    showNameStep,
    handleNewUserModal,
    handleNewUserNameModal,
    finalizeOnboarding,
    requireSystem,
};
