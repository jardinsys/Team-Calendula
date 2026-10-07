# Anime.js v4 Animation Patterns for Chameleon

## Installation

```bash
cd activity && npm i animejs
```

## Import Strategy (Tree-Shakeable)

```js
// Only import what you use — keeps bundle small
import { animate, createTimeline, stagger, createSpring } from 'animejs';
```

---

## 1. Step Transitions (Registration Wizard)

The registration flow is a multi-step wizard. Each step should slide/fade smoothly.

### Pattern: Slide + Fade Between Steps

```jsx
import { useRef, useCallback } from 'react';
import { animate, createTimeline } from 'animejs';

function RegistrationWizard() {
  const stepRef = useRef(null);
  const currentStep = useRef(0);

  const transitionStep = useCallback((direction = 'forward') => {
    const el = stepRef.current;
    if (!el) return;

    const xOut = direction === 'forward' ? -40 : 40;
    const xIn = direction === 'forward' ? 40 : -40;

    // Animate out current step
    animate(el, {
      opacity: [1, 0],
      x: [0, xOut],
      duration: 200,
      ease: 'inQuad',
      onComplete: () => {
        // Here you'd call your state setter to swap step content
        // setCurrentStep(prev => prev + 1)

        // Animate in new step
        animate(el, {
          opacity: [0, 1],
          x: [xIn, 0],
          duration: 300,
          ease: 'outQuad',
        });
      },
    });
  }, []);

  return (
    <div ref={stepRef} className="step-container">
      {/* step content */}
    </div>
  );
}
```

### Pattern: Category Cards Entrance (Stagger)

When the category selection step loads, cards should cascade in.

```jsx
import { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';

function CategoryStep() {
  const cardsRef = useRef(null);

  useEffect(() => {
    if (!cardsRef.current) return;
    const cards = cardsRef.current.querySelectorAll('.category-card');

    animate(cards, {
      opacity: [0, 1],
      y: [20, 0],
      scale: [0.95, 1],
      duration: 400,
      delay: stagger(60),
      ease: 'outQuad',
    });
  }, []);

  return (
    <div ref={cardsRef} className="category-grid">
      <div className="category-card">DSM-5</div>
      <div className="category-card">ICD-10/11</div>
      <div className="category-card">Other</div>
      <div className="category-card">None</div>
    </div>
  );
}
```

---

## 2. Card Hover Effects

Subtle micro-interactions on all clickable cards.

### Pattern: Hover Scale + Shadow

```css
/* Base state — no transition needed, anime.js handles it */
.category-card,
.entity-card,
.note-card {
  will-change: transform, opacity;
}
```

```jsx
import { useRef, useCallback } from 'react';
import { animate, createSpring } from 'animejs';

function AnimatedCard({ children, className }) {
  const cardRef = useRef(null);

  const handleEnter = useCallback(() => {
    animate(cardRef.current, {
      scale: 1.03,
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      duration: 300,
      ease: createSpring({ stiffness: 300, damping: 20 }),
    });
  }, []);

  const handleLeave = useCallback(() => {
    animate(cardRef.current, {
      scale: 1,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      duration: 400,
      ease: 'outQuad',
    });
  }, []);

  return (
    <div
      ref={cardRef}
      className={className}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
    </div>
  );
}
```

---

## 3. Modal Open/Close

Bottom-sheet modals (EntityDetailModal, NoteModal, FriendDetailModal).

### Pattern: Bottom Sheet Slide

```jsx
import { useRef, useCallback, useEffect } from 'react';
import { animate } from 'animejs';

function BottomSheet({ isOpen, onClose, children }) {
  const sheetRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!sheetRef.current || !overlayRef.current) return;

    if (isOpen) {
      // Open animation
      animate(overlayRef.current, {
        opacity: [0, 1],
        duration: 200,
        ease: 'outQuad',
      });
      animate(sheetRef.current, {
        y: ['100%', '0%'],
        duration: 350,
        ease: 'outQuad',
      });
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    animate(sheetRef.current, {
      y: ['0%', '100%'],
      duration: 250,
      ease: 'inQuad',
    });
    animate(overlayRef.current, {
      opacity: [1, 0],
      duration: 200,
      ease: 'inQuad',
      onComplete: onClose,
    });
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div ref={overlayRef} className="modal-overlay" onClick={handleClose} />
      <div ref={sheetRef} className="bottom-sheet">
        {children}
      </div>
    </>
  );
}
```

---

## 4. Toast Notifications (ConnectionToast)

The WebSocket disconnect toast should slide in from the top.

### Pattern: Toast Slide-In + Auto-Dismiss

```jsx
import { useRef, useEffect } from 'react';
import { animate } from 'animejs';

function Toast({ message, isVisible, duration = 3000 }) {
  const toastRef = useRef(null);

  useEffect(() => {
    if (!toastRef.current) return;

    if (isVisible) {
      animate(toastRef.current, {
        opacity: [0, 1],
        y: [-20, 0],
        scale: [0.95, 1],
        duration: 300,
        ease: 'outQuad',
      });

      // Auto-dismiss
      const timer = setTimeout(() => {
        animate(toastRef.current, {
          opacity: [1, 0],
          y: [0, -20],
          duration: 250,
          ease: 'inQuad',
        });
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration]);

  return (
    <div ref={toastRef} className="toast" style={{ opacity: 0 }}>
      {message}
    </div>
  );
}
```

---

