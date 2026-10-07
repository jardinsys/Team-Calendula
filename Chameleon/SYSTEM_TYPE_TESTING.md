# System Type Boolean Combination Testing

## Overview

Test all 8 combinations of the three boolean flags:
- `isSystem` - Has distinct identity states (alters)
- `isFragmented` - Has fragmented or non-identity parts
- `isDissociative` - Experiences dissociative states

Use UDD (Unspecified Dissociative Disorder) or Custom type to test each combination since they allow multi-select of flags.

---

## Boolean Combination Matrix

| # | isSystem | isFragmented | isDissociative | Import Step | Alter Input | Dissociative State |
|---|----------|--------------|----------------|-------------|-------------|-------------------|
| 1 | false | false | false | No | No | No |
| 2 | true | false | false | Yes | Yes | No |
| 3 | false | true | false | Yes | No | No |
| 4 | false | false | true | No | No | Yes |
| 5 | true | true | false | Yes | Yes | No |
| 6 | true | false | true | Yes | Yes | Yes |
| 7 | false | true | true | Yes | No | Yes |
| 8 | true | true | true | Yes | Yes | Yes |

---

## Test Cases

### TEST-COMBO-001: All False (false, false, false)

**Method:** Use "Other" category with no booleans checked, or "None"

**sys_type Expected:**
```json
{
  "isSystem": false,
  "isFragmented": false,
  "isDissociative": false
}
```

**Registration Flow:**
1. Category → Other/None → Name → Complete

**Verify:**
- [ ] No import step
- [ ] No alter input step
- [ ] No dissociative state created
- [ ] Simple system with just name
- [ ] Empty front layers

---

### TEST-COMBO-002: System Only (true, false, false)

**Method:** Use UDD with only "I have distinct identity states (alters)" selected

**sys_type Expected:**
```json
{
  "isSystem": true,
  "isFragmented": false,
  "isDissociative": false
}
```

**Registration Flow:**
1. Category → DSM → UDD → Select system only → Import → Name → Alter → Complete

**Verify:**
- [ ] Import step appears
- [ ] Alter input step appears
- [ ] No dissociative state created
- [ ] Front layer created with alter
- [ ] System has alters array populated

---

### TEST-COMBO-003: Fragmented Only (false, true, false)

**Method:** Use UDD with only "I have fragmented or non-identity parts" selected

**sys_type Expected:**
```json
{
  "isSystem": false,
  "isFragmented": true,
  "isDissociative": false
}
```

**Registration Flow:**
1. Category → DSM → UDD → Select fragmented only → Name → Complete

**Verify:**
- [ ] Import step appears (isFragmented=true triggers import)
- [ ] No alter input step (isSystem=false)
- [ ] No dissociative state created
- [ ] States array may be populated from import

---

### TEST-COMBO-004: Dissociative Only (false, false, true)

**Method:** Use UDD with only "I experience dissociative states" selected

**sys_type Expected:**
```json
{
  "isSystem": false,
  "isFragmented": false,
  "isDissociative": true
}
```

**Registration Flow:**
1. Category → DSM → UDD → Select dissociative only → Name → Complete

**Verify:**
- [ ] No import step (isSystem=false, isFragmented=false)
- [ ] No alter input step
- [ ] Dissociative state auto-created with default name "Dissociated"
- [ ] State added to states array

---

### TEST-COMBO-005: System + Fragmented (true, true, false)

**Method:** Use UDD with system + fragmented selected

**sys_type Expected:**
```json
{
  "isSystem": true,
  "isFragmented": true,
  "isDissociative": false
}
```

**Registration Flow:**
1. Category → DSM → UDD → Select system + fragmented → Import → Name → Alter → Complete

**Verify:**
- [ ] Import step appears
- [ ] Alter input step appears
- [ ] No dissociative state created
- [ ] Can import both alters and states

---

### TEST-COMBO-006: System + Dissociative (true, false, true)

**Method:** Use UDD with system + dissociative selected

**sys_type Expected:**
```json
{
  "isSystem": true,
  "isFragmented": false,
  "isDissociative": true
}
```

**Registration Flow:**
1. Category → DSM → UDD → Select system + dissociative → Import → Name → Alter → Complete

**Verify:**
- [ ] Import step appears
- [ ] Alter input step appears
- [ ] Dissociative state auto-created
- [ ] Front layer with alter + dissociative state available

---

### TEST-COMBO-007: Fragmented + Dissociative (false, true, true)

**Method:** Use UDD with fragmented + dissociative selected

**sys_type Expected:**
```json
{
  "isSystem": false,
  "isFragmented": true,
  "isDissociative": true
}
```

**Registration Flow:**
1. Category → DSM → UDD → Select fragmented + dissociative → Import → Name → Complete

**Verify:**
- [ ] Import step appears (isFragmented=true)
- [ ] No alter input step (isSystem=false)
- [ ] Dissociative state auto-created
- [ ] States available for import

---

### TEST-COMBO-008: All True (true, true, true)

**Method:** Use UDD with all three selected, or DID

**sys_type Expected:**
```json
{
  "isSystem": true,
  "isFragmented": true,
  "isDissociative": true
}
```

**Registration Flow:**
1. Category → DSM → UDD → Select all → Import → Name → Alter → Complete

**Verify:**
- [ ] Import step appears
- [ ] Alter input step appears
- [ ] Dissociative state auto-created
- [ ] Full feature set available
- [ ] Can import alters, states, and groups

---

## Verification Checklist

For each combination, verify:

### Database State
```javascript
// After registration, check:
db.systems.findOne({ /* your system */ }).sys_type

// Should match expected sys_type
```

### Entity Counts
```javascript
// Alter count (isSystem=true should have alters)
db.alters.countDocuments({ systemID: ObjectId("...") })

// State count (isDissociative=true should have at least 1 state)
db.states.countDocuments({ systemID: ObjectId("...") })

// Group count (usually 0 after registration)
db.groups.countDocuments({ systemID: ObjectId("...") })
```

### Front Layers
```javascript
// Check front layers created correctly
db.systems.findOne({ /* your system */ }).front.layers
```

---

## Edge Cases for Boolean Combinations

### TEST-COMBO-EDGE-001: Toggle Flags During Registration

**Steps:**
1. Start with isSystem=true
2. Go back and change to isSystem=false
3. Verify UI updates correctly
4. Complete registration

**Verify:**
- [ ] Import step disappears when isSystem=false
- [ ] Alter input disappears when isSystem=false
- [ ] Final sys_type matches last selection

---

### TEST-COMBO-EDGE-002: UDD Minimum Selection

**Steps:**
1. Select UDD
2. Try to proceed without selecting any option
3. Verify validation

**Verify:**
- [ ] Cannot proceed with 0 selections
- [ ] Error message shown
- [ ] Minimum 1 selection required

---

### TEST-COMBO-EDGE-003: UDD Maximum Selection

**Steps:**
1. Select UDD
2. Select all three options
3. Verify all flags set correctly

**Verify:**
- [ ] All three options selectable
- [ ] All flags true in sys_type

---

## Animation Opportunities

1. **Flag selection feedback** - Checkmark animation when selecting
2. **Import step reveal** - Slide in when flags change
3. **State creation feedback** - Dissociative state appears with fade
4. **Validation shake** - Error state on minimum selection
