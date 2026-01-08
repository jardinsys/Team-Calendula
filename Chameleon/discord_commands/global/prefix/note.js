// sys!note - Note management prefix command
// Prefix equivalent of /note slash command
//
// USAGE:
//   sys!note                             - Show your notes list
//   sys!note list                        - Show your notes list
//   sys!note <id>                        - Show a specific note
//   sys!note show <id|title>             - Show a specific note
//   sys!note new <title>                 - Create a new note
//   sys!note new <title> content:<text>  - Create with content
//   sys!note <id> edit                   - Show edit options
//   sys!note <id> title <new_title>      - Change note title
//   sys!note <id> content <text>         - Set note content
//   sys!note <id> append <text>          - Append to content
//   sys!note <id> tags <tag1,tag2>       - Set tags
//   sys!note <id> tags add <tag>         - Add a tag
//   sys!note <id> tags remove <tag>      - Remove a tag
//   sys!note <id> pin                    - Toggle pin status
//   sys!note <id> link <alter|state|group> <name>   - Link to entity
//   sys!note <id> unlink <alter|state|group> <name> - Unlink from entity
//   sys!note <id> share <@user> <r|rw>   - Share with user
//   sys!note <id> unshare <@user>        - Remove user access
//   sys!note <id> delete                 - Delete the note
//   sys!note <id> delete -confirm        - Confirm deletion
//   sys!note tags                        - List all your tags
//   sys!note search <query>              - Search notes by title/content/tags

const { EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const Note = require('../../schemas/note');
const User = require('../../schemas/user');
const System = require('../../schemas/system');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const utils = require('../../functions/bot_utils');

const NOTE_COLOR = '#FFD700'; // Gold color for notes

module.exports = {
    name: 'note',
    aliases: ['notes', 'n'],

    async executeMessage(message, args) {
        // Get user
        const { user, system } = await utils.getOrCreateUserAndSystem(message);
        if (!user) {
            return utils.error(message, 'Could not find or create your user profile.');
        }

        const parsed = utils.parseArgs(args);
        const firstArg = parsed._positional[0]?.toLowerCase();

        // No args - show list
        if (!firstArg) {
            return handleList(message, user);
        }

        // Route commands
        const handlers = {
            'list': () => handleList(message, user),
            'new': () => handleNew(message, parsed, user, system),
            'create': () => handleNew(message, parsed, user, system),
            'tags': () => handleTags(message, parsed, user),
            'search': () => handleSearch(message, parsed, user),
            'find': () => handleSearch(message, parsed, user),
            'help': () => handleHelp(message)
        };

        if (handlers[firstArg]) {
            return handlers[firstArg]();
        }

        // Check if first arg is a note ID or title
        const note = await findNote(firstArg, user);
        if (note) {
            const subcommand = parsed._positional[1]?.toLowerCase();
            
            if (!subcommand || subcommand === 'show') {
                return handleShow(message, note, user);
            }

            const noteHandlers = {
                'edit': () => handleEditInfo(message, note),
                'title': () => handleTitle(message, parsed, note),
                'content': () => handleContent(message, parsed, note),
                'append': () => handleAppend(message, parsed, note),
                'tags': () => handleNoteTags(message, parsed, note),
                'pin': () => handlePin(message, note),
                'link': () => handleLink(message, parsed, note, system),
                'unlink': () => handleUnlink(message, parsed, note, system),
                'share': () => handleShare(message, parsed, note),
                'unshare': () => handleUnshare(message, parsed, note),
                'delete': () => handleDelete(message, parsed, note)
            };

            if (noteHandlers[subcommand]) {
                return noteHandlers[subcommand]();
            }

            return utils.error(message, `Unknown subcommand: \`${subcommand}\`\nUse \`sys!note help\` for available commands.`);
        }

        // If first arg looks like "show", try to find note from second arg
        if (firstArg === 'show') {
            const noteId = parsed._positional[1];
            if (!noteId) {
                return utils.error(message, 'Please provide a note ID or title.');
            }
            const foundNote = await findNote(noteId, user);
            if (foundNote) {
                return handleShow(message, foundNote, user);
            }
            return utils.error(message, `Note not found: \`${noteId}\``);
        }

        return utils.error(message, `Note not found: \`${firstArg}\`\nUse \`sys!note list\` to see your notes or \`sys!note new <title>\` to create one.`);
    }
};

/**
 * Find a note by ID or title
 */
async function findNote(identifier, user) {
    if (!identifier) return null;

    // Try by snowflake ID first
    let note = await Note.findOne({ id: identifier });
    if (note && hasAccess(note, user)) return note;

    // Try by MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(identifier)) {
        note = await Note.findById(identifier);
        if (note && hasAccess(note, user)) return note;
    }

    // Try by title (case-insensitive, partial match)
    const userNotes = user.notes?.notes || [];
    if (userNotes.length > 0) {
        note = await Note.findOne({
            _id: { $in: userNotes },
            title: { $regex: new RegExp(utils.escapeRegex(identifier), 'i') }
        });
        if (note) return note;
    }

    // Check notes shared with user
    note = await Note.findOne({
        $or: [
            { 'users.rAccess.userID': user._id },
            { 'users.rwAccess.userID': user._id }
        ],
        title: { $regex: new RegExp(utils.escapeRegex(identifier), 'i') }
    });

    return note;
}

