// add affirmation command (/addaffirmation)
// (/addaffirmation list)
// (/addaffirmation edit:[ID])
// (/addaffirmation delete:[ID])
const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const Affirmation = require('../schema/affirmation.js'); // Adjust path to your affirmation model

module.exports = {
	data: new SlashCommandBuilder()
		.setName('addaffirmation')
		.setDescription('add an affirmation for the team')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Show a list of all affirmations'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit an existing affirmation')
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('Affirmation ID')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete an affirmation')
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('Affirmation ID to delete')
                        .setRequired(true))),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand(false);
        
        if (subcommand === 'list') {
            return await handleList(interaction);
        }
        
        if (subcommand === 'edit') {
            const affirmationId = interaction.options.getString('id');
            return await handleEdit(interaction, affirmationId);
        }
        
        if (subcommand === 'delete') {
            const affirmationId = interaction.options.getString('id');
            return await handleDelete(interaction, affirmationId);
        }
        
        // Default: /addaffirmation with no subcommand opens the form directly
        const modal = new ModalBuilder()
            .setCustomId('addaffirmation_initial')
            .setTitle('Create New Affirmation');

        const titleInput = new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Title')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(256);

        const textInput = new TextInputBuilder()
            .setCustomId('text')
            .setLabel('Affirmation Text')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(4000);

        const footerInput = new TextInputBuilder()
            .setCustomId('footer')
            .setLabel('Footer Text (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(2048);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(textInput),
            new ActionRowBuilder().addComponents(footerInput)
        );

        await interaction.showModal(modal);
    },
    
    // Export handlers for bot.js
    handleModalSubmit,
    handleButton
};

// Handle /addaffirmation list
async function handleList(interaction) {
    try {
        const affirmations = await Affirmation.find({}).select('_id title text').limit(25).sort({ title: 1 });
        
        if (affirmations.length === 0) {
            return await interaction.reply({ content: '📭 No affirmations found in the database.', flags: 64 });
        }
        
        const embed = new EmbedBuilder()
            .setTitle('💫 Affirmation List')
            .setColor('#FFD700')
            .setDescription('Here are all the affirmations:')
            .setTimestamp();
        
        affirmations.forEach(affirmation => {
            const shortText = affirmation.text?.substring(0, 100) || 'No text';
            embed.addFields({
                name: affirmation.title || 'Untitled',
                value: `**ID:** \`${affirmation._id}\`\n**Text:** ${shortText}${affirmation.text?.length > 100 ? '...' : ''}`,
                inline: false
            });
        });
        
        await interaction.reply({ embeds: [embed], flags: 64 });
    } catch (error) {
        console.error('Error fetching affirmations:', error);
        await interaction.reply({ content: '❌ Error fetching affirmations from database.', flags: 64 });
    }
}

// Handle /addaffirmation edit <id>
async function handleEdit(interaction, affirmationId) {
    try {
        const affirmation = await Affirmation.findById(affirmationId);
        
        if (!affirmation) {
            return await interaction.reply({ 
                content: `❌ Affirmation with ID \`${affirmationId}\` not found.`, 
                flags: 64
            });
        }
        
        // Convert mongoose document to plain object
        const affirmationData = {
            _id: affirmation._id,
            title: affirmation.title,
            text: affirmation.text,
            footer: affirmation.footer,
            isExisting: true // Flag to indicate this is an edit
        };
        
        // Store in cache with special key for existing affirmations
        const cacheKey = `edit_${interaction.user.id}_${affirmationId}`;
        affirmationCache.set(cacheKey, affirmationData);
        
        const embed = createEmbed(affirmationData);
        const buttons = createButtons(affirmationData);
        
        await interaction.reply({
            content: `**Editing Affirmation** (ID: ${affirmationId})`,
            embeds: [embed],
            components: buttons,
            flags: 64
        });
    } catch (error) {
        console.error('Error loading affirmation:', error);
        await interaction.reply({ 
            content: `❌ Error loading affirmation: ${error.message}`, 
            flags: 64
        });
    }
}

