import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { api, Icon } from '@chameleon/shared'
import { useFetchStatus } from '../../hooks/useFetchStatus.jsx'
import { useSystemSession } from '../../hooks/useSystemSession.jsx'

const SOURCES = [
    { id: 'pluralkit', label: 'PluralKit', icon: '🦊', methods: [{ id: 'api', label: 'API Import', tokenLabel: 'API Token', tokenPlaceholder: 'Your PluralKit token', help: 'DM PluralKit: pk;token' }] },
    { id: 'simplyplural', label: 'Simply Plural', icon: '&', methods: [{ id: 'api', label: 'API Import', tokenLabel: 'API Token', tokenPlaceholder: 'SP API token', help: 'Settings → Developer → Add Token' }] },
    { id: 'octocon', label: 'Octocon', icon: '🧠', methods: [{ id: 'api', label: 'API Import', tokenLabel: 'System ID', tokenPlaceholder: '7-char ID', help: 'octocon.app/u/yourid' }, { id: 'file', label: 'File Import', help: 'octocon.app → Settings → Export' }] },
    { id: 'tupperbox', label: 'Tupperbox', icon: '📦', methods: [{ id: 'file', label: 'File Import', help: 'tul!export' }] },
]

const METHOD_ICONS = { api: '🔗', file: '📄' }

const TARGET_LABELS = { app: 'Main App', overlay: 'Discord Overlay', both: 'Both' }

const targetLabel = (target) => TARGET_LABELS[target] || target

