# Registration Testing - Detailed Test Cases

## Overview

Test every registration path through the embedded app. Each test creates a NEW system and flushes the database afterward.

---

## Test Environment

Before each test:
```bash
mongosh "mongodb+srv://corro:***@system-cluster.58n8wzu.mongodb.net/test" --eval "db.dropDatabase()"
```

---

## DSM Category Tests

### TEST-DSM-001: DID (Full System)

**Path:** Category → DSM → DID → Import (skip) → Name → First Alter → Complete

**sys_type Expected:**
```json
{
  "name": "Dissociative Identity Disorder",
  "dd": { "DSM": "DID" },
  "isSystem": true,
  "isFragmented": true,
  "isDissociative": true,
  "onboardingCompleted": true
}
```

**Steps:**
1. Open activity
2. Click "Register" or start registration
3. Select "DSM-5" category
4. Select "DID" disorder
5. Verify Import step appears (isSystem=true)
6. Skip import
7. Enter system name
8. Enter first alter name(s)
9. Complete registration

**Verify:**
- [ ] Import step shows for DID
- [ ] System created with correct sys_type
- [ ] Alter created successfully
- [ ] Front layer created
- [ ] Can navigate to System page

**Post-test:** Flush database

---

### TEST-DSM-002: OSDD-1A (Yes Path - Alters)

**Path:** Category → DSM → OSDD → OSDD-1 → OSDD-1A → Extra Question (Yes) → Import → Name → Alter → Complete

**sys_type Expected:**
```json
{
  "name": "Other Specified Dissociative Disorder",
  "dd": { "DSM": "OSDD-1A" },
  "isSystem": true,
  "isFragmented": true,
  "isDissociative": true,
  "onboardingCompleted": true
}
```

**Steps:**
1. Flush database
2. Select "DSM-5"
3. Select "OSDD"
4. Select "OSDD-1"
5. Select "OSDD-1A"
6. Answer extra question: "They are distinct alters" (Yes)
7. Verify Import step appears
8. Skip import
9. Enter system name
10. Enter first alter
11. Complete

**Verify:**
- [ ] Extra question displays correctly
- [ ] Yes path sets isSystem=true
- [ ] Import step shows
- [ ] System created correctly

**Post-test:** Flush database

---

### TEST-DSM-003: OSDD-1A (No Path - States Only)

**Path:** Category → DSM → OSDD → OSDD-1 → OSDD-1A → Extra Question (No) → Name → Complete

**sys_type Expected:**
```json
{
  "name": "Other Specified Dissociative Disorder",
  "dd": { "DSM": "OSDD-1A" },
  "isSystem": false,
  "isFragmented": true,
  "isDissociative": true,
  "onboardingCompleted": true
}
```

**Steps:**
1. Flush database
2. Navigate to OSDD-1A
3. Answer extra question: "They are just fragmented states" (No)
4. Verify Import step does NOT appear (isSystem=false)
5. Enter system name
6. Complete (no alter step)

**Verify:**
- [ ] No import step (isSystem=false)
- [ ] No alter input step
- [ ] System created with isSystem=false
- [ ] Dissociative state auto-created

**Post-test:** Flush database

---

### TEST-DSM-004: OSDD-1B (Full System)

**Path:** Category → DSM → OSDD → OSDD-1 → OSDD-1B → Import → Name → Alter → Complete

**sys_type Expected:**
```json
{
  "name": "Other Specified Dissociative Disorder",
  "dd": { "DSM": "OSDD-1B" },
  "isSystem": true,
  "isFragmented": true,
  "isDissociative": true,
  "onboardingCompleted": true
}
```

**Steps:**
1. Flush database
2. Navigate to OSDD-1B
3. Verify Import step appears
4. Skip import
5. Enter name and alter
6. Complete

**Verify:**
- [ ] Direct selection (no extra question)
- [ ] Import step shows
- [ ] All flags true

**Post-test:** Flush database

---

### TEST-DSM-005: OSDD-2 (Fragmented + Dissociative)

**Path:** Category → DSM → OSDD → OSDD-2 → Name → Complete

**sys_type Expected:**
```json
{
  "name": "Other Specified Dissociative Disorder",
  "dd": { "DSM": "OSDD-2" },
  "isSystem": false,
  "isFragmented": true,
  "isDissociative": true,
  "onboardingCompleted": true
}
```

**Steps:**
1. Flush database
2. Navigate to OSDD-2
3. Verify NO import step
4. Enter name
5. Complete

**Verify:**
- [ ] No import step
- [ ] No alter input
- [ ] isSystem=false
- [ ] isFragmented=true
- [ ] isDissociative=true

**Post-test:** Flush database

---

### TEST-DSM-006: OSDD-3 (Fragmented + Dissociative)