## 5. List Stagger (Alter/State/Group Lists)

When entities load, they should cascade in.

### Pattern: Staggered List Entrance

```jsx
import { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';

function EntityList({ entities }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('.entity-item');

    animate(items, {
      opacity: [0, 1],
      x: [-15, 0],
      duration: 350,
      delay: stagger(50),
      ease: 'outQuad',
    });
  }, [entities]);

  return (
    <div ref={listRef} className="entity-list">
      {entities.map(entity => (
        <div key={entity._id} className="entity-item">
          {entity.name}
        </div>
      ))}
    </div>
  );
}
```

---

## 6. Page Transitions (Tab Switching)

Switching between System/Friends/Notes tabs.

### Pattern: Crossfade

```jsx
import { useRef, useCallback } from 'react';
import { animate, createTimeline } from 'animejs';

function TabContainer() {
  const oldPageRef = useRef(null);
  const newPageRef = useRef(null);

  const switchPage = useCallback((direction = 'right') => {
    const xOut = direction === 'right' ? -30 : 30;
    const xIn = direction === 'right' ? 30 : -30;

    const tl = createTimeline();

    if (oldPageRef.current) {
      tl.add(oldPageRef.current, {
        opacity: [1, 0],
        x: [0, xOut],
        duration: 200,
        ease: 'inQuad',
      });
    }

    if (newPageRef.current) {
      tl.add(newPageRef.current, {
        opacity: [0, 1],
        x: [xIn, 0],
        duration: 300,
        ease: 'outQuad',
      }, '-=100'); // overlap by 100ms for crossfade
    }
  }, []);

  // ...
}
```

---

## 7. Loading Skeleton Shimmer

```css
/* CSS-only shimmer — no JS needed */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-secondary) 25%,
    var(--bg-tertiary) 50%,
    var(--bg-secondary) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 8px;
}
```

> Use CSS for loading skeletons — no need for JS animation overhead.

---

## 8. Error Shake

When validation fails on the registration form.

```jsx
import { useRef } from 'react';
import { animate, createSpring } from 'animejs';

function useShake() {
  const ref = useRef(null);

  const shake = () => {
    if (!ref.current) return;
    animate(ref.current, {
      x: [0, -8, 8, -6, 6, -3, 3, 0],
      duration: 500,
      ease: 'outQuad',
    });
  };

  return [ref, shake];
}

// Usage:
// const [nameRef, shakeName] = useShake();
// <input ref={nameRef} />
// {error && shakeName()}
```

---

## 9. Success Checkmark

On registration complete.

### Pattern: Scale In + Rotate

```jsx
import { useEffect, useRef } from 'react';
import { animate, createSpring } from 'animejs';

function SuccessCheckmark() {
  const checkRef = useRef(null);

  useEffect(() => {
    if (!checkRef.current) return;

    animate(checkRef.current, {
      scale: [0, 1.2, 1],
      rotate: ['-10deg', '5deg', '0deg'],
      opacity: [0, 1],
      duration: 600,
      ease: createSpring({ stiffness: 200, damping: 12 }),
    });
  }, []);

  return (
    <div ref={checkRef} className="success-checkmark">
      ✓
    </div>
  );
}
```

---

## 10. Front Display Animation

The FrontDisplay component showing current fronters.

### Pattern: Avatar Pop-In

```jsx
import { useEffect, useRef } from 'react';
import { animate, stagger, createSpring } from 'animejs';

function FrontDisplay({ fronters }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const avatars = containerRef.current.querySelectorAll('.fronter-avatar');

    animate(avatars, {
      scale: [0, 1],
      opacity: [0, 1],
      duration: 500,
      delay: stagger(80),
      ease: createSpring({ stiffness: 250, damping: 15 }),
    });
  }, [fronters]);

  return (
    <div ref={containerRef} className="front-display">
      {fronters.map(f => (
        <div key={f._id} className="fronter-avatar">
          {f.name}
        </div>
      ))}
    </div>
  );
}
```

---

## Quick Reference: Easings to Use

| Use Case | Easing | Why |
|----------|--------|-----|
| Enter (fade in, slide in) | `'outQuad'` | Smooth deceleration |
| Exit (fade out, slide out) | `'inQuad'` | Quick acceleration |
| Bouncy/Playful | `createSpring({...})` | Physics-based overshoot |
| Stiff/Deliberate | `'outExpo'` | Strong deceleration |
| Elastic/Punchy | `'outElastic'` | Overshoot + settle |
| Smooth/Professional | `'inOutQuad'` | Symmetric ease |

## Quick Reference: Timing

| Animation | Duration | Delay |
|-----------|----------|-------|
| Micro (hover, press) | 150-200ms | 0 |
| Small (toast, tooltip) | 200-300ms | 0 |
| Medium (modal, page) | 300-400ms | 0 |
| Large (wizard step) | 350-500ms | 0 |
| Stagger delay | — | 50-80ms between items |

---

## File Structure Suggestion

```
activity/src/
├── app/
│   ├── hooks/
│   │   └── useAnimatedList.js    # Stagger entrance hook
│   │   └── useShake.js           # Error shake hook
│   │   └── usePageTransition.js  # Crossfade hook
│   └── components/
│       └── AnimatedCard.jsx      # Reusable hover card
│       └── BottomSheet.jsx       # Animated modal
│       └── Toast.jsx             # Animated toast
```

Keep it simple — only extract a hook/component when you've duplicated the pattern 3+ times.
