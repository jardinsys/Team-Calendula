// (/intro)
// (/intro edit)
// (/intro show)

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const User = require('../schemas/user');
const Guild = require('../schemas/guild');
const mongoose = require('mongoose');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { trigR2 } = require('../../../../r2'); // Use your existing R2 client
const crypto = require('crypto'); // For generating unique random filenames
const config = require('../../../../config.js');

// Store active image upload sessions
const imageUploadSessions = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('intro')
        .setDescription('Manage your intro')
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit your intro')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('Show your intro')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        // Get or create user
        let user = await User.findOne({ discordId: interaction.user.id });
        let isNewUser = false;

        if (!user) {
            isNewUser = true;
            user = new User({
                _id: new mongoose.Types.ObjectId(),
                discordId: interaction.user.id,
                createdAt: new Date(),
                intro: {},
                trigger: {},
                affirmations: [],
                premium: {
                    active: false
                },
                sponsor: {
                    available: 0,
                    guildIDs: [],
                    userIDs: []
                }
            });
            await user.save();

            // Send welcome message
            const welcomeEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Welcome! 🎉')
                .setDescription('Welcome to our bot! You can now create your intro using `/intro edit`.')
                .setTimestamp();

            await interaction.reply({ embeds: [welcomeEmbed], ephemeral: true });
            return;
        }

        // Get guild data for channel info
        const guild = await Guild.findOne({ discordId: interaction.guildId });

        if (subcommand === 'show') {
            await handleShow(interaction, user);
        } else if (subcommand === 'edit') {
            await handleEdit(interaction, user, guild);
        } else {
            // Default command (no subcommand) - show with buttons
            await handleDefault(interaction, user, guild);
        }
    },
};

async function handleShow(interaction, user) {
    if (!user.intro?.text) {
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setDescription('*You do not have an intro yet.*');
        
        return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    const embed = buildIntroEmbed(user, interaction.user, interaction.member);
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDefault(interaction, user, guild) {
    let embed;
    
    if (!user.intro?.text) {
        // Show error embed but WITH buttons so they can create intro
        embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setDescription('*You do not have an intro yet.*');
    } else {
        embed = buildIntroEmbed(user, interaction.user, interaction.member);
    }

    const buttons = buildActionButtons(guild?.userIntroChannel);

    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });

    // Set up button collector with 3 minute timeout
    const collector = interaction.channel.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 180000 // 3 minutes
    });

    collector.on('collect', async i => {
        await handleButtonInteraction(i, user, guild, interaction.user, interaction.member);
    });

    collector.on('end', () => {
        // Clean up any active image upload sessions for this user
        imageUploadSessions.delete(interaction.user.id);
    });
}

async function handleEdit(interaction, user, guild) {
    const hasPremium = user.premium?.active || false;
    const modal = buildEditModal(user, hasPremium);

    await interaction.showModal(modal);

    // Wait for modal submission with 3 minute timeout
    try {
        const submitted = await interaction.awaitModalSubmit({
            filter: i => i.user.id === interaction.user.id,
            time: 180000
        });

        // Update user data from modal
        await updateUserFromModal(submitted, user, hasPremium);

        // Show updated intro with buttons (now that they have text)
        const embed = buildIntroEmbed(user, interaction.user, interaction.member);
        const buttons = buildActionButtons(guild?.userIntroChannel);

        await submitted.reply({ embeds: [embed], components: [buttons], ephemeral: true });

        // Set up button collector
        const collector = submitted.channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 180000
        });

        collector.on('collect', async i => {
            await handleButtonInteraction(i, user, guild, interaction.user, interaction.member);
        });

        collector.on('end', () => {
            imageUploadSessions.delete(interaction.user.id);
        });

    } catch (error) {
        if (error.message.includes('time')) {
            // Modal timed out, ignore
            return;
        }
        console.error('Error in handleEdit:', error);
    }
}

