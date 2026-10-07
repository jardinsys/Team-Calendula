import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const items = [
  { id: 1, name: 'Luna', status: 'Fronting', color: '#e94560' },
  { id: 2, name: 'Sage', status: 'Co-fronting', color: '#0f3460' },
  { id: 3, name: 'Nova', status: 'Near', color: '#533483' },
  { id: 4, name: 'Echo', status: 'Away', color: '#2b2d42' },
  { id: 5, name: 'River', status: 'Sleeping', color: '#8d99ae' },
]

export default function StaggerListDemo() {
  const [visible, setVisible] = useState(true)
  const [key, setKey] = useState(0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      style={{ width: '100%', maxWidth: 400 }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 8, color: '#e94560' }}>Stagger List</h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
        Items appear one by one with a cascade effect. Toggle to see exit animations.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button
          onClick={() => { setVisible(v => !v); setKey(k => k + 1) }}
          style={{
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
          {visible ? 'Hide All' : 'Show All'}
        </button>
        <button
          onClick={() => setKey(k => k + 1)}
          style={{
            padding: '8px 20px',
            background: '#16213e',
            color: '#e0e0e0',
            border: '1px solid #0f3460',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Replay
        </button>
      </div>

      {/* List */}
      <div style={{
        background: '#16213e',
        borderRadius: 12,
        padding: 16,
        border: '1px solid #0f3460',
      }}>
        <AnimatePresence>
          {visible && items.map((item, i) => (
            <motion.div
              key={`${key}-${item.id}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
              transition={{ duration: 0.3, delay: i * 0.08, ease: 'easeOut' }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                marginBottom: 4,
                borderRadius: 8,
                background: '#0d111720',
              }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: item.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 700,
                color: '#fff',
              }}>
                {item.name[0]}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{item.status}</div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
