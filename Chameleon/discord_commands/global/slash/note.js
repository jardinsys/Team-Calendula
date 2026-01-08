// (/note) - Systemiser Notes Command
// Manage personal and shared notes with collaborative editing
// Content stored in Cloudflare R2 for unlimited length
//
// Commands:
// /note create - Create a new note
// /note view [note_id] - View a note with pagination
// /note edit [note_id] - Edit title/content
// /note delete [note_id] - Delete a note (owner only)
// /note list [filter] - List your notes (owned, shared, all)
// /note share [note_id] [user] [access] - Share with rw or r access
// /note unshare [note_id] [user] - Remove someone's access
// /note transfer [note_id] [user] - Transfer ownership (owner only)
// /note color [note_id] [color] - Change note color (owner only)
// /note pin [note_id] - Pin/unpin a note
// /note tags [note_id] [tags] - Edit tags on a note
// /note media add [note_id] - Add media to note
// /note media remove [note_id] [position] - Remove media

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
const crypto = require('crypto');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const Note = require('../../../schemas/note');
const System = require('../../../schemas/system');
const User = require('../../../schemas/user');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const Group = require('../../../schemas/group');
const { Shift } = require('../../../schemas/front');
const config = require('../../config');

// Import shared utilities
const utils = require('../../functions/bot_utils');

// Initialize R2 Client for Systemiser
const sysR2 = new S3Client({
    region: 'auto',
    endpoint: config.r2.system.endpoint,
    credentials: {
        accessKeyId: config.r2.system.accessKeyId,
        secretAccessKey: config.r2.system.secretAccessKey,
    },
});

// Constants
const CHARS_PER_PAGE = 1800; // Leave room for title/metadata in embed
const MEDIA_PER_MESSAGE = 10; // Discord limit
const PREVIEW_LENGTH = 500; // Characters to store in contentPreview
const NOTE_COLORS = {
    default: '#fafafa',
    red: '#ED4245',
    orange: '#E67E22',
    yellow: '#F1C40F',
    green: '#57F287',
    blue: '#3498DB',
    purple: '#9B59B6',
    pink: '#EB459E',
    gray: '#95A5A6'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('note')
        .setDescription('Manage your notes')
        .addSubcommand(sub => sub
            .setName('create')
            .setDescription('Create a new note'))
        .addSubcommand(sub => sub
            .setName('view')
            .setDescription('View a note')
            .addStringOption(opt => opt
                .setName('note_id')
                .setDescription('Note ID to view')
                .setRequired(true)
                .setAutocomplete(true)))
        .addSubcommand(sub => sub
            .setName('edit')
            .setDescription('Edit a note')
            .addStringOption(opt => opt
                .setName('note_id')
                .setDescription('Note ID to edit')
                .setRequired(true)
                .setAutocomplete(true)))
        .addSubcommand(sub => sub
            .setName('delete')
            .setDescription('Delete a note (owner only)')
            .addStringOption(opt => opt
                .setName('note_id')
                .setDescription('Note ID to delete')
                .setRequired(true)
                .setAutocomplete(true)))
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('List your notes')
            .addStringOption(opt => opt
                .setName('filter')
                .setDescription('Filter notes')
                .addChoices(
                    { name: 'All', value: 'all' },
                    { name: 'Owned', value: 'owned' },
                    { name: 'Shared with me', value: 'shared' },
                    { name: 'Pinned', value: 'pinned' }
                )))
        .addSubcommand(sub => sub
            .setName('share')
            .setDescription('Share a note with another user')
            .addStringOption(opt => opt
                .setName('note_id')
                .setDescription('Note ID to share')
                .setRequired(true)
                .setAutocomplete(true))
            .addUserOption(opt => opt
                .setName('user')
                .setDescription('User to share with')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('access')
                .setDescription('Access level')
                .setRequired(true)
                .addChoices(
                    { name: 'Read & Write', value: 'rw' },
                    { name: 'Read Only', value: 'r' }
                )))
        .addSubcommand(sub => sub
            .setName('unshare')
            .setDescription('Remove someone\'s access to a note')
            .addStringOption(opt => opt
                .setName('note_id')
                .setDescription('Note ID')
                .setRequired(true)
                .setAutocomplete(true))
            .addUserOption(opt => opt
                .setName('user')
                .setDescription('User to remove access from')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('transfer')
            .setDescription('Transfer note ownership (owner only)')
            .addStringOption(opt => opt
                .setName('note_id')
                .setDescription('Note ID to transfer')
                .setRequired(true)
                .setAutocomplete(true))
            .addUserOption(opt => opt
                .setName('user')
                .setDescription('New owner')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('color')
            .setDescription('Change note color (owner only)')
            .addStringOption(opt => opt
                .setName('note_id')
                .setDescription('Note ID')
                .setRequired(true)
                .setAutocomplete(true))
            .addStringOption(opt => opt
                .setName('color')
                .setDescription('Color')
                .setRequired(true)
                .addChoices(
                    { name: '🔵 Default (Blurple)', value: 'default' },
                    { name: '🔴 Red', value: 'red' },
                    { name: '🟠 Orange', value: 'orange' },
                    { name: '🟡 Yellow', value: 'yellow' },
                    { name: '🟢 Green', value: 'green' },
                    { name: '🔵 Blue', value: 'blue' },
                    { name: '🟣 Purple', value: 'purple' },
                    { name: '🩷 Pink', value: 'pink' },
                    { name: '⚪ Gray', value: 'gray' }
                )))
        .addSubcommand(sub => sub
            .setName('pin')
            .setDescription('Pin or unpin a note')
            .addStringOption(opt => opt
                .setName('note_id')
                .setDescription('Note ID')
                .setRequired(true)
                .setAutocomplete(true)))
        .addSubcommand(sub => sub
            .setName('tags')
            .setDescription('Edit tags on a note')
            .addStringOption(opt => opt
                .setName('note_id')
                .setDescription('Note ID')
                .setRequired(true)
                .setAutocomplete(true))
            .addStringOption(opt => opt
                .setName('tags')
                .setDescription('Tags (comma-separated)')
                .setRequired(true)))
        .addSubcommandGroup(group => group
            .setName('media')
            .setDescription('Manage note media')
            .addSubcommand(sub => sub
                .setName('add')
                .setDescription('Add media to a note')
                .addStringOption(opt => opt
                    .setName('note_id')
                    .setDescription('Note ID')
                    .setRequired(true)
                    .setAutocomplete(true))
                .addStringOption(opt => opt
                    .setName('url')
                    .setDescription('Media URL')
                    .setRequired(true))
                .addStringOption(opt => opt
                    .setName('caption')
                    .setDescription('Caption for the media')))
            .addSubcommand(sub => sub
                .setName('remove')
                .setDescription('Remove media from a note')
                .addStringOption(opt => opt
                    .setName('note_id')
                    .setDescription('Note ID')
                    .setRequired(true)
                    .setAutocomplete(true))
                .addIntegerOption(opt => opt
                    .setName('position')
                    .setDescription('Media position (1-based)')
                    .setRequired(true)
                    .setMinValue(1)))),

    async execute(interaction) {
        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand();

        const { user, system, isNew } = await utils.getOrCreateUserAndSystem(interaction);

        if (isNew) {
            return utils.handleNewUserFlow(interaction, 'note');
        }

        // Route to appropriate handler
        if (subcommandGroup === 'media') {
            if (subcommand === 'add') return handleMediaAdd(interaction, user, system);
            if (subcommand === 'remove') return handleMediaRemove(interaction, user, system);
        }

        switch (subcommand) {
            case 'create':
                return handleCreate(interaction, user, system);
            case 'view':
                return handleView(interaction, user, system);
            case 'edit':
                return handleEdit(interaction, user, system);
            case 'delete':
                return handleDelete(interaction, user, system);
            case 'list':
                return handleList(interaction, user, system);
            case 'share':
                return handleShare(interaction, user, system);
            case 'unshare':
                return handleUnshare(interaction, user, system);
            case 'transfer':
                return handleTransfer(interaction, user, system);
            case 'color':
                return handleColor(interaction, user, system);
            case 'pin':
                return handlePin(interaction, user, system);
            case 'tags':
                return handleTags(interaction, user, system);
            default:
                return interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
        }
    },

    // Autocomplete for note_id
    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'note_id') {
            const user = await User.findOne({ discordID: interaction.user.id });
            if (!user) return interaction.respond([]);

            // Get notes user has access to
            const notes = await Note.find({
                $or: [
                    { 'users.owner.userID': user._id },
                    { 'users.rwAccess.userID': user._id },
                    { 'users.rAccess.userID': user._id }
                ]
            }).limit(25);

            const filtered = notes
                .filter(note => {
                    const title = note.title || 'Untitled';
                    return title.toLowerCase().includes(focusedOption.value.toLowerCase()) ||
                        note.id.includes(focusedOption.value);
                })
                .map(note => ({
                    name: `${note.pinned ? '📌 ' : ''}${note.title || 'Untitled'} (${note.id.slice(-6)})`,
                    value: note.id
                }));

            return interaction.respond(filtered.slice(0, 25));
        }
    },

    // Export handlers for bot.js
    handleButtonInteraction,
    handleSelectMenu,
    handleModalSubmit
};