/**
 * Check if user has access to a note
 */
function hasAccess(note, user) {
    const userId = user._id.toString();
    
    // Owner
    if (note.users?.owner?.userID?.toString() === userId) return true;
    
    // Author
    if (note.author?.userID?.toString() === userId) return true;
    
    // Read access
    if (note.users?.rAccess?.some(a => a.userID?.toString() === userId)) return true;
    
    // Read-write access
    if (note.users?.rwAccess?.some(a => a.userID?.toString() === userId)) return true;
    
    // Check if note is in user's notes array
    if (user.notes?.notes?.some(n => n.toString() === note._id.toString())) return true;
    
    return false;
}

/**
 * Check if user can edit a note
 */
function canEdit(note, user) {
    const userId = user._id.toString();
    
    // Owner
    if (note.users?.owner?.userID?.toString() === userId) return true;
    
    // Author
    if (note.author?.userID?.toString() === userId) return true;
    
    // Read-write access
    if (note.users?.rwAccess?.some(a => a.userID?.toString() === userId)) return true;
    
    return false;
}

/**
 * Handle list command - show user's notes
 */
async function handleList(message, user) {
    const noteIds = user.notes?.notes || [];
    
    if (noteIds.length === 0) {
        return utils.info(message, 'You don\'t have any notes yet.\nUse `sys!note new <title>` to create one.');
    }

    const notes = await Note.find({ _id: { $in: noteIds } }).sort({ pinned: -1, updatedAt: -1 });

    const embed = new EmbedBuilder()
        .setColor(NOTE_COLOR)
        .setTitle('📝 Your Notes')
        .setDescription(`You have **${notes.length}** note${notes.length !== 1 ? 's' : ''}`);

    // Split into pinned and unpinned
    const pinned = notes.filter(n => n.pinned);
    const unpinned = notes.filter(n => !n.pinned);

    if (pinned.length > 0) {
        const pinnedList = pinned.slice(0, 10).map(n => {
            const tags = n.tags?.length ? ` [${n.tags.join(', ')}]` : '';
            return `📌 **${n.title || 'Untitled'}** (\`${n.id}\`)${tags}`;
        }).join('\n');
        
        embed.addFields({
            name: `📌 Pinned (${pinned.length})`,
            value: pinnedList,
            inline: false
        });
    }

    if (unpinned.length > 0) {
        const unpinnedList = unpinned.slice(0, 15).map(n => {
            const tags = n.tags?.length ? ` [${n.tags.join(', ')}]` : '';
            const preview = n.content ? ` - ${n.content.substring(0, 30)}${n.content.length > 30 ? '...' : ''}` : '';
            return `• **${n.title || 'Untitled'}** (\`${n.id}\`)${tags}${preview}`;
        }).join('\n');
        
        embed.addFields({
            name: `Notes (${unpinned.length})`,
            value: unpinnedList,
            inline: false
        });
    }

    // Show shared notes
    const sharedNotes = await Note.find({
        $or: [
            { 'users.rAccess.userID': user._id },
            { 'users.rwAccess.userID': user._id }
        ]
    }).limit(5);

    if (sharedNotes.length > 0) {
        const sharedList = sharedNotes.map(n => {
            const access = n.users?.rwAccess?.some(a => a.userID?.toString() === user._id.toString()) ? '📝' : '👁️';
            return `${access} **${n.title || 'Untitled'}** (\`${n.id}\`)`;
        }).join('\n');
        
        embed.addFields({
            name: '🔗 Shared With You',
            value: sharedList,
            inline: false
        });
    }

    embed.setFooter({ text: 'Use sys!note <id> to view a note' });

    return message.reply({ embeds: [embed] });
}

