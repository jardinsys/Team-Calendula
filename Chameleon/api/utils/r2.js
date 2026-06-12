const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../../../config.json');

const PREVIEW_LENGTH = 500;

const sysR2 = new S3Client({
    region: 'auto',
    endpoint: config.r2?.system?.app?.endpoint || 'https://placeholder.r2.cloudflarestorage.com',
    credentials: {
        accessKeyId: config.r2?.system?.app?.accessKeyId || '',
        secretAccessKey: config.r2?.system?.app?.secretAccessKey || '',
    },
});

async function uploadNoteContent(userId, noteId, content) {
    const r2Key = `notes/${userId}/${noteId}.md`;

    const command = new PutObjectCommand({
        Bucket: config.r2.system.app.bucketName,
        Key: r2Key,
        Body: content,
        ContentType: 'text/markdown; charset=utf-8',
    });

    await sysR2.send(command);

    const publicUrl = `${config.r2.system.app.publicURL}/${r2Key}`;

    return {
        r2Key,
        bucket: 'app',
        url: publicUrl,
        filename: `${noteId}.md`,
        mimeType: 'text/markdown',
        size: Buffer.byteLength(content, 'utf8'),
        uploadedAt: new Date()
    };
}

async function deleteNoteContent(r2Key) {
    if (!r2Key) return;

    const command = new DeleteObjectCommand({
        Bucket: config.r2.system.app.bucketName,
        Key: r2Key,
    });

    await sysR2.send(command);
}

function generatePreview(content, length = PREVIEW_LENGTH) {
    if (!content) return '';
    if (content.length <= length) return content;
    return content.slice(0, length) + '...';
}

module.exports = { uploadNoteContent, deleteNoteContent, generatePreview };