// ============================================
// R2 STORAGE FUNCTIONS
// ============================================

/**
 * Upload note content to R2
 * @param {string} userId - User's MongoDB _id
 * @param {string} noteId - Note's snowflake ID
 * @param {string} content - Text content to upload
 * @returns {Object} mediaSchema compatible object
 */
async function uploadNoteContent(userId, noteId, content) {
    try {
        const r2Key = `notes/${userId}/${noteId}.txt`;

        const command = new PutObjectCommand({
            Bucket: config.r2.system.bucketName,
            Key: r2Key,
            Body: content,
            ContentType: 'text/plain; charset=utf-8',
        });

        await sysR2.send(command);

        const publicUrl = `${config.r2.system.publicURL}/${r2Key}`;

        return {
            r2Key: r2Key,
            url: publicUrl,
            filename: `${noteId}.txt`,
            mimeType: 'text/plain',
            size: Buffer.byteLength(content, 'utf8'),
            uploadedAt: new Date()
        };
    } catch (error) {
        console.error('Error uploading note content to R2:', error);
        throw error;
    }
}

/**
 * Fetch note content from R2
 * @param {string} r2Key - The R2 key for the content
 * @returns {string} The text content
 */
async function fetchNoteContent(r2Key) {
    try {
        const command = new GetObjectCommand({
            Bucket: config.r2.system.bucketName,
            Key: r2Key,
        });

        const response = await sysR2.send(command);
        const content = await response.Body.transformToString('utf-8');

        return content;
    } catch (error) {
        console.error('Error fetching note content from R2:', error);
        return null;
    }
}

/**
 * Delete note content from R2
 * @param {string} r2Key - The R2 key for the content
 */
async function deleteNoteContent(r2Key) {
    try {
        if (!r2Key) return;

        const command = new DeleteObjectCommand({
            Bucket: config.r2.system.bucketName,
            Key: r2Key,
        });

        await sysR2.send(command);
    } catch (error) {
        console.error('Error deleting note content from R2:', error);
        // Don't throw - deletion failure shouldn't block other operations
    }
}

/**
 * Generate content preview (first N characters)
 * @param {string} content - Full content
 * @param {number} length - Max length for preview
 * @returns {string} Preview text
 */
