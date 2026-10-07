import { useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate } from 'framer-motion'

// --- Spotlight Card ---
function SpotlightCard() {
  const ref = useRef(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 })
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 })

  const spotlightX = useTransform(mouseXSpring, [-0.5, 0.5], [-100, 100])
  const spotlightY = useTransform(mouseYSpring, [-0.5, 0.5], [-100, 100])

  // useMotionTemplate to build the gradient string from motion values
  // Bright spotlight that moves with the cursor
  const background = useMotionTemplate`radial-gradient(circle 120px at calc(50% + ${spotlightX}%) calc(50% + ${spotlightY}%), rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.1) 40%, transparent 70%)`

  const handleMouseMove = (e) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    x.set((e.clientX - rect.left) / rect.width - 0.5)
    y.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'relative',
        width: 260,
        height: 160,
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      {/* Spotlight gradient overlay */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          background,
          pointerEvents: 'none',
        }}
      />
      {/* Card content */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        background: '#16213e',
        border: '1px solid #0f3460',
        borderRadius: 12,
        padding: 20,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Spotlight Follow</div>
        <div style={{ fontSize: 11, color: '#888' }}>Move your mouse over this card</div>
      </div>
    </motion.div>
  )
}

// --- Tilt Card ---
function TiltCard() {
  const ref = useRef(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [10, -10]), { stiffness: 300, damping: 30 })
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-10, 10]), { stiffness: 300, damping: 30 })

  const handleMouseMove = (e) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    x.set((e.clientX - rect.left) / rect.width - 0.5)
    y.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <div style={{ perspective: 600 }}>
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
          width: 260,
          height: 160,
          cursor: 'pointer',
        }}
      >
        <div style={{
          background: '#16213e',
          border: '1px solid #0f3460',
          borderRadius: 12,
          padding: 20,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          transform: 'translateZ(20px)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>3D Tilt</div>
          <div style={{ fontSize: 11, color: '#888' }}>Card tilts toward your cursor</div>
        </div>
      </motion.div>
    </div>
  )
}

// --- Cursor Follower ---
function CursorFollower() {
  const containerRef = useRef(null)
  const cursorX = useMotionValue(0)
  const cursorY = useMotionValue(0)

  const springX = useSpring(cursorX, { stiffness: 500, damping: 28 })
  const springY = useSpring(cursorY, { stiffness: 500, damping: 28 })

  const handleMouseMove = (e) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    cursorX.set(e.clientX - rect.left)
    cursorY.set(e.clientY - rect.top)
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      style={{
        position: 'relative',
        width: 260,
        height: 160,
        borderRadius: 12,
        border: '1px solid #0f3460',
        background: '#16213e',
        overflow: 'hidden',
        cursor: 'none',
      }}
    >
      {/* Trailing dot */}
      <motion.div
        style={{
          position: 'absolute',
          x: springX,
          y: springY,
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'rgba(233,69,96,0.5)',
          border: '2px solid #e94560',
          translateX: '-50%',
          translateY: '-50%',
          pointerEvents: 'none',
        }}
      />
      {/* Inner dot */}
      <motion.div
        style={{
          position: 'absolute',
          x: cursorX,
          y: cursorY,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#e94560',
          translateX: '-50%',
          translateY: '-50%',
          pointerEvents: 'none',
        }}
      />
      <div style={{
        position: 'absolute',
        bottom: 8,
        left: 12,
        fontSize: 11,
        color: '#888',
        pointerEvents: 'none',
      }}>
        Custom cursor trail
      </div>
    </div>
  )
}

// --- Magnetic Button ---
function MagneticButton() {
  const ref = useRef(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const springX = useSpring(x, { stiffness: 300, damping: 20 })
  const springY = useSpring(y, { stiffness: 300, damping: 20 })

  const handleMouseMove = (e) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    x.set((e.clientX - centerX) * 0.3)
    y.set((e.clientY - centerY) * 0.3)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        x: springX,
        y: springY,
        width: 260,
        height: 50,
        background: '#e94560',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
      }}
      whileTap={{ scale: 0.95 }}
    >
      Magnetic Button
    </motion.button>
  )
}

// --- Main Component ---
export default function MouseFollowDemo() {
  const [activeEffect, setActiveEffect] = useState('spotlight')

  const effects = [
    { id: 'spotlight', label: 'Spotlight', component: SpotlightCard },
    { id: 'tilt', label: '3D Tilt', component: TiltCard },
    { id: 'cursor', label: 'Cursor Trail', component: CursorFollower },
    { id: 'magnetic', label: 'Magnetic', component: MagneticButton },
  ]

  const Active = effects.find(e => e.id === activeEffect)?.component

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      style={{ width: '100%', maxWidth: 600 }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 8, color: '#e94560' }}>Mouse Follow Effects</h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
        Move your mouse over the elements to see the effect.
      </p>

      {/* Effect selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
        {effects.map(eff => (
          <button
            key={eff.id}
            onClick={() => setActiveEffect(eff.id)}
            style={{
              padding: '6px 12px',
              background: eff.id === activeEffect ? '#e94560' : '#16213e',
              color: '#fff',
              border: '1px solid #0f3460',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {eff.label}
          </button>
        ))}
      </div>

      {/* Preview area */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
      }}>
        {Active && <Active />}
      </div>
    </motion.div>
  )
}
