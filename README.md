# 🌻 Team Calendula

A collection of Discord bots and web applications for plural system management and community support.

## 🤖 Bots Overview

| Bot | Folder | Description |
|-----|--------|-------------|
| **Systemiser** 🎡 | `Chameleon/` | Dissociative disorder system management — Discord bot, REST API, webapp, and embedded Activity |
| **TrigIn** 🐯 | `TigerLily/` | Trigger and intro display & management |
| **Sucre** 💌 | `Sugar/` | Utility bot |
| **Prune** 🎨 | `Plum/` | Utility bot |

---

## 🎡 Systemiser (Chameleon)

**Systemiser** is a feature-rich Discord bot, REST API, and web application designed to help individuals with all types of dissociative disorders. It is not limited to those who use the term "system" — it supports plurality, fragmentation, dissociative disorders, and combinations thereof.

### ✨ Key Features

#### 👥 System Management
- **Alters** — Full alter/headmate profiles with avatars, descriptions, pronouns, proxy tags, conditions, and more
- **States** — Track mental states, moods, or conditions (dissociation, regression, agitation) separately from alters
- **Groups** — Organize alters and states into subsystems, groups, and categories
- **Custom Synonyms** — Use your preferred terminology (headmates, parts, members, etc.)
- **System Types** — DSM-5 / ICD-11 aware: supports plurality, fragmentation, dissociative disorders (DEPD, DDIS, DSR, DDNOS, UDD, POSSS), or combinations
- **Conditions** — Track entity states (Dormant, Remission, Dissociated, etc.) with configurable conditions

#### 🎭 Proxy System
- **Message Proxying** — Send messages as different alters using customizable proxy tags
- **Multiple Proxy Tags** — Each alter can have multiple proxy formats (prefix, suffix, or both)
- **Auto-Proxy Modes**:
  - `off` — No auto-proxy; only explicit proxy patterns work
  - `last` — Auto-proxy as the most recently used entity
  - `front` — Auto-proxy as the current fronter
  - `<name>` — Always proxy as a specific named entity