function generatePreview(content, length = PREVIEW_LENGTH) {
    if (!content) return '';
    if (content.length <= length) return content;
    return content.slice(0, length) + '...';
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get current fronters for author/editor selection
 */
async function getCurrentFronters(system) {
    if (!system?.front?.layers) return [];

    const fronters = [];

    for (const layer of system.front.layers) {
        for (const shiftId of layer.shifts || []) {
            const shift = await Shift.findById(shiftId);
            if (shift && !shift.endTime) {
                fronters.push({
                    id: shift.ID,
                    type: shift.s_type,
                    name: shift.type_name
                });
            }
        }
    }

    return fronters;
}

/**
 * Check if user has access to a note
 */
function getNoteAccess(note, userId) {
    const userIdStr = userId.toString();

    if (note.users.owner.userID?.toString() === userIdStr) {
        return 'owner';
    }

    if (note.users.rwAccess?.some(a => a.userID?.toString() === userIdStr)) {
        return 'rw';
    }

    if (note.users.rAccess?.some(a => a.userID?.toString() === userIdStr)) {
        return 'r';
    }

    return null;
}

/**
 * Build note view embed with pagination
 * @param {Object} note - Note document
 * @param {string} content - Full content fetched from R2
 * @param {number} page - Current page (0-indexed)
 * @param {string} access - Access level
 */
function buildNoteEmbed(note, content, page = 0, access = 'r') {
    const fullContent = content || '';
    const totalPages = Math.ceil(fullContent.length / CHARS_PER_PAGE) || 1;
    const currentPage = Math.min(page, totalPages - 1);

    const startIdx = currentPage * CHARS_PER_PAGE;
    const endIdx = startIdx + CHARS_PER_PAGE;
    const pageContent = fullContent.slice(startIdx, endIdx);

    const embed = new EmbedBuilder()
        .setColor(NOTE_COLORS[note.color] || NOTE_COLORS.default)
        .setTitle(`${note.pinned ? '📌 ' : ''}${note.title || 'Untitled Note'}`)
        .setDescription(pageContent || '*No content*')
        .setTimestamp(note.updatedAt);

    // Add tags if present
    if (note.tags?.length > 0) {
        embed.addFields({
            name: '🏷️ Tags',
            value: note.tags.map(t => `\`${t}\``).join(' '),
            inline: true
        });
    }

    // Add access level indicator
    const accessEmoji = access === 'owner' ? '👑' : (access === 'rw' ? '✏️' : '👁️');
    embed.addFields({
        name: 'Access',
        value: `${accessEmoji} ${access === 'owner' ? 'Owner' : (access === 'rw' ? 'Read/Write' : 'Read Only')}`,
        inline: true
    });

    // Add media count if present
    if (note.media?.length > 0) {
        embed.addFields({
            name: '📎 Media',
            value: `${note.media.length} attachment(s)`,
            inline: true
        });
    }

    // Footer with pagination and note ID
    embed.setFooter({
        text: `Page ${currentPage + 1}/${totalPages} • ID: ${note.id.slice(-8)}`
    });

    return { embed, totalPages, currentPage };
}

/**
 * Build note view components
 */
function buildNoteComponents(noteId, currentPage, totalPages, totalMedia, mediaPage = 0, access = 'r') {
    const rows = [];

    // Text pagination row (if needed)
    if (totalPages > 1) {
        const textNavRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`note_page_prev_${noteId}_${currentPage}`)
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(`note_page_info_${noteId}`)
                .setLabel(`${currentPage + 1}/${totalPages}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`note_page_next_${noteId}_${currentPage}`)
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage >= totalPages - 1)
        );
        rows.push(textNavRow);
    }

    // Media pagination row (if needed)
    if (totalMedia > 0) {
        const mediaPages = Math.ceil(totalMedia / MEDIA_PER_MESSAGE);
        const mediaNavRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`note_media_prev_${noteId}_${mediaPage}`)
                .setEmoji('⏪')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(mediaPage === 0),
            new ButtonBuilder()
                .setCustomId(`note_media_show_${noteId}_${mediaPage}`)
                .setLabel(`Media ${mediaPage + 1}/${mediaPages}`)
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`note_media_next_${noteId}_${mediaPage}`)
                .setEmoji('⏩')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(mediaPage >= mediaPages - 1)
        );
        rows.push(mediaNavRow);
    }

    // Action buttons row
    const actionRow = new ActionRowBuilder();

    if (access === 'owner' || access === 'rw') {
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`note_edit_${noteId}`)
                .setLabel('Edit')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✏️')
        );
    }

    actionRow.addComponents(
        new ButtonBuilder()
            .setCustomId(`note_refresh_${noteId}`)
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔄')
    );

    if (access === 'owner') {
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`note_delete_confirm_${noteId}`)
                .setLabel('Delete')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️')
        );
    }

    rows.push(actionRow);

    return rows;
}

/**
 * Build fronter selection menu
 */
function buildFronterSelectMenu(fronters, sessionId, action = 'create') {
    if (fronters.length === 0) return null;

    const options = fronters.map(f =>
        new StringSelectMenuOptionBuilder()
            .setLabel(f.name)
            .setValue(`${f.type}:${f.id}`)
            .setEmoji(f.type === 'alter' ? '🎭' : (f.type === 'state' ? '🔄' : '👥'))
    );

    // Add "None" option
    options.unshift(
        new StringSelectMenuOptionBuilder()
            .setLabel('Just me (no specific entity)')
            .setValue('none')
            .setEmoji('👤')
    );

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`note_fronter_select_${action}_${sessionId}`)
            .setPlaceholder(`Who is ${action === 'create' ? 'creating' : 'editing'} this note?`)
            .setMinValues(1)
            .setMaxValues(Math.min(fronters.length + 1, 25))
            .addOptions(options)
    );
}

/**
 * Parse fronter selection values
 */
function parseFronterSelection(values) {
    if (values.includes('none') && values.length === 1) {
        return [];
    }

    return values
        .filter(v => v !== 'none')
        .map(v => {
            const [type, id] = v.split(':');
            return { ID: id, s_type: type };
        });
}

/**
 * Add note to user's notes array
 */
async function addNoteToUser(userId, noteId) {
    await User.findByIdAndUpdate(userId, {
        $addToSet: { 'notes.notes': noteId }
    });
}

/**
 * Remove note from user's notes array
 */
async function removeNoteFromUser(userId, noteId) {
    await User.findByIdAndUpdate(userId, {
        $pull: { 'notes.notes': noteId }
    });
}

/**
 * Share note with system users if autoShare is enabled
 */
async function autoShareToSystemUsers(note, system, ownerUserId) {
    if (!system?.setting?.autoshareNotestoUsers) return;

    // Find all users connected to this system
    const systemUsers = await User.find({
        systemID: system._id,
        _id: { $ne: ownerUserId }
    });

    for (const sysUser of systemUsers) {
        // Add to rwAccess
        note.users.rwAccess.push({ userID: sysUser._id });

        // Add to user's notes array
        await addNoteToUser(sysUser._id, note._id);
    }

    await note.save();
}

// ============================================
// COMMAND HANDLERS
// ============================================

/**
 * Handle /note create
 */
async function handleCreate(interaction, user, system) {
    const fronters = await getCurrentFronters(system);
    const sessionId = utils.generateSessionId(interaction.user.id);

    utils.setSession(sessionId, {
        userId: user._id.toString(),
        systemId: system?._id?.toString(),
        action: 'create',
        fronters: fronters
    });

    // If multiple fronters, ask who's creating
    if (fronters.length > 1) {
        const selectMenu = buildFronterSelectMenu(fronters, sessionId, 'create');

        const embed = new EmbedBuilder()
            .setColor(NOTE_COLORS.default)
            .setTitle('📝 Create New Note')
            .setDescription('Multiple entities are currently fronting. Who is creating this note?')
            .setFooter({ text: 'You can select multiple entities' });

        return interaction.reply({
            embeds: [embed],
            components: [selectMenu],
            ephemeral: true
        });
    }

    // Single or no fronter - go directly to modal
    const authorSubs = fronters.length === 1
        ? [{ ID: fronters[0].id, s_type: fronters[0].type }]
        : [];

    utils.setSession(sessionId, {
        ...utils.getSession(sessionId),
        authorSubs
    });

    const modal = buildCreateNoteModal(sessionId);
    return interaction.showModal(modal);
}

/**
 * Build create note modal
 */
function buildCreateNoteModal(sessionId) {
    return new ModalBuilder()
        .setCustomId(`note_create_modal_${sessionId}`)
        .setTitle('Create New Note')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('title')
                    .setLabel('Title')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Note title')
                    .setRequired(false)
                    .setMaxLength(100)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('content')
                    .setLabel('Content')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Write your note here...')
                    .setRequired(false)
                    .setMaxLength(4000)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('tags')
                    .setLabel('Tags (comma-separated)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('personal, ideas, todo')
                    .setRequired(false)
                    .setMaxLength(200)
            )
        );
}

/**
 * Handle /note view
 */
async function handleView(interaction, user, system) {
    const noteId = interaction.options.getString('note_id');

    const note = await Note.findOne({ id: noteId });

    if (!note) {
        return interaction.reply({
            content: '❌ Note not found.',
            ephemeral: true
        });
    }

    const access = getNoteAccess(note, user._id);

    if (!access) {
        return interaction.reply({
            content: '❌ You don\'t have access to this note.',
            ephemeral: true
        });
    }

    await interaction.deferReply({ ephemeral: true });

    // Fetch content from R2
    let content = '';
    if (note.content?.r2Key) {
        content = await fetchNoteContent(note.content.r2Key) || '';
    }

    const { embed, totalPages, currentPage } = buildNoteEmbed(note, content, 0, access);
    const components = buildNoteComponents(noteId, currentPage, totalPages, note.media?.length || 0, 0, access);

    return interaction.editReply({
        embeds: [embed],
        components
    });
}

/**
 * Handle /note edit
 */
async function handleEdit(interaction, user, system) {
    const noteId = interaction.options.getString('note_id');

    const note = await Note.findOne({ id: noteId });

    if (!note) {
        return interaction.reply({
            content: '❌ Note not found.',
            ephemeral: true
        });
    }

    const access = getNoteAccess(note, user._id);

    if (access !== 'owner' && access !== 'rw') {
        return interaction.reply({
            content: '❌ You don\'t have write access to this note.',
            ephemeral: true
        });
    }

    const fronters = await getCurrentFronters(system);
    const sessionId = utils.generateSessionId(interaction.user.id);

    // Fetch current content from R2 for pre-filling modal
    let currentContent = '';
    if (note.content?.r2Key) {
        currentContent = await fetchNoteContent(note.content.r2Key) || '';
    }

    utils.setSession(sessionId, {
        userId: user._id.toString(),
        systemId: system?._id?.toString(),
        noteId: noteId,
        action: 'edit',
        fronters: fronters,
        currentContent: currentContent.slice(0, 4000) // Modal limit
    });

    // If multiple fronters, ask who's editing
    if (fronters.length > 1) {
        const selectMenu = buildFronterSelectMenu(fronters, sessionId, 'edit');

        const embed = new EmbedBuilder()
            .setColor(note.color ? NOTE_COLORS[note.color] : NOTE_COLORS.default)
            .setTitle(`✏️ Edit: ${note.title || 'Untitled Note'}`)
            .setDescription('Multiple entities are currently fronting. Who is editing this note?')
            .setFooter({ text: 'You can select multiple entities' });

        return interaction.reply({
            embeds: [embed],
            components: [selectMenu],
            ephemeral: true
        });
    }

    // Single or no fronter - go directly to modal
    const modal = buildEditNoteModal(sessionId, note, currentContent);
    return interaction.showModal(modal);
}

/**
 * Build edit note modal
 */
function buildEditNoteModal(sessionId, note, currentContent = '') {
    return new ModalBuilder()
        .setCustomId(`note_edit_modal_${sessionId}`)
        .setTitle('Edit Note')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('title')
                    .setLabel('Title')
                    .setStyle(TextInputStyle.Short)
                    .setValue(note.title || '')
                    .setPlaceholder('Note title')
                    .setRequired(false)
                    .setMaxLength(100)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('content')
                    .setLabel('Content')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(currentContent.slice(0, 4000))
                    .setPlaceholder('Write your note here...')
                    .setRequired(false)
                    .setMaxLength(4000)
            )
        );
}

/**
 * Handle /note delete
 */
async function handleDelete(interaction, user, system) {
    const noteId = interaction.options.getString('note_id');

    const note = await Note.findOne({ id: noteId });

    if (!note) {
        return interaction.reply({
            content: '❌ Note not found.',
            ephemeral: true
        });
    }

    const access = getNoteAccess(note, user._id);

    if (access !== 'owner') {
        return interaction.reply({
            content: '❌ Only the owner can delete this note.',
            ephemeral: true
        });
    }

    // Show confirmation
    const embed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('🗑️ Delete Note?')
        .setDescription(`Are you sure you want to delete **${note.title || 'Untitled Note'}**?\n\nThis action cannot be undone.`);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`note_delete_yes_${noteId}`)
            .setLabel('Yes, Delete')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`note_delete_no_${noteId}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });
}

