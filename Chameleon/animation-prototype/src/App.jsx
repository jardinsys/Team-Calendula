import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import TextPhaseDemo from './demos/TextPhaseDemo'
import StaggerListDemo from './demos/StaggerListDemo'
import ModalDemo from './demos/ModalDemo'
import HoverDemo from './demos/HoverDemo'
import MouseFollowDemo from './demos/MouseFollowDemo'

const demos = [
  { id: 'text-phase', label: 'Text Phase In/Out', component: TextPhaseDemo },
  { id: 'stagger-list', label: 'Stagger List', component: StaggerListDemo },
  { id: 'modal', label: 'Modal Animation', component: ModalDemo },
  { id: 'hover', label: 'Hover Effects', component: HoverDemo },
  { id: 'mouse-follow', label: 'Mouse Follow', component: MouseFollowDemo },
]

export default function App() {
  const [activeDemo, setActiveDemo] = useState('text-phase')
  const Demo = demos.find(d => d.id === activeDemo)?.component

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <nav style={{
        width: 220,
        background: '#16213e',
        padding: '20px 12px',
        borderRight: '1px solid #0f3460',
        flexShrink: 0,
      }}>
        <h2 style={{ fontSize: 14, color: '#a0a0a0', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
          Animation Prototypes
        </h2>
        {demos.map(d => (
          <button
            key={d.id}
            onClick={() => setActiveDemo(d.id)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '10px 12px',
              marginBottom: 4,
              background: activeDemo === d.id ? '#0f3460' : 'transparent',
              color: activeDemo === d.id ? '#e94560' : '#e0e0e0',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeDemo === d.id ? 600 : 400,
            }}
          >
            {d.label}
          </button>
        ))}
        <div style={{ marginTop: 32, padding: '12px', background: '#0f346020', borderRadius: 8, fontSize: 11, color: '#888' }}>
          <strong style={{ color: '#e94560' }}>How to use:</strong><br />
          1. Pick a demo from the list<br />
          2. Click buttons to trigger animations<br />
          3. Screenshot what you like<br />
          4. Tell me what to change
        </div>
      </nav>

      {/* Main area */}
      <main style={{ flex: 1, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <AnimatePresence mode="wait">
          {Demo && <Demo key={activeDemo} />}
        </AnimatePresence>
      </main>
    </div>
  )
}
