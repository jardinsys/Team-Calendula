# Test Sheet — Chameleon Bug Fixes

> Testing guide for all fixes across batches 1–3. Each test includes steps and expected behavior.

---

## Batch 1 — Blocking Testing

### 1.1 WebSocket Reconnection
- Disconnect network for 10s, reconnect
- Toast should appear after 2s of disconnection
- Should auto-reconnect without spamming reconnection attempts
- No excessive console errors

### 1.2 Register Page Scroll
- Open the embedded app → click "Register"
- The form should be scrollable if it overflows the viewport

### 1.3 Back Button During Onboarding
- Start registration flow
- When on the import step, the back button should be hidden
- After completing registration, back button reappears normally

### 1.4 `useNotePresence` Updates
- Open a note in the embedded app
- Have a second user open the same note
- Both users should see each other in the viewers list
- When one user saves, the other should see "Last saved by [name]"

### 1.5 SwitchPage Spread Fix
- Create a dissociative state entity
- Use the Switch page with dissociative layer
- Entity IDs should be valid ObjectIds, not corrupted character strings

---

## Batch 2 — Critical Data Integrity

### 2.1 Alter Delete — System IDs Cleanup
- Create an alter, note its ID in `system.alters.IDs`
- Delete the alter via API or Discord
- Verify the ID is removed from `system.alters.IDs`

### 2.2 Privacy Display Labels
- Create an alter with `privacy.hidden: false`
- View via a friend — should show "Visible" (not "Hidden")
- Set `privacy.hidden: true` — should show "Hidden"

### 2.3 Sync Toggle Persists
- Edit an alter, set `syncWithApps.discord: false`
- Save and reopen edit
- Should still be `false`, not silently reset to `true`

### 2.4 Session Cleanup After Modal
- Open a front switch session, complete it
- Session should be cleaned up (check for memory leak over time)

### 2.5 `createAndLinkEntity` Saves System
- Create an alter via any flow
- Verify `system.alters.IDs` contains the new alter's ID (no orphaned entity)

### 2.6 Privacy Bucket Creation (Onboarding)
- Register a new system
- `system.privacyBuckets` should contain "Strangers" and "Friends" buckets
- No "Default" bucket

### 2.7 Proxy Pattern with Colons
- Create a proxy pattern `a:b:c` on an alter
- Send `a:b:c Hello` — should proxy correctly
- Previously broke after the first colon

### 2.8 `getPrivacyBucket` with FriendID
- Two users become friends
- View friend's front — privacy bucket should resolve via `friendID`, not `guildId`

### 2.9 Display Cache Invalidation
- Change an alter's avatar
- Proxy a message — should show new avatar, not cached old one
- Wait for cache invalidation (SCAN-based)

### 2.10 Ownership Verification — 16 API Endpoints
- User A tries to modify User B's alter/state/group/proxy/shift via API
- Should return 403/404, not modify the data

### 2.11 Friend Removal — Bidirectional
- Remove a friend via API or Discord
- Both users should lose the friendship (not just one side)

### 2.12 Friend Request Accept — Race Condition
- Send two friend requests rapidly
- Accepting one should not corrupt the other

### 2.13 `notifyOnSwitch` Default
- Accept a friend request
- Check `user.friends[].notifyOnSwitch` — should be `true`

### 2.14 PATCH Group — Bidirectional Links
- PATCH a group to add an alter via `alterIDs`
- The alter's `groupsIDs` should also include the group
- Removing from group PATCH should pull from alter's links

### 2.15 State Create — Alter Linking
- Link an alter to a state
- Both `alter.states` and `state.alters` should have proper objects with `connected_id`

### 2.16 Friend Front View — Privacy Filtering
- Non-owner views `GET /api/friends/:systemId`
- Entities hidden from their privacy bucket should be filtered out

### 2.17 Front View — Privacy Filtering
- Non-owner views `GET /api/front/:systemId`
- Should only see entities allowed by their privacy bucket
- System-level hidden check should work

### 2.18 Quick Switch — History Preservation
- Do a quick switch
- Previous shifts should have `endTime` set but NOT be removed from `layer.shifts[]`
- History should still be queryable

---

## Batch 3 — High Priority

### 3.1 Octocon Front Import
- Import Octocon data with front history
- Imported shifts should reference entity IDs, not system ID
- Each member in a front group gets its own shift

### 3.2 Layer Create — Append, Not Replace
- System has 1 layer
- `POST /api/system/layers` with 2 new layers
- Should have 3 total (old layer preserved)

### 3.3 PATCH Alter — Nested Object Merge
- PATCH alter with `{ discord: { image: { avatar: { url: "new" } } } }`
- `discord.server[]`, `discord.name`, etc. should be preserved
- Only `discord.image.avatar.url` should change

### 3.4 Entity Delete — Orphaned Shift Cleanup
- Create an alter, put it in front
- Delete the alter
- Shifts referencing that alter should be deleted from layers

### 3.5 SwitchPage — Edit Persistence on Refetch
- Open Switch page, edit layer names/entities
- Wait 30s for WebSocket refetch
- Edits should NOT be overwritten

### 3.6 `setSubPage` — Render Phase Fix
- System with `isSystem: true` only (no fragmentation)
- Navigate to States subpage
- Should redirect to overview, no React warning

### 3.7 Layer Delete — Clear `statuses[].layerID`
- Delete a layer with active shifts
- Shifts close, their `statuses[].layerID` should be cleared

### 3.8 Entity Search — Aliases for States/Groups
- Create a state with an alias
- `/front switch [alias]` — should resolve the state
- Same for group aliases

### 3.9 Privacy Bucket Lookup — Real Bucket Names
- `sys!system privacy description private`
- Should modify Strangers bucket, not create a "default" bucket

### 3.10 PK Import — Multi-Dash URLs
- Import from a PK system with ID like `abc-123-xyz`
- Should parse full ID, not truncate at first dash

---

## Cross-Cutting Tests

### C.1 Embedded App — Full Flow
1. Open `/systemise`
2. Create an alter (name, pronouns, color)
3. Switch to that alter on the Switch page
4. Open Notes, create a note with markdown content
5. Open Friends page, add a friend by ID
6. Open Settings, change proxy style
7. Verify all changes persist after page reload

### C.2 Discord Bot — Full Flow
1. `/system register` — register system
2. `/alter create` — create alter
3. `/front switch [alter]` — switch to alter
4. `/front` — verify front shows the alter
5. `/whois` on a proxied message — should show entity info
6. `sys!system privacy description private` — verify privacy setting

### C.3 API Consistency
- All `GET` list endpoints return `{ data: [...], total, hasMore }` when paginated
- All `POST`/`PATCH`/`DELETE` return `{ success: true }` on success
- All errors return `{ error: "message" }` with appropriate HTTP status

---

## Known Issues (Not Bugs — Documented Behavior)

- `pronounSeperator` typo is intentional (consistent across codebase, migration deferred)
- `shiftSchema.id` renamed to `shiftId` — entity schemas still have `id` shadowing Mongoose virtual
- Snowflake `mid: 1` collision risk exists across all entity schemas
