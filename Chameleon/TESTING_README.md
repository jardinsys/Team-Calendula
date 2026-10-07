# Testing Suite - File Index

## Overview

This directory contains the complete testing suite for the Chameleon Discord Activity embedded app.

---

## Files Created

### Core Testing Documents

| File | Purpose | Lines |
|------|---------|-------|
| `TESTING_PLAN.md` | Main overview and quick start prompt | ~150 |
| `TESTING_PROMPT.md` | Copy-paste prompt for new sessions | ~100 |
| `REGISTRATION_TESTING.md` | Detailed registration test cases | ~350 |
| `SYSTEM_TYPE_TESTING.md` | Boolean combination testing | ~200 |
| `NOTES_TESTING.md` | Notes functionality testing | ~250 |
| `BUG_CHECKLIST.md` | What to look for during testing | ~200 |

### Results Documents (To Be Filled During Testing)

| File | Purpose |
|------|---------|
| `BUGS_FOUND.md` | Track all bugs found |
| `ANIMATION_IDEAS.md` | Capture animation suggestions |

---

## Quick Start

### Option 1: Use the Prompt

Copy the contents of `TESTING_PROMPT.md` into a new session.

### Option 2: Manual Start

1. Read `TESTING_PLAN.md` for overview
2. Start with `REGISTRATION_TESTING.md`
3. Document bugs in `BUGS_FOUND.md`
4. Note animations in `ANIMATION_IDEAS.md`

---

## Testing Order

```
1. REGISTRATION_TESTING.md
   ├── DSM Category (13 tests)
   ├── ICD Category (2+ tests)
   ├── Other Category (3 tests)
   └── None Category (1 test)

2. SYSTEM_TYPE_TESTING.md
   └── 8 Boolean Combinations

3. NOTES_TESTING.md
   ├── CRUD Tests (4)
   ├── Tag Tests (5)
   ├── Filter Tests (3)
   ├── Presence Tests (3)
   ├── View Tests (2)
   ├── Scroll Tests (2)
   └── Edge Case Tests (4)
```

---

## Database Management

### Flush After Each Registration Test

```bash
mongosh "mongodb+srv://corro:***@system-cluster.58n8wzu.mongodb.net/test" --eval "db.dropDatabase()"
```

### Check Database State

```bash
mongosh "mongodb+srv://corro:***@system-cluster.58n8wzu.mongodb.net/test" --eval "
  print('=== Database State ===');
  print('Systems:', db.systems.countDocuments());
  print('Alters:', db.alters.countDocuments());
  print('States:', db.states.countDocuments());
  print('Groups:', db.groups.countDocuments());
  print('Notes:', db.notes.countDocuments());
  print('Privacy Buckets:', db.privacybuckets.countDocuments());
  print('');
  print('=== Latest System sys_type ===');
  printjson(db.systems.findOne({}, {sys_type: 1, name: 1}));
"
```

---

## Bug Severity Levels

| Level | Description | Examples |
|-------|-------------|----------|
| **Critical** | Data loss, security, crash | System not created, data corrupted |
| **Major** | Feature broken, incorrect behavior | Import fails, save doesn't work |
| **Minor** | UX issue, inconsistent | Wrong color, misaligned element |
| **Cosmetic** | Visual polish | Animation timing, shadow depth |

---

## Animation Markers

Use these comments to mark animation opportunities:

```jsx
{/* [ANIMATION: Fade in from bottom with 200ms delay] */}
{/* [ANIMATION: Scale up from 0.95 to 1 with ease-out] */}
{/* [ANIMATION: Smooth height transition for expand/collapse] */}
{/* [ANIMATION: Subtle pulse on hover for interactive elements] */}
{/* [ANIMATION: Shake animation for error state] */}
{/* [ANIMATION: Confetti burst on completion] */}
```

---

## Contact

For questions about this testing suite, contact Jardin or Byte.