/**
 * Handle show command - display a specific note
 */
async function handleShow(message, note, user) {
    const embed = new EmbedBuilder()
        .setColor(NOTE_COLOR)
        .setTitle(`${note.pinned ? '📌 ' : '📝 '}${note.title || 'Untitled Note'}`);

    if (note.content) {
        // Truncate if too long for embed
        const content = note.content.length > 4000 
            ? note.content.substring(0, 4000) + '...\n*[Content truncated]*'
            : note.content;
        embed.setDescription(content);
    } else {
        embed.setDescription('*No content*');
    }

    // Tags
    if (note.tags?.length > 0) {
        embed.addFields({
            name: '🏷️ Tags',
            value: note.tags.map(t => `\`${t}\``).join(' '),
            inline: true
        });
    }

    // Linked entities
    const linkedEntities = [];
    if (note.author?.alterIDs?.length) linkedEntities.push(`${note.author.alterIDs.length} alter(s)`);
    if (note.author?.stateIDs?.length) linkedEntities.push(`${note.author.stateIDs.length} state(s)`);
    if (note.author?.groupIDs?.length) linkedEntities.push(`${note.author.groupIDs.length} group(s)`);
    
    if (linkedEntities.length > 0) {
        embed.addFields({
            name: '🔗 Linked To',
            value: linkedEntities.join(', '),
            inline: true
        });
    }

    // Metadata
    const metadata = [];
    metadata.push(`**ID:** \`${note.id}\``);
    if (note.createdAt) metadata.push(`**Created:** <t:${Math.floor(new Date(note.createdAt).getTime() / 1000)}:R>`);
    if (note.updatedAt) metadata.push(`**Updated:** <t:${Math.floor(new Date(note.updatedAt).getTime() / 1000)}:R>`);

    embed.addFields({
        name: '📊 Info',
        value: metadata.join('\n'),
        inline: false
    });

    // Access info
    const isOwner = note.users?.owner?.userID?.toString() === user._id.toString() ||
                    note.author?.userID?.toString() === user._id.toString();
    const canWrite = canEdit(note, user);
    
    embed.setFooter({ 
        text: `${isOwner ? 'Owner' : (canWrite ? 'Editor' : 'Viewer')} • Use sys!note ${note.id} edit for options`
    });

    return message.reply({ embeds: [embed] });
}

/**
 * Handle new command - create a new note
 */
async function handleNew(message, parsed, user, system) {
    // Get title from positional args after "new"
    const titleParts = parsed._positional.slice(1);
    const title = parsed.title || titleParts.join(' ') || 'Untitled Note';
    const content = parsed.content || '';
    const tags = parsed.tags ? utils.parseList(parsed.tags) : [];

    const note = new Note({
        title: title,
        content: content,
        tags: tags,
        pinned: false,
        author: {
            userID: user._id
        },
        users: {
            owner: {
                userID: user._id
            }
        }
    });

    await note.save();

    // Add to user's notes
    if (!user.notes) user.notes = { tags: [], notes: [] };
    user.notes.notes.push(note._id);
    
    // Add new tags to user's tag collection
    for (const tag of tags) {
        if (!user.notes.tags.includes(tag)) {
            user.notes.tags.push(tag);
        }
    }
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
            name: 'Content Preview',
            value: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
            inline: false
        });
    }

    embed.setFooter({ text: `Use sys!note ${note.id} to view or edit` });

    return message.reply({ embeds: [embed] });
}

