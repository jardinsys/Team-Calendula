import React, { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { api, getSystemTerm, systemKeys, privacyBucketKeys, Icon } from '@chameleon/shared'

const SETTINGS_TABS = [
  { id: 'general', label: 'General', icon: 'settings' },
  { id: 'proxy', label: 'Proxy & Server', icon: 'wrench' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
  { id: 'privacy', label: 'Privacy Buckets', icon: 'lock' },
  { id: 'import', label: 'Import', icon: 'download' },
  { id: 'danger', label: 'Danger Zone', icon: 'alert' },
]

export function SettingsPage({ system: systemProp, onNavigate, discordUser }) {
  const queryClient = useQueryClient()
  const { data: system, isLoading } = useQuery({
    queryKey: systemKeys.detail(),
    queryFn: () => systemProp || api.getSystemFull(),
    staleTime: 30 * 1000,
  })
  const { data: privacyBuckets, isLoading: bucketsLoading } = useQuery({
    queryKey: privacyBucketKeys.list(),
    queryFn: () => api.getPrivacyBuckets(),
    staleTime: 30 * 1000,
    enabled: !!system,
  })
  const loading = isLoading && !system
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState('general')

  const [proxyStyle, setProxyStyle] = useState(systemProp?.proxy?.style || 'off')
  const [replyStyle, setReplyStyle] = useState(systemProp?.proxy?.replyStyle || 'embed')
  const [proxyCooldown, setProxyCooldown] = useState(systemProp?.setting?.proxyCoolDown || 0)
  const [proxyCaseSensitive, setProxyCaseSensitive] = useState(systemProp?.proxy?.caseSensitive || false)
  const [proxyBreak, setProxyBreak] = useState(systemProp?.proxy?.break || false)
  const [timezone, setTimezone] = useState(systemProp?.timezone || '')
  const [closedChar, setClosedChar] = useState(systemProp?.setting?.closedCharAllowed ?? true)
  const [autoshare, setAutoshare] = useState(systemProp?.setting?.autoshareNotestoUsers || false)
  const [syncDiscord, setSyncDiscord] = useState(systemProp?.syncWithApps?.discord ?? true)
  const [friendRequests, setFriendRequests] = useState(systemProp?._user?.settings?.notificationPreferences?.friendRequests ?? true)
  const [friendSwitches, setFriendSwitches] = useState(systemProp?._user?.settings?.notificationPreferences?.friendSwitches ?? true)
  const [appMessages, setAppMessages] = useState(systemProp?._user?.settings?.notificationPreferences?.appMessages ?? true)

  const [dangerView, setDangerView] = useState(null)
  const [wipeKeepFriends, setWipeKeepFriends] = useState(true)
  const [wipeLoading, setWipeLoading] = useState(false)
  const [wipeResult, setWipeResult] = useState(null)
  const [deleteStep, setDeleteStep] = useState(0)
  const [deleteNameInput, setDeleteNameInput] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteResult, setDeleteResult] = useState(null)

  // Privacy Buckets state
  const [editingBucketId, setEditingBucketId] = useState(null)
  const [editBucketName, setEditBucketName] = useState('')
  const [editBucketSettings, setEditBucketSettings] = useState({})
  const [showCreateBucket, setShowCreateBucket] = useState(false)
  const [newBucketName, setNewBucketName] = useState('')
  const [newBucketTemplate, setNewBucketTemplate] = useState('Friends')

  const createBucketMutation = useMutation({
    mutationFn: (data) => api.createPrivacyBucket(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: privacyBucketKeys.list() })
      setShowCreateBucket(false)
      setNewBucketName('')
    },
  })

  const updateBucketMutation = useMutation({
    mutationFn: ({ id, data }) => api.updatePrivacyBucket(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: privacyBucketKeys.list() })
      setEditingBucketId(null)
    },
  })

  const deleteBucketMutation = useMutation({
    mutationFn: (id) => api.deletePrivacyBucket(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: privacyBucketKeys.list() })
    },
  })

  const propagateBucketMutation = useMutation({
    mutationFn: ({ id, options }) => api.propagatePrivacyBucket(id, options),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: privacyBucketKeys.list() })
      queryClient.invalidateQueries({ queryKey: systemKeys.detail() })
      alert(`Propagated to ${result.updated?.alters || 0} alters, ${result.updated?.states || 0} states, ${result.updated?.groups || 0} groups`)
    },
    onError: (err) => alert(err.message),
  })

  const syncStateFromData = useCallback((data) => {
    setProxyStyle(data?.proxy?.style || 'off')
    setReplyStyle(data?.proxy?.replyStyle || 'embed')
    setProxyCooldown(data?.setting?.proxyCoolDown || 0)
    setProxyCaseSensitive(data?.proxy?.caseSensitive || false)
    setProxyBreak(data?.proxy?.break || false)
    setTimezone(data?.timezone || '')
    setClosedChar(data?.setting?.closedCharAllowed ?? true)
    setAutoshare(data?.setting?.autoshareNotestoUsers || false)
    setSyncDiscord(data?.syncWithApps?.discord ?? true)
  }, [])

  useEffect(() => {
    if (system) syncStateFromData(system)
  }, [system, syncStateFromData])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await api.updateSystem({
        proxy: {
          style: proxyStyle,
          replyStyle,
          caseSensitive: proxyCaseSensitive,
          break: proxyBreak,
          cooldown: proxyCooldown,
        },
        setting: {
          proxyCoolDown: proxyCooldown,
          closedCharAllowed: closedChar,
          autoshareNotestoUsers: autoshare,
        },
        syncWithApps: { discord: syncDiscord },
        timezone: timezone || undefined,
      })
      await api.updateUserSettings({
        notificationPreferences: {
          friendRequests,
          friendSwitches,
          appMessages,
        },
      })
      setSaved(true)
      queryClient.invalidateQueries({ queryKey: systemKeys.all })
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('[Settings] Save error:', err)
    } finally {
      setSaving(false)
    }
  }, [proxyStyle, replyStyle, proxyCooldown, proxyCaseSensitive, proxyBreak, timezone, closedChar, autoshare, syncDiscord, friendRequests, friendSwitches, appMessages])

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
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}><Icon name="heart" size={48} color="#60a5fa" /></div>
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

  const renderGeneralTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div className="settings-section">
        <div className="settings-section-title">Timezone & Locale</div>
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
      </div>

      <div className="settings-section">
        <div className="settings-section-title">System Behavior</div>
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

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={syncDiscord}
              onChange={e => setSyncDiscord(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            Sync with Discord
          </label>
        </div>
      </div>
    </div>
  )

  const renderProxyTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div className="settings-section">
        <div className="settings-section-title">Auto-Proxy</div>

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
          <label>Reply style</label>
          <select
            className="text-input"
            value={replyStyle}
            onChange={e => setReplyStyle(e.target.value)}
          >
            <option value="embed">Embed</option>
            <option value="native">Native Discord reply</option>
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

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={proxyCaseSensitive}
              onChange={e => setProxyCaseSensitive(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            Case-sensitive proxy matching
          </label>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={proxyBreak}
              onChange={e => setProxyBreak(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            Proxy break enabled
          </label>
        </div>
      </div>
    </div>
  )

  const renderNotificationsTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div className="settings-section">
        <div className="settings-section-title">Notifications</div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={friendRequests}
              onChange={e => setFriendRequests(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            Friend requests
          </label>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={friendSwitches}
              onChange={e => setFriendSwitches(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            Friend front switches
          </label>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={appMessages}
              onChange={e => setAppMessages(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            App messages
          </label>
        </div>
      </div>
    </div>
  )

  const renderPrivacyTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div className="settings-section">
        <div className="settings-section-title">Privacy Buckets</div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: '0.9rem' }}>
          Manage privacy buckets that control what friends can see. Each bucket has settings per entity type (alters, states, groups).
          <br />
          <strong>Strangers</strong> and <strong>Friends</strong> are default buckets and cannot be deleted or renamed.
        </p>

        {bucketsLoading ? (
          <div className="status-screen"><div className="spinner" /><p>Loading privacy buckets...</p></div>
        ) : privacyBuckets && privacyBuckets.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {privacyBuckets.map(bucket => {
              const isDefault = bucket.name === 'Strangers' || bucket.name === 'Friends'
              return (
                <div
                  key={bucket._id}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <strong style={{ fontSize: '1.1rem' }}>{bucket.name}</strong>
                      {isDefault && (
                        <span style={{ fontSize: '0.7rem', background: 'var(--accent)', color: 'var(--bg)', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                          Default
                        </span>
                      )}
                      {bucket.template && (
                        <span style={{ fontSize: '0.7rem', background: 'var(--accent-secondary)', color: 'var(--bg)', padding: '2px 8px', borderRadius: '4px' }}>
                          Template: {bucket.template}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {!editingBucketId || editingBucketId === bucket._id ? (
                        <>
                          {editingBucketId === bucket._id ? (
                            <button
                              className="btn-gradient btn-gradient-primary"
                              onClick={() => updateBucketMutation.mutate({ id: bucket._id, data: { name: editBucketName, settings: editBucketSettings } })}
                              disabled={updateBucketMutation.isPending}
                              style={{ height: '36px', padding: '0 16px', fontSize: '0.8rem' }}
                            >
                              {updateBucketMutation.isPending ? 'Saving...' : 'Save'}
                            </button>
                          ) : (
                            <button
                              className="btn-gradient btn-gradient-secondary"
                              onClick={() => {
                                setEditingBucketId(bucket._id)
                                setEditBucketName(bucket.name)
                                setEditBucketSettings({ ...bucket.settings })
                              }}
                              disabled={isDefault || editingBucketId !== null}
                              style={{ height: '36px', padding: '0 16px', fontSize: '0.8rem' }}
                            >
                              {isDefault ? (editingBucketId ? 'Cannot edit default' : 'View') : 'Edit'}
                            </button>
                          )}
                          {!isDefault && editingBucketId !== bucket._id && (
                            <button
                              className="btn-gradient btn-gradient-secondary"
                              onClick={() => {
                                if (confirm(`Delete "${bucket.name}" bucket?`)) {
                                  deleteBucketMutation.mutate(bucket._id)
                                }
                              }}
                              disabled={deleteBucketMutation.isPending}
                              style={{ height: '36px', padding: '0 16px', fontSize: '0.8rem', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}
                            >
                              Delete
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <button
                            className="btn-gradient btn-gradient-secondary"
                            onClick={() => propagateBucketMutation.mutate({ id: bucket._id, options: { entityTypes: ['alter', 'state', 'group'] } })}
                            disabled={propagateBucketMutation.isPending}
                            style={{ height: '36px', padding: '0 16px', fontSize: '0.8rem' }}
                          >
                            {propagateBucketMutation.isPending ? 'Propagating...' : 'Propagate to Entities'}
                          </button>
                          {isDefault && !editingBucketId && (
                            <button
                              className="btn-gradient btn-gradient-secondary"
                              onClick={() => {
                                setEditingBucketId(bucket._id)
                                setEditBucketName(bucket.name)
                                setEditBucketSettings({ ...bucket.settings })
                              }}
                              style={{ height: '36px', padding: '0 16px', fontSize: '0.8rem' }}
                            >
                              View Settings
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {editingBucketId === bucket._id && (
                    <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
                      <div className="form-group">
                        <label>Bucket Name</label>
                        <input
                          className="text-input"
                          type="text"
                          value={editBucketName}
                          onChange={e => setEditBucketName(e.target.value)}
                          disabled={isDefault}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginTop: '12px' }}>
                        {Object.entries(bucket.settings || {}).map(([key, value]) => (
                          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <input
                              type="checkbox"
                              checked={value}
                              onChange={e => setEditBucketSettings(s => ({ ...s, [key]: e.target.checked }))}
                              disabled={isDefault}
                              style={{ width: '16px', height: '16px' }}
                            />
                            <span style={{ textTransform: 'capitalize', color: isDefault ? 'var(--text-secondary)' : 'var(--text)' }}>
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            <button
              className="btn-gradient btn-gradient-secondary"
              onClick={() => setShowCreateBucket(true)}
              style={{ height: '48px', padding: '0 24px', fontSize: '0.9rem', alignSelf: 'flex-start' }}
            >
              + Create New Bucket
            </button>
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>No privacy buckets found.</p>
        )}

        {showCreateBucket && (
          <div style={{ marginTop: '16px', padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 12px' }}>Create New Bucket</h4>
            <div className="form-group">
              <label>Name</label>
              <input
                className="text-input"
                type="text"
                value={newBucketName}
                onChange={e => setNewBucketName(e.target.value)}
                placeholder="e.g. Family, Close Friends, Work"
              />
            </div>
            <div className="form-group">
              <label>Template</label>
              <select
                className="text-input"
                value={newBucketTemplate}
                onChange={e => setNewBucketTemplate(e.target.value)}
              >
                <option value="Strangers">Strangers (restrictive)</option>
                <option value="Friends">Friends (permissive)</option>
                <option value="custom">Custom (empty)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                className="btn-gradient btn-gradient-primary"
                onClick={() => createBucketMutation.mutate({ name: newBucketName, template: newBucketTemplate, settings: newBucketTemplate !== 'custom' ? undefined : {} })}
                disabled={createBucketMutation.isPending || !newBucketName.trim()}
                style={{ height: '40px', padding: '0 20px', fontSize: '0.85rem' }}
              >
                {createBucketMutation.isPending ? 'Creating...' : 'Create Bucket'}
              </button>
              <button
                className="btn-gradient btn-gradient-secondary"
                onClick={() => { setShowCreateBucket(false); setNewBucketName('') }}
                style={{ height: '40px', padding: '0 20px', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const renderImportTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div className="settings-section">
        <div className="settings-section-title">Import Data</div>
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
    </div>
  )

  const renderDangerTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
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

                {deleteStep >= 2 && (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <p style={{ color: deleteResult?.success ? '#86efac' : '#fca5a5', fontSize: '1rem', marginBottom: '16px' }}>
                      {deleteResult?.message}
                    </p>
                    {!deleteResult?.success && (
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
    </div>
  )

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general': return renderGeneralTab()
      case 'proxy': return renderProxyTab()
      case 'notifications': return renderNotificationsTab()
      case 'privacy': return renderPrivacyTab()
      case 'import': return renderImportTab()
      case 'danger': return renderDangerTab()
      default: return renderGeneralTab()
    }
  }

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      <div className="settings-tabs" style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
        {SETTINGS_TABS.map(tab => (
          <button
            key={tab.id}
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              border: 'none',
              background: activeTab === tab.id ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              borderRadius: 'var(--radius) var(--radius) 0 0',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: activeTab === tab.id ? 600 : 400,
              transition: 'all 0.15s ease',
              borderBottom: 'none',
              marginBottom: '-1px',
            }}
            onMouseEnter={e => { if (activeTab !== tab.id) e.target.style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { if (activeTab !== tab.id) e.target.style.background = 'transparent' }}
          >
            <Icon name={tab.icon} size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="settings-tab-content" style={{ animation: 'fadeIn 0.15s ease' }}>
        {renderTabContent()}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', marginTop: 'var(--space-lg)', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--border)' }}>
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