# Embedded App — React Fix + Overhaul Plan

## Current State
- Discord Activity SDK: fully working (authorize → exchange → authenticate → UI)
- Activity loads inside Discord with Notes/Crisis tabs
- `CreateNoteModal` crashes with `useState` error due to React dedup issue
- `/systemise` launches the activity directly into the Notes page

---

## Phase 1: Fix React Deduplication

### Problem
`@chameleon/shared` components (especially `CreateNoteModal`) crash with:
```
Cannot read properties of null (reading 'useState')
```
Vite resolves `react` to a different instance when bundling the shared package (linked via `file:../shared`) alongside the activity's own React.

### Solution
Add `react` to `resolve.alias` in `activity/config/vite.mjs` so all imports of `react` resolve to the same module:

```js
resolve: {
    alias: {
        '@chameleon/shared': resolve(__dirname, '../../shared'),
        'react': resolve(__dirname, 'node_modules/react'),
        'react-dom': resolve(__dirname, 'node_modules/react-dom'),
    }
}
```

### Steps
1. Edit `activity/config/vite.mjs` — add react/react-dom aliases
2. Clear `node_modules/.vite` cache inside Docker
3. Rebuild and test that `CreateNoteModal` opens without crashing

---

## Phase 2: Embedded App Architecture

### Current Flow
```
/systemise → LAUNCH_ACTIVITY → Activity loads → Notes page (hardcoded)
```

### New Flow
```
/systemise → LAUNCH_ACTIVITY → Activity loads → Landing page (hub)
                                                        ↓
                                           ┌────────────┼────────────┐
                                           ↓            ↓            ↓
                                        Notes        Front       Crisis
```

Other slash commands (e.g. `/front open`, `/notes open`) can deep-link into specific pages:
```
/systemise page:notes → Notes page
/systemise page:front → Front page
/systemise page:crisis → Crisis page
```

### Routing Strategy
The embedded app is a single-page app (SPA) served from `activity/dist/index.html`. Use the `page` URL parameter (passed via LAUNCH_ACTIVITY) to determine the initial route.

**Option A: URL parameter routing (recommended)**
- `/systemise` → `/?frame_id=...` → Landing page
- `/systemise page:notes` → `/?frame_id=...&page=notes` → Notes page
- `/systemise page:front` → `/?frame_id=...&page=front` → Front page

**Option B: Hash routing**
- `/?frame_id=...#notes` → Notes page
- `/?frame_id=...#front` → Front page

### Component Structure
```
activity/src/app/
├── App.jsx                    # Root — DiscordContextProvider + Router
├── Activity.jsx               # Status gate (INITIALIZING → READY → AUTHENTICATED)
├── pages/
│   ├── LandingPage.jsx        # Hub — shows all available features
│   ├── NotesPage.jsx          # Notes CRUD
│   ├── FrontPage.jsx          # Front status view
│   ├── CrisisPage.jsx         # Crisis tools
│   └── SettingsPage.jsx       # (future)
├── components/
│   ├── NoteCard.jsx           # (from shared)
│   ├── NoteCardGrid.jsx       # (from shared)
│   ├── NoteModal.jsx          # (from shared)
│   └── CreateNoteModal.jsx    # (from shared)
```

### Landing Page Design
A simple hub with feature cards:
- **Notes** — Icon + "Create and manage notes"
- **Front** — Icon + "View current fronting status"
- **Crisis** — Icon + "Emergency resources"

Each card navigates to the specific page. When launched via `/systemise page:notes`, it skips the landing page and goes straight to Notes.

---

## Phase 3: Style Overhaul

### Current State
- Dark theme (`#0f0f13` background)
- Purple accent (`#8b5cf6`)
- Basic mobile-style layout with bottom nav
- Google Keep-inspired note cards

### Design Direction
The embedded app should feel like a native Discord panel — compact, dark, minimal chrome. Not a full-page app but a focused tool panel.

### Key Style Changes
1. **Remove bottom nav** — Replace with a top header bar or tab pills
2. **Compact layout** — Less padding, tighter spacing (Discord activities are small)
3. **Discord-native feel** — Match Discord's font sizes, colors, border radius
4. **Responsive to activity frame** — The activity iframe is ~300-400px wide; design for that
5. **Loading states** — Skeleton loaders instead of spinners
6. **Error states** — Inline errors, not full-screen overlays

### CSS Variables Update
```css
:root {
    --bg: #2b2d31;           /* Discord's dark background */
    --bg-card: #313338;      /* Discord card background */
    --bg-surface: #383a40;   /* Discord surface */
    --text: #dbdee1;         /* Discord text */
    --text-secondary: #949ba4;
    --accent: #5865f2;       /* Discord blurple */
    --border: #3f4147;
}
```

### Layout Structure
```
┌─────────────────────────────┐
│ [← Back]    Page Title   [⋯]│  ← Header bar
├─────────────────────────────┤
│                             │
│        Content area         │  ← Scrollable
│                             │
├─────────────────────────────┤
│ [Notes]  [Front]  [Crisis] │  ← Tab pills (not bottom nav)
└─────────────────────────────┘
```

---

## Phase 4: Deep-Link Pages from Slash Commands

### Overview
Allow existing slash commands to open specific pages in the embedded app.

### Commands to Update
| Command | Current Behavior | New Behavior |
|---------|-----------------|--------------|
| `/systemise` | Opens landing page | Opens landing page |
| `/systemise page:notes` | N/A | Opens Notes page directly |
| `/systemise page:front` | N/A | Opens Front page directly |
| `/front view` | Shows front embed | Could add "Open in App" link button |
| `/profile show` | Shows profile embed | Could add "Open in App" link button |

### Implementation
1. Update `systemise.js` slash command to accept an optional `page` parameter
2. Pass `page` as URL parameter in the LAUNCH_ACTIVITY callback
3. Activity `App.jsx` reads `page` from URL and routes accordingly

---

## Execution Order
1. **Phase 1** (React fix) — immediate, unblocks CreateNoteModal
2. **Phase 2** (Architecture) — routing + landing page
3. **Phase 3** (Style) — redesign the UI
4. **Phase 4** (Deep links) — wire up slash commands

Each phase is independent and can be shipped separately.
