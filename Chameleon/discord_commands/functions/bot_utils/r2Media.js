// R2 Media Utilities
// Cloudflare R2 upload/download, media field resolution, and upload UI builders

const https = require('https');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const {
    StringSelectMenuOptionBuilder,
} = require('discord.js');

const config = require('../../../config.json');

// Initialize R2 Client for Systemiser media (app bucket)
const sysR2 = new S3Client({
    region: 'auto',
    endpoint: config.r2.system.app.endpoint,
    credentials: {
        accessKeyId: config.r2.system.app.accessKeyId,
        secretAccessKey: config.r2.system.app.secretAccessKey,
    },
});

// Initialize R2 Client for Discord-only media (discord bucket)
const discordR2 = new S3Client({
    region: 'auto',
    endpoint: config.r2.system.discord.endpoint,
    credentials: {
        accessKeyId: config.r2.system.discord.accessKeyId,
        secretAccessKey: config.r2.system.discord.secretAccessKey,
    },
});

/* Upload media to the correct R2 bucket
 * @param {Buffer} buffer - File content buffer
 * @param {string} filename - Original filename
 * @param {string} mimeType - MIME type
 * @param {string} userId - Discord user ID for R2 path
 * @param {string} entityType - Entity type for R2 path (e.g., 'Alter', 'State')
 * @param {string} field - Field label for R2 path
 * @param {string} bucket - Which bucket to use ('app' or 'discord', default 'app')
 * @returns {Object} mediaSchema object
 */
async function uploadMediaToR2(buffer, filename, mimeType, userId, entityType, field, bucket = 'app') {
    try {
        const ext = filename.split('.').pop() || 'bin';
        const timestamp = Date.now();
        const r2Key = `media/${entityType}/${userId}/${field}_${timestamp}.${ext}`;

        const bucketConfig = bucket === 'discord' ? config.r2.system.discord : config.r2.system.app;
        const r2Client = bucket === 'discord' ? discordR2 : sysR2;

        const command = new PutObjectCommand({
            Bucket: bucketConfig.bucketName,
            Key: r2Key,
            Body: buffer,
            ContentType: mimeType,
        });

        await r2Client.send(command);

        const publicUrl = `${bucketConfig.publicURL}/${r2Key}`;

        return {
            r2Key: r2Key,
            bucket: bucket,
            url: publicUrl,
            filename: filename,
            mimeType: mimeType,
            size: buffer.length,
            uploadedAt: new Date()
        };
    } catch (error) {
        console.error('Error uploading media to R2:', error);
        throw error;
    }
}

/* Delete a file from Cloudflare R2
 * @param {string} r2Key - The R2 object key to delete
 * @param {string} bucket - Which bucket to delete from ('app' or 'discord', default 'app')
 */
async function deleteFromR2(r2Key, bucket = 'app') {
    try {
        if (!r2Key) return;
        const bucketConfig = bucket === 'discord' ? config.r2.system.discord : config.r2.system.app;
        const r2Client = bucket === 'discord' ? discordR2 : sysR2;
        const command = new DeleteObjectCommand({
            Bucket: bucketConfig.bucketName,
            Key: r2Key,
        });
        await r2Client.send(command);
    } catch (error) {
        console.error('Error deleting from R2:', error);
    }
}

/* Download a file from a URL (e.g., Discord attachment)
 * @param {string} url - URL to download from
 * @returns {Promise<Buffer>} File content buffer
 */
function downloadFromUrl(url, redirects = 0) {
    if (redirects > 5) return Promise.reject(new Error('Too many redirects'));
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            if (res.statusCode === 302 || res.statusCode === 301) {
                downloadFromUrl(res.headers.location, redirects + 1).then(resolve, reject);
                return;
            }
            if (res.statusCode && res.statusCode >= 400) {
                reject(new Error(`Download failed with status ${res.statusCode}`));
                return;
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('Download timed out')); });
    });
}

/* Process an already-collected attachment: validate, download, upload to R2
 * @param {Attachment} attachment - Discord attachment object
 * @param {string} fieldLabel - Label for R2 path (e.g., 'avatar', 'banner')
 * @param {string} entityType - Entity type for R2 path (e.g., 'Alter', 'State')
 * @param {string} userId - Discord user ID for R2 path
 * @param {string} bucket - Which R2 bucket to use ('app' or 'discord', default 'app')
 * @returns {Promise<Object>} { success, media?, message }
 */
async function handleAttachmentUpload(attachment, fieldLabel, entityType, userId, bucket = 'app') {
    if (!attachment?.contentType?.startsWith('image/')) {
        return { success: false, message: 'Not a valid image file. Please send PNG, JPG, GIF, or WEBP.' };
    }

    try {
        const buffer = await downloadFromUrl(attachment.url);
        const media = await uploadMediaToR2(
            buffer,
            attachment.name || 'image',
            attachment.contentType,
            userId,
            entityType,
            fieldLabel,
            bucket
        );
        return { success: true, media, message: 'Image uploaded successfully!' };
    } catch (error) {
        console.error('Error processing attachment upload:', error);
        return { success: false, message: 'Failed to upload image. Try again later.' };
    }
}

