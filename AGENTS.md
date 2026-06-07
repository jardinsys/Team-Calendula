# Team-Calendula — Agent Context

## Project Overview
A Discord bot system for managing plural systems (alters, states, groups) with R2 media storage, privacy buckets, mask/server modes, and Discord sync.

## Directory Structure
```
Team-Calendula/
├── media.js                        # Mongoose mediaSchema (r2Key, bucket, url, filename, mimeType, size, uploadedAt)
├── extra-config.js                 # Example config templates (DO NOT commit with real credentials)
├── config.json                     # ROOT config — Plum/Sugar/TigerLily creds (Chameleon uses own)
├── Dockerfile                      # 5-step build: root deps → workspace deps → activity deps → copy → build activity
├── compose.yaml                    # 6 services (redis, chameleon-api, chameleon-bot, plum-bot, sugar-bot, tigerlily-bot)
├── AGENTS.md                       # This file
├── rebuild.sh                      # Docker rebuild with per-bot targeting
├── Chameleon/
│   ├── config.json                 # Chameleon's own config (tokens, MongoDB, R2, JWT, secrets)
│   ├── bot.js                      # Discord bot entry point
│   ├── deploy-command.js           # Deploys slash + context menu commands; preserves Entry Point (type 4)
│   ├── redis.js                    # Redis client (ioredis) — reads REDIS_URL env var or config.json fallback, no-op fallback
│   ├── database.js                 # Mongoose connection
│   ├── package.json                # Workspace: ["webapp", "shared"] — activity NOT a workspace member
│   ├── api/
│   │   ├── api.js                  # Express API router (auth, system, alters, states, groups, notes, front, friends, quick)
│   │   ├── middleware/auth.js      # JWT auth middleware — exports authenticateToken + authMiddleware alias
│   │   ├── utils/
│   │   │   └── r2.js              # R2 client + uploadNoteContent, deleteNoteContent, generatePreview
│   │   └── routes/                 # Per-resource API route files
│   ├── webapp/
│   │   ├── server.js               # Express 5 — serves API (/api), webapp SPA fallback, activity SPA (/discord_activity), assets (/assets); root-level activity detection via frame_id
│   │   └── package.json
│   ├── activity/
│   │   ├── package.json            # Independent project (not workspace) with "@chameleon/shared": "file:../shared"
│   │   ├── node_modules/           # Own deps (193 packages) — @robojs/patch breaks with hoisting
│   │   ├── dist/                   # Built output (index.html, assets/index-*.js ~524KB bundle, assets/index-*.css ~22KB, assets/fonts/*.woff2)
│   │   ├── config/vite.mjs         # Reads ../../config.json; resolve.alias for react/react-dom dedup
│   │   └── src/
│   │       ├── app/
│   │       │   ├── App.jsx         # Root — DiscordContextProvider
│   │       │   ├── Activity.jsx    # Status gate + page routing (deep-link via ?page= param)
│   │       │   └── pages/
│   │       │       ├── LandingPage.jsx   # Hub — System, Friends, Notes, Crisis cards
│   │       │       ├── SystemPage.jsx    # Full page — overview, front, alter/state/group sub-pages with CRUD
│   │       │       ├── FriendsPage.jsx   # Full page — friend list, front detail, add friend
│   │       │       ├── NotesPage.jsx     # Notes CRUD via shared API client
│   │       │       └── CrisisPage.jsx    # Placeholder — crisis tools
│   │       └── api/token.js        # Uses process.cwd() to find config.json (not createRequire/import.meta.url)
│   ├── shared/
│   │   ├── package.json            # ESM workspace package (@chameleon/shared) — "type": "module"
│   │   └── src/
│   │       ├── index.js            # Barrel exports: api, ApiClient, NoteCard, NoteCardGrid, NoteModal, CreateNoteModal, EntityCard, EntityCardList, EntityDetailModal, EntityFormModal, FrontDisplay, FronterAvatar, FriendCard, FriendCardList, FriendDetailModal, AddFriendModal
│   │       ├── api/
│   │       │   └── client.js       # ApiClient — 40+ methods: notes, system, alters, states, groups, front, friends, quick switch
│   │       └── components/
│   │           ├── NoteCard.jsx, NoteCardGrid.jsx    # Note cards (Google Keep-style)
│   │           ├── NoteModal.jsx                     # Note viewer/editor
│   │           ├── CreateNoteModal.jsx               # Note creation form
│   │           ├── EntityCard.jsx, EntityCardList.jsx # Alter/State/Group list cards
│   │           ├── EntityDetailModal.jsx              # Entity detail bottom-sheet (view, edit, delete)
│   │           ├── EntityFormModal.jsx                # Entity create/edit form
│   │           ├── FrontDisplay.jsx                   # Front layers + fronters with avatars, status, battery, duration
│   │           ├── FriendCard.jsx, FriendCardList.jsx # Friend list cards with front preview
│   │           ├── FriendDetailModal.jsx              # Friend front detail (privacy-gated via API)
│   │           └── AddFriendModal.jsx                 # Add friend by ID form
│   ├── schemas/
│   │   ├── alter.js                # Alter entity schema
│   │   ├── state.js                # State entity schema
│   │   ├── group.js                # Group entity schema
│   │   ├── system.js               # System entity schema
│   │   ├── settings.js             # PrivacyBucket, alterPrivacySchema, groupPrivacySchema, systemPrivacySchema, PrivacyBucket
│   │   ├── user.js                 # User schema
│   │   ├── front.js                # Front/layer schema (Shift, layerSchema)
│   │   ├── message.js              # Message schema (discord_webhook_message_id, discord_channel_id, proxy_type, proxy_id, content, attachments)
│   │   ├── guild.js                # Guild schema
│   │   └── note.js                 # Note schema
│   └── discord_commands/
│       └── global/
│           ├── proxy-message.js    # Core proxy message handler (read → resend as entity)
│           ├── prefix/             # sys! commands (config, serverconfig, alter, state, group, system, friend, etc.)
│           └── slash/
│               ├── alter.js        # /alter commands + edit interface
│               ├── state.js        # /state commands + edit interface
│               ├── group.js        # /group commands + edit interface
│               ├── system.js       # /system commands + edit interface
│               ├── systemise.js    # /systemise — LAUNCH_ACTIVITY (type 12) callback for Discord Activity
│               ├── profile.js      # /profile command
│               ├── front.js        # /front command (view, switch, layers, per-entity editing)
│               ├── friend.js       # /friend command (list, view, add, remove, requests, block, unblock, settings)
│               ├── whois.js        # /whois command + "Who sent this?" context menu
│               ├── settings.js     # /settings command (server, proxy, notifications, general sections)
│               ├── message.js      # /message command (action pattern: edit/delete/reproxy, auto-detect last message)
│               ├── crisis.js       # /crisis command
│               ├── support.js      # /support command
│               ├── whoami.js       # /whoami command
│               ├── switch.js       # DEPRECATED — to be deleted by user
│               └── quickswitch.js  # DEPRECATED — to be deleted by user
├── Plum/
│   └── index.js                    # Utility bot
├── Sugar/
│   └── index.js                    # Utility bot
└── TigerLily/
    └── schemas/
        └── trigger.js              # Trigger schema (future production)
```

## Key Architectural Decisions

### Command Routing Pattern
All slash command files use `switch (action)` with `return await` + `break` routing in `handleButtonInteraction`. See `alter.js` as the canonical example.

### Session Management
Sessions are stored in-memory via `bot_utils.js` `active_sessions` Map. Each session has:
- `id` — unique session ID
- `type` — 'edit', 'settings', 'show', 'list'
- Entity ID reference (e.g., `alterId`, `stateId`, `groupId`, `systemId`)
- `mode` — `null`, `'mask'`, or `'server'`
- `serverId` — Discord guild ID when in server mode
- `syncWithDiscord` — boolean from entity's `syncWithApps.discord`
- `uploadMode` — boolean, toggles between upload button and select menu

### Avatar/Banner Display Priority Chain
Used in all card builders (`buildAlterCard`, `buildStateCard`, `buildGroupCard`, `buildSystemCard`):

**Thumbnail (avatar):**
1. `discord.server[currentGuild].avatar` (server mode)
2. `mask.discord.image.proxyAvatar` (mask mode proxy)
3. `mask.avatar` (mask mode primary)
4. `discord.image.proxyAvatar` (normal mode proxy)
5. `avatar` if `syncWithDiscord` is true, else `discord.image.avatar`
6. `avatar` (fallback)

**Banner (embed image):**
1. `discord.server[currentGuild].banner`
2. `mask.discord.image.banner`
3. `discord.image.banner`

**Author icon (proxy avatar):**
1. `mask.discord.image.proxyAvatar`
2. `discord.image.proxyAvatar`
3. `avatar` (fallback)

### Media Upload Flow
1. User clicks "Upload Media" button → `session.uploadMode = true`, UI swaps to select menu + back button
2. User selects media type from menu → bot prompts for attachment via `awaitMessages` (60s timeout)
3. Attachment validated (must be `image/*` content type), downloaded, uploaded to R2
4. Media object stored at correct path based on `session.mode` + `session.syncWithDiscord`:
   - **Mask mode** → `mask.avatar` or `mask.discord.image.{avatar,banner,proxyAvatar}`
   - **Server mode** → `discord.server[serverId].{avatar,banner,proxyAvatar}`
   - **Normal + sync** → `avatar` (primary) or `discord.image.{banner,proxyAvatar}`
   - **Normal + no sync** → `discord.image.{avatar,banner,proxyAvatar}`
5. Old R2 object deleted before new one is set

### Server Mode
- Entered via "Enter Server Mode" button → sets `session.mode = 'server'`, `session.serverId = interaction.guildId`
- Calls `utils.ensureServerEntry(entity, guildId, guildName)` to create `discord.server[]` entry if missing
- Exited via "Exit Server Mode" → clears `session.mode` and `session.serverId`

### Sync Routing
When editing image info via modal, routing depends on `session.syncWithDiscord`:
- `syncWithDiscord = true` → avatar goes to `entity.avatar`, banner/proxy go to `entity.discord.image.*`
- `syncWithDiscord = false` → all go to `entity.discord.image.*`
- `session.mode = 'mask'` → all go to `entity.mask.*`