async function handleButtonInteraction(interaction, user, guild, discordUser, member) {
    const hasPremium = user.premium?.active || false;

    if (interaction.customId === 'edit_intro') {
        const modal = buildEditModal(user, hasPremium);
        await interaction.showModal(modal);

        try {
            const submitted = await interaction.awaitModalSubmit({
                filter: i => i.user.id === interaction.user.id,
                time: 180000
            });

            await updateUserFromModal(submitted, user, hasPremium);

            const embed = buildIntroEmbed(user, discordUser, member);
            const buttons = buildActionButtons(guild?.userIntroChannel);

            await submitted.update({ embeds: [embed], components: [buttons] });

        } catch (error) {
            if (!error.message.includes('time')) {
                console.error('Error in edit modal:', error);
            }
        }

    } else if (interaction.customId === 'update_images') {
        await handleImageUpdate(interaction, user, hasPremium, discordUser, member, guild);

    } else if (interaction.customId === 'save_intro') {
        await user.save();
        await interaction.reply({ content: '✅ Your intro has been saved!', ephemeral: true });

    } else if (interaction.customId === 'send_intro') {
        if (!guild?.userIntroChannel) {
            return await interaction.reply({ 
                content: '❌ No intro channel has been set up for this server.', 
                ephemeral: true 
            });
        }

        try {
            await user.save();
            
            const channel = await interaction.client.channels.fetch(guild.userIntroChannel);
            const embed = buildIntroEmbed(user, discordUser, member);
            
            await channel.send({ embeds: [embed] });
            await interaction.update({ 
                content: '✅ Your intro has been saved and sent to the intro channel!', 
                embeds: [], 
                components: [] 
            });

        } catch (error) {
            console.error('Error sending intro:', error);
            await interaction.reply({ 
                content: '❌ Failed to send intro to channel. Please try again.', 
                ephemeral: true 
            });
        }
    }
}

async function handleImageUpdate(interaction, user, hasPremium, discordUser, member, guild) {
    await interaction.reply({ 
        content: '📸 Please send an image for your **thumbnail** (or type "skip" to skip).',
        ephemeral: true 
    });

    const steps = hasPremium 
        ? ['thumbnail', 'banner', 'header.icon', 'footer.icon']
        : ['thumbnail'];

    const sessionId = `${interaction.user.id}-${Date.now()}`;
    imageUploadSessions.set(interaction.user.id, {
        id: sessionId,
        currentStep: 0,
        steps: steps,
        interaction: interaction,
        user: user,
        discordUser: discordUser,
        member: member,
        guild: guild
    });

    await processImageStep(interaction, sessionId);
}

async function processImageStep(interaction, sessionId) {
    const session = imageUploadSessions.get(interaction.user.id);
    if (!session || session.id !== sessionId) return;

    const { currentStep, steps, user, discordUser, member, guild } = session;

    if (currentStep >= steps.length) {
        // All steps complete
        imageUploadSessions.delete(interaction.user.id);
        
        const embed = buildIntroEmbed(user, discordUser, member);
        const buttons = buildActionButtons(guild?.userIntroChannel);

        try {
            await interaction.followUp({ 
                content: '✅ Images updated!', 
                embeds: [embed], 
                components: [buttons], 
                ephemeral: true 
            });
        } catch (error) {
            console.error('Error showing updated intro:', error);
        }
        return;
    }

    const currentField = steps[currentStep];
    const hasPremium = user.premium?.active || false;

    // Create message collector for this step
    const filter = m => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({ 
        filter, 
        max: 1, 
        time: 180000 
    });

    collector.on('collect', async message => {
        try {
            // Delete user's message
            await message.delete().catch(() => {});

            if (message.content.toLowerCase() === 'skip') {
                session.currentStep++;
                
                if (session.currentStep < steps.length) {
                    const nextField = steps[session.currentStep];
                    const fieldName = getFieldDisplayName(nextField);
                    await interaction.followUp({ 
                        content: `📸 Please send an image for your **${fieldName}** (or type "skip" to skip).}`,
                        ephemeral: true 
                    });
                    await processImageStep(interaction, sessionId);
                } else {
                    await processImageStep(interaction, sessionId);
                }
                return;
            }

            // Check for attachment
            if (message.attachments.size === 0) {
                await interaction.followUp({ 
                    content: '❌ Please send an image or type "skip".',
                    ephemeral: true 
                });
                await processImageStep(interaction, sessionId);
                return;
            }

            const attachment = message.attachments.first();

            // Validate file size
            if (attachment.size > 8 * 1024 * 1024) {
                await interaction.followUp({ 
                    content: '❌ Image must be under 8MB. Please send a smaller image or type "skip".',
                    ephemeral: true 
                });
                await processImageStep(interaction, sessionId);
                return;
            }

            // Check if animated/GIF for non-premium users
            if (!hasPremium && (attachment.contentType === 'image/gif' || attachment.name.toLowerCase().endsWith('.gif'))) {
                await interaction.followUp({ 
                    content: '❌ Animated images and GIFs require premium. Please send a static image or type "skip".',
                    ephemeral: true 
                });
                await processImageStep(interaction, sessionId);
                return;
            }

            // Validate image type
            if (!attachment.contentType?.startsWith('image/')) {
                await interaction.followUp({ 
                    content: '❌ Please send a valid image file or type "skip".',
                    ephemeral: true 
                });
                await processImageStep(interaction, sessionId);
                return;
            }

            // Upload to R2
            const mediaData = await uploadToR2(attachment);

            // Update user data
            setNestedProperty(user.intro, currentField, mediaData);

            session.currentStep++;
            
            if (session.currentStep < steps.length) {
                const nextField = steps[session.currentStep];
                const fieldName = getFieldDisplayName(nextField);
                await interaction.followUp({ 
                    content: `✅ Image uploaded!\n\n📸 Please send an image for your **${fieldName}** (or type "skip" to skip).\n\n` +
                             `⚠️ Image must be under 8MB${!hasPremium ? ' and cannot be animated/GIF.' : '.'}`,
                    ephemeral: true 
                });
                await processImageStep(interaction, sessionId);
            } else {
                await processImageStep(interaction, sessionId);
            }

        } catch (error) {
            console.error('Error processing image:', error);
            await interaction.followUp({ 
                content: '❌ Error uploading image. Please try again or type "skip".',
                ephemeral: true 
            });
            await processImageStep(interaction, sessionId);
        }
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time' && imageUploadSessions.has(interaction.user.id)) {
            imageUploadSessions.delete(interaction.user.id);
            interaction.followUp({ 
                content: '⏱️ Image upload timed out.',
                ephemeral: true 
            }).catch(() => {});
        }
    });
}