- **Server-Specific Proxy Style** — Override global auto-proxy per server
- **Reply Styles** — Embed (custom embed with author info) or Native (Discord's built-in reply), configurable per-server with admin force option
- **Proxy Break/Cooldown** — `\\` prefix stops all auto-proxying; `\` skips one message; cooldown auto-activates after inactivity

#### 🔄 Front Tracking
- **Layer System** — Multiple named layers with colors for organizing co-fronting entities
- **Switch Logging** — Record who's fronting with timestamps
- **Status & Battery** — Track per-entity and per-layer status messages and social battery (0–100)
- **Caution Tracking** — Per-entity caution with type and detail
- **Shift History** — Full history of all switches with retroactive editing
- **Entity Presets** — Default status, battery, and caution per entity, applied to new shifts automatically

#### 📝 Notes System
- **Personal Notes** — Create and organize notes with tags
- **Rich Text** — Markdown-based editing with rich text support
- **Collaborative Sharing** — Real-time collaboration with presence awareness (see who's viewing/editing)
- **Auto-linking** — Notes automatically link to whoever was fronting when created
- **R2 Content Storage** — Note content stored in Cloudflare R2 as markdown files for unlimited length
- **Quick Notes** — Fast note creation from Discord

#### 👫 Friends System
- **Friend Requests** — Send, accept, and decline friend requests
- **View Friends' Fronts** — See who's fronting in your friends' systems
- **Privacy Controls** — Per-bucket privacy settings control what friends can see
- **Per-Friend Notifications** — Toggle switch notifications per friend
- **Custom Names** — Set nicknames for friends' systems
- **Block/Unblock** — Block users from seeing your system

#### 🔐 Privacy System
- **Privacy Buckets** — Categorize viewers (Strangers, Friends, etc.) with per-bucket field visibility
- **Entity-Level Privacy** — Hide specific fields (avatar, description, pronouns, etc.) per entity per bucket
- **System-Level Privacy** — Control front status, caution, and other system-level field visibility
- **Default Seeding** — New users get "Strangers" (maximum privacy) and "Friends" (core info visible) buckets automatically
- **Ping Controls** — Per-entity, per-bucket, and global ping allow/deny

#### 📥 Import/Export
- **PluralKit Import** — Full import via API token or JSON file
- **Simply Plural Import** — Import via API token
- **Tupperbox Import** — Import from Tupperbox exports
- **Octocon Import** — Import from Octocon
- **Simple/Intermediate/Advanced Modes** — Choose import complexity from single-source auto to per-entity checklist

#### 🖥️ Discord Activity (Embedded App)
- **Launched via `/systemise`** — Opens directly inside Discord as an Activity
- **Full Front Management** — Layer-based switching with entity search, drag reorder, mode toggles (add/replace/remove/move)
- **Entity CRUD** — Create, view, edit, and delete alters, states, and groups
- **Notes** — Create, view, edit, and share notes with tag management
- **Friends** — View friends' fronts, add friends by ID
- **Settings** — Full settings panel (server, proxy, notifications, general)
- **Real-Time Updates** — WebSocket-powered live data sync across clients
- **Disconnect Toast** — Visual indicator when connection drops

#### ⚙️ Server Configuration
- **Channel Restrictions** — Blacklist/whitelist channels for proxying
- **Proxy Logging** — Log proxy, edit, delete, and reproxy events to a designated channel
- **Admin Roles** — Designate server admins for Systemiser
- **Force Reply Style** — Admin override for reply style (off/embed/native)
- **Disable Autoproxy** — Admin force-disable per server

### 🖥️ Commands

#### Slash Commands
| Command | Description |
|---------|-------------|
| `/system` | Manage your system (view, edit, settings, terminology, type) |
| `/alter` | Manage alters (create, edit, delete, list, settings) |
| `/state` | Manage states (create, edit, delete, list, settings) |
| `/group` | Manage groups (create, edit, delete, list, members) |
| `/front` | View and manage front (switch, add, remove, status, battery, history, layers) |
| `/note` | Create and manage notes (R2-backed) |
| `/message` | Edit, delete, reproxy, or ping proxied messages |
| `/friend` | Manage friends (list, view, add, remove, requests, block, unblock, settings) |
| `/whois` | Look up who sent a proxied message (+ "Who sent this?" context menu) |
| `/profile` | View and edit system profile |
| `/settings` | Configure proxy, notifications, server, and general settings |
| `/systemise` | Launch the Discord Activity embedded app |
| `/crisis` | Crisis resources |
| `/support` | Support information |

#### Prefix Commands (`sys!` or `sys;`)
```
sys!system              - Manage your system
sys!alter / a           - Manage alters
sys!state / st           - Manage states
sys!group / g            - Manage groups
sys!front / fr           - Manage front and layers
sys!note                 - Manage notes
sys!friend / fr          - Manage friends
sys!whois                - Look up proxy message sender
sys!profile              - View system profile
sys!autoproxy / ap       - Configure autoproxy
sys!config / cfg         - Personal settings
sys!serverconfig / scfg  - Server settings (admin only)
sys!import               - Import from other bots
sys!convert              - Convert alters ↔ states
sys!help                 - Show help
```

### 🌐 Web Application

The web application at `systemise.teamcalendula.net` features:

- **Landing Hub** — Dashboard with feature cards (System, Friends, Notes, Crisis, Settings)
- **System Page** — Overview, front display, alter/state/group sub-pages with full CRUD
- **Switch Page** — Layer-based front management with entity search, mode toggles, drag reorder
- **Front History** — Shift timeline with retroactive editing
- **Notes** — Rich note editing with tags and real-time collaboration presence
- **Friends** — Friend list with front previews and privacy-gated detail views
- **Profile** — System profile display and editing
- **Settings** — Full settings panel matching Discord `/settings` command
- **Discord OAuth** — Secure login with Discord

### 📡 Infrastructure

| Component | Purpose |
|-----------|---------|
| **MongoDB** | Primary data store (Atlas or self-hosted) |
| **Redis** | Cache layer for messages, proxy state, display resolution, and sessions |
| **Cloudflare R2** | Media storage (avatars, banners, note content) — dual-bucket (app + discord) |
| **WebSocket** | Real-time updates between Discord bot, API, and webapp clients |
| **Docker Compose** | 6-service orchestration (Redis, API, Chameleon bot, Plum, Sugar, TigerLily) |
| **Cloudflare Tunnel** | Public access to API and webapp |

### 🗄️ Database Schema

MongoDB collections:

| Collection | Purpose |
|------------|---------|
| `users` | Discord user accounts, settings, friends, notifications |
| `systems` | System profiles, proxy config, front state, privacy settings |
| `alters` | Alter profiles, proxy tags, media, conditions, privacy |
| `states` | State profiles, proxy tags, media, conditions, privacy |
| `groups` | Group definitions, members, privacy |
| `shifts` | Front shift records with statuses, battery, caution |
| `notes` | Note metadata, tags, sharing, R2 content references |
| `messages` | Proxy message tracking (webhook IDs, content, attachments) |
| `guilds` | Server-specific config (channels, admins, logging, proxy controls) |

---

## 🔐 Privacy & Security

- All data stored in MongoDB Atlas (or self-hosted)
- Discord OAuth2 for authentication
- JWT tokens for API authorization
- Privacy bucket system with per-field visibility controls
- Dual-bucket R2 media storage (app + discord)
- No data shared without explicit permission
- Source-Available License (not open-source)

---

### Prerequisites
- Node.js 20+
- MongoDB instance (Atlas or local)
- Redis instance (optional — falls back to MongoDB-only mode)
- Cloudflare R2 bucket (for media storage)
- Discord bot application with OAuth2 configured

---

## 📜 License

This project is under a Source-Available License (this does not mean "open-source").

---

## 🌻 In the Future

The following features are planned or under consideration:

- **Webapp Onboarding** — Full browser-based registration and import flow (partially implemented in the Activity)
- **Data Export/Import** — Full system export and cross-platform migration
- **Reminders & To-Do Lists** — Built-in reminder and task management system
- **Entity Profile Pages** — Dedicated per-entity detail pages in the webapp
- **Standalone Apps** — Native desktop/mobile clients with offline mode
- **Accessibility Improvements** — Enhanced screen reader support, keyboard navigation, and motion sensitivity options
- **Additional Import Sources** — Support for more plural management platforms
- **Privacy Preview Mode** — See what your system looks like to different viewer tiers
- **Friend Groups** — Organize friends into groups with batch privacy controls
- **Server-Specific Proxy Footer** — Show server context in proxied message footers
- **Condition Tracking Enhancements** — More granular condition management and history