### Bidirectional Linking
- `alter.groupsIDs` ↔ `group.alterIDs` (use `$pull`/`$addToSet` diff pattern)
- `alter.states` ↔ `state.alters`
- `state.groupIDs` ↔ `group.stateIDs`

### Privacy System
- `PrivacyBucket` documents referenced by `system.privacyBuckets`
- Each entity has `setting.privacy[]` array of `{ bucket, settings }`
- Settings schema varies by entity type (`alterPrivacySchema`, `groupPrivacySchema`, `systemPrivacySchema`)
- `alterPrivacySchema` includes fields like `avatar`, `description`, `pronouns`, etc. with boolean visibility

#### Default Privacy Bucket (New Users)
- `createNewUserAndSystem()` seeds a `Default` privacy bucket with `friends: []` on every new system
- `getPrivacyBucket()` no longer falls back to `Default` for strangers — only returns a bucket if the viewer is explicitly in its `friends[]` list
- Strangers get `null` from `getPrivacyBucket()` → `shouldShowEntity()` returns `false` → maximum privacy by default
- Existing systems can get the `Default` bucket seeded via `handleNewUserButton()` when clicking "Yes, register my system!" (acts as migration path)
- Users can add friends to the `Default` bucket via `/system manage` → Settings → Privacy Buckets

## Schema Media Fields

### All entities share these media paths:
| Path | Description |
|------|-------------|
| `avatar` | Primary avatar (mediaSchema) |
| `discord.image.avatar` | Discord avatar (mediaSchema) |
| `discord.image.banner` | Discord banner (mediaSchema) |
| `discord.image.proxyAvatar` | Discord proxy avatar (mediaSchema) |
| `discord.server[].avatar` | Per-server avatar (mediaSchema) |
| `discord.server[].banner` | Per-server banner (mediaSchema) |
| `discord.server[].proxyAvatar` | Per-server proxy avatar (mediaSchema) |
| `mask.avatar` | Mask mode avatar (mediaSchema) |
| `mask.discord.image.avatar` | Mask Discord avatar (mediaSchema) |
| `mask.discord.image.banner` | Mask Discord banner (mediaSchema) |
| `mask.discord.image.proxyAvatar` | Mask Discord proxy avatar (mediaSchema) |

### System-specific:
| Path | Description |
|------|-------------|
| `theme.background.media` | Background media (mediaSchema) |
| `mask.theme.background.media` | Mask background media (mediaSchema) |

### State-specific:
| Path | Description |
|------|-------------|
| `states[].avatar` | Embedded state avatar within alter (mediaSchema) |

All mediaSchema objects also include a `bucket` field (`'app'` or `'discord'`, default `'app'`) alongside `r2Key`, `url`, `filename`, `mimeType`, `size`, and `uploadedAt`. This lets `deleteFromR2()` route deletes to the correct bucket.

## R2 Configuration

### Dual-Bucket Architecture
Two R2 buckets for media storage, both accessible by the Discord bot and the embedded app:

| Bucket | Config Path | Purpose |
|--------|-------------|---------|
| **app** | `config.r2.system.app` | Primary media for the main app/webapp (avatars, banners, note content, etc.) |
| **discord** | `config.r2.system.discord` | Discord-synced media — used when a user chooses **not** to sync the main app with Discord. Their Discord-only media (server-specific avatars/banners, Discord-synced proxies) lives here, keeping it separate from the app bucket. |

### Routing Logic
- Uploads flow to `app` bucket by default.
- When `syncWithApps.discord` is `false` and the upload originates from a Discord context (proxy avatar, server-specific media), it routes to the `discord` bucket.
- The embedded app can access both buckets directly via R2 public URLs.
- Helper function: `resolveUploadBucket(syncWithDiscord, mediaCategory)` returns `'discord'` when `syncWithDiscord === false` and `mediaCategory` is `'discord'`, `'server'`, `'mask'`, or `'mask_discord'`; otherwise returns `'app'`.
- Each mediaSchema object stores a `bucket` field (`'app'` or `'discord'`) so delete operations know which bucket to target.

## Indexable Name System

### Purpose

The `name.indexable` field is a **machine-friendly ASCII identifier** used for stable command-line lookups (`sys!alter rename bird`), proxy style storage, and embed author display. It is decoupled from the `name.display` field (the full human-friendly name with any Unicode).

### Rules

| Field | Character Set | Duplicates Allowed | Auto-generated From | Required |
|-------|--------------|-------------------|-------------------|----------|
| `name.indexable` | `[a-zA-Z0-9\-_]` only | No (duplicate check) | Stripped from display name | No — left `undefined` if stripped result is empty |
| `name.display` | Any Unicode (including emoji, Arabic, CJK, etc.) | Yes | User's original input | Yes — always set at creation |
| `name.closedNameDisplay` | Closed-char-safe subset | Yes | User-set | No |

### Search Priority

All lookup functions (`findEntity`, `findEntityByNameForSystem`, `findEntityByName`) search in this order:
1. `name.indexable` (exact match, case-insensitive)
2. `name.display` (exact match, case-insensitive) — added so non-Latin named entities are findable
3. `name.aliases` (if present)

### Duplicate Detection

Checked only against `name.indexable` — if the display name generates an empty indexable (purely non-Latin), the entity is created without one and no duplicate check runs. This means multiple entities can share the same display name.

### Creation Flow

```javascript
// 1. Generate indexable by stripping non-ASCII
const indexable = name.toLowerCase().replace(/[^a-z0-9\-_]/g, '') || undefined;

// 2. Check duplicates only if we got an indexable
if (indexable) {
    const existing = await utils.findEntity(indexable, system, 'alter');
    if (existing) return error('Already exists');
}

// 3. Conditionally set indexable in the document
name: {
    ...(indexable && { indexable }),
    display: name
},
```

### Files Modified (decoupling)

| File | Change |
|------|--------|
| `bot_utils.js` | `findEntity()` — added `name.display` to MongoDB `$or` query; `findEntityByNameForSystem()` — added `.name?.display` fallback |
| `slash/message.js` | `findEntityByName()` — added `name.display` fallback |
| `prefix/alter.js`, `prefix/state.js`, `prefix/group.js` | Removed `if (!indexable) return error(...)` guard; conditional indexable; duplicate check skipped when indexable is empty |
| `prefix/system.js` | Same for registration; mask name indexable uses `\|\| undefined` |
| `prefix/alter.js`, `prefix/state.js`, `prefix/group.js` (mask) | Mask name indexable uses `\|\| undefined` |
| `slash/alter.js`, `slash/state.js`, `slash/group.js` | Removed `isValidIndexableName()` validation; session stores separate `displayName` + `indexable`; conditional indexable at entity creation |
| `api/routes/alters.js`, `states.js`, `groups.js`, `system.js`, `friends.js` | Conditional indexable; duplicate checks only on indexable (removed display name from duplicate detection) |
| `slash/whois.js` | Guards `(entityIndexable)` parentheses to avoid empty `()` |

### What Stays ASCII-Only

- **Rename handlers** (`handleRename`) — still validate with `isValidIndexableName()` since they explicitly set the machine identifier
- **`prefix/import.js`** — already has `\|\| \`alter${Date.now()}\`` fallback for empty results
- **`prefix/convert.js`** — copies whatever exists, fine as-is
- **`slash/front.js`** — already searched both `indexable` and `display` before the change

### Config Structure
```json
"r2": {
    "system": {
        "accountID": "...",
        "app": {
            "endpoint": "https://{accountID}.r2.cloudflarestorage.com",
            "accessKeyId": "...",
            "secretAccessKey": "...",
            "bucketName": "app",
            "publicURL": ""
        },
        "discord": {
            "endpoint": "https://{accountID}.r2.cloudflarestorage.com",
            "accessKeyId": "...",
            "secretAccessKey": "...",
            "bucketName": "discord",
            "publicURL": ""
        }
    }
}
```

### R2 Key Format
`media/{entityType}/{userId}/{field}_{timestamp}.{ext}`

### Entity Types
'Alter', 'State', 'Group', 'System'

## Redis Configuration

### Overview
Redis serves as a fast cache layer for messages, proxy state, display resolution, and sessions. MongoDB remains the source of truth with write-behind batching for cost efficiency (~92% reduction in MongoDB writes).

### Redis Client (`Chameleon/redis.js`)
- Uses `ioredis` library
- Reads URL from `process.env.REDIS_URL` (Fly.io secret or Docker Compose env) or falls back to `config.json` fallback, then `redis://localhost:6379/0`
- Supports Upstash `rediss://` URLs with auto-TLS
- **Graceful fallback**: If Redis is unavailable, returns a no-op client. All Redis calls return `null`/empty and code falls through to MongoDB. No crashes.

### Redis Keys
| Key Pattern | Value | TTL | Purpose |
|-------------|-------|-----|---------|
| `msg:{webhookMessageId}` | JSON message data | 7 days | Fast `/message` edit/delete/reproxy lookups |
| `user_msgs:{userId}:{channelId}` | webhook message ID | None (manual) | Auto-detect user's last message in channel for `/message` commands |
| `system:{systemId}:recentProxies` | Sorted set (score=timestamp) | 7 days | Recent proxy matching (top 100) |
| `system:{systemId}:break` | `'1'` (exists = break active) | = cooldown seconds | Proxy break/cooldown state |
| `system:{systemId}:lastProxyTime` | Unix timestamp string | None (manual) | Last proxy timestamp for cooldown checks |
| `display:{entityId}:main` | `{displayName, avatarUrl}` | 30 days | Global display info cache |
| `display:{entityId}:server:{guildId}` | `{displayName, avatarUrl}` | 30 days | Per-server display cache |
| `display:{entityId}:mask:{guildId}` | `{displayName, avatarUrl}` | 30 days | Mask mode display cache |

### Display Cache Strategy
- **Two-tier structure**: main (global), server (per-guild overrides), mask (per-guild mask overrides)
- **First-time proxy**: Cache MISS → resolve via priority chain (MongoDB) → cache with 30-day TTL
- **Subsequent proxies**: Cache HIT → 0.1ms lookup, no MongoDB
- **Cache invalidation**: When entity avatar/name is updated, `invalidateDisplayCache(entityId)` deletes all keys matching `display:{entityId}:*`. Wired into `alter.js`, `state.js`, and `group.js` edit handlers.
- **Memory cost**: ~75KB for 500 entries (150 bytes each) — negligible on 256MB Redis