/* Prefix command media upload: handles attachment OR URL → R2 → mediaSchema
 * @param {Attachment|null} attachment - Discord attachment (or null)
 * @param {string|null} urlArg - URL string from command args (or null)
 * @param {string} fieldLabel - Label for R2 path (e.g., 'avatar', 'banner')
 * @param {string} entityType - Entity type for R2 path (e.g., 'Alter', 'State')
 * @param {string} userId - Discord user ID for R2 path
 * @param {string} bucket - Which R2 bucket to use ('app' or 'discord', default 'app')
 * @returns {Promise<Object>} { success, media?, message }
 */
async function handlePrefixMediaUpload(attachment, urlArg, fieldLabel, entityType, userId, bucket = 'app') {
    if (attachment) {
        if (!attachment?.contentType?.startsWith('image/')) {
            return { success: false, message: 'Not a valid image file. Please send PNG, JPG, GIF, or WEBP.' };
        }
        return handleAttachmentUpload(attachment, fieldLabel, entityType, userId, bucket);
    }
    if (urlArg) {
        try {
            const buffer = await downloadFromUrl(urlArg);
            const extMatch = urlArg.split('.').pop()?.split('?')[0];
            const ext = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extMatch?.toLowerCase()) ? extMatch.toLowerCase() : 'png';
            const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
            const filename = `${fieldLabel}_${Date.now()}.${ext}`;
            const media = await uploadMediaToR2(buffer, filename, mimeType, userId, entityType, fieldLabel, bucket);
            return { success: true, media, message: 'Image uploaded successfully!' };
        } catch (error) {
            console.error('Error downloading/uploading from URL:', error);
            return { success: false, message: 'Failed to download image from URL. Check the link and try again.' };
        }
    }
    return { success: false, message: 'Please provide a URL or upload an image.' };
}

/* Determine which R2 bucket to use based on sync state and media context
 * @param {boolean} syncWithDiscord - Whether Discord is synced with the app
 * @param {string} mediaCategory - 'primary' | 'discord' | 'server' | 'mask' | 'mask_discord'
 * @returns {string} 'app' or 'discord'
 */
function resolveUploadBucket(syncWithDiscord, mediaCategory) {
    const isDiscordContext = ['discord', 'server', 'mask', 'mask_discord'].includes(mediaCategory);
    if (syncWithDiscord === false && isDiscordContext) return 'discord';
    return 'app';
}

/* Resolve the correct nested path for a media field based on session mode + sync
 * @param {Object} entity - The entity document
 * @param {Object} session - Session data with mode, syncWithDiscord, serverId
 * @param {string} mediaType - 'avatar' | 'banner' | 'proxyAvatar'
 * @returns {Object} { target, pathParts } — target is the nested object, pathParts for setting
 */
function resolveMediaTarget(entity, session, mediaType) {
    if (session.mode === 'mask') {
        if (!entity.mask) entity.mask = {};
        if (mediaType === 'avatar') return { target: entity.mask, path: ['mask', 'avatar'] };
        if (!entity.mask.discord) entity.mask.discord = { image: {} };
        if (!entity.mask.discord.image) entity.mask.discord.image = {};
        return { target: entity.mask.discord.image, path: ['mask', 'discord', 'image', mediaType] };
    }

    if (session.mode === 'server' && session.serverId) {
        if (!entity.discord) entity.discord = {};
        if (!entity.discord.server) entity.discord.server = [];
        let serverEntry = entity.discord.server.find(s => s.id === session.serverId);
        if (!serverEntry) {
            serverEntry = { id: session.serverId };
            entity.discord.server.push(serverEntry);
        }
        return { target: serverEntry, path: ['discord', 'server', session.serverId, mediaType], serverEntry };
    }

    if (session.syncWithDiscord && mediaType === 'avatar') {
        return { target: entity, path: ['avatar'] };
    }

    if (!entity.discord) entity.discord = {};
    if (!entity.discord.image) entity.discord.image = {};
    return { target: entity.discord.image, path: ['discord', 'image', mediaType] };
}

/* Set a media field on an entity, handling R2 cleanup of old media
 * @param {Object} entity - The entity document
 * @param {Object} session - Session data
 * @param {string} mediaType - 'avatar' | 'banner' | 'proxyAvatar'
 * @param {Object} mediaObj - The mediaSchema object to set
 */
async function setMediaField(entity, session, mediaType, mediaObj) {
    const { target, path } = resolveMediaTarget(entity, session, mediaType);

    const oldMedia = target[mediaType];
    if (oldMedia?.r2Key) {
        await deleteFromR2(oldMedia.r2Key, oldMedia.bucket || 'app');
    }

    target[mediaType] = mediaObj;
}

/* Resolve avatar URL with priority chain:
 * Server > Mask Proxy > Mask > Proxy > Discord/Primary (sync-dependent) > none
 * @param {Object} entity - The entity document
 * @param {Object} session - Session data
 * @returns {string|null}
 */
