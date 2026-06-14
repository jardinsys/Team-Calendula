#!/bin/bash
# Team-Calendula Docker rebuild script
#
# Usage:
#   ./rebuild.sh                  — rebuild ALL images, restart ALL services
#   ./rebuild.sh --no-cache       — full clean rebuild (purge all Docker cache)
#   ./rebuild.sh plum             — rebuild + restart only Plum
#   ./rebuild.sh sugar            — rebuild + restart only Sugar
#   ./rebuild.sh tigerlily        — rebuild + restart only TigerLily
#   ./rebuild.sh chameleon        — rebuild + restart both Chameleon services
#   ./rebuild.sh chameleon-api    — rebuild + restart only the Chameleon API
#   ./rebuild.sh chameleon-bot    — rebuild + restart only the Chameleon bot
#   ./rebuild.sh redis            — restart only Redis (no rebuild)
#
# Friendly aliases (from index.js bot names):
#   prune    → plum-bot
#   sucre    → sugar-bot
#   trigin   → tigerlily-bot
#   system   → chameleon (api + bot)

set -euo pipefail

NO_CACHE=false
SERVICES=()

# Parse args
for arg in "$@"; do
    case "${arg,,}" in
        --no-cache) NO_CACHE=true ;;
        prune)      SERVICES+=("plum-bot") ;;
        sucre)      SERVICES+=("sugar-bot") ;;
        trigin)     SERVICES+=("tigerlily-bot") ;;
        plum)       SERVICES+=("plum-bot") ;;
        sugar)      SERVICES+=("sugar-bot") ;;
        tigerlily)  SERVICES+=("tigerlily-bot") ;;
        system)     SERVICES+=("chameleon-api" "chameleon-bot") ;;
        chameleon)  SERVICES+=("chameleon-api" "chameleon-bot") ;;
        api)        SERVICES+=("chameleon-api") ;;
        bot)        SERVICES+=("chameleon-bot") ;;
        chameleon-api|chameleon-bot|redis)
                    SERVICES+=("${arg,,}") ;;
        *)
            echo "Unknown bot/service: $arg"
            echo "Valid: plum|prune, sugar|sucre, tigerlily|trigin, chameleon|system, chameleon-api, chameleon-bot, redis"
            exit 1
            ;;
    esac
done

# Clear caches helper
clear_caches() {
    echo "--- Clearing Docker build cache ---"
    if [ "$NO_CACHE" = true ]; then
        docker system prune --all --force
    else
        docker builder prune --all --force
    fi
}

# === ALL BOTS ===
if [ ${#SERVICES[@]} -eq 0 ]; then
    echo "=== Rebuilding ALL services ==="
    docker compose down
    clear_caches
    BUILD_ARGS=""
    if [ "$NO_CACHE" = true ]; then
        BUILD_ARGS="--no-cache"
    fi
    docker compose up --build $BUILD_ARGS -d
    echo "=== All services are up ==="
    exit 0
fi

# === SPECIFIC SERVICE(S) — only touch targeted containers ===
echo "=== Rebuilding: ${SERVICES[*]} ==="

# Stop only the targeted services
docker compose stop "${SERVICES[@]}"

# Remove only the targeted containers (not images, not other services)
docker compose rm -f "${SERVICES[@]}"

# Clear caches if requested
if [ "$NO_CACHE" = true ]; then
    clear_caches
fi

# Rebuild only the targeted services
BUILD_ARGS=""
if [ "$NO_CACHE" = true ]; then
    BUILD_ARGS="--no-cache"
fi
docker compose build $BUILD_ARGS "${SERVICES[@]}"

# Start only the targeted services (with --no-deps so we don't touch dependencies)
docker compose up -d --no-deps "${SERVICES[@]}"

echo "=== ${SERVICES[*]} are up ==="