**Path:** Same as OSDD-2

**sys_type Expected:**
```json
{
  "name": "Other Specified Dissociative Disorder",
  "dd": { "DSM": "OSDD-3" },
  "isSystem": false,
  "isFragmented": true,
  "isDissociative": true,
  "onboardingCompleted": true
}
```

**Post-test:** Flush database

---

### TEST-DSM-007: OSDD-4 (Fragmented Only)

**Path:** Category → DSM → OSDD → OSDD-4 → Name → Complete

**sys_type Expected:**
```json
{
  "name": "Other Specified Dissociative Disorder",
  "dd": { "DSM": "OSDD-4" },
  "isSystem": false,
  "isFragmented": true,
  "isDissociative": false,
  "onboardingCompleted": true
}
```

**Verify:**
- [ ] isDissociative=false
- [ ] No dissociative state created

**Post-test:** Flush database

---

### TEST-DSM-008: Amnesia (No Fugue)

**Path:** Category → DSM → Amnesia → Extra Question (No) → Name → Complete

**sys_type Expected:**
```json
{
  "name": "Dissociative Amnesia",
  "dd": { "DSM": "Amnesia" },
  "isSystem": false,
  "isFragmented": false,
  "isDissociative": false,
  "onboardingCompleted": true
}
```

**Steps:**
1. Flush database
2. Select Amnesia
3. Answer "No" to fugue question
4. Complete

**Verify:**
- [ ] All flags false
- [ ] No extra entities created

**Post-test:** Flush database

---

### TEST-DSM-009: Amnesia with Fugue

**Path:** Category → DSM → Amnesia → Extra Question (Yes) → Name → Complete

**sys_type Expected:**
```json
{
  "name": "Dissociative Amnesia with Fugue",
  "dd": { "DSM": "Amnesia-Fugue" },
  "isSystem": false,
  "isFragmented": true,
  "isDissociative": true,
  "dissociativeStateName": "Fugue",
  "onboardingCompleted": true
}
```

**Verify:**
- [ ] Custom dissociativeStateName "Fugue"
- [ ] Dissociative state named "Fugue" created

**Post-test:** Flush database

---

### TEST-DSM-010: Dereal/Depers (Dissociative Only)

**Path:** Category → DSM → Dereal/Depers → Name → Complete

**sys_type Expected:**
```json
{
  "name": "Depersonalization-Derealization Disorder",
  "dd": { "DSM": "Dereal/Depers" },
  "isSystem": false,
  "isFragmented": false,
  "isDissociative": true,
  "onboardingCompleted": true
}
```

**Verify:**
- [ ] Only isDissociative=true
- [ ] Dissociative state created

**Post-test:** Flush database

---

### TEST-DSM-011: UDD (Multi-Select - All Options)

**Path:** Category → DSM → UDD → Multi-Select (All) → Name → Alter → Complete

**sys_type Expected:**
```json
{
  "name": "Unspecified Dissociative Disorder",
  "dd": { "DSM": "UDD" },
  "isSystem": true,
  "isFragmented": true,
  "isDissociative": true,
  "onboardingCompleted": true
}
```

**Steps:**
1. Flush database
2. Select UDD
3. Select all three options:
   - "I have distinct identity states (alters)"
   - "I have fragmented or non-identity parts"
   - "I experience dissociative states"
4. Verify Import step appears
5. Skip import
6. Complete

**Verify:**
- [ ] Multi-select shows all options
- [ ] All three flags set to true
- [ ] Import step shows

**Post-test:** Flush database

---

### TEST-DSM-012: UDD (Multi-Select - System Only)

**Path:** Category → DSM → UDD → Multi-Select (System only) → Name → Alter → Complete

**sys_type Expected:**
```json
{
  "name": "Unspecified Dissociative Disorder",
  "dd": { "DSM": "UDD" },
  "isSystem": true,
  "isFragmented": false,
  "isDissociative": false,
  "onboardingCompleted": true
}
```

**Steps:**
1. Flush database
2. Select UDD
3. Select only "I have distinct identity states (alters)"
4. Complete

**Verify:**
- [ ] Only isSystem=true
- [ ] Import step shows
- [ ] Alter input step shows

**Post-test:** Flush database

---

### TEST-DSM-013: UDD (Multi-Select - Fragmented + Dissociative)

**Path:** Category → DSM → UDD → Multi-Select (Fragmented + Dissociative) → Name → Complete

**sys_type Expected:**
```json
{
  "name": "Unspecified Dissociative Disorder",
  "dd": { "DSM": "UDD" },
  "isSystem": false,
  "isFragmented": true,
  "isDissociative": true,
  "onboardingCompleted": true
}
```

