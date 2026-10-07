# BUGS_FOUND.md - Testing Results

## Date: 2026-07-15
## Tester: Byte (API + browser UI testing)

---

## Phase 1: Registration

### BUG-001: `onboardingCompleted` not set after UI registration ✅ FIXED

**Severity:** Major | **Category:** Registration

**Steps:** Complete DID registration through UI → check `sys_type.onboardingCompleted` in database

**Expected:** `onboardingCompleted: true` | **Actual:** `onboardingCompleted: false`

**Root Cause:** `buildPayloadFromSession()` dropped `onboardingCompleted` and `dissociativeStateName`. | **Fix:** Added both fields to payload builder.

---

### BUG-002: Mock mode doesn't set API token ✅ FIXED

**Severity:** Critical | **Category:** Registration | Development

**Root Cause:** `useApiAuth` never called `api.setToken()` in mock mode. | **Fix:** Added `/api/auth/dev-token` endpoint.

---

### BUG-003: Mock user ID causes BigInt crash ✅ FIXED

**Severity:** Critical | **Category:** Registration | Development

**Root Cause:** `'mock-user-id'` fails `BigInt()` in avatar URL. | **Fix:** Changed to numeric `'1000000000000000001'`.

---

### BUG-004: Entity routes not mounted on activity server ✅ FIXED

**Severity:** Major | **Category:** Architecture

**Root Cause:** Only auth/system/import/notes routes were mounted. | **Fix:** Added alters, states, groups, front, friends, convert routes.

---

### BUG-005: Duplicate "← Back" buttons on registration pages ✅ FIXED

**Severity:** Minor | **Category:** UX

**Root Cause:** Each step component had its own Back button AND a fixed-position Back button. | **Fix:** Removed step-level Back buttons, kept fixed-position one for all steps.

---

### BUG-006: "Almost done!" heading misleading ✅ FIXED

**Severity:** Cosmetic | **Category:** UX

**Fix:** Changed to "Name your system".

---

### BUG-007: No progress indicator during registration

**Severity:** Minor | **Category:** UX | **Status:** Not fixed

**Steps:** Navigate through registration flow | **Expected:** Progress bar or step indicator | **Actual:** No indication of progress

---

### BUG-008: Test suite broken (pre-existing) ✅ FIXED

**Severity:** Critical | **Category:** Testing

**Root Causes:** (1) Dual jest config, (2) Node 25 localStorage, (3) Wrong require path, (4) Missing passport mock. | **Fix:** All resolved.

---

### BUG-009: Express 5 wildcard route syntax ✅ FIXED

**Severity:** Critical | **Category:** Architecture

**Root Cause:** `'/systemiser/*'` invalid in path-to-regexp. | **Fix:** Changed to `'/systemiser/{*any}'`.

---

### BUG-010: Alter names empty after registration ✅ FIXED

**Severity:** Major | **Category:** Registration

**Root Cause:** `buildPayloadFromSession` used `m.id` instead of `m.id || m._id`. | **Fix:** Used fallback and filtered temp IDs.

---

### BUG-011: Entity names sent as string not `{display, indexable}` ✅ FIXED

**Severity:** Major | **Category:** Registration

**Root Cause:** Payload fallback used `{ name: m.name }` instead of `{ name: { display, indexable } }`. | **Fix:** Corrected name format.

---

### BUG-012: `setMembers` race condition ✅ FIXED

**Severity:** Major | **Category:** Registration

**Root Cause:** `setMembers(members)` async but `commit()` read stale state. | **Fix:** Pass `{ members }` directly to `commit()`.

---

### BUG-013: "Other/Custom" registration page blank ✅ FIXED

**Severity:** Major | **Category:** Registration

**Root Cause:** Condition required `resolvedSysType` to be truthy before it was set. | **Fix:** Changed to `!resolvedSysType`.

---

## Phase 2: System Types

✅ All 8 boolean combinations (isSystem × isFragmented × isDissociative) verified via API.

---

## Phase 3: Notes

### BUG-014: Note preview shows raw HTML

**Severity:** Minor | **Category:** Notes | UX

**Steps:** View notes list | **Expected:** Rendered text preview | **Actual:** Shows `<p>`, `<h2>`, `<strong>` tags

---

### BUG-015: TipTap editor Save/Create buttons don't fire

**Severity:** Major | **Category:** Notes

**Steps:** Open create/edit form → type in TipTap editor → click Save | **Expected:** Form submits | **Actual:** Button click doesn't fire (contenteditable state sync issue)

**Note:** Title field (regular input) works fine. Only TipTap editor content doesn't sync.

---

### BUG-016: Tag rename has no backend endpoint

**Severity:** Minor | **Category:** Notes

