import React, { useMemo } from 'react'
import { useDiscordSdk } from '../../hooks/useDiscordSdk'
import { getSystemTerm } from '@chameleon/shared'
import {
  PersonStanding,
  Users,
  NotepadText,
  Dices,
  TriangleAlert,
  Settings,
  Shuffle,
} from 'lucide-react'


/* ═══════════════════════════════════════════
   Returning User Landing — Welcome Back + Avatar + Where to?
   ═══════════════════════════════════════════ */

function ReturningLanding({ onNavigate, system, discordUser }) {
  const systemLabel = useMemo(() => getSystemTerm(system, { context: 'activity' }), [system])

  const displayName = useMemo(() => {
    return discordUser?.globalName || discordUser?.username || system?.name?.display || 'there'
  }, [discordUser, system])

  const avatarUrl = useMemo(() => {
    if (system?.avatar?.url) return system.avatar.url
    if (!discordUser?.discordID) return null
    if (discordUser?.avatar) {
      return `https://cdn.discordapp.com/avatars/${discordUser.discordID}/${discordUser.avatar}.png?size=256`
    }
    const idx = (BigInt(discordUser.discordID) >> 22n) % 6n
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`
  }, [system, discordUser])

  const FEATURES = useMemo(() => [
    { id: 'system', icon: PersonStanding, label: systemLabel },
    { id: 'switch', icon: Shuffle, label: 'Switch' },
    { id: 'friends', icon: Users, label: 'Friends' },
    { id: 'notes', icon: NotepadText, label: 'Notes' },
    { id: 'activities', icon: Dices, label: 'Activities' },
  ], [systemLabel])

  return (
    <div className="landing-returning">
      <h1 className="landing-returning-title">
        Welcome Back <strong>{displayName}!</strong>
      </h1>

      <div className="landing-avatar-wrap">
        <div className="landing-avatar-inner">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} />
          ) : (
            <div className="landing-avatar-fallback">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      <p className="landing-returning-subtitle">Where to?</p>

      <div className="landing-feature-row">
        {FEATURES.map(f => {
          const Icon = f.icon
          return (
            <button
              key={f.id}
              className="landing-feature-btn"
              onClick={() => onNavigate(f.id)}
            >
              <div className="landing-feature-circle landing-feature-circle--sm">
                <div className="landing-feature-circle-inner">
                  <Icon
                    size={40}
                    strokeWidth={3}
                    //fill="rgba(0,0,0,0.8)"
                    stroke="white"
                  />
                </div>
              </div>
              <span className="landing-feature-label">{f.label}</span>
            </button>
          )
        })}
      </div>

      <div className="landing-top-right-btns">
        <button
          className="gradient-border-sm gradient-border-sm--warning"
          onClick={() => onNavigate('crisis')}
          title="Crisis"
        >
          <div className="gradient-border-sm-inner">
            <TriangleAlert size={24} strokeWidth={2} stroke="#ffffff" fill="none" />
          </div>
        </button>
        <button
          className="gradient-border-sm"
          onClick={() => onNavigate('settings')}
          title="Settings"
        >
          <div className="gradient-border-sm-inner">
            <Settings size={24} strokeWidth={2} stroke="#ffffff" fill="none" />
          </div>
        </button>
      </div>
    </div>
  )
}


/* ═══════════════════════════════════════════
   New User Landing — Welcome Flow
   ═══════════════════════════════════════════ */

function NewUserLanding({ onNavigate, discordUser, system }) {
  const displayName = discordUser?.globalName || discordUser?.username || 'there'
  const avatarUrl = useMemo(() => {
    if (!discordUser?.discordID) return null
    if (discordUser?.avatar) {
      return `https://cdn.discordapp.com/avatars/${discordUser.discordID}/${discordUser.avatar}.png?size=256`
    }
    const idx = (BigInt(discordUser.discordID) >> 22n) % 6n
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`
  }, [discordUser])

  return (
    <div className="landing-newuser">
      <h1 className="landing-newuser-greeting">
        Hey <span className="username">{displayName}</span>
      </h1>

      <div className="landing-avatar-wrap">
        <div className="landing-avatar-inner">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} />
          ) : (
            <div className="landing-avatar-fallback">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      <h2 className="landing-newuser-welcome">Welcome to your new space!</h2>

      <div className="landing-newuser-actions">
        <button
          className="btn-gradient btn-gradient-rainbow"
          onClick={() => onNavigate('what-is')}
        >
          What is Systemiser?
        </button>
        <button
          className="btn-gradient btn-gradient-primary"
          onClick={() => onNavigate('register')}
        >
          Let's Get Started!
        </button>
      </div>
    </div>
  )
}


/* ═══════════════════════════════════════════
   Main Landing Page — Routes to Correct Variant
   ═══════════════════════════════════════════ */

export function LandingPage({ onNavigate, system, hasSystem, discordUser, staleSession, onContinueSession, onRestartSession }) {
  if (hasSystem) {
    return <ReturningLanding onNavigate={onNavigate} system={system} discordUser={discordUser} />
  }

  // Show stale session prompt if there's a recent registration attempt
  if (staleSession) {
    return (
      <div className="landing-page">
        <div className="landing-returning">
          <div className="landing-returning-avatar">
            <div className="avatar-placeholder">
              <User size={48} strokeWidth={2} />
            </div>
          </div>
          <h1 className="landing-returning-title">Welcome Back!</h1>
          <p className="landing-returning-subtitle">
            It looks like you started setting up your system but didn't finish.
          </p>
          <p className="landing-returning-subtitle" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            You were on step {staleSession.step} of registration.
          </p>
          <div className="landing-newuser-actions">
            <button
              className="btn-gradient btn-gradient-primary"
              onClick={onContinueSession}
            >
              Continue Setup
            </button>
            <button
              className="btn-gradient"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
              onClick={onRestartSession}
            >
              Start Fresh
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <NewUserLanding onNavigate={onNavigate} discordUser={discordUser} system={system} />
}

export default LandingPage