**Steps:**
1. Flush database
2. Select UDD
3. Select fragmented + dissociative options (not system)
4. Complete

**Verify:**
- [ ] isSystem=false
- [ ] No import step
- [ ] No alter input

**Post-test:** Flush database

---

## ICD Category Tests

### TEST-ICD-001: P-DID (Full System)

**Path:** Category → ICD → P-DID → Import → Name → Alter → Complete

**sys_type Expected:**
```json
{
  "name": "Partial Dissociative Identity Disorder",
  "dd": { "ICD": "P-DID" },
  "isSystem": true,
  "isFragmented": true,
  "isDissociative": true,
  "onboardingCompleted": true
}
```

**Steps:**
1. Flush database
2. Select "ICD-10/11"
3. Select "P-DID"
4. Verify Import step
5. Skip import
6. Complete

**Verify:**
- [ ] ICD classification used
- [ ] All flags true

**Post-test:** Flush database

---

### TEST-ICD-002: Other ICD Options

Test other ICD options as they exist in the UI.

**Post-test:** Flush database

---

## Other Category Tests

### TEST-OTHER-001: Custom Type Entry

**Path:** Category → Other → Custom Type → Boolean Selection → Name → Complete

**Steps:**
1. Flush database
2. Select "Other"
3. Enter custom type name (e.g., "My Custom Condition")
4. Select boolean flags manually
5. Complete

**Verify:**
- [ ] Custom type name saved
- [ ] Boolean flags applied correctly
- [ ] sys_type.name shows custom name

**Post-test:** Flush database

---

### TEST-OTHER-002: Custom with All Booleans

**Steps:**
1. Flush database
2. Select "Other"
3. Enter custom name
4. Check all three booleans: isSystem, isFragmented, isDissociative
5. Complete

**Verify:**
- [ ] All flags true
- [ ] Import step appears (if isSystem or isFragmented)

**Post-test:** Flush database

---

### TEST-OTHER-003: Custom with No Booleans

**Steps:**
1. Flush database
2. Select "Other"
3. Enter custom name
4. Leave all booleans unchecked
5. Complete

**Verify:**
- [ ] All flags false
- [ ] No import step
- [ ] No alter input

**Post-test:** Flush database

---

## None Category Tests

### TEST-NONE-001: Simple Creation

**Path:** Category → None → Name → Complete

**sys_type Expected:**
```json
{
  "name": "None",
  "dd": {},
  "isSystem": false,
  "isFragmented": false,
  "isDissociative": false,
  "onboardingCompleted": true
}
```

**Steps:**
1. Flush database
2. Select "None"
3. Enter system name
4. Complete

**Verify:**
- [ ] Direct to name step
- [ ] All flags false
- [ ] Simple system created

**Post-test:** Flush database

---

## Edge Case Tests

### TEST-EDGE-001: Rapid Back Navigation

**Steps:**
1. Start registration
2. Quickly click Back multiple times
3. Verify no duplicate systems created
4. Verify navigation state correct

**Verify:**
- [ ] No errors
- [ ] Navigation works correctly
- [ ] No duplicate data

---

### TEST-EDGE-002: Empty Name Submission

**Steps:**
1. Progress to name step
2. Try to submit with empty name
3. Verify validation

**Verify:**
- [ ] Error message shown
- [ ] Cannot proceed with empty name

---

### TEST-EDGE-003: Special Characters in Name

**Steps:**
1. Enter system name with special characters
2. Enter alter name with special characters
3. Complete registration

**Verify:**
- [ ] Special characters handled correctly
- [ ] No XSS issues
- [ ] Display shows correctly

---

### TEST-EDGE-004: Browser Refresh During Registration

**Steps:**
1. Start registration
2. Progress to step 3
3. Refresh browser
4. Verify state preserved (sessionStorage)

**Verify:**
- [ ] Registration state restored
- [ ] Can continue from where left off

---

### TEST-EDGE-005: Double-Click Submit

**Steps:**
1. Progress to final step
2. Double-click submit button rapidly
3. Verify only one system created

**Verify:**
- [ ] Button disabled after first click
- [ ] No duplicate systems

---

## Animation Opportunities

During testing, note places where animations would improve UX:

1. **Category cards** - Hover scale effect
2. **Step transitions** - Fade/slide between steps
3. **Disorder expansion** - Smooth height animation
4. **Extra question reveal** - Fade in from top
5. **Import step appearance** - Slide in from right
6. **Completion celebration** - Confetti or checkmark animation
7. **Back button** - Subtle pulse on hover
8. **Loading states** - Skeleton screens with shimmer
9. **Error messages** - Shake animation
10. **Success feedback** - Green checkmark fade in

Document these in ANIMATION_IDEAS.md.
