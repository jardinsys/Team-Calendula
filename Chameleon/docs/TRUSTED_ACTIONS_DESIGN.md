# Trusted Actions — Design Document

> Companion to `FEATURES_TO_CONSIDER.md`. Covers delegated friend permissions
> ("trusted actions"), the multi-bucket permission hierarchy, and the resolver
> that unifies them. Kept separate so the privacy/trust models can evolve
> without churning the feature tracker.

Status: DESIGN — not implemented.

---

## 1. Purpose

Friends today are viewers only. The core need: a trusted friend who sees
someone dissociating should be able to act for them — mark dissociation,
do switches, manage entities — with explicit, revocable, per-friend grants.

## 2. Core decisions (locked)

| Decision | Choice |
|---|---|
| Trust vs privacy | **Separate but connected.** Privacy buckets = what friends *see*. Trust = what friends *can do*. Never coupled implicitly. |
| Trust representation | **Levels (0–3), not booleans.** Stored as a level; documented below. |
| Bucket semantics | Buckets are **friend groups with settings presets** (visibility today, trust levels). Per-friend **customs override** the bucket. |
| Membership | A friend may exist in **multiple buckets**. Conflicts resolve **most-restrictive-wins**. Customs beat buckets; buckets beat defaults. |
| Deletion | Entity/group **delete stays owner-only** at every trust level. |
| Trust storage | Trust lives on the **trusting side's** User doc (`friends[]` entry). Revocation is a single self-document `$set` — instant, no cross-account writes. |
| Self-visibility | A friend can **see their own** effective trust level toward a system (transparency; no secret permission ladders). — `GET /api/friends/permissions?systemID=` returns the viewer's own resolved level only. |
| Read gating | Trust grants **no new reads**. Reads stay governed by privacy-bucket visibility. Exception decided later per-case (e.g. dissociation banner). |
| Attribution | Actions performed by a friend on another system record `performedBy` (their friendID) — "who acted" is part of "what happened". |

## 3. Trust levels

| Level | Name | Grants |
|---|---|---|
| 0 | None | Current behavior (view only, via privacy buckets) |
| 1 | Flag | Mark system dissociated / clear the flag |
| 2 | Front | Do live switches on the target system (front editing) |
| 3 | Manage | Add/edit alters, states, groups on the target system (create + field edits; **not** delete) |

Escalation is monotone: each level implies all lower levels. L2 history
*editing* (retroactive ShiftEditModal) is **owner-only** for now — editing a
dissociating person's history is the trap case; revisit later if a real need
appears.

Preset UX note: the UI may present presets ("Trusted — flag+front") that fill
a level, but storage is the level number only.

## 4. Bucket hierarchy

```
PrivacyBucket (becomes general friend-group bucket) {
  name: String
  friends: [ { friendID, discordUserID, discordGuildID } ]   // existing, multi-membership OK
  trustLevel: { type: Number, min: 0, max: 3, default: 0 }   // NEW — capability default for members
  // visibility templates per entity type — existing behavior unchanged
}

User.friends[] (each entry) {
  ...existing fields (friendID, customName, discordID, addedAt, privacyBucket, notifyOnSwitch)
  trustOverride: { type: Number, min: 0, max: 3, default: null }   // NEW — beats bucket when set
}
```

- `privacyBucket` on a friend entry remains the **auto-assign target** on
  request-accept (`friendAutoBucket`); it is a convenience, not a constraint.
- Multi-bucket: a friendID may appear in several `PrivacyBucket.friends[]`.
- **Resolution order:**
  1. explicit `trustOverride` on the friend entry (wins if non-null)
  2. across all member buckets: `min(trustLevel)` (most restrictive wins)
  3. default L0
- Same rule pattern applies to visibility merging across buckets once
  multi-bucket visibility is wired (per-field, most restrictive wins).

## 5. Dissociation flag

Field-first (A), shift-record migration later (B):

```js
// System schema, NEW
dissociated: {
  active: { type: Boolean, default: false },
  since: Date,
  markedBy: String,   // friendID of the actor (or null if owner)
}
```

- Visible as a banner on SystemPage when active; low-noise for the owner.
- Phase 2: when a L1+ friend marks it, DM the system owner (gentle tone) if
  `settings.notificationPreferences` allows — *decide default before build*.
- Later (B): also log as Shift records so FrontHistoryPage shows
  chronological dissociation events.

## 6. Exposure surface — what gets edited

### 6.1 Schemas (Chameleon/schemas/)

