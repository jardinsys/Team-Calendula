import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { api, isSystemUser, isFragmentedUser, isDissociativeUser, Icon, getSystemTerm } from '@chameleon/shared'
import { useFetchStatus } from '../../hooks/useFetchStatus.jsx'
import { useSystemSession } from '../../hooks/useSystemSession.jsx'

const SOURCES = [
    {
        id: 'pluralkit', label: 'PluralKit', icon: '🦊',
        methods: [
            { id: 'api', label: 'API Import', tokenLabel: 'API Token', tokenPlaceholder: 'Your PluralKit token (DM PluralKit: pk;token)', help: 'DM PluralKit with pk;token to get your token', privacyNote: null },
            { id: 'file', label: 'File Import', help: 'Export with: /export in DMs with PluralKit', privacyNote: 'Your export file may contain private data (descriptions, pronouns, avatar URLs, proxy patterns). This data will only be stored in your system\'s database.' },
        ],
    },
    {
        id: 'simplyplural', label: 'Simply Plural', icon: '&',
        methods: [
            { id: 'api', label: 'API Import', tokenLabel: 'API Token', tokenPlaceholder: 'Your SP API token', help: 'Settings → Developer → Add Token', privacyNote: null },
        ],
    },
    {
        id: 'octocon', label: 'Octocon', icon: '🧠',
        methods: [
            { id: 'api', label: 'API Import', tokenLabel: 'System ID', tokenPlaceholder: '7-char ID or octocon.app/u/yourid URL', help: 'octocon.app/u/yourid', privacyNote: null },
            { id: 'file', label: 'File Import', help: 'Export from octocon.app → Settings → Export', privacyNote: 'Your export file may contain private data (descriptions, pronouns, avatar URLs, proxy patterns, front history). This data will only be stored in your system\'s database.' },
        ],
    },
    {
        id: 'tupperbox', label: 'Tupperbox', icon: '📦',
        methods: [
            { id: 'file', label: 'File Import', help: 'Export with: tul!export', privacyNote: 'Your export file may contain private data (descriptions, avatar URLs, proxy brackets). This data will only be stored in your system\'s database.' },
        ],
    },
]

const METHOD_ICONS = { api: '🔗', file: '📄' }
const PHASE_ICONS = { fetching: '🔍', members: '👤', groups: '📦', switches: '🔄', saving: '💾', complete: '✅', error: '❌' }

function getSourceTerm(source) {
    const terms = { pluralkit: 'members', simplyplural: 'members', octocon: 'alters', tupperbox: 'tuppers' }
    return terms[source] || 'members'
}

const DISCORD_OVERLAY_DESC = (
    <div style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
        <strong>Discord Overlay</strong> imports data directly into your Discord bot profile.
        <br />
        This creates/updates alters, groups, and switch history that the bot uses for proxying,
        front tracking, and commands like <code>pk;switch</code> or <code>/switch</code>.
        <br />
        <br />
        <strong>Main Profile</strong> is your web app profile (this activity) — used for the dashboard,
        notes, friends, and the full Switch page UI.
    </div>
)

const TARGET_OPTIONS = [
    { value: 'app', label: 'Main Profile', desc: 'Web app dashboard, notes, friends, Switch page' },
    { value: 'discord', label: 'Discord Overlay', desc: 'Bot proxying, front tracking, Discord commands' },
]