/**
 * Handle /note list
 */
async function handleList(interaction, user, system) {
    const filter = interaction.options.getString('filter') || 'all';

    let query = {};

    switch (filter) {
        case 'owned':
            query = { 'users.owner.userID': user._id };
            break;
        case 'shared':
            query = {
                $or: [
                    { 'users.rwAccess.userID': user._id },
                    { 'users.rAccess.userID': user._id }
                ]
            };
            break;
        case 'pinned':
            query = {
                pinned: true,
                $or: [
                    { 'users.owner.userID': user._id },
                    { 'users.rwAccess.userID': user._id },
                    { 'users.rAccess.userID': user._id }
                ]
            };
            break;
        default: // all
            query = {
                $or: [
                    { 'users.owner.userID': user._id },
                    { 'users.rwAccess.userID': user._id },
                    { 'users.rAccess.userID': user._id }
                ]
            };
    }

    const notes = await Note.find(query)
        .sort({ pinned: -1, updatedAt: -1 })
        .limit(25);

    if (notes.length === 0) {
        return interaction.reply({
            content: `📭 No notes found${filter !== 'all' ? ` with filter: ${filter}` : ''}.`,
            ephemeral: true
        });
    }

    const embed = new EmbedBuilder()
        .setColor(NOTE_COLORS.default)
        .setTitle('📝 Your Notes')
        .setDescription(notes.map(note => {
            const access = getNoteAccess(note, user._id);
            const accessEmoji = access === 'owner' ? '👑' : (access === 'rw' ? '✏️' : '👁️');
            const pinEmoji = note.pinned ? '📌 ' : '';
            const title = note.title || 'Untitled';
            // Use contentPreview instead of content directly
            const preview = note.contentPreview?.slice(0, 50) || '*No content*';
            return `${pinEmoji}**${title}** ${accessEmoji}\n\`${note.id.slice(-8)}\` • ${preview}${note.contentPreview?.length > 50 ? '...' : ''}`;
        }).join('\n\n'))
        .setFooter({ text: `${notes.length} note(s) • Filter: ${filter}` });

    return interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
}