| File | Change |
|---|---|
| `user.js` | add `trustOverride: Number\|null` to `friends[]` |
| `settings.js` | add `trustLevel: Number(0–3, default 0)` to `privacyBucketSchema`; export `resolveTrustLevel()` helper (see 6.2) |
| `system.js` | add `dissociated` subdoc (field A) |
| `front.js` | (phase 2) `performedBy: String` on shiftSchema for delegated switches |

Migration: none required — new fields are additive with safe defaults.
Existing systems behave exactly as before (no override → bucket level → L0;
buckets without `trustLevel` resolve to L0).

### 6.2 Backend API (Chameleon/api/)

| File | Change |
|---|---|
| `middleware/auth.js` (or new `utils/trust.js`) | **`resolveTrustLevel(ownerUser, friendID)`** — the single load-bearing resolver: explicit override → min() across member buckets → 0. One code path only; no per-route ad-hoc resolution. |
| `utils/trust.js` (new, shared) | Also: `requireTrust(level)` route guard factory; returns 403 with `insufficientTrust` on failure. Used by Discord-side mutations via its own wrapper too. |
| `routes/friends.js` | `GET  /friends/permissions?systemID=` — viewer's own resolved level toward that system. `PUT  /friends/:friendID/trust` — set `trustOverride` (owner only; operates on own User doc). |
| `routes/front.js` | Switch/edit writes: when JWT user ≠ target system owner, gate at L2 via `requireTrust`. Set `performedBy` on created shifts. |
| `routes/alters.js`, `routes/states.js`, `routes/groups.js` | Create/edit writes: friend path gated at L3; **delete stays owner-only, no delegated path**. Set `performedBy`-style attribution where entities have history. |
| `routes/system.js` | `POST /api/system/dissociate`, `DELETE /api/system/dissociate` — gated at L1 (owner bypass). Writes `dissociated` + `markedBy`. |
| `api.js` | Mount the new routes/util exports. |

Failure direction: any resolution error resolves to **L0** (fail closed).

### 6.3 Discord side (Chameleon/discord_commands/)

| File | Change |
|---|---|
| `slash/friend.js` | New subcommands/branch: `trust set @user <0–3>`, `trust view @user`, `trust view` (own level toward that system? no — owner only here). Runs on own User doc. |
| `prefix/friend.js` | Match: `sys!friend trust <indexable> <0–3>` |
| `slash/front.js` | Delegate-switch path: when acting user ≠ system owner, check resolved level ≥ 2 before building the switch session; tag shifts with `performedBy`. |
| `slash/alter.js` / `state.js` / `group.js` | Same delegation guard at L3 (create/edit only). |
| `slash/system.js` (or new) | `sys!system dissociate on|off` — owner or L1 friend. |
| `functions/switchNotifications.js` | When a shift has `performedBy` (a friend), notification copy says "switched by <friend>" — attribution surfaces where it matters. |

Discord commands act on behalf of the *invoking user*; the guard resolves the
invoking user's User doc → their `friends[]` entry on the target owner's side.

### 6.4 Embedded app + webapp (shared UI)

| File | Change |
|---|---|
| `shared/api/client.js` | `getMyPermissions(systemID)`, `setFriendTrust(friendID, level)`, `markDissociated(on)` — thin wrappers. |
| `shared/api/queryKeys.js` | Add `friends:trust` / `permissions` keys; wire WebSocket invalidation (`front:switch` already exists). |
| `shared/components/FriendDetailModal.jsx` | New "Trust" section: level picker with presets; shows resolved value + override state ("overrides Friends bucket"). |
| `shared/components/FrontDisplay.jsx` | Dissociation banner when `system.dissociated.active` (phase 2). |
| `activity/src/app/pages/SwitchPage.jsx` | Hide/disable the switch action client-side when viewer's level < 2 toward the target system (server still enforces — UI is convenience only). |
| `activity/src/app/pages/SystemPage.jsx` | Dissociation banner + "clear" for owner/L1. |
| `webapp` (server-rendered views) | Same components via `@chameleon/shared` — free once shared components update. |

### 6.5 Out of scope (explicitly)

- Per-bucket trust override *per entity* (entity-level trust rows) — buckets
  suffice; entity-level visibility rows stay visibility-only.
- Delegated delete — never by default.
- Note sharing via trust (separate mechanism later if needed — trust does not
  punch through privacy for reads).

## 7. Rollout phases

