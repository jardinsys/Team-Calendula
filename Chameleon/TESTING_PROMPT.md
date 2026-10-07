# Agentic Testing Prompt - Copy and Use

## For New Testing Sessions

Copy the prompt below into a new session to start testing:

---

```
You are testing the Chameleon Discord Activity embedded app. Your goal is to find and document bugs, UX issues, and design problems. You will aim to fix them when they are instant fixes

## Environment

- Test server URL: [will be provided]
- Discord account: [will be provided]
- MongoDB: mongodb+srv://corro:***@system-cluster.58n8wzu.mongodb.net/test

## Rules

1. **Always create NEW systems** - Never import data
2. **Flush database after EACH test** - Use:
   ```bash
   mongosh "mongodb+srv://corro:***@system-cluster.58n8wzu.mongodb.net/test" --eval "db.dropDatabase()"
   ```
3. **Document everything** - Add bugs to BUGS_FOUND.md
4. **Mark animations** - Use `{/* [ANIMATION: description] */}` comments
5. **Focus on UX** - The app should feel soft, simple, and delightful

## Testing Order

### Phase 1: Registration (REGISTRATION_TESTING.md)

Test each registration path:
- DSM: DID, OSDD (all variants), Amnesia, Dereal/Depers, UDD
- ICD: P-DID, others
- Other: Custom type with various boolean combos
- None: Simple creation

For each:
1. Flush database
2. Complete registration
3. Verify sys_type in database
4. Check for UI/UX issues
5. Flush database

### Phase 2: System Types (SYSTEM_TYPE_TESTING.md)

Using UDD or Custom, test all 8 boolean combinations:
- false, false, false
- true, false, false
- false, true, false
- false, false, true
- true, true, false
- true, false, true
- false, true, true
- true, true, true

### Phase 3: Notes (NOTES_TESTING.md)

Test:
- CRUD operations
- Tags (add, remove, filter)
- Presence indicators
- Edge cases

## Bug Report Format

Add to BUGS_FOUND.md:

```markdown
### BUG-XXX: [Title]

**Severity:** Critical | Major | Minor | Cosmetic
**Category:** Registration | Notes | UX | Animation

**Steps:**
1. Step 1
2. Step 2

**Expected:** [What should happen]
**Actual:** [What happens]

**Screenshot:** [If applicable]
```

## Animation Placeholders

When you see a place that needs animation:
```jsx
{/* [ANIMATION: Describe what should happen] */}
```

## Files to Reference

- TESTING_PLAN.md - Overview
- REGISTRATION_TESTING.md - Registration tests
- SYSTEM_TYPE_TESTING.md - Boolean combo tests
- NOTES_TESTING.md - Notes tests
- BUG_CHECKLIST.md - What to look for
- BUGS_FOUND.md - Results (update this)
- ANIMATION_IDEAS.md - Animation suggestions (update this)

## Start

1. Open the test server URL
2. Login with provided Discord account
3. Start with TEST-DSM-001 (DID registration)
4. Work through all tests systematically
5. Report findings in BUGS_FOUND.md

Good luck! 🎯
```

---

## Quick Commands Reference

### Flush Database
```bash
mongosh "mongodb+srv://corro:***@system-cluster.58n8wzu.mongodb.net/test" --eval "db.dropDatabase()"
```

### Check System Created
```bash
mongosh "mongodb+srv://corro:***@system-cluster.58n8wzu.mongodb.net/test" --eval "db.systems.findOne({}, {sys_type: 1, name: 1})"
```

### Count Entities
```bash
mongosh "mongodb+srv://corro:***@system-cluster.58n8wzu.mongodb.net/test" --eval "
  print('Systems:', db.systems.countDocuments());
  print('Alters:', db.alters.countDocuments());
  print('States:', db.states.countDocuments());
  print('Groups:', db.groups.countDocuments());
  print('Notes:', db.notes.countDocuments());
"
```

### Check sys_type
```bash
mongosh "mongodb+srv://corro:***@system-cluster.58n8wzu.mongodb.net/test" --eval "db.systems.findOne({}, {sys_type: 1})"
```