/**
 * Handle /note share
 */
async function handleShare(interaction, user, system) {
    const noteId = interaction.options.getString('note_id');
    const targetDiscordUser = interaction.options.getUser('user');
    const accessLevel = interaction.options.getString('access');

    const note = await Note.findOne({ id: noteId });

    if (!note) {
        return interaction.reply({
            content: '❌ Note not found.',
            ephemeral: true
        });
    }

    const access = getNoteAccess(note, user._id);

    if (access !== 'owner' && access !== 'rw') {
        return interaction.reply({
            content: '❌ You don\'t have permission to share this note.',
            ephemeral: true
        });
    }

    // Find target user
    const targetUser = await User.findOne({ discordID: targetDiscordUser.id });

    if (!targetUser) {
        return interaction.reply({
            content: '❌ That user hasn\'t set up their account yet.',
            ephemeral: true
        });
    }

    // Check if already has access
    const existingAccess = getNoteAccess(note, targetUser._id);
    if (existingAccess) {
        // Update access level
        if (existingAccess !== 'owner') {
            note.users.rwAccess = note.users.rwAccess.filter(a => a.userID?.toString() !== targetUser._id.toString());
            note.users.rAccess = note.users.rAccess.filter(a => a.userID?.toString() !== targetUser._id.toString());
        }
    }

    // Add new access
    if (accessLevel === 'rw') {
        note.users.rwAccess.push({ userID: targetUser._id });
    } else {
        note.users.rAccess.push({ userID: targetUser._id });
    }

    await note.save();

    // Add to target user's notes array
    await addNoteToUser(targetUser._id, note._id);

    const accessName = accessLevel === 'rw' ? 'Read/Write' : 'Read Only';

    return interaction.reply({
        content: `✅ Shared **${note.title || 'Untitled Note'}** with <@${targetDiscordUser.id}> (${accessName} access).`,
        ephemeral: true
    });
}

/**
 * Handle /note unshare
 */
async function handleUnshare(interaction, user, system) {
    const noteId = interaction.options.getString('note_id');
    const targetDiscordUser = interaction.options.getUser('user');

    const note = await Note.findOne({ id: noteId });

    if (!note) {
        return interaction.reply({
            content: '❌ Note not found.',
            ephemeral: true
        });
    }

    const access = getNoteAccess(note, user._id);

    if (access !== 'owner') {
        return interaction.reply({
            content: '❌ Only the owner can remove access.',
            ephemeral: true
        });
    }

    // Find target user
    const targetUser = await User.findOne({ discordID: targetDiscordUser.id });

    if (!targetUser) {
        return interaction.reply({
            content: '❌ User not found.',
            ephemeral: true
        });
    }

    // Remove access
    note.users.rwAccess = note.users.rwAccess.filter(a => a.userID?.toString() !== targetUser._id.toString());
    note.users.rAccess = note.users.rAccess.filter(a => a.userID?.toString() !== targetUser._id.toString());

    await note.save();

    // Remove from target user's notes array
    await removeNoteFromUser(targetUser._id, note._id);

    return interaction.reply({
        content: `✅ Removed <@${targetDiscordUser.id}>'s access to **${note.title || 'Untitled Note'}**.`,
        ephemeral: true
    });
}

/**
 * Handle /note transfer
 */
