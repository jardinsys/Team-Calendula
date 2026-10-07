# Import Mapping — Detailed View

Complete field-by-field mapping for all four import sources.  
**Bold** = implemented in this round. *Italic* = was already present.

---

## PluralKit

### System
| PK Field | Systemiser Target | Type | Notes |
|---|---|---|---|
| `name` | `system.name.indexable` / `system.name.display` | String | Cleaned for indexable |
| `avatar_url` | `system.avatar` or `system.discord.image.avatar` | mediaSchema | R2 synced |
| `description` | `system.description` | String | |
| `color` | `system.color` or `system.discord.color` | String | Prefixed `#` |
| `pronouns` | `user.pronouns[]` | String[] | Only if `applyPronouns` option |
| `banner_url` | `system.banner` or `system.discord.image.banner` | mediaSchema | **R2 synced** |
| `tag` | `system.discord.tag.normal[]` | String[] | Discord target only |
| `webhook_url` | — | — | Not imported |
| `proxy_settings` | — | — | Not imported |
| `member_limit` | — | — | Not imported |

### Members (Alters/States)
| PK Field | Systemiser Target | Type | Notes |
|---|---|---|---|
| `name` | `name.indexable` | String | Cleaned, 32 char max |
| `display_name` | `name.display` | String | |
| `description` | `description` | String | |
| `pronouns` | `pronouns[]` | String[] | Wrapped in array |
| `color` | `color` | String | Prefixed `#` |
| `birthday` | `birthday` | Date | Parsed |
| `avatar_url` | `avatar` or `discord.image.avatar` | mediaSchema | **R2 synced** |
| `banner_url` | `banner` or `discord.image.banner` | mediaSchema | **R2 synced, new** |
| `proxy_tags` | `proxy[]` | String[] | Converted to `prefix text suffix` |
| `visibility` | preview metadata | — | Shown in preview |
| `id` | `metadata.pluralKitId` | String | Used for dedup |
| `uuid` | `metadata.pluralKitUuid` | String | Used for dedup |
| `created` | `metadata.addedAt` | Date | |
| `deleted` | — | — | Filtered (not imported) |
| `last_message_timestamp` | — | — | Not in PK export |
| `message_count` | — | — | Not in PK export |
| `position` | — | — | Not imported |
| `keep_display_name` | — | — | Not imported |
| `prefix` / `suffix` | — | — | Covered by `proxy_tags` |

### Groups
| PK Field | Systemiser Target | Type | Notes |
|---|---|---|---|
| `name` | `name.indexable` / `name.display` | String | |
| `display_name` | `name.display` | String | |
| `description` | `description` | String | |
| `color` | `color` | String | Prefixed `#` |
| `icon` | `avatar` or `discord.image.avatar` | mediaSchema | R2 synced |
| `banner_url` | `banner` | mediaSchema | **R2 synced, new** |
| `members` | group membership | — | Linked via `groupMembershipMap` |
| `id` | `metadata.pluralKitId` | String | |
| `uuid` | `metadata.pluralKitUuid` | String | |
| `visibility` | preview metadata | — | |
| `description_short` | — | — | Not imported |

### Switches
| PK Field | Systemiser Target | Type | Notes |
|---|---|---|---|
| `members[]` | shift `s_type`, `ID`, `type_name` | — | Mapped via `memberIdMap` |
| `timestamp` | shift `startTime` | Date | |
| `duration` | shift `endTime` | Date | Computed from next switch |
| `id` | — | — | Regenerated |

---

## SimplyPlural

### System (via API)
| SP Field | Systemiser Target | Type | Notes |
|---|---|---|---|
| (no system endpoint) | — | — | SP API doesn't expose system info |

### Members (Alters/States) — API Import
| SP Field | Systemiser Target | Type | Notes |
|---|---|---|---|
| `name` | `name.indexable` / `name.display` | String | |
| `desc` | `description` | String | |
| `avatarUrl` | `avatar` or `discord.image.avatar` | mediaSchema | R2 synced |
| `bannerUrl` | `banner` | mediaSchema | **R2 synced, new** |
| `color` | `color` | String | |
| `pronouns` | `pronouns[]` | String[] | |
| `uid` | `metadata.simplyPluralId` | String | Primary ID |
| `pkId` | `metadata.pluralKitId` | String | Cross-reference |
| `archived` | — | — | Filtered (skipped) |
| `createdAt` | `metadata.addedAt` | Date | |
| `private` | privacy bucket "Private" | — | **New: assigns to Private bucket** |
| `id` | `metadata.simplyPluralId` | String | Fallback if uid missing |

### Members (Alters/States) — File Import (NEW)
| SP Export Field | Systemiser Target | Type | Notes |
|---|---|---|---|
| `name` | `name.indexable` / `name.display` | String | |
| `desc` | `description` | String | |
| `avatarUrl` | `avatar` | mediaSchema | R2 synced |
| `bannerUrl` | `banner` | mediaSchema | R2 synced |
| `color` | `color` | String | |
| `pronouns` | `pronouns[]` | String[] | |
| `uid` | `metadata.simplyPluralId` | String | |
| `pkId` | `metadata.pluralKitId` | String | |
| `archived` | — | — | Filtered |
| `private` | privacy bucket "Private" | — | Creates bucket if needed |
| `createdAt` | `metadata.addedAt` | Date | |
| `customFields[Age]` | `age` | String | **Extracted from customFields** |
| `customFields[others]` | `metadata.customFields[]` | Array | **Stored as metadata** |