// Handle /addaffirmation delete <id>
async function handleDelete(interaction, affirmationId) {
    try {
        const affirmation = await Affirmation.findById(affirmationId);
        
        if (!affirmation) {
            return await interaction.reply({ 
                content: `❌ Affirmation with ID \`${affirmationId}\` not found.`, 
                flags: 64
            });
        }
        
        const embed = new EmbedBuilder()
            .setTitle('⚠️ Delete Affirmation Confirmation')
            .setDescription(`Are you sure you want to delete this affirmation?`)
            .addFields(
                { name: 'Title', value: affirmation.title || 'Untitled', inline: false },
                { name: 'ID', value: `\`${affirmation._id}\``, inline: false },
                { name: 'Text', value: affirmation.text?.substring(0, 200) || 'No text', inline: false }
            )
            .setColor('#FF0000')
            .setFooter({ text: 'This action cannot be undone!' });
        
        const confirmButton = new ButtonBuilder()
            .setCustomId(`confirm_delete_affirmation_${affirmationId}`)
            .setLabel('Confirm Delete')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️');
        
        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_delete_affirmation')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);
        
        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
        
        await interaction.reply({
            embeds: [embed],
            components: [row],
            flags: 64
        });
    } catch (error) {
        console.error('Error loading affirmation for deletion:', error);
        await interaction.reply({ 
            content: `❌ Error loading affirmation: ${error.message}`, 
            flags: 64
        });
    }
}

// Store temporary affirmation data (in production, use Redis or similar)
const affirmationCache = new Map();

// Helper function to create embed from affirmation data
function createEmbed(affirmationData) {
    const embed = new EmbedBuilder()
        .setTitle(affirmationData.title || 'Untitled Affirmation')
        .setColor('#FFD700');
    
    if (affirmationData.text) {
        embed.setDescription(affirmationData.text);
    }
    
    if (affirmationData.footer) {
        embed.setFooter({ text: affirmationData.footer });
    }
    
    return embed;
}

// Helper function to create action buttons
function createButtons(affirmationData) {
    const row = new ActionRowBuilder();
    
    row.addComponents(
        new ButtonBuilder()
            .setCustomId('edit_affirmation')
            .setLabel('Edit Affirmation')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✏️'),
        
        new ButtonBuilder()
            .setCustomId('save_affirmation')
            .setLabel(affirmationData.isExisting ? 'Update' : 'Save to Database')
            .setStyle(ButtonStyle.Success)
            .setEmoji('💾'),
        
        new ButtonBuilder()
            .setCustomId('delete_affirmation')
            .setLabel('Delete Affirmation')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
    );
    
    return [row];
}

