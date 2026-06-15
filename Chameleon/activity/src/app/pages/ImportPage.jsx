import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { api, isSystemUser, isFragmentedUser, isDissociativeUser, Icon, getSystemTerm } from '@chameleon/shared'
import { useSystemSession } from '../../hooks/useSystemSession';

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

export function ImportPage({ system, onNavigate }) {
    const systemTerm = getSystemTerm(system, { context: 'label' }) || 'system'
    // Check if user has a registered system
    const { markPrivateFromPreview } = useSystemSession();
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

    const [source, setSource] = useState(null)
    const [selectedMethod, setSelectedMethod] = useState(null)
    const [token, setToken] = useState('')
    const [fileData, setFileData] = useState(null)
    const [fileName, setFileName] = useState('')
    const [replace, setReplace] = useState(false)
    const [skipExisting, setSkipExisting] = useState(false)
    const [noGroups, setNoGroups] = useState(false)
    const [noSwitches, setNoSwitches] = useState(false)
    const [target, setTarget] = useState('app')

    const [previewLoading, setPreviewLoading] = useState(false)
    const [preview, setPreview] = useState(null)
    const [selectedMemberIds, setSelectedMemberIds] = useState(new Set())
    const [selectedGroupIds, setSelectedGroupIds] = useState(new Set())
    const [memberEntityTypes, setMemberEntityTypes] = useState({})
    const [entityTypeMode, setEntityTypeMode] = useState('all_alters')
    const [searchQuery, setSearchQuery] = useState('')

    const [importQueue, setImportQueue] = useState([])
    const [importing, setImporting] = useState(false)
    const [progressLogs, setProgressLogs] = useState([])
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)

    const isSystem = isSystemUser(system)
    const isFrag = isFragmentedUser(system)
    const isDissoc = isDissociativeUser(system)
    const forceAsStates = !isSystem && (isFrag || isDissoc)

    // Deep-link: read ?source= and ?method= from URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const urlSource = params.get('source')
        const urlMethod = params.get('method')
        if (urlSource && SOURCES.find(s => s.id === urlSource)) {
            setSource(urlSource)
            const src = SOURCES.find(s => s.id === urlSource)
            if (urlMethod && src.methods.find(m => m.id === urlMethod)) {
                setSelectedMethod(urlMethod)
            } else if (src.methods.length === 1) {
                setSelectedMethod(src.methods[0].id)
            }
        }
    }, [])

    const selectedSource = SOURCES.find(s => s.id === source)
    const activeMethod = selectedSource?.methods.find(m => m.id === selectedMethod)
    const isFileImport = selectedMethod === 'file'
    const isApiImport = selectedMethod === 'api'
    const sourceHasMultipleMethods = selectedSource?.methods.length > 1

    const filteredMembers = useMemo(() => {
        if (!preview?.members) return []
        if (!searchQuery.trim()) return preview.members
        const q = searchQuery.toLowerCase()
        return preview.members.filter(m => m.name.toLowerCase().includes(q))
    }, [preview, searchQuery])

    const selectedCount = selectedMemberIds.size
    const selectedGroupsCount = selectedGroupIds.size

    const handleFileChange = useCallback((e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setFileName(file.name)
        const reader = new FileReader()
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result)
                setFileData(data)
                setError(null)
            } catch {
                setError('Invalid JSON file')
                setFileData(null)
            }
        }
        reader.readAsText(file)
    }, [])

    const handleFetchPreview = useCallback(async () => {
        if (!source || !selectedMethod) return
        if (isApiImport && !token.trim()) { setError('Please enter a token or ID'); return }
        if (isFileImport && !fileData) { setError('Please select a file'); return }

        setPreviewLoading(true)
        setError(null)
        setPreview(null)

        try {
            const res = await api.previewImport(source, token.trim() || null, fileData)
            setPreview(res.preview)

            const allMemberIds = new Set(res.preview.members.map(m => m.sourceId))
            setSelectedMemberIds(allMemberIds)

            const allGroupIds = new Set(res.preview.groups.map(g => g.sourceId))
            setSelectedGroupIds(allGroupIds)

            const types = {}
            res.preview.members.forEach(m => { types[m.sourceId] = forceAsStates ? 'state' : 'alter' })
            setMemberEntityTypes(types)
            setEntityTypeMode(forceAsStates ? 'all_states' : 'all_alters')
            if (res.preview) {
                markPrivateFromPreview(res.preview, allMemberIds, allGroupIds);
            }
        } catch (err) {
            setError(err.message || 'Failed to fetch preview')
        } finally {
            setPreviewLoading(false)
        }
    }, [source, selectedMethod, token, fileData, isApiImport, isFileImport, forceAsStates])

    const handleToggleMember = useCallback((sourceId) => {
        setSelectedMemberIds(prev => {
            const next = new Set(prev)
            if (next.has(sourceId)) next.delete(sourceId)
            else next.add(sourceId)
            return next
        })
    }, [])

    const handleToggleGroup = useCallback((sourceId) => {
        setSelectedGroupIds(prev => {
            const next = new Set(prev)
            if (next.has(sourceId)) next.delete(sourceId)
            else next.add(sourceId)
            return next
        })
    }, [])

    const handleSelectAllMembers = useCallback(() => {
        if (!preview) return
        setSelectedMemberIds(new Set(preview.members.map(m => m.sourceId)))
    }, [preview])

    const handleDeselectAllMembers = useCallback(() => {
        setSelectedMemberIds(new Set())
    }, [])

    const handleEntityTypeModeChange = useCallback((mode) => {
        setEntityTypeMode(mode)
        if (mode === 'all_alters') {
            const types = {}
            for (const id of selectedMemberIds) types[id] = 'alter'
            setMemberEntityTypes(types)
        } else if (mode === 'all_states') {
            const types = {}
            for (const id of selectedMemberIds) types[id] = 'state'
            setMemberEntityTypes(types)
        }
    }, [selectedMemberIds])

    const handleToggleMemberType = useCallback((sourceId) => {
        setMemberEntityTypes(prev => ({
            ...prev,
            [sourceId]: prev[sourceId] === 'state' ? 'alter' : 'state'
        }))
        setEntityTypeMode('mixed')
    }, [])

    const handleStartImport = useCallback(async () => {
        if (selectedCount === 0) { setError('Select at least one member to import'); return }

        const forceAsStates = entityTypeMode === 'all_states' ||
            (entityTypeMode === 'mixed' && Object.values(memberEntityTypes).every(t => t === 'state'))

        const stateNames = entityTypeMode === 'mixed'
            ? preview.members.filter(m => memberEntityTypes[m.sourceId] === 'state').map(m => m.name.toLowerCase())
            : undefined

        setImporting(true)
        setError(null)
        setResult(null)
        setProgressLogs([])

        try {
            const options = {
                replace, skipExisting, noGroups, noSwitches, target,
                forceAsStates,
                stateNames,
                selectedMemberIds: selectedMemberIds,
                selectedGroupIds: selectedGroupIds,
            }
            const res = await api.importFromSourceStream(
                source, token.trim() || null, options, fileData,
                (event) => setProgressLogs(prev => [...prev, event])
            )
            setResult(res)
        } catch (err) {
            setError(err.message || 'Import failed')
        } finally {
            setImporting(false)
        }
    }, [source, token, fileData, replace, skipExisting, noGroups, noSwitches, target, entityTypeMode, memberEntityTypes, selectedMemberIds, selectedGroupIds, selectedCount, preview])

    const handleAddToQueue = useCallback(() => {
        if (selectedCount === 0) return
        const forceAsStates = entityTypeMode === 'all_states'
        const entry = {
            id: Date.now(),
            source, method: selectedMethod, token: token.trim() || null, fileData, fileName,
            selectedMemberIds: new Set(selectedMemberIds),
            selectedGroupIds: new Set(selectedGroupIds),
            forceAsStates,
            preview: { counts: { total: preview.members.length, selected: selectedCount } },
        }
        setImportQueue(prev => [...prev, entry])
        setSource(null)
        setSelectedMethod(null)
        setToken('')
        setFileData(null)
        setFileName('')
        setPreview(null)
        setSelectedMemberIds(new Set())
        setSelectedGroupIds(new Set())
        setMemberEntityTypes({})
        setSearchQuery('')
    }, [source, selectedMethod, token, fileData, fileName, selectedMemberIds, selectedGroupIds, entityTypeMode, selectedCount, preview])

    const handleRemoveFromQueue = useCallback((id) => {
        setImportQueue(prev => prev.filter(e => e.id !== id))
    }, [])

    const handleBack = useCallback(() => {
        if (onNavigate) onNavigate('settings')
    }, [onNavigate])

    const handleReset = useCallback(() => {
        setSource(null)
        setSelectedMethod(null)
        setToken('')
        setFileData(null)
        setFileName('')
        setPreview(null)
        setSelectedMemberIds(new Set())
        setSelectedGroupIds(new Set())
        setMemberEntityTypes({})
        setEntityTypeMode('all_alters')
        setSearchQuery('')
        setProgressLogs([])
        setResult(null)
        setError(null)
    }, [])

    const handleSourceSelect = useCallback((sourceId) => {
        const src = SOURCES.find(s => s.id === sourceId)
        setSource(sourceId)
        setToken('')
        setFileData(null)
        setFileName('')
        setError(null)
        setPreview(null)
        setProgressLogs([])
        if (src.methods.length === 1) setSelectedMethod(src.methods[0].id)
        else setSelectedMethod(null)
    }, [])

    // Importing overlay
    if (importing) {
        const latestLog = progressLogs[progressLogs.length - 1]
        return (
            <div className="settings-page" style={{ position: 'relative' }}>
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13, 13, 20, 0.85)', backdropFilter: 'blur(8px)' }}>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius)', padding: 'var(--space-xl) var(--space-2xl)', textAlign: 'center', maxWidth: '420px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-sm)' }}>{selectedSource?.icon}</div>
                        <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 'var(--space-xs)' }}>Importing from {selectedSource?.label}</div>
                        {latestLog && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)', color: 'var(--accent)', fontSize: '0.95rem' }}>
                                <span>{PHASE_ICONS[latestLog.phase] || '⏳'}</span>
                                <span>{latestLog.message}</span>
                            </div>
                        )}
                        {latestLog?.total > 1 && (
                            <div style={{ marginBottom: 'var(--space-md)' }}>
                                <div style={{ height: 4, borderRadius: 2, background: 'var(--glass-border)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent)', transition: 'width 0.3s ease', width: `${((latestLog.current || 0) / latestLog.total) * 100}%` }} />
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>{latestLog.current}/{latestLog.total}</div>
                            </div>
                        )}
                        <div style={{ flex: 1, overflowY: 'auto', textAlign: 'left', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius)', padding: 'var(--space-sm)', fontSize: '0.8rem', fontFamily: 'var(--font-body)', color: 'var(--text-secondary)', maxHeight: '200px', minHeight: '80px' }}>
                            {progressLogs.map((log, i) => (
                                <div key={i} style={{ padding: '2px 0', color: log.phase === 'complete' ? 'var(--color-success)' : log.phase === 'error' ? 'var(--color-error)' : 'var(--text-secondary)' }}>
                                    <span style={{ opacity: 0.5, marginRight: '6px' }}>{PHASE_ICONS[log.phase] || '•'}</span>{log.message}
                                </div>
                            ))}
                            {progressLogs.length === 0 && <div style={{ padding: '2px 0', opacity: 0.5 }}>Starting import...</div>}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 'var(--space-sm)', fontStyle: 'italic' }}>Please don't close this window</div>
                    </div>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
        )
    }

    // Result view
    if (result) {
        const r = result.result || {}
        return (
            <div className="settings-page">
                <button className="back-btn" onClick={handleReset} style={{ marginBottom: 'var(--space-md)' }}>← Import Another</button>
                <h1>Import Complete</h1>
                <div className="settings-section">
                    <p style={{ color: 'var(--color-success)', marginBottom: 'var(--space-md)' }}><Icon name="check" size={16} /> Import from {result.source} successful</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        <div>Alters imported: <strong>{r.membersImported || 0}</strong></div>
                        {r.membersUpdated > 0 && <div>Alters updated: <strong>{r.membersUpdated}</strong></div>}
                        {r.membersSkipped > 0 && <div>Alters skipped: <strong>{r.membersSkipped}</strong></div>}
                        {(r.statesImported > 0 || r.statesUpdated > 0) && <div>States imported: <strong>{r.statesImported || 0}</strong></div>}
                        {(r.groupsImported > 0 || r.groupsUpdated > 0) && <div>Groups imported: <strong>{r.groupsImported || 0}</strong></div>}
                        {r.switchesImported > 0 && <div>Switches imported: <strong>{r.switchesImported}</strong></div>}
                    </div>
                    {r.errors?.length > 0 && (
                        <div style={{ marginTop: 'var(--space-md)', color: 'var(--color-warning)' }}>
                            <strong>Warnings:</strong>
                            <ul style={{ margin: 'var(--space-xs) 0 0', paddingLeft: '20px' }}>{r.errors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}</ul>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Source selection
    if (!source) {
        return (
            <div className="settings-page">
                <button className="back-btn" onClick={importQueue.length > 0 ? handleStartImport : handleBack} style={{ marginBottom: 'var(--space-md)' }}>
                    {importQueue.length > 0 ? `← Import Queue (${importQueue.length})` : '← Back to Settings'}
                </button>
                <h1>Import Data</h1>
                {importQueue.length > 0 && (
                    <div className="settings-section" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Queue:</span>
                            {importQueue.map(e => {
                                const src = SOURCES.find(s => s.id === e.source)
                                return (
                                    <span key={e.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--accent-subtle)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
                                        {src?.icon} {e.fileName || src?.label} ({e.preview.counts.selected})
                                        <button onClick={() => handleRemoveFromQueue(e.id)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, fontSize: '0.9rem', lineHeight: 1 }}>×</button>
                                    </span>
                                )
                            })}
                        </div>
                    </div>
                )}
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                    Import your data from another platform.
                    {forceAsStates && (
                        <span style={{ display: 'block', marginTop: 'var(--space-sm)', color: 'var(--color-warning)' }}>
                            <Icon name="alert" size={16} /> Your profile type means imported {getSourceTerm('pluralkit')} will be created as <strong>states</strong>.
                        </span>
                    )}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-md)' }}>
                    {SOURCES.map(s => (
                        <button key={s.id} className="settings-section" onClick={() => handleSourceSelect(s.id)}
                            style={{ cursor: 'pointer', textAlign: 'left', padding: 'var(--space-lg)', border: '1px solid var(--glass-border)', background: 'var(--bg-card)', borderRadius: 'var(--radius)', transition: 'border-color 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--glass-border)'}>
                            <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-sm)' }}>{s.icon}</div>
                            <div style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>{s.label}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {s.methods.length > 1 ? `${s.methods.length} import methods` : s.methods[0].id === 'api' ? 'API import' : 'File import'}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    // Method selection
    if (sourceHasMultipleMethods && !selectedMethod) {
        return (
            <div className="settings-page">
                <button className="back-btn" onClick={() => setSource(null)} style={{ marginBottom: 'var(--space-md)' }}>← Back</button>
                <h1>{selectedSource?.icon} Import from {selectedSource?.label}</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>Choose an import method:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    {selectedSource.methods.map(m => (
                        <button key={m.id} className="settings-section" onClick={() => setSelectedMethod(m.id)}
                            style={{ cursor: 'pointer', textAlign: 'left', padding: 'var(--space-lg)', border: '1px solid var(--glass-border)', background: 'var(--bg-card)', borderRadius: 'var(--radius)', transition: 'border-color 0.2s', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)' }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--glass-border)'}>
                            <div style={{ fontSize: '1.5rem', lineHeight: 1 }}>{METHOD_ICONS[m.id]}</div>
                            <div>
                                <div style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>{m.label}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{m.help}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    // Preview view
    if (preview) {
        return (
            <div className="settings-page">
                <button className="back-btn" onClick={() => setPreview(null)} style={{ marginBottom: 'var(--space-md)' }}>← Back to Form</button>
                <h1>Preview Import</h1>

                <div className="settings-section" style={{ marginBottom: 'var(--space-md)' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-lg)', flexWrap: 'wrap', fontSize: '0.9rem' }}>
                        <span>Found <strong>{preview.members.length}</strong> member{preview.members.length !== 1 ? 's' : ''}</span>
                        <span>Found <strong>{preview.groups.length}</strong> group{preview.groups.length !== 1 ? 's' : ''}</span>
                        <span style={{ color: 'var(--color-success)' }}><strong>{preview.members.filter(m => m.action === 'new').length}</strong> new</span>
                        <span style={{ color: 'var(--color-warning)' }}><strong>{preview.members.filter(m => m.action === 'update').length}</strong> will update</span>
                    </div>
                </div>

                {/* Entity type mode toggle */}
                <div className="settings-section" style={{ marginBottom: 'var(--space-md)' }}>
                    <div className="settings-section-title">Import as</div>
                    <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                        {[
                            { id: 'all_alters', label: 'All Alters' },
                            { id: 'mixed', label: 'Mixed' },
                            { id: 'all_states', label: 'All States' },
                        ].map(opt => (
                            <button key={opt.id} onClick={() => handleEntityTypeModeChange(opt.id)}
                                style={{ flex: 1, padding: 'var(--space-sm)', border: `1px solid ${entityTypeMode === opt.id ? 'var(--accent)' : 'var(--glass-border)'}`, background: entityTypeMode === opt.id ? 'var(--accent-subtle)' : 'var(--bg-card)', borderRadius: 'var(--radius)', color: entityTypeMode === opt.id ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: entityTypeMode === opt.id ? 600 : 400, transition: 'all 0.2s' }}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    {entityTypeMode === 'mixed' && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
                            Click the type chip on each member to toggle between alter/state
                        </div>
                    )}
                </div>

                {/* Search + select all */}
                <div className="settings-section" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                        <input className="text-input" type="text" placeholder="Search members..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            style={{ flex: 1, height: '36px', fontSize: '0.85rem' }} />
                        <button onClick={handleSelectAllMembers} style={{ padding: '4px 10px', fontSize: '0.8rem', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', cursor: 'pointer' }}>All</button>
                        <button onClick={handleDeselectAllMembers} style={{ padding: '4px 10px', fontSize: '0.8rem', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', cursor: 'pointer' }}>None</button>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
                        {selectedCount} of {preview.members.length} members selected
                    </div>
                </div>

                {/* Member list */}
                <div className="settings-section" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {filteredMembers.map(m => (
                        <label key={m.sourceId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', padding: 'var(--space-xs) 0', borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', fontSize: '0.9rem' }}>
                            <input type="checkbox" checked={selectedMemberIds.has(m.sourceId)} onChange={() => handleToggleMember(m.sourceId)} style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                            {m.avatar && <img src={m.avatar} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                                {m.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.description}</div>}
                            </div>
                            <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '8px', background: m.action === 'new' ? 'rgba(134, 239, 172, 0.15)' : 'rgba(253, 186, 116, 0.15)', color: m.action === 'new' ? 'var(--color-success)' : 'var(--color-warning)', flexShrink: 0 }}>
                                {m.action === 'new' ? 'NEW' : 'UPDATE'}
                            </span>
                            {selectedMemberIds.has(m.sourceId) && entityTypeMode === 'mixed' && (
                                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleMemberType(m.sourceId) }}
                                    style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: memberEntityTypes[m.sourceId] === 'state' ? 'rgba(196, 181, 253, 0.2)' : 'var(--bg-surface)', color: memberEntityTypes[m.sourceId] === 'state' ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}>
                                    {memberEntityTypes[m.sourceId] === 'state' ? 'State' : 'Alter'}
                                </button>
                            )}
                        </label>
                    ))}
                </div>

                {/* Groups */}
                {preview.groups.length > 0 && (
                    <div className="settings-section" style={{ marginTop: 'var(--space-md)' }}>
                        <div className="settings-section-title">Groups</div>
                        {preview.groups.map(g => (
                            <label key={g.sourceId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', padding: 'var(--space-xs) 0', cursor: 'pointer', fontSize: '0.9rem' }}>
                                <input type="checkbox" checked={selectedGroupIds.has(g.sourceId)} onChange={() => handleToggleGroup(g.sourceId)} style={{ width: '16px', height: '16px' }} />
                                <div style={{ flex: 1 }}>{g.name}</div>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{g.memberSourceIds.length} member{g.memberSourceIds.length !== 1 ? 's' : ''}</span>
                                <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '8px', background: g.action === 'new' ? 'rgba(134, 239, 172, 0.15)' : 'rgba(253, 186, 116, 0.15)', color: g.action === 'new' ? 'var(--color-success)' : 'var(--color-warning)' }}>
                                    {g.action === 'new' ? 'NEW' : 'UPDATE'}
                                </span>
                            </label>
                        ))}
                    </div>
                )}

                {error && (
                    <div className="settings-section" style={{ borderLeft: '3px solid var(--color-error)', marginTop: 'var(--space-md)' }}>
                        <p style={{ color: 'var(--color-error)', margin: 0 }}><Icon name="x" size={16} /> {error}</p>
                    </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)', flexWrap: 'wrap' }}>
                    <button className="btn-gradient btn-gradient-primary" onClick={handleStartImport} disabled={selectedCount === 0}
                        style={{ height: '56px', padding: '0 32px', fontSize: '1rem' }}>
                        Import {selectedCount} Member{selectedCount !== 1 ? 's' : ''}
                    </button>
                    <button onClick={handleAddToQueue} disabled={selectedCount === 0}
                        style={{ height: '56px', padding: '0 24px', fontSize: '0.9rem', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius)', color: 'var(--text)', cursor: 'pointer' }}>
                        + Add to Queue
                    </button>
                </div>
            </div>
        )
    }

    // Import form
    return (
        <div className="settings-page">
            <button className="back-btn" onClick={() => { sourceHasMultipleMethods ? setSelectedMethod(null) : setSource(null) }} style={{ marginBottom: 'var(--space-md)' }}>← Back</button>
            <h1>{selectedSource?.icon} Import from {selectedSource?.label}</h1>

            {forceAsStates && (
                <div className="settings-section" style={{ borderLeft: '3px solid var(--color-warning)', marginBottom: 'var(--space-lg)' }}>
                    <p style={{ color: 'var(--color-warning)', margin: 0 }}><Icon name="alert" size={16} /> Your profile type means all imported {getSourceTerm(source)} will be created as <strong>states</strong>.</p>
                </div>
            )}

            {activeMethod?.privacyNote && (
                <div className="settings-section" style={{ borderLeft: '3px solid var(--text-secondary)', marginBottom: 'var(--space-lg)', background: 'rgba(152, 152, 168, 0.08)' }}>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}><Icon name="info" size={16} /> {activeMethod.privacyNote}</p>
                </div>
            )}

            <div className="settings-section">
                {isApiImport ? (
                    <div className="form-group">
                        <label>{activeMethod.tokenLabel}</label>
                        <input className="text-input" type="text" value={token} onChange={e => setToken(e.target.value)} placeholder={activeMethod.tokenPlaceholder} />
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>{activeMethod.help}</div>
                    </div>
                ) : (
                    <div className="form-group">
                        <label>Export File (JSON)</label>
                        <input type="file" accept=".json" onChange={handleFileChange} style={{ color: 'var(--text)' }} />
                        {fileName && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>Selected: {fileName}</div>}
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 'var(--space-sm)' }}>{activeMethod.help}</div>
                    </div>
                )}
            </div>

            <div className="settings-section">
                <div className="settings-section-title">Options</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} style={{ width: '18px', height: '18px' }} />Replace existing data
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={skipExisting} onChange={e => setSkipExisting(e.target.checked)} style={{ width: '18px', height: '18px' }} />Skip existing members
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={noGroups} onChange={e => setNoGroups(e.target.checked)} style={{ width: '18px', height: '18px' }} />Don't import groups
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={noSwitches} onChange={e => setNoSwitches(e.target.checked)} style={{ width: '18px', height: '18px' }} />Don't import switch history
                    </label>
                </div>
            </div>

            <div className="settings-section">
                <div className="settings-section-title">Import Target</div>
                <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
                        <input type="radio" name="target" value="app" checked={target === 'app'} onChange={() => setTarget('app')} style={{ width: '18px', height: '18px' }} />Main profile
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
                        <input type="radio" name="target" value="discord" checked={target === 'discord'} onChange={() => setTarget('discord')} style={{ width: '18px', height: '18px' }} />Discord overlay
                    </label>
                </div>
            </div>

            {error && (
                <div className="settings-section" style={{ borderLeft: '3px solid var(--color-error)' }}>
                    <p style={{ color: 'var(--color-error)', margin: 0 }}><Icon name="x" size={16} /> {error}</p>
                </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
                <button className="btn-gradient btn-gradient-primary" onClick={handleFetchPreview} disabled={previewLoading || (isApiImport && !token.trim()) || (isFileImport && !fileData)}
                    style={{ height: '56px', padding: '0 32px', fontSize: '1rem' }}>
                    {previewLoading ? 'Fetching...' : 'Preview Data'}
                </button>
            </div>
        </div>
    )
}

export default ImportPage
