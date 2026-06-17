#!/usr/bin/env bash
# Flush R2 buckets for Chameleon test environment
# Usage: ./flush-r2.sh [--yes] [--bucket app|discord|both]

set -euo pipefail

FORCE=false
TARGET_BUCKET="both"  # app, discord, or both

for arg in "$@"; do
    case "$arg" in
        --yes|-y) FORCE=true ;;
        --bucket) shift; TARGET_BUCKET="${1:-both}" ;;
        *) echo "Unknown arg: $arg"; exit 1 ;;
    esac
    shift 2>/dev/null || true
done

# Load config
CONFIG_FILE="$(dirname "$0")/config.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "❌ config.json not found at $CONFIG_FILE"
    exit 1
fi

# Helper to extract JSON value
get_config() {
    local section="$1"
    local key="$2"
    # Extract section object, then get key
    python3 -c "
import json, sys
with open('$CONFIG_FILE') as f:
    config = json.load(f)
val = config.get('r2', {}).get('system', {}).get('$section', {}).get('$key')
if val:
    print(val)
"
}

flush_bucket() {
    local name="$1"
    local endpoint bucket key_id secret

    endpoint=$(get_config "$name" "endpoint")
    bucket=$(get_config "$name" "bucketName")
    key_id=$(get_config "$name" "accessKeyId")
    secret=$(get_config "$name" "secretAccessKey")

    if [[ -z "$endpoint" || -z "$bucket" || -z "$key_id" || -z "$secret" ]]; then
        echo "⚠️  $name bucket config incomplete, skipping."
        return
    fi

    if [[ "$FORCE" != true ]]; then
        echo "⚠️  This will DELETE ALL OBJECTS in R2 bucket '$bucket' ($name bucket)"
        read -rp "Are you sure? Type 'yes' to confirm: " confirm
        [[ "$confirm" == "yes" ]] || { echo "Aborted."; exit 1; }
    fi

    echo "🧹 Flushing $name bucket: $bucket..."
    AWS_ACCESS_KEY_ID="$key_id" AWS_SECRET_ACCESS_KEY="$secret" \
    aws s3 rm "s3://$bucket/" --recursive --endpoint-url="$endpoint" --no-verify-ssl
    echo "✅ $name bucket flushed."
}

if [[ "$TARGET_BUCKET" == "app" || "$TARGET_BUCKET" == "both" ]]; then
    flush_bucket "app"
fi

if [[ "$TARGET_BUCKET" == "discord" || "$TARGET_BUCKET" == "both" ]]; then
    flush_bucket "discord"
fi

echo "🎉 R2 flush complete."