/**
 * Handle edit info - show available edit options
 */
async function handleEditInfo(message, note) {
    const embed = new EmbedBuilder()
        .setColor(NOTE_COLOR)
        .setTitle(`📝 Editing: ${note.title || 'Untitled'}`)
        .setDescription('Available edit commands:')
        .addFields(
            { name: 'Content', value:
                `\`sys!note ${note.id} title <new_title>\`\n` +
                `\`sys!note ${note.id} content <text>\`\n` +
                `\`sys!note ${note.id} append <text>\``, inline: false },
            { name: 'Organization', value:
                `\`sys!note ${note.id} tags <tag1,tag2>\`\n` +
                `\`sys!note ${note.id} tags add <tag>\`\n` +
                `\`sys!note ${note.id} tags remove <tag>\`\n` +
                `\`sys!note ${note.id} pin\``, inline: false },
            { name: 'Linking', value:
                `\`sys!note ${note.id} link alter <name>\`\n` +
                `\`sys!note ${note.id} unlink state <name>\``, inline: false },
            { name: 'Sharing', value:
                `\`sys!note ${note.id} share @user <r|rw>\`\n` +
                `\`sys!note ${note.id} unshare @user\``, inline: false },
            { name: 'Delete', value:
                `\`sys!note ${note.id} delete -confirm\``, inline: false }
        );

    return message.reply({ embeds: [embed] });
}

/**
 * Handle title change
 */
async function handleTitle(message, parsed, note) {
    const newTitle = parsed._positional.slice(2).join(' ') || parsed.title;
    
    if (!newTitle) {
        return utils.error(message, 'Please provide a new title.');
    }

    note.title = newTitle;
    await note.save();

    return utils.success(message, `Note title updated to: **${newTitle}**`);
}

/**
 * Handle content set
 */
async function handleContent(message, parsed, note) {
    // Content can come from positional args or content: key
    let content = parsed.content;
    if (!content) {
        content = parsed._positional.slice(2).join(' ');
    }

    if (!content) {
        return utils.error(message, 'Please provide content.\nUsage: `sys!note <id> content <text>` or `sys!note <id> content:"multi word text"`');
    }

    note.content = content;
    await note.save();

    return utils.success(message, `Note content updated. (${content.length} characters)`);
}

/**
 * Handle content append
 */
async function handleAppend(message, parsed, note) {
    let text = parsed._positional.slice(2).join(' ');
    
    if (!text) {
        return utils.error(message, 'Please provide text to append.');
    }

    note.content = (note.content || '') + '\n' + text;
    await note.save();

    return utils.success(message, `Appended ${text.length} characters to note.`);
}

/**
 * Handle note tags management
 */