### Groups — API + File Import
| SP Field | Systemiser Target | Type | Notes |
|---|---|---|---|
| `name` | `name.indexable` / `name.display` | String | |
| `desc` | `description` | String | |
| `color` | `color` | String | |
| `uid` | `metadata.simplyPluralId` | String | |
| `members` | group membership | — | Linked via `groupMembershipMap` |
| `icon` | `avatar` | mediaSchema | **R2 synced, new** |
| `bannerUrl` | `banner` | mediaSchema | **R2 synced, new** |
| `createdAt` | `metadata.addedAt` | Date | |

### Switch History — File Import Only (NEW)
| SP Export Field | Systemiser Target | Type | Notes |
|---|---|---|---|
| `member` | shift `ID`, `s_type`, `type_name` | — | Mapped via `memberIdMap` |
| `startTime` | shift `startTime` | Date | |
| `endTime` | shift `endTime` | Date | |
| `live` | — | — | If true, no endTime (still fronting) |

### Privacy Buckets — File Import (NEW)
| SP Setting | Systemiser Target | Type | Notes |
|---|---|---|---|
| `private: true` | entity assigned to "Private" PrivacyBucket | — | Bucket auto-created if missing |
| `buckets[]` | — | — | Future: map SP buckets to Systemiser buckets |

---

## Octocon

### System
| Octocon Field | Systemiser Target | Type | Notes |
|---|---|---|---|
| `username` | `system.name.indexable` / `system.name.display` | String | |
| `description` | `system.description` | String | |
| `avatar_url` | `system.avatar` or `system.discord.image.avatar` | mediaSchema | R2 synced |
| `bannerUrl` | `system.banner` or `system.discord.image.banner` | mediaSchema | R2 synced |
| `color` | `system.color` | String | **New** |
| `fields[Pronouns]` | `user.pronouns[]` | String[] | Only if `applyPronouns` |
| `created_at` | — | — | Not imported |

### Alters
| Octocon Field | Systemiser Target | Type | Notes |
|---|---|---|---|
| `name` | `name.indexable` / `name.display` | String | |
| `description` | `description` | String | |
| `pronouns` | `pronouns[]` | String[] | |
| `color` | `color` | String | |
| `avatar_url` | `avatar` or `discord.image.avatar` | mediaSchema | R2 synced |
| `banner_url` | `banner` or `discord.image.banner` | mediaSchema | **R2 synced, new** |
| `discord_proxies` | `proxy[]` | String[] | Direct format match |
| `id` | `metadata.octoconId` | String | Used for dedup |
| `visible` | preview metadata | — | `false` → "private" visibility |
| `created_at` | `metadata.addedAt` | Date | |

### Tags (Groups)
| Octocon Field | Systemiser Target | Type | Notes |
|---|---|---|---|
| `name` | `name.indexable` / `name.display` | String | |
| `description` | `description` | String | |
| `color` | `color` | String | |
| `icon` | `avatar` | mediaSchema | **R2 synced, new** |
| `banner_url` | `banner` | mediaSchema | **R2 synced, new** |
| `alters[]` | group membership | — | Linked via `groupMembershipMap` |
| `id` | `metadata.octoconTagId` | String | |
| `visible` | preview metadata | — | |

### Front History
| Octocon Field | Systemiser Target | Type | Notes |
|---|---|---|---|
| `alter_id` | shift `ID`, `s_type`, `type_name` | — | Mapped via `alterIdMap` |
| `time_start` | shift `startTime` | Date | |
| `time_end` | shift `endTime` | Date | |
| `tag_id` | — | — | Not imported |

---

## Tupperbox (File Only)

### Tuppers
| TB Field | Systemiser Target | Type | Notes |
|---|---|---|---|
| `name` | `name.indexable` | String | Used as source ID |
| `nick` | `name.aliases[]` | ✅ |
| `description` | `description` | String | |
| `avatar_url` | `avatar` or `discord.image.avatar` | mediaSchema | R2 synced |
| `proxy` (brackets) | `proxy[]` | String[] | Converted from `[prefix, suffix]` |
| `color` | `color` | String | |
| `group_id` | group membership | — | Linked via `groupIdMap` |
| `tag` | `signoff` | String | |
| `created` | `metadata.addedAt` | Date | |
| `updated` | — | — | Not imported |
| `cfriend` | — | — | Not imported |
| `desc` (legacy) | — | — | Not imported |
| `avatar` (legacy) | — | — | Not imported |

### Groups
| TB Field | Systemiser Target | Type | Notes |
|---|---|---|---|
| `name` | `name.indexable` / `name.display` | String | |
| `color` | `color` | String | **New on create** |
| `description` | `description` | String | **New on create** |
| `icon` | `avatar` | mediaSchema | **R2 synced, new** |
| `members[]` | group membership | — | Linked via `groupIdMap` |
| `tag` | `signoff` | String | |

### Front/Switches
| Available | Systemiser Target | Notes |
|---|---|---|
| None | — | Tupperbox has no switch tracking |

---

## Files Modified

| File | Changes |
|---|---|
| `import_pluralkit.js` | Banner on groups (create/update), members (create/update, app+discord modes), preview |
| `import_simplyplural.js` | Banner on members (create/update), groups (create), preview |
| `import_simplyplural_file.js` | **NEW** — Full file parser with switch history, privacy buckets, custom fields, metadata |
| `import_octocon.js` | System color, banner on members (create/update, app+discord modes), groups (icon+banner), preview |
| `import_tupperbox.js` | Group color/description/icon on create, description/color on update |
| `import_functions.js` | Added `spFile` barrel export |
