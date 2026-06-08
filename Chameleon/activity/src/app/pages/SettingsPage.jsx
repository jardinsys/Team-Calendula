import React, { useState, useEffect, useCallback } from 'react'
import { api, getSystemTerm } from '@chameleon/shared'

export function SettingsPage({ system: systemProp }) {
  const [system, setSystem] = useState(systemProp)
  const [loading, setLoading] = useState(!systemProp)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [proxyStyle, setProxyStyle] = useState(systemProp?.proxy?.style || 'off')
  const [proxyCooldown, setProxyCooldown] = useState(systemProp?.setting?.proxyCoolDown || 0)
  const [timezone, setTimezone] = useState(systemProp?.timezone || '')
  const [closedChar, setClosedChar] = useState(systemProp?.setting?.closedCharAllowed || false)
  const [autoshare, setAutoshare] = useState(systemProp?.setting?.autoshareNotestoUsers || false)

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

  const systemLabel = getSystemTerm(system, { context: 'label' })

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
