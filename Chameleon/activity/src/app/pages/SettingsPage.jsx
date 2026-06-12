import React, { useState, useEffect, useCallback } from 'react'
import { api, getSystemTerm } from '@chameleon/shared'

export function SettingsPage({ system: systemProp, onNavigate, discordUser }) {
  const [system, setSystem] = useState(systemProp)
  const [loading, setLoading] = useState(!systemProp)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [proxyStyle, setProxyStyle] = useState(systemProp?.proxy?.style || 'off')
  const [proxyCooldown, setProxyCooldown] = useState(systemProp?.setting?.proxyCoolDown || 0)
  const [timezone, setTimezone] = useState(systemProp?.timezone || '')
  const [closedChar, setClosedChar] = useState(systemProp?.setting?.closedCharAllowed || false)
  const [autoshare, setAutoshare] = useState(systemProp?.setting?.autoshareNotestoUsers || false)

  // Danger zone state
  const [dangerView, setDangerView] = useState(null) // null | 'wipe' | 'delete'
  const [wipeKeepFriends, setWipeKeepFriends] = useState(true)
  const [wipeLoading, setWipeLoading] = useState(false)
  const [wipeResult, setWipeResult] = useState(null)
  const [deleteStep, setDeleteStep] = useState(0) // 0=warning, 1=type name
  const [deleteNameInput, setDeleteNameInput] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteResult, setDeleteResult] = useState(null)

  useEffect(() => {
    if (systemProp) {
      setSystem(systemProp)
      setProxyStyle(systemProp?.proxy?.style || 'off')
      setProxyCooldown(systemProp?.setting?.proxyCoolDown || 0)
      setTimezone(systemProp?.timezone || '')
      setClosedChar(systemProp?.setting?.closedCharAllowed || false)
      setAutoshare(systemProp?.setting?.autoshareNotestoUsers || false)
      setLoading(false)
      return
    }

    let cancelled = false
    api.getSystemFull()
      .then(data => {
        if (!cancelled) {
          setSystem(data)
          setProxyStyle(data?.proxy?.style || 'off')
          setProxyCooldown(data?.setting?.proxyCoolDown || 0)
          setTimezone(data?.timezone || '')
          setClosedChar(data?.setting?.closedCharAllowed || false)
          setAutoshare(data?.setting?.autoshareNotestoUsers || false)
          setLoading(false)
        }
      })
      .catch(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [systemProp])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await api.updateSystem({
        proxy: { style: proxyStyle },
        setting: {
          proxyCoolDown: proxyCooldown,
          closedCharAllowed: closedChar,
          autoshareNotestoUsers: autoshare,
        },
        timezone: timezone || undefined,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('[Settings] Save error:', err)
    } finally {
      setSaving(false)
    }
  }, [proxyStyle, proxyCooldown, timezone, closedChar, autoshare])

  const handleWipe = useCallback(async () => {
    setWipeLoading(true)
    setWipeResult(null)
    try {
      await api.wipeData(wipeKeepFriends)
      setWipeResult({ success: true, message: 'Data wiped successfully.' })
    } catch (err) {
      setWipeResult({ success: false, message: err.message || 'Failed to wipe data.' })
    } finally {
      setWipeLoading(false)
    }
  }, [wipeKeepFriends])

  const confirmName = system?.name?.display || discordUser?.username || ''

  const handleDelete = useCallback(async () => {
    if (!confirmName) return
    setDeleteLoading(true)
    setDeleteResult(null)
    try {
      await api.deleteAccount(deleteNameInput)
      setDeleteResult({ success: true, message: 'Account deleted. You may close this window.' })
      // Clear token so next load requires re-auth
      api.setToken(null)
      if (typeof window !== 'undefined') localStorage.removeItem('systemiser_discord_token')
    } catch (err) {
      setDeleteResult({ success: false, message: err.message || 'Failed to delete account.' })
    } finally {
      setDeleteLoading(false)
    }
  }, [deleteNameInput, confirmName])

  const systemLabel = getSystemTerm(system, { context: 'label' })

  if (deleteResult?.success) {
    return (
      <div className="settings-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>💙</div>
        <h1 style={{ color: 'var(--text)', marginBottom: '8px' }}>Sorry to see you go</h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: '1.6', marginBottom: '24px' }}>
          Your account has been deleted. All your data has been removed.
          {systemLabel && ` Your ${systemLabel.toLowerCase()} and everything in it has been cleared.`}
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px' }}>
          If you ever want to come back, you can create a new account anytime.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            You may close this window.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="status-screen">
        <div className="spinner" />
        <p>Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      <div className="settings-section">
        <div className="settings-section-title">Proxy</div>

        <div className="form-group">
          <label>Auto-proxy style</label>
          <select
            className="text-input"
            value={proxyStyle}
            onChange={e => setProxyStyle(e.target.value)}
          >
            <option value="off">Off</option>
            <option value="last">Last used</option>
            <option value="front">Current fronter</option>
          </select>
        </div>

        <div className="form-group">
          <label>Cooldown (seconds)</label>
          <input
            className="text-input"
            type="number"
            min="0"
            max="3600"
            value={proxyCooldown}
            onChange={e => setProxyCooldown(parseInt(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">General</div>

        <div className="form-group">
          <label>Timezone</label>
          <input
            className="text-input"
            type="text"
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            placeholder="e.g. America/New_York"
          />
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={closedChar}
              onChange={e => setClosedChar(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            Closed character mode
          </label>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoshare}
              onChange={e => setAutoshare(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            Auto-share notes with friends
          </label>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Import</div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: '0.9rem' }}>
          Import data from PluralKit, Simply Plural, Octocon, or Tupperbox.
        </p>
        <button
          className="btn-gradient btn-gradient-secondary"
          onClick={() => onNavigate?.('import')}
          style={{ height: '48px', padding: '0 24px', fontSize: '0.9rem' }}
        >
          Open Import
        </button>
      </div>

      {/* TODO: Add 2FA verification step before destructive actions */}
      <div className="settings-section" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
        <div className="settings-section-title" style={{ color: '#ef4444' }}>Danger Zone</div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: '0.9rem' }}>
          Irreversible actions. Please read carefully.
        </p>

        {!dangerView && (
          <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <button
              className="btn-gradient btn-gradient-secondary"
              onClick={() => setDangerView('wipe')}
              style={{ height: '48px', padding: '0 24px', fontSize: '0.9rem', borderColor: 'rgba(251, 191, 36, 0.4)', color: '#fbbf24' }}
            >
              Wipe Data
            </button>
            <button
              className="btn-gradient btn-gradient-secondary"
              onClick={() => setDangerView('delete')}
              style={{ height: '48px', padding: '0 24px', fontSize: '0.9rem', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}
            >
              Delete Account
            </button>
          </div>
        )}

        {dangerView === 'wipe' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {!wipeResult ? (
              <>
                <div style={{ background: 'rgba(251, 191, 36, 0.08)', borderRadius: 'var(--radius)', padding: '16px', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                  <p style={{ color: 'var(--text)', marginBottom: '8px', fontWeight: 600 }}>This will delete:</p>
                  <ul style={{ color: 'var(--text-secondary)', margin: 0, paddingLeft: '20px', fontSize: '0.9rem' }}>
                    <li>All your notes (and their R2 content)</li>
                    <li>All your proxied messages</li>
                  </ul>
                  <p style={{ color: 'var(--text)', marginTop: '12px', marginBottom: '0', fontWeight: 600 }}>This will keep:</p>
                  <ul style={{ color: 'var(--text-secondary)', margin: 0, paddingLeft: '20px', fontSize: '0.9rem' }}>
                    <li>Your {systemLabel.toLowerCase()} and all entities</li>
                    <li>Front layers and shift history</li>
                    <li>All settings</li>
                  </ul>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer', color: 'var(--text)', fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={wipeKeepFriends}
                    onChange={e => setWipeKeepFriends(e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  Keep friends list
                </label>
                <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                  <button
                    className="btn-gradient btn-gradient-secondary"
                    onClick={handleWipe}
                    disabled={wipeLoading}
                    style={{ height: '48px', padding: '0 24px', fontSize: '0.9rem', borderColor: 'rgba(251, 191, 36, 0.4)', color: '#fbbf24' }}
                  >
                    {wipeLoading ? 'Wiping...' : 'Confirm Wipe'}
                  </button>
                  <button
                    className="btn-gradient btn-gradient-secondary"
                    onClick={() => setDangerView(null)}
                    style={{ height: '48px', padding: '0 24px', fontSize: '0.9rem' }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <p style={{ color: wipeResult.success ? '#86efac' : '#fca5a5', fontSize: '1rem', marginBottom: '16px' }}>
                  {wipeResult.message}
                </p>
                <button
                  className="btn-gradient btn-gradient-secondary"
                  onClick={() => { setDangerView(null); setWipeResult(null) }}
                  style={{ height: '48px', padding: '0 24px', fontSize: '0.9rem' }}
                >
                  Back to Settings
                </button>
              </div>
            )}
          </div>
        )}

        {dangerView === 'delete' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {!deleteResult ? (
              <>
                {deleteStep === 0 && (
                  <>
                    <div style={{ background: 'rgba(239, 68, 68, 0.08)', borderRadius: 'var(--radius)', padding: '16px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      <p style={{ color: '#ef4444', marginBottom: '8px', fontWeight: 600 }}>This action is permanent and cannot be undone.</p>
                      {system?.users?.length > 1 ? (
                        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
                          Your account will be removed from this {systemLabel.toLowerCase()}, but the {systemLabel.toLowerCase()} and its data will remain for other members.
                        </p>
                      ) : (
                        <>
                          <p style={{ color: 'var(--text)', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem' }}>This will permanently delete:</p>
                          <ul style={{ color: 'var(--text-secondary)', margin: 0, paddingLeft: '20px', fontSize: '0.9rem' }}>
                            <li>Your {systemLabel.toLowerCase()} and all entities</li>
                            <li>All notes, messages, and media</li>
                            <li>Front layers, shifts, and history</li>
                            <li>All settings and privacy buckets</li>
                            <li>Your account</li>
                          </ul>
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                      <button
                        className="btn-gradient btn-gradient-secondary"
                        onClick={() => setDeleteStep(1)}
                        style={{ height: '48px', padding: '0 24px', fontSize: '0.9rem', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}
                      >
                        I understand, continue
                      </button>
                      <button
                        className="btn-gradient btn-gradient-secondary"
                        onClick={() => setDangerView(null)}
                        style={{ height: '48px', padding: '0 24px', fontSize: '0.9rem' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}

                {deleteStep === 1 && (
                  <>
                    <p style={{ color: 'var(--text)', fontSize: '0.9rem' }}>
                      Type <strong>{confirmName}</strong> to confirm:
                    </p>
                    <input
                      className="text-input"
                      type="text"
                      value={deleteNameInput}
                      onChange={e => setDeleteNameInput(e.target.value)}
                      placeholder={confirmName}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                      <button
                        className="btn-gradient btn-gradient-secondary"
                        onClick={handleDelete}
                        disabled={deleteLoading || deleteNameInput.trim().toLowerCase() !== confirmName.toLowerCase()}
                        style={{ height: '48px', padding: '0 24px', fontSize: '0.9rem', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444', opacity: (deleteLoading || deleteNameInput.trim().toLowerCase() !== confirmName.toLowerCase()) ? 0.5 : 1 }}
                      >
                        {deleteLoading ? 'Deleting...' : 'Delete My Account'}
                      </button>
                      <button
                        className="btn-gradient btn-gradient-secondary"
                        onClick={() => { setDeleteStep(0); setDeleteNameInput('') }}
                        style={{ height: '48px', padding: '0 24px', fontSize: '0.9rem' }}
                      >
                        Back
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <p style={{ color: deleteResult.success ? '#86efac' : '#fca5a5', fontSize: '1rem', marginBottom: '16px' }}>
                  {deleteResult.message}
                </p>
                {!deleteResult.success && (
                  <button
                    className="btn-gradient btn-gradient-secondary"
                    onClick={() => { setDangerView(null); setDeleteResult(null); setDeleteStep(0); setDeleteNameInput('') }}
                    style={{ height: '48px', padding: '0 24px', fontSize: '0.9rem' }}
                  >
                    Back to Settings
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', marginTop: 'var(--space-lg)' }}>
        <button
          className="btn-gradient btn-gradient-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ height: '56px', padding: '0 32px', fontSize: '1rem' }}
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

export default SettingsPage
