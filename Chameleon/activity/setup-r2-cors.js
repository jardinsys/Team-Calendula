const { S3Client, PutBucketCorsCommand } = require('@aws-sdk/client-s3')

const config = require('../../config.json')

const corsRules = [
    {
        AllowedHeaders: ['*'],
        AllowedMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'],
        AllowedOrigins: ['*'],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3600,
    },
]

async function setupBucketCors(label, r2cfg) {
    if (!r2cfg) {
        console.log(`[${label}] No config found, skipping`)
        return
    }

    const s3 = new S3Client({
        region: 'auto',
        endpoint: r2cfg.endpoint,
        credentials: {
            accessKeyId: r2cfg.accessKeyId,
            secretAccessKey: r2cfg.secretAccessKey,
        },
    })

    try {
        const command = new PutBucketCorsCommand({
            Bucket: r2cfg.bucketName,
            CORSConfiguration: { CORSRules: corsRules },
        })
        await s3.send(command)
        console.log(`[${label}] CORS configured for bucket: ${r2cfg.bucketName}`)
    } catch (err) {
        console.error(`[${label}] Failed: ${err.message}`)
    }
}

async function main() {
    await setupBucketCors('app', config.r2.system.app)
    await setupBucketCors('discord', config.r2.system.discord)
}

main()
