// (/whois) - Identify who sent a proxied message
// Can be used as a slash command with message ID or as a message context menu

const {
    SlashCommandBuilder,
    ContextMenuCommandBuilder,
    ApplicationCommandType,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder
} = require('discord.js');

const Message = require('../../../schemas/message');
const System = require('../../../schemas/system');
const User = require('../../../schemas/user');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const Group = require('../../../schemas/group');
const redis = require('../../redis');
const proxyMessageHandler = require('../../proxy-message');
const utils = require('../../functions/bot_utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whois')
        .setDescription('Identify who sent a proxied message')
        .addStringOption(opt => opt
            .setName('message_id')
            .setDescription('The message ID to look up (right-click message → Copy Message ID)')
            .setRequired(false))
        .addStringOption(opt => opt
            .setName('message_link')
            .setDescription('The message link (right-click message → Copy Message Link)')
            .setRequired(false)),

    contextMenuData: new ContextMenuCommandBuilder()
        .setName('Who sent this?')
        .setType(ApplicationCommandType.Message),

    async execute(interaction) {
        const messageId = interaction.options.getString('message_id');
        const messageLink = interaction.options.getString('message_link');

        await interaction.deferReply({ ephemeral: true });

        let targetMessageId = messageId;
        let targetChannelId = interaction.channelId;

        if (messageLink && !targetMessageId) {
            const linkMatch = messageLink.match(/channels\/(\d+)\/(\d+)\/(\d+)/);
            if (linkMatch) {
                targetChannelId = linkMatch[2];
                targetMessageId = linkMatch[3];
            }
        }

        if (!targetMessageId) {
            return await interaction.editReply({
                content: '❓ **How to use /whois:**\n\n' +
                    '**Option 1:** Right-click on a proxied message → Apps → "Who sent this?"\n\n' +
                    '**Option 2:** `/whois message_id:123456789`\n' +
                    '(Right-click message → Copy Message ID)\n\n' +
                    '**Option 3:** `/whois message_link:https://discord.com/...`\n' +
                    '(Right-click message → Copy Message Link)'
            });
        }

        await handleWhoisLookup(interaction, targetMessageId, targetChannelId);
    },

    async executeContextMenu(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const targetMessage = interaction.targetMessage;
        await handleWhoisLookup(interaction, targetMessage.id, interaction.channelId, targetMessage);
    },

    async handleButtonInteraction(interaction) {
        const customId = interaction.customId;

        if (customId.startsWith('whois_card_')) {
            await handleCardButton(interaction);
        }
    }
};

/**
 * Look up a message in Redis cache first, then MongoDB
 */
async function getMessageRecord(messageId, channelId) {
    const cached = await redis.get(`msg:${messageId}`);
    if (cached) {
        const data = JSON.parse(cached);
        if (data.discord_channel_id === channelId) {
            return { fromCache: true, data };
        }
    }

    const record = await Message.findOne({
        discord_webhook_message_id: messageId,
        discord_channel_id: channelId
    });

    if (record) {
        const cacheData = {
            _id: record._id.toString(),
            discord_webhook_message_id: record.discord_webhook_message_id,
            discord_channel_id: record.discord_channel_id,
            discord_guild_id: record.discord_guild_id,
            original_message_id: record.original_message_id,
            discord_user_id: record.discord_user_id,
            system_id: record.system_id,
            proxy_type: record.proxy_type,
            proxy_id: record.proxy_id,
            proxy_matched: record.proxy_matched,
            content: record.content,
            attachments: record.attachments || [],
            timestamp: Date.now()
        };
        await redis.set(`msg:${messageId}`, JSON.stringify(cacheData), 'EX', 7 * 24 * 60 * 60);
    }

    return { fromCache: false, data: record };
}

/**
 * Main whois lookup logic
 */
