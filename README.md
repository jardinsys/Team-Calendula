# 🌻 Team Calendula

A collection of Discord bots and web applications built for various purposes. This repository contains four Discord bots and a web application.

## 🤖 Bots Overview

| Bot | Folder | Description |
|-----|--------|-------------|
| **Systemiser** 🎡 | `Chameleon/` | Plural/DID system management (main project) |
| **TrigIn** 🐯 | `TigerLily/` | Trigger tracking & management |
| **Sucre** 💌 | `Sugar/` | Utility bot |
| **Prune** 🎨 | `Plum/` | Utility bot |

---

## 🎡 Systemiser (Chameleon)

**Systemiser** is a feature-rich Discord bot and web application designed to help individuals with Dissociative Identity Disorder (DID), OSDD, and other plural experiences manage their systems.

### ✨ Key Features

#### 👥 System Management
- **Alters** - Full alter/headmate profiles with names, pronouns, descriptions, avatars, colors, birthdays, and custom fields
- **States** - Track mental states, moods, or conditions (anxiety, dissociation, etc.) separately from alters
- **Groups** - Organize alters and states into subsystems, groups, or categories
- **Custom Synonyms** - Use your preferred terminology (headmates, parts, members, etc.)

#### 🎭 Proxy System
- **Message Proxying** - Send messages as different alters using customizable proxy tags
- **Multiple Proxy Tags** - Each alter can have multiple proxy formats (prefix, suffix, or both)
- **Autoproxy Modes**:
  - `front` - Automatically proxy as whoever is currently fronting
  - `latch` - Proxy as the last manually-used alter
  - `<name>` - Always proxy as a specific alter
- **Discord Avatars** - Separate avatars for Discord proxying vs. the webapp

#### 🔄 Front Tracking
- **Switch Logging** - Record who's fronting with timestamps
- **Multiple Layers** - Support for co-fronting with separate front layers
- **Status & Battery** - Track current status message and social battery level
- **Shift History** - Full history of all switches with duration tracking
- **Quick Switch** - Fast switching via Discord commands or webapp

#### 📝 Notes System
- **Personal Notes** - Create and organize notes with tags
- **Collaborative Sharing** - Share notes with read or read/write access
- **Auto-linking** - Notes automatically link to whoever was fronting when created
- **Unlimited Storage** - Content stored in Cloudflare R2 for unlimited length
- **Quick Notes** - Fast note creation from Discord

#### 👫 Friends System
- **View Friends' Fronts** - See who's fronting in your friends' systems
- **Privacy Controls** - Control what information friends can see
- **Custom Names** - Set nicknames for friends' systems

#### 📥 Import/Export
- **PluralKit Import** - Full import from PluralKit (API or JSON)
- **Tupperbox Import** - Import from Tupperbox exports
- **Simply Plural Import** - Import from Simply Plural (API)
- **Merge Mode** - Import without overwriting existing data
- **Dual Avatar Support** - Import app avatars and Discord avatars separately

#### ⚙️ Server Configuration
- **Channel Restrictions** - Enable/disable proxying per channel
- **Proxy Logging** - Log proxy events to a designated channel
- **Admin Roles** - Designate server admins for Systemiser
- **Blacklist** - Disable proxying for specific users

### 🖥️ Commands

#### Slash Commands
| Command | Description |
|---------|-------------|
| `/system` | Manage your system (view, edit, settings) |
| `/alter` | Manage alters (create, edit, delete, list) |
| `/state` | Manage states (create, edit, delete, list) |
| `/group` | Manage groups (create, edit, members) |
| `/switch` | Manage front switching and layers |
| `/note` | Create and manage notes |
| `/message` | Edit, delete, or reproxy messages |
| `/quickswitch` | Fast front switching with menu |
| `/quicknote` | Fast note creation and appending |

#### Prefix Commands (`sys!` or `sys;`)
```
sys!system       - Manage your system
sys!alter / a    - Manage alters  
sys!state / st   - Manage states
sys!group / g    - Manage groups
sys!switch / sw  - Register switches
sys!autoproxy / ap - Configure autoproxy
sys!edit / e     - Edit proxied messages
sys!reproxy / rp - Change message sender
sys!whois        - Look up proxy message sender
sys!import       - Import from other bots
sys!convert      - Convert alters ↔ states
sys!config       - Server configuration
sys!help         - Show help
```

### 🌐 Web Application

Systemiser includes a full web application at `systemise.teamcalendula.net` featuring:

- **Dashboard** - Overview of your system
- **Entity Management** - Full CRUD for alters, states, and groups
- **Front Tracking** - Visual front management with history
- **Notes** - Rich note editing and organization
- **Friends** - View friends' systems and fronts
- **Discord OAuth** - Secure login with Discord

### 🗄️ Database Schema

Systemiser uses MongoDB with the following main collections:

- `users` - Discord user accounts and settings
- `systems` - System profiles and configuration
- `alters` - Alter profiles and data
- `states` - State profiles and data
- `groups` - Group definitions and members
- `fronts/shifts` - Front history and shift records
- `notes` - Note content and sharing
- `messages` - Proxy message tracking
- `guilds` - Server-specific configuration

## 🔐 Privacy & Security

- All data is stored securely in MongoDB Atlas
- Discord OAuth2 for authentication
- JWT tokens for API authorization
- Privacy controls for system visibility
- No data is shared without explicit permission

---

## 📜 License

This project is doesn't have a license yet...

---