async function handleNoteTags(message, parsed, note) {
    const action = parsed._positional[2]?.toLowerCase();
    
    if (!action) {
        // Show current tags
        const tags = note.tags || [];
        return utils.info(message, `**Tags for "${note.title}":**\n${tags.length ? tags.map(t => `\`${t}\``).join(' ') : '*No tags*'}`);
    }

    if (action === 'add') {
        const tag = parsed._positional[3];
        if (!tag) return utils.error(message, 'Please provide a tag to add.');
        
        if (!note.tags) note.tags = [];
        if (note.tags.includes(tag)) {
            return utils.error(message, `Tag \`${tag}\` already exists on this note.`);
        }
        
        note.tags.push(tag);
        await note.save();
        return utils.success(message, `Added tag \`${tag}\` to note.`);
    }

    if (action === 'remove' || action === 'rm') {
        const tag = parsed._positional[3];
        if (!tag) return utils.error(message, 'Please provide a tag to remove.');
        
        const idx = note.tags?.indexOf(tag);
        if (idx === -1 || idx === undefined) {
            return utils.error(message, `Tag \`${tag}\` not found on this note.`);
        }
        
        note.tags.splice(idx, 1);
        await note.save();
        return utils.success(message, `Removed tag \`${tag}\` from note.`);
    }

    // Set tags directly (comma-separated)
    const tags = utils.parseList(parsed._positional.slice(2).join(' '));
    note.tags = tags;
    await note.save();
    return utils.success(message, `Tags updated: ${tags.map(t => `\`${t}\``).join(' ') || '*None*'}`);
}

/**
 * Handle pin toggle
 */
async function handlePin(message, note) {
    note.pinned = !note.pinned;
    await note.save();

    return utils.success(message, note.pinned ? '📌 Note pinned.' : 'Note unpinned.');
}

/**
 * Handle linking note to entity
 */
async function handleLink(message, parsed, note, system) {
    if (!system) {
        return utils.error(message, 'You need a system to link notes to entities.');
    }

    const entityType = parsed._positional[2]?.toLowerCase();
    const entityName = parsed._positional.slice(3).join(' ');

    if (!entityType || !['alter', 'state', 'group'].includes(entityType)) {
        return utils.error(message, 'Please specify entity type: `alter`, `state`, or `group`');
    }

    if (!entityName) {
        return utils.error(message, `Please provide the ${entityType} name.`);
    }

    const result = await utils.findEntity(entityName, system, entityType);
    if (!result) {
        return utils.error(message, `${utils.capitalize(entityType)} not found: ${entityName}`);
    }

    // Initialize author if needed
    if (!note.author) note.author = {};
    
    const idField = `${entityType}IDs`;
    if (!note.author[idField]) note.author[idField] = [];
    
    const entityId = result.entity._id.toString();
    if (note.author[idField].includes(entityId)) {
        return utils.error(message, `Note is already linked to this ${entityType}.`);
    }

    note.author[idField].push(entityId);
    await note.save();

    const entityDisplayName = result.entity.name?.display || result.entity.name?.indexable || entityName;
    return utils.success(message, `Linked note to ${entityType}: **${entityDisplayName}**`);
}

/**
 * Handle unlinking note from entity
 */
async function handleUnlink(message, parsed, note, system) {
    if (!system) {
        return utils.error(message, 'You need a system to unlink notes from entities.');
    }

    const entityType = parsed._positional[2]?.toLowerCase();
    const entityName = parsed._positional.slice(3).join(' ');

    if (!entityType || !['alter', 'state', 'group'].includes(entityType)) {
        return utils.error(message, 'Please specify entity type: `alter`, `state`, or `group`');
    }

    if (!entityName) {
        return utils.error(message, `Please provide the ${entityType} name.`);
    }

    const result = await utils.findEntity(entityName, system, entityType);
    if (!result) {
        return utils.error(message, `${utils.capitalize(entityType)} not found: ${entityName}`);
    }

    const idField = `${entityType}IDs`;
    const entityId = result.entity._id.toString();
    const idx = note.author?.[idField]?.indexOf(entityId);

    if (idx === -1 || idx === undefined) {
        return utils.error(message, `Note is not linked to this ${entityType}.`);
    }

    note.author[idField].splice(idx, 1);
    await note.save();

    const entityDisplayName = result.entity.name?.display || result.entity.name?.indexable || entityName;
    return utils.success(message, `Unlinked note from ${entityType}: **${entityDisplayName}**`);
}

/**
 * Handle sharing note with user
 */
async function handleShare(message, parsed, note) {
    const targetUser = message.mentions.users.first();
    if (!targetUser) {
        return utils.error(message, 'Please mention a user to share with.');
    }

    // Get access level (r = read only, rw = read-write)
    const accessLevel = parsed._positional[3]?.toLowerCase() || 'r';
    if (!['r', 'rw', 'read', 'write', 'readwrite'].includes(accessLevel)) {
        return utils.error(message, 'Access level must be `r` (read) or `rw` (read-write).');
    }

    // Find the target user in database
    const dbTargetUser = await User.findOne({ discordID: targetUser.id });
    if (!dbTargetUser) {
        return utils.error(message, 'That user hasn\'t set up their profile yet.');
    }

    const isReadWrite = ['rw', 'write', 'readwrite'].includes(accessLevel);
    const accessArray = isReadWrite ? 'rwAccess' : 'rAccess';
    const removeArray = isReadWrite ? 'rAccess' : 'rwAccess';

    // Initialize if needed
    if (!note.users) note.users = {};
    if (!note.users[accessArray]) note.users[accessArray] = [];
    if (!note.users[removeArray]) note.users[removeArray] = [];

    // Remove from other access array if present
    note.users[removeArray] = note.users[removeArray].filter(
        a => a.userID?.toString() !== dbTargetUser._id.toString()
    );

    // Check if already has this access
    const hasAccess = note.users[accessArray].some(
        a => a.userID?.toString() === dbTargetUser._id.toString()
    );

    if (!hasAccess) {
        note.users[accessArray].push({ userID: dbTargetUser._id });
    }

    await note.save();

    return utils.success(message, `Shared note with <@${targetUser.id}> (${isReadWrite ? 'read-write' : 'read-only'}).`);
}

/**
 * Handle unsharing note
 */
async function handleUnshare(message, parsed, note) {
    const targetUser = message.mentions.users.first();
    if (!targetUser) {
        return utils.error(message, 'Please mention a user to remove access from.');
    }

    const dbTargetUser = await User.findOne({ discordID: targetUser.id });
    if (!dbTargetUser) {
        return utils.error(message, 'User not found in database.');
    }

    let removed = false;

    if (note.users?.rAccess) {
        const beforeLen = note.users.rAccess.length;
        note.users.rAccess = note.users.rAccess.filter(
            a => a.userID?.toString() !== dbTargetUser._id.toString()
        );
        if (note.users.rAccess.length < beforeLen) removed = true;
    }

    if (note.users?.rwAccess) {
        const beforeLen = note.users.rwAccess.length;
        note.users.rwAccess = note.users.rwAccess.filter(
            a => a.userID?.toString() !== dbTargetUser._id.toString()
        );
        if (note.users.rwAccess.length < beforeLen) removed = true;
    }

    if (!removed) {
        return utils.error(message, 'That user doesn\'t have access to this note.');
    }

    await note.save();

    return utils.success(message, `Removed <@${targetUser.id}>'s access to this note.`);
}

