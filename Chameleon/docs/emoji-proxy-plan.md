# Emoji Proxy System — Implementation Plan

> **Status:** Draft — Ready for implementation  
> **Last Updated:** 2026-07-05

---

## Overview

The emoji proxy system allows Systemiser/Chameleon to display custom emojis from servers the bot isn't in, using a cascading fallback strategy. This is primarily used for message proxying where Nitro users expect their emojis to render properly.

### Core Problem
Discord restricts bot/webhook messages to only render emojis from servers the bot is in. External emojis show as plain text (`:emojiname:`).

### Solution
A 4-tier cascading system that attempts the best rendering method first, falling back gracefully.

---

## Tier System

### Tier 1: User Webhook (Best)

**Priority:** Highest  
**Speed:** Instant  
**Rate Limits:** None  
**Emoji Access:** Full (user's Nitro + server membership)

**How it works:**
- User creates a webhook in their server (one-time setup)
- Stored in guild schema + Redis
- When proxying user's message → use their webhook
- Emoji renders natively because it's the user's own webhook

**Trigger for fallback:** No webhook stored for user in this guild

---

### Tier 2: Emoji Server (Second)

**Priority:** Second  
**Speed:** ~200-500ms (CDN download + upload)  
**Rate Limits:** Per-guild, restrictive (undocumented exact values)  
**Emoji Access:** Limited by server slots

**How it works:**
1. User sets up an "emoji server" — a personal server where bot can manage emojis
2. When foreign emoji detected → download from CDN → upload to emoji server
3. Message sends with native emoji
4. Emoji deleted after TTL (default 4 seconds)
5. Deletion queue processes slowly (~1 per few seconds)

**Key constraints:**
- Server has 50 static + 50 animated slots (base, more with boosts)
- Per-guild rate limits on emoji creation/deletion (restrictive)
- Emojis can be shared between users

**CDN URL format:**
```
https://cdn.discordapp.com/emojis/{id}.png   (static)
https://cdn.discordapp.com/emojis/{id}.gif   (animated)
https://cdn.discordapp.com/emojis/{id}.webp  (recommended)
```

The CDN is publicly accessible — no auth or server membership required.

**Trigger for fallback:** No emoji server configured, slots full, or rate limited

---

### Tier 3: Application Emojis (Third)

**Priority:** Third  
**Speed:** ~200-500ms (CDN download + upload)  
**Rate Limits:** Standard API limits (more forgiving than guild)  
**Emoji Access:** 2,000 slots per application

**How it works:**
1. Bot has up to 2,000 application emojis
2. Foreign emoji detected → download from CDN → upload as app emoji
3. Message sends with native emoji
4. Emoji deleted immediately after message sent (async)

**Queue system:**
- Two queues: standard and premium
- Interleaved processing: standard, premium, standard, premium...
- Queue length unlimited, but entries expire after TTL (default 4 seconds)
- Most messages skip queue entirely (slots usually available)

**Slot math:**
- 2000 slots total
- Each emoji occupies slot for ~300ms (add + send, delete is async)
- ~10 emojis per second throughput
- Queue only fills during bursts or rate limiting

**Trigger for fallback:** Queue entry expired (4 seconds), slots exhausted, rate limited

---

### Tier 4: CDN Image Fallback (Last Resort)

**Priority:** Lowest  
**Speed:** Instant  
**Rate Limits:** None  
**Emoji Access:** Any emoji with a known ID

**How it works:**
- Parse `<:name:id>` from message
- Convert to CDN URL
- Send as embedded image in message
- Emoji displays as image, not inline

**Used when:**
- Tiers 1-3 unavailable or failed
- Queue entry expired
- Per-message limit exceeded (excess emojis)

---

## Cascade Logic

```
1. User has webhook in guild? ──────── Yes → Use webhook (Tier 1) ✓

2. Extract foreign emojis from message
   - Free tier: max 5 per message
   - Premium tier: max 15 per message
   - Excess → ephemeral warning + CDN fallback

3. Slots available (2000 - active)?
   ├─ Yes → Reserve slots → Add all → Send → Delete async (Tier 3)
   └─ No → Enter queue (TTL: 4 seconds)

4. User has emoji server configured?
   ── Yes → Download from CDN → Upload to emoji server (Tier 2)
           ── 2 min TTL → Deletion queue (slow)

5. None of above? → Fallback to CDN image embed (Tier 4)
```

---

## Per-Message Limits

| User Type | Max Foreign Emojis | Excess Behavior |
|-----------|-------------------|-----------------|
| Free | 5 | Ephemeral warning + CDN fallback |
| Premium | 15 | Ephemeral warning + CDN fallback |

**Premium check:** `user.isPremium === true` (existing schema field)

**Example (free user, 8 foreign emojis):**
```
Input:  :e1: :e2: :e3: :e4: :e5: :e6: :e7: :e8:
        ─────────────────────────────────────────
Output: :e1: :e2: :e3: :e4: :e5: [CDN] [CDN] [CDN]
        ─────────────────────────────────────────
            ▲ (5 native)     ▲ (3 images)
```

---

## Rate Limits

### Known Limits

| Type | Value | Notes |
|------|-------|-------|
| Global bot limit | 50 req/sec | All endpoints combined |
| Guild emoji routes | Per-guild, restrictive | Undocumented, expect 429s |
| Application emoji routes | Standard per-route | Parse headers, ~200ms between ops |
| Webhook execute | Standard per-webhook | Well-documented |

### Important Notes

- Guild emoji rate limits are **per-guild, not per-bot** — multiple bots share limit
- API response headers for emoji quotas may be **inaccurate**
- Always parse `X-RateLimit-*` headers, don't hardcode delays
- Handle 429 responses with `retry_after` from response body

### Conservative Estimates

| Operation | Estimated Interval |
|-----------|-------------------|
| Guild emoji create | ~1 per few seconds |
| Guild emoji delete | ~1 per few seconds |
| App emoji create | ~200ms |
| App emoji delete | ~200ms |

---

## Queue System (Tier 3)

### Queue Structure

```js
queueEntry = {
  messageID: String,
  channelID: String,
  webhookID: String,
  userID: String,
  userPremium: Boolean,
  emojis: [{
    emojiID: String,
    original: String,       // <:name:id> for replacement
    status: 'queued' | 'added' | 'sent' | 'deleted' | 'fallback'
  }],
  createdAt: Date,
  ttlMs: Number,           // Default 4000 (4 seconds)
  status: 'pending' | 'processing' | 'sent' | 'expired'
}
```

### Processing Loop

```js
const QUEUE_TTL_MS = 4_000; // 4 seconds

async function processQueue() {
  while (true) {
    const now = Date.now();
    
    // Drop expired entries (older than 4 seconds)
    while (queue.length > 0 && (now - queue[0].createdAt) > QUEUE_TTL_MS) {
      const expired = queue.shift();
      await sendWithCdnFallback(expired);
    }
    
    // Process next if slot available
    if (queue.length > 0 && await getActiveCount() < 2000) {
      const entry = queue.shift();
      await processEntry(entry);
    }
    
    await sleep(100);
  }
}
```

### Interleaved Processing (Standard/Premium)

```js
async function processEmojiQueue() {
  while (true) {
    // Interleaved: standard, premium, standard, premium...
    if (standardQueue.length > 0) {
      await addEmoji(standardQueue.shift());
    }
    if (premiumQueue.length > 0) {
      await addEmoji(premiumQueue.shift());
    }
    
    await sleep(150); // Rate limit buffer
  }
}
```

---

## TTL System (Tier 2)

### Emoji Server TTL

- Default: 4 seconds
- Configurable per emoji server
- Emojis deleted after TTL expires
- Deletion queue processes slowly (~1 per few seconds)

### Deletion Worker

```js
async function cleanupEmojiServerEmojis(guildId) {
  const now = Date.now();
  const expired = await redis.zrangebyscore(
    `guild:${guildId}:emojiServer:expiries`, 
    0, 
    now
  );
  
  for (const emojiId of expired) {
    try {
      await deleteGuildEmoji(guildId, emojiId);
      await redis.zrem(`guild:${guildId}:emojiServer`, emojiId);
      await redis.zrem(`guild:${guildId}:emojiServer:expiries`, emojiId);
      await sleep(2500); // Rate limit between deletes
    } catch (err) {
      console.error(`Failed to delete emoji ${emojiId}:`, err);
    }
  }
}
```

---

## Data Models

### Guild Schema Additions

```js
// Webhooks (Tier 1)
webhooks: [{
  userID: String,        // Discord user ID
  webhookID: String,     // Webhook ID
  webhookToken: String,  // Webhook token (needed for execute)
  channelID: String,     // Channel webhook is in
  serverID: String,      // Guild ID
  addedAt: Date
}]

// Emoji Servers (Tier 2)
emojiServers: [{
  guildID: String,        // The emoji server's ID
  channelID: String,      // Channel to use
  addedBy: String,        // Who set it up
  sharedWith: [String],   // User IDs allowed to use it
  ttlMs: Number,          // Custom TTL (default 4000)
  createdAt: Date
}]
```

### Redis Keys

```js
// Webhooks cache
guild:{guildId}:webhooks: [{userID, webhookID, webhookToken, channelID}]

// Emoji server cache
guild:{guildId}:emojiServer: {
  guildID, channelID, addedBy, sharedWith[], ttlMs
}

// Tier 2 emoji tracking (sorted set for TTL)
guild:{guildId}:emojiServer:emojis: {emojiId: {addedBy, originalEmojiId}}
guild:{guildId}:emojiServer:expiries: Sorted set of timestamps

// Tier 3 app emoji queues
appEmoji:queue:standard: List [emojiId, ...]
appEmoji:queue:premium:  List [emojiId, ...]
appEmoji:usage: {emojiId: userId}
appEmoji:active: Set of currently active emoji IDs

// Short-lived cache for downloaded emojis
emoji:{emojiId}: {downloaded: Buffer/URL, tier: 2|3, addedAt: Date}
TTL: 60 seconds
```

---

## Command Structure

### Prefix Block: `serverconfig` (or `serversettings`)

```
├── serverconfig
│   ├── webhook
│   │   ├── add <url>
│   │   ├── remove <url|user_id>
│   │   └── list
│   └── emojiserver
│       ├── add <server_id> <channel_id>
│       ├── remove
│       ├── info
│       ├── share <user_id>
│       ├── unshare <user_id>
│       └── ttl <seconds>
```

### Commands

#### Webhook Management (Tier 1)

```
!serverconfig webhook add <webhook_url>
```
- Validates webhook exists (GET /webhooks/{id})
- Sends test proxy message
- If successful → saves to MongoDB + Redis
- If server ID specified → saves but warns "can't test, unverified"

```
!serverconfig webhook remove <webhook_url | user_id>
```
- Removes webhook from storage

```
!serverconfig webhook list
```
- Shows webhooks stored for this specific guild
- Output format:
  ```
  📋 Webhooks in This Server
  
  1. jardinsys#1234 (User ID: 190320984123768832)
     Channel: #general
     Added: 2026-07-05
  ```

#### Emoji Server (Tier 2)

```
!serverconfig emojiserver add <server_id> <channel_id>
```
- Validates bot is in that server
- Validates bot has MANAGE_EMOJIS + SEND_MESSAGES
- Saves to MongoDB + Redis

```
!serverconfig emojiserver remove
```
- Removes user's emoji server configuration

```
!serverconfig emojiserver info
```
- Shows current emoji server setup
- Output format:
  ```
  🎭 Emoji Server
  
  Server: My Personal Server (1234567890)
  Channel: #emoji-storage
  TTL: 4 seconds
  Shared with: user1, user2
  ```

```
!serverconfig emojiserver share <user_id>
```
- Allows another user to use this emoji server
- Owner only

```
!serverconfig emojiserver unshare <user_id>
```
- Removes user's access
- Owner only

```
!serverconfig emojiserver ttl <seconds>
```
- Sets custom TTL for this emoji server
- Default: 4 seconds
- Owner only

### Permissions

| Command | Required Permission |
|---------|---------------------|
| webhook add/remove | MANAGE_WEBHOOKS |
| webhook list | None |
| emojiserver add/remove | MANAGE_GUILD (on target server) |
| emojiserver share/unshare | Manage emojiserver (owner only) |
| emojiserver ttl | Manage emojiserver (owner only) |

### Usage Messages

When a command is used incorrectly, show ephemeral help:

```
User: !serverconfig webhook

Bot (ephemeral):
📖 Usage: !serverconfig webhook <subcommand>

Available subcommands:
  add <webhook_url>     — Store a webhook for this server
  remove <url or id>    — Remove a stored webhook
  list                  — Show webhooks in this server

Example:
  !serverconfig webhook add https://discord.com/api/webhooks/123/abc
```

---

## Warnings and Feedback

### Per-Message Limit Exceeded

```js
// Send ephemeral warning
await message.channel.send({
  content: `⚠️ **Emoji limit exceeded:** ${rejected.length} emoji(s) will display as images.\n\nFree tier: 5 per message · Premium: 15 per message`,
  flags: MessageFlags.Ephemeral,
  allowedMentions: { parse: [] }
});
```

### Webhook Test Success

```
✅ Webhook verified and saved!
   Channel: #general
   Server: My Server
```

### Webhook Test Failure

```
❌ Failed to verify webhook.
   Error: Missing permissions or webhook invalid.
   Make sure the bot has MANAGE_WEBHOOKS in the target server.
```

---

## Edge Cases

### Webhook Deleted/Revoked
- Auto-remove from storage on 404/401 response
- Log warning
- User notified via DM or next proxy attempt

### Same Emoji Requested Multiple Times
- **Tier 2:** If within TTL, reset timer and reuse existing
- **Tier 3:** If already active, use cached version

### Concurrent Messages with Same Emoji
- **Tier 3:** Queue handles this — emoji added once, used for multiple messages
- **Tier 2:** Same emoji in server = reuse

### Bot Restart
- Redis cache persists (if Redis persists)
- MongoDB is source of truth
- Rebuild Redis cache from MongoDB on startup

---

## Implementation Order

1. **Data models** — Update guild schema with webhooks + emojiServers
2. **Redis caching** — Implement cache layer
3. **Command parsing** — serverconfig prefix block
4. **Webhook commands** — add, remove, list, test proxy
5. **Emoji server commands** — add, remove, info, share, unshare, ttl
6. **Tier 1 proxy** — Use user webhook
7. **Tier 3 proxy** — Application emojis with queue
8. **Tier 2 proxy** — Emoji server with TTL
9. **Tier 4 fallback** — CDN image embed
10. **Cleanup workers** — TTL deletion, queue processing
11. **Error handling** — 429s, edge cases, notifications

---

## Testing Checklist

- [ ] Webhook add/remove/list commands work
- [ ] Test proxy succeeds and webhook is stored
- [ ] Emoji server setup validates permissions
- [ ] Sharing/unsharing works correctly
- [ ] Per-message limit enforced (5 free / 15 premium)
- [ ] Ephemeral warnings display correctly
- [ ] Queue processes in FIFO order
- [ ] Queue entries expire after 4 seconds
- [ ] CDN fallback works when queue expires
- [ ] Tier 2 TTL deletion works
- [ ] Same emoji reuse within TTL
- [ ] Rate limit handling (429 responses)
- [ ] Bot restart rebuilds cache from MongoDB

---

## Open Questions / Future Considerations

1. **Emoji server slot management** — When slots fill up, which emoji to evict? (LRU? User-specific?)
2. **Shared emoji servers** — Limits on how many users can share?
3. **Premium qualification** — What determines premium status?
4. **Webhook rotation** — What happens if webhook is deleted mid-proxy?
5. **Analytics** — Track usage patterns for optimization?
6. **Admin commands** — Global emoji proxy stats/management?
