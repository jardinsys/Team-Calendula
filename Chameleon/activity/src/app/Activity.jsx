import React, { useState, useEffect } from 'react'
import { useDiscordSdk } from '../hooks/useDiscordSdk'
import { useApiAuth } from '../hooks/useApiAuth'
import { LandingPage } from './pages/LandingPage'
import { SystemPage } from './pages/SystemPage'
import { FriendsPage } from './pages/FriendsPage'
import { NotesPage } from './pages/NotesPage'
import { CrisisPage } from './pages/CrisisPage'

const PAGES = {
    system: SystemPage,
    friends: FriendsPage,
    notes: NotesPage,
    crisis: CrisisPage,
}

function getInitialPage() {
    const params = new URLSearchParams(window.location.search)
    const page = params.get('page')
    if (page && PAGES[page]) return page
    return null
}

export function Activity() {
  const { status, error } = useDiscordSdk()
  const { authStatus, authError } = useApiAuth()
  const [activePage, setActivePage] = useState(getInitialPage)

  if (status === 'INITIALIZING') {
    return (
      <div className="status-screen">
        <div className="spinner" />
        <p>Connecting to Discord...</p>
      </div>
    )
  }

  if (status === 'ERROR') {
    return (
      <div className="status-screen">
        <p style={{ color: 'var(--color-error)' }}>Connection failed</p>
        <p style={{ fontSize: '0.75rem' }}>{error}</p>
      </div>
    )
  }

  if (authStatus === 'PENDING') {
    return (
      <div className="status-screen">
        <div className="spinner" />
        <p>Authenticating...</p>
      </div>
    )
  }

  if (authStatus === 'ERROR') {
    return (
      <div className="status-screen">
        <p style={{ color: 'var(--color-error)' }}>Authentication failed</p>
        <p style={{ fontSize: '0.75rem' }}>{authError}</p>
      </div>
    )
  }

  const PageComponent = activePage ? PAGES[activePage] : null

  return (
    <div className="app-container">
      <main className="app-content">
        {activePage && (
          <div style={{ marginBottom: '12px' }}>
            <button
              className="btn-ghost"
              onClick={() => setActivePage(null)}
              style={{ fontSize: '0.75rem' }}
            >
              ← Home
            </button>
          </div>
        )}
        {PageComponent ? (
          <PageComponent />
        ) : (
          <LandingPage onNavigate={setActivePage} />
        )}
      </main>
      {activePage && (
        <nav className="bottom-nav">
          {Object.entries(PAGES).map(([id, Comp]) => (
            <button
              key={id}
              className={`tab-btn ${activePage === id ? 'active' : ''}`}
              onClick={() => setActivePage(id)}
            >
              <span className="tab-icon">{id === 'system' ? '⚙️' : id === 'friends' ? '👥' : id === 'notes' ? '📝' : '🆘'}</span>
              <span>{id === 'system' ? 'System' : id === 'friends' ? 'Friends' : id === 'notes' ? 'Notes' : 'Crisis'}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}

export default Activity
