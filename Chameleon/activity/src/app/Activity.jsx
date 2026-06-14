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
import { ImportPage } from './pages/ImportPage'
import { ActivitiesPage } from './pages/ActivitiesPage'
import { RegisterPage } from './pages/RegisterPage'
import { SwitchPage } from './pages/SwitchPage'
import { EntityViewPage } from './pages/EntityViewPage'
import { FrontHistoryPage } from './pages/FrontHistoryPage'
import { SettingsPanel } from '@chameleon/shared/components/SettingsPanel.jsx'

function getInitialPage() {
    const params = new URLSearchParams(window.location.search)
    const page = params.get('page')
    if (page && ['system', 'friends', 'notes', 'crisis', 'what-is', 'settings', 'import', 'activities', 'register', 'switch', 'entity'].includes(page)) return page
    return null
}

function getInitialPageParams() {
    const params = new URLSearchParams(window.location.search)
    const page = params.get('page')
    if (page === 'entity') {
        const entityId = params.get('id')
        const entityType = params.get('type')
        if (entityId && entityType && ['alter', 'state', 'group'].includes(entityType)) {
            return { entityId, entityType }
        }
    }
    return null
}

export function Activity() {
  const { status, error } = useDiscordSdk()
  const { authStatus, authError, hasSystem: authHasSystem, discordUser } = useApiAuth()
  const [activePage, setActivePage] = useState(getInitialPage)
  const [pageParams, setPageParams] = useState(getInitialPageParams)
  const [system, setSystem] = useState(null)
  const [hasSystem, setHasSystem] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [fromOnboarding, setFromOnboarding] = useState(false)

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
      switch: SwitchPage,
      'front-history': FrontHistoryPage,
  }), [isSys])

  const handleRegistered = useCallback(async () => {
    try {
      const data = await api.getSystemFull()
      setSystem(data)
      setHasSystem(true)
      setActivePage(null)
      setFromOnboarding(false)
    } catch (err) {
      console.error('[Activity] Failed to fetch system after registration:', err)
    }
  }, [])

  const handleNavigate = useCallback((page, params) => {
    // Track if navigating from onboarding (register) to hide back button
    if (activePage === 'register' && page === 'import') {
      setFromOnboarding(true)
    } else if (page !== 'import') {
      setFromOnboarding(false)
    }
    setActivePage(page)
    setPageParams(params || null)
  }, [activePage])

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true)
  }, [])

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false)
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

  const showBackButton = activePage && activePage !== 'what-is' && activePage !== 'register' && !fromOnboarding

  const isStaticPage = !activePage || activePage === 'what-is'

  const handleBack = () => {
    setActivePage(null)
    setPageParams(null)
    setFromOnboarding(false)
  }

  return (
    <div className="app-container">
      <main className={`app-content${isStaticPage ? ' app-content--no-scroll' : ''}`} style={{ position: 'relative', paddingTop: showBackButton ? '52px' : undefined }}>
        {showBackButton && (
          <button
            className="gradient-border-sm"
            onClick={handleBack}
            title="Home"
            style={{ position: 'absolute', top: 0, left: 0, zIndex: 10 }}
          >
            <div className="gradient-border-sm-inner">
              <ArrowLeft size={20} strokeWidth={2} stroke="#ffffff" fill="none" />
            </div>
          </button>
        )}
        {PageComponent ? (
          <PageComponent system={system} onNavigate={handleNavigate} onOpenSettings={handleOpenSettings} />
        ) : activePage === 'entity' ? (
          <EntityViewPage
            system={system}
            onNavigate={handleNavigate}
            entityId={pageParams?.entityId}
            entityType={pageParams?.entityType}
          />
        ) : activePage === 'what-is' ? (
          <WhatIsPage onNavigate={handleNavigate} />
        ) : activePage === 'settings' ? (
          <SettingsPage system={system} onNavigate={handleNavigate} discordUser={discordUser} />
        ) : activePage === 'import' ? (
          <ImportPage system={system} onNavigate={handleNavigate} />
        ) : activePage === 'activities' ? (
          <ActivitiesPage />
        ) : activePage === 'register' ? (
          <RegisterPage onNavigate={handleNavigate} onRegistered={handleRegistered} discordUser={discordUser} />
        ) : (
          <LandingPage
            onNavigate={handleNavigate}
            system={system}
            hasSystem={effectiveHasSystem}
            discordUser={discordUser}
          />
        )}
      </main>

      {/* Settings Panel Overlay */}
      {showSettings && (
        <SettingsPanel
          system={system}
          discordUser={discordUser}
          onClose={handleCloseSettings}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  )
}

export default Activity
