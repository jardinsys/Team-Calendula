# Bug Checklist - What to Look For

## Overview

This checklist covers common bugs and UX issues to watch for during testing.

---

## Registration Bugs

### UI/UX Issues

- [ ] **Button states** - Buttons should have hover, active, disabled states
- [ ] **Loading states** - Show spinner during async operations
- [ ] **Error messages** - Clear, helpful error messages
- [ ] **Back navigation** - Consistent behavior, no dead ends
- [ ] **Progress indicator** - User knows where they are in flow
- [ ] **Responsive design** - Works on different screen sizes
- [ ] **Touch targets** - Large enough for mobile (44px minimum)
- [ ] **Focus states** - Keyboard navigation works
- [ ] **Color contrast** - Meets accessibility standards

### Flow Issues

- [ ] **Step skipping** - Can't skip required steps
- [ ] **State loss** - Progress saved properly
- [ ] **Duplicate submission** - Prevent double-click issues
- [ ] **Back button behavior** - Doesn't create duplicates
- [ ] **Browser refresh** - State preserved or gracefully handled

### Data Issues

- [ ] **sys_type correctness** - All flags set correctly
- [ ] **Entity creation** - Alters/states created as expected
- [ ] **Privacy buckets** - Default buckets created
- [ ] **Front layers** - Created for system types
- [ ] **Metadata** - importedFrom, joinedAt, etc.

---

## Notes Bugs

### CRUD Issues

- [ ] **Create** - Note saved correctly
- [ ] **Read** - Note displayed correctly
- [ ] **Update** - Changes persisted
- [ ] **Delete** - Note removed completely
- [ ] **Concurrency** - Multiple saves handled

### Tag Issues

- [ ] **Tag creation** - Tags saved correctly
- [ ] **Tag assignment** - Tags linked to notes
- [ ] **Tag filtering** - Correct notes shown
- [ ] **Tag deletion** - Removed from all notes
- [ ] **Case sensitivity** - Handled correctly

### Presence Issues

- [ ] **Viewer indicators** - Show who's viewing
- [ ] **Editor indicators** - Show who's editing
- [ ] **Last saved by** - Correct attribution
- [ ] **Real-time updates** - Indicators update live

---

## Visual/Design Bugs

### Soft Aesthetic Violations

- [ ] **Sharp corners** - Should be rounded (border-radius)
- [ ] **Harsh colors** - Use soft, muted palette
- [ ] **Heavy shadows** - Use subtle, diffused shadows
- [ ] **Cluttered layout** - Generous whitespace
- [ ] **Busy backgrounds** - Clean, minimal
- [ ] **Aggressive animations** - Smooth, subtle transitions

### Consistency Issues

- [ ] **Font sizes** - Consistent hierarchy
- [ ] **Spacing** - Use design tokens (space-xs, space-sm, etc.)
- [ ] **Colors** - Use CSS variables
- [ ] **Border radius** - Consistent rounding
- [ ] **Shadows** - Consistent depth

### Accessibility Issues

- [ ] **Color contrast** - 4.5:1 minimum
- [ ] **Focus indicators** - Visible for keyboard users
- [ ] **Alt text** - Images have descriptions
- [ ] **Screen reader** - ARIA labels where needed
- [ ] **Keyboard navigation** - All interactive elements reachable

---

## Animation Placeholders

When you find a place that needs animation, add this comment:

```jsx
{/* [ANIMATION: description of what should happen] */}
```

### Common Animation Types

1. **Fade in** - `{/* [ANIMATION: Fade in from opacity 0 to 1 over 200ms] */}`
2. **Slide in** - `{/* [ANIMATION: Slide in from bottom with 200ms delay] */}`
3. **Scale** - `{/* [ANIMATION: Scale from 0.95 to 1 with ease-out] */}`
4. **Hover lift** - `{/* [ANIMATION: translateY(-2px) on hover] */}`
5. **Pulse** - `{/* [ANIMATION: Subtle pulse for attention] */}`
6. **Shake** - `{/* [ANIMATION: Shake for error state] */}`
7. **Spin** - `{/* [ANIMATION: Rotate 360deg for loading] */}`
8. **Collapse** - `{/* [ANIMATION: Smooth height transition] */}`
9. **Expand** - `{/* [ANIMATION: Accordion expand from 0 to auto] */}`
10. **Confetti** - `{/* [ANIMATION: Celebration confetti on completion] */}`

---

## Edge Cases to Test

### Input Validation

- [ ] Empty strings
- [ ] Very long strings (1000+ chars)
- [ ] Special characters: `< > " ' & / \`
- [ ] SQL injection attempts
- [ ] XSS attempts: `<script>alert('xss')</script>`
- [ ] Unicode characters: emojis, CJK, RTL
- [ ] Only whitespace
- [ ] HTML entities: `&amp;`, `&lt;`, etc.

### Timing Issues

- [ ] Rapid clicks (double, triple)
- [ ] Long press
- [ ] Quick page transitions
- [ ] Slow network (throttled)
- [ ] Tab background/foreground

### State Issues

- [ ] Browser refresh
- [ ] Back/forward navigation
- [ ] Multiple tabs
- [ ] Session timeout
- [ ] Logout during operation

### Database Issues

- [ ] Connection loss
- [ ] Duplicate key errors
- [ ] Missing references
- [ ] Orphaned documents
- [ ] TTL expiration

---

## Screenshot Checklist

Take screenshots of:

1. **Registration start** - Category selection
2. **Each disorder type** - Expanded card view
3. **Extra questions** - Multi-select, yes/no
4. **Import step** - When shown
5. **Name step** - Input field
6. **Alter input** - When shown
7. **Completion** - Success state
8. **Notes page** - Empty state
9. **Notes grid** - With notes
10. **Note modal** - Open note
11. **Tag filter** - Active filter
12. **Error states** - Validation errors
13. **Loading states** - Spinners
14. **Empty states** - No data

---

## Bug Severity Levels

### Critical
- Data loss
- Security vulnerability
- Complete feature broken
- Crash/error

### Major
- Feature partially broken
- Incorrect behavior
- Poor UX that confuses users

### Minor
- Cosmetic issue
- Inconsistent styling
- Minor UX annoyance

### Cosmetic
- Visual polish
- Animation timing
- Color adjustment

---

## Reporting Format

For each bug found:

```markdown
### BUG-XXX: [Short Title]

**Severity:** Critical | Major | Minor | Cosmetic
**Category:** Registration | Notes | UX | Animation | Edge Case
**Component:** [Which part of the UI]

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected:** [What should happen]
**Actual:** [What actually happens]

**Environment:**
- Browser: [Chrome/Firefox/etc]
- Screen size: [if relevant]
- Time: [if timing related]

**Screenshot:** [If applicable]

**Suggested Fix:** [If known]
```
