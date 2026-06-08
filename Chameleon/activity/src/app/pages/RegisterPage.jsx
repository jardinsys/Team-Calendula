import React, { useState, useCallback } from 'react'
import { api } from '@chameleon/shared'

export function RegisterPage({ onNavigate, onRegistered }) {
  const [systemName, setSystemName] = useState('')
  const [isSystem, setIsSystem] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleRegister = useCallback(async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      await api.createSystem({
        name: systemName.trim() || undefined,
        sys_type: { isSystem },
      })
      onRegistered?.()
    } catch (err) {
      console.error('[Register] Error:', err)
      setError(err.message || 'Failed to create system')
      setSaving(false)
    }
  }, [systemName, isSystem, onRegistered])

  return (
    <div className="register-page">
      <h1>Create Your System</h1>
      <p>
        Set up your system profile. You can always change these settings later.
      </p>

      <form className="register-form" onSubmit={handleRegister}>
        <div className="form-group">
          <label>System name (optional)</label>
          <input
            className="text-input"
            type="text"
            value={systemName}
            onChange={e => setSystemName(e.target.value)}
            placeholder="e.g. The Colorwheel"
            maxLength={100}
            autoFocus
          />
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isSystem}
              onChange={e => setIsSystem(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            We are a system
          </label>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Uncheck if you're using Systemiser as a single user (e.g. for notes and friends)
          </p>
        </div>

        {error && (
          <p style={{ color: 'var(--color-error)', fontSize: '0.85rem' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
          <button
            type="submit"
            className="btn-gradient btn-gradient-primary"
            disabled={saving}
            style={{ flex: 1 }}
          >
            {saving ? 'Creating...' : 'Create System'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate(null)}
            style={{ height: '89px', padding: '0 36px' }}
          >
            ← Back
          </button>
        </div>
      </form>
    </div>
  )
}

export default RegisterPage