function getFieldDisplayName(field) {
    const names = {
        'thumbnail': 'thumbnail',
        'banner': 'banner',
        'header.icon': 'header icon',
        'footer.icon': 'footer icon'
    };
    return names[field] || field;
}

function setNestedProperty(obj, path, value) {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
            current[parts[i]] = {};
        }
        current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = value;
}

async function uploadToR2(attachment) {
    try {
        // Download the image
        const response = await fetch(attachment.url);
        const buffer = Buffer.from(await response.arrayBuffer());

        // Generate unique key using crypto to prevent filename collisions
        const hash = crypto.randomBytes(16).toString('hex');
        const ext = attachment.name.split('.').pop();
        const r2Key = `intros/${hash}.${ext}`;

        // Upload to R2 using your existing trigR2 client
        const command = new PutObjectCommand({
            Bucket: config.r2.trigin.bucketName,
            Key: r2Key,
            Body: buffer,
            ContentType: attachment.contentType,
        });

        await trigR2.send(command);

        // Construct public URL
        const publicUrl = `${config.r2.trigin.publicURL}/${r2Key}`;

        return {
            r2Key: r2Key,
            url: publicUrl,
            filename: attachment.name,
            mimeType: attachment.contentType,
            size: attachment.size,
            uploadedAt: new Date()
        };

    } catch (error) {
        console.error('Error uploading to R2:', error);
        throw error;
    }
}