async function handleWhoisLookup(interaction, messageId, channelId, targetMessage = null) {
    const { data: messageRecord, fromCache } = await getMessageRecord(messageId, channelId);

    if (!messageRecord) {
        if (targetMessage && targetMessage.webhookId) {
            return await interaction.editReply({
                content: '❌ This webhook message was not sent through Systemiser.\n' +
                    'It may have been sent by another bot or a Discord integration.'
            });
        }
        return await interaction.editReply({
            content: '❌ This message was not found in Systemiser records.\n' +
                'It may not be a proxied message, or the record has been deleted.'
        });
    }

    const user = await User.findOne({ discordID: messageRecord.discord_user_id });
    const system = await System.findById(messageRecord.system_id);

    let entity = null;
    switch (messageRecord.proxy_type) {
        case 'alter': entity = await Alter.findById(messageRecord.proxy_id); break;
        case 'state': entity = await State.findById(messageRecord.proxy_id); break;
        case 'group': entity = await Group.findById(messageRecord.proxy_id); break;
    }

    const isMasked = entity && system
        ? proxyMessageHandler.shouldMask(entity, system, interaction.guildId)
        : false;

    const entityDisplayName = entity ? utils.getDisplayName(entity) : 'Unknown';
    const entityIndexable = entity?.name?.indexable || '';
    const systemName = system ? utils.getDisplayName(system) : 'Unknown System';

    let discordUser;
    try {
        discordUser = await interaction.client.users.fetch(messageRecord.discord_user_id);
    } catch {
        discordUser = { username: 'Unknown', globalName: null, id: messageRecord.discord_user_id };
    }

    const session = {
        mode: null,
        syncWithDiscord: entity?.syncWithApps?.discord,
        serverId: interaction.guildId
    };
    const avatarUrl = entity ? utils.resolveProxyAvatarUrl(entity, session) : null;

    const guild = interaction.guild;
    let serverNickname = discordUser.username;
    if (guild) {
        try {
            const member = await guild.members.fetch(messageRecord.discord_user_id);
            if (member?.nickname) serverNickname = member.nickname;
        } catch {}
    }

    const embed = new EmbedBuilder()
        .setColor(entity?.color || system?.color || '#888888')
        .setTitle('🔍 Who Sent This?')
        .setAuthor({
            name: entityDisplayName,
            iconURL: avatarUrl || undefined
        })
        .addFields(
            {
                name: 'Entity',
                value: isMasked
                    ? `${capitalize(messageRecord.proxy_type)}: **${entityDisplayName}**`
                    : `${capitalize(messageRecord.proxy_type)}: **${entityDisplayName}**\n(${entityIndexable})`,
                inline: false
            },
            {
                name: 'System',
                value: systemName,
                inline: true
            },
            {
                name: 'Discord User',
                value: `**Username:** ${discordUser.username}\n**Display:** ${serverNickname}\n**ID:** \`${messageRecord.discord_user_id}\``,
                inline: false
            },
            {
                name: 'Message ID',
                value: `\`${messageId}\``,
                inline: false
            }
        )
        .setTimestamp(messageRecord.createdAt || messageRecord.timestamp)
        .setFooter({
            text: `Proxy type: ${messageRecord.proxy_type} • Masked: ${isMasked ? 'Yes' : 'No'}`
        });

    if (avatarUrl) embed.setThumbnail(avatarUrl);

    const components = [];
    if (entity) {
        const cardButton = new ButtonBuilder()
            .setCustomId(`whois_card_${messageRecord.proxy_type}_${messageRecord.proxy_id}_${interaction.user.id}_${interaction.guildId}`)
            .setLabel('View Card in DMs')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📋');
        components.push(new ActionRowBuilder().addComponents(cardButton));
    }

    await interaction.editReply({
        embeds: [embed],
        components
    });
}

/**
 * Handle the "View Card in DMs" button click
 */
async function handleCardButton(interaction) {
    const parts = interaction.customId.replace('whois_card_', '').split('_');
    if (parts.length < 4) {
        return await interaction.reply({ content: '❌ Invalid button data.', ephemeral: true });
    }

    const [type, entityId, userId, guildId] = parts;

    if (interaction.user.id !== userId) {
        return await interaction.reply({ content: '❌ Only the person who ran this whois can view the card.', ephemeral: true });
    }

    let entity;
    switch (type) {
        case 'alter': entity = await Alter.findById(entityId); break;
        case 'state': entity = await State.findById(entityId); break;
        case 'group': entity = await Group.findById(entityId); break;
        default:
            return await interaction.reply({ content: '❌ Unknown entity type.', ephemeral: true });
    }

    if (!entity) {
        return await interaction.reply({ content: '❌ This entity no longer exists.', ephemeral: true });
    }

    const messageRecord = await Message.findOne({
        discord_webhook_message_id: parts[0] ? undefined : undefined,
        proxy_type: type,
        proxy_id: entityId
    });

    const system = await System.findById(messageRecord?.system_id);
    if (!system) {
        return await interaction.reply({ content: '❌ System not found.', ephemeral: true });
    }

    const targetUser = await User.findOne({ systemID: system._id });
    if (targetUser && utils.isBlocked(targetUser, interaction.user.id, null)) {
        return await interaction.reply({ content: '❌ This user\'s information is not available to you.', ephemeral: true });
    }

    const isOwner = interaction.user.id === messageRecord?.discord_user_id;
    const privacyBucket = utils.getPrivacyBucket(system, interaction.user.id, null);
    const isMasked = proxyMessageHandler.shouldMask(entity, system, guildId);

    let discordUser;
    try {
        discordUser = await interaction.client.users.fetch(messageRecord?.discord_user_id);
    } catch {
        discordUser = { username: 'Unknown', globalName: null, id: messageRecord?.discord_user_id || 'unknown' };
    }

    const guild = interaction.guild;
    let serverNickname = discordUser.username;
    if (guild) {
        try {
            const member = await guild.members.fetch(messageRecord?.discord_user_id);
            if (member?.nickname) serverNickname = member.nickname;
        } catch {}
    }

    const jumpUrl = `https://discord.com/channels/${guildId}/${interaction.channelId}/${interaction.message.id}`;

    const dmEmbed = buildDMEmbed({
        entity, type, system, isMasked, isOwner, privacyBucket,
        jumpUrl, discordUser, serverNickname
    });

    try {
        await interaction.user.send({ embeds: [dmEmbed] });
        await interaction.reply({ content: '✅ Sent the card to your DMs!', ephemeral: true });
    } catch (err) {
        await interaction.reply({
            content: '❌ Couldn\'t send you a DM. Make sure you have DMs enabled from server members.',
            ephemeral: true
        });
    }
}

