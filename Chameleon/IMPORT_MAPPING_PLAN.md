# Import System — Schema & Mapping Plan

## Completed
- ✅ `banner: mediaSchema` added to entity base schema (alter/state/group)
- ✅ `age: String` added to entity base schema
- ✅ `banner: mediaSchema` added to system schema
- ✅ Dead `systemInfo` code removed from preview functions
- ✅ `createSystemFromPayload` handles dryRun entity IDs
- ✅ **PK banner import** — system, members (app+discord), groups (create/update/preview)
- ✅ **Octocon banner import** — system, members (app+discord), groups (create/update/preview)
- ✅ **Octocon system color** — mapped to `system.color`
- ✅ **Octocon group icon** — mapped to `entity.avatar`
- ✅ **SP banner import** — members (create/update), groups (create), preview
- ✅ **SP group icon** — mapped to `entity.avatar`
- ✅ **SP file parser** (`import_simplyplural_file.js`) — switch history, privacy buckets, custom fields (age), metadata IDs
- ✅ **TB group color/description** — mapped on create + update
- ✅ **TB group icon** — mapped to `entity.avatar`
- ✅ `IMPORT_MAPPING_DETAIL.md` — comprehensive field-by-field mapping doc

---

## Phase 1: Importer Field Updates (Quick Wins) — ✅ DONE

### 1a. PluralKit — Add `banner` import ✅
| Source Field | Target | Notes |
|---|---|---|
| `pkMember.banner_url` | `entity.banner.url` | ✅ Added to create/update (app+discord) |
| `pkGroup.banner_url` | `entity.banner.url` | ✅ Added to create/update/preview |
| `pkSystem.banner_url` | `system.banner.url` | ✅ Was already present |

**Files:** `import_pluralkit.js` — `createAlterFromPK`, `createStateFromPK`, `createGroupFromPK`, preview functions

### 1b. SimplyPlural — Add `age` from custom fields + `banner` ✅
| Source Field | Target | Notes |
|---|---|---|
| SP `customFields["Age"]` | `entity.age` | ✅ Extracted in file parser |
| SP `avatarUuid` (from zip) | `entity.avatar.url` | Already handled |
| SP `banner` (if exists) | `entity.banner.url` | ✅ Added to API + file import |

**Files:** `import_simplyplural.js` — ✅ Done; `import_simplyplural_file.js` — ✅ Created

### 1c. Octocon — Add `banner` import ✅
| Source Field | Target | Notes |
|---|---|---|
| `octoAlter.banner_url` | `entity.banner.url` | ✅ Added to create/update (app+discord) |
| `systemData.banner_url` | `system.banner.url` | ✅ Was already present |

**Files:** `import_octocon.js` — ✅ Done

### 1d. Tupperbox — Add `banner` (if available) + group fields ✅
| Source Field | Target | Notes |
|---|---|---|
| `tupper.banner_url` | `entity.banner.url` | TB export doesn't include banners |
| `tbGroup.color` | `group.color` | ✅ Added to create/update |
| `tbGroup.description` | `group.description` | ✅ Added to create/update |
| `tbGroup.icon` | `group.avatar` | ✅ Added to create |

**Files:** `import_tupperbox.js` — ✅ Done

---

## Phase 2: SP Export Parser (API is down) — ✅ DONE

Since SP API is unreliable, add file-based import for SP exports:
- ✅ Parse `export_*.json` (members, groups, switchHistory, customFields)
- ✅ Map `customFields` → `entity.age` (known) + `metadata.customFields[]` (rest)
- ✅ Map `switchHistory` → shifts
- ✅ Map `private: true` entities → "Private" privacy bucket (auto-created)

**Note:** Avatars from ZIP are referenced by URL if available in the export; ZIP extraction is a future enhancement.

**Files created:** `import_simplyplural_file.js` ✅
**Files modified:** `import_functions.js` (barrel export) ✅

---

## Phase 3: Switch/Front History Mapping

### PK Switches
| PK Field | Systemiser Field | Notes |
|---|---|---|
| `members[]` | `shift.layerId` / fronters | Map member IDs to entity IDs |
| `timestamp` | `shift.timestamp` | Already done |
| `duration` | shift duration | Already done |

### SP Switch History (from export)
| SP Field | Systemiser Field | Notes |
|---|---|---|
| `member` (ID) | shift fronters | Map SP member ID to entity ID |
| `startTime` | `shift.timestamp` | |
| `endTime` | shift end time | |
| `live` | current front | If true, still fronting |

### Octocon Front History
| Octocon Field | Systemiser Field | Notes |
|---|---|---|
| `alter_id` | shift fronters | Already done |
| `time_start` | `shift.timestamp` | Already done |
| `time_end` | shift end time | Already done |

---

## Phase 4: Privacy Bucket Import

SP has `private: true` on members/groups and `buckets[]` arrays.
- Create a "Private" PrivacyBucket during import
- Assign entities with `private: true` to it
- Map SP `buckets[]` to Systemiser privacy buckets

**Files:** `import_simplyplural.js`, `helpers.js` (new `assignPrivateBuckets`)

---

## Phase 5: Custom Fields / Metadata

SP export has `customFields[]` with Age, System Role, Likes, Dislikes, etc.
Options:
1. Store as `metadata.customFields[{ name, value }]` on entities
2. Map known fields (Age → `entity.age`) and store rest as metadata
3. Create a new `customFields` sub-schema

**Recommended:** Option 2 — map known fields, store rest as metadata.

---

## Phase 6: Import Mode → Field Mapping Matrix

| Field | Simple | Intermediate | Advanced |
|---|---|---|---|
| Name | ✅ | ✅ | ✅ |
| Description | ✅ | ✅ | ✅ |
| Avatar | ✅ | ✅ | ✅ |
| Banner | ❌ | ✅ | ✅ |
| Color | ✅ | ✅ | ✅ |
| Pronouns | ✅ | ✅ | ✅ |
| Birthday | ✅ | ✅ | ✅ |
| Age | ❌ | ✅ | ✅ |
| Proxy tags | ✅ | ✅ | ✅ |
| Groups | ✅ (auto) | ✅ (select target) | ✅ (per-group) |
| Switch history | ✅ | ✅ | ✅ (toggle) |
| Privacy buckets | ❌ | ❌ | ✅ |
| Custom fields | ❌ | ❌ | ✅ |
| Entity type (alter/state) | auto-detect | auto-detect | per-entity select |

---

## Phase 7: Preview Enhancements

The preview should show:
- Entity count with type breakdown (alters vs states)
- Group count
- Switch history count
- Banner availability indicator
- Age availability indicator
- Privacy bucket assignments

---

## Open Questions

1. **SP `customFields` mapping** — Should we map all known fields (Age, System Role, etc.) or just Age?
2. **SP `switchHistory` format** — The export has `member` as a MongoDB ObjectId string. Need to map to our entity IDs.
3. **Banner upload** — Should banners go through R2 like avatars, or stay as external URLs?
4. **Age field type** — String (flexible) or Number (strict)? SP uses text, so String is safer.
5. **Privacy bucket creation** — Auto-create "Private" bucket during import, or let user configure?