async function handleTransfer(interaction, user, system) {
    const noteId = interaction.options.getString('note_id');
    const targetDiscordUser = interaction.options.getUser('user');

    const note = await Note.findOne({ id: noteId });

    if (!note) {
        return interaction.reply({
            content: '❌ Note not found.',
            ephemeral: true
        });
    }

    const access = getNoteAccess(note, user._id);

    if (access !== 'owner') {
        return interaction.reply({
            content: '❌ Only the owner can transfer ownership.',
            ephemeral: true
        });
    }

    // Find target user
    const targetUser = await User.findOne({ discordID: targetDiscordUser.id });

    if (!targetUser) {
        return interaction.reply({
            content: '❌ That user hasn\'t set up their account yet.',
            ephemeral: true
        });
    }

    // Transfer ownership
    const oldOwnerId = note.users.owner.userID;
    note.users.owner = { userID: targetUser._id };

    // Remove new owner from rwAccess/rAccess if present
    note.users.rwAccess = note.users.rwAccess.filter(a => a.userID?.toString() !== targetUser._id.toString());
    note.users.rAccess = note.users.rAccess.filter(a => a.userID?.toString() !== targetUser._id.toString());

    // Add old owner to rwAccess
    note.users.rwAccess.push({ userID: oldOwnerId });

    await note.save();

    // Update notes arrays
    await addNoteToUser(targetUser._id, note._id);

    return interaction.reply({
        content: `✅ Transferred ownership of **${note.title || 'Untitled Note'}** to <@${targetDiscordUser.id}>.\n\nYou now have Read/Write access.`,
        ephemeral: true
    });
}

/**
 * Handle /note color
 */
async function handleColor(interaction, user, system) {
    const noteId = interaction.options.getString('note_id');
    const color = interaction.options.getString('color');

    const note = await Note.findOne({ id: noteId });

    if (!note) {
        return interaction.reply({
            content: '❌ Note not found.',
            ephemeral: true
        });
    }

    const access = getNoteAccess(note, user._id);

    if (access !== 'owner') {
        return interaction.reply({
            content: '❌ Only the owner can change the note color.',
            ephemeral: true
        });
    }

    note.color = color;
    await note.save();

    const colorEmojis = {
        default: '🔵', red: '🔴', orange: '🟠', yellow: '🟡',
        green: '🟢', blue: '🔵', purple: '🟣', pink: '🩷', gray: '⚪'
    };

    return interaction.reply({
        content: `✅ Changed color of **${note.title || 'Untitled Note'}** to ${colorEmojis[color]} ${color}.`,
        ephemeral: true
    });
}

/**
 * Handle /note pin
 */
async function handlePin(interaction, user, system) {
    const noteId = interaction.options.getString('note_id');

    const note = await Note.findOne({ id: noteId });

    if (!note) {
        return interaction.reply({
            content: '❌ Note not found.',
            ephemeral: true
        });
    }

    const access = getNoteAccess(note, user._id);

    if (!access) {
        return interaction.reply({
            content: '❌ You don\'t have access to this note.',
            ephemeral: true
        });
    }

    note.pinned = !note.pinned;
    await note.save();

    return interaction.reply({
        content: `✅ ${note.pinned ? '📌 Pinned' : '📍 Unpinned'} **${note.title || 'Untitled Note'}**.`,
        ephemeral: true
    });
}

/**
 * Handle /note tags
 */
