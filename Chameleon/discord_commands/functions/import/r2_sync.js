// R2 Image Sync Helper (for imports)

const https = require('https');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../../../config.json');

const sysR2 = new S3Client({
    region: 'auto',
    endpoint: config.r2?.system?.app?.endpoint,
    credentials: {
        accessKeyId: config.r2?.system?.app?.accessKeyId,
        secretAccessKey: config.r2?.system?.app?.secretAccessKey,
    },
});

/**
 * Download a file from an external URL, following redirects.
 * @param {string} url - The URL to download from
 * @param {number} [redirects=0] - Current redirect count (max 5)
 * @returns {Promise<Buffer>} The downloaded file as a Buffer
 * @throws {Error} If too many redirects, HTTP error, or timeout (30s)
 */
async function downloadFromUrl(url, redirects = 0) {
    if (redirects > 5) throw new Error('Too many redirects');
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                downloadFromUrl(res.headers.location, redirects + 1).then(resolve, reject);
                return;
            }
            if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject).setTimeout(30000, () => reject(new Error('Timeout')));
    });
}

/**
 * Upload a buffer to R2 storage and return a media schema object.
 * @param {Buffer} buffer - The file content to upload
 * @param {string} filename - Original filename (used for metadata)
 * @param {string} mimeType - MIME type of the file
 * @param {string} userId - Discord user ID (used in R2 path)
 * @param {string} entityType - Entity type: 'Alter' | 'State' | 'Group'
 * @param {string} field - Field name: 'avatar' | 'banner' | 'proxyAvatar'
 * @returns {Promise<Object>} Media schema object with r2Key, url, metadata
 */
async function uploadToR2(buffer, filename, mimeType, userId, entityType, field) {
    const ext = (filename.split('.').pop() || 'png').toLowerCase();
    const r2Key = `media/${entityType}/${userId}/${field}_${Date.now()}.${ext}`;
    await sysR2.send(new PutObjectCommand({
        Bucket: config.r2.system.app.bucketName,
        Key: r2Key,
        Body: buffer,
        ContentType: mimeType,
    }));
    return {
        r2Key,
        bucket: 'app',
        url: `${config.r2.system.app.publicURL}/${r2Key}`,
        filename,
        mimeType,
        size: buffer.length,
        uploadedAt: new Date(),
    };
}

/**
 * Download external image URL and re-upload to R2.
 * Returns mediaSchema object or null if failed/disabled.
 * @param {string} url - External image URL
 * @param {string} userId - Discord user ID for R2 path
 * @param {string} entityType - 'Alter' | 'State' | 'Group'
 * @param {string} field - 'avatar' | 'banner' | 'proxyAvatar'
 * @returns {Promise<Object|null>}
 */
async function syncImageToR2(url, userId, entityType, field) {
    if (!url || !config.r2?.system?.app?.bucketName) return null;
    try {
        const buffer = await downloadFromUrl(url);
        const ext = url.split('.').pop()?.split('?')[0]?.toLowerCase();
        const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
        const mimeType = mimeMap[ext] || 'image/png';
        const filename = `${field}_${Date.now()}.${ext || 'png'}`;
        return await uploadToR2(buffer, filename, mimeType, userId, entityType, field);
    } catch (err) {
        console.warn(`[Import] Failed to sync image to R2 (${url}):`, err.message);
        return null; // Silently fall back to external URL
    }
}

module.exports = { downloadFromUrl, uploadToR2, syncImageToR2 };