/**
 * Build a privacy-gated DM card embed
 */
function buildDMEmbed({ entity, type, system, isMasked, isOwner, privacyBucket, jumpUrl, discordUser, serverNickname }) {
    const embed = new EmbedBuilder()
        .setColor(entity?.color || system?.color || '#888888')
        .setAuthor({
            name: utils.getDisplayName(system),
            iconURL: entity?.discord?.image?.proxyAvatar?.url || entity?.avatar?.url || undefined
        })
        .setTitle(utils.getDisplayName(entity));

    const entityDisplayName = utils.getDisplayName(entity);
    const entityIndexable = entity?.name?.indexable || '';

    const entityField = isMasked
        ? `${capitalize(type)}: **${entityDisplayName}**`
        : `${capitalize(type)}: **${entityDisplayName}**\n(${entityIndexable})`;

    embed.addFields(
        { name: 'Entity', value: entityField, inline: false },
        { name: 'System', value: utils.getDisplayName(system), inline: true },
        { name: 'Discord User', value: `**Username:** ${discordUser.username}\n**Display:** ${serverNickname}\n**ID:** \`${discordUser.id}\``, inline: false },
        { name: 'Jump to Message', value: `[Click here](${jumpUrl})`, inline: false }
    );

    if (isOwner) {
        buildFullCardFields(embed, entity, type);
    } else if (privacyBucket) {
        buildPrivacyGatedFields(embed, entity, type, privacyBucket.name);
    }

    const avatarUrl = entity?.discord?.image?.proxyAvatar?.url || entity?.avatar?.url;
    if (avatarUrl) embed.setThumbnail(avatarUrl);

    return embed;
}

/**
 * Build full card fields (owner sees everything)
 */
function buildFullCardFields(embed, entity, type) {
    if (type === 'alter') buildAlterFields(embed, entity);
    else if (type === 'state') buildStateFields(embed, entity);
    else if (type === 'group') buildGroupFields(embed, entity);
}

/**
 * Build privacy-gated fields (friend sees what their bucket allows)
 */
