# Notes Functionality Testing

## Overview

Test all notes features: CRUD operations, tags, filtering, presence, and attribution.

---

## Prerequisites

Before testing notes:
1. Complete registration (any type)
2. System must exist with at least one alter (for attribution)

---

## Notes CRUD Tests

### TEST-NOTES-001: Create Note

**Steps:**
1. Navigate to Notes page
2. Click "Create Note" button
3. Enter title
4. Enter content
5. Add tags (optional)
6. Save

**Verify:**
- [ ] Create modal opens correctly
- [ ] Title input works
- [ ] Content textarea works
- [ ] Tags can be added
- [ ] Save button works
- [ ] Note appears in grid
- [ ] Timestamp shown

---

### TEST-NOTES-002: Edit Note

**Steps:**
1. Click on existing note
2. Click "Edit" button
3. Modify title
4. Modify content
5. Add/remove tags
6. Save changes

**Verify:**
- [ ] Note opens in modal
- [ ] Edit mode enables inputs
- [ ] Changes saved correctly
- [ ] Updated timestamp shown
- [ ] Grid updates automatically

---

### TEST-NOTES-003: Delete Note

**Steps:**
1. Click on existing note
2. Click "Delete" button
3. Confirm deletion

**Verify:**
- [ ] Confirmation dialog shown
- [ ] Note removed from grid
- [ ] Modal closes
- [ ] Note no longer in database

---

### TEST-NOTES-004: Note Content Types

**Steps:**
1. Create note with plain text
2. Create note with markdown
3. Create note with special characters
4. Create note with emojis
5. Create note with line breaks

**Verify:**
- [ ] Plain text displays correctly
- [ ] Markdown rendered (if supported)
- [ ] Special characters escaped properly
- [ ] Emojis display correctly
- [ ] Line breaks preserved

---

## Tag Tests

### TEST-TAGS-001: Add Tags to Note

**Steps:**
1. Create note
2. Add multiple tags
3. Save note
4. Reopen note

**Verify:**
- [ ] Tags added successfully
- [ ] Tags displayed on note card
- [ ] Tags persist after save
- [ ] Tags shown in modal

---

### TEST-TAGS-002: Remove Tags from Note

**Steps:**
1. Open note with tags
2. Remove a tag
3. Save

**Verify:**
- [ ] Tag removed from note
- [ ] Tag still exists in system (not deleted)
- [ ] Grid updates

---

### TEST-TAGS-003: Filter by Tags

**Steps:**
1. Create multiple notes with different tags
2. Click on a tag in filter bar
3. Verify filtered results

**Verify:**
- [ ] Only notes with selected tag shown
- [ ] Multiple tags can be selected
- [ ] Clear filter shows all notes
- [ ] Filter state persists

---

### TEST-TAGS-004: Manage Tags

**Steps:**
1. Open tag management
2. Rename a tag
3. Delete a tag
4. Verify changes

**Verify:**
- [ ] Tag rename works
- [ ] Tag delete removes from all notes
- [ ] UI updates correctly

---

### TEST-TAGS-005: Tag Edge Cases

**Steps:**
1. Create tag with same name as existing (case sensitivity)
2. Create tag with special characters
3. Create tag with very long name
4. Create tag with only spaces

**Verify:**
- [ ] Case sensitivity handled correctly
- [ ] Special characters allowed/disallowed appropriately
- [ ] Long names truncated or wrapped
- [ ] Empty/whitespace tags rejected

---

## Filtering Tests

### TEST-FILTER-001: Filter by Author

**Steps:**
1. Create notes as different alters (if possible)
2. Filter by author
3. Verify results

**Verify:**
- [ ] Author filter works
- [ ] Correct notes shown
- [ ] "All" option shows everything

---

### TEST-FILTER-002: Filter by Date

**Steps:**
1. Create notes at different times (if possible)
2. Filter by date range
3. Verify results

**Verify:**
- [ ] Date filter works
- [ ] Correct notes shown

---

### TEST-FILTER-003: Combined Filters

**Steps:**
1. Apply tag filter
2. Apply author filter
3. Verify combined results

**Verify:**
- [ ] Filters work together
- [ ] Correct intersection shown

