import React, { useState, useEffect } from 'react'

export function ConnectionToast({ disconnected }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!disconnected) {
      setShow(false)
      return
    }
    const timer = setTimeout(() => setShow(true), 2000)
    return () => clearTimeout(timer)
  }, [disconnected])

  if (!show) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(253, 186, 116, 0.95)',
      color: '#1a1a28',
      padding: '8px 20px',
      borderRadius: 999,
      fontSize: 13,
      fontFamily: 'var(--font-accent)',
      fontWeight: 600,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      backdropFilter: 'blur(8px)',
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: '#e9162d',
        animation: 'pulse 1.5s infinite',
      }} />
      Reconnecting...
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

// Subtle dot indicator for connection status (shown in header/footer)
export function ConnectionDot({ connected }) {
  return (
    <span
      title={connected ? 'Connected' : 'Disconnected'}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: connected ? '#4ade80' : '#ef4444',
        transition: 'background 0.3s ease',
        marginLeft: 6,
        verticalAlign: 'middle',
      }}
    />
  )
}
