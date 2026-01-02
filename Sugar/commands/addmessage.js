// add message command (/addmessage)
// (/addmessage list)
// (/addmessage edit:[ID])
// (/addmessage delete:[ID])
const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const Message = require('../schema/message.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addmessage')
        .setDescription('create a message for a selected bot and group')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Show a list of all messages'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit an existing message')
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('Message snowflake ID')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a message')
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('Message snowflake ID to delete')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand(false);

        if (subcommand === 'list') {
            return await handleList(interaction);
        }

        if (subcommand === 'edit') {
            const messageId = interaction.options.getString('id');
            return await handleEdit(interaction, messageId);
        }

        if (subcommand === 'delete') {
            const messageId = interaction.options.getString('id');
            return await handleDelete(interaction, messageId);
        }

        // Default: /addmessage with no subcommand opens the form directly
        const modal = new ModalBuilder()
            .setCustomId('addmessage_initial_part1')
            .setTitle('Create New Message (Part 1/2)');

        const appInput = new TextInputBuilder()
            .setCustomId('app')
            .setLabel('App (trig or sys)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('trig')
            .setRequired(true)
            .setMaxLength(4);

        const receiverInput = new TextInputBuilder()
            .setCustomId('receiverType')
            .setLabel('Receiver Type (user or guild)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('user')
            .setRequired(true)
            .setMaxLength(5);

        const titleInput = new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Title')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(256);

        const textInput = new TextInputBuilder()
            .setCustomId('text')
            .setLabel('Content/Text')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(4000);

        const colorInput = new TextInputBuilder()
            .setCustomId('color')
            .setLabel('Color (hex code, e.g., #FF0000) - Optional')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('#5865F2')
            .setMaxLength(7);

        modal.addComponents(
            new ActionRowBuilder().addComponents(appInput),
            new ActionRowBuilder().addComponents(receiverInput),
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(textInput),
            new ActionRowBuilder().addComponents(colorInput)
        );

        await interaction.showModal(modal);
    },

    // Export handlers for bot.js
    handleModalSubmit,
    handleButton,
    handleFieldSelection
};

// Handle /addmessage list
async function handleList(interaction) {
    try {
        const messages = await Message.find({}).select('_id title app recieverType public createdAt').limit(25).sort({ createdAt: -1 });

        if (messages.length === 0) {
            return await interaction.reply({ content: '📭 No messages found in the database.', flags: 64 });
        }

        const embed = new EmbedBuilder()
            .setTitle('📬 Message List')
            .setColor('#5865F2')
            .setDescription('Here are the most recent messages:')
            .setTimestamp();

        messages.forEach(msg => {
            const date = msg.createdAt.toLocaleDateString();
            const publicStatus = msg.public ? '✅ ' : '';
            embed.addFields({
                name: `${publicStatus}${msg.title || 'Untitled'}`,
                value: `**ID:** \`${msg._id}\`\n**App:** ${msg.app} | **Receiver:** ${msg.recieverType}${msg.public ? ' | **Public**' : ''}\n**Created:** ${date}`,
                inline: false
            });
        });

        await interaction.reply({ embeds: [embed], flags: 64 });
    } catch (error) {
        console.error('Error fetching messages:', error);
        await interaction.reply({ content: '❌ Error fetching messages from database.', flags: 64 });
    }
}

// Handle /addmessage edit <id>
async function handleEdit(interaction, messageId) {
    try {
        const message = await Message.findById(messageId);

        if (!message) {
            return await interaction.reply({
                content: `❌ Message with ID \`${messageId}\` not found.`,
                flags: 64
            });
        }

        // Convert mongoose document to plain object
        const messageData = {
            _id: message._id,
            app: message.app,
            recieverType: message.recieverType,
            title: message.title,
            text: message.text,
            color: message.color,
            thumbnail: message.thumbnail,
            banner: message.banner,
            footer: message.footer,
            header: message.header,
            field: message.field || [],
            public: message.public || false,
            isExisting: true // Flag to indicate this is an edit
        };

        // Store in cache with special key for existing messages
        const cacheKey = `edit_${interaction.user.id}_${messageId}`;
        messageCache.set(cacheKey, messageData);

        const embed = createEmbed(messageData);
        const buttons = createButtons(messageData);

        await interaction.reply({
            content: `**Editing Message** (ID: ${messageId})`,
            embeds: [embed],
            components: buttons,
            flags: 64
        });
    } catch (error) {
        console.error('Error loading message:', error);
        await interaction.reply({
            content: `❌ Error loading message: ${error.message}`,
            flags: 64
        });
    }
}