function resolveAvatarUrl(entity, session) {
    const serverId = session?.mode === 'server' ? session.serverId : null;
    const syncWithDiscord = session?.syncWithDiscord ?? entity.syncWithApps?.discord;
    const serverAvatar = serverId ? entity.discord?.server?.find(s => s.id === serverId)?.avatar?.url : null;

    return serverAvatar
        || entity.mask?.discord?.image?.proxyAvatar?.url
        || entity.mask?.avatar?.url
        || entity.discord?.image?.proxyAvatar?.url
        || (syncWithDiscord ? entity.avatar?.url : entity.discord?.image?.avatar?.url)
        || entity.avatar?.url
        || null;
}

/* Resolve banner URL with priority chain:
 * Server > Mask > Discord
 * @param {Object} entity - The entity document
 * @param {Object} session - Session data
 * @returns {string|null}
 */
function resolveBannerUrl(entity, session) {
    const serverId = session?.mode === 'server' ? session.serverId : null;
    const serverBanner = serverId ? entity.discord?.server?.find(s => s.id === serverId)?.banner?.url : null;

    return serverBanner
        || entity.mask?.discord?.image?.banner?.url
        || entity.discord?.image?.banner?.url
        || null;
}

/* Resolve proxy avatar URL with priority chain:
 * Mask Proxy > Proxy > Primary Avatar
 * @param {Object} entity - The entity document
 * @param {Object} session - Session data
 * @returns {string|null}
 */
function resolveProxyAvatarUrl(entity, session) {
    return entity.mask?.discord?.image?.proxyAvatar?.url
        || entity.discord?.image?.proxyAvatar?.url
        || entity.avatar?.url
        || null;
}

/* Ensure a discord.server entry exists for the current guild
 * @param {Object} entity - The entity document
 * @param {string} guildId - Discord guild ID
 * @param {string} guildName - Discord guild name
 * @returns {Object} The server entry
 */
function ensureServerEntry(entity, guildId, guildName = null) {
    if (!entity.discord) entity.discord = {};
    if (!entity.discord.server) entity.discord.server = [];
    let serverEntry = entity.discord.server.find(s => s.id === guildId);
    if (!serverEntry) {
        serverEntry = { id: guildId, name: guildName || 'Unknown Server' };
        entity.discord.server.push(serverEntry);
    }
    return serverEntry;
}

/* Build upload select menu options based on session mode + sync
 * @param {Object} session - Session data
 * @param {string} prefix - Custom ID prefix (e.g., 'alter')
 * @returns {Array<StringSelectMenuOptionBuilder>}
 */
function buildUploadOptions(session) {
    const options = [];

    if (session.mode === 'mask') {
        options.push(
            new StringSelectMenuOptionBuilder().setLabel('Mask Avatar').setValue('mask_avatar').setEmoji('🎭'),
            new StringSelectMenuOptionBuilder().setLabel('Mask Discord Avatar').setValue('mask_davatar').setEmoji('🎭'),
            new StringSelectMenuOptionBuilder().setLabel('Mask Proxy Avatar').setValue('mask_proxy').setEmoji('🎭'),
            new StringSelectMenuOptionBuilder().setLabel('Mask Banner').setValue('mask_banner').setEmoji('🖼️')
        );
    } else if (session.mode === 'server') {
        options.push(
            new StringSelectMenuOptionBuilder().setLabel('Server Avatar').setValue('server_avatar').setEmoji('🏠'),
            new StringSelectMenuOptionBuilder().setLabel('Server Banner').setValue('server_banner').setEmoji('🖼️'),
            new StringSelectMenuOptionBuilder().setLabel('Server Proxy Avatar').setValue('server_proxy').setEmoji('🏠')
        );
    } else {
        if (session.syncWithDiscord) {
            options.push(
                new StringSelectMenuOptionBuilder().setLabel('Primary Avatar').setValue('primary_avatar').setEmoji('👤'),
                new StringSelectMenuOptionBuilder().setLabel('Discord Avatar').setValue('discord_avatar').setEmoji('💬')
            );
        } else {
            options.push(
                new StringSelectMenuOptionBuilder().setLabel('Discord Avatar').setValue('discord_avatar').setEmoji('💬')
            );
        }
        options.push(
            new StringSelectMenuOptionBuilder().setLabel('Proxy Avatar').setValue('proxy_avatar').setEmoji('🗣️'),
            new StringSelectMenuOptionBuilder().setLabel('Banner').setValue('banner').setEmoji('🖼️')
        );
    }

    return options;
}

module.exports = {
    // R2 clients
    sysR2,
    discordR2,
    // Media operations
    uploadMediaToR2,
    deleteFromR2,
    downloadFromUrl,
    handleAttachmentUpload,
    handlePrefixMediaUpload,
    // Resolution helpers
    resolveUploadBucket,
    resolveMediaTarget,
    setMediaField,
    resolveAvatarUrl,
    resolveBannerUrl,
    resolveProxyAvatarUrl,
    ensureServerEntry,
    buildUploadOptions,
};