export function ImportPage({ system, onNavigate }) {
    const systemTerm = getSystemTerm(system, { context: 'label' }) || 'system'
    const { markPrivateFromPreview } = useSystemSession()

    if (!system) {
        return (
            <div className="page-container" style={{ padding: '24px', textAlign: 'center' }}>
                <div className="card" style={{ padding: '32px', maxWidth: '400px', margin: '40px auto' }}>
                    <h2 style={{ marginBottom: '12px' }}>No {systemTerm} Found</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                        You need to register a {systemTerm} before importing data.
                    </p>
                    <button
                        className="btn-gradient btn-gradient-primary"
                        onClick={() => onNavigate?.('register')}
                    >
                        Register Now
                    </button>
                </div>
            </div>
        )
    }

    const [phase, setPhase] = useState('select')
    const [selectedSources, setSelectedSources] = useState(new Set())
    const [sourceConfigs, setSourceConfigs] = useState({})
    const [previews, setPreviews] = useState({})
    const [currentPreviewSource, setCurrentPreviewSource] = useState(null)
    const [importResults, setImportResults] = useState([])
    const [error, setError] = useState(null)
    const [configuringSource, setConfiguringSource] = useState(null)

    const { status: fetchStatus, start: startFetch, complete: completeFetch, error: errorFetch, render: renderFetchStatus } = useFetchStatus()

    const isSystem = isSystemUser(system)
    const isFrag = isFragmentedUser(system)
    const isDissoc = isDissociativeUser(system)
    const forceAsStates = !isSystem && (isFrag || isDissoc)

    const getDefaultConfig = (sourceId) => {
        const src = SOURCES.find(s => s.id === sourceId)
        const method = src?.methods[0]?.id || 'file'
        return {
            method,
            token: '',
            fileData: null,
            fileName: '',
            target: 'app',
            replace: false,
            skipExisting: false,
            noGroups: false,
            noSwitches: false,
            selectedMemberIds: new Set(),
            selectedGroupIds: new Set(),
            memberEntityTypes: {},
            entityTypeMode: forceAsStates ? 'all_states' : 'all_alters',
        }
    }

    const updateSourceConfig = useCallback((sourceId, patch) => {
        setSourceConfigs(prev => ({
            ...prev,
            [sourceId]: { ...getDefaultConfig(sourceId), ...prev[sourceId], ...patch }
        }))
    }, [])

    const toggleSource = useCallback((sourceId) => {
        setSelectedSources(prev => {
            const next = new Set(prev)
            if (next.has(sourceId)) next.delete(sourceId)
            else next.add(sourceId)
            return next
        })
    }, [])

    const handleStartConfigure = useCallback(() => {
        if (selectedSources.size === 0) return
        const newConfigs = { ...sourceConfigs }
        for (const id of selectedSources) {
            if (!newConfigs[id]) newConfigs[id] = getDefaultConfig(id)
        }
        setSourceConfigs(newConfigs)
        setConfiguringSource(Array.from(selectedSources)[0])
        setPhase('configure')
    }, [selectedSources, sourceConfigs])

    const handleQuickImport = useCallback((sourceId) => {
        setSelectedSources(new Set([sourceId]))
        setSourceConfigs({ [sourceId]: getDefaultConfig(sourceId) })
        setConfiguringSource(sourceId)
        setPhase('configure')
    }, [])

    const handleFileChange = useCallback((sourceId, e) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result)
                updateSourceConfig(sourceId, { fileData: data, fileName: file.name })
                setError(null)
            } catch {
                setError('Invalid JSON file')
                updateSourceConfig(sourceId, { fileData: null, fileName: '' })
            }
        }
        reader.readAsText(file)
    }, [updateSourceConfig])

    const handleBackToSelect = useCallback(() => {
        setPhase('select')
    }, [])

    const handleFetchAllPreviews = useCallback(async () => {
        for (const sourceId of selectedSources) {
            const cfg = sourceConfigs[sourceId]
            const src = SOURCES.find(s => s.id === sourceId)
            const method = src?.methods.find(m => m.id === cfg.method)
            if (cfg.method === 'api' && !cfg.token.trim()) {
                setError(`Enter token/ID for ${src?.label}`)
                return
            }
            if (cfg.method === 'file' && !cfg.fileData) {
                setError(`Select export file for ${src?.label}`)
                return
            }
        }
        setPhase('preview')
    }, [selectedSources, sourceConfigs])

    const fetchPreviewForSource = useCallback(async (sourceId) => {
        const cfg = sourceConfigs[sourceId]
        const src = SOURCES.find(s => s.id === sourceId)
        setCurrentPreviewSource(sourceId)
        startFetch(`Fetching preview from ${src?.label}...`)

        try {
            const res = await api.previewImport(sourceId, cfg.token.trim() || null, cfg.fileData)
            setPreviews(prev => ({ ...prev, [sourceId]: res.preview }))

            const allMemberIds = new Set(res.preview.members.map(m => m.sourceId))
            const allGroupIds = new Set(res.preview.groups.map(g => g.sourceId))
            const types = {}
            res.preview.members.forEach(m => { types[m.sourceId] = forceAsStates ? 'state' : 'alter' })

            setSourceConfigs(prev => ({
                ...prev,
                [sourceId]: {
                    ...prev[sourceId],
                    selectedMemberIds: allMemberIds,
                    selectedGroupIds: allGroupIds,
                    memberEntityTypes: types,
                    entityTypeMode: forceAsStates ? 'all_states' : 'all_alters',
                }
            }))

            completeFetch(`Loaded ${res.preview.members.length} members, ${res.preview.groups.length} groups from ${src?.label}`)
        } catch (err) {
            errorFetch(err.message || 'Failed to fetch preview')
            setError(`${src?.label}: ${err.message || 'Failed to fetch preview'}`)
        } finally {
            setCurrentPreviewSource(null)
        }
    }, [sourceConfigs, forceAsStates, startFetch, completeFetch, errorFetch])

    useEffect(() => {
        if (phase !== 'preview') return
        const sourcesArray = Array.from(selectedSources)
        let idx = 0

        const fetchNext = async () => {
            if (idx >= sourcesArray.length) return
            await fetchPreviewForSource(sourcesArray[idx])
            idx++
            fetchNext()
        }
        fetchNext()
    }, [phase, selectedSources, fetchPreviewForSource])

    const handleImportAll = useCallback(async () => {
        setPhase('importing')
        setImportResults([])
        setError(null)

        const sourcesArray = Array.from(selectedSources)
        for (const sourceId of sourcesArray) {
            const cfg = sourceConfigs[sourceId]
            const preview = previews[sourceId]
            if (!preview) continue

            try {
                const forceAsStates = cfg.entityTypeMode === 'all_states' ||
                    (cfg.entityTypeMode === 'mixed' && Object.values(cfg.memberEntityTypes || {}).every(t => t === 'state'))

                const stateNames = cfg.entityTypeMode === 'mixed'
                    ? preview.members.filter(m => cfg.memberEntityTypes?.[m.sourceId] === 'state').map(m => m.name.toLowerCase())
                    : undefined

                const res = await api.importFromSourceStream(
                    sourceId,
                    cfg.token.trim() || null,
                    {
                        replace: cfg.replace,
                        skipExisting: cfg.skipExisting,
                        noGroups: cfg.noGroups,
                        noSwitches: cfg.noSwitches,
                        target: cfg.target,
                        forceAsStates,
                        stateNames,
                        selectedMemberIds: cfg.selectedMemberIds,
                        selectedGroupIds: cfg.selectedGroupIds,
                    },
                    cfg.fileData
                )
                setImportResults(prev => [...prev, { sourceId, result: res, success: true }])
            } catch (err) {
                setImportResults(prev => [...prev, { sourceId, error: err.message, success: false }])
            }
        }
        setPhase('complete')
    }, [selectedSources, sourceConfigs, previews])

    const handleContinue = useCallback(() => {
        if (onNavigate) onNavigate('landing')
    }, [onNavigate])

    const handleImportAnother = useCallback(() => {
        setPhase('select')
        setSelectedSources(new Set())
        setSourceConfigs({})
        setPreviews({})
        setImportResults([])
        setError(null)
    }, [])

    // ===== PHASE 1: Source Selection =====
    if (phase === 'select') {
        return (
            <div className="settings-page">
                <h1>Import Data</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                    Choose where to import from. Select multiple sources to import from several places at once.
                    {forceAsStates && (
                        <span style={{ display: 'block', marginTop: 'var(--space-sm)', color: 'var(--color-warning)' }}>
                            <Icon name="alert" size={16} /> Your profile type means imported members will be created as <strong>states</strong>.
                        </span>
                    )}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                    {SOURCES.map(s => (
                        <button
                            key={s.id}
                            className="settings-section"
                            onClick={() => handleQuickImport(s.id)}
                            style={{
                                cursor: 'pointer', textAlign: 'left', padding: 'var(--space-lg)',
                                border: '1px solid var(--glass-border)', background: 'var(--bg-card)',
                                borderRadius: 'var(--radius)', transition: 'border-color 0.2s, transform 0.1s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.transform = 'none' }}
                        >
                            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>{s.icon}</div>
                            <div style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>{s.label}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {s.methods.length > 1 ? `${s.methods.length} import methods` : s.methods[0].id === 'api' ? 'API import' : 'File import'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: 'var(--space-xs)', fontWeight: 500 }}>
                                Quick import
                            </div>
                        </button>
                    ))}
                </div>

                <div className="settings-section" style={{ border: '1px dashed var(--glass-border)', background: 'rgba(196,181,253,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                        <span style={{ fontSize: '1.5rem' }}>➕</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>Import from Multiple Sources</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Select multiple platforms and configure each one individually
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-sm)' }}>
                        {SOURCES.map(s => (
                            <label
                                key={s.id}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                                    padding: 'var(--space-sm) var(--space-md)', cursor: 'pointer',
                                    background: selectedSources.has(s.id) ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                                    border: `1px solid ${selectedSources.has(s.id) ? 'var(--accent)' : 'var(--glass-border)'}`,
                                    borderRadius: 'var(--radius)', transition: 'all 0.2s'
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedSources.has(s.id)}
                                    onChange={() => toggleSource(s.id)}
                                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
                                />
                                <span style={{ fontSize: '1.2rem' }}>{s.icon}</span>
                                <span style={{ fontWeight: 500 }}>{s.label}</span>
                            </label>
                        ))}
                    </div>

                    {selectedSources.size > 0 && (
                        <button
                            className="btn-gradient btn-gradient-primary"
                            onClick={handleStartConfigure}
                            style={{ width: '100%', marginTop: 'var(--space-md)', height: '48px' }}
                        >
                            Configure {selectedSources.size} Source{selectedSources.size !== 1 ? 's' : ''} →
                        </button>
                    )}
                </div>
            </div>
        )
    }

    // ===== PHASE 2: Per-Source Configuration =====
    if (phase === 'configure') {
        const sourcesArray = Array.from(selectedSources)
        const currentIdx = sourcesArray.indexOf(configuringSource)
        const currentSourceId = sourcesArray[currentIdx] || sourcesArray[0]
        const src = SOURCES.find(s => s.id === currentSourceId)
        const cfg = sourceConfigs[currentSourceId] || getDefaultConfig(currentSourceId)

        return (
            <div className="settings-page">
                <button className="back-btn" onClick={handleBackToSelect} style={{ marginBottom: 'var(--space-md)' }}>← Back</button>

                <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', alignItems: 'center' }}>
                    {sourcesArray.map((id, i) => (
                        <span
                            key={id}
                            style={{
                                flex: 1, textAlign: 'center', padding: 'var(--space-xs)',
                                background: i < currentIdx ? 'var(--accent)' : i === currentIdx ? 'var(--accent-subtle)' : 'var(--glass-border)',
                                color: i <= currentIdx ? 'var(--bg)' : 'var(--text-secondary)',
                                borderRadius: 'var(--radius)', fontSize: '0.8rem', fontWeight: 600
                            }}
                        >
                            {SOURCES.find(s => s.id === id)?.icon} {SOURCES.find(s => s.id === id)?.label}
                        </span>
                    ))}
                </div>

                <h1>{src?.icon} Configure {src?.label}</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                    Source {currentIdx + 1} of {sourcesArray.length}
                </p>

                {src?.methods.length > 1 && (
                    <div className="settings-section" style={{ marginBottom: 'var(--space-md)' }}>
                        <div className="settings-section-title">Import Method</div>
                        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                            {src.methods.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => updateSourceConfig(currentSourceId, { method: m.id, token: '', fileData: null, fileName: '' })}
                                    style={{
                                        flex: 1, padding: 'var(--space-md)', cursor: 'pointer', textAlign: 'center',
                                        background: cfg.method === m.id ? 'var(--accent-subtle)' : 'var(--bg-card)',
                                        border: `1px solid ${cfg.method === m.id ? 'var(--accent)' : 'var(--glass-border)'}`,
                                        borderRadius: 'var(--radius)', transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-xs)' }}>{METHOD_ICONS[m.id]}</div>
                                    <div style={{ fontWeight: 600 }}>{m.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {(() => {
                    const activeMethod = src?.methods.find(m => m.id === cfg.method)
                    return (
                        <div className="settings-section" style={{ marginBottom: 'var(--space-md)' }}>
                            {cfg.method === 'api' ? (
                                <div className="form-group">
                                    <label>{activeMethod?.tokenLabel}</label>
                                    <input
                                        className="text-input"
                                        type="text"
                                        value={cfg.token}
                                        onChange={e => updateSourceConfig(currentSourceId, { token: e.target.value })}
                                        placeholder={activeMethod?.tokenPlaceholder}
                                    />
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>{activeMethod?.help}</div>
                                </div>
                            ) : (
                                <div className="form-group">
                                    <label>Export File (JSON)</label>
                                    <input type="file" accept=".json" onChange={e => handleFileChange(currentSourceId, e)} style={{ color: 'var(--text)' }} />
                                    {cfg.fileName && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>Selected: {cfg.fileName}</div>}
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 'var(--space-sm)' }}>{activeMethod?.help}</div>
                                </div>
                            )}
                        </div>
                    )
                })()}

                <div className="settings-section" style={{ marginBottom: 'var(--space-md)' }}>
                    <div className="settings-section-title">Import Target <Icon name="info" size={14} style={{ cursor: 'help', opacity: 0.6, marginLeft: '4px' }} /></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        {TARGET_OPTIONS.map(opt => (
                            <label
                                key={opt.value}
                                style={{
                                    display: 'flex', flexDirection: 'column', gap: '2px',
                                    padding: 'var(--space-md)', cursor: 'pointer',
                                    background: cfg.target === opt.value ? 'var(--accent-subtle)' : 'var(--bg-card)',
                                    border: `1px solid ${cfg.target === opt.value ? 'var(--accent)' : 'var(--glass-border)'}`,
                                    borderRadius: 'var(--radius)'
                                }}
                                onClick={() => updateSourceConfig(currentSourceId, { target: opt.value })}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                    <input
                                        type="radio"
                                        name={`target-${currentSourceId}`}
                                        value={opt.value}
                                        checked={cfg.target === opt.value}
                                        onChange={() => updateSourceConfig(currentSourceId, { target: opt.value })}
                                        style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
                                    />
                                    <strong>{opt.label}</strong>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '24px' }}>{opt.desc}</div>
                            </label>
                        ))}
                    </div>

                    <details style={{ marginTop: 'var(--space-sm)' }}>
                        <summary style={{ cursor: 'pointer', color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 500 }}>
                            What is Discord Overlay?
                        </summary>
                        <div style={{ marginTop: 'var(--space-sm)', padding: 'var(--space-sm)', background: 'rgba(196,181,253,0.1)', borderRadius: 'var(--radius)' }}>
                            {DISCORD_OVERLAY_DESC}
                        </div>
                    </details>
                </div>

                <div className="settings-section" style={{ marginBottom: 'var(--space-md)' }}>
                    <div className="settings-section-title">Options</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
                            <input type="checkbox" checked={cfg.replace} onChange={e => updateSourceConfig(currentSourceId, { replace: e.target.checked })} style={{ width: '18px', height: '18px' }} />Replace existing data
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
                            <input type="checkbox" checked={cfg.skipExisting} onChange={e => updateSourceConfig(currentSourceId, { skipExisting: e.target.checked })} style={{ width: '18px', height: '18px' }} />Skip existing members
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
                            <input type="checkbox" checked={cfg.noGroups} onChange={e => updateSourceConfig(currentSourceId, { noGroups: e.target.checked })} style={{ width: '18px', height: '18px' }} />Don't import groups
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
                            <input type="checkbox" checked={cfg.noSwitches} onChange={e => updateSourceConfig(currentSourceId, { noSwitches: e.target.checked })} style={{ width: '18px', height: '18px' }} />Don't import switch history
                        </label>
                    </div>
                </div>

                {error && (
                    <div className="settings-section" style={{ borderLeft: '3px solid var(--color-error)', marginBottom: 'var(--space-md)' }}>
                        <p style={{ color: 'var(--color-error)', margin: 0 }}><Icon name="x" size={16} /> {error}</p>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
                    {currentIdx > 0 && (
                        <button
                            className="btn-ghost"
                            onClick={() => setConfiguringSource(sourcesArray[currentIdx - 1])}
                            style={{ flex: 1 }}
                        >
                            ← Previous
                        </button>
                    )}
                    {currentIdx < sourcesArray.length - 1 ? (
                        <button
                            className="btn-gradient btn-gradient-primary"
                            onClick={() => setConfiguringSource(sourcesArray[currentIdx + 1])}
                            style={{ flex: 1 }}
                        >
                            Next →
                        </button>
                    ) : (
                        <button
                            className="btn-gradient btn-gradient-primary"
                            onClick={handleFetchAllPreviews}
                            style={{ flex: 1 }}
                        >
                            Fetch Previews →
                        </button>
                    )}
                </div>
            </div>
        )
    }

    // ===== PHASE 3: Preview & Import =====
    if (phase === 'preview') {
        const sourcesArray = Array.from(selectedSources)
        return (
            <div className="settings-page">
                <h1>Preview Imports</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                    Review each import below. All members/groups are selected by default.
                </p>

                {renderFetchStatus()}

                {sourcesArray.map(sourceId => {
                    const preview = previews[sourceId]
                    const cfg = sourceConfigs[sourceId]
                    const src = SOURCES.find(s => s.id === sourceId)
                    if (!preview) return null

                    return (
                        <div key={sourceId} className="settings-section" style={{ marginBottom: 'var(--space-lg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                            <div style={{ padding: 'var(--space-md)', background: 'var(--bg-card)', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                <span style={{ fontSize: '1.5rem' }}>{src?.icon}</span>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{src?.label}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        Target: <strong>{cfg.target === 'discord' ? 'Discord Overlay' : 'Main Profile'}</strong>
                                        {cfg.target === 'discord' && <span style={{ marginLeft: 'var(--space-sm)', fontSize: '0.7rem', background: 'var(--accent-subtle)', color: 'var(--accent)', padding: '1px 6px', borderRadius: '8px' }}>Bot Profile</span>}
                                    </div>
                                </div>
                            </div>

                            <div style={{ padding: 'var(--space-md)' }}>
                                <div style={{ display: 'flex', gap: 'var(--space-lg)', flexWrap: 'wrap', fontSize: '0.9rem', marginBottom: 'var(--space-md)' }}>
                                    <span>Found <strong>{preview.members.length}</strong> member{preview.members.length !== 1 ? 's' : ''}</span>
                                    <span>Found <strong>{preview.groups.length}</strong> group{preview.groups.length !== 1 ? 's' : ''}</span>
                                    <span style={{ color: 'var(--color-success)' }}><strong>{preview.members.filter(m => m.action === 'new').length}</strong> new</span>
                                    <span style={{ color: 'var(--color-warning)' }}><strong>{preview.members.filter(m => m.action === 'update').length}</strong> will update</span>
                                </div>

                                <div style={{ marginBottom: 'var(--space-md)' }}>
                                    <div className="settings-section-title" style={{ marginBottom: 'var(--space-xs)' }}>Import As</div>
                                    <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                        {[
                                            { id: 'all_alters', label: 'All Alters' },
                                            { id: 'mixed', label: 'Mixed' },
                                            { id: 'all_states', label: 'All States' },
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => updateSourceConfig(sourceId, { entityTypeMode: opt.id })}
                                                style={{
                                                    flex: 1, padding: 'var(--space-sm)',
                                                    border: `1px solid ${cfg.entityTypeMode === opt.id ? 'var(--accent)' : 'var(--glass-border)'}`,
                                                    background: cfg.entityTypeMode === opt.id ? 'var(--accent-subtle)' : 'var(--bg-card)',
                                                    borderRadius: 'var(--radius)',
                                                    color: cfg.entityTypeMode === opt.id ? 'var(--accent)' : 'var(--text-secondary)',
                                                    cursor: 'pointer', fontSize: '0.85rem', fontWeight: cfg.entityTypeMode === opt.id ? 600 : 400
                                                }}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                    {cfg.entityTypeMode === 'mixed' && (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
                                            Click the type chip on each member to toggle between alter/state
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}

                {error && (
                    <div className="settings-section" style={{ borderLeft: '3px solid var(--color-error)' }}>
                        <p style={{ color: 'var(--color-error)', margin: 0 }}><Icon name="x" size={16} /> {error}</p>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
                    <button
                        className="btn-ghost"
                        onClick={() => setPhase('configure')}
                        style={{ flex: 1 }}
                    >
                        ← Back to Configure
                    </button>
                    <button
                        className="btn-gradient btn-gradient-primary"
                        onClick={handleImportAll}
                        style={{ flex: 2 }}
                    >
                        Import All ({sourcesArray.length} source{sourcesArray.length !== 1 ? 's' : ''})
                    </button>
                </div>
            </div>
        )
    }

    // ===== PHASE 4: Importing =====
    if (phase === 'importing') {
        return (
            <div className="settings-page" style={{ position: 'relative' }}>
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13, 13, 20, 0.85)', backdropFilter: 'blur(8px)' }}>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius)', padding: 'var(--space-xl) var(--space-2xl)', textAlign: 'center', maxWidth: '420px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-sm)' }}>📥</div>
                        <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 'var(--space-xs)' }}>Importing {selectedSources.size} Source{selectedSources.size !== 1 ? 's' : ''}</div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                            Please don't close this window
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', textAlign: 'left', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius)', padding: 'var(--space-sm)', fontSize: '0.8rem', fontFamily: 'var(--font-body)', color: 'var(--text-secondary)', maxHeight: '300px' }}>
                            {importResults.map((r, i) => {
                                const src = SOURCES.find(s => s.id === r.sourceId)
                                return (
                                    <div key={i} style={{ padding: 'var(--space-xs) 0', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                        <span style={{ fontSize: '1rem' }}>{src?.icon}</span>
                                        <span style={{ flex: 1, fontWeight: 500 }}>{src?.label}</span>
                                        <span style={{ color: r.success ? 'var(--color-success)' : 'var(--color-error)' }}>
                                            {r.success ? '✅' : '❌'}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
        )
    }

    // ===== PHASE 5: Complete =====
    if (phase === 'complete') {
        const allSuccess = importResults.every(r => r.success)
        const totalMembers = importResults.reduce((sum, r) => sum + (r.result?.result?.membersImported || 0), 0)
        const totalGroups = importResults.reduce((sum, r) => sum + (r.result?.result?.groupsImported || 0), 0)

        return (
            <div className="settings-page">
                <h1>Import Complete</h1>

                <div className="settings-section" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>{allSuccess ? '✅' : '⚠️'}</div>
                    <div style={{ fontWeight: 600, fontSize: '1.2rem', marginBottom: 'var(--space-sm)', color: allSuccess ? 'var(--color-success)' : 'var(--color-warning)' }}>
                        {allSuccess ? 'All imports successful!' : 'Some imports had issues'}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                        Imported <strong>{totalMembers}</strong> member{totalMembers !== 1 ? 's' : ''} and <strong>{totalGroups}</strong> group{totalGroups !== 1 ? 's' : ''}
                        across <strong>{importResults.length}</strong> source{importResults.length !== 1 ? 's' : ''}
                    </div>
                </div>

                {importResults.map((r, i) => {
                    const src = SOURCES.find(s => s.id === r.sourceId)
                    if (!r.success) {
                        return (
                            <div key={i} className="settings-section" style={{ borderLeft: '3px solid var(--color-error)' }}>
                                <p style={{ color: 'var(--color-error)', margin: 0, fontWeight: 600 }}><Icon name="x" size={16} /> {src?.label} failed</p>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 'var(--space-xs) 0 0' }}>{r.error}</p>
                            </div>
                        )
                    }
                    const res = r.result?.result || {}
                    return (
                        <div key={i} className="settings-section">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                                <span style={{ fontSize: '1.2rem' }}>{src?.icon}</span>
                                <strong>{src?.label}</strong>
                                <span style={{ fontSize: '0.7rem', background: 'var(--color-success)', color: 'var(--bg)', padding: '1px 6px', borderRadius: '8px' }}>Success</span>
                                <span style={{ fontSize: '0.7rem', marginLeft: 'auto', color: 'var(--text-secondary)' }}>
                                    Target: {r.result?.result?.target === 'discord' ? 'Discord Overlay' : 'Main Profile'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.85rem' }}>
                                <div>Alters imported: <strong>{res.membersImported || 0}</strong></div>
                                {res.membersUpdated > 0 && <div>Alters updated: <strong>{res.membersUpdated}</strong></div>}
                                {res.membersSkipped > 0 && <div>Alters skipped: <strong>{res.membersSkipped}</strong></div>}
                                {(res.statesImported > 0 || res.statesUpdated > 0) && <div>States imported: <strong>{res.statesImported || 0}</strong></div>}
                                {(res.groupsImported > 0 || res.groupsUpdated > 0) && <div>Groups imported: <strong>{res.groupsImported || 0}</strong></div>}
                                {res.switchesImported > 0 && <div>Switches imported: <strong>{res.switchesImported}</strong></div>}
                            </div>
                        </div>
                    )
                })}

                <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-xl)' }}>
                    <button
                        className="btn-gradient btn-gradient-primary"
                        onClick={handleContinue}
                        style={{ flex: 2, height: '56px', fontSize: '1.1rem' }}
                    >
                        Continue to Dashboard →
                    </button>
                    <button
                        className="btn-ghost"
                        onClick={handleImportAnother}
                        style={{ flex: 1, height: '56px' }}
                    >
                        Import More
                    </button>
                </div>
            </div>
        )
    }

    return null
}

export default ImportPage