function buildPrivacyGatedFields(embed, entity, type, bucketName) {
    const entityPrivacy = entity.setting?.privacy?.find(p => p.bucket === bucketName);
    const canShow = (field) => !entityPrivacy || entityPrivacy.settings?.[field] !== false;

    if (type === 'alter') {
        if (canShow('description') && entity.description) {
            embed.addFields({ name: 'Description', value: entity.description, inline: false });
        }
        if (canShow('pronouns') && entity.pronouns?.length > 0) {
            embed.addFields({ name: 'Pronouns', value: entity.pronouns.join(', '), inline: true });
        }
        if (canShow('birthday') && entity.birthday) {
            embed.addFields({ name: 'Birthday', value: utils.formatDate(entity.birthday), inline: true });
        }
        if (canShow('proxies') && entity.proxy?.length > 0) {
            embed.addFields({ name: 'Proxies', value: utils.formatProxies(entity.proxy), inline: false });
        }
        if (canShow('caution') && entity.caution && (entity.caution.c_type || entity.caution.detail)) {
            let cautionInfo = '';
            if (entity.caution.c_type) cautionInfo += `**Type:** ${entity.caution.c_type}\n`;
            if (entity.caution.detail) cautionInfo += `**Details:** ${entity.caution.detail}\n`;
            embed.addFields({ name: '⚠️ Caution', value: cautionInfo.trim(), inline: false });
        }
    } else if (type === 'state') {
        if (canShow('description') && entity.description) {
            embed.addFields({ name: 'Description', value: entity.description, inline: false });
        }
        if (canShow('caution') && entity.caution && (entity.caution.c_type || entity.caution.detail)) {
            let cautionInfo = '';
            if (entity.caution.c_type) cautionInfo += `**Type:** ${entity.caution.c_type}\n`;
            if (entity.caution.detail) cautionInfo += `**Details:** ${entity.caution.detail}\n`;
            embed.addFields({ name: '⚠️ Caution', value: cautionInfo.trim(), inline: false });
        }
    } else if (type === 'group') {
        if (canShow('description') && entity.description) {
            embed.addFields({ name: 'Description', value: entity.description, inline: false });
        }
        if (canShow('caution') && entity.caution && (entity.caution.c_type || entity.caution.detail)) {
            let cautionInfo = '';
            if (entity.caution.c_type) cautionInfo += `**Type:** ${entity.caution.c_type}\n`;
            if (entity.caution.detail) cautionInfo += `**Details:** ${entity.caution.detail}\n`;
            embed.addFields({ name: '⚠️ Caution', value: cautionInfo.trim(), inline: false });
        }
    }
}

function buildAlterFields(embed, entity) {
    let personalInfo = '';
    if (entity.pronouns?.length > 0) personalInfo += `**Pronouns:** ${entity.pronouns.join(', ')}\n`;
    if (entity.birthday) personalInfo += `**Birthday:** ${utils.formatDate(entity.birthday)}\n`;
    if (entity.name?.aliases?.length > 0) personalInfo += `**Aliases:** ${entity.name.aliases.join(', ')}\n`;
    if (personalInfo) {
        embed.addFields({ name: '👤 Personal Info', value: personalInfo.trim(), inline: false });
    }

    let identificationInfo = '';
    if (entity.signoff) identificationInfo += `**Sign-off:** ${entity.signoff}\n`;
    if (entity.proxy?.length > 0) identificationInfo += `**Proxies:** ${utils.formatProxies(entity.proxy)}\n`;
    if (identificationInfo) {
        embed.addFields({ name: '🏷️ ID\'s', value: identificationInfo.trim(), inline: false });
    }

    if (entity.caution && (entity.caution.c_type || entity.caution.detail || entity.caution.triggers?.length > 0)) {
        let cautionInfo = '';
        if (entity.caution.c_type) cautionInfo += `**Type:** ${entity.caution.c_type}\n`;
        if (entity.caution.detail) cautionInfo += `**Details:** ${entity.caution.detail}\n`;
        if (entity.caution.triggers?.length > 0) {
            const triggerNames = entity.caution.triggers.map(t => t.name).filter(Boolean);
            if (triggerNames.length > 0) cautionInfo += `**Triggers:** ${triggerNames.join(', ')}\n`;
        }
        embed.addFields({ name: '⚠️ Cautions', value: cautionInfo.trim(), inline: false });
    }
}

function buildStateFields(embed, entity) {
    if (entity.description) {
        embed.addFields({ name: 'Description', value: entity.description, inline: false });
    }
    if (entity.proxy?.length > 0) {
        embed.addFields({ name: 'Proxies', value: utils.formatProxies(entity.proxy), inline: false });
    }
    if (entity.caution && (entity.caution.c_type || entity.caution.detail)) {
        let cautionInfo = '';
        if (entity.caution.c_type) cautionInfo += `**Type:** ${entity.caution.c_type}\n`;
        if (entity.caution.detail) cautionInfo += `**Details:** ${entity.caution.detail}\n`;
        embed.addFields({ name: '⚠️ Caution', value: cautionInfo.trim(), inline: false });
    }
}

function buildGroupFields(embed, entity) {
    if (entity.description) {
        embed.addFields({ name: 'Description', value: entity.description, inline: false });
    }
    if (entity.proxy?.length > 0) {
        embed.addFields({ name: 'Proxies', value: utils.formatProxies(entity.proxy), inline: false });
    }
    if (entity.caution && (entity.caution.c_type || entity.caution.detail)) {
        let cautionInfo = '';
        if (entity.caution.c_type) cautionInfo += `**Type:** ${entity.caution.c_type}\n`;
        if (entity.caution.detail) cautionInfo += `**Details:** ${entity.caution.detail}\n`;
        embed.addFields({ name: '⚠️ Caution', value: cautionInfo.trim(), inline: false });
    }
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
