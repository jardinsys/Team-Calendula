import React, { useState, useEffect, useCallback } from 'react'
import { api, Icon, getSystemTerm } from '@chameleon/shared'

const TABS = [
    { key: 'general', label: 'General', icon: 'settings' },
    { key: 'proxy', label: 'Proxy', icon: 'shuffle' },
    { key: 'notifications', label: 'Notifications', icon: 'zap' },
    { key: 'notes', label: 'Notes', icon: 'fileText' },
    { key: 'import', label: 'Import', icon: 'package' },
    { key: 'danger', label: 'Danger Zone', icon: 'alert' },
]

function SettingsPanel({ system: systemProp, discordUser, onClose, onNavigate }) {
    const [system, setSystem] = useState(systemProp)
    const [activeTab, setActiveTab] = useState('general')
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    // General state
    const [timezone, setTimezone] = useState(systemProp?.timezone || '')
    const [closedChar, setClosedChar] = useState(systemProp?.setting?.closedCharAllowed ?? true)
    const [syncDiscord, setSyncDiscord] = useState(systemProp?.syncWithApps?.discord ?? true)

    // Proxy state
    const [proxyStyle, setProxyStyle] = useState(systemProp?.proxy?.style || 'off')
    const [replyStyle, setReplyStyle] = useState(systemProp?.proxy?.replyStyle || 'embed')
    const [proxyCooldown, setProxyCooldown] = useState(systemProp?.setting?.proxyCoolDown || 0)
    const [proxyCaseSensitive, setProxyCaseSensitive] = useState(systemProp?.proxy?.caseSensitive || false)
    const [proxyBreak, setProxyBreak] = useState(systemProp?.proxy?.break || false)

    // Notifications state
    const [friendRequests, setFriendRequests] = useState(systemProp?._user?.settings?.notificationPreferences?.friendRequests ?? true)
    const [friendSwitches, setFriendSwitches] = useState(systemProp?._user?.settings?.notificationPreferences?.friendSwitches ?? true)
    const [appMessages, setAppMessages] = useState(systemProp?._user?.settings?.notificationPreferences?.appMessages ?? true)

    // Notes state
    const [autoshare, setAutoshare] = useState(systemProp?.setting?.autoshareNotestoUsers || false)

    // Danger zone state
    const [dangerView, setDangerView] = useState(null)
    const [wipeKeepFriends, setWipeKeepFriends] = useState(true)
    const [wipeLoading, setWipeLoading] = useState(false)
    const [wipeResult, setWipeResult] = useState(null)
    const [deleteStep, setDeleteStep] = useState(0)
    const [deleteNameInput, setDeleteNameInput] = useState('')
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [deleteResult, setDeleteResult] = useState(null)

    const syncStateFromData = useCallback((data) => {
        setTimezone(data?.timezone || '')
        setClosedChar(data?.setting?.closedCharAllowed ?? true)
        setSyncDiscord(data?.syncWithApps?.discord ?? true)
        setProxyStyle(data?.proxy?.style || 'off')
        setReplyStyle(data?.proxy?.replyStyle || 'embed')
        setProxyCooldown(data?.setting?.proxyCoolDown || 0)
        setProxyCaseSensitive(data?.proxy?.caseSensitive || false)
        setProxyBreak(data?.proxy?.break || false)
        setAutoshare(data?.setting?.autoshareNotestoUsers || false)
    }, [])

    useEffect(() => {
        if (systemProp) {
            setSystem(systemProp)
            syncStateFromData(systemProp)
            return
        }
        api.getSystemFull().then(data => {
            setSystem(data)
            syncStateFromData(data)
        }).catch(() => {})
    }, [systemProp, syncStateFromData])

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
            }).catch(() => {})
            setSaved(true)
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
    const systemLabel = getSystemTerm(system, { context: 'label' })

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

    const handleImportClick = () => {
        onClose()
        onNavigate?.('import')
    }

    const renderTabContent = () => {
        switch (activeTab) {
            case 'general': return (
                <div className="settings-panel-section">
                    <div className="settings-panel-section-title">General</div>

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
                        <label className="settings-panel-checkbox">
                            <input
                                type="checkbox"
                                checked={closedChar}
                                onChange={e => setClosedChar(e.target.checked)}
                            />
                            Closed character mode
                        </label>
                    </div>

                    <div className="form-group">
                        <label className="settings-panel-checkbox">
                            <input
                                type="checkbox"
                                checked={syncDiscord}
                                onChange={e => setSyncDiscord(e.target.checked)}
                            />
                            Sync with Discord
                        </label>
                    </div>
                </div>
            )

            case 'proxy': return (
                <div className="settings-panel-section">
                    <div className="settings-panel-section-title">Proxy</div>

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
                        <label className="settings-panel-checkbox">
                            <input
                                type="checkbox"
                                checked={proxyCaseSensitive}
                                onChange={e => setProxyCaseSensitive(e.target.checked)}
                            />
                            Case-sensitive proxy matching
                        </label>
                    </div>

                    <div className="form-group">
                        <label className="settings-panel-checkbox">
                            <input
                                type="checkbox"
                                checked={proxyBreak}
                                onChange={e => setProxyBreak(e.target.checked)}
                            />
                            Proxy break enabled
                        </label>
                    </div>
                </div>
            )

            case 'notifications': return (
                <div className="settings-panel-section">
                    <div className="settings-panel-section-title">Notifications</div>

                    <div className="form-group">
                        <label className="settings-panel-checkbox">
                            <input
                                type="checkbox"
                                checked={friendRequests}
                                onChange={e => setFriendRequests(e.target.checked)}
                            />
                            Friend requests
                        </label>
                    </div>

                    <div className="form-group">
                        <label className="settings-panel-checkbox">
                            <input
                                type="checkbox"
                                checked={friendSwitches}
                                onChange={e => setFriendSwitches(e.target.checked)}
                            />
                            Friend front switches
                        </label>
                    </div>

                    <div className="form-group">
                        <label className="settings-panel-checkbox">
                            <input
                                type="checkbox"
                                checked={appMessages}
                                onChange={e => setAppMessages(e.target.checked)}
                            />
                            App messages
                        </label>
                    </div>

                    {systemProp?._user?.friends?.length > 0 && (
                        <>
                            <div className="settings-panel-section-title" style={{ marginTop: 'var(--space-md)', fontSize: '0.85rem' }}>
                                Per-Friend Switch Notifications
                            </div>
                            {systemProp._user.friends.map((f, i) => {
                                const name = typeof f.customName === 'string' ? f.customName : f.customName?.display || f.customName?.indexable || f.discordID;
                                const isEnabled = f.notifyOnSwitch !== false;
                                return (
                                    <div key={f.friendID || f.discordID || i} className="form-group">
                                        <label className="settings-panel-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={isEnabled}
                                                onChange={async (e) => {
                                                    try {
                                                        await api.updateFriend(f.friendID || f.discordID, {
                                                            notifyOnSwitch: e.target.checked
                                                        });
                                                    } catch (err) {
                                                        console.error('Failed to update friend notification:', err);
                                                    }
                                                }}
                                            />
                                            {name}
                                        </label>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            )

            case 'notes': return (
                <div className="settings-panel-section">
                    <div className="settings-panel-section-title">Notes</div>

                    <div className="form-group">
                        <label className="settings-panel-checkbox">
                            <input
                                type="checkbox"
                                checked={autoshare}
                                onChange={e => setAutoshare(e.target.checked)}
                            />
                            Auto-share notes with friends
                        </label>
                    </div>
                </div>
            )

            case 'import': return (
                <div className="settings-panel-section">
                    <div className="settings-panel-section-title">Import</div>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: '0.85rem' }}>
                        Import data from PluralKit, Simply Plural, Octocon, or Tupperbox.
                    </p>
                    <button
                        className="btn btn-primary"
                        onClick={handleImportClick}
                        style={{ width: '100%' }}
                    >
                        Open Import
                    </button>
                </div>
            )

            case 'danger': return (
                <div className="settings-panel-section settings-panel-section--danger">
                    <div className="settings-panel-section-title settings-panel-section-title--danger">Danger Zone</div>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: '0.85rem' }}>
                        Irreversible actions. Please read carefully.
                    </p>

                    {!dangerView && (
                        <div style={{ display: 'flex', gap: 'var(--space-md)', flexDirection: 'column' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setDangerView('wipe')}
                                style={{ borderColor: 'rgba(251, 191, 36, 0.4)', color: '#fbbf24' }}
                            >
                                Wipe Data
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setDangerView('delete')}
                                style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}
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
                                        <p style={{ color: 'var(--text)', marginBottom: '8px', fontWeight: 600, fontSize: '0.85rem' }}>This will delete:</p>
                                        <ul style={{ color: 'var(--text-secondary)', margin: 0, paddingLeft: '20px', fontSize: '0.8rem' }}>
                                            <li>All your notes (and their R2 content)</li>
                                            <li>All your proxied messages</li>
                                        </ul>
                                        <p style={{ color: 'var(--text)', marginTop: '12px', marginBottom: '0', fontWeight: 600, fontSize: '0.85rem' }}>This will keep:</p>
                                        <ul style={{ color: 'var(--text-secondary)', margin: 0, paddingLeft: '20px', fontSize: '0.8rem' }}>
                                            <li>Your {systemLabel.toLowerCase()} and all entities</li>
                                            <li>Front layers and shift history</li>
                                            <li>All settings</li>
                                        </ul>
                                    </div>
                                    <label className="settings-panel-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={wipeKeepFriends}
                                            onChange={e => setWipeKeepFriends(e.target.checked)}
                                        />
                                        Keep friends list
                                    </label>
                                    <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={handleWipe}
                                            disabled={wipeLoading}
                                            style={{ borderColor: 'rgba(251, 191, 36, 0.4)', color: '#fbbf24' }}
                                        >
                                            {wipeLoading ? 'Wiping...' : 'Confirm Wipe'}
                                        </button>
                                        <button className="btn btn-ghost" onClick={() => setDangerView(null)}>
                                            Cancel
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '20px' }}>
                                    <p style={{ color: wipeResult.success ? '#86efac' : '#fca5a5', fontSize: '0.9rem', marginBottom: '16px' }}>
                                        {wipeResult.message}
                                    </p>
                                    <button className="btn btn-ghost" onClick={() => { setDangerView(null); setWipeResult(null) }}>
                                        Back
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
                                                <p style={{ color: '#ef4444', marginBottom: '8px', fontWeight: 600, fontSize: '0.85rem' }}>This action is permanent and cannot be undone.</p>
                                                {system?.users?.length > 1 ? (
                                                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.8rem' }}>
                                                        Your account will be removed from this {systemLabel.toLowerCase()}, but the {systemLabel.toLowerCase()} and its data will remain for other members.
                                                    </p>
                                                ) : (
                                                    <>
                                                        <p style={{ color: 'var(--text)', marginBottom: '8px', fontWeight: 600, fontSize: '0.8rem' }}>This will permanently delete:</p>
                                                        <ul style={{ color: 'var(--text-secondary)', margin: 0, paddingLeft: '20px', fontSize: '0.8rem' }}>
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
                                                    className="btn btn-secondary"
                                                    onClick={() => setDeleteStep(1)}
                                                    style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}
                                                >
                                                    I understand, continue
                                                </button>
                                                <button className="btn btn-ghost" onClick={() => setDangerView(null)}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </>
                                    )}

                                    {deleteStep === 1 && (
                                        <>
                                            <p style={{ color: 'var(--text)', fontSize: '0.85rem' }}>
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
                                                    className="btn btn-secondary"
                                                    onClick={handleDelete}
                                                    disabled={deleteLoading || deleteNameInput.trim().toLowerCase() !== confirmName.toLowerCase()}
                                                    style={{
                                                        borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444',
                                                        opacity: (deleteLoading || deleteNameInput.trim().toLowerCase() !== confirmName.toLowerCase()) ? 0.5 : 1
                                                    }}
                                                >
                                                    {deleteLoading ? 'Deleting...' : 'Delete My Account'}
                                                </button>
                                                <button className="btn btn-ghost" onClick={() => { setDeleteStep(0); setDeleteNameInput('') }}>
                                                    Back
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '20px' }}>
                                    <p style={{ color: deleteResult.success ? '#86efac' : '#fca5a5', fontSize: '0.9rem', marginBottom: '16px' }}>
                                        {deleteResult.message}
                                    </p>
                                    {!deleteResult.success && (
                                        <button className="btn btn-ghost" onClick={() => { setDangerView(null); setDeleteResult(null); setDeleteStep(0); setDeleteNameInput('') }}>
                                            Back
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )

            default: return null
        }
    }

    return (
        <div className="settings-panel-overlay">
            <div className="settings-panel">
                {/* Header */}
                <div className="settings-panel-header">
                    <h1 className="settings-panel-title">Settings</h1>
                    <button className="btn btn-ghost settings-panel-close" onClick={onClose}>
                        <Icon name="x" size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="settings-panel-tabs">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            className={`settings-panel-tab ${activeTab === tab.key ? 'settings-panel-tab--active' : ''} ${tab.key === 'danger' ? 'settings-panel-tab--danger' : ''}`}
                            onClick={() => {
                                setActiveTab(tab.key)
                                setDangerView(null)
                                setWipeResult(null)
                                setDeleteResult(null)
                                setDeleteStep(0)
                            }}
                        >
                            <Icon name={tab.icon} size={16} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="settings-panel-content">
                    {renderTabContent()}
                </div>

                {/* Save bar */}
                {activeTab !== 'danger' && activeTab !== 'import' && (
                    <div className="settings-panel-footer">
                        <button
                            className="btn btn-primary"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export { SettingsPanel }