1. **Phase 1 — schema + resolver + endpoints.** `trustOverride`,
   `trustLevel` on buckets, `dissociated` field, `resolveTrustLevel()`,
   `/friends/permissions`, `/friends/:id/trust`, dissociate routes. Unit tests
   for the resolver (multi-bucket conflict, override, fallback) **before** any
   guard ships on top of it.
2. **Phase 2 — Discord + UI writes.** `/friend trust` (slash+prefix),
   delegate-guard on front/entity writes, `performedBy` on shifts,
   FriendDetailModal trust editor, SwitchPage gating,
   owner-notification on dissociation (decide default now).
3. **Phase 3 — flag UX.** Dissociation banner (FrontDisplay/SystemPage),
   `dissociate` slash command, switch-notification copy updates.
4. **Later.** Shift-record migration (B), per-bucket presets polish,
   multi-bucket *visibility* merge (currently only trust uses multi-bucket).

## 9. Compatibility constraints (from existing bucket call sites)

- **`getPrivacyBucket()` keeps its contract.** All ~10 call sites (Discord +
  API) do `getPrivacyBucket(...)` → `shouldShowEntity(entity, bucket)`. It
  will resolve multi-bucket membership + per-friend customs internally and
  return a **synthetic bucket doc in the old shape**. Callers unchanged.
- **Resolver consolidation first.** Three copies exist: `bot_utils/privacy.js`
  (canonical path, partially split out), a local `getPrivacyBucket` inside
  `api/routes/public.js`, and legacy `original_bot_utils.js` (unused; leave
  as-is). `public.js` and `bot_utils/privacy.js` must both use one shared
  module **before** merge logic is layered in — otherwise public paths
  silently apply old single-bucket rules (leak-shaped bug).
- **Most-restrictive merge changes membership semantics.** Adding a friend to
  a second bucket can only *shrink* what they see. Not a bug — the chosen
  rule — but the friend-detail resolved preview (showing why a field is
  hidden) becomes required UI, not a nicety.
- **Field-by-field merge spec (concrete):**
  - Boolean visibility fields — AND across member buckets (all must grant):
    alter/group tier: mask, description, banner, avatar, birthday, pronouns,
    metadata, hidden, proxies, caution, allowPing, aliases.all.
    System tier adds: list, front.
  - `aliases.allowed` (list field): union — the one deliberate exception
    (ANDing a list yields empty-and-useless; permission-list semantics).
  - `pendingReview` entities: outside bucket merging entirely
    (owner + adder only — see §10.1).
  - trust level: min() across buckets, per-friend override beats all.
- **Fail-closed flip.** `getBucketTemplate()` currently falls back to the
  *Friends* (permissive) template for unknown bucket names. Flip to
  Strangers/fail-closed in the same change; `switchNotifications.js` filters
  switch DMs through this path and is leak-sensitive.
- **Trust never merges with visibility.** Delegated-action flows run the
  trust check first, then render via the normal bucket path. No combined
  check anywhere.

## 10. Entity lifecycle: temporary flag, dormancy, deletion

Problems driving this: (a) DELETE currently hard-destroys every Shift
referencing the entity (`api/routes/alters.js` ~L323–337) — front history is
silently lost today; (b) L3 delegation should not permanently write to
someone else's system without owner consent.

Final model (user decision): **temporary is a boolean, dormancy stays a
free-text condition value, deletion stays hard.** No enum, no tombstones —
the codebase already uses booleans for hide-style flags
(`entityPrivacy.settings.hidden`) and `condition = 'dormant'` already exists
as convention.

### 10.1 Temporary (friend-added, pending review)

```js
// entityBase.js entityFields() gains:
pendingReview: { type: Boolean, default: false },
addedBy: String,   // friendID — only meaningful while pending
```

Human name: **temporary**. Owner-facing label "⏳ Pending review"; friend-side
label "⏳ Awaiting review". Code reads only the boolean.

Behavior:

- L3 creates set `pendingReview: true, addedBy: <friendID>`. Entity is fully
  functional in the creating friend's session (frontable), but **hidden from
  other viewers' lists** — `shouldShowEntity()` gains one line:
  `if (entity.pendingReview && !isOwner && !addedByViewer) return false;`
- Owner sees everything as before (`if (isOwner) return true` early-return
  already covers them) — review happens via the **notification page**, a
  top-level queue in embedded app + webapp: "⏳ 2 entities pending — Alter 'X'
  (added by <friend>), State 'Y' (added by <friend> A)" with keep/remove
  actions per row. Same queue also lists guest shifts (§10.3) and
  dissociation marks.