function buildIntroEmbed(user, discordUser, member) {
    const hasPremium = user.premium?.active || false;
    const intro = user.intro;

    const embed = new EmbedBuilder();

    // Color
    if (intro.color) {
        embed.setColor(intro.color);
    } else {
        embed.setColor('#0099ff'); // CHANGE TO ORANGE/THEME
    }

    // Title
    if (hasPremium && intro.title) {
        embed.setTitle(intro.title);
    } else {
        const displayName = member?.displayName || discordUser.username;
        embed.setTitle(`${displayName}'s Intro`);
    }

    // Description (main text)
    if (intro.text) {
        embed.setDescription(intro.text);
    }

    // Author/Header
    if (hasPremium && intro.header?.text) {
        const authorOptions = { name: intro.header.text };
        if (intro.header.icon?.url) {
            authorOptions.iconURL = intro.header.icon.url;
        }
        embed.setAuthor(authorOptions);
    } else if (!hasPremium || !intro.header?.text) {
        // Use user's avatar as author icon
        embed.setAuthor({ 
            name: member?.displayName || discordUser.username,
            iconURL: discordUser.displayAvatarURL({ dynamic: true })
        });
    }

    // Fields
    if (hasPremium && intro.field?.title && intro.field?.text) {
        const fieldCount = Math.min(intro.field.title.length, intro.field.text.length);
        for (let i = 0; i < fieldCount; i++) {
            if (intro.field.title[i] && intro.field.text[i]) {
                embed.addFields({ 
                    name: intro.field.title[i], 
                    value: intro.field.text[i],
                    inline: false
                });
            }
        }
    }

    // Footer
    if (hasPremium && intro.footer?.text) {
        const footerOptions = { text: intro.footer.text };
        if (intro.footer.icon?.url) {
            footerOptions.iconURL = intro.footer.icon.url;
        }
        embed.setFooter(footerOptions);
    }

    // Thumbnail
    if (intro.thumbnail?.url) {
        embed.setThumbnail(intro.thumbnail.url);
    }

    // Banner
    if (hasPremium && intro.banner?.url) {
        embed.setImage(intro.banner.url);
    }

    return embed;
}

function buildActionButtons(userIntroChannel) {
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('edit_intro')
                .setLabel('Edit Intro')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✏️'),
            new ButtonBuilder()
                .setCustomId('update_images')
                .setLabel('Update Images')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🖼️'),
            new ButtonBuilder()
                .setCustomId('save_intro')
                .setLabel('Save')
                .setStyle(ButtonStyle.Success)
                .setEmoji('💾')
        );

    // Only add Send button if channel is configured
    if (userIntroChannel) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('send_intro')
                .setLabel('Send')
                .setStyle(ButtonStyle.Success)
                .setEmoji('📤')
        );
    }

    return row;
}

function buildEditModal(user, hasPremium) {
    const modal = new ModalBuilder()
        .setCustomId('edit_intro_modal')
        .setTitle('Edit Your Intro');

    const intro = user.intro || {};

    // Main text (always available)
    const textInput = new TextInputBuilder()
        .setCustomId('intro_text')
        .setLabel('Introduction Text')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(4000);
    
    if (intro.text) {
        textInput.setValue(intro.text);
    }

    // Color (always available)
    const colorInput = new TextInputBuilder()
        .setCustomId('intro_color')
        .setLabel('Embed Color (hex)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);
    
    if (intro.color) {
        colorInput.setValue(intro.color);
    }

    modal.addComponents(
        new ActionRowBuilder().addComponents(textInput),
        new ActionRowBuilder().addComponents(colorInput)
    );

    if (hasPremium) {
        // Title
        const titleInput = new TextInputBuilder()
            .setCustomId('intro_title')
            .setLabel('Title')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(256);
        
        if (intro.title) {
            titleInput.setValue(intro.title);
        }

        // Header text
        const headerInput = new TextInputBuilder()
            .setCustomId('intro_header_text')
            .setLabel('Header Text')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(256);
        
        if (intro.header?.text) {
            headerInput.setValue(intro.header.text);
        }

        // Footer text
        const footerInput = new TextInputBuilder()
            .setCustomId('intro_footer_text')
            .setLabel('Footer Text')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(2048);
        
        if (intro.footer?.text) {
            footerInput.setValue(intro.footer.text);
        }

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(headerInput),
            new ActionRowBuilder().addComponents(footerInput)
        );
    }

    return modal;
}

async function updateUserFromModal(interaction, user, hasPremium) {
    if (!user.intro) {
        user.intro = {};
    }

    // Always update text and color
    user.intro.text = interaction.fields.getTextInputValue('intro_text');
    
    const color = interaction.fields.getTextInputValue('intro_color');
    if (color) {
        user.intro.color = color;
    }

    if (hasPremium) {
        // Update premium fields
        const title = interaction.fields.getTextInputValue('intro_title');
        if (title) {
            user.intro.title = title;
        }

        const headerText = interaction.fields.getTextInputValue('intro_header_text');
        if (headerText) {
            if (!user.intro.header) user.intro.header = {};
            user.intro.header.text = headerText;
        }

        const footerText = interaction.fields.getTextInputValue('intro_footer_text');
        if (footerText) {
            if (!user.intro.footer) user.intro.footer = {};
            user.intro.footer.text = footerText;
        }
    }

    // Note: We don't save here - that happens when Save or Send button is clicked
}