// add common trigger command (/addtrigger)
// (/addtrigger list)
// (/addtrigger edit:[ID])
// (/addtrigger delete:[ID])
const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const CommonTrigger = require('../schema/CommonTrigger.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addtrigger')
        .setDescription('add a common trigger')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Show a list of all triggers'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit an existing trigger')
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('Trigger ID')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a trigger')
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('Trigger ID to delete')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand(false);

        if (subcommand === 'list') {
            return await handleList(interaction);
        }

        if (subcommand === 'edit') {
            const triggerId = interaction.options.getString('id');
            return await handleEdit(interaction, triggerId);
        }

        if (subcommand === 'delete') {
            const triggerId = interaction.options.getString('id');
            return await handleDelete(interaction, triggerId);
        }

        // Default: /addtrigger with no subcommand opens the form directly
        const modal = new ModalBuilder()
            .setCustomId('addtrigger_initial')
            .setTitle('Create New Trigger');

        const nameInput = new TextInputBuilder()
            .setCustomId('name')
            .setLabel('Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(2000);

        const helpInput = new TextInputBuilder()
            .setCustomId('help')
            .setLabel('Help Text')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(2000);

        modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(descriptionInput),
            new ActionRowBuilder().addComponents(helpInput)
        );

        await interaction.showModal(modal);
    },

    // Export handlers for bot.js
    handleModalSubmit,
    handleButton
};

// Handle /addtrigger list
async function handleList(interaction) {
    try {
        const triggers = await CommonTrigger.find({}).select('_id name description').limit(25).sort({ name: 1 });

        if (triggers.length === 0) {
            return await interaction.reply({ content: '📭 No triggers found in the database.', flags: 64 });
        }

        const embed = new EmbedBuilder()
            .setTitle('📋 Trigger List')
            .setColor('#5865F2')
            .setDescription('Here are all the triggers:')
            .setTimestamp();

        triggers.forEach(trigger => {
            const shortDesc = trigger.description?.substring(0, 100) || 'No description';
            embed.addFields({
                name: trigger.name || 'Untitled',
                value: `**ID:** \`${trigger._id}\`\n**Description:** ${shortDesc}${trigger.description?.length > 100 ? '...' : ''}`,
                inline: false
            });
        });

        await interaction.reply({ embeds: [embed], flags: 64 });
    } catch (error) {
        console.error('Error fetching triggers:', error);
        await interaction.reply({ content: '❌ Error fetching triggers from database.', flags: 64 });
    }
}

// Handle /addtrigger edit <id>
async function handleEdit(interaction, triggerId) {
    try {
        const trigger = await CommonTrigger.findById(triggerId);

        if (!trigger) {
            return await interaction.reply({
                content: `❌ Trigger with ID \`${triggerId}\` not found.`,
                flags: 64
            });
        }

        // Convert mongoose document to plain object
        const triggerData = {
            _id: trigger._id,
            name: trigger.name,
            description: trigger.description,
            help: trigger.help,
            isExisting: true // Flag to indicate this is an edit
        };

        // Store in cache with special key for existing triggers
        const cacheKey = `edit_${interaction.user.id}_${triggerId}`;
        triggerCache.set(cacheKey, triggerData);

        const embed = createEmbed(triggerData);
        const buttons = createButtons(triggerData);

        await interaction.reply({
            content: `**Editing Trigger** (ID: ${triggerId})`,
            embeds: [embed],
            components: buttons,
            flags: 64
        });
    } catch (error) {
        console.error('Error loading trigger:', error);
        await interaction.reply({
            content: `❌ Error loading trigger: ${error.message}`,
            flags: 64
        });
    }
}