### Message Cache Flow
1. **Proxy send** (`proxy-message.js`): Message cached in Redis immediately + `user_msgs:{userId}:{channelId}` tracking key written + queued for batch MongoDB write
2. **`/message` commands** (`message.js`): If `message_id` provided → Redis cache first → MongoDB fallback. If omitted → `user_msgs` tracking key → Redis message cache → MongoDB fallback
3. **Edit/Delete/Reproxy**: Update both Redis cache + MongoDB (dual-write)
4. **Startup reconciliation**: On bot start, scan Redis `msg:*` keys for messages without `_id` (never flushed) → write to MongoDB

### Write-Behind Batching
- Messages queued in memory, flushed to MongoDB every 30 seconds or when batch reaches 50 messages
- Entity message count updates also batched
- Graceful shutdown (`SIGINT`/`SIGTERM`) flushes pending writes before exit
- **Fly.io**: `SIGTERM` sent before restart → automatic flush on deployment
- **Crash recovery**: Startup reconciliation catches any messages that were cached but not flushed

### Redis Provider Options
| Provider | Cost | Setup |
|----------|------|-------|
| **Self-hosted on Fly.io** | Free (shared VM) | Multi-process in `fly.toml` or separate app |
| **Local Redis** | Free | Install Redis, default URL works |
| **Upstash** (serverless) | Free tier: 10k req/day | `flyctl secrets set REDIS_URL="rediss://..."` |
| **Fly Redis** | ~$5/mo | Managed Redis on Fly.io network |

### Local Development Without Redis
No Redis installation needed. The no-op fallback means the bot works normally using MongoDB only — just slower lookups. You'll see:
```
[Redis] Failed to initialize — falling back to MongoDB-only mode
```

### Session Management
Sessions remain in-memory via `bot_utils.js` `activeSessions` Map (15-min auto-cleanup). Not migrated to Redis to avoid ~96 `await` additions across command files.

## Proxy Message Architecture

### Message Flow
```
User types: "a:Hello everyone!"
        ↓
bot.js: Events.MessageCreate → prefix check → handleProxyMessage()
        ↓
proxy-message.js:
  1. Find User → System
  2. Check escape sequences (\, \\)
  3. Check break/cooldown (Redis TTL key)
  4. findProxyMatch() → checkRecentProxies (Redis sorted set) → search entities
  5. sendProxyMessage() → webhook send → delete original
        ↓
Redis cache write (immediate):
  - msg:{webhookMessageId} → message data (7 day TTL)
  - system:{systemId}:recentProxies → sorted set update
  - system:{systemId}:lastProxyTime → timestamp
        ↓
MongoDB batch queue (flushed every 30s or 50 messages):
  - Message.insertMany(batch)
  - Entity message count updates
```

### Key Files
| File | Role |
|------|------|
| `bot.js` | Entry point — routes to `handleProxyMessage()` |
| `proxy-message.js` | Core proxy logic — pattern matching, webhook sending, Redis caching, batch queue |
| `slash/message.js` | `/message` commands — action pattern, Redis-first lookup, auto-detect last message, dual-write on edit/delete/reproxy |
| `schemas/message.js` | Message schema — discord_webhook_message_id, discord_channel_id, proxy_type, proxy_id, content, attachments |

### `/message` Command Structure
```
/message
├── action: [delete | edit | reproxy]
├── message_id: [string]  ← optional, auto-detects last message if omitted
└── entity_name: [string]  ← only for reproxy action
```

**Auto-Detect Flow** (when `message_id` is omitted):
1. Redis: `user_msgs:{userId}:{channelId}` → webhook message ID
2. Redis: `msg:{webhookMessageId}` → full message data
3. MongoDB fallback if Redis miss

**User tracking key** is written in `proxy-message.js` on every proxy send:
```javascript
await redis.set(`user_msgs:${userId}:${channelId}`, webhookMessageId);
```

### Proxy Matching Priority
1. **Recent proxies** (Redis sorted set, top 100) — fastest
2. **Alter proxy patterns** — `entity.proxy[]` array
3. **State proxy patterns** — `entity.proxy[]` array
4. **Group proxy patterns** — `entity.proxy[]` array

### Auto-Proxy Styles
| Style | Behavior |
|-------|----------|
| `'off'` | No auto-proxy; only explicit proxy patterns work |
| `'last'` | Auto-proxy as most recently used entity |
| `'front'` | Auto-proxy as current fronter (single entity in top layer) |
| `<entityName>` | Always proxy as specific named entity |

Server-specific `proxyStyle` in `system.discord.server[]` overrides global style.

### Reply Style
Controls how proxied message replies appear. Two modes:
- `'embed'` (default) — Custom reply embed with author info, content preview, and thumbnail
- `'native'` — Discord's built-in reply feature via `message_reference`

**Three-tier resolution** (highest priority wins):
1. `guild.settings.forceReplyStyle` — Admin force (if !== `'off'`)
2. `system.discord.server[].replyStyle` — User's per-server override
3. `system.proxy.replyStyle` — User's global preference (default: `'embed'`)

Resolution function: `getEffectiveReplyStyle(system, guildDoc, guildId)` in `proxy-message.js`

**Schema locations:**
| Level | Field | Values |
|-------|-------|--------|
| User global | `system.proxy.replyStyle` | `'embed'` \| `'native'` |
| User per-server | `system.discord.server[].replyStyle` | `'embed'` \| `'native'` |
| Admin force | `guild.settings.forceReplyStyle` | `'off'` \| `'embed'` \| `'native'` |

**Commands:**
- `sys!system replystyle <embed|native>` — Set global reply style
- `sys!config proxy replystyle <embed|native>` — Alias
- `sys!config proxy server <guild> replystyle <embed|native|default>` — Per-server override
- `sys!serverconfig replystyle <off|embed|native>` — Admin force
- `/settings` → Proxy → Reply Style — Global + per-server
- `/settings` → Server → Proxy Controls → Force Reply Style — Admin force

### Break/Cooldown System
- `\\` prefix → set break to true (stops all future auto-proxying)
- `\` prefix → skip this message only (no break change)
- Cooldown → if time since last proxy > `system.proxy.cooldown`, break activates automatically via Redis TTL key
- Explicit proxy match → clears break, resets cooldown timer

### Display Resolution Cache
- Keys: `display:{entityId}:main`, `display:{entityId}:server:{guildId}`, `display:{entityId}:mask:{guildId}`
- TTL: 30 days
- Avoids re-running full priority chain (server → mask → proxyAvatar → avatar → system) on every message
- Invalidated via `invalidateDisplayCache(entityId)` when entity avatar/name is updated

## bot_utils.js Key Functions

### Session Management
- `generateSessionId(userId)` — creates unique session ID
- `getSession(sessionId)` / `setSession(sessionId, data)` / `deleteSession(sessionId)` — in-memory Map (15-min TTL)
- `extractSessionId(customId)` — parses session ID from button/menu customId

### Display Helpers
- `getDisplayName(entity, closedCharAllowed)` — resolves display name with mask/closed name awareness
- `getEntityEmbedColor(entity, system)` — entity.color > system.color > default
- `getSystemEmbedColor(system)` — system.color > default
- `resolveAvatarUrl(entity, session)` — full priority chain for thumbnail
- `resolveBannerUrl(entity, session)` — full priority chain for banner
- `resolveProxyAvatarUrl(entity, session)` — full priority chain for author icon

### R2 Media
Two S3 clients in `bot_utils.js`: `sysR2` (app bucket) and `discordR2` (discord bucket). All functions accept a `bucket` parameter (`'app'` or `'discord'`, default `'app'`):
- `uploadMediaToR2(buffer, filename, mimeType, userId, entityType, field, bucket)` — uploads to R2, returns mediaSchema object with `bucket` field
- `deleteFromR2(r2Key, bucket)` — deletes R2 object from the correct bucket
- `downloadFromUrl(url)` — downloads file from URL to Buffer
- `handleAttachmentUpload(attachment, fieldLabel, entityType, userId, bucket)` — validates, downloads, uploads, returns `{ success, media, message }`
- `handlePrefixMediaUpload(attachment, urlArg, fieldLabel, entityType, userId, bucket)` — prefix variant supporting both attachment and URL
- `resolveUploadBucket(syncWithDiscord, mediaCategory)` — determines bucket based on sync state and media context
- `ensureServerEntry(entity, guildId, guildName)` — ensures discord.server[] entry exists
- `buildUploadOptions(session)` — generates select menu options based on mode+sync

### Edit Helpers
- `getEditTarget(entity, session)` — returns the correct nested object based on mode
- `updateEntityProperty(entity, session, property, value)` — sets property on correct target

### Front Management Helpers
- `getBatteryEmoji(battery)` — returns 🔋 (≥70), 🪫 (≥30), or ⚠️ (<30)
- `updateRecentProxies(system, entity, type)` — moved to `proxy-message.js`, now uses Redis sorted set

### Redis Helpers (proxy-message.js)
- `queueMessageWrite(data)` — queues message for batch MongoDB write (50 messages or 30s)
- `queueEntityCountUpdate(entityId, type)` — queues entity message count update
- `flushToMongoDB()` — flushes all pending writes (called on shutdown or batch threshold)
- `reconcileOnStartup()` — scans Redis for unflushed messages, writes to MongoDB on bot start
- `invalidateDisplayCache(entityId)` — deletes all display cache keys for an entity (call on avatar/name update)
- `getProxyDisplayInfoCached(entity, type, system, guild, closedCharAllowed)` — Redis-cached display resolution (two-tier: main/server/mask, 30-day TTL)
- `updateRecentProxies(system, entity, type)` — Redis sorted set update (top 100, 7 day TTL)
- `shouldMask(entity, system, guildId)` — checks if entity should be masked in a guild (used by whois.js)

### New User Flow (bot_utils.js)
- `getOrCreateUserAndSystem(context)` — entry point called by every slash command; creates bare User+System if first time, returns `isNew=true`
- `createNewUserAndSystem(discordId)` — creates User doc + System doc + seeds a `Default` privacy bucket with `friends: []`
- `handleNewUserFlow(interaction, entityType)` — shows welcome embed with "Yes, register my system!" / "No, thank you." buttons
- `handleNewUserButton(interaction)` — handles button response; **does NOT re-create** the system (already exists from `getOrCreateUserAndSystem`); seeds `Default` bucket if missing (migration); shows success message

**Important fix:** `handleNewUserButton` used to call `createNewUserAndSystem()` again, causing a duplicate key error (discordID is unique). Fixed to fetch existing user+system instead.

## Conventions
- No stub handlers — implement full UI
- Use `awaitMessages` for attachment uploads (Discord modals cannot accept attachments)
- Leave appropriate inline comments
- Use `switch (action)` with `return await` + `break` for button routing
- Always fetch entity at top of handler before using it
- Diff-based `$pull`/`$addToSet` for bidirectional linking (never nuke-and-rebuild)
- Sync confirmation only for new entity creation; sync toggle lives in settings

## Webapp vs Embedded App

### Distinction
- **Webapp** (`https://systemise.teamcalendula.net`) — Full browser-based UI, accessed via web browser
- **Embedded App** (Discord Activity) — Launched from within Discord via `/systemise` command (LAUNCH_ACTIVITY)
- Both use the same API backend (`api/routes/`) and MongoDB data
- Embedded App runs inside Discord's CDN proxy iframe (`{clientId}.discordsays.com`)