---

## Note Presence Tests

### TEST-PRESENCE-001: Viewer Indicators

**Steps:**
1. Open note in one session
2. Open same note in another session (if possible)
3. Verify viewer indicators

**Verify:**
- [ ] Viewer names shown
- [ ] Viewer count correct
- [ ] Indicators update in real-time

---

### TEST-PRESENCE-002: Editor Indicators

**Steps:**
1. Start editing note in one session
2. Check another session
3. Verify editor indicators

**Verify:**
- [ ] "Editing" indicator shown
- [ ] Editor name displayed
- [ ] Lock icon (if implemented)

---

### TEST-PRESENCE-003: Last Saved By

**Steps:**
1. Edit note in one session
2. Check "Last saved by" indicator
3. Edit in another session
4. Verify indicator updates

**Verify:**
- [ ] Last saved by name shown
- [ ] Updates after each save
- [ ] Correct user attributed

---

## Attribution Tests

### TEST-ATTRIB-001: Attribute Note to Alter

**Steps:**
1. Create note
2. Select attribution (if UI exists)
3. Choose alter from dropdown
4. Save

**Verify:**
- [ ] Alter dropdown populated
- [ ] Attribution saved
- [ ] Shown on note card

---

### TEST-ATTRIB-002: Multiple Alter Attribution

**Steps:**
1. Create note
2. Attribute to multiple alters (if supported)
3. Save

**Verify:**
- [ ] Multiple attribution works
- [ ] All names shown

---

## View Tests

### TEST-VIEW-001: Grid View

**Steps:**
1. Toggle to grid view
2. Verify layout

**Verify:**
- [ ] Grid layout correct
- [ ] Cards sized appropriately
- [ ] Responsive to window size

---

### TEST-VIEW-002: List View

**Steps:**
1. Toggle to list view
2. Verify layout

**Verify:**
- [ ] List layout correct
- [ ] Compact display
- [ ] All info visible

---

## Infinite Scroll Tests

### TEST-SCROLL-001: Load More Notes

**Steps:**
1. Create 25+ notes
2. Scroll to bottom
3. Verify more notes load

**Verify:**
- [ ] Loading indicator shown
- [ ] More notes loaded
- [ ] Scroll position maintained
- [ ] No duplicate notes

---

### TEST-SCROLL-002: Empty State

**Steps:**
1. Delete all notes
2. Check empty state display

**Verify:**
- [ ] Empty state message shown
- [ ] "Create first note" CTA
- [ ] No errors

---

## Edge Case Tests

### TEST-NOTES-EDGE-001: Rapid Create/Delete

**Steps:**
1. Rapidly create multiple notes
2. Rapidly delete notes
3. Verify no errors

**Verify:**
- [ ] No race conditions
- [ ] UI remains responsive
- [ ] Database consistent

---

### TEST-NOTES-EDGE-002: Very Long Content

**Steps:**
1. Create note with 10,000+ characters
2. Save and reopen

**Verify:**
- [ ] Content truncated in grid view
- [ ] Full content in modal
- [ ] No performance issues

---

### TEST-NOTES-EDGE-003: Special Characters in Tags

**Steps:**
1. Create tag with `<>{}[]` characters
2. Filter by that tag

**Verify:**
- [ ] Tags stored correctly
- [ ] Filtering works
- [ ] No XSS issues

---

### TEST-NOTES-EDGE-004: Concurrent Editing

**Steps:**
1. Open same note in two sessions
2. Edit in both simultaneously
3. Save in both

**Verify:**
- [ ] Last save wins (or conflict resolution)
- [ ] No data corruption
- [ ] User notified of conflict (if implemented)

---

## Animation Opportunities

1. **Note card hover** - Subtle lift effect
2. **Note creation** - Fade in from center
3. **Note deletion** - Fade out with scale down
4. **Tag addition** - Pop in animation
5. **Tag removal** - Fade out
6. **Filter applied** - Cards rearrange with animation
7. **Infinite scroll** - Fade in new cards
8. **Presence indicator** - Pulse animation
9. **View toggle** - Smooth layout transition
10. **Empty state** - Illustration animation