// Modal submit handler
async function handleModalSubmit(interaction) {
    const customId = interaction.customId;
    
    // Initial affirmation creation
    if (customId === 'addaffirmation_initial') {
        const title = interaction.fields.getTextInputValue('title');
        const text = interaction.fields.getTextInputValue('text');
        const footer = interaction.fields.getTextInputValue('footer') || '';
        
        // Create affirmation data object
        const affirmationData = {
            title,
            text,
            footer: footer || undefined
        };
        
        // Store in cache with user ID as key
        const cacheKey = `${interaction.user.id}_${Date.now()}`;
        affirmationCache.set(cacheKey, affirmationData);
        
        const embed = createEmbed(affirmationData);
        const buttons = createButtons(affirmationData);
        
        await interaction.reply({
            content: `**Affirmation Preview** (Cache ID: ${cacheKey})`,
            embeds: [embed],
            components: buttons,
            flags: 64
        });
    }
    
    // Edit existing affirmation
    if (customId.startsWith('edit_affirmation_')) {
        const cacheKey = customId.replace('edit_affirmation_', '');
        const affirmationData = affirmationCache.get(cacheKey);
        
        if (!affirmationData) {
            return interaction.reply({ content: '❌ Affirmation data not found!', flags: 64 });
        }
        
        const title = interaction.fields.getTextInputValue('title');
        const text = interaction.fields.getTextInputValue('text');
        const footer = interaction.fields.getTextInputValue('footer') || '';
        
        // Update affirmation data
        affirmationData.title = title;
        affirmationData.text = text;
        affirmationData.footer = footer || undefined;
        
        affirmationCache.set(cacheKey, affirmationData);
        
        const embed = createEmbed(affirmationData);
        const buttons = createButtons(affirmationData);
        
        const contentPrefix = affirmationData.isExisting ? `**Editing Affirmation** (ID: ${affirmationData._id})` : `**Affirmation Preview** (Cache ID: ${cacheKey})`;
        
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
    if (customId.startsWith('confirm_delete_affirmation_')) {
        const affirmationId = customId.replace('confirm_delete_affirmation_', '');
        
        try {
            const deletedAffirmation = await Affirmation.findByIdAndDelete(affirmationId);
            
            if (!deletedAffirmation) {
                return interaction.update({
                    content: '❌ Affirmation not found or already deleted.',
                    embeds: [],
                    components: []
                });
            }
            
            await interaction.update({
                content: `✅ Affirmation **"${deletedAffirmation.title || 'Untitled'}"** (ID: \`${affirmationId}\`) has been deleted successfully.`,
                embeds: [],
                components: []
            });
        } catch (error) {
            console.error('Error deleting affirmation:', error);
            await interaction.update({
                content: `❌ Error deleting affirmation: ${error.message}`,
                embeds: [],
                components: []
            });
        }
        return;
    }
    
    if (customId === 'cancel_delete_affirmation') {
        await interaction.update({
            content: '❌ Deletion cancelled.',
            embeds: [],
            components: []
        });
        return;
    }
    
    // Extract cache key from button message
    let cacheKey;
    if (interaction.message.content.includes('Editing Affirmation')) {
        const affirmationId = interaction.message.content.match(/ID: (.+)\)/)?.[1];
        cacheKey = `edit_${interaction.user.id}_${affirmationId}`;
    } else {
        cacheKey = interaction.message.content.match(/Cache ID: (.+)\)/)?.[1];
    }
    
    if (!cacheKey) {
        return interaction.reply({ content: '❌ Could not find affirmation data!', flags: 64 });
    }
    
    const affirmationData = affirmationCache.get(cacheKey);
    
    if (!affirmationData) {
        return interaction.reply({ content: '❌ Affirmation data expired or not found!', flags: 64 });
    }
    
    // DELETE AFFIRMATION BUTTON
    if (customId === 'delete_affirmation') {
        if (!affirmationData.isExisting) {
            // If it's a new affirmation (not saved yet), just clear it
            affirmationCache.delete(cacheKey);
            return interaction.update({
                content: '❌ Affirmation draft deleted.',
                embeds: [],
                components: []
            });
        }
        
        // Show delete confirmation for existing affirmations
        const embed = new EmbedBuilder()
            .setTitle('⚠️ Delete Affirmation Confirmation')
            .setDescription(`Are you sure you want to delete this affirmation?`)
            .addFields(
                { name: 'Title', value: affirmationData.title || 'Untitled', inline: false },
                { name: 'ID', value: `\`${affirmationData._id}\``, inline: false }
            )
            .setColor('#FF0000')
            .setFooter({ text: 'This action cannot be undone!' });
        
        const confirmButton = new ButtonBuilder()
            .setCustomId(`confirm_delete_affirmation_${affirmationData._id}`)
            .setLabel('Confirm Delete')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️');
        
        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_delete_affirmation')
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
    
    // EDIT AFFIRMATION BUTTON
    if (customId === 'edit_affirmation') {
        const modal = new ModalBuilder()
            .setCustomId(`edit_affirmation_${cacheKey}`)
            .setTitle('Edit Affirmation');

        const titleInput = new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Title')
            .setStyle(TextInputStyle.Short)
            .setValue(affirmationData.title || '')
            .setRequired(true)
            .setMaxLength(256);

        const textInput = new TextInputBuilder()
            .setCustomId('text')
            .setLabel('Affirmation Text')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(affirmationData.text || '')
            .setRequired(true)
            .setMaxLength(4000);

        const footerInput = new TextInputBuilder()
            .setCustomId('footer')
            .setLabel('Footer Text (optional)')
            .setStyle(TextInputStyle.Short)
            .setValue(affirmationData.footer || '')
            .setRequired(false)
            .setMaxLength(2048);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(textInput),
            new ActionRowBuilder().addComponents(footerInput)
        );

        await interaction.showModal(modal);
    }
    
    // SAVE AFFIRMATION BUTTON
    if (customId === 'save_affirmation') {
        try {
            if (affirmationData.isExisting) {
                // Update existing affirmation
                await Affirmation.findByIdAndUpdate(affirmationData._id, {
                    title: affirmationData.title,
                    text: affirmationData.text,
                    footer: affirmationData.footer
                });
                
                affirmationCache.delete(cacheKey);
                
                await interaction.update({
                    content: `✅ Affirmation updated successfully! ID: ${affirmationData._id}`,
                    components: []
                });
            } else {
                // Create new affirmation
                const newAffirmation = new Affirmation({
                    title: affirmationData.title,
                    text: affirmationData.text,
                    footer: affirmationData.footer
                });
                
                await newAffirmation.save();
                
                affirmationCache.delete(cacheKey);
                
                await interaction.update({
                    content: `✅ Affirmation saved successfully! ID: ${newAffirmation._id}`,
                    components: []
                });
            }
        } catch (error) {
            console.error('Error saving affirmation:', error);
            await interaction.reply({ 
                content: `❌ Error saving affirmation: ${error.message}`, 
                flags: 64
            });
        }
    }
}