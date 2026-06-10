import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useDiscordSdk } from '../hooks/useDiscordSdk'
import { useApiAuth } from '../hooks/useApiAuth'
import { api, isSystemUser } from '@chameleon/shared'
import { ArrowLeft } from 'lucide-react'
import { LandingPage } from './pages/LandingPage'
import { SystemPage } from './pages/SystemPage'
import { ProfilePage } from './pages/ProfilePage'
import { FriendsPage } from './pages/FriendsPage'
import { NotesPage } from './pages/NotesPage'
import { CrisisPage } from './pages/CrisisPage'
import { WhatIsPage } from './pages/WhatIsPage'
import { SettingsPage } from './pages/SettingsPage'
import { ActivitiesPage } from './pages/ActivitiesPage'
import { RegisterPage } from './pages/RegisterPage'

function getInitialPage() {
    const params = new URLSearchParams(window.location.search)
    const page = params.get('page')
    if (page && ['system', 'friends', 'notes', 'crisis', 'what-is', 'settings', 'activities', 'register'].includes(page)) return page
    return null
}

export function Activity() {
  const { status, error } = useDiscordSdk()
  const { authStatus, authError, hasSystem: authHasSystem, discordUser } = useApiAuth()
  const [activePage, setActivePage] = useState(getInitialPage)
  const [system, setSystem] = useState(null)
  const [hasSystem, setHasSystem] = useState(false)

  useEffect(() => {
    if (authStatus !== 'READY') return
    let cancelled = false

    api.getSystemFull()
      .then(data => {
        if (!cancelled) {
          setSystem(data)
          setHasSystem(true)
        }
      })
      .catch(() => {
        if (!cancelled) setHasSystem(false)
      })

    return () => { cancelled = true }
  }, [authStatus])

  useEffect(() => {
    if (authStatus !== 'READY') return
    let cancelled = false

    api.getPendingActivityPage()
      .then(({ page }) => {
        if (!cancelled && page && ['system', 'friends', 'notes', 'crisis'].includes(page)) {
          setActivePage(page)
        }
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [authStatus])

  const effectiveHasSystem = hasSystem || authHasSystem

  const isSys = isSystemUser(system)

  const PAGES = useMemo(() => ({
      system: isSys ? SystemPage : ProfilePage,
      friends: FriendsPage,
      notes: NotesPage,
      crisis: CrisisPage,
  }), [isSys])

  const handleRegistered = useCallback(async () => {
    try {
      const data = await api.getSystemFull()
      setSystem(data)
      setHasSystem(true)
      setActivePage(null)
    } catch (err) {
      console.error('[Activity] Failed to fetch system after registration:', err)
    }
  }, [])

  const handleNavigate = useCallback((page) => {
    setActivePage(page)
  }, [])

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

  const showBackButton = activePage && activePage !== 'what-is' && activePage !== 'register'

  return (
    <div className="app-container">
      <main className="app-content" style={{ position: 'relative', paddingTop: showBackButton ? '52px' : undefined }}>
        {showBackButton && (
          <button
            className="gradient-border-sm"
            onClick={() => setActivePage(null)}
            title="Home"
            style={{ position: 'absolute', top: 0, left: 0, zIndex: 10 }}
          >
            <div className="gradient-border-sm-inner">
              <ArrowLeft size={20} strokeWidth={2} stroke="#ffffff" fill="none" />
            </div>
          </button>
        )}
        {PageComponent ? (
          <PageComponent system={system} />
        ) : activePage === 'what-is' ? (
          <WhatIsPage onNavigate={handleNavigate} />
        ) : activePage === 'settings' ? (
          <SettingsPage system={system} />
        ) : activePage === 'activities' ? (
          <ActivitiesPage />
        ) : activePage === 'register' ? (
          <RegisterPage onNavigate={handleNavigate} onRegistered={handleRegistered} />
        ) : (
          <LandingPage
            onNavigate={handleNavigate}
            system={system}
            hasSystem={effectiveHasSystem}
            discordUser={discordUser}
          />
        )}
      </main>
    </div>
  )
}

export default Activity