// Handle /addmessage delete <id>
async function handleDelete(interaction, messageId) {
    try {
        const message = await Message.findById(messageId);

        if (!message) {
            return await interaction.reply({
                content: `❌ Message with ID \`${messageId}\` not found.`,
                flags: 64
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('⚠️ Delete Message Confirmation')
            .setDescription(`Are you sure you want to delete this message?`)
            .addFields(
                { name: 'Title', value: message.title || 'Untitled', inline: false },
                { name: 'ID', value: `\`${message._id}\``, inline: true },
                { name: 'App', value: message.app, inline: true },
                { name: 'Receiver', value: message.recieverType, inline: true }
            )
            .setColor('#FF0000')
            .setFooter({ text: 'This action cannot be undone!' });

        const confirmButton = new ButtonBuilder()
            .setCustomId(`confirm_delete_${messageId}`)
            .setLabel('Confirm Delete')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️');

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_delete')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        await interaction.reply({
            embeds: [embed],
            components: [row],
            flags: 64
        });
    } catch (error) {
        console.error('Error loading message for deletion:', error);
        await interaction.reply({
            content: `❌ Error loading message: ${error.message}`,
            flags: 64
        });
    }
}

// Store temporary message data (in production, use Redis or similar)
const messageCache = new Map();

// Helper function to create embed from message data
function createEmbed(messageData) {
    const embed = new EmbedBuilder();

    if (messageData.title) embed.setTitle(messageData.title);
    if (messageData.text) embed.setDescription(messageData.text);
    if (messageData.color) embed.setColor(messageData.color);
    if (messageData.thumbnail) embed.setThumbnail(messageData.thumbnail);
    if (messageData.banner) embed.setImage(messageData.banner);

    if (messageData.header) {
        embed.setAuthor({
            name: messageData.header.text,
            iconURL: messageData.header.icon || undefined
        });
    }

    if (messageData.footer) {
        embed.setFooter({
            text: messageData.footer.text,
            iconURL: messageData.footer.icon || undefined
        });
    }

    if (messageData.field && messageData.field.length > 0) {
        messageData.field.forEach(f => {
            embed.addFields({ name: f.title || 'Field', value: f.text || 'No text', inline: false });
        });
    }

    return embed;
}

// Helper function to create action buttons
function createButtons(messageData) {
    const row1 = new ActionRowBuilder();
    const row2 = new ActionRowBuilder();
    const row3 = new ActionRowBuilder();

    row1.addComponents(
        new ButtonBuilder()
            .setCustomId('edit_message')
            .setLabel('Edit Message')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✏️'),

        new ButtonBuilder()
            .setCustomId(messageData.footer ? 'edit_footer' : 'add_footer')
            .setLabel(messageData.footer ? 'Edit Footer' : 'Add Footer')
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId(messageData.header ? 'edit_header' : 'add_header')
            .setLabel(messageData.header ? 'Edit Header' : 'Add Header')
            .setStyle(ButtonStyle.Secondary)
    );

    row2.addComponents(
        new ButtonBuilder()
            .setCustomId('add_field')
            .setLabel('Add Field')
            .setStyle(ButtonStyle.Success)
            .setEmoji('➕')
    );

    if (messageData.field && messageData.field.length > 0) {
        row2.addComponents(
            new ButtonBuilder()
                .setCustomId('edit_fields')
                .setLabel('Edit Fields')
                .setStyle(ButtonStyle.Success)
                .setEmoji('📝')
        );
    }

    row2.addComponents(
        new ButtonBuilder()
            .setCustomId('toggle_public')
            .setLabel(messageData.public ? 'Unpublish' : 'Publish')
            .setStyle(messageData.public ? ButtonStyle.Secondary : ButtonStyle.Success)
            .setEmoji(messageData.public ? '🔒' : '🌐')
    );

    row3.addComponents(
        new ButtonBuilder()
            .setCustomId('save_message')
            .setLabel(messageData.isExisting ? 'Update' : 'Save to Database')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('💾'),

        new ButtonBuilder()
            .setCustomId('delete_message')
            .setLabel('Delete Message')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
    );

    return [row1, row2, row3];
}

// Modal submit handler
async function handleModalSubmit(interaction) {
    const customId = interaction.customId;

    // PART 1: Initial message creation
    if (customId === 'addmessage_initial_part1') {
        const app = interaction.fields.getTextInputValue('app').toLowerCase();
        const receiverType = interaction.fields.getTextInputValue('receiverType').toLowerCase();
        const title = interaction.fields.getTextInputValue('title');
        const text = interaction.fields.getTextInputValue('text');
        const color = interaction.fields.getTextInputValue('color') || null;

        // Validate inputs
        if (!['trig', 'sys'].includes(app)) {
            return interaction.reply({ content: '❌ Invalid app! Must be "trig" or "sys".', flags: 64 });
        }

        if (!['user', 'guild'].includes(receiverType)) {
            return interaction.reply({ content: '❌ Invalid receiver type! Must be "user" or "guild".', flags: 64 });
        }

        // Create message data object and store temporarily
        const tempKey = `temp_${interaction.user.id}_${Date.now()}`;
        const messageData = {
            app,
            recieverType: receiverType,
            title,
            text,
            color: color || undefined,
            field: [],
            public: false // Default to not public
        };

        messageCache.set(tempKey, messageData);

        // Show part 2 modal for URLs
        const modal2 = new ModalBuilder()
            .setCustomId(`addmessage_initial_part2_${tempKey}`)
            .setTitle('Create New Message (Part 2/2)');

        const thumbnailInput = new TextInputBuilder()
            .setCustomId('thumbnail')
            .setLabel('Thumbnail URL - Optional')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const bannerInput = new TextInputBuilder()
            .setCustomId('banner')
            .setLabel('Banner URL - Optional')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        modal2.addComponents(
            new ActionRowBuilder().addComponents(thumbnailInput),
            new ActionRowBuilder().addComponents(bannerInput)
        );

        await interaction.showModal(modal2);
    }

    // PART 2: Complete initial message creation with URLs
    if (customId.startsWith('addmessage_initial_part2_')) {
        const tempKey = customId.replace('addmessage_initial_part2_', '');
        const messageData = messageCache.get(tempKey);

        if (!messageData) {
            return interaction.reply({ content: '❌ Message data not found!', flags: 64 });
        }

        const thumbnail = interaction.fields.getTextInputValue('thumbnail') || null;
        const banner = interaction.fields.getTextInputValue('banner') || null;

        messageData.thumbnail = thumbnail || undefined;
        messageData.banner = banner || undefined;

        // Move to permanent cache key
        const cacheKey = `${interaction.user.id}_${Date.now()}`;
        messageCache.delete(tempKey);
        messageCache.set(cacheKey, messageData);

        const embed = createEmbed(messageData);
        const buttons = createButtons(messageData);

        await interaction.reply({
            content: `**Message Preview** (Cache ID: ${cacheKey})`,
            embeds: [embed],
            components: buttons,
            flags: 64
        });
    }

    // EDIT MESSAGE PART 1
    if (customId.startsWith('edit_message_part1_')) {
        const parts = customId.split('_');
        const cacheKey = parts.slice(3).join('_');
        const messageData = messageCache.get(cacheKey);

        if (!messageData) {
            return interaction.reply({ content: '❌ Message data not found!', flags: 64 });
        }

        const app = interaction.fields.getTextInputValue('app').toLowerCase();
        const receiverType = interaction.fields.getTextInputValue('receiverType').toLowerCase();
        const title = interaction.fields.getTextInputValue('title');
        const text = interaction.fields.getTextInputValue('text');
        const color = interaction.fields.getTextInputValue('color') || null;

        // Validate
        if (!['trig', 'sys'].includes(app)) {
            return interaction.reply({ content: '❌ Invalid app! Must be "trig" or "sys".', flags: 64 });
        }

        if (!['user', 'guild'].includes(receiverType)) {
            return interaction.reply({ content: '❌ Invalid receiver type! Must be "user" or "guild".', flags: 64 });
        }

        // Update message data
        messageData.app = app;
        messageData.recieverType = receiverType;
        messageData.title = title;
        messageData.text = text;
        messageData.color = color || undefined;

        messageCache.set(cacheKey, messageData);

        // Show part 2 modal for URLs
        const modal2 = new ModalBuilder()
            .setCustomId(`edit_message_part2_${cacheKey}`)
            .setTitle('Edit Message (Part 2/2)');

        const thumbnailInput = new TextInputBuilder()
            .setCustomId('thumbnail')
            .setLabel('Thumbnail URL - Optional')
            .setStyle(TextInputStyle.Short)
            .setValue(messageData.thumbnail || '')
            .setRequired(false);

        const bannerInput = new TextInputBuilder()
            .setCustomId('banner')
            .setLabel('Banner URL - Optional')
            .setStyle(TextInputStyle.Short)
            .setValue(messageData.banner || '')
            .setRequired(false);

        modal2.addComponents(
            new ActionRowBuilder().addComponents(thumbnailInput),
            new ActionRowBuilder().addComponents(bannerInput)
        );

        await interaction.showModal(modal2);
    }

    // EDIT MESSAGE PART 2
    if (customId.startsWith('edit_message_part2_')) {
        const parts = customId.split('_');
        const cacheKey = parts.slice(3).join('_');
        const messageData = messageCache.get(cacheKey);

        if (!messageData) {
            return interaction.reply({ content: '❌ Message data not found!', flags: 64 });
        }

        const thumbnail = interaction.fields.getTextInputValue('thumbnail') || null;
        const banner = interaction.fields.getTextInputValue('banner') || null;

        messageData.thumbnail = thumbnail || undefined;
        messageData.banner = banner || undefined;

        messageCache.set(cacheKey, messageData);

        const embed = createEmbed(messageData);
        const buttons = createButtons(messageData);

        const contentPrefix = messageData.isExisting ? `**Editing Message** (ID: ${messageData._id})` : `**Message Preview** (Cache ID: ${cacheKey})`;

        await interaction.update({
            content: contentPrefix,
            embeds: [embed],
            components: buttons
        });
    }

    // ADD/EDIT FOOTER
    if (customId.startsWith('add_footer_') || customId.startsWith('edit_footer_')) {
        const parts = customId.split('_');
        const cacheKey = parts.slice(2).join('_');
        const messageData = messageCache.get(cacheKey);

        if (!messageData) {
            return interaction.reply({ content: '❌ Message data not found!', flags: 64 });
        }

        const footerText = interaction.fields.getTextInputValue('footer_text');
        const footerIcon = interaction.fields.getTextInputValue('footer_icon');

        messageData.footer = {
            text: footerText,
            icon: footerIcon || undefined
        };

        messageCache.set(cacheKey, messageData);

        const embed = createEmbed(messageData);
        const buttons = createButtons(messageData);

        const contentPrefix = messageData.isExisting ? `**Editing Message** (ID: ${messageData._id})` : `**Message Preview** (Cache ID: ${cacheKey})`;

        await interaction.update({
            content: contentPrefix,
            embeds: [embed],
            components: buttons
        });
    }

    // ADD/EDIT HEADER
    if (customId.startsWith('add_header_') || customId.startsWith('edit_header_')) {
        const parts = customId.split('_');
        const cacheKey = parts.slice(2).join('_');
        const messageData = messageCache.get(cacheKey);

        if (!messageData) {
            return interaction.reply({ content: '❌ Message data not found!', flags: 64 });
        }

        const headerText = interaction.fields.getTextInputValue('header_text');
        const headerIcon = interaction.fields.getTextInputValue('header_icon');

        messageData.header = {
            text: headerText,
            icon: headerIcon || undefined
        };

        messageCache.set(cacheKey, messageData);

        const embed = createEmbed(messageData);
        const buttons = createButtons(messageData);

        const contentPrefix = messageData.isExisting ? `**Editing Message** (ID: ${messageData._id})` : `**Message Preview** (Cache ID: ${cacheKey})`;

        await interaction.update({
            content: contentPrefix,
            embeds: [embed],
            components: buttons
        });
    }

    // ADD FIELD
    if (customId.startsWith('add_field_')) {
        const parts = customId.split('_');
        const cacheKey = parts.slice(2).join('_');
        const messageData = messageCache.get(cacheKey);

        if (!messageData) {
            return interaction.reply({ content: '❌ Message data not found!', flags: 64 });
        }

        const fieldTitle = interaction.fields.getTextInputValue('field_title');
        const fieldText = interaction.fields.getTextInputValue('field_text');

        if (!messageData.field) messageData.field = [];

        messageData.field.push({
            title: fieldTitle,
            text: fieldText
        });

        messageCache.set(cacheKey, messageData);

        const embed = createEmbed(messageData);
        const buttons = createButtons(messageData);

        const contentPrefix = messageData.isExisting ? `**Editing Message** (ID: ${messageData._id})` : `**Message Preview** (Cache ID: ${cacheKey})`;

        await interaction.update({
            content: contentPrefix,
            embeds: [embed],
            components: buttons
        });
    }

    // EDIT SPECIFIC FIELD
    if (customId.startsWith('edit_field_')) {
        const parts = customId.split('_');
        const fieldIndex = parseInt(parts[parts.length - 1]);
        const cacheKey = parts.slice(2, -1).join('_');
        const messageData = messageCache.get(cacheKey);

        if (!messageData) {
            return interaction.reply({ content: '❌ Message data not found!', flags: 64 });
        }

        const fieldTitle = interaction.fields.getTextInputValue('field_title');
        const fieldText = interaction.fields.getTextInputValue('field_text');

        if (messageData.field && messageData.field[fieldIndex]) {
            messageData.field[fieldIndex] = {
                title: fieldTitle,
                text: fieldText
            };
        }

        messageCache.set(cacheKey, messageData);

        const embed = createEmbed(messageData);
        const buttons = createButtons(messageData);

        const contentPrefix = messageData.isExisting ? `**Editing Message** (ID: ${messageData._id})` : `**Message Preview** (Cache ID: ${cacheKey})`;

        await interaction.update({
            content: contentPrefix,
            embeds: [embed],
            components: buttons
        });
    }
}

// Button handler
async function handleButton(interaction) {
    const customId = interaction.customId;

    // Handle delete confirmation buttons
    if (customId.startsWith('confirm_delete_')) {
        const messageId = customId.replace('confirm_delete_', '');

        try {
            const deletedMessage = await Message.findByIdAndDelete(messageId);

            if (!deletedMessage) {
                return interaction.update({
                    content: '❌ Message not found or already deleted.',
                    embeds: [],
                    components: []
                });
            }

            await interaction.update({
                content: `✅ Message **"${deletedMessage.title || 'Untitled'}"** (ID: \`${messageId}\`) has been deleted successfully.`,
                embeds: [],
                components: []
            });
        } catch (error) {
            console.error('Error deleting message:', error);
            await interaction.update({
                content: `❌ Error deleting message: ${error.message}`,
                embeds: [],
                components: []
            });
        }
        return;
    }

    if (customId === 'cancel_delete') {
        await interaction.update({
            content: '❌ Deletion cancelled.',
            embeds: [],
            components: []
        });
        return;
    }

    // Extract cache key from button message
    let cacheKey;
    if (interaction.message.content.includes('Editing Message')) {
        const messageId = interaction.message.content.match(/ID: (.+)\)/)?.[1];
        cacheKey = `edit_${interaction.user.id}_${messageId}`;
    } else {
        cacheKey = interaction.message.content.match(/Cache ID: (.+)\)/)?.[1];
    }

    if (!cacheKey) {
        return interaction.reply({ content: '❌ Could not find message data!', flags: 64 });
    }

    const messageData = messageCache.get(cacheKey);

    if (!messageData) {
        return interaction.reply({ content: '❌ Message data expired or not found!', flags: 64 });
    }

    // TOGGLE PUBLIC BUTTON
    if (customId === 'toggle_public') {
        messageData.public = !messageData.public;
        messageCache.set(cacheKey, messageData);

        const embed = createEmbed(messageData);
        const buttons = createButtons(messageData);

        const contentPrefix = messageData.isExisting ? `**Editing Message** (ID: ${messageData._id})` : `**Message Preview** (Cache ID: ${cacheKey})`;

        await interaction.update({
            content: contentPrefix,
            embeds: [embed],
            components: buttons
        });
        return;
    }

    // DELETE MESSAGE BUTTON
    if (customId === 'delete_message') {
        if (!messageData.isExisting) {
            // If it's a new message (not saved yet), just clear it
            messageCache.delete(cacheKey);
            return interaction.update({
                content: '❌ Message draft deleted.',
                embeds: [],
                components: []
            });
        }

        // Show delete confirmation for existing messages
        const embed = new EmbedBuilder()
            .setTitle('⚠️ Delete Message Confirmation')
            .setDescription(`Are you sure you want to delete this message?`)
            .addFields(
                { name: 'Title', value: messageData.title || 'Untitled', inline: false },
                { name: 'ID', value: `\`${messageData._id}\``, inline: true }
            )
            .setColor('#FF0000')
            .setFooter({ text: 'This action cannot be undone!' });

        const confirmButton = new ButtonBuilder()
            .setCustomId(`confirm_delete_${messageData._id}`)
            .setLabel('Confirm Delete')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️');

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_delete')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        await interaction.update({
            content: '',
            embeds: [embed],
            components: [row]
        });
        return;
    }

    // EDIT MESSAGE BUTTON
    if (customId === 'edit_message') {
        const modal = new ModalBuilder()
            .setCustomId(`edit_message_part1_${cacheKey}`)
            .setTitle('Edit Message (Part 1/2)');

        const appInput = new TextInputBuilder()
            .setCustomId('app')
            .setLabel('App (trig or sys)')
            .setStyle(TextInputStyle.Short)
            .setValue(messageData.app || '')
            .setRequired(true)
            .setMaxLength(4);

        const receiverInput = new TextInputBuilder()
            .setCustomId('receiverType')
            .setLabel('Receiver Type (user or guild)')
            .setStyle(TextInputStyle.Short)
            .setValue(messageData.recieverType || '')
            .setRequired(true)
            .setMaxLength(5);

        const titleInput = new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Title')
            .setStyle(TextInputStyle.Short)
            .setValue(messageData.title || '')
            .setRequired(true)
            .setMaxLength(256);

        const textInput = new TextInputBuilder()
            .setCustomId('text')
            .setLabel('Content/Text')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(messageData.text || '')
            .setRequired(true)
            .setMaxLength(4000);

        const colorInput = new TextInputBuilder()
            .setCustomId('color')
            .setLabel('Color (hex) - Optional')
            .setStyle(TextInputStyle.Short)
            .setValue(messageData.color || '')
            .setRequired(false)
            .setMaxLength(7);

        modal.addComponents(
            new ActionRowBuilder().addComponents(appInput),
            new ActionRowBuilder().addComponents(receiverInput),
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(textInput),
            new ActionRowBuilder().addComponents(colorInput)
        );

        await interaction.showModal(modal);
    }

    // ADD/EDIT FOOTER BUTTON
    if (customId === 'add_footer' || customId === 'edit_footer') {
        const modal = new ModalBuilder()
            .setCustomId(`${customId}_${cacheKey}`)
            .setTitle(customId === 'add_footer' ? 'Add Footer' : 'Edit Footer');

        const textInput = new TextInputBuilder()
            .setCustomId('footer_text')
            .setLabel('Footer Text')
            .setStyle(TextInputStyle.Short)
            .setValue(messageData.footer?.text || '')
            .setRequired(true)
            .setMaxLength(2048);

        const iconInput = new TextInputBuilder()
            .setCustomId('footer_icon')
            .setLabel('Footer Icon URL (optional)')
            .setStyle(TextInputStyle.Short)
            .setValue(messageData.footer?.icon || '')
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(textInput),
            new ActionRowBuilder().addComponents(iconInput)
        );

        await interaction.showModal(modal);
    }

    // ADD/EDIT HEADER BUTTON
    if (customId === 'add_header' || customId === 'edit_header') {
        const modal = new ModalBuilder()
            .setCustomId(`${customId}_${cacheKey}`)
            .setTitle(customId === 'add_header' ? 'Add Header' : 'Edit Header');

        const textInput = new TextInputBuilder()
            .setCustomId('header_text')
            .setLabel('Header Text')
            .setStyle(TextInputStyle.Short)
            .setValue(messageData.header?.text || '')
            .setRequired(true)
            .setMaxLength(256);

        const iconInput = new TextInputBuilder()
            .setCustomId('header_icon')
            .setLabel('Header Icon URL (optional)')
            .setStyle(TextInputStyle.Short)
            .setValue(messageData.header?.icon || '')
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(textInput),
            new ActionRowBuilder().addComponents(iconInput)
        );

        await interaction.showModal(modal);
    }

    // ADD FIELD BUTTON
    if (customId === 'add_field') {
        const modal = new ModalBuilder()
            .setCustomId(`add_field_${cacheKey}`)
            .setTitle('Add Field');

        const titleInput = new TextInputBuilder()
            .setCustomId('field_title')
            .setLabel('Field Title')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(256);

        const textInput = new TextInputBuilder()
            .setCustomId('field_text')
            .setLabel('Field Text')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1024);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(textInput)
        );

        await interaction.showModal(modal);
    }

    // EDIT FIELDS BUTTON - Select which field to edit
    if (customId === 'edit_fields') {
        if (!messageData.field || messageData.field.length === 0) {
            return interaction.reply({ content: '❌ No fields to edit!', flags: 64 });
        }

        const modal = new ModalBuilder()
            .setCustomId(`select_field_${cacheKey}`)
            .setTitle('Select Field to Edit');

        const selectInput = new TextInputBuilder()
            .setCustomId('field_index')
            .setLabel(`Field number (1-${messageData.field.length})`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('1')
            .setRequired(true)
            .setMaxLength(2);

        modal.addComponents(
            new ActionRowBuilder().addComponents(selectInput)
        );

        await interaction.showModal(modal);
    }

    // SAVE MESSAGE BUTTON
    if (customId === 'save_message') {
        try {
            if (messageData.isExisting) {
                // Update existing message
                await Message.findByIdAndUpdate(messageData._id, {
                    app: messageData.app,
                    recieverType: messageData.recieverType,
                    title: messageData.title,
                    text: messageData.text,
                    thumbnail: messageData.thumbnail,
                    banner: messageData.banner,
                    color: messageData.color,
                    footer: messageData.footer,
                    header: messageData.header,
                    field: messageData.field,
                    public: messageData.public
                });

                messageCache.delete(cacheKey);

                await interaction.update({
                    content: `✅ Message updated successfully! ID: ${messageData._id}${messageData.public ? ' | 🌐 **Published**' : ''}`,
                    components: []
                });
            } else {
                // Create new message (Snowflake ID auto-generated by schema)
                const newMessage = new Message({
                    app: messageData.app,
                    recieverType: messageData.recieverType,
                    public: messageData.public || false,
                    title: messageData.title,
                    text: messageData.text,
                    thumbnail: messageData.thumbnail,
                    banner: messageData.banner,
                    color: messageData.color,
                    footer: messageData.footer,
                    header: messageData.header,
                    field: messageData.field
                });

                await newMessage.save();

                messageCache.delete(cacheKey);

                await interaction.update({
                    content: `✅ Message saved successfully! ID: ${newMessage._id}${newMessage.public ? ' | 🌐 **Published**' : ''}`,
                    components: []
                });
            }
        } catch (error) {
            console.error('Error saving message:', error);
            await interaction.reply({
                content: `❌ Error saving message: ${error.message}`,
                flags: 64
            });
        }
    }
}

