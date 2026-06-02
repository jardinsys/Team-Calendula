import React from 'react'

const FEATURES = [
    { id: 'system', icon: '⚙️', label: 'System', description: 'Manage your system, alters, and settings' },
    { id: 'friends', icon: '👥', label: 'Friends', description: 'View and manage your friends' },
    { id: 'notes', icon: '📝', label: 'Notes', description: 'Create and manage notes' },
    { id: 'crisis', icon: '🆘', label: 'Crisis', description: 'Emergency resources and support' },
]

export function LandingPage({ onNavigate }) {
    return (
        <div>
            <header className="page-header">
                <h1>Systemiser</h1>
                <p>What would you like to do?</p>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {FEATURES.map(f => (
                    <button
                        key={f.id}
                        onClick={() => onNavigate(f.id)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '14px',
                            padding: '14px 16px', borderRadius: 'var(--radius, 8px)',
                            backgroundColor: 'var(--bg-card, #313338)',
                            border: '1px solid var(--border, #3f4147)',
                            cursor: 'pointer', textAlign: 'left', width: '100%',
                            transition: 'background 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-surface, #383a40)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-card, #313338)'}
                    >
                        <span style={{ fontSize: '1.5rem' }}>{f.icon}</span>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{f.label}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #949ba4)' }}>{f.description}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    )
}

export default LandingPage