/**
 * Handle delete
 */
async function handleDelete(message, parsed, note) {
    if (!parsed.confirm) {
        const embed = new EmbedBuilder()
            .setColor(utils.ENTITY_COLORS.error)
            .setTitle('⚠️ Delete Note?')
            .setDescription(`Are you sure you want to delete **${note.title || 'Untitled'}**?\n\nThis action cannot be undone.`)
            .addFields({ name: 'To confirm', value: `\`sys!note ${note.id} delete -confirm\`` });
        
        return message.reply({ embeds: [embed] });
    }

    // Get user to remove from their notes array
    const user = await User.findOne({ discordID: message.author.id });
    if (user?.notes?.notes) {
        user.notes.notes = user.notes.notes.filter(n => n.toString() !== note._id.toString());
        await user.save();
    }

    await Note.findByIdAndDelete(note._id);

    return utils.success(message, `Deleted note: **${note.title || 'Untitled'}**`);
}

/**
 * Handle tags command - show all user's tags
 */
async function handleTags(message, parsed, user) {
    const tags = user.notes?.tags || [];
    
    if (tags.length === 0) {
        return utils.info(message, 'You don\'t have any tags yet.\nTags are automatically added when you tag notes.');
    }

    // Count notes per tag
    const noteIds = user.notes?.notes || [];
    const notes = await Note.find({ _id: { $in: noteIds } });
    
    const tagCounts = {};
    for (const tag of tags) {
        tagCounts[tag] = notes.filter(n => n.tags?.includes(tag)).length;
    }

    const tagList = tags.map(t => `\`${t}\` (${tagCounts[t] || 0})`).join('\n');

    const embed = new EmbedBuilder()
        .setColor(NOTE_COLOR)
        .setTitle('🏷️ Your Tags')
        .setDescription(tagList)
        .setFooter({ text: 'Use sys!note search tag:<tagname> to find notes by tag' });

    return message.reply({ embeds: [embed] });
}

