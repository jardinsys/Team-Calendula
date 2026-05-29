// sys!note - Quick Note Management
// Lightweight version — full management in the webapp
//
// USAGE:
//   sys!note                             - List your notes (brief)
//   sys!note new <title> [content]       - Quick-create a note
//   sys!note <id>                        - View a specific note
//   sys!note <id> delete [-confirm]      - Delete a note

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mongoose = require('mongoose');
const Note = require('../../../schemas/note');
const User = require('../../../schemas/user');
const utils = require('../../functions/bot_utils');

const WEBAPP_URL = 'https://systemise.teamcalendula.net';
const NOTE_COLOR = '#FFD700';

module.exports = {
    name: 'note',
    aliases: ['notes', 'n'],

    async executeMessage(message, args) {
        const { user } = await utils.getOrCreateUserAndSystem(message);
        if (!user) return utils.error(message, 'Could not find or create your user profile.');

        const parsed = utils.parseArgs(args);
        const firstArg = parsed._positional[0]?.toLowerCase();

        if (!firstArg || firstArg === 'help') return handleHelp(message);
        if (firstArg === 'new' || firstArg === 'create') return handleNew(message, parsed, user);

        // Try to find a note by ID or title
        const note = await findNote(firstArg, user);
        if (note) {
            const subcommand = parsed._positional[1]?.toLowerCase();
            if (subcommand === 'delete') return handleDelete(message, parsed, note, user);
            return handleShow(message, note, user);
        }

        // If first arg is "list" or "show"
        if (firstArg === 'list') return handleList(message, user);
        if (firstArg === 'show') {
            const noteId = parsed._positional[1];
            if (!noteId) return utils.error(message, 'Please provide a note ID or title.');
            const foundNote = await findNote(noteId, user);
            if (foundNote) return handleShow(message, foundNote, user);
            return utils.error(message, `Note not found: \`${noteId}\``);
        }

        return utils.error(message, `Note not found: \`${firstArg}\`\nUse \`sys!note new <title>\` to create one or \`sys!note help\` for commands.`);
    }
};

async function findNote(identifier, user) {
    if (!identifier) return null;

    let note = await Note.findOne({ id: identifier });
    if (note && hasAccess(note, user)) return note;

    if (mongoose.Types.ObjectId.isValid(identifier)) {
        note = await Note.findById(identifier);
        if (note && hasAccess(note, user)) return note;
    }

    const userNotes = user.notes?.notes || [];
    if (userNotes.length > 0) {
        note = await Note.findOne({
            _id: { $in: userNotes },
            title: { $regex: new RegExp(utils.escapeRegex(identifier), 'i') }
        });
        if (note) return note;
    }

    note = await Note.findOne({
        $or: [
            { 'users.rAccess.userID': user._id },
            { 'users.rwAccess.userID': user._id }
        ],
        title: { $regex: new RegExp(utils.escapeRegex(identifier), 'i') }
    });

    return note;
}

function hasAccess(note, user) {
    const userId = user._id.toString();
    if (note.users?.owner?.userID?.toString() === userId) return true;
    if (note.author?.userID?.toString() === userId) return true;
    if (note.users?.rAccess?.some(a => a.userID?.toString() === userId)) return true;
    if (note.users?.rwAccess?.some(a => a.userID?.toString() === userId)) return true;
    if (user.notes?.notes?.some(n => n.toString() === note._id.toString())) return true;
    return false;
}

