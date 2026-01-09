// (/quicknote) - Systemiser Quick Note Command
// Fast note creation with activity launch button

const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const mongoose = require('mongoose');
const Note = require('../../../schemas/note');
const User = require('../../../schemas/user');
const System = require('../../../schemas/system');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const { Shift } = require('../../../schemas/front');
const utils = require('../../functions/bot_utils');

const WEBAPP_URL = 'https://systemise.teamcalendula.net';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quicknote')
        .setDescription('Quickly create or append to notes')
        .addSubcommand(sub => sub.setName('new').setDescription('Create a new quick note')
            .addStringOption(opt => opt.setName('content').setDescription('Note content').setRequired(true).setMaxLength(2000))
            .addStringOption(opt => opt.setName('title').setDescription('Note title').setRequired(false).setMaxLength(100))
            .addStringOption(opt => opt.setName('tags').setDescription('Tags (comma-separated)').setRequired(false)))
        .addSubcommand(sub => sub.setName('append').setDescription('Append to an existing note')
            .addStringOption(opt => opt.setName('note').setDescription('Note to append to').setRequired(true).setAutocomplete(true))
            .addStringOption(opt => opt.setName('content').setDescription('Content to append').setRequired(true).setMaxLength(2000)))
        .addSubcommand(sub => sub.setName('recent').setDescription('Show your most recent notes')),

    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name === 'note') {
            const user = await User.findOne({ discordID: interaction.user.id });
            if (!user) return interaction.respond([]);
            const notes = await Note.find({
                $or: [{ 'author.userID': user._id }, { 'users.owner.userID': user._id }, { _id: { $in: user.notes?.notes || [] } }]
            }).sort({ updatedAt: -1 }).limit(25).select('id title');
            const search = focusedOption.value.toLowerCase();
            return interaction.respond(
                notes.filter(n => n.title?.toLowerCase().includes(search) || n.id?.includes(search))
                    .slice(0, 25).map(n => ({ name: `${n.title || 'Untitled'} (${n.id})`.slice(0, 100), value: n.id || n._id.toString() }))
            );
        }
    },

    async executeInteraction(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const { user } = await utils.getOrCreateUserAndSystem(interaction);
        
        if (subcommand === 'new') return handleNew(interaction, user);
        if (subcommand === 'append') return handleAppend(interaction, user);
        if (subcommand === 'recent') return handleRecent(interaction, user);
    }
};

