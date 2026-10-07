import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ModalDemo() {
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 8, color: '#e94560' }}>Modal Animation</h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
        Click to open a modal with backdrop blur and scale-in.
      </p>

      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '10px 24px',
          background: '#e94560',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Open Modal
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)',
                zIndex: 10,
              }}
            />
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: '#16213e',
                borderRadius: 16,
                padding: 32,
                width: 320,
                zIndex: 11,
                border: '1px solid #0f3460',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }}
            >
              <h2 style={{ fontSize: 18, marginBottom: 8 }}>Switch Alert</h2>
              <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
                Luna is now fronting. Would you like to log this shift?
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    color: '#888',
                    border: '1px solid #333',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  Dismiss
                </button>
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    padding: '8px 16px',
                    background: '#e94560',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Log Shift
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
