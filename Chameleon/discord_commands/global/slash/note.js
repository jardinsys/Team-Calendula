// (/note) - Systemiser Notes Command
// Quick note creation with embedded app launch

// (/note [quick:boolean])
//   quick:false (default) → Launches Discord Activity on notes page
//   quick:true → Opens quick note modal directly

const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    REST,
    Routes
} = require('discord.js');

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const Note = require('../../../schemas/note');
const System = require('../../../schemas/system');
const User = require('../../../schemas/user');
const { Shift } = require('../../../schemas/front');
const config = require('../../../config.json');
const utils = require('../../functions/bot_utils');
const redis = require('../../../redis');

// Use shared R2 client from bot_utils
const { sysR2 } = utils;

// Constants
const PREVIEW_LENGTH = 500;
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

const WEBAPP_URL = 'https://systemise.teamcalendula.net';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('note')
        .setDescription('Manage your notes')
        .addBooleanOption(opt => opt
            .setName('quick')
            .setDescription('Open quick note form (opens app launcher if false)')
            .setRequired(false)),

    async execute(interaction) {
        const quick = interaction.options.getBoolean('quick') ?? false;
        const { user, system, isNew } = await utils.getOrCreateUserAndSystem(interaction);

        if (isNew) return await utils.handleNewUserFlow(interaction, 'note');

        switch (quick) {
            case true: return await handleQuick(interaction, user, system);
            case false: return await handleLaunch(interaction, user, system);
        }
    },

    handleButtonInteraction,
    handleModalSubmit
};

// ============================================
// R2 STORAGE FUNCTIONS
// ============================================

async function uploadNoteContent(userId, noteId, content) {
    try {
        const r2Key = `notes/${userId}/${noteId}.md`;

        const command = new PutObjectCommand({
            Bucket: config.r2.system.app.bucketName,
            Key: r2Key,
            Body: content,
            ContentType: 'text/markdown; charset=utf-8',
        });

        await sysR2.send(command);

        const publicUrl = `${config.r2.system.app.publicURL}/${r2Key}`;

        return {
            r2Key: r2Key,
            url: publicUrl,
            filename: `${noteId}.md`,
            mimeType: 'text/markdown',
            size: Buffer.byteLength(content, 'utf8'),
            uploadedAt: new Date()
        };
    } catch (error) {
        console.error('Error uploading note content to R2:', error);
        throw error;
    }
}