async function handleNew(interaction, user) {
    const content = interaction.options.getString('content');
    const title = interaction.options.getString('title');
    const tagsInput = interaction.options.getString('tags');
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];
    
    // Get current fronters to link
    const system = await System.findById(user.systemID);
    let linkedAlterIds = [], linkedStateIds = [];
    if (system?.front?.layers?.length > 0) {
        for (const layer of system.front.layers) {
            for (const shiftId of layer.shifts || []) {
                const shift = await Shift.findById(shiftId);
                if (shift && !shift.endTime) {
                    if (shift.s_type === 'alter') linkedAlterIds.push(shift.ID);
                    else if (shift.s_type === 'state') linkedStateIds.push(shift.ID);
                }
            }
        }
    }
    
    const note = new Note({
        _id: new mongoose.Types.ObjectId(),
        title: title || `Quick Note - ${new Date().toLocaleDateString()}`,
        content, tags,
        author: { userID: user._id, alterIDs: linkedAlterIds, stateIDs: linkedStateIds },
        users: { owner: { userID: user._id } },
        createdAt: new Date(), updatedAt: new Date()
    });
    await note.save();
    
    user.notes = user.notes || { tags: [], notes: [] };
    user.notes.notes.push(note._id);
    for (const tag of tags) { if (!user.notes.tags.includes(tag)) user.notes.tags.push(tag); }
    await user.save();
    
    const embed = new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.success)
        .setTitle('📝 Quick Note Created')
        .setDescription(`**${note.title}**\n\n${content.slice(0, 500)}${content.length > 500 ? '...' : ''}`)
        .setFooter({ text: `ID: ${note.id}` })
        .setTimestamp();
    
    if (tags.length > 0) embed.addFields({ name: 'Tags', value: tags.map(t => `\`${t}\``).join(' '), inline: true });
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`qn_append_${note._id}`).setLabel('Append').setStyle(ButtonStyle.Primary).setEmoji('➕'),
        new ButtonBuilder().setCustomId(`qn_view_${note._id}`).setLabel('Preview').setStyle(ButtonStyle.Secondary).setEmoji('📖'),
        new ButtonBuilder().setLabel('Open Full Notes').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/notes/${note._id}`).setEmoji('🌐')
    );
    
    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleAppend(interaction, user) {
    const noteId = interaction.options.getString('note');
    const content = interaction.options.getString('content');
    
    let note = await Note.findOne({ id: noteId }) || await Note.findById(noteId);
    if (!note) return interaction.reply({ content: '❌ Note not found.', ephemeral: true });
    
    const userId = user._id.toString();
    const canEdit = note.users?.owner?.userID?.toString() === userId || note.author?.userID?.toString() === userId ||
                   note.users?.rwAccess?.some(a => a.userID?.toString() === userId);
    if (!canEdit) return interaction.reply({ content: '❌ No permission to edit.', ephemeral: true });
    
    note.content = (note.content || '') + `\n\n---\n**${new Date().toLocaleString()}**\n` + content;
    note.updatedAt = new Date();
    await note.save();
    
    const embed = new EmbedBuilder().setColor(utils.ENTITY_COLORS.success).setTitle('✅ Note Updated')
        .setDescription(`Appended to **${note.title}**`).setFooter({ text: `ID: ${note.id}` });
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`qn_append_${note._id}`).setLabel('Append More').setStyle(ButtonStyle.Primary).setEmoji('➕'),
        new ButtonBuilder().setLabel('Open Full Notes').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/notes/${note._id}`).setEmoji('🌐')
    );
    
    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleRecent(interaction, user) {
    const notes = await Note.find({
        $or: [{ 'author.userID': user._id }, { 'users.owner.userID': user._id }, { _id: { $in: user.notes?.notes || [] } }]
    }).sort({ updatedAt: -1 }).limit(10).select('id title tags pinned updatedAt');
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Open Full Notes').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/notes`).setEmoji('🌐')
    );
    
    if (notes.length === 0) {
        return interaction.reply({ content: '📝 No notes yet. Use `/quicknote new` to create one!', components: [row], ephemeral: true });
    }
    
    let noteList = notes.map(n => `${n.pinned ? '📌 ' : ''}**${n.title || 'Untitled'}**\n└ \`${n.id}\` • ${n.updatedAt.toLocaleDateString()}`).join('\n');
    const embed = new EmbedBuilder().setColor(utils.ENTITY_COLORS.info).setTitle('📝 Recent Notes').setDescription(noteList);
    
    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

module.exports.handleButton = async function(interaction) {
    const [prefix, action, noteId] = interaction.customId.split('_');
    if (prefix !== 'qn') return false;
    
    if (action === 'append') {
        const modal = new ModalBuilder().setCustomId(`qn_append_modal_${noteId}`).setTitle('Append to Note');
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('content').setLabel('Content').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)
        ));
        return interaction.showModal(modal);
    }
    
    if (action === 'view') {
        const note = await Note.findById(noteId);
        if (!note) return interaction.reply({ content: '❌ Note not found.', ephemeral: true });
        const embed = new EmbedBuilder().setColor(utils.ENTITY_COLORS.info)
            .setTitle(`${note.pinned ? '📌 ' : ''}${note.title || 'Untitled'}`)
            .setDescription(note.content?.slice(0, 4000) || '*No content*').setFooter({ text: `ID: ${note.id}` });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Open Full Notes').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/notes/${note._id}`).setEmoji('🌐')
        );
        return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
    return false;
};

module.exports.handleModal = async function(interaction) {
    if (!interaction.customId.startsWith('qn_append_modal_')) return false;
    const noteId = interaction.customId.replace('qn_append_modal_', '');
    const content = interaction.fields.getTextInputValue('content');
    const note = await Note.findById(noteId);
    if (!note) return interaction.reply({ content: '❌ Note not found.', ephemeral: true });
    note.content = (note.content || '') + `\n\n---\n**${new Date().toLocaleString()}**\n` + content;
    note.updatedAt = new Date();
    await note.save();
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Open Full Notes').setStyle(ButtonStyle.Link).setURL(`${WEBAPP_URL}/app/notes/${note._id}`).setEmoji('🌐')
    );
    return interaction.reply({ content: `✅ Appended to **${note.title}**`, components: [row], ephemeral: true });
};
