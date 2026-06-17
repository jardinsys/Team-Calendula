#!/usr/bin/env bash
# Flush R2 buckets for Chameleon
# Deletes all objects from the specified R2 bucket(s).
# Usage: ./flush-r2.sh [--yes] [--bucket app|discord|both]

set -euo pipefail

FORCE=false
TARGET_BUCKET="both"

for arg in "$@"; do
    case "$arg" in
        --yes|-y) FORCE=true ;;
        --bucket) shift; TARGET_BUCKET="${1:-both}" ;;
        *) echo "Unknown arg: $arg"; exit 1 ;;
    esac
    shift 2>/dev/null || true
done

if [[ "$FORCE" != true ]]; then
    echo "⚠️  This will DELETE ALL OBJECTS from R2 bucket(s): $TARGET_BUCKET"
    read -rp "Are you sure? Type 'yes' to confirm: " confirm
    [[ "$confirm" == "yes" ]] || { echo "Aborted."; exit 1; }
fi

node -e "
const fs = require('fs');
const path = require('path');
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');

const configPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(configPath)) {
    console.error('❌ config.json not found at', configPath);
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const r2 = config?.r2?.system;
if (!r2) {
    console.error('❌ No r2.system config found');
    process.exit(1);
}

const targets = '$TARGET_BUCKET' === 'both' ? ['app', 'discord'] : ['$TARGET_BUCKET'];

(async () => {
    for (const name of targets) {
        const bucket = r2[name];
        if (!bucket?.endpoint || !bucket?.bucketName || !bucket?.accessKeyId || !bucket?.secretAccessKey) {
            console.log('⚠️  ' + name + ' bucket config incomplete, skipping.');
            continue;
        }

        const client = new S3Client({
            region: 'auto',
            endpoint: bucket.endpoint,
            credentials: {
                accessKeyId: bucket.accessKeyId,
                secretAccessKey: bucket.secretAccessKey,
            },
            tls: true,
            forcePathStyle: true,
        });

        let totalDeleted = 0;
        let continuationToken = undefined;

        do {
            const listResp = await client.send(new ListObjectsV2Command({
                Bucket: bucket.bucketName,
                ContinuationToken: continuationToken,
            }));

            const contents = listResp.Contents || [];
            if (contents.length === 0) break;

            const objects = contents.map(obj => ({ Key: obj.Key }));
            await client.send(new DeleteObjectsCommand({
                Bucket: bucket.bucketName,
                Delete: { Objects: objects },
            }));

            totalDeleted += objects.length;
            continuationToken = listResp.IsTruncated ? listResp.NextContinuationToken : undefined;
        } while (continuationToken);

        console.log('✅ ' + name + ' bucket (' + bucket.bucketName + '): deleted ' + totalDeleted + ' object(s)');
    }

    console.log('🎉 R2 flush complete.');
    process.exit(0);
})().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
"
