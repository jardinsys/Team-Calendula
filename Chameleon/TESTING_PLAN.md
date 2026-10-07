# Chameleon Embedded App - Agentic Testing Plan

## Overview

This document contains the complete testing plan for the Chameleon Discord Activity embedded app. It's designed to be used as a prompt for agentic testing sessions.

---

## Quick Start Prompt for New Sessions

```
You are testing the Chameleon Discord Activity embedded app. Follow the testing plans in these files:

1. REGISTRATION_TESTING.md - Test all registration paths
2. SYSTEM_TYPE_TESTING.md - Test all system type boolean combinations
3. NOTES_TESTING.md - Test notes functionality
4. BUG_CHECKLIST.md - Reference for what to look for

Environment:
- Test server: [will be provided]
- Test Discord account: [will be provided]
- MongoDB database: "test"
- MongoDB URI: mongodb+srv://corro:***@system-cluster.58n8wzu.mongodb.net/test

Rules:
- Always create NEW systems, never import
- Flush the "test" database after EACH registration test
- Document all bugs found in BUGS_FOUND.md
- Add placeholder animations where needed (mark with [ANIMATION: description])
- Focus on UX issues, design inconsistencies, and edge cases

Start with REGISTRATION_TESTING.md and work through each test case systematically.
```

---

## Testing Philosophy

### What We're Testing

1. **Registration Flows** - All paths through the registration wizard
2. **System Type Combinations** - All boolean flag combinations (isSystem, isFragmented, isDissociative)
3. **Notes Functionality** - CRUD operations, tags, filtering, presence
4. **UX/Design** - Soft aesthetic, animations, responsiveness
5. **Edge Cases** - Error handling, boundary conditions, rapid interactions

### What We're NOT Testing (Yet)

- Import functionality (separate test plan)
- Bot commands (separate test plan)
- Backend API directly (testing through UI)

---

## Test Environment Setup

### Database

```bash
# Flush entire test database
mongosh "mongodb+srv://corro:***@system-cluster.58n8wzu.mongodb.net/test" --eval "db.dropDatabase()"

# Or flush specific collections
mongosh "mongodb+srv://corro:***@system-cluster.58n8wzu.mongodb.net/test" --eval "
  db.users.deleteMany({});
  db.systems.deleteMany({});
  db.alters.deleteMany({});
  db.states.deleteMany({});
  db.groups.deleteMany({});
  db.notes.deleteMany({});
  db.privacybuckets.deleteMany({});
"
```

### Browser Access

- URL: [will be provided]
- Use Firecrawl for browser automation
- Login with provided Discord credentials

---

## Test Execution Order

### Phase 1: Registration Testing (REGISTRATION_TESTING.md)

1. **DSM Category**
   - DID (all booleans true)
   - OSDD-1A with extra question (yes path)
   - OSDD-1A with extra question (no path)
   - OSDD-1B (all booleans true)
   - OSDD-2 (fragmented + dissociative)
   - OSDD-3 (fragmented + dissociative)
   - OSDD-4 (fragmented only)
   - Amnesia with fugue question (yes)
   - Amnesia without fugue (no)
   - Dereal/Depers (dissociative only)
   - UDD (multi-select combinations)

2. **ICD Category**
   - P-DID (all booleans true)
   - Other ICD options

3. **Other Category**
   - Custom type entry
   - Boolean selection

4. **None Category**
   - Simple creation

### Phase 2: System Type Testing (SYSTEM_TYPE_TESTING.md)

Using UDD or Custom to test all 8 boolean combinations:
- false, false, false (none)
- true, false, false (system only)
- false, true, false (fragmented only)
- false, false, true (dissociative only)
- true, true, false (system + fragmented)
- true, false, true (system + dissociative)
- false, true, true (fragmented + dissociative)
- true, true, true (all)

### Phase 3: Notes Testing (NOTES_TESTING.md)

- Create note
- Edit note
- Delete note
- Add/remove tags
- Filter by tags
- Filter by author
- Note presence (concurrent editing)
- Note attribution

---

## Bug Documentation

All bugs found should be documented in `BUGS_FOUND.md` with:

```markdown
### BUG-XXX: [Short Title]

**Severity:** Critical | Major | Minor | Cosmetic
**Category:** Registration | Notes | UX | Animation | Edge Case
**Test Case:** [Which test found this]
**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected:** [What should happen]
**Actual:** [What actually happens]
**Screenshot:** [If applicable]
**Fix:** [If known]
```

---

## Animation Placeholders

When you encounter a place that would benefit from animation, add a comment:

```jsx
{/* [ANIMATION: Fade in from bottom with 200ms delay] */}
{/* [ANIMATION: Scale up from 0.95 to 1 with 150ms ease-out] */}
{/* [ANIMATION: Smooth height transition for expand/collapse] */}
{/* [ANIMATION: Subtle pulse on hover for interactive elements] */}
```

Later, these will be converted to actual CSS/JS animations.

---

## Files in This Testing Suite

| File | Purpose |
|------|---------|
| TESTING_PLAN.md | This file - overview and prompt |
| REGISTRATION_TESTING.md | Detailed registration test cases |
| SYSTEM_TYPE_TESTING.md | Boolean combination testing |
| NOTES_TESTING.md | Notes functionality testing |
| BUG_CHECKLIST.md | What to look for |
| BUGS_FOUND.md | Results of testing (created during testing) |
| ANIMATION_IDEAS.md | Animation suggestions (created during testing) |
