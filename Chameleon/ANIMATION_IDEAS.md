# Animation Ideas

## Overview

This document captures animation ideas discovered during testing. These will be implemented after testing is complete.

---

## Animation Categories

### 1. Page Transitions

#### Step Transitions (Registration Flow)
```css
/* [ANIMATION: Slide transition between registration steps] */
.step-enter {
  opacity: 0;
  transform: translateX(20px);
}
.step-enter-active {
  opacity: 1;
  transform: translateX(0);
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}
.step-exit {
  opacity: 1;
  transform: translateX(0);
}
.step-exit-active {
  opacity: 0;
  transform: translateX(-20px);
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}
```

#### Page Navigation
```css
/* [ANIMATION: Fade transition between pages] */
.page-transition {
  animation: fadeIn 200ms ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

---

### 2. Element Animations

#### Button Hover
```css
/* [ANIMATION: Subtle lift on hover] */
.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: transform 150ms ease-out, box-shadow 150ms ease-out;
}
```

#### Button Active
```css
/* [ANIMATION: Press down on click] */
.btn:active {
  transform: translateY(0);
  transition: transform 100ms ease-out;
}
```

#### Card Hover
```css
/* [ANIMATION: Lift and shadow on hover] */
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}
```

---

### 3. Form Elements

#### Input Focus
```css
/* [ANIMATION: Border color transition on focus] */
.text-input {
  border: 2px solid var(--glass-border);
  transition: border-color 200ms ease-out;
}
.text-input:focus {
  border-color: var(--accent);
  outline: none;
}
```

#### Checkbox/Radio
```css
/* [ANIMATION: Scale pop on check] */
.checkbox:checked {
  animation: checkPop 200ms ease-out;
}

@keyframes checkPop {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
```

---

### 4. Modals

#### Modal Open
```css
/* [ANIMATION: Fade in and scale up] */
.modal-enter {
  opacity: 0;
  transform: scale(0.95);
}
.modal-enter-active {
  opacity: 1;
  transform: scale(1);
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}
```

#### Modal Close
```css
/* [ANIMATION: Fade out and scale down] */
.modal-exit {
  opacity: 1;
  transform: scale(1);
}
.modal-exit-active {
  opacity: 0;
  transform: scale(0.95);
  transition: opacity 150ms ease-out, transform 150ms ease-out;
}
```

#### Backdrop
```css
/* [ANIMATION: Fade in backdrop] */
.backdrop-enter {
  opacity: 0;
}
.backdrop-enter-active {
  opacity: 1;
  transition: opacity 200ms ease-out;
}
```

---

### 5. Lists

#### Item Add
```css
/* [ANIMATION: Fade in and slide down] */
.list-item-enter {
  opacity: 0;
  transform: translateY(-10px);
}
.list-item-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}
```

#### Item Remove
```css
/* [ANIMATION: Fade out and slide up] */
.list-item-exit {
  opacity: 1;
  transform: translateY(0);
}
.list-item-exit-active {
  opacity: 0;
  transform: translateY(-10px);
  transition: opacity 150ms ease-out, transform 150ms ease-out;
}
```

#### List Reorder
```css
/* [ANIMATION: Smooth reorder transition] */
.list-item {
  transition: transform 300ms ease-out;
}
```

---

### 6. Loading States

#### Spinner
```css
/* [ANIMATION: Rotate spinner] */
.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

#### Skeleton Screen
```css
/* [ANIMATION: Shimmer effect for loading] */
.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-surface) 25%,
    var(--bg-card) 50%,
    var(--bg-surface) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

### 7. Feedback

#### Success
```css
/* [ANIMATION: Green checkmark appear] */
.success-icon {
  animation: successPop 300ms ease-out;
}

@keyframes successPop {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}
```

#### Error
```css
/* [ANIMATION: Shake for error] */
.error-shake {
  animation: shake 300ms ease-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
```

#### Warning
```css
/* [ANIMATION: Pulse for warning] */
.warning-pulse {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

---

### 8. Micro-interactions

#### Tag Add
```css
/* [ANIMATION: Pop in for new tag] */
.tag-enter {
  animation: tagPop 200ms ease-out;
}

@keyframes tagPop {
  0% { transform: scale(0); }
  70% { transform: scale(1.1); }
  100% { transform: scale(1); }
}
```

#### Tag Remove
```css
/* [ANIMATION: Fade out for removed tag] */
.tag-exit {
  animation: tagFade 150ms ease-out forwards;
}

@keyframes tagFade {
  to { opacity: 0; transform: scale(0.8); }
}
```

#### Like/Heart
```css
/* [ANIMATION: Heart beat on like] */
.heart-like {
  animation: heartBeat 300ms ease-out;
}

@keyframes heartBeat {
  0% { transform: scale(1); }
  25% { transform: scale(1.3); }
  50% { transform: scale(1); }
  75% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
```

---

### 9. Navigation

#### Tab Indicator
```css
/* [ANIMATION: Slide indicator between tabs] */
.tab-indicator {
  transition: transform 200ms ease-out;
}
```

#### Back Button
```css
/* [ANIMATION: Subtle arrow bounce on hover] */
.btn-back:hover {
  animation: arrowBounce 500ms ease-in-out;
}

@keyframes arrowBounce {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(-3px); }
}
```

---

### 10. Celebrations

#### Completion Confetti
```javascript
// [ANIMATION: Confetti burst on registration complete]
// Use canvas-confetti library or custom implementation
import confetti from 'canvas-confetti';

confetti({
  particleCount: 100,
  spread: 70,
  origin: { y: 0.6 }
});
```

#### Success Checkmark
```css
/* [ANIMATION: Animated checkmark on success] */
.checkmark {
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  animation: draw 500ms ease-out forwards;
}

@keyframes draw {
  to { stroke-dashoffset: 0; }
}
```

---

## Implementation Notes

### Performance Considerations

1. Use `transform` and `opacity` for animations (GPU accelerated)
2. Avoid animating `width`, `height`, `top`, `left` (causes layout thrashing)
3. Use `will-change` sparingly for known animations
4. Prefer CSS animations over JavaScript when possible
5. Use `requestAnimationFrame` for JavaScript animations

### Accessibility

1. Respect `prefers-reduced-motion` media query
2. Provide alternatives for essential animations
3. Don't animate content that contains flashing elements
4. Ensure animations don't cause vestibular disorders

```css
/* Respect user preferences */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Design Tokens

Use existing CSS variables for consistency:

```css
/* Timing */
--transition-fast: 150ms;
--transition-normal: 200ms;
--transition-slow: 300ms;

/* Easing */
--ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94);
--ease-in-out: cubic-bezier(0.42, 0, 0.58, 1);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

---

## Priority Order

1. **Page transitions** - Most visible, improves perceived performance
2. **Button hover states** - Immediate feedback
3. **Modal animations** - Polished feel
4. **Loading states** - Better perceived performance
5. **List animations** - Smooth content changes
6. **Micro-interactions** - Delight details
7. **Celebrations** - Reward moments
