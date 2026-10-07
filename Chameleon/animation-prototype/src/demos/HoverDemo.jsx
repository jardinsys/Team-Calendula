import { motion } from 'framer-motion'

export default function HoverDemo() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      style={{ width: '100%', maxWidth: 500 }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 8, color: '#e94560' }}>Hover Effects</h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
        Hover over each element to see the effect.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Card lift */}
        <motion.div
          whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(233,69,96,0.2)' }}
          transition={{ duration: 0.2 }}
          style={{
            background: '#16213e',
            borderRadius: 12,
            padding: 20,
            border: '1px solid #0f3460',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Card Lift</div>
          <div style={{ fontSize: 11, color: '#888' }}>Hover to lift up</div>
        </motion.div>

        {/* Button scale */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{
            background: '#e94560',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '16px 20px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Button Scale
        </motion.button>

        {/* Glow */}
        <motion.div
          whileHover={{ boxShadow: '0 0 20px rgba(233,69,96,0.4)' }}
          transition={{ duration: 0.3 }}
          style={{
            background: '#16213e',
            borderRadius: 12,
            padding: 20,
            border: '1px solid #0f3460',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Glow</div>
          <div style={{ fontSize: 11, color: '#888' }}>Hover for glow effect</div>
        </motion.div>

        {/* Border color */}
        <motion.div
          whileHover={{ borderColor: '#e94560' }}
          transition={{ duration: 0.2 }}
          style={{
            background: '#16213e',
            borderRadius: 12,
            padding: 20,
            border: '2px solid #0f3460',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Border Color</div>
          <div style={{ fontSize: 11, color: '#888' }}>Hover to change border</div>
        </motion.div>

        {/* Rotate icon */}
        <motion.div
          whileHover={{ rotate: 90 }}
          transition={{ duration: 0.3 }}
          style={{
            background: '#16213e',
            borderRadius: 12,
            padding: 20,
            border: '1px solid #0f3460',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 20 }}>⚙️</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Icon Rotate</div>
            <div style={{ fontSize: 11, color: '#888' }}>Hover gear icon</div>
          </div>
        </motion.div>

        {/* Text color shift */}
        <motion.div
          whileHover={{ color: '#e94560' }}
          transition={{ duration: 0.2 }}
          style={{
            background: '#16213e',
            borderRadius: 12,
            padding: 20,
            border: '1px solid #0f3460',
            cursor: 'pointer',
            color: '#e0e0e0',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Text Color</div>
          <div style={{ fontSize: 11, color: '#888' }}>Hover to shift text color</div>
        </motion.div>
      </div>
    </motion.div>
  )
}
