#!/usr/bin/env bash
# Flush MongoDB test database — Chameleon
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

# Load MongoDB URI from config.json if available
CONFIG_FILE="$(dirname "$0")/config.json"
if [[ -f "$CONFIG_FILE" ]]; then
    MONGO_URI=$(grep -o '"mongodbURI"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | sed 's/.*: *"\([^"]*\)".*/\1/')
    if [[ -n "$MONGO_URI" ]]; then
        export MONGODB_URI="$MONGO_URI"
    fi
fi

MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017}"

if [[ "$FORCE" != true ]]; then
    echo "⚠️  This will DROP the '$DB_NAME' database on: $MONGODB_URI"
    read -rp "Are you sure? Type 'yes' to confirm: " confirm
    [[ "$confirm" == "yes" ]] || { echo "Aborted."; exit 1; }
fi

echo "🧹 Dropping database: $DB_NAME..."
mongosh "$MONGODB_URI/$DB_NAME" --eval "db.dropDatabase()" --quiet

# Also drop the unique index if it was recreated (for layer _id issue)
echo "🔄 Recreating clean connection..."
mongosh "$MONGODB_URI/$DB_NAME" --eval "
    try { db.systems.dropIndex('front.layers._id_1'); print('Dropped front.layers._id_1 index'); } catch(e) {}
    try { db.front.dropIndex('layers._id_1'); print('Dropped front.layers._id_1 index'); } catch(e) {}
" --quiet 2>/dev/null || true

echo "✅ Database '$DB_NAME' flushed cleanly."