/**
 * Handle search command
 */
async function handleSearch(message, parsed, user) {
    const query = parsed._positional.slice(1).join(' ') || parsed.query;
    const tagFilter = parsed.tag;

    if (!query && !tagFilter) {
        return utils.error(message, 'Please provide a search query.\nUsage: `sys!note search <query>` or `sys!note search tag:<tagname>`');
    }

    const noteIds = user.notes?.notes || [];
    let searchCriteria = { _id: { $in: noteIds } };

    if (query) {
        searchCriteria.$or = [
            { title: { $regex: new RegExp(utils.escapeRegex(query), 'i') } },
            { content: { $regex: new RegExp(utils.escapeRegex(query), 'i') } },
            { tags: { $regex: new RegExp(utils.escapeRegex(query), 'i') } }
        ];
    }

    if (tagFilter) {
        searchCriteria.tags = tagFilter;
    }

    const results = await Note.find(searchCriteria).limit(15).sort({ pinned: -1, updatedAt: -1 });

    if (results.length === 0) {
        return utils.info(message, `No notes found matching: ${query || tagFilter}`);
    }

    const embed = new EmbedBuilder()
        .setColor(NOTE_COLOR)
        .setTitle(`🔍 Search Results (${results.length})`)
        .setDescription(query ? `Query: "${query}"` : `Tag: "${tagFilter}"`);

    const resultList = results.map(n => {
        const preview = n.content ? ` - ${n.content.substring(0, 50)}${n.content.length > 50 ? '...' : ''}` : '';
        return `${n.pinned ? '📌' : '📝'} **${n.title || 'Untitled'}** (\`${n.id}\`)${preview}`;
    }).join('\n');

    embed.addFields({ name: 'Results', value: resultList });
    embed.setFooter({ text: 'Use sys!note <id> to view a note' });

    return message.reply({ embeds: [embed] });
}

/**
 * Show help for note command
 */
async function handleHelp(message) {
    const embed = new EmbedBuilder()
        .setColor(NOTE_COLOR)
        .setTitle('📝 Note Commands')
        .setDescription('Manage your personal notes.')
        .addFields(
            { name: 'View Notes', value:
                '`sys!note` - List your notes\n' +
                '`sys!note <id>` - View a specific note\n' +
                '`sys!note tags` - List all your tags\n' +
                '`sys!note search <query>` - Search notes', inline: false },
            { name: 'Create & Edit', value:
                '`sys!note new <title>` - Create a note\n' +
                '`sys!note <id> title <text>` - Change title\n' +
                '`sys!note <id> content <text>` - Set content\n' +
                '`sys!note <id> append <text>` - Add to content\n' +
                '`sys!note <id> pin` - Toggle pin status', inline: false },
            { name: 'Tags', value:
                '`sys!note <id> tags <t1,t2>` - Set tags\n' +
                '`sys!note <id> tags add <tag>` - Add tag\n' +
                '`sys!note <id> tags remove <tag>` - Remove tag', inline: false },
            { name: 'Linking', value:
                '`sys!note <id> link alter <name>` - Link to alter\n' +
                '`sys!note <id> link state <name>` - Link to state\n' +
                '`sys!note <id> link group <name>` - Link to group\n' +
                '`sys!note <id> unlink <type> <name>` - Unlink', inline: false },
            { name: 'Sharing', value:
                '`sys!note <id> share @user r` - Share read-only\n' +
                '`sys!note <id> share @user rw` - Share read-write\n' +
                '`sys!note <id> unshare @user` - Remove access', inline: false },
            { name: 'Delete', value:
                '`sys!note <id> delete -confirm` - Delete note', inline: false }
        );

    return message.reply({ embeds: [embed] });
}