async function handleList(message, user) {
    const noteIds = user.notes?.notes || [];
    if (noteIds.length === 0)
        return utils.info(message, 'You don\'t have any notes yet.\nUse `sys!note new <title>` to create one.');

    const notes = await Note.find({ _id: { $in: noteIds } }).sort({ pinned: -1, updatedAt: -1 }).limit(20);

    const pinned = notes.filter(n => n.pinned);
    const unpinned = notes.filter(n => !n.pinned);

    const embed = new EmbedBuilder()
        .setColor(NOTE_COLOR)
        .setTitle('📝 Your Notes')
        .setDescription(`You have **${notes.length}** note${notes.length !== 1 ? 's' : ''}`);

    if (pinned.length > 0) {
        embed.addFields({
            name: `📌 Pinned (${pinned.length})`,
            value: pinned.map(n => `**${n.title || 'Untitled'}** (\`${n.id}\`)`).join('\n'),
            inline: false
        });
    }

    if (unpinned.length > 0) {
        embed.addFields({
            name: `Notes (${unpinned.length})`,
            value: unpinned.map(n => `**${n.title || 'Untitled'}** (\`${n.id}\`)`).join('\n'),
            inline: false
        });
    }

    embed.setFooter({ text: 'Use sys!note <id> to view • Use the Notes app for full management' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Open Notes App').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/notes`).setEmoji('🌐')
    );

    return message.reply({ embeds: [embed], components: [row] });
}

async function handleShow(message, note, user) {
    const embed = new EmbedBuilder()
        .setColor(NOTE_COLOR)
        .setTitle(`${note.pinned ? '📌 ' : '📝 '}${note.title || 'Untitled Note'}`);

    if (note.content) {
        const content = note.content.length > 4000
            ? note.content.substring(0, 4000) + '...\n*[Content truncated]*'
            : note.content;
        embed.setDescription(content);
    } else 
        embed.setDescription('*No content*');

    if (note.tags?.length > 0) {
        embed.addFields({
            name: '🏷️ Tags',
            value: note.tags.map(t => `\`${t}\``).join(' '),
            inline: true
        });
    }

    const metadata = [];
    metadata.push(`**ID:** \`${note.id}\``);
    if (note.createdAt) metadata.push(`**Created:** <t:${Math.floor(new Date(note.createdAt).getTime() / 1000)}:R>`);
    if (note.updatedAt) metadata.push(`**Updated:** <t:${Math.floor(new Date(note.updatedAt).getTime() / 1000)}:R>`);

    embed.addFields({
        name: '📊 Info',
        value: metadata.join('\n'),
        inline: false
    });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Open in App').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/notes/${note._id}`).setEmoji('🌐')
    );

    return message.reply({ embeds: [embed], components: [row] });
}

async function handleNew(message, parsed, user) {
    const titleParts = parsed._positional.slice(1);
    const title = parsed.title || titleParts.join(' ') || 'Untitled Note';
    const content = parsed.content || '';
    const tags = parsed.tags ? utils.parseList(parsed.tags) : [];

    const note = new Note({
        title,
        content,
        tags,
        pinned: false,
        author: { userID: user._id },
        users: { owner: { userID: user._id } }
    });

    await note.save();

    if (!user.notes) user.notes = { tags: [], notes: [] };
    user.notes.notes.push(note._id);
    for (const tag of tags) if (!user.notes.tags.includes(tag)) user.notes.tags.push(tag);
    await user.save();

    const embed = new EmbedBuilder()
        .setColor(NOTE_COLOR)
        .setTitle('✅ Note Created')
        .setDescription(`**${title}**`)
        .addFields(
            { name: 'ID', value: `\`${note.id}\``, inline: true },
            { name: 'Tags', value: tags.length ? tags.map(t => `\`${t}\``).join(' ') : '*None*', inline: true }
        );

    if (content) {
        embed.addFields({
            name: 'Content',
            value: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
            inline: false
        });
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Open in App').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/notes/${note._id}`).setEmoji('🌐')
    );

    return message.reply({ embeds: [embed], components: [row] });
}

async function handleDelete(message, parsed, note, user) {
    if (!parsed.confirm) {
        const embed = new EmbedBuilder()
            .setColor(utils.ENTITY_COLORS.error)
            .setTitle('⚠️ Delete Note?')
            .setDescription(`Are you sure you want to delete **${note.title || 'Untitled'}**?\n\nThis action cannot be undone.`)
            .addFields({ name: 'To confirm', value: `\`sys!note ${note.id} delete -confirm\`` });
        return message.reply({ embeds: [embed] });
    }

    if (user?.notes?.notes) {
        user.notes.notes = user.notes.notes.filter(n => n.toString() !== note._id.toString());
        await user.save();
    }

    await Note.findByIdAndDelete(note._id);
    return utils.success(message, `Deleted note: **${note.title || 'Untitled'}**`);
}

async function handleHelp(message) {
    const embed = new EmbedBuilder()
        .setColor(NOTE_COLOR)
        .setTitle('📝 Note Commands')
        .setDescription('Quick note management. Use the Notes app for full editing, linking, sharing, and search.')
        .addFields(
            { name: 'View', value:
                '`sys!note` - List your notes\n' +
                '`sys!note <id>` - View a note', inline: false },
            { name: 'Create', value:
                '`sys!note new <title>` - Create a note\n' +
                '`sys!note new <title> content:<text>` - Create with content', inline: false },
            { name: 'Delete', value:
                '`sys!note <id> delete -confirm` - Delete a note', inline: false }
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Open Notes App').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/notes`).setEmoji('🌐')
    );

    return message.reply({ embeds: [embed], components: [row] });
}