// Field selection handler
async function handleFieldSelection(interaction) {
    if (interaction.customId.startsWith('select_field_')) {
        const parts = interaction.customId.split('_');
        const cacheKey = parts.slice(2).join('_');
        const messageData = messageCache.get(cacheKey);

        if (!messageData) {
            return interaction.reply({ content: '❌ Message data not found!', flags: 64 });
        }

        const fieldIndex = parseInt(interaction.fields.getTextInputValue('field_index')) - 1;

        if (fieldIndex < 0 || fieldIndex >= messageData.field.length) {
            return interaction.reply({
                content: `❌ Invalid field number! Please enter a number between 1 and ${messageData.field.length}.`,
                flags: 64
            });
        }

        const field = messageData.field[fieldIndex];

        const modal = new ModalBuilder()
            .setCustomId(`edit_field_${cacheKey}_${fieldIndex}`)
            .setTitle(`Edit Field ${fieldIndex + 1}`);

        const titleInput = new TextInputBuilder()
            .setCustomId('field_title')
            .setLabel('Field Title')
            .setStyle(TextInputStyle.Short)
            .setValue(field.title || '')
            .setRequired(true)
            .setMaxLength(256);

        const textInput = new TextInputBuilder()
            .setCustomId('field_text')
            .setLabel('Field Text')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(field.text || '')
            .setRequired(true)
            .setMaxLength(1024);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(textInput)
        );

        await interaction.showModal(modal);
    }
}