// Handle /addtrigger delete <id>
async function handleDelete(interaction, triggerId) {
    try {
        const trigger = await CommonTrigger.findById(triggerId);

        if (!trigger) {
            return await interaction.reply({
                content: `❌ Trigger with ID \`${triggerId}\` not found.`,
                flags: 64
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('⚠️ Delete Trigger Confirmation')
            .setDescription(`Are you sure you want to delete this trigger?`)
            .addFields(
                { name: 'Name', value: trigger.name || 'Untitled', inline: false },
                { name: 'ID', value: `\`${trigger._id}\``, inline: false },
                { name: 'Description', value: trigger.description?.substring(0, 200) || 'No description', inline: false }
            )
            .setColor('#FF0000')
            .setFooter({ text: 'This action cannot be undone!' });

        const confirmButton = new ButtonBuilder()
            .setCustomId(`confirm_delete_trigger_${triggerId}`)
            .setLabel('Confirm Delete')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️');

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_delete_trigger')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        await interaction.reply({
            embeds: [embed],
            components: [row],
            flags: 64
        });
    } catch (error) {
        console.error('Error loading trigger for deletion:', error);
        await interaction.reply({
            content: `❌ Error loading trigger: ${error.message}`,
            flags: 64
        });
    }
}

// Store temporary trigger data (in production, use Redis or similar)
const triggerCache = new Map();

// Helper function to create embed from trigger data
function createEmbed(triggerData) {
    const embed = new EmbedBuilder()
        .setTitle(triggerData.name || 'Untitled Trigger')
        .setColor('#5865F2');

    if (triggerData.description) {
        embed.setDescription(triggerData.description);
    }

    if (triggerData.help) {
        embed.addFields({ name: 'Help Text', value: triggerData.help, inline: false });
    }

    return embed;
}

// Helper function to create action buttons
function createButtons(triggerData) {
    const row = new ActionRowBuilder();

    row.addComponents(
        new ButtonBuilder()
            .setCustomId('edit_trigger')
            .setLabel('Edit Trigger')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✏️'),

        new ButtonBuilder()
            .setCustomId('save_trigger')
            .setLabel(triggerData.isExisting ? 'Update' : 'Save to Database')
            .setStyle(ButtonStyle.Success)
            .setEmoji('💾'),

        new ButtonBuilder()
            .setCustomId('delete_trigger')
            .setLabel('Delete Trigger')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
    );

    return [row];
}

// Modal submit handler
async function handleModalSubmit(interaction) {
    const customId = interaction.customId;

    // Initial trigger creation
    if (customId === 'addtrigger_initial') {
        const name = interaction.fields.getTextInputValue('name');
        const description = interaction.fields.getTextInputValue('description');
        const help = interaction.fields.getTextInputValue('help') || '';

        // Create trigger data object
        const triggerData = {
            name,
            description,
            help: help || undefined
        };

        // Store in cache with user ID as key
        const cacheKey = `${interaction.user.id}_${Date.now()}`;
        triggerCache.set(cacheKey, triggerData);

        const embed = createEmbed(triggerData);
        const buttons = createButtons(triggerData);

        await interaction.reply({
            content: `**Trigger Preview** (Cache ID: ${cacheKey})`,
            embeds: [embed],
            components: buttons,
            flags: 64
        });
    }

    // Edit existing trigger
    if (customId.startsWith('edit_trigger_')) {
        const cacheKey = customId.replace('edit_trigger_', '');
        const triggerData = triggerCache.get(cacheKey);

        if (!triggerData) {
            return interaction.reply({ content: '❌ Trigger data not found!', flags: 64 });
        }

        const name = interaction.fields.getTextInputValue('name');
        const description = interaction.fields.getTextInputValue('description');
        const help = interaction.fields.getTextInputValue('help') || '';

        // Update trigger data
        triggerData.name = name;
        triggerData.description = description;
        triggerData.help = help || undefined;

        triggerCache.set(cacheKey, triggerData);

        const embed = createEmbed(triggerData);
        const buttons = createButtons(triggerData);

        const contentPrefix = triggerData.isExisting ? `**Editing Trigger** (ID: ${triggerData._id})` : `**Trigger Preview** (Cache ID: ${cacheKey})`;

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
    if (customId.startsWith('confirm_delete_trigger_')) {
        const triggerId = customId.replace('confirm_delete_trigger_', '');

        try {
            const deletedTrigger = await CommonTrigger.findByIdAndDelete(triggerId);

            if (!deletedTrigger) {
                return interaction.update({
                    content: '❌ Trigger not found or already deleted.',
                    embeds: [],
                    components: []
                });
            }

            await interaction.update({
                content: `✅ Trigger **"${deletedTrigger.name || 'Untitled'}"** (ID: \`${triggerId}\`) has been deleted successfully.`,
                embeds: [],
                components: []
            });
        } catch (error) {
            console.error('Error deleting trigger:', error);
            await interaction.update({
                content: `❌ Error deleting trigger: ${error.message}`,
                embeds: [],
                components: []
            });
        }
        return;
    }

    if (customId === 'cancel_delete_trigger') {
        await interaction.update({
            content: '❌ Deletion cancelled.',
            embeds: [],
            components: []
        });
        return;
    }

    // Extract cache key from button message
    let cacheKey;
    if (interaction.message.content.includes('Editing Trigger')) {
        const triggerId = interaction.message.content.match(/ID: (.+)\)/)?.[1];
        cacheKey = `edit_${interaction.user.id}_${triggerId}`;
    } else {
        cacheKey = interaction.message.content.match(/Cache ID: (.+)\)/)?.[1];
    }

    if (!cacheKey) {
        return interaction.reply({ content: '❌ Could not find trigger data!', flags: 64 });
    }

    const triggerData = triggerCache.get(cacheKey);

    if (!triggerData) {
        return interaction.reply({ content: '❌ Trigger data expired or not found!', flags: 64 });
    }

    // DELETE TRIGGER BUTTON
    if (customId === 'delete_trigger') {
        if (!triggerData.isExisting) {
            // If it's a new trigger (not saved yet), just clear it
            triggerCache.delete(cacheKey);
            return interaction.update({
                content: '❌ Trigger draft deleted.',
                embeds: [],
                components: []
            });
        }

        // Show delete confirmation for existing triggers
        const embed = new EmbedBuilder()
            .setTitle('⚠️ Delete Trigger Confirmation')
            .setDescription(`Are you sure you want to delete this trigger?`)
            .addFields(
                { name: 'Name', value: triggerData.name || 'Untitled', inline: false },
                { name: 'ID', value: `\`${triggerData._id}\``, inline: false }
            )
            .setColor('#FF0000')
            .setFooter({ text: 'This action cannot be undone!' });

        const confirmButton = new ButtonBuilder()
            .setCustomId(`confirm_delete_trigger_${triggerData._id}`)
            .setLabel('Confirm Delete')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️');

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_delete_trigger')
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

    // EDIT TRIGGER BUTTON
    if (customId === 'edit_trigger') {
        const modal = new ModalBuilder()
            .setCustomId(`edit_trigger_${cacheKey}`)
            .setTitle('Edit Trigger');

        const nameInput = new TextInputBuilder()
            .setCustomId('name')
            .setLabel('Name')
            .setStyle(TextInputStyle.Short)
            .setValue(triggerData.name || '')
            .setRequired(true)
            .setMaxLength(100);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(triggerData.description || '')
            .setRequired(false)
            .setMaxLength(2000);

        const helpInput = new TextInputBuilder()
            .setCustomId('help')
            .setLabel('Help Text')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(triggerData.help || '')
            .setRequired(false)
            .setMaxLength(2000);

        modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(descriptionInput),
            new ActionRowBuilder().addComponents(helpInput)
        );

        await interaction.showModal(modal);
    }

    // SAVE TRIGGER BUTTON
    if (customId === 'save_trigger') {
        try {
            if (triggerData.isExisting) {
                // Update existing trigger
                await CommonTrigger.findByIdAndUpdate(triggerData._id, {
                    name: triggerData.name,
                    description: triggerData.description,
                    help: triggerData.help
                });

                triggerCache.delete(cacheKey);

                await interaction.update({
                    content: `✅ Trigger updated successfully! ID: ${triggerData._id}`,
                    components: []
                });
            } else {
                // Create new trigger
                const newTrigger = new CommonTrigger({
                    name: triggerData.name,
                    description: triggerData.description,
                    help: triggerData.help
                });

                await newTrigger.save();

                triggerCache.delete(cacheKey);

                await interaction.update({
                    content: `✅ Trigger saved successfully! ID: ${newTrigger._id}`,
                    components: []
                });
            }
        } catch (error) {
            console.error('Error saving trigger:', error);
            await interaction.reply({
                content: `❌ Error saving trigger: ${error.message}`,
                flags: 64
            });
        }
    }
}