### Embedded App Page Routing
The activity is a single-page app with page-based routing via `useState` (no React Router — CSP + iframe constraints).

- **Landing page** (default) — Hub with feature cards: System, Friends, Notes, Crisis
- **Deep-linking** — `?page=notes`, `?page=system`, `?page=friends`, `?page=crisis` skips landing page
- **"← Home" button** — back navigation to landing page
- **Bottom nav** — visible inside pages for quick switching between features
- **SystemPage** — Full page with sub-page navigation: overview card, compact front, buttons to Front/Alters/States/Groups/Edit sub-pages. Each sub-page has entity list + FAB + detail/form modals
- **FriendsPage** — Full page: friend list with front preview, friend ID badge (tap to copy), tap friend for detail modal, FAB to add friend
- **CrisisPage** — Placeholder

### Current Embedded App Links
| Feature | Button Label | URL | Status |
|---------|-------------|-----|--------|
| Front | "Open Full Front" | `${WEBAPP_URL}/app/front` | ✅ Live — label TBD (user still deciding) |
| Notes | "Open in App" | `${WEBAPP_URL}/app/notes/${note._id}` | ✅ Live |
| Settings | — | `${WEBAPP_URL}/app/settings` | ⏳ Planned — link button not added yet, API route not built |

### Express Server (`webapp/server.js`)
- Express 5 with path-to-regexp v8 — bare `*` wildcards crash; use `{*any}` catch-all syntax
- Routes:
  - `/api/*` → API routes (`Chameleon/api/api.js`)
  - `/discord_activity/assets` → static assets from `activity/dist/assets/` (BEFORE catch-all, fixes Discord CDN proxy path injection)
  - `/discord_activity` + `/discord_activity/{*any}` → Activity SPA from `activity/dist/index.html`
  - `/assets` → static assets from `activity/dist/assets/` (for direct CDN cache access)
  - Everything else → Webapp SPA (React app); **but checks `req.query.frame_id`** → if present, serves activity SPA at root `/` instead (for URL Mapping pointing to root URL)
- Bind-mounted in Docker: changes to `server.js` reflect instantly via `docker compose restart chameleon-api`

### Discord Activity Launcher (`/systemise`)
- File: `Chameleon/discord_commands/global/slash/systemise.js`
- Responds with `LAUNCH_ACTIVITY` (type 12) callback — opens embedded app in Discord
- Import fixed to use `discord.js` instead of `@discordjs/rest`
- Requires EMBEDDED flag (set via URL Mapping in Discord Developer Portal)
- **URL Mapping: path `/` → `https://systemise.teamcalendula.net`** (root mapping catches all paths including `/api`)
- Root-level activity detection via `frame_id` query param is wired in `server.js`
- Supports deep-linking via `?page=` URL param (e.g., `?page=notes` skips landing page)

### Discord Activity SDK — Fully Working

**Status:** All SDK issues resolved. Activity loads inside Discord with full auth flow.

**Auth Flow (inside Discord):**
1. `sdk.ready()` → resolves (SDK HANDSHAKE + READY event from Discord)
2. Check `localStorage` for cached access token → if valid, skip to step 6
3. `sdk.commands.authorize({ client_id, scope })` → Discord shows OAuth modal (first time only)
4. POST code to `/api/auth/activity/exchange` → backend exchanges for Discord access token
5. Cache access token in `localStorage`
6. `sdk.commands.authenticate({ access_token })` → Discord returns `{ access_token, user }`
7. POST to `/api/auth/activity/token` → backend returns JWT for API access
8. Notes/Crisis UI loads

**Auth Flow (outside Discord — mock mode):**
- No `frame_id` in URL → mock SDK used → skips real API calls → UI loads without notes data

**Key files:**
| File | Purpose |
|------|---------|
| `activity/src/hooks/useDiscordSdk.jsx` | SDK init, auth flow, token caching, context provider |
| `activity/src/hooks/useApiAuth.js` | Exchange Discord token for JWT (skips in mock mode) |
| `activity/src/app/App.jsx` | Root component, wraps DiscordContextProvider |
| `activity/src/app/Activity.jsx` | Status rendering (INITIALIZING → READY → AUTHENTICATED) + page routing |
| `activity/src/app/pages/LandingPage.jsx` | Hub — System, Friends, Notes, Crisis feature cards |
| `activity/src/app/pages/SystemPage.jsx` | Full page — overview, front, alter/state/group sub-pages with CRUD |
| `activity/src/app/pages/FriendsPage.jsx` | Full page — friend list, front detail, add friend |
| `activity/src/app/pages/NotesPage.jsx` | Notes CRUD via shared API client + tag manager |
| `activity/src/app/pages/CrisisPage.jsx` | Placeholder — crisis tools |
| `activity/config/vite.mjs` | Vite config — injects `VITE_DISCORD_CLIENT_ID` and `VITE_API_BASE` |

**Build command:** `docker compose exec chameleon-api sh -c "cd Chameleon/activity && npm run build"`

**Package.json build script:** `vite build --config config/vite.mjs` (NOT `robo build` — Robo.js hangs)

**Known issues:**
- `req.userId` → `req.user._id` was broken across all API route files (now fixed)
- Activity CSP restricts fetch to `*.discordsays.com` — API calls must go through Discord proxy, not direct to `systemise.teamcalendula.net`

### CSP Constraint (Important)
Discord's Content Security Policy only allows `connect-src` to `*.discordsays.com`, `discord.com`, `cdn.discordapp.com`, `media.discordapp.net`. **All API calls from inside the activity iframe MUST go through the discordsays.com proxy.** This is why `VITE_API_BASE` is set to `/api` (relative) and the URL Mapping uses root `/` → `https://systemise.teamcalendula.net`.

### Design System — Cozy Pastel + Dark Glass

The embedded app uses a custom design system with glassmorphism and pastel accents on a dark background.

**CSS Variables** (defined in `activity/src/app/App.css`):
| Token | Value | Purpose |
|-------|-------|---------|
| `--bg` | `#0d0d14` | Page background |
| `--bg-card` | `rgba(26, 26, 40, 0.55)` | Card/glass background |
| `--bg-surface` | `rgba(38, 38, 58, 0.5)` | Elevated surface |
| `--glass-blur` | `blur(16px)` | Backdrop blur amount |
| `--glass-border` | `rgba(255, 255, 255, 0.07)` | Glass edge border |
| `--accent` | `#c4b5fd` | Primary accent (pastel lavender) |
| `--accent-subtle` | `rgba(196, 181, 253, 0.12)` | Accent background tint |
| `--text` | `#e8e8f0` | Primary text |
| `--text-secondary` | `#9898a8` | Muted text |
| `--radius` | `12px` | Base border radius |
| `--font-title` | `'Poiret One'` | Display titles |
| `--font-accent` | `'Quicksand'` | Labels, badges, buttons |
| `--font-body` | `'Nunito'` | Body text, inputs |

**Pastel palette:** `--pastel-lavender`, `--pastel-mint`, `--pastel-peach`, `--pastel-sky`, `--pastel-rose`, `--pastel-lilac`, `--pastel-cream`