- **Keep** = `pendingReview: false` (entity becomes normal).
  **Remove** = normal delete (§10.3) — or set `condition: 'dormant'` if the
  owner prefers keeping it archived-but-hidden.
- Revoking trust never leaves orphaned permanent entities: un-reviewed
  temporaries stay invisible and removable at any time.
- `condition` remains free text for personal labels ("focused", etc.);
  `dormant` stays its only code-recognized convention.

### 10.2 Dormancy (unchanged mechanism, formalized)

- Remains `entity.condition = 'dormant'` (owner-set free-text value).
- Formalization when Phase 1 lands: dormant entities **close their active
  shift** (`endTime = now`), are excluded from lists/search/front selection,
  and fully restorable by clearing the condition. Shifts keep resolving —
  the doc never moves, history intact.
- Only the dormancy command/state-transition code should write `'dormant'`;
  a stray general `condition` edit must not silently un-dormant an entity
  (guard in the shared condition-edit path).

### 10.3 Deletion (hard, for accidental/declined entries)

DELETE keeps destroying the document — accidental garbage should not exist.
The one required fix: instead of destroying Shifts along with it (current
behavior), affected shifts keep their record with `type_name` replaced by
`"[deleted]"` (phase 2: `performedBy` remains). Entity gone; the front
timeline survives as "something was here."

### 10.4 Unregistered front entries (`guest` shifts)

```js
// shiftSchema gains:
guest: { name: String, createdBy: String },   // ID may be null on guest shifts
```

- L2 friends may log a front shift with no existing entity — records "who's
  nominally fronting" without creating an alter. Covers the dissociation
  moment when the fronting entity isn't in the system yet.
- Owner review: guest shifts with `ID: null` appear in the notification-page
  queue ("guest front by <friend>: 'X'") → one-click convert into a real
  alter (pre-filled create form) or leave as history.

## 11. Decisions log (review-passed refinements)

- **Deletion warning (blocking).** Hard delete, shifts deleted WITH the
  entity — per user decision. Safety moves to the pre-delete confirmation:
  explicit two-step ("all front history with this entity will be lost —
  consider dormancy instead") on both Discord confirm and app. No undo.
- **Unknown-bucket fallback:** resolve across the friend's OTHER bucket
  memberships (most-restrictive merge); only if NO bucket → Strangers.
  (Fail-closed; ordering-independent.)
- **Owner visibility:** pending/temporary entities never change what
  non-owners see; owners keep full visibility (`isOwner` early-return) —
  review happens through the notification queue, not visibility filters.
- **Vocabulary split (final):** the code-reserved condition set is closed at
  TWO values — `dormant` and `active` — both explained/available at
  registration (existing systems via the bucket-seeding migration path).
  Everything else ("co-conscious", "focused", regression, etc.) is
  self-applied, display-only free text, and belongs under the *status*
  umbrella (`setting.default_status` / shift `statuses[]`), not `condition`.
  `condition` = lifecycle only; self-expression = status; future
  machine-readable state = its own boolean (like `pendingReview`), never a
  new reserved string. Resolves the §12 free-string TODO.
- **Delegated switch sessions.** Sessions carry `actingFriendID` +
  `targetSystemID`; owner can LIST open delegated sessions on their system
  and FORCE-STOP one (kill session + optional notify "ended by owner").
  Revocation story: drop trust → open session continues until owner stops it
  or it commits (documented window); plus one-line resolveTrustLevel
  re-check at commit (belt-and-suspenders).
- **Canonical identity:** trust keys on `friendID` ONLY; `discordID` is a
  lookup alias on the Discord surface. Schema already supports future
  non-Discord users (`connection.email/google/apple`).
- **Self-trust:** friend is never auto-added to own `friends[]`; resolver
  tests include a self-friendID collision case.
- **Notification/queue backend:** single `GET /api/review-queue` endpoint
  (pending entities + guest shifts + dissociation marks, queried explicitly
  by `pendingReview: true` etc. — NOT via visibility tricks). Frontend
  prototype deferred; endpoint spec is the Phase-1 contract.
- **Copy/aesthetics** ("switched by X" DM wording etc.): deferred; logic
  first. Noted so it isn't lost.

## 12. Open questions (still open)

- Owner DM on dissociation-mark default/tone/notification pref.
- L1 clearing others' flags: owner + setter only (lean) — confirm.
- Notification-page UX: awaiting front-end prototype from user.
- Unknown-bucket fallback: §11 wording is the merge-across-other-memberships
  interpretation — CONFIRM on doc review (positional "next bucket" rejected:
  makes results depend on bucket creation order).