export function RegistrationImportPage({ onNavigate, onBack }) {
    const { session, update, setMembers, setGroups, setSwitches } = useSystemSession()

    // Import state - accumulated in memory until final confirm
    const [phase, setPhase] = useState('mode') // 'mode' | 'select' | 'configure' | 'preview' | 'importing' | 'complete'
    const [selectedSources, setSelectedSources] = useState(new Set())
    const [sourceConfigs, setSourceConfigs] = useState({})
    const [previews, setPreviews] = useState({})
    const [currentPreviewSource, setCurrentPreviewSource] = useState(null)
    const [error, setError] = useState(null)
    const [configuringSource, setConfiguringSource] = useState(null)
    const [importMode, setImportMode] = useState(null) // 'simple' | 'intermediate' | 'advanced'
    const [sourceTargets, setSourceTargets] = useState({}) // sourceId -> 'app' | 'overlay' | 'both'
    const [sourcePriority, setSourcePriority] = useState([]) // ordered sourceIds for main-app conflicts

    const { status: fetchStatus, start: startFetch, complete: completeFetch, error: errorFetch, render: renderFetchStatus } = useFetchStatus()

    const systemName = session.systemName || session.sysType?.name || ''
    const entityTypeMode = session.importEntityTypeMode || 'mixed'
    const entityTypeSelections = session.importEntityTypeSelections || {}

    // When phase is 'configure', initialize config from selections
    useEffect(() => {
        if (phase === 'configure' && selectedSources.size > 0 && Object.keys(sourceConfigs).length === 0) {
            const newConfigs = {}
            for (const id of selectedSources) {
                const cfg = {
                    method: SOURCES.find(s => s.id === id)?.methods[0]?.id || 'file',
                    token: '', fileData: null, fileName: '',
                    entityTypeMode,
                    memberEntityTypes: {},
                }
                // Apply per-member selections
                if (entityTypeMode === 'mixed' && entityTypeSelections[id]) {
                    cfg.memberEntityTypes = { ...entityTypeSelections[id] }
                }
                newConfigs[id] = cfg
            }
            setSourceConfigs(newConfigs)
            setConfiguringSource(Array.from(selectedSources)[0])
        }
    }, [phase])

    const getDefaultConfig = (sourceId) => ({
        method: SOURCES.find(s => s.id === sourceId)?.methods[0]?.id || 'file',
        token: '', fileData: null, fileName: '',
        entityTypeMode,
        memberEntityTypes: entityTypeMode === 'mixed' && entityTypeSelections[sourceId]
            ? { ...entityTypeSelections[sourceId] }
            : {},
    })

    const updateSourceConfig = useCallback((sourceId, patch) => {
        setSourceConfigs(prev => ({
            ...prev,
            [sourceId]: { ...getDefaultConfig(sourceId), ...prev[sourceId], ...patch }
        }))
    }, [entityTypeMode, entityTypeSelections])

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
        if (!importMode) {
          setPhase('mode')
          return
        }
        const newConfigs = {}
        for (const id of selectedSources) {
          if (!sourceConfigs[id]) newConfigs[id] = getDefaultConfig(id)
        }
        setSourceConfigs({ ...sourceConfigs, ...newConfigs })
        setConfiguringSource(Array.from(selectedSources)[0])
        if (selectedSources.size === 1 && importMode === 'simple') {
          setSourceTargets({ [Array.from(selectedSources)[0]]: 'both' })
          setPhase('configure')
        } else if (selectedSources.size === 1 && importMode === 'advanced') {
          setSourceTargets({ [Array.from(selectedSources)[0]]: 'both' })
          setPhase('configure')
        } else if (importMode === 'intermediate') {
          setPhase('assign')
        } else {
          setPhase('mode')
        }
    }, [selectedSources, sourceConfigs, importMode])

    const handleModeSelect = useCallback((mode) => {
        setImportMode(mode)
        const sourcesArray = Array.from(selectedSources)
        if (mode === 'simple') {
            const targets = {}
            sourcesArray.forEach(id => { targets[id] = 'both' })
            setSourceTargets(targets)
            setSourcePriority(sourcesArray)
            setPhase('configure')
        } else if (mode === 'intermediate') {
            const targets = {}
            sourcesArray.forEach(id => { targets[id] = 'both' })
            setSourceTargets(targets)
            setSourcePriority([])
            setPhase('assign')
        } else if (mode === 'advanced') {
            const targets = {}
            sourcesArray.forEach(id => { targets[id] = 'both' })
            setSourceTargets(targets)
            setSourcePriority([])
            setPhase('configure')
        }
    }, [selectedSources])

    const moveSourceTarget = useCallback((sourceId, target) => {
        setSourceTargets(prev => ({ ...prev, [sourceId]: target }))
    }, [])

    const movePriority = useCallback((sourceId, direction) => {
        setSourcePriority(prev => {
            const idx = prev.indexOf(sourceId)
            if (idx < 0) return prev
            const next = [...prev]
            const swapIdx = idx + direction
            if (swapIdx < 0 || swapIdx >= next.length) return prev
            ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
            return next
        })
    }, [])

    const handleStartConfigureAfterAssign = useCallback(() => {
        setPhase('configure')
    }, [])

    const handleBack = useCallback(() => {
        if (phase === 'mode') {
            setPhase('select')
            setImportMode(null)
            setSourceTargets({})
            setSourcePriority([])
            return
        }
        if (phase === 'assign') {
            if (!Array.from(selectedSources).every(id => sourceTargets[id] === 'both')) {
                setSourceTargets({})
                setSourcePriority([])
            }
            setPhase('select')
            return
        }
        if (phase === 'configure') {
            if (importMode === 'intermediate' && sourceTargets && Object.values(sourceTargets).some(t => t !== 'both')) {
                setPhase('assign')
            } else if (importMode === 'simple') {
                setPhase('select')
            } else {
                setPhase('mode')
            }
            return
        }
        if (phase === 'preview') {
            setPhase('configure')
            return
        }
        if (phase === 'complete') {
            onBack?.()
            return
        }
        onNavigate?.('register', { startStep: 3 })
        update({ importMode: false, importSources: [], importEntityTypeMode: null, importEntityTypeSelections: {} })
        setPhase('mode')
        setSelectedSources(new Set())
        setSourceConfigs({})
        setPreviews({})
        setSourceTargets({})
        setSourcePriority([])
        setError(null)
    }, [onNavigate, update, onBack, phase, selectedSources, sourceTargets, importMode])

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
            }
        }
        reader.readAsText(file)
    }, [updateSourceConfig])

    const fetchPreviewForSource = useCallback(async (sourceId) => {
        const cfg = sourceConfigs[sourceId]
        const src = SOURCES.find(s => s.id === sourceId)
        setCurrentPreviewSource(sourceId)
        startFetch(`Fetching preview from ${src?.label}...`)

        try {
            const res = await api.previewImport(sourceId, cfg.token.trim() || null, cfg.fileData)
            setPreviews(prev => ({ ...prev, [sourceId]: res.preview }))

            // Apply entity type mode to all members
            const types = {}
            if (cfg.entityTypeMode === 'all_states') {
                res.preview.members.forEach(m => { types[m.sourceId] = 'state' })
            } else if (cfg.entityTypeMode === 'all_alters') {
                res.preview.members.forEach(m => { types[m.sourceId] = 'alter' })
            } else {
                res.preview.members.forEach(m => { types[m.sourceId] = cfg.memberEntityTypes?.[m.sourceId] || 'alter' })
            }

            setSourceConfigs(prev => ({
                ...prev,
                [sourceId]: { ...prev[sourceId], memberEntityTypes: types }
            }))

            completeFetch(`Loaded ${res.preview.members.length} members, ${res.preview.groups.length} groups from ${src?.label}`)
        } catch (err) {
            errorFetch(err.message || 'Failed to fetch preview')
            setError(`${src?.label}: ${err.message || 'Failed to fetch preview'}`)
        } finally {
            setCurrentPreviewSource(null)
        }
    }, [sourceConfigs, startFetch, completeFetch, errorFetch])

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
        setError(null)

        const sourcesArray = Array.from(selectedSources)
        const stagedImports = []

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

                const assignedTarget = sourceTargets[sourceId] || 'app'

                const res = await api.importFromSourceStream(
                    sourceId, cfg.token.trim() || null,
                    {
                        replace: false, skipExisting: true, noGroups: false, noSwitches: false,
                        target: assignedTarget, forceAsStates, stateNames,
                        selectedMemberIds: Array.from(preview.members.map(m => m.sourceId)),
                        selectedGroupIds: Array.from(preview.groups.map(g => g.sourceId)),
                    },
                    cfg.fileData
                )
                stagedImports.push({ sourceId, result: res, success: true })
            } catch (err) {
                stagedImports.push({ sourceId, error: err.message, success: false })
            }
        }

        // Store staged import results in session
        update({ stagedImports })

        // Also merge member/group entity data into staged session
        const allMembers = []
        const allGroups = []
        for (const imp of stagedImports) {
            if (imp.success && imp.result?.result) {
                const r = imp.result.result
                if (r.membersImported && r.importedMembers) {
                    allMembers.push(...r.importedMembers)
                }
                if (r.groupsImported && r.importedGroups) {
                    allGroups.push(...r.importedGroups)
                }
            }
        }

        if (allMembers.length > 0) setMembers(allMembers)
        if (allGroups.length > 0) setGroups(allGroups)

        setPhase('complete')
    }, [selectedSources, sourceConfigs, previews, update, setMembers, setGroups])

    const handleContinueToNameStep = useCallback(async () => {
        update({ importMode: false, importSources: [], importEntityTypeMode: null, importEntityTypeSelections: {} })
        // If imports provided members/groups, skip FirstAlterStep and commit now
        const hasImportedEntities = (session.members?.length || 0) > 0 || (session.groups?.length || 0) > 0
        if (hasImportedEntities) {
            onNavigate?.('register', { startStep: 7 })
        } else {
            onNavigate?.('register', { startStep: 5 })
        }
    }, [onNavigate, update, session.members, session.groups])

    const handleImportMore = useCallback(() => {
        setPhase('select')
        setSelectedSources(new Set())
        setSourceConfigs({})
        setPreviews({})
        setError(null)
    }, [])

    // ===== PHASE 1: Source Selection =====
    if (phase === 'select') {
        return (
            <div className="settings-page">
                <button className="btn btn-back" onClick={handleBack} style={{ marginBottom: 'var(--space-md)' }}>← Back</button>
                <h1>Import Data for {systemName || 'your system'}</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                    Choose where to import your system data from.
                </p>

                <div style={{ marginBottom: 'var(--space-xl)' }}>
                    <div className="settings-section" style={{ border: '1px dashed var(--glass-border)', background: 'rgba(196,181,253,0.05)' }}>
                        <div style={{ marginBottom: 'var(--space-md)', fontWeight: 600 }}>Quick Import</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-sm)' }}>
                            {SOURCES.map(s => (
                                <button key={s.id} className="settings-section" style={{ cursor: 'pointer', textAlign: 'left', padding: 'var(--space-md)', border: '1px solid var(--glass-border)', background: 'var(--bg-card)', borderRadius: 'var(--radius)' }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.transform = 'none' }}
                                    onClick={() => { setSelectedSources(new Set([s.id])); setSourceConfigs({ [s.id]: getDefaultConfig(s.id) }); setConfiguringSource(s.id); setPhase('configure') }}
                                >
                                    <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-xs)' }}>{s.icon}</div>
                                    <div style={{ fontWeight: 600 }}>{s.label}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '2px' }}>Quick import</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="settings-section" style={{ border: '1px dashed var(--glass-border)', background: 'rgba(196,181,253,0.05)' }}>
                    <div style={{ marginBottom: 'var(--space-md)', fontWeight: 600 }}>Import from Multiple Sources</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                        {SOURCES.map(s => (
                            <label key={s.id} style={{
                                display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                                padding: 'var(--space-sm) var(--space-md)', cursor: 'pointer',
                                background: selectedSources.has(s.id) ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                                border: `1px solid ${selectedSources.has(s.id) ? 'var(--accent)' : 'var(--glass-border)'}`,
                                borderRadius: 'var(--radius)'
                            }}>
                                <input type="checkbox" checked={selectedSources.has(s.id)} onChange={() => toggleSource(s.id)} style={{ width: '18px', height: '18px' }} />
                                <span style={{ fontSize: '1.2rem' }}>{s.icon}</span>
                                <span style={{ fontWeight: 500 }}>{s.label}</span>
                            </label>
                        ))}
                    </div>
                    {selectedSources.size > 0 && (
                        <button className="btn-gradient btn-gradient-primary" onClick={handleStartConfigure} style={{ width: '100%', height: '48px' }}>
                            Configure {selectedSources.size} Source{selectedSources.size !== 1 ? 's' : ''} →
                        </button>
                    )}
                </div>
            </div>
        )
    }

    // ===== PHASE 1b: Mode Picker (shown when multiple sources selected) =====
    if (phase === 'mode') {
        const sourcesArray = Array.from(selectedSources)
        return (
            <div className="settings-page">
                <button className="btn btn-back" onClick={handleBack} style={{ marginBottom: 'var(--space-md)' }}>← Back</button>
                <h1>Choose Import Mode</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                    You selected {sourcesArray.length} sources. Pick how you want to organize the import.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                    <button className="settings-section" onClick={() => handleModeSelect('simple')} style={{ cursor: 'pointer', textAlign: 'left', padding: 'var(--space-lg)', border: '1px solid var(--glass-border)', background: 'var(--bg-card)', borderRadius: 'var(--radius)' }}>
                        <div style={{ fontSize: '1.3rem', marginBottom: 'var(--space-xs)' }}>✨ Simple</div>
                        <div style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>One-click import</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>All sources are imported together with default settings. Best when you just want the data.</div>
                    </button>

                    <button className="settings-section" onClick={() => handleModeSelect('intermediate')} style={{ cursor: 'pointer', textAlign: 'left', padding: 'var(--space-lg)', border: '1px solid var(--glass-border)', background: 'var(--bg-card)', borderRadius: 'var(--radius)' }}>
                        <div style={{ fontSize: '1.3rem', marginBottom: 'var(--space-xs)' }}>📋 Intermediate</div>
                        <div style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>Assign sources to Main / Discord</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Choose which sources go to your main profile vs Discord overlay. Set priority for duplicates.</div>
                    </button>

                    <button className="settings-section" onClick={() => handleModeSelect('advanced')} style={{ cursor: 'pointer', textAlign: 'left', padding: 'var(--space-lg)', border: '1px solid var(--glass-border)', background: 'var(--bg-card)', borderRadius: 'var(--radius)' }}>
                        <div style={{ fontSize: '1.3rem', marginBottom: 'var(--space-xs)' }}>🔍 Advanced</div>
                        <div style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>Resolve conflicts per member / group</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Full control: pick which source wins for each duplicate member or group, after preview.</div>
                    </button>
                </div>
            </div>
        )
    }

    // ===== PHASE 1c: Intermediate Assignment =====
    if (phase === 'assign') {
        const sourcesArray = Array.from(selectedSources)
        const mainSources = sourcePriority
        const overlaySources = sourcesArray.filter(id => !mainSources.includes(id))

        const setTarget = (id, t) => {
            moveSourceTarget(id, t)
            setSourcePriority(prev => {
                const next = prev.filter(x => x !== id)
                if (t === 'app') next.unshift(id)
                return next
            })
        }

        return (
            <div className="settings-page">
                <button className="btn btn-back" onClick={handleBack} style={{ marginBottom: 'var(--space-md)' }}>← Back</button>
                <h1>Assign Import Targets</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                    Choose where each source’s data should go. Sources in <strong>Main App</strong> can have priority order to resolve duplicates.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
                    <div className="settings-section" style={{ minHeight: '200px', background: 'var(--bg-card)', border: '1px dashed var(--accent)' }}>
                        <div style={{ fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--accent)' }}>Main App</div>
                        {sourcesArray.map(id => {
                            const src = SOURCES.find(s => s.id === id)
                            if (!mainSources.includes(id)) return null
                            const priorityIdx = mainSources.indexOf(id)
                            return (
                                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', padding: 'var(--space-sm)', background: 'var(--bg-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--glass-border)', marginBottom: 'var(--space-sm)' }}>
                                    <button onClick={() => movePriority(id, -1)} disabled={priorityIdx === 0} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1rem' }}>↑</button>
                                    <button onClick={() => movePriority(id, 1)} disabled={priorityIdx === mainSources.length - 1} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1rem' }}>↓</button>
                                    <span style={{ fontSize: '1.2rem' }}>{src?.icon}</span>
                                    <span style={{ flex: 1, fontWeight: 600 }}>{src?.label}</span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>#{priorityIdx + 1}</span>
                                    <button onClick={() => setTarget(id, 'overlay')} style={{ background: 'none', border: 'none', color: 'var(--color-warning)', cursor: 'pointer', fontSize: '0.8rem' }}>Move to Overlay</button>
                                </div>
                            )
                        })}
                        {mainSources.length === 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-md)' }}>None</div>}
                    </div>

                    <div className="settings-section" style={{ minHeight: '200px', background: 'var(--bg-card)', border: '1px dashed var(--glass-border)' }}>
                        <div style={{ fontWeight: 600, marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>Discord Overlay</div>
                        {sourcesArray.map(id => {
                            const src = SOURCES.find(s => s.id === id)
                            if (!overlaySources.includes(id)) return null
                            return (
                                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', padding: 'var(--space-sm)', background: 'var(--bg-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--glass-border)', marginBottom: 'var(--space-sm)' }}>
                                    <span style={{ fontSize: '1.2rem' }}>{src?.icon}</span>
                                    <span style={{ flex: 1, fontWeight: 600 }}>{src?.label}</span>
                                    <button onClick={() => setTarget(id, 'app')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.8rem' }}>Move to Main</button>
                                </div>
                            )
                        })}
                        {overlaySources.length === 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-md)' }}>None</div>}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                    <button className="btn btn-back" onClick={handleBack} style={{ flex: 1 }}>← Back</button>
                    <button className="btn-gradient btn-gradient-primary" onClick={handleStartConfigureAfterAssign} style={{ flex: 2 }}>Continue →</button>
                </div>
            </div>
        )
    }

    // ===== PHASE 2: Configure =====
    if (phase === 'configure') {
        const sourcesArray = Array.from(selectedSources)
        const currentIdx = sourcesArray.indexOf(configuringSource)
        const currentSourceId = sourcesArray[currentIdx] || sourcesArray[0]
        const src = SOURCES.find(s => s.id === currentSourceId)
        const cfg = sourceConfigs[currentSourceId] || getDefaultConfig(currentSourceId)

        return (
            <div className="settings-page">
                <button className="btn btn-back" onClick={handleBack} style={{ marginBottom: 'var(--space-md)' }}>← Back</button>

                <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', alignItems: 'center' }}>
                    {sourcesArray.map((id, i) => (
                        <span key={id} style={{
                            flex: 1, textAlign: 'center', padding: 'var(--space-xs)',
                            background: i < currentIdx ? 'var(--accent)' : i === currentIdx ? 'var(--accent-subtle)' : 'var(--glass-border)',
                            color: i <= currentIdx ? 'var(--bg)' : 'var(--text-secondary)',
                            borderRadius: 'var(--radius)', fontSize: '0.8rem', fontWeight: 600
                        }}>
                            {SOURCES.find(s => s.id === id)?.icon} {SOURCES.find(s => s.id === id)?.label}
                        </span>
                    ))}
                </div>

                <h1>{src?.icon} Configure {src?.label}</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>Source {currentIdx + 1} of {sourcesArray.length}</p>

                <div className="settings-section" style={{ marginBottom: 'var(--space-md)' }}>
                    <div className="settings-section-title">Import Method</div>
                    <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                        {src?.methods.map(m => (
                            <button key={m.id} onClick={() => updateSourceConfig(currentSourceId, { method: m.id, token: '', fileData: null, fileName: '' })}
                                style={{
                                    flex: 1, padding: 'var(--space-md)', cursor: 'pointer', textAlign: 'center',
                                    background: cfg.method === m.id ? 'var(--accent-subtle)' : 'var(--bg-card)',
                                    border: `1px solid ${cfg.method === m.id ? 'var(--accent)' : 'var(--glass-border)'}`,
                                    borderRadius: 'var(--radius)'
                                }}>
                                <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{METHOD_ICONS[m.id]}</div>
                                <div style={{ fontWeight: 600 }}>{m.label}</div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="settings-section" style={{ marginBottom: 'var(--space-md)' }}>
                    {cfg.method === 'api' ? (
                        <div>
                            <label style={{ fontWeight: 500 }}>{src?.methods.find(m => m.id === cfg.method)?.tokenLabel}</label>
                            <input className="text-input" value={cfg.token} onChange={e => updateSourceConfig(currentSourceId, { token: e.target.value })}
                                placeholder={src?.methods.find(m => m.id === cfg.method)?.tokenPlaceholder} />
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{src?.methods.find(m => m.id === cfg.method)?.help}</div>
                        </div>
                    ) : (
                        <div>
                            <label style={{ fontWeight: 500 }}>Export File (JSON)</label>
                            <input type="file" accept=".json" onChange={e => handleFileChange(currentSourceId, e)} style={{ color: 'var(--text)' }} />
                            {cfg.fileName && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Selected: {cfg.fileName}</div>}
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{src?.methods.find(m => m.id === cfg.method)?.help}</div>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="settings-section" style={{ borderLeft: '3px solid var(--color-error)', marginBottom: 'var(--space-md)' }}>
                        <p style={{ color: 'var(--color-error)', margin: 0 }}><Icon name="x" size={16} /> {error}</p>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
                    {currentIdx > 0 && (
                        <button className="btn btn-back" onClick={() => setConfiguringSource(sourcesArray[currentIdx - 1])} style={{ flex: 1 }}>← Previous</button>
                    )}
                    {currentIdx < sourcesArray.length - 1 ? (
                        <button className="btn-gradient btn-gradient-primary" onClick={() => setConfiguringSource(sourcesArray[currentIdx + 1])} style={{ flex: 1 }}>Next →</button>
                    ) : (
                        <button className="btn-gradient btn-gradient-primary" onClick={() => setPhase('preview')} style={{ flex: 1 }}>Fetch Previews →</button>
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
                <button className="btn btn-back" onClick={() => setPhase('configure')} style={{ marginBottom: 'var(--space-md)' }}>← Back</button>
                <h1>Preview Imports</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>Review what will be imported. All members/groups are selected by default.</p>

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
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Target: <strong>{targetLabel(sourceTargets[sourceId])}</strong></div>
                                </div>
                            </div>

                            <div style={{ padding: 'var(--space-md)' }}>
                                <div style={{ display: 'flex', gap: 'var(--space-lg)', flexWrap: 'wrap', fontSize: '0.9rem', marginBottom: 'var(--space-md)' }}>
                                    <span>Found <strong>{preview.members.length}</strong> member{preview.members.length !== 1 ? 's' : ''}</span>
                                    <span>Found <strong>{preview.groups.length}</strong> group{preview.groups.length !== 1 ? 's' : ''}</span>
                                </div>

                                <div style={{ marginBottom: 'var(--space-md)' }}>
                                    <div style={{ fontWeight: 500, marginBottom: 'var(--space-xs)' }}>Member Types</div>
                                    {cfg.entityTypeMode === 'mixed' && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
                                            {preview.members.map(m => (
                                                <span key={m.sourceId} onClick={() => updateSourceConfig(sourceId, { memberEntityTypes: { ...cfg.memberEntityTypes, [m.sourceId]: cfg.memberEntityTypes?.[m.sourceId] === 'state' ? 'alter' : 'state' } })}
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                                                        background: cfg.memberEntityTypes?.[m.sourceId] === 'state' ? 'var(--color-success-subtle, rgba(34,197,94,0.15))' : 'var(--accent-subtle, rgba(196,181,253,0.15))',
                                                        border: `1px solid ${cfg.memberEntityTypes?.[m.sourceId] === 'state' ? 'var(--color-success, #22c55e)' : 'var(--accent, #c4b5fd)'}`,
                                                        color: cfg.memberEntityTypes?.[m.sourceId] === 'state' ? 'var(--color-success, #22c55e)' : 'var(--accent, #c4b5fd)' }}>
                                                    {m.name || m.sourceId} <span style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>{cfg.memberEntityTypes?.[m.sourceId] === 'state' ? 'State' : 'Alter'}</span>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}

                {error && (
                    <div className="settings-section" style={{ borderLeft: '3px solid var(--color-error)', marginBottom: 'var(--space-md)' }}>
                        <p style={{ color: 'var(--color-error)', margin: 0 }}><Icon name="x" size={16} /> {error}</p>
                    </div>
                )}

                {importMode === 'intermediate' && (
                    <button className="btn btn-back" onClick={() => setPhase('assign')} style={{ marginBottom: 'var(--space-md)' }}>✎ Edit Assignment</button>
                )}

                <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
                    <button className="btn btn-back" onClick={() => setPhase('configure')} style={{ flex: 1 }}>← Back</button>
                    <button className="btn-gradient btn-gradient-primary" onClick={handleImportAll} style={{ flex: 2 }}>
                        Import and Continue →
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
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius)', padding: 'var(--space-xl) var(--space-2xl)', textAlign: 'center', maxWidth: '420px', width: '100%' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-sm)' }}>📥</div>
                        <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 'var(--space-xs)' }}>Importing {selectedSources.size} Source{selectedSources.size !== 1 ? 's' : ''}</div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Please wait...</div>
                    </div>
                </div>
            </div>
        )
    }

    // ===== PHASE 5: Complete =====
    if (phase === 'complete') {
        const results = session?.stagedImports || []
        const allSuccess = results.every(r => r.success)
        const totalMembers = results.reduce((sum, r) => sum + (r.result?.result?.membersImported || 0), 0)
        const totalGroups = results.reduce((sum, r) => sum + (r.result?.result?.groupsImported || 0), 0)

        return (
            <div className="settings-page">
                <h1>Import Complete</h1>

                <div className="settings-section" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>{allSuccess ? '✅' : '⚠️'}</div>
                    <div style={{ fontWeight: 600, fontSize: '1.2rem', marginBottom: 'var(--space-sm)', color: allSuccess ? 'var(--color-success)' : 'var(--color-warning)' }}>
                        {allSuccess ? 'All imports successful!' : 'Some imports had issues'}
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                        Imported <strong>{totalMembers}</strong> member{totalMembers !== 1 ? 's' : ''} and <strong>{totalGroups}</strong> group{totalGroups.length !== 1 ? 's' : ''}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-xl)' }}>
                    <button className="btn-gradient btn-gradient-primary" onClick={handleContinueToNameStep} style={{ flex: 2, height: '56px', fontSize: '1.1rem' }}>
                        Continue to System Setup →
                    </button>
                    <button className="btn btn-ghost" onClick={handleImportMore} style={{ flex: 1, height: '56px' }}>
                        Import More
                    </button>
                </div>
            </div>
        )
    }

    return null
}

export default RegistrationImportPage