**Semantic colors:** `--color-error` (#fca5a5), `--color-success` (#86efac), `--color-warning` (#fdba74)

**Font utility classes:** `.font-title`, `.font-accent`, `.font-body`

### Self-Hosted Fonts (Discord CSP Fix)

Google Fonts cannot load inside Discord's Activity iframe due to CSP restrictions. Fonts are self-hosted from `/assets/fonts/` (same path as JS/CSS bundles, goes through Discord CDN proxy).

**Font files** (`activity/public/assets/fonts/`):
| Font | Weights | File |
|------|---------|------|
| Nunito | 100-900 (variable) | `Nunito-latin.woff2`, `Nunito-latin-ext.woff2` |
| Quicksand | 100-900 (variable) | `Quicksand-latin.woff2`, `Quicksand-latin-ext.woff2` |
| Poiret One | 400 | `PoiretOne-latin.woff2`, `PoiretOne-latin-ext.woff2` |

- Fonts served via `app.use('/assets', express.static(...))` in `webapp/server.js`
- CSS `@font-face` declarations at top of `App.css` with `font-display: swap`
- Error handler in `index.html` narrowed to only catch `<script>` failures (no longer kills page for font/image load errors)
- Total font size: ~143KB (latin + latin-ext subsets)

### API Backend
- Express router at `Chameleon/api/api.js`
- Routes: `auth`, `system`, `alters`, `states`, `groups`, `notes`, `front`, `friends`, `quick`
- Auth via Discord OAuth (passport-discord + JWT)
- Settings data is already stored in MongoDB (same collections) — just needs API endpoints
- Existing `GET /api/system` already returns system doc including `setting.*`, `proxy.*` fields

### Notes R2 Content Storage

Note content (markdown text) is stored in R2 as `.md` files, not inline in MongoDB.

**Flow:**
1. Frontend sends `{ content: "markdown string" }` via POST/PATCH
2. API uploads markdown to R2 as `notes/{userId}/{noteId}.md` (MIME: `text/markdown; charset=utf-8`)
3. API stores the R2 media object (`mediaSchema`) in `note.content`
4. API generates `contentPreview` (first 500 chars) stored inline in MongoDB as fallback
5. Frontend reads: `content.url` → fetches markdown from R2 → renders via `ReactMarkdown`
   - Fallback: `contentPreview` (inline text) if R2 fetch fails

**R2 utility:** `Chameleon/api/utils/r2.js`
- `uploadNoteContent(userId, noteId, content)` — uploads `.md` to R2, returns mediaSchema object
- `deleteNoteContent(r2Key)` — deletes R2 object
- `generatePreview(content, length)` — truncates to N chars with `...`

**R2 key format:** `notes/{userId}/{noteId}.md`

**Schema:** `note.content` is `mediaSchema` (r2Key, bucket, url, filename, mimeType, size, uploadedAt)

**API endpoints:**
- `POST /api/notes` — uploads content to R2 after MongoDB save (graceful fallback on R2 failure)
- `PATCH /api/notes/:id` — re-uploads to R2, deletes old R2 file
- `DELETE /api/notes/:id` — deletes R2 file before MongoDB delete

**Note:** The `/note` slash command (`discord_commands/global/slash/note.js`) also uses R2 for note content with the same key format and MIME type.

### Tag Management API

Tags are stored in `user.notes.tags[]` and managed via:

- `GET /api/notes/tags` — returns user's tag list
- `DELETE /api/notes/tags/:tag` — removes tag from `user.notes.tags[]` AND from all user's notes via `$pull`

The shared API client (`@chameleon/shared`) exposes `api.deleteNoteTag(tag)` for the delete endpoint.

The activity's NotesPage has a tag manager UI — "Manage" button in the tag filter bar shows × buttons on each tag for deletion.

## Settings Command (`/settings`)

### Command Definition
```
/settings
├── section: [server | proxy | notifications | general]  ← optional
```
Defaults to main menu (overview) if no section given.

### Sections
| Section | Access | What It Controls |
|---------|--------|------------------|
| **Server** | Admin only (Administrator OR `guild.admins.memberIDs[]`/`roleIDs[]`) | Admins, Channels, Log Events, Proxy Controls, Display |
| **Proxy** | System owner | Global + per-server proxy style, reply style, cooldown, layouts×3, case sensitivity, break |
| **Notifications** | System owner | Delivery method (DM/Webhook), friend requests, friend switches, app messages |
| **General** | System owner | Sync toggle (placeholder migration), tags, pronoun separator, terminology, timezone, auto-share, friend auto-bucket |

### Routing
- CustomId convention: `settings_{section}_{sub-section}_{sessionId}`
- `settings_` prefix routed in `bot.js` for buttons, select menus, and modals
- See `bot_utils.js` for shared builders: `buildProxySettingsEmbed`, `buildProxySettingsComponents`, `buildNotificationSettingsEmbed`, `buildNotificationSettingsComponents`

### Server Admin Check
```javascript
const isAdmin = interaction.member.permissions.has('Administrator')
  || guild.admins.memberIDs.includes(user.id)
  || interaction.member.roles.cache.some(r => guild.admins.roleIDs.includes(r.id));
```

### Per-Server Proxy Style
- `system.discord.server[].proxyStyle` overrides `system.proxy.style` for specific servers
- `system.discord.server[].replyStyle` overrides `system.proxy.replyStyle` for specific servers
- Flows through session: `handleProxyServerStyleSelect` stores guildId, `handleProxyServerStyleSave` reads it back

### Migration Section
- Placeholder embed in General section pointing to `sys!import` / `sys!convert`
- Full import/export deferred — `import_functions.js` and `convert_functions.js` are stubs

## Prefix Config Commands (`sys!config` / `sys!serverconfig`)

### Split Architecture
The prefix config was split into two commands to separate concerns:

| Command | Aliases | Scope | Access |
|---------|---------|-------|--------|
| `sys!config` | `sys!cfg`, `sys!settings` | Personal system settings | System owner |
| `sys!serverconfig` | `sys!servercfg`, `sys!serversettings` | Server/guild settings | Admin only |

### `sys!config` — Personal Settings
Operates on the caller's own system/user document. No permission check beyond having a system.

| Subcommand | Schema Target |
|------------|---------------|
| `sys!config timezone <tz>` | `system.timezone` |
| `sys!config proxy style <off\|last\|front\|name>` | `system.proxy.style` |
| `sys!config proxy replystyle <embed\|native>` | `system.proxy.replyStyle` |
| `sys!config proxy case <on\|off>` | `system.proxy.caseSensitive` |
| `sys!config proxy cooldown <seconds\|off\|reset>` | `system.setting.proxyCoolDown` |
| `sys!config proxy break <on\|off>` | `system.proxy.break` |
| `sys!config proxy layout <alter\|state\|group> <format>` | `system.discord.proxylayout.*` |
| `sys!config proxy server <guild> <style>` | `system.discord.server[].proxyStyle` |
| `sys!config proxy server <guild> replystyle <embed\|native\|default>` | `system.discord.server[].replyStyle` |
| `sys!config closedchar <on\|off>` | `user.settings.closedCharAllowed` |
| `sys!config name format <format>` | `system.discord.name.display` |
| `sys!config terminology alter <singular> [plural]` | `system.alterSynonym` |
| `sys!config pronounseparator <sep\|off>` | `system.discord.pronounSeparator` |
| `sys!config autoshare <on\|off>` | `system.setting.autoshareNotestoUsers` |
| `sys!config sync <on\|off>` | `system.syncWithApps.discord` |
| `sys!config notifications friend\|request\|switch\|message <on\|off>` | `user.settings.notificationPreferences` |
| `sys!config friendbucket <bucket\|off>` | `system.setting.friendAutoBucket` |

### `sys!serverconfig` — Server Settings
Requires Manage Server permission, server ownership, or Systemiser admin role. Same permission check as `/settings > Server`.

| Subcommand | Schema Target |
|------------|---------------|
| `sys!serverconfig proxy <on\|off>` | `guild.settings.allowProxy` |
| `sys!serverconfig autoproxy <on\|off>` | `guild.settings.forceDisableAutoproxy` |
| `sys!serverconfig closedchar <on\|off>` | `guild.settings.closedCharAllowed` |
| `sys!serverconfig replystyle <off\|embed\|native>` | `guild.settings.forceReplyStyle` |
| `sys!serverconfig channel blacklist\|whitelist\|remove\|clear\|list` | `guild.channels.blacklist[]` / `whitelist[]` |
| `sys!serverconfig log <#channel\|off>` | `guild.channels.logChannel` |
| `sys!serverconfig log events <proxy\|edit\|delete\|reproxy> <on\|off>` | `guild.channels.logEvents.*` |
| `sys!serverconfig admin add\|remove\|list` | `guild.admins.roleIDs[]` / `memberIDs[]` |

## Guild Logging System

### Overview
Guild proxy logging is a configurable system that sends embed logs to a designated text channel when proxy events occur. The configuration UI exists in both prefix (`sys!serverconfig log`) and slash (`/settings > Server > Log Channel`) forms.

### Status
✅ **Implemented** — was previously a stub (config UI only), now fully wired with `sendGuildLog()`.

### Configuration
- **Log channel**: Set via `sys!serverconfig log #channel` or `/settings > Server > Log Channel`. Stored as `guild.channels.logChannel`.
- **Event toggles**: Four events, each on/off, stored in `guild.channels.logEvents`:
  - `proxy` (default: `true`) — When a message is proxied
  - `edit` (default: `false`) — When a proxied message is edited
  - `delete` (default: `false`) — When a proxied message is deleted
  - `reproxy` (default: `false`) — When a message is reproxied to a different entity
- Cleared via `sys!serverconfig log off` → sets `logChannel` to `undefined`.

### Implementation

#### Core function: `sendGuildLog` (bot_utils.js)
```javascript
sendGuildLog(guildId, eventType, logData, client)
```
- Silent failure — never throws, never breaks the main flow
- Queries Guild doc by both `{ id }` and `{ discordId }` (handles prefix/slash storage inconsistency)
- Returns early if no Guild doc, no `logChannel`, or event type is disabled
- Fetches channel via `client.channels.fetch()` and sends the embed

#### Hook locations

| File | Event | Line |
|------|-------|------|
| `proxy-message.js` | proxy | After `webhook.send()` (~line 499) |
| `slash/message.js` | delete | After `webhook.deleteMessage()` (~line 264) |
| `slash/message.js` | edit | After `webhook.editMessage()` in `handleModalSubmit` (~line 615) |
| `slash/message.js` | reproxy | After `webhook.editMessage()` in `handleReproxy` (~line 412) |

#### Embed designs

| Event | Color | Fields |
|-------|-------|--------|
| **proxy** | Entity color → `#1fb819` | Entity (type + name), System, Channel, Content |
| **edit** | `#ffdb28` | Entity, Channel, Original content, New content |
| **delete** | `#e9162d` | Entity, Channel, Content |
| **reproxy** | `#8f2be7` | From entity, To entity, Channel |

All embeds include timestamp, entity thumbnail, and jump-to-message link.

#### Edge cases
- **No logging library** — uses raw `console.error` for error reporting
- **Silent failure** — all errors caught and logged to console only
- **Missing Guild doc** — if server was never configured, silently returns
- **Deleted log channel** — `channel.fetch()` fails silently
- **Bot permissions** — missing `Send Messages` in log channel silently ignored
- **Content truncation** — content fields truncated to 1024 characters (Discord embed field limit)

#### Schema update needed
The `reproxy` event type is new to `guild.channels.logEvents`. Existing Guild documents will need a migration to add `reproxy: false`:

```javascript
guildDoc.channels.logEvents.reproxy = false;
```

## Mascot / System Info
- **System Name:** The Colorwheel 🎡
- **Main Mascot Alter:** Bird 🪶 (💙)
- **All Alters:**
  | Color | Alter | Sign-off |
  |-------|-------|----------|
  | 🩷 | Pyra | 💘 |
  | ❤️ | R | 🦀 |
  | 🧡 | Ansel/Aziz | 📜 |
  | 💛 | Yara | 🌟 |
  | 💚 | Moss | 🌲 |
  | 🩵 | Tool | 🎁 |
  | 💙 | Bird | 🪶 |
  | 💜 | Peter | 🧭 |
  | 🤍 | Blanc/The Bain | ☁️ |

- Use these alter names in examples/code instead of generic names like "Luna", "Star", "Alex"

## Front Management (`/front` command)

### Command Definition
```
/front
├── action: [switch | add | remove | status | battery | history | layers]  ← optional
└── quick: [yes | no]  ← optional, defaults to "no"
```

### Routing Logic
| Input | Behavior | Webapp Link? |
|-------|----------|--------------|
| `/front` | Front view embed + action buttons | ✅ Yes |
| `/front quick:yes` | Front view embed, no action buttons | ❌ No |
| `/front action:switch` | Guided session embed (step-by-step) | ✅ Yes |
| `/front quick:yes action:switch` | Quick switch modal (one field: entities) → replaces all, top layer | ❌ No |
| `/front action:add` | Modal: "Which entity?" → adds to top layer | ✅ Yes |
| `/front quick:yes action:add` | Same modal → executes immediately | ❌ No |
| `/front action:remove` | Modal: "Which entity?" → removes from front | ✅ Yes |
| `/front quick:yes action:remove` | Same modal → executes immediately | ❌ No |
| `/front action:status` | Modal: "New status?" (general front) | ✅ Yes |
| `/front quick:yes action:status` | Same modal → executes immediately | ❌ No |
| `/front action:battery` | Modal: "Battery level (0-100)?" | ✅ Yes |
| `/front quick:yes action:battery` | Same modal → executes immediately | ❌ No |
| `/front action:history` | Recent switch history embed | ✅ Yes |
| `/front quick:yes action:history` | Same embed, no webapp link | ❌ No |
| `/front action:layers` | Layer management interface | ✅ Yes |
| `/front quick:yes action:layers` | Same interface, no webapp link | ❌ No |

### Quick Mode Rules
- `quick=yes` → no webapp link, no confirmation for simple actions
- `quick=no` → webapp link shown, confirmation required

### Layer System
- Layers stored in `system.front.layers[]` (array of layer objects)
- Each layer has: `_id`, `name`, `color`, `shifts[]`, `status`, `battery`, `caution`
- Quick switch puts all entities in the **top layer** (first layer)
- Guided session supports multi-layer via newline syntax: `Pyra, Bird\nMoss`
- Layer management: add (with position: Top/Below: X/Bottom), rename, delete (asks where to move entities), move entity (multi-select)
- When a layer is cleared, its `status`, `battery`, `caution` are reset
- Layer caution aggregates from entities within it if not explicitly set

### Shift System
- Shifts stored in `layer.shifts[]` as ObjectId refs to `Shift` documents
- Each shift has: `s_type`, `ID`, `type_name`, `startTime`, `endTime`, `statuses[]`
- `statuses[]` tracks time-based changes: `status`, `battery`, `caution`, `startTime`, `endTime`, `layerID`, `hidden`
- When a new shift is created, initial values are pulled from entity presets:
  - `status` ← `entity.setting.default_status`
  - `battery` ← `entity.setting.default_battery`
  - `caution` ← `entity.caution`
- Blank modal input = clear the field (set to `null`/`undefined`)

### Entity Presets
- All entities (`alter`, `state`, `group`) have:
  - `setting.default_status` — default status for new shifts
  - `setting.default_battery` — default battery for new shifts (NEW)
  - `caution` — default caution for new shifts
- "Apply to" selector when editing entity status/battery/caution:
  - "This shift only" (default) — updates `shift.statuses[last]`
  - "Entity preset" — updates entity's `default_status`, `default_battery`, or `caution`
  - "Both" — updates both shift and preset
- Presets can be reset to `null` via edit interface

### Switch Session Flow (`quick=no` + `action=switch`)
- Setup embed shows current front + progress fields
- Buttons: `[Select Entities]`, `[Set Layer Names]`, `[Set Status]`, `[Set Battery]`
- Each opens a modal; fields show ✅ when filled
- "Confirm Switch" only activates when entities are set
- "Cancel" clears session

### Webapp Integration
- Webapp URL: `https://systemise.teamcalendula.net`
- Front app link: `${WEBAPP_URL}/app/front`
- Link button shown on all `quick=no` responses, hidden on `quick=yes`

## Schema Updates (Front Management)

### `shiftSchema.statuses[]` (front.js)
| Field | Type | Description |
|-------|------|-------------|
| `status` | String | Shift status message |
| `battery` | Number | Per-entity battery level |
| `caution` | Object | `{ c_type, detail }` per-entity caution |
| `startTime` | Date | When this status entry started |
| `endTime` | Date | When this status entry ended |
| `layerID` | ObjectId | Reference to parent layer |
| `hidden` | String | `'y'`, `'n'`, or `'trusted'` |

### `layerSchema` (front.js)
| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Unique layer ID |
| `name` | String | Layer display name |
| `color` | String | Layer color |
| `shifts` | [ObjectId] | References to Shift documents |
| `status` | String | Layer-level status (optional) |
| `battery` | Number | Layer-level battery (optional) |
| `caution` | Object | `{ c_type, detail }` layer-level caution (optional) |

### Entity `setting` (alter.js, state.js, group.js)
| Field | Type | Description |
|-------|------|-------------|
| `default_status` | String | Default status for new shifts |
| `default_battery` | Number | Default battery for new shifts (NEW) |

## bot_utils.js Front Helpers
- `updateRecentProxies(system, entity, type)` — updates `system.proxy.recentProxies` array (moved to proxy-message.js, now Redis sorted set)
- `getBatteryEmoji(battery)` — returns 🔋 (≥70), 🪫 (≥30), or ⚠️ (<30)

## Files to Delete (user will handle)
- `Chameleon/discord_commands/global/slash/switch.js`
- `Chameleon/discord_commands/global/slash/quickswitch.js`

## Friend Management (`/friend` command)

### Command Definition
```
/friend
├── action: [list | view | add | remove | requests | block | unblock | settings]  ← optional
├── user: [@user]  ← optional, for add/view/remove/block/unblock
└── friend_id: [string]  ← optional, for add by friend ID
```
Defaults to `list` if no action given.

### Action Routing
| Action | Behavior |
|--------|----------|
| `list` | Paginated embed of your friends list — custom name (or Discord name), system name, front status preview. Buttons to add friend or open settings |
| `view` | Full front embed of a friend (privacy-checked). Uses `user:[@user]` or shows a select menu of friends if omitted. Reuses `buildFrontEmbed`-style builder with `isOwner=false`, respects privacy bucket visibility |
| `add` | Send friend request. Target by `user:[@user]` or `friend_id:[string]`. Checks: target exists, not yourself, not blocked by target, not already friends, no duplicate pending request. Shows your Friend ID in a field at the bottom when called with no args |
| `remove` | Remove a friend. Uses `user:[@user]` or select menu. Confirm step before removal |
| `requests` | View incoming friend requests. Shows accept/decline buttons per request. Accepting adds both users to each other's `friends[]` arrays with the sender's `friendAutoBucket` applied |
| `block` | Block a user. Target by `user:[@user]` or select menu. Adds to `blocked[]`, removes from `friends[]` if present |
| `unblock` | Unblock a user. Target by `user:[@user]` or select menu. Removes from `blocked[]` |
| `settings` | Shows your Friend ID, friend/blocked/request counts, default privacy bucket, and privacy bucket list. Button to set default bucket for new friends |

### Friend Request Flow
1. **Sending**: `/friend action:add user:@User` → request stored in `targetUser.friendRequests[]` (persistent, no expiry) → DM sent to target if possible
2. **Receiving**: `/friend action:requests` → shows all pending requests with accept/decline buttons
3. **Accepting**: Both users added to each other's `friends[]` → `privacyBucket` set from each side's `friendAutoBucket` → request removed from array
4. **Declining**: Request removed from array, sender not notified

### Friend View Privacy
When viewing a friend's front via `view`:
- Uses `utils.getPrivacyBucket(friendSystem, viewerDiscordId, viewerFriendId)` to determine viewer's bucket
- Checks `system.setting.privacy[]` for the bucket:
  - `front.hidden` → controls status/battery/caution visibility
  - Entity-level privacy via `entity.setting.privacy[].settings.hidden` → `utils.shouldShowEntity()` applied per-fronter
  - `entity.setting.privacy[].settings.pronouns` → pronoun visibility
  - `entity.setting.privacy[].settings.caution` → caution visibility

### Schema — `user.friendRequests[]`
| Field | Type | Description |
|-------|------|-------------|
| `fromDiscordID` | String | Discord ID of the sender |
| `fromFriendID` | String | Friend ID of the sender |
| `fromName` | String | Sender's display name at time of request |
| `fromSystemName` | String | Sender's system name at time of request |
| `sentAt` | Date | When the request was sent (no auto-expiry) |

### `block.js` Deprecation
- Block functionality merged into `/friend action:block` and `/friend action:unblock`
- `block.js` now shows a deprecation notice redirecting users to `/friend`
- To be removed in a future update

## Whois Command (`/whois`)

### Command Definition
```
/whois
├── message_id: [string]  ← optional, auto-detected via context menu
└── message_link: [string]  ← optional, parses Discord message link
```

### Context Menu
- **Name:** "Who sent this?"
- **Type:** Message context menu (`ApplicationCommandType.Message`)
- **Deployed via** `deploy-command.js` alongside slash commands (see Context Menu Deployment)

### Routing
| Trigger | Handler | Behavior |
|---------|---------|----------|
| `/whois message_id:` | `execute()` | Slash command with manual ID/link |
| `/whois message_link:` | `execute()` | Parses link → extracts channel + message IDs |
| Right-click → Apps → "Who sent this?" | `executeContextMenu()` | Uses `interaction.targetMessage.id` |
| "View Card in DMs" button | `handleButtonInteraction()` → `handleCardButton()` | Sends privacy-gated card to DMs |

### Output Structure

**Ephemeral embed:**
```
Author: [proxyAvatar] Entity Display Name
Thumbnail: resolved avatar (mask/server priority chain)
Color: entity.color > system.color

Entity: [Alter/State/Group]: Display Name (+ indexable name, IF not masked)
System: System Name
Discord User: Username: @user
             Display: Server Nickname
             ID: `123456789`
Message ID: `987654321`
Footer: Proxy type: alter • Masked: Yes/No
```

[View Card in DMs] button (shown only if entity exists in database).

**DM card — 3 privacy tiers:**
| Tier | Condition | Fields |
|------|-----------|--------|
| **Owner** | `viewerId === record.discord_user_id` | Full entity card (description, pronouns, proxies, caution, signoffs, aliases, birthday) |
| **Friend** | `getPrivacyBucket()` returns a bucket | Per-field gated by `entity.setting.privacy[{bucket}].settings.*` — each field hidden if explicitly set to `false` |
| **Stranger** | `getPrivacyBucket()` returns `null` | Entity type + display name (mask-aware), system name, Discord user info, jump-to-message link ONLY |

### Mask Handling
- Calls `proxyMessageHandler.shouldMask(entity, system, guildId)` (exported from `proxy-message.js`)
- If masked, never reveals the indexable/real name — only shows the masked display name
- Avatar resolved via `utils.resolveProxyAvatarUrl()` and `utils.resolveAvatarUrl()` respecting the full priority chain (server → mask → proxy → normal)

### Redis Integration
- Uses `getMessageRecord()` — Redis-first (`msg:{webhookMessageId}` key, 7 day TTL), MongoDB fallback
- Same pattern as `message.js` — repopulates Redis cache on MongoDB miss

## Context Menu Deployment

`deploy-command.js` deploys context menu commands alongside slash commands:

```javascript
// For each command module, pushes all three if present:
commandArray.push(command.data.toJSON());                 // slash command
commandArray.push(command.contextMenuData.toJSON());       // message context menu
commandArray.push(command.userContextMenuData.toJSON());   // user context menu
```

All are deployed in a single `PUT` to `Routes.applicationCommands(clientId)` — the Discord API accepts mixed command types in one request.

Currently used by:
- **`whois.js`** — `contextMenuData`: "Who sent this?" (message context menu)

The `userContextMenuData` pattern is defined in `bot.js` (lines 500-509) but no command currently uses it. Ready for future user context menu commands.

## Ping System (`/message ping`)

### Overview
`/message action:ping message_id:?` — pings the Discord user who sent a proxied message. No ownership check (anyone can ping any proxied message).

### Auto-Detect
Without `message_id`, uses `autoDetectLastMessageAnyUser()` which finds the most recent proxied message in the channel from **any user** (not just the command sender). Goes straight to MongoDB (Redis scan for channel-scoped lookups isn't feasible).

### Ping Priority Chain (`utils.isPingAllowed`)
```
1. entity.setting.allowPing === false       → block
2. ownerUser.settings.allowPing === false   → block (hard kill switch)
3. privacy bucket found AND
   bucket.settings.allowPing === false      → block (per-bucket restriction)
4. Otherwise                                → ping
```

### Schema Locations
| Level | Field | Schema |
|-------|-------|--------|
| **User** | `settings.allowPing` (`Boolean, default: true`) | `schemas/user.js` |
| **Entity** (alter/state/group) | `setting.allowPing` (`Boolean, default: true`) | `schemas/alter.js`, `schemas/state.js`, `schemas/group.js` |
| **Privacy bucket** (alter+group only) | `settings.allowPing` (`Boolean`) | `schemas/settings.js` (`alterPrivacySchema`, `groupPrivacySchema`) |

### Setting Toggles
| Toggle | Location | File |
|--------|----------|------|
| User master | `/settings > General` — "Pings" toggle button | `settings.js` → `handleGeneralAllowPingToggle` |
| User master | `sys!config ping <on\|off>` | `prefix/config.js` → `handlePing` |
| Entity master | `/alter edit > Alter Settings` / `/state edit > State Settings` / `/group edit > Group Settings` — "Pings: ON/OFF" button | `alter.js`, `state.js`, `group.js` |
| Per-bucket | Privacy Settings → "Toggle Pings" button → select bucket | `alter.js`, `state.js`, `group.js` |

### Helper in bot_utils.js
```javascript
isPingAllowed(entity, pingedUserId, viewerDiscordId)
```
- `pingedUserId` = Discord ID of the message sender (the user who would receive the ping)
- `viewerDiscordId` = Discord ID of the person running `/message ping`
- Returns `true`/`false` following the priority chain above
- Must be `await`ed (fetches System + User docs for owner lookup)`

## Profile Command (`/profile`)

### Command Definition
```
/profile
├── show [user: @user]
└── manage action: [edit | settings]
```

### Routing
| Subcommand | Behavior |
|------------|----------|
| `show` | Displays a profile card (yours or another user's). Owner sees quick-action buttons below the embed |
| `manage action:edit` | Opens an ephemeral edit interface with a select menu (Basic Info, Current Status, Proxy Settings) |
| `manage action:settings` | Opens settings interface (Closed Characters toggle, Privacy Settings) |

### Profile Card (Owner View)
- Shows **Info** (pronouns, friend ID), **Current Status** (status, battery, caution), **Proxy** (auto-proxy style, break status), and **Account** info
- Three quick-action buttons below the embed:
  - **Update Status** (`profile_quick_status_`) — modal with single `status` text field → saves to `system.front.status`
  - **Update Battery** (`profile_quick_battery_`) — modal with single `battery` number field → saves to `system.battery`
  - **Update Caution** (`profile_quick_caution_`) — modal with single `caution` text field → saves to `system.front.caution`

### Edit Interface (Current Status)
The `status_info` select menu option opens a modal with three fields — **status**, **battery**, and **caution** — all in one form. This is the same data accessed by the three individual quick buttons.

### Data Fields
| Field | Schema Path | Type |
|-------|-------------|------|
| Status | `system.front.status` | String |
| Battery | `system.battery` | Number (0-100) |
| Caution | `system.front.caution` | String (flat string, unlike entity-caution which is `{c_type, detail}`) |

### Privacy
- When viewing another user's profile, front info (status, battery, caution) is gated by `system.setting.privacy[].settings.front.hidden`
- Blocked users cannot view profiles at all

## Terminology System (Custom Labels)

### Overview
All user-facing "System"/"system" labels are dynamically replaced based on `sys_type.isSystem` and `systemSynonym`. This lets non-system users get neutral terms and system users set a custom synonym.

### Schema
- `system.sys_type.isSystem` (Boolean) — if false, neutral terms used
- `system.systemSynonym` (String, default: `"system"`) — custom label when `isSystem` is true

### Helper Functions (`bot_utils.js`)

**`getSystemTerm(system, {context})`**
- `context`: `'label'` → "Profile" (field names), `'title'` → `""` (strip from titles), `'error'` → "Registration", `'ownership'` → "profile" (lowercase)
- When `isSystem=true`: uses `system.systemSynonym` (default `"system"`)

**`getAlterTerm(system, {plural})`**
- Returns `alterSynonym.singular` or `alterSynonym.plural`

### Neutral Term Mapping (when `isSystem=false`)
| Context | Neutral Term |
|---------|-------------|
| Embed field label | "Profile" |
| Embed title | Stripped (remove "System" prefix) |
| Error messages | "Not registered" or "Registration" |
| Ownership ("your/their") | "profile" |

### Files Updated (29 files)
- **Schema**: `schemas/system.js` — `systemSynonym` field
- **Helpers**: `bot_utils.js` — `getSystemTerm()`, `getAlterTerm()`
- **Slash commands**: `system.js`, `settings.js`, `whois.js`, `front.js`, `friend.js`, `alter.js`, `state.js`, `group.js`
- **Prefix commands**: `system.js`, `alter.js`, `state.js`, `group.js`, `config.js`, `friend.js`, `profile.js`, `whois.js`, `help.js`, `import.js`
- **API routes**: `alters.js`, `friends.js`, `front.js`, `groups.js`, `quick.js`, `states.js`, `system.js` — errors return `'Not registered'`

### Terminology UI
- **`/system edit`** → Terminology modal: 3 fields (singular, plural, system synonym)
- **`/settings`** → General → Terminology modal: same 3 fields
- **`sys!config terminology`** → displays current terms in `"System / Alter / alters"` format
- Edit paths hint when `isSystem=false` pointing to System Type settings

## Docker Compose & Hosting

### Architecture
Chameleon runs in Docker (compose.yaml), other bots (Plum, Sugar, TigerLily) also have Docker Compose services.

```
Docker (compose.yaml):
├── redis:7-alpine (port 6379)
├── chameleon-api   → node Chameleon/webapp/server.js (port 3001)
├── chameleon-bot   → node Chameleon/bot.js
├── plum-bot        → node Plum/index.js
├── sugar-bot       → node Sugar/index.js
└── tigerlily-bot   → node TigerLily/index.js
```

### Files

**`Dockerfile`** (repo root) — 5-step build:
```dockerfile
FROM node:20-alpine
WORKDIR /app
# 1. Root deps (express, discord.js, mongoose, etc.)
COPY package*.json ./
RUN npm ci --ignore-scripts
# 2. Workspace deps (React, Robo.js, etc.)
COPY Chameleon/package*.json Chameleon/
COPY Chameleon/webapp/package*.json Chameleon/webapp/
COPY Chameleon/activity/package*.json Chameleon/activity/
COPY Chameleon/shared/package*.json Chameleon/shared/
RUN cd Chameleon && npm ci --ignore-scripts
# 3. Activity deps (own node_modules, not workspace)
COPY Chameleon/activity/package*.json Chameleon/activity/
RUN cd Chameleon/activity && npm ci --ignore-scripts
# 4. Source code
COPY . .
# 5. Build activity
RUN cd Chameleon/activity && npm run build
```

**`compose.yaml`** (repo root) — 6 services with bind mounts for dev:
```yaml
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    restart: unless-stopped
  chameleon-api:
    build: .
    command: node Chameleon/webapp/server.js
    ports: ["3001:3001"]
    environment: [REDIS_URL=redis://redis:6379]
    depends_on: [redis]
    restart: unless-stopped
    volumes: &chameleon-volumes
      - ./Chameleon:/app/Chameleon
      - /app/Chameleon/node_modules  # preserve image node_modules
      - /app/Chameleon/activity/node_modules
  chameleon-bot:
    build: .
    command: node Chameleon/bot.js
    environment: [REDIS_URL=redis://redis:6379]
    depends_on: [redis]
    restart: unless-stopped
    volumes: *chameleon-volumes
  plum-bot:
    build: .
    command: node Plum/index.js
    restart: unless-stopped
    volumes:
      - ./Plum:/app/Plum
      - ./config.json:/app/config.json
  sugar-bot:
    build: .
    command: node Sugar/index.js
    restart: unless-stopped
    volumes:
      - ./Sugar:/app/Sugar
      - ./config.json:/app/config.json
  tigerlily-bot:
    build: .
    command: node TigerLily/index.js
    restart: unless-stopped
    volumes:
      - ./TigerLily:/app/TigerLily
      - ./config.json:/app/config.json
```

### node_modules Strategy
Three independent `node_modules/` directories:

| Location | Source | Used by | Managed by |
|----------|--------|---------|------------|
| repo root `node_modules/` | `npm install` at root | Plum, Sugar, TigerLily, `index.js` CLI | Root `package.json` |
| `Chameleon/node_modules/` | `npm ci` in `Chameleon/` | Chameleon bot + API + webapp + shared (inside Docker) | Workspace `Chameleon/package.json` |
| `Chameleon/activity/node_modules/` | `npm ci` in `activity/` | Activity (independent, NOT workspace) | `Chameleon/activity/package.json` |

### Config Per Bot Directory
- **`Chameleon/config.json`** — Chameleon's own config (tokens, MongoDB, R2, JWT). 14 require paths in Chameleon files updated to use `../config.json`.
- **Root `config.json`** — Untouched. Still has Chameleon+Plum+Sugar+TigerLily entries for the local CLI tools.

### Bot Name Aliases
| Alias | Bot Name | Directory | Docker Service |
|-------|----------|-----------|----------------|
| `prune` | Plum | `Plum/` | `plum-bot` |
| `sucre` | Sugar | `Sugar/` | `sugar-bot` |
| `trigin` | TigerLily | `TigerLily/` | `tigerlily-bot` |
| `system` | Chameleon | `Chameleon/` | `chameleon-[api,bot]` |

### Usage

```bash
# Start everything
docker compose up                          # all 6 services
docker compose up redis chameleon-api      # API + Redis only (for activity dev)
docker compose up redis chameleon-bot      # bot + Redis only
docker compose down                        # stop everything
docker compose down chameleon-api          # stop one service

# Rebuild (with bind mounts, only needed when Dockerfile or package.json changes):
./rebuild.sh                               # all services
./rebuild.sh system                        # Chameleon only (api + bot + redis)
./rebuild.sh prune                         # Plum only
./rebuild.sh --no-cache                    # full clean rebuild

# Run local bots (separate terminal)
node index.js prune sucre trigin           # start Plum + Sugar + TigerLily
node index.js -d system                    # deploy Discord commands for Chameleon
node index.js -d prune                     # deploy commands for Plum

# Activity dev (separate terminal)
cd Chameleon/activity
robox dev --tunnel
```

### Cloudflare Tunnel
Both domains point to the same Express server (port 3001):
```yaml
# ~/.cloudflared/config.yml
ingress:
  - hostname: api.teamcalendula.net
    service: http://localhost:3001
  - hostname: systemise.teamcalendula.net
    service: http://localhost:3001
  - service: http_status:404
```

The Express server routes internally:
- `/api/*` → API routes
- `/discord_activity/*` → Activity SPA from `activity/dist/`
- Everything else → Webapp SPA (React app)

### Fly.io (future)
Each Docker Compose service becomes a separate Fly app using the same Dockerfile:
```bash
fly launch --name chameleon-redis --image redis:7-alpine --internal-port 6379 --no-deploy
fly launch --name chameleon-api --dockerfile Dockerfile --internal-port 3001 --no-deploy
fly launch --name chameleon-bot --dockerfile Dockerfile --no-deploy
```
Redis on Fly connects via private network: `REDIS_URL=redis://chameleon-redis.internal:6379`

### Bug Fixes Applied

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Cannot find module 'express'` in Docker | Workspace npm ci didn't install root deps | Dockerfile now runs `npm ci` at root level first, then workspace |
| `authMiddleware` is not a function | Route files imported `authMiddleware` but middleware exports `authenticateToken` | Added alias in `api/middleware/auth.js` |
| `Missing parameter name at index 6: /api/*` | Express 5 doesn't allow bare `*` wildcards | Changed `app.use('/api/*', ...)` → `app.use('/api', ...)` |
| `Cannot find module 'mongodb'` | `bot.js` imported `MongoClient` but `mongodb` isn't a direct dep (only `mongoose` is) | Removed unused `MongoClient` import |
| Workspace `npm ci` failed with "Missing from lock file" | Added `api` to workspace but didn't regenerate lockfile | Removed `api` from workspace (root `package.json` already has all deps), regenerated lockfile |
| `@robojs/patch` not found in workspace | Activity was a workspace member; `@robojs/patch` couldn't resolve `.robo/public/` when hoisted | Removed activity from workspace; it has its own `node_modules/` with `"@chameleon/shared": "file:../shared"` |
| `DiscordAPIError[50240]` on deploy | Bulk PUT removed auto-created Entry Point command (type 4) | `deploy-command.js` now fetches existing commands, preserves Entry Point, includes in bulk PUT |
| `DiscordAPIError[50234]` on /systemise | App doesn't have EMBEDDED flag | Add URL Mapping in Discord Developer Portal → sets EMBEDDED flag |
| Express crash on `/activity/*` | Express 5's `path-to-regexp` v8 doesn't allow bare `*` | Changed to `app.get('/activity/{*any}', ...)` using brace syntax, later moved to `/discord_activity/{*any}` |
| `Cannot find module config.json` in activity build | `createRequire(import.meta.url)` relative path broke after Robo.js rebuild | Changed to `readFileSync(resolve(process.cwd(), ...))` in `activity/src/api/token.js` |
| Activity path in vite.mjs wrong | Relative path used `../../../config.json` but activity is at same level | Fixed to `../../config.json` (activity/config/ → Chameleon/config.json) |
| `Cannot find module 'localforage'` in `@discord/embedded-app-sdk` | `@robojs/patch` removed from production build, `crossorigin` not set — Vite injected `crossorigin` on module scripts | Added `/discord_activity/assets` static route to bypass catch-all; SDK constructor now works but `ready()` hangs |
| White screen (404 JS/CSS) inside Discord Activity | Discord CDN proxy prepends URL Mapping target path to asset URLs, hitting Express `{*any}` catch-all which returns `index.html` instead of JS | Added `app.use('/discord_activity/assets', express.static(...))` middleware in `server.js` to serve assets before catch-all |
| `sdk.ready()` hangs indefinitely | Discord client never responds to SDK's postMessage handshake from inside cross-origin iframe | Added 10s timeout via `Promise.race`; added env diagnostics to error output |
| `SecurityError: Failed to read a named property 'origin'` | Error diagnostic code reads `window.parent.origin` directly (cross-origin blocked) | Wrapped in try/catch — returns `'cross-origin'` |
| `sdk.ready()` times out with `"client_id" is required` | `npx vite build` without `--config` ignored `config/vite.mjs` — `VITE_DISCORD_CLIENT_ID` was `undefined` | Build script changed to `vite build --config config/vite.mjs` |
| Error 4009: `"No access token provided"` | `sdk.commands.authenticate()` called with wrong args (`client_id`, `scope`); SDK v2 only accepts `{ access_token }` | Changed to `sdk.commands.authorize()` → exchange code → `sdk.commands.authenticate({ access_token })` |
| CSP blocks fetch to `systemise.teamcalendula.net` | Discord's CSP only allows `connect-src` to `*.discordsays.com`, `discord.com`, etc. | `VITE_API_BASE` set to `/api` (relative); URL Mapping changed to `/` → `https://systemise.teamcalendula.net` |
| `POST /api/auth/activity/exchange 404` | API calls used absolute URL (`systemise.teamcalendula.net`) which Discord CSP blocked | Changed to relative `/api` so requests go through discordsays.com proxy |
| `Cannot read properties of null (reading '_id')` in notes | All API route files used `req.userId` but auth middleware sets `req.user._id` | Fixed `req.userId` → `req.user._id` across all 6 route files (40+ occurrences) |
| `Cannot read properties of null (reading 'useState')` in CreateNoteModal | `@chameleon/shared` components resolve React to a separate instance when bundled | Added `react`/`react-dom` to `resolve.alias` in `activity/config/vite.mjs`; removed `react` from `optimizeDeps.include`; removed unused React import from `shared/api/client.js` |
| Note creation 500: `Cast to Embedded failed` | `content` field in Note schema was `mediaSchema` but API handler stored a plain string | Changed `content` to accept Mixed type; API now uploads markdown to R2 as `.md` files, stores mediaSchema in `content`, auto-populates `contentPreview` |
| Discord Activity asks for auth every time | No token caching between activity sessions | Added `localStorage` caching of Discord access token — skips `authorize()` on subsequent loads |
| `robo build` hangs in Docker | Robo.js build process never completes | Changed package.json build script to `vite build --config config/vite.mjs` |
| Stale `.robo/public` copy in Dockerfile | Dockerfile had `cp -r .robo/public dist` from old `robo build` | Removed — no longer needed with `vite build` |
| Google Fonts blocked by Discord CSP | Discord's iframe CSP blocks `fonts.googleapis.com` and `fonts.gstatic.com` | Self-hosted fonts in `activity/public/assets/fonts/`; CSS `@font-face` declarations use `/assets/fonts/` path (same as JS/CSS bundles, passes through CDN proxy) |
| Error handler kills page on font load failure | `window.addEventListener('error')` caught `<link>` tag failures and replaced entire page | Narrowed handler to only catch `<script>` tag failures |