async function handleTags(interaction, user, system) {
    const noteId = interaction.options.getString('note_id');
    const tagsInput = interaction.options.getString('tags');

    const note = await Note.findOne({ id: noteId });

    if (!note) {
        return interaction.reply({
            content: '❌ Note not found.',
            ephemeral: true
        });
    }

    const access = getNoteAccess(note, user._id);

    if (access !== 'owner' && access !== 'rw') {
        return interaction.reply({
            content: '❌ You don\'t have write access to this note.',
            ephemeral: true
        });
    }

    note.tags = utils.parseCommaSeparated(tagsInput);
    await note.save();

    return interaction.reply({
        content: `✅ Updated tags: ${note.tags.map(t => `\`${t}\``).join(' ') || '*None*'}`,
        ephemeral: true
    });
}

/**
 * Handle /note media add
 */
async function handleMediaAdd(interaction, user, system) {
    const noteId = interaction.options.getString('note_id');
    const url = interaction.options.getString('url');
    const caption = interaction.options.getString('caption');

    const note = await Note.findOne({ id: noteId });

    if (!note) {
        return interaction.reply({
            content: '❌ Note not found.',
            ephemeral: true
        });
    }

    const access = getNoteAccess(note, user._id);

    if (access !== 'owner' && access !== 'rw') {
        return interaction.reply({
            content: '❌ You don\'t have write access to this note.',
            ephemeral: true
        });
    }

    // Add media
    const position = (note.media?.length || 0) + 1;
    if (!note.media) note.media = [];

    note.media.push({
        media: {
            r2Key: '', // External URL, no R2 key
            url: url,
            uploadedAt: new Date()
        },
        position,
        caption: caption || undefined
    });

    await note.save();

    return interaction.reply({
        content: `✅ Added media to **${note.title || 'Untitled Note'}** at position ${position}.`,
        ephemeral: true
    });
}

/**
 * Handle /note media remove
 */
async function handleMediaRemove(interaction, user, system) {
    const noteId = interaction.options.getString('note_id');
    const position = interaction.options.getInteger('position');

    const note = await Note.findOne({ id: noteId });

    if (!note) {
        return interaction.reply({
            content: '❌ Note not found.',
            ephemeral: true
        });
    }

    const access = getNoteAccess(note, user._id);

    if (access !== 'owner' && access !== 'rw') {
        return interaction.reply({
            content: '❌ You don\'t have write access to this note.',
            ephemeral: true
        });
    }

    // Find and remove media at position
    const mediaIndex = note.media?.findIndex(m => m.position === position);

    if (mediaIndex === -1 || mediaIndex === undefined) {
        return interaction.reply({
            content: `❌ No media found at position ${position}.`,
            ephemeral: true
        });
    }

    note.media.splice(mediaIndex, 1);

    // Reorder positions
    note.media.forEach((m, i) => m.position = i + 1);

    await note.save();

    return interaction.reply({
        content: `✅ Removed media at position ${position} from **${note.title || 'Untitled Note'}**.`,
        ephemeral: true
    });
}

// ============================================
// BUTTON INTERACTION HANDLER
// ============================================

async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;
    const user = await User.findOne({ discordID: interaction.user.id });

    if (!user) {
        return interaction.reply({
            content: '❌ You need to set up your account first.',
            ephemeral: true
        });
    }

    // Page navigation
    if (customId.startsWith('note_page_prev_') || customId.startsWith('note_page_next_')) {
        const parts = customId.split('_');
        const noteId = parts[3];
        const currentPage = parseInt(parts[4]);
        const newPage = customId.includes('prev') ? currentPage - 1 : currentPage + 1;

        const note = await Note.findOne({ id: noteId });
        if (!note) return interaction.reply({ content: '❌ Note not found.', ephemeral: true });

        const access = getNoteAccess(note, user._id);
        if (!access) return interaction.reply({ content: '❌ Access denied.', ephemeral: true });

        // Fetch content from R2
        let content = '';
        if (note.content?.r2Key) {
            content = await fetchNoteContent(note.content.r2Key) || '';
        }

        const { embed, totalPages, currentPage: page } = buildNoteEmbed(note, content, newPage, access);
        const components = buildNoteComponents(noteId, page, totalPages, note.media?.length || 0, 0, access);

        return interaction.update({ embeds: [embed], components });
    }

    // Media navigation
    if (customId.startsWith('note_media_show_') || customId.startsWith('note_media_prev_') || customId.startsWith('note_media_next_')) {
        const parts = customId.split('_');
        const noteId = parts[3];
        let mediaPage = parseInt(parts[4]);

        if (customId.includes('prev')) mediaPage--;
        else if (customId.includes('next')) mediaPage++;

        const note = await Note.findOne({ id: noteId });
        if (!note) return interaction.reply({ content: '❌ Note not found.', ephemeral: true });

        const access = getNoteAccess(note, user._id);
        if (!access) return interaction.reply({ content: '❌ Access denied.', ephemeral: true });

        // Get media for this page
        const startIdx = mediaPage * MEDIA_PER_MESSAGE;
        const endIdx = startIdx + MEDIA_PER_MESSAGE;
        const mediaItems = note.media?.slice(startIdx, endIdx) || [];

        if (mediaItems.length === 0) {
            return interaction.reply({ content: '❌ No media on this page.', ephemeral: true });
        }

        // Build media message
        const mediaContent = mediaItems.map(m => {
            let line = m.media?.url || '';
            if (m.caption) line += `\n*${m.caption}*`;
            return line;
        }).join('\n\n');

        return interaction.reply({
            content: `📎 **Media (Page ${mediaPage + 1})**\n\n${mediaContent}`,
            ephemeral: true
        });
    }

    // Edit button
    if (customId.startsWith('note_edit_')) {
        const noteId = customId.replace('note_edit_', '');
        const note = await Note.findOne({ id: noteId });

        if (!note) return interaction.reply({ content: '❌ Note not found.', ephemeral: true });

        const access = getNoteAccess(note, user._id);
        if (access !== 'owner' && access !== 'rw') {
            return interaction.reply({ content: '❌ You don\'t have write access.', ephemeral: true });
        }

        const system = user.systemID ? await System.findById(user.systemID) : null;
        const fronters = await getCurrentFronters(system);
        const sessionId = utils.generateSessionId(interaction.user.id);

        // Fetch current content from R2
        let currentContent = '';
        if (note.content?.r2Key) {
            currentContent = await fetchNoteContent(note.content.r2Key) || '';
        }

        utils.setSession(sessionId, {
            userId: user._id.toString(),
            systemId: system?._id?.toString(),
            noteId: noteId,
            action: 'edit',
            fronters: fronters,
            currentContent: currentContent.slice(0, 4000)
        });

        // If multiple fronters, ask who's editing
        if (fronters.length > 1) {
            const selectMenu = buildFronterSelectMenu(fronters, sessionId, 'edit');

            return interaction.reply({
                content: 'Who is editing this note?',
                components: [selectMenu],
                ephemeral: true
            });
        }

        const modal = buildEditNoteModal(sessionId, note, currentContent);
        return interaction.showModal(modal);
    }

    // Refresh button
    if (customId.startsWith('note_refresh_')) {
        const noteId = customId.replace('note_refresh_', '');
        const note = await Note.findOne({ id: noteId });

        if (!note) return interaction.reply({ content: '❌ Note not found.', ephemeral: true });

        const access = getNoteAccess(note, user._id);
        if (!access) return interaction.reply({ content: '❌ Access denied.', ephemeral: true });

        // Fetch content from R2
        let content = '';
        if (note.content?.r2Key) {
            content = await fetchNoteContent(note.content.r2Key) || '';
        }

        const { embed, totalPages, currentPage } = buildNoteEmbed(note, content, 0, access);
        const components = buildNoteComponents(noteId, currentPage, totalPages, note.media?.length || 0, 0, access);

        return interaction.update({ embeds: [embed], components });
    }

    // Delete confirmation
    if (customId.startsWith('note_delete_yes_')) {
        const noteId = customId.replace('note_delete_yes_', '');
        const note = await Note.findOne({ id: noteId });

        if (!note) return interaction.reply({ content: '❌ Note not found.', ephemeral: true });

        const access = getNoteAccess(note, user._id);
        if (access !== 'owner') {
            return interaction.reply({ content: '❌ Only the owner can delete this note.', ephemeral: true });
        }

        const title = note.title || 'Untitled Note';

        // Delete content from R2
        if (note.content?.r2Key) {
            await deleteNoteContent(note.content.r2Key);
        }

        // Delete any media from R2 (if stored there)
        for (const media of note.media || []) {
            if (media.media?.r2Key) {
                await deleteNoteContent(media.media.r2Key);
            }
        }

        // Remove from all users' notes arrays
        await User.updateMany(
            { 'notes.notes': note._id },
            { $pull: { 'notes.notes': note._id } }
        );

        // Delete note
        await Note.deleteOne({ id: noteId });

        return interaction.update({
            content: `✅ Deleted **${title}**.`,
            embeds: [],
            components: []
        });
    }

    // Delete cancel
    if (customId.startsWith('note_delete_no_')) {
        return interaction.update({
            content: '❌ Deletion cancelled.',
            embeds: [],
            components: []
        });
    }

    // Delete confirm button from view
    if (customId.startsWith('note_delete_confirm_')) {
        const noteId = customId.replace('note_delete_confirm_', '');
        const note = await Note.findOne({ id: noteId });

        if (!note) return interaction.reply({ content: '❌ Note not found.', ephemeral: true });

        const access = getNoteAccess(note, user._id);
        if (access !== 'owner') {
            return interaction.reply({ content: '❌ Only the owner can delete this note.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('🗑️ Delete Note?')
            .setDescription(`Are you sure you want to delete **${note.title || 'Untitled Note'}**?\n\nThis action cannot be undone.`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`note_delete_yes_${noteId}`)
                .setLabel('Yes, Delete')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`note_delete_no_${noteId}`)
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });
    }
}

// ============================================
// SELECT MENU HANDLER
// ============================================

async function handleSelectMenu(interaction) {
    const customId = interaction.customId;

    if (!customId.startsWith('note_fronter_select_')) return;

    const parts = customId.split('_');
    const action = parts[3]; // 'create' or 'edit'
    const sessionId = parts[4];

    const session = utils.getSession(sessionId);
    if (!session) {
        return interaction.reply({
            content: '❌ Session expired. Please try again.',
            ephemeral: true
        });
    }

    const subs = parseFronterSelection(interaction.values);

    utils.setSession(sessionId, {
        ...session,
        authorSubs: action === 'create' ? subs : undefined,
        editorSubs: action === 'edit' ? subs : undefined
    });

    if (action === 'create') {
        const modal = buildCreateNoteModal(sessionId);
        return interaction.showModal(modal);
    } else {
        const note = await Note.findOne({ id: session.noteId });
        if (!note) {
            return interaction.reply({ content: '❌ Note not found.', ephemeral: true });
        }
        const modal = buildEditNoteModal(sessionId, note, session.currentContent || '');
        return interaction.showModal(modal);
    }
}

// ============================================
// MODAL SUBMIT HANDLER
// ============================================

async function handleModalSubmit(interaction) {
    const customId = interaction.customId;

    // Create note modal
    if (customId.startsWith('note_create_modal_')) {
        const sessionId = customId.replace('note_create_modal_', '');
        const session = utils.getSession(sessionId);

        if (!session) {
            return interaction.reply({
                content: '❌ Session expired. Please try again.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const title = interaction.fields.getTextInputValue('title');
        const content = interaction.fields.getTextInputValue('content');
        const tagsInput = interaction.fields.getTextInputValue('tags');

        const user = await User.findById(session.userId);
        const system = session.systemId ? await System.findById(session.systemId) : null;

        // Create note first to get the ID
        const note = new Note({
            author: {
                userID: user._id,
                subs: session.authorSubs || []
            },
            users: {
                owner: {
                    userID: user._id,
                    subs: session.authorSubs || []
                },
                rwAccess: [],
                rAccess: []
            },
            title: title || undefined,
            tags: tagsInput ? utils.parseCommaSeparated(tagsInput) : [],
            pinned: false,
            contentPreview: generatePreview(content)
        });

        await note.save();

        // Upload content to R2 if there is content
        if (content) {
            try {
                const contentMedia = await uploadNoteContent(user._id.toString(), note.id, content);
                note.content = contentMedia;
                await note.save();
            } catch (error) {
                console.error('Failed to upload note content:', error);
                // Note is created but content upload failed
                return interaction.editReply({
                    content: `⚠️ Note created but content upload failed. Please try editing the note to add content.\n\n**Note ID:** \`${note.id}\``
                });
            }
        }

        // Add to user's notes array
        await addNoteToUser(user._id, note._id);

        // Auto-share if enabled
        await autoShareToSystemUsers(note, system, user._id);

        utils.deleteSession(sessionId);

        const embed = new EmbedBuilder()
            .setColor(NOTE_COLORS.default)
            .setTitle('✅ Note Created')
            .setDescription(`**${title || 'Untitled Note'}** has been created.`)
            .addFields(
                { name: 'Note ID', value: `\`${note.id}\``, inline: true }
            );

        if (session.authorSubs?.length > 0) {
            const authorNames = session.fronters
                ?.filter(f => session.authorSubs.some(s => s.ID === f.id))
                .map(f => f.name)
                .join(', ');
            if (authorNames) {
                embed.addFields({ name: 'Author', value: authorNames, inline: true });
            }
        }

        return interaction.editReply({
            embeds: [embed]
        });
    }

    // Edit note modal
    if (customId.startsWith('note_edit_modal_')) {
        const sessionId = customId.replace('note_edit_modal_', '');
        const session = utils.getSession(sessionId);

        if (!session) {
            return interaction.reply({
                content: '❌ Session expired. Please try again.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const title = interaction.fields.getTextInputValue('title');
        const content = interaction.fields.getTextInputValue('content');

        const note = await Note.findOne({ id: session.noteId });
        if (!note) {
            return interaction.editReply({
                content: '❌ Note not found.'
            });
        }

        const user = await User.findById(session.userId);

        note.title = title || undefined;
        note.contentPreview = generatePreview(content);

        // Upload new content to R2
        if (content) {
            try {
                // Delete old content if exists
                if (note.content?.r2Key) {
                    await deleteNoteContent(note.content.r2Key);
                }

                const contentMedia = await uploadNoteContent(user._id.toString(), note.id, content);
                note.content = contentMedia;
            } catch (error) {
                console.error('Failed to upload note content:', error);
                return interaction.editReply({
                    content: '⚠️ Failed to save content. Please try again.'
                });
            }
        } else {
            // Clear content if empty
            if (note.content?.r2Key) {
                await deleteNoteContent(note.content.r2Key);
            }
            note.content = undefined;
        }

        await note.save();

        utils.deleteSession(sessionId);

        return interaction.editReply({
            content: `✅ Updated **${note.title || 'Untitled Note'}**.`
        });
    }
}