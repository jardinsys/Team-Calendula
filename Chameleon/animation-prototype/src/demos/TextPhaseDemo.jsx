import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const variants = [
  {
    name: 'Fade In',
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.6 },
  },
  {
    name: 'Slide Up + Fade',
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.5, ease: 'easeOut' },
  },
  {
    name: 'Scale In',
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
    transition: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] },
  },
  {
    name: 'Blur In',
    initial: { opacity: 0, filter: 'blur(10px)' },
    animate: { opacity: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, filter: 'blur(10px)' },
    transition: { duration: 0.6 },
  },
  {
    name: 'Character Stagger',
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.3 },
    stagger: true,
  },
]

export default function TextPhaseDemo() {
  const [variantIdx, setVariantIdx] = useState(0)
  const [key, setKey] = useState(0)
  const v = variants[variantIdx]
  const text = "Hello, Systemiser"

  const triggerAnimation = () => setKey(k => k + 1)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      style={{ width: '100%', maxWidth: 600 }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 8, color: '#e94560' }}>Text Phase In/Out</h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
        Click "Replay" to see the current variant. Switch variants to compare.
      </p>

      {/* Variant selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
        {variants.map((vr, i) => (
          <button
            key={i}
            onClick={() => { setVariantIdx(i); triggerAnimation() }}
            style={{
              padding: '6px 12px',
              background: i === variantIdx ? '#e94560' : '#16213e',
              color: '#fff',
              border: '1px solid #0f3460',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {vr.name}
          </button>
        ))}
      </div>

      {/* Animation preview */}
      <div style={{
        background: '#16213e',
        borderRadius: 12,
        padding: 40,
        minHeight: 120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid #0f3460',
      }}>
        {v.stagger ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={key}
              style={{ fontSize: 32, fontWeight: 700, display: 'flex', gap: 2 }}
            >
              {text.split('').map((char, i) => (
                <motion.span
                  key={`${key}-${i}`}
                  initial={v.initial}
                  animate={v.animate}
                  exit={v.exit}
                  transition={{ ...v.transition, delay: i * 0.03 }}
                  style={{ display: 'inline-block' }}
                >
                  {char === ' ' ? '\u00A0' : char}
                </motion.span>
              ))}
            </motion.div>
          </AnimatePresence>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={key}
              initial={v.initial}
              animate={v.animate}
              exit={v.exit}
              transition={v.transition}
              style={{ fontSize: 32, fontWeight: 700 }}
            >
              {text}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Replay button */}
      <button
        onClick={triggerAnimation}
        style={{
          marginTop: 16,
          padding: '8px 20px',
          background: '#e94560',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Replay
      </button>

      {/* Code preview */}
      <details style={{ marginTop: 20, background: '#0d1117', borderRadius: 8, padding: 12 }}>
        <summary style={{ cursor: 'pointer', color: '#888', fontSize: 12 }}>View Framer Motion code</summary>
        <pre style={{ marginTop: 8, fontSize: 12, color: '#c9d1d9', overflow: 'auto' }}>
{`<motion.div
  initial={${JSON.stringify(v.initial, null, 2).split('\n').join('\n    ')}}
  animate={${JSON.stringify(v.animate, null, 2).split('\n').join('\n    ')}}
  exit={${JSON.stringify(v.exit, null, 2).split('\n').join('\n    ')}}
  transition={${JSON.stringify(v.transition, null, 2).split('\n').join('\n    ')}}
>
  ${text}
</motion.div>`}
        </pre>
      </details>
    </motion.div>
  )
}
