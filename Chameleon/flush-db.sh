#!/usr/bin/env bash
# Flush MongoDB database — Chameleon
# Drops all documents from every collection (schemas/code stay intact).
# Usage: ./flush-db.sh [--yes] [--db test]

set -euo pipefail

DB_NAME="${CHAMELEON_DB:-test}"
FORCE=false

for arg in "$@"; do
    case "$arg" in
        --yes|-y) FORCE=true ;;
        --db) shift; DB_NAME="${1:-test}" ;;
        *) echo "Unknown arg: $arg"; exit 1 ;;
    esac
    shift 2>/dev/null || true
done

if [[ "$FORCE" != true ]]; then
    echo "⚠️  This will DELETE ALL DATA from every collection in the '$DB_NAME' database."
    read -rp "Are you sure? Type 'yes' to confirm: " confirm
    [[ "$confirm" == "yes" ]] || { echo "Aborted."; exit 1; }
fi

node -e "
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const dbName = '$DB_NAME';

// Load MongoDB URI from config.json
let mongoUri = process.env.MONGODB_URI || '';
if (!mongoUri) {
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        mongoUri = config?.mongoURIs?.system || config?.mongodbURI || '';
    }
}
if (!mongoUri) {
    console.error('❌ No MongoDB URI found. Set MONGODB_URI or check config.json');
    process.exit(1);
}

(async () => {
    await mongoose.connect(mongoUri + dbName);
    const db = mongoose.connection.db;
    const collections = await db.listCollections();
    const collNames = collections.map(c => c.name);

    if (collNames.length === 0) {
        console.log('📭 No collections found — database is already empty.');
    } else {
        console.log('🗑️  Found ' + collNames.length + ' collection(s): ' + collNames.join(', '));
        for (const name of collNames) {
            const result = await db.collection(name).deleteMany({});
            console.log('   ✓ ' + name + ': deleted ' + result.deletedCount + ' document(s)');
        }
    }

    console.log('✅ Database \\'' + dbName + '\\' flushed. All collections and indexes preserved.');
    await mongoose.disconnect();
    process.exit(0);
})().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
"
