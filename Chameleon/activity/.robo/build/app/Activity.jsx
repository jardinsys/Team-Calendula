import React, { useState } from 'react'
import { useDiscordSdk } from '../hooks/useDiscordSdk'
import { useApiAuth } from '../hooks/useApiAuth'
import { NotesPage } from './pages/NotesPage'
import { CrisisPage } from './pages/CrisisPage'

export function Activity() {
  const { status, error } = useDiscordSdk()
  const { authStatus, authError } = useApiAuth()
  const [activeTab, setActiveTab] = useState('notes')

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

  return (
    <div className="app-container">
      <main className="app-content">
        {activeTab === 'notes' && <NotesPage />}
        {activeTab === 'crisis' && <CrisisPage />}
      </main>
      <nav className="bottom-nav">
        <button
          className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          <span className="tab-icon">📝</span>
          <span>Notes</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'crisis' ? 'active' : ''}`}
          onClick={() => setActiveTab('crisis')}
        >
          <span className="tab-icon">🆘</span>
          <span>Crisis</span>
        </button>
      </nav>
    </div>
  )
}

export default Activity