async function fetchNoteContent(r2Key) {
    try {
        const command = new GetObjectCommand({
            Bucket: config.r2.system.app.bucketName,
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

async function deleteNoteContent(r2Key) {
    try {
        if (!r2Key) return;

        const command = new DeleteObjectCommand({
            Bucket: config.r2.system.app.bucketName,
            Key: r2Key,
        });

        await sysR2.send(command);
    } catch (error) {
        console.error('Error deleting note content from R2:', error);
    }
}

function generatePreview(content, length = PREVIEW_LENGTH) {
    if (!content) return '';
    if (content.length <= length) return content;
    return content.slice(0, length) + '...';
}

// ============================================
// HELPER FUNCTIONS
// ============================================

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

function getNoteAccess(note, userId) {
    const userIdStr = userId.toString();

    if (note.users.owner.userID?.toString() === userIdStr) return 'owner';
    if (note.users.rwAccess?.some(a => a.userID?.toString() === userIdStr)) return 'rw';
    if (note.users.rAccess?.some(a => a.userID?.toString() === userIdStr)) return 'r';

    return null;
}

async function addNoteToUser(userId, noteId) {
    await User.findByIdAndUpdate(userId, {
        $addToSet: { 'notes.notes': noteId }
    });
}

async function removeNoteFromUser(userId, noteId) {
    await User.findByIdAndUpdate(userId, {
        $pull: { 'notes.notes': noteId }
    });
}

async function autoShareToSystemUsers(note, system, ownerUserId) {
    if (!system?.setting?.autoshareNotestoUsers) return;

    const systemUsers = await User.find({
        systemID: system._id,
        _id: { $ne: ownerUserId }
    });

    for (const sysUser of systemUsers) {
        note.users.rwAccess.push({ userID: sysUser._id });
        await addNoteToUser(sysUser._id, note._id);
    }

    await note.save();
}

// ============================================
// COMMAND HANDLERS
// ============================================

async function handleLaunch(interaction, user, system) {
    await redis.set(`pendingActivity:${user._id}`, 'notes', 'EX', 60);

    const rest = new REST({ version: '10' }).setToken(interaction.client.token);
    await rest.post(Routes.interactionCallback(interaction.id, interaction.token), {
        body: { type: 12 }
    });
}

async function handleQuick(interaction, user, system) {
    const fronters = await getCurrentFronters(system);
    const sessionId = utils.generateSessionId(interaction.user.id);

    utils.setSession(sessionId, {
        userId: user._id.toString(),
        systemId: system?._id?.toString(),
        fronters: fronters,
        authorSubs: fronters.length > 0 ? fronters.map(f => ({ ID: f.id, s_type: f.type })) : []
    });

    const modal = buildQuickNoteModal(sessionId);
    await interaction.showModal(modal);
}

function buildQuickNoteModal(sessionId) {
    return new ModalBuilder()
        .setCustomId(`note_quick_modal_${sessionId}`)
        .setTitle('Quick Note')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('title')
                    .setLabel('Title')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Note title (optional)')
                    .setRequired(false)
                    .setMaxLength(100)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('content')
                    .setLabel('Content')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Write your note here...')
                    .setRequired(true)
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

// ============================================
// BUTTON HANDLER
// ============================================

async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;

    // Quick Note button from hub
    if (customId.startsWith('note_quick_')) {
        const { user, system } = await utils.getOrCreateUserAndSystem(interaction);
        if (!user) return await interaction.reply({ content: '❌ User not found.', ephemeral: true });

        const fronters = await getCurrentFronters(system);
        const sessionId = utils.generateSessionId(interaction.user.id);

        utils.setSession(sessionId, {
            userId: user._id.toString(),
            systemId: system?._id?.toString(),
            fronters: fronters,
            authorSubs: fronters.length > 0 ? fronters.map(f => ({ ID: f.id, s_type: f.type })) : []
        });

        const modal = buildQuickNoteModal(sessionId);
        return await interaction.showModal(modal);
    }
}

// ============================================
// MODAL SUBMIT HANDLER
// ============================================

async function handleModalSubmit(interaction) {
    const sessionId = utils.extractSessionId(interaction.customId);
    const session = utils.getSession(sessionId);

    if (!session) return await interaction.reply({ content: '❌ Session expired.', ephemeral: true });

    // Quick note modal
    if (interaction.customId.startsWith('note_quick_modal_')) {
        await interaction.deferReply({ ephemeral: true });

        const title = interaction.fields.getTextInputValue('title');
        const content = interaction.fields.getTextInputValue('content');
        const tagsInput = interaction.fields.getTextInputValue('tags');

        const user = await User.findById(session.userId);
        const system = session.systemId ? await System.findById(session.systemId) : null;

        // Create note
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

        // Upload content to R2
        try {
            const contentMedia = await uploadNoteContent(user._id.toString(), note.id, content);
            note.content = contentMedia;
            await note.save();
        } catch (error) {
            console.error('Failed to upload note content:', error);
            return await interaction.editReply({
                content: `⚠️ Note created but content upload failed. Please try editing the note in the app.\n\n**Note ID:** \`${note.id}\``
            });
        }

        // Add to user's notes array
        await addNoteToUser(user._id, note._id);

        // Auto-share if enabled
        await autoShareToSystemUsers(note, system, user._id);

        utils.deleteSession(sessionId);

        const embed = new EmbedBuilder()
            .setColor(NOTE_COLORS.green)
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
                embed.addFields({ name: 'Written By', value: authorNames, inline: true });
            }
        }

        embed.addFields({
            name: 'Actions',
            value: `[Open in App](${WEBAPP_URL}/app/notes/${note._id})`,
            inline: false
        });

        const components = [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Open in Notes App')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${WEBAPP_URL}/app/notes/${note._id}`)
                    .setEmoji('🌐')
            )
        ];

        return await interaction.editReply({ embeds: [embed], components, ephemeral: true });
    }
}