**Steps:** Manage Tags → click Rename → type new name → Save | **Expected:** Tag renamed across all notes | **Actual:** Rename button exists in UI but no API endpoint

---

### BUG-017: XSS in tags (no sanitization)

**Severity:** Minor | **Category:** Notes | Security

**Steps:** Create note with tag `<script>alert(1)</script>` | **Expected:** Tag sanitized or rejected | **Actual:** Stored as-is

---

### BUG-018: Attribution not visible in note detail view

**Severity:** Minor | **Category:** Notes | UX

**Steps:** Link alter to note → view note detail | **Expected:** Alter name shown | **Actual:** Attribution only visible in Edit form's "Configure Attribution" section

---

### BUG-019: Pronouns array crashes entity search ✅ FIXED

**Severity:** Major | **Category:** Switch

**Root Cause:** `(e.pronouns?.join?.(', ') || e.pronouns || '').toLowerCase()` — empty array `[]` is truthy. | **Fix:** Changed to `(e.pronouns?.join?.(', ') || '').toLowerCase()` in LayerCard.jsx and SwitchEntityGrid.jsx.

---

### BUG-020: `recentProxies` object instead of string ✅ FIXED

**Severity:** Major | **Category:** Switch

**Root Cause:** `updateRecentProxies` pushed objects `{type, id, timestamp}` to string field. | **Fix:** Changed to string format `"type:id"`.

---

### BUG-021: Shift `shiftId` null duplicate key ✅ FIXED

**Severity:** Major | **Category:** Switch

**Root Cause:** `shiftId` field had `unique: true` but was never populated. | **Fix:** Added `shiftId: new mongoose.Types.ObjectId()` to all shift creations.

---

### BUG-022: `handleOpenSettings` undefined in Activity.jsx ✅ FIXED

**Severity:** Major | **Category:** Navigation

**Root Cause:** Functions used in JSX but never defined. | **Fix:** Added `useCallback` handlers.

---

### BUG-023: WebSocket server not set up ✅ FIXED

**Severity:** Major | **Category:** Real-time

**Root Cause:** Activity server imported `WebSocketServer` but never created the instance. | **Fix:** Ported full WS setup from webapp server (JWT auth, heartbeat, Redis pub/sub, note rooms).

---

### BUG-024: Mock mode WS token dispatch missing ✅ FIXED

**Severity:** Major | **Category:** Real-time

**Root Cause:** Mock auth didn't dispatch `systemiser_token_updated` event. | **Fix:** Added event dispatch after `api.setToken()`.

---

## Test Coverage Summary

| Phase | Method | Result |
|-------|--------|--------|
| Registration (15 types) | API | ✅ 15/15 PASS |
| Registration UI | Browser | ✅ DID, Other/Custom tested |
| Boolean Combos (8) | API | ✅ 8/8 PASS |
| Notes CRUD | API + Browser | ✅ Create, Edit, Delete, List |
| Notes Tags | API + Browser | ✅ Add, Filter, Delete, Manage |
| Notes Content Types | API | ✅ Plain, HTML, Unicode, Emoji |
| Notes Empty State | Browser | ✅ "No notes yet" |
| Notes Delete | Browser | ✅ Confirmation dialog, removes from grid |
| Notes Attribution | API | ✅ Link works; UI visibility minor issue |
| Switch Search | Browser | ✅ Entity search works |
| Switch Execute | Browser | ✅ Switch creates shift, front history records |
| System Page | Browser | ✅ Shows alters, states, front count |
| Entity Convert | API | ✅ Alter ↔ State bidirectional |

---

## Files Modified

| File | Changes |
|------|---------|
| `activity/server.js` | Dev endpoints, entity routes, WebSocket server, convert route, logging |
| `activity/src/hooks/useSystemSession.jsx` | onboardingCompleted, entity name format, temp ID filtering |
| `activity/src/hooks/useDiscordSdk.jsx` | Numeric mock user ID |
| `activity/src/hooks/useApiAuth.js` | Mock auth via dev-token, WS token dispatch |
| `activity/src/app/Activity.jsx` | Settings handlers, WS enabled |
| `activity/src/app/pages/RegisterPage.jsx` | Other/Custom fix, Back buttons, heading |
| `activity/src/app/ConnectionToast.jsx` | Added ConnectionDot component |
| `shared/components/LayerCard.jsx` | Pronouns array fix |
| `shared/components/SwitchEntityGrid.jsx` | Pronouns array fix |
| `api/routes/front.js` | recentProxies string format, shiftId population |
| `api/tests/api.mounts.test.js` | Passport mock, require path fix |
| `api/tests/setup.js` | Removed localStorage mock |
| `api/package.json` | NODE_OPTIONS for localStorage |
| `api/api.js` | Express 5 wildcard fix |
