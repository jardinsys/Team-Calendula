import React, { useState, useCallback, useEffect } from 'react'
import { api, Icon } from '@chameleon/shared'
import { useFetchStatus } from '../../hooks/useFetchStatus.jsx'
import { useSystemSession } from '../../hooks/useSystemSession.jsx'

const SOURCES = [
    { id: 'pluralkit', label: 'PluralKit', icon: 'pawPrint', methods: [{ id: 'api', label: 'API Import', tokenLabel: 'API Token', tokenPlaceholder: 'Your PluralKit token', help: 'DM PluralKit: pk;token' }] },
    { id: 'simplyplural', label: 'Simply Plural', icon: '&', methods: [
        { id: 'api', label: 'API Import', tokenLabel: 'API Token', tokenPlaceholder: 'SP API token', help: 'Settings → Developer → Add Token' },
        { id: 'file', label: 'File Import', help: 'Settings → Account → Export Data → Download. Upload the JSON file + avatar folder.' },
    ] },
    { id: 'octocon', label: 'Octocon', icon: 'brain', methods: [{ id: 'api', label: 'API Import', tokenLabel: 'System ID', tokenPlaceholder: '7-char ID', help: 'octocon.app/u/yourid' }, { id: 'file', label: 'File Import', help: 'octocon.app → Settings → Export' }] },
    { id: 'tupperbox', label: 'Tupperbox', icon: 'package', methods: [{ id: 'file', label: 'File Import', help: 'tul!export' }] },
]

const METHOD_ICONS = { api: 'link', file: 'fileText' }

const TARGET_LABELS = { app: 'Main Profile', overlay: 'Discord Overlay' }
const targetLabel = (target) => TARGET_LABELS[target] || target

const SOURCE_HAS_PRIVACY_BUCKETS = { simplyplural: true }

const SOURCE_PRIVACY_LABEL = {
    simplyplural: 'import privacy buckets',
    octocon: 'import groups (Octocon tags)',
}

const PRIVACY_BUCKET_WARNING = (<div><strong>SimplyPlural Friends buckets will be removed.</strong> Friends cannot be reconnected to buckets at this time.</div>)

// Ensure preview always has array members/groups (PK API can return objects)
function normalizePreview(p) {
    if (!p) return { members: [], groups: [] }
    return {
        ...p,
        members: Array.isArray(p.members) ? p.members : [],
        groups: Array.isArray(p.groups) ? p.groups : [],
    }
}

export function RegistrationImportPage({ onNavigate, onBack }) {
    const { session, update, setMembers, setGroups, setSwitches, buildPayload } = useSystemSession()

    const [phase, setPhase] = useState('mode')
    const [selectedSources, setSelectedSources] = useState(new Set())
    const [sourceConfigs, setSourceConfigs] = useState({})
    const [previews, setPreviews] = useState({})
    const [currentPreviewSource, setCurrentPreviewSource] = useState(null)
    const [error, setError] = useState(null)
    const [configuringSource, setConfiguringSource] = useState(null)
    const [importMode, setImportMode] = useState(null)
    const [importing, setImporting] = useState(false)

    const { status: fetchStatus, start: startFetch, complete: completeFetch, error: errorFetch } = useFetchStatus()

    const systemName = session.systemName || session.sysType?.name || ''
    const entityTypeMode = session.importEntityTypeMode || 'mixed'
    const entityTypeSelections = session.importEntityTypeSelections || {}

    const getDefaultConfig = (sourceId) => ({
        method: SOURCES.find(s => s.id === sourceId)?.methods[0]?.id || 'file',
        token: '', fileData: null, fileName: '',
        target: 'app',
        includeSwitches: true,
        includeGroups: true,
        importPrivacyBuckets: false,
        selectedGroupIds: new Set(),
        memberEntityTypes: entityTypeMode === 'mixed' && entityTypeSelections[sourceId]
            ? { ...entityTypeSelections[sourceId] }
            : {},
    })

    useEffect(() => {
        if (phase === 'configure' && selectedSources.size > 0 && Object.keys(sourceConfigs).length === 0) {
            const newConfigs = {}
            for (const id of selectedSources) {
                newConfigs[id] = getDefaultConfig(id)
            }
            setSourceConfigs(newConfigs)
            setConfiguringSource(Array.from(selectedSources)[0])
        }
    }, [phase])

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

    const handleModeSelect = useCallback((mode) => {
        setImportMode(mode)
        setPhase('select')
    }, [])

    const handleStartConfigure = useCallback(() => {
        if (selectedSources.size === 0) return

        if (importMode === 'simple') {
            const only = Array.from(selectedSources)[0]
            setSourceConfigs({ [only]: getDefaultConfig(only) })
            setConfiguringSource(only)
            setPhase('configure')
            return
        }

        if (importMode === 'intermediate' && selectedSources.size !== 1 && selectedSources.size !== 2) {
            setError('Intermediate mode supports exactly 1–2 sources.')
            return
        }
        if (importMode === 'advanced' && selectedSources.size > 4) {
            setError('Select at most 4 sources for Advanced mode.')
            return
        }

        setPhase('configure')
    }, [selectedSources, importMode])

    const handleBack = useCallback(() => {
        if (phase === 'mode') {
            onNavigate?.('register', { startStep: 3 })
            update({ importMode: false, importSources: [], importEntityTypeMode: null, importEntityTypeSelections: {} })
            return
        }
        if (phase === 'configure' || phase === 'select') {
            setPhase('mode')
            setSelectedSources(new Set())
            setSourceConfigs({})
            setPreviews({})
            setImportMode(null)
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
    }, [phase, onNavigate, update, onBack])

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
            const res = await api.previewImport(sourceId, cfg.token.trim() || null, cfg.fileData, { systemConfig: buildPayload() })
            const preview = normalizePreview(res.preview)
            setPreviews(prev => ({ ...prev, [sourceId]: preview }))

            const types = {}
            if (cfg.entityTypeMode === 'all_states') {
                preview.members.forEach(m => { types[m.sourceId] = 'state' })
            } else if (cfg.entityTypeMode === 'all_alters') {
                preview.members.forEach(m => { types[m.sourceId] = 'alter' })
            } else {
                preview.members.forEach(m => {
                    types[m.sourceId] = cfg.memberEntityTypes?.[m.sourceId] || 'alter'
                })
            }

            setSourceConfigs(prev => ({
                ...prev,
                [sourceId]: { ...prev[sourceId], memberEntityTypes: types }
            }))

            completeFetch(`Loaded ${preview.members.length} members, ${preview.groups.length} groups from ${src?.label}`)
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
        setImporting(true)
        try {
        const sourcesArray = Array.from(selectedSources)
            const stagedImports = []

        for (const sourceId of sourcesArray) {
            const cfg = sourceConfigs[sourceId]
            const preview = previews[sourceId]
            if (!preview) continue

            try {
                const forceAsStates = cfg.entityTypeMode === 'all_states' ||
                    (cfg.entityTypeMode === 'mixed' && Object.values(cfg.memberEntityTypes || {}).every(t => t === 'state'))

                const stateNames = cfg.entityTypeMode === 'mixed' && forceAsStates
                    ? preview.members.filter(m => cfg.memberEntityTypes?.[m.sourceId] === 'state').map(m => m.name.toLowerCase())
                    : undefined

                const selectedMemberIds = Array.from(
                    cfg.entityTypeMode === 'mixed'
                        ? preview.members.filter(m => cfg.memberEntityTypes?.[m.sourceId] === 'alter' || cfg.memberEntityTypes?.[m.sourceId] === 'state').map(m => m.sourceId)
                        : preview.members.map(m => m.sourceId)
                )
                const selectedGroupIds = importMode === 'advanced'
                    ? Array.from(cfg.selectedGroupIds || [])
                    : Array.from(preview.groups.map(g => g.sourceId))

                const res = await api.importFromSourceStream(
                    sourceId, cfg.token.trim() || null,
                    {
                        replace: false, skipExisting: true,
                        noGroups: !cfg.includeGroups, noSwitches: !cfg.includeSwitches,
                        target: cfg.target, forceAsStates, stateNames,
                        selectedMemberIds, selectedGroupIds,
                        systemConfig: buildPayload(),
                    },
                    cfg.fileData
                )
                stagedImports.push({ sourceId, result: res, success: true })
            } catch (err) {
                stagedImports.push({ sourceId, error: err.message, success: false })
            }
        }

        update({ stagedImports })

        const allMembers = []
        const allGroups = []
        const allShifts = []
        for (const imp of stagedImports) {
            if (imp.success && imp.result?.result) {
                const r = imp.result.result
                if (r.importedMembers) allMembers.push(...r.importedMembers)
                if (r.importedGroups) allGroups.push(...r.importedGroups)
                if (r.importedShifts) allShifts.push(...r.importedShifts)
            }
        }

        // Map Mongoose documents to session format (buildPayload expects { id, name, entityType })
        if (allMembers.length > 0) {
            setMembers(allMembers.map(m => ({
                id: m._id?.toString?.() || m._id,
                name: m.name?.display || m.name?.indexable || m.name || 'Unknown',
                entityType: m.entityType || 'alter',
                _raw: m,
            })))
        }
        if (allGroups.length > 0) {
            setGroups(allGroups.map(g => ({
                id: g._id?.toString?.() || g._id,
                name: g.name?.display || g.name?.indexable || g.name || 'Unknown',
                _raw: g,
            })))
        }
        if (allShifts.length > 0) setSwitches(allShifts)

        setPhase('complete')
        } finally {
            setImporting(false)
        }
    }, [selectedSources, sourceConfigs, previews, importMode, update, setMembers, setGroups, setSwitches])

    const handleContinueToNameStep = useCallback(() => {
        update({ importMode: false, importSources: [], importEntityTypeMode: null, importEntityTypeSelections: {} })
        const hasImportedEntities = (session.members?.length || 0) > 0 || (session.groups?.length || 0) > 0
        if (hasImportedEntities) {
            onNavigate?.('register', { startStep: 7 })
        } else {
            onNavigate?.('register', { startStep: 5 })
        }
    }, [onNavigate, update, session.members, session.groups])

    // ===== PHASE 1a: Mode Picker =====
    if (phase === 'mode') {
        return (
            <div className="settings-page">
                <button className="btn btn-back" onClick={handleBack} style={{ marginBottom: 'var(--space-md)' }}>← Back</button>
                <h1>Choose Import Mode</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                    Pick how much control you want over your import.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                    <button className="settings-section" onClick={() => handleModeSelect('simple')} style={{ cursor: 'pointer', textAlign: 'left', padding: 'var(--space-lg)', border: '1px solid var(--glass-border)', background: 'var(--bg-card)', borderRadius: 'var(--radius)', color: 'var(--text)', fontFamily: 'var(--font-accent)' }}>
                        <div style={{ fontSize: '1.3rem', marginBottom: 'var(--space-xs)', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}><Icon name="sparkles" size={18} /> Simple</div>
                        <div style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>One-click import</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>One source only. Everything imported together with sensible defaults.</div>
                    </button>

                    <button className="settings-section" onClick={() => handleModeSelect('intermediate')} style={{ cursor: 'pointer', textAlign: 'left', padding: 'var(--space-lg)', border: '1px solid var(--glass-border)', background: 'var(--bg-card)', borderRadius: 'var(--radius)', color: 'var(--text)', fontFamily: 'var(--font-accent)' }}>
                        <div style={{ fontSize: '1.3rem', marginBottom: 'var(--space-xs)', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}><Icon name="clipboardList" size={18} /> Intermediate</div>
                        <div style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>Choose source targets</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>1–2 sources. Pick each source’s target (Main Profile or Discord Overlay).</div>
                    </button>

                    <button className="settings-section" onClick={() => handleModeSelect('advanced')} style={{ cursor: 'pointer', textAlign: 'left', padding: 'var(--space-lg)', border: '1px solid var(--glass-border)', background: 'var(--bg-card)', borderRadius: 'var(--radius)', color: 'var(--text)', fontFamily: 'var(--font-accent)' }}>
                        <div style={{ fontSize: '1.3rem', marginBottom: 'var(--space-xs)', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}><Icon name="search" size={18} /> Advanced</div>
                        <div style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>Full control</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>1–4 sources. Pick targets, toggle switches/groups, and assign per-entity types.</div>
                    </button>
                </div>
            </div>
        )
    }

    // ===== PHASE 1b: Choose Sources =====
    if (phase === 'select') {
        return (
            <div className="settings-page">
                <button className="btn btn-back" onClick={handleBack} style={{ marginBottom: 'var(--space-md)' }}>← Back</button>
                <h1>Choose Sources</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                    {importMode === 'simple'
                        ? 'Pick the one source you want to import.'
                        : `Pick 1–${importMode === 'intermediate' ? '2' : '4'} sources to import.`}
                </p>

                {importMode !== 'simple' && (
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        <div className="settings-section" style={{ border: '1px dashed var(--glass-border)', background: 'rgba(196,181,253,0.05)' }}>
                            <div style={{ marginBottom: 'var(--space-md)', fontWeight: 600 }}>Select Sources</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                                {SOURCES.map(s => (
                                    <label key={s.id} style={{
                                        display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                                        padding: 'var(--space-sm) var(--space-md)', cursor: 'pointer',
                                        background: selectedSources.has(s.id) ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                                        border: `1px solid ${selectedSources.has(s.id) ? 'var(--accent)' : 'var(--glass-border)'}`,
                                        borderRadius: 'var(--radius)',
                                    }}>
                                        <input type="checkbox" checked={selectedSources.has(s.id)} onChange={() => toggleSource(s.id)} style={{ width: '18px', height: '18px' }} />
                                        <Icon name={s.icon} size={16} />
                                        <span style={{ fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-accent)' }}>{s.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {importMode === 'simple' && (
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-md)' }}>
                            {SOURCES.map(s => (
                                <button key={s.id} onClick={() => { setSelectedSources(new Set([s.id])); setSourceConfigs({ [s.id]: getDefaultConfig(s.id) }); setConfiguringSource(s.id); setPhase('configure') }}
                                    style={{ cursor: 'pointer', textAlign: 'left', padding: 'var(--space-lg)', border: '1px solid var(--glass-border)', background: 'var(--bg-card)', borderRadius: 'var(--radius)', transition: 'border-color 0.2s, transform 0.1s', color: 'var(--text)', fontFamily: 'var(--font-accent)' }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.transform = 'none' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)', display: 'flex', justifyContent: 'center' }}><Icon name={s.icon} size={32} /></div>
                                    <div style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>{s.label}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: 'var(--space-xs)', fontWeight: 500 }}>Select and continue →</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {importMode !== 'simple' && (
                    <button className="btn-gradient btn-gradient-primary" onClick={handleStartConfigure} style={{ width: '100%', height: '48px' }} disabled={selectedSources.size === 0}>
                        Configure {selectedSources.size} Source{selectedSources.size !== 1 ? 's' : ''} →
                    </button>
                )}
            </div>
        )
    }

    // ===== PHASE 2: Configure (per-source, mode-specific) =====
    if (phase === 'configure') {
        const sourcesArray = Array.from(selectedSources)
        const currentIdx = sourcesArray.indexOf(configuringSource)
        const currentSourceId = sourcesArray[currentIdx] || sourcesArray[0]
        const src = SOURCES.find(s => s.id === currentSourceId)
        const cfg = sourceConfigs[currentSourceId] || getDefaultConfig(currentSourceId)
        const hasPrivacyBuckets = SOURCE_HAS_PRIVACY_BUCKETS[currentSourceId]

        return (
            <div className="settings-page">
                <button className="btn btn-back" onClick={handleBack} style={{ marginBottom: 'var(--space-md)' }}>← Back</button>

                <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', alignItems: 'center' }}>
                    {sourcesArray.map((id, i) => (
                        <span key={id} style={{
                            flex: 1, textAlign: 'center', padding: 'var(--space-xs)',
                            background: i < currentIdx ? 'var(--accent)' : i === currentIdx ? 'var(--accent-subtle)' : 'var(--glass-border)',
                            color: i <= currentIdx ? 'var(--bg)' : 'var(--text-secondary)',
                            borderRadius: 'var(--radius)', fontSize: '0.8rem', fontWeight: 600,
                            fontFamily: 'var(--font-accent)'
                        }}>
                            <Icon name={SOURCES.find(s => s.id === id)?.icon} size={14} /> {SOURCES.find(s => s.id === id)?.label}
                        </span>
                    ))}
                </div>

                <h1><Icon name={src?.icon} size={24} /> Configure {src?.label}</h1>
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
                                    borderRadius: 'var(--radius)', transition: 'all 0.2s',
                                    color: 'var(--text)', fontFamily: 'var(--font-accent)'
                                }}>
                                <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-xs)', display: 'flex', justifyContent: 'center' }}><Icon name={METHOD_ICONS[m.id]} size={20} /></div>
                                <div style={{ fontWeight: 600 }}>{m.label}</div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="settings-section" style={{ marginBottom: 'var(--space-md)' }}>
                    {cfg.method === 'api' ? (
                        <div className="form-group">
                            <label>{src?.methods.find(m => m.id === cfg.method)?.tokenLabel}</label>
                            <input className="text-input" type="text" value={cfg.token} onChange={e => updateSourceConfig(currentSourceId, { token: e.target.value })}
                                placeholder={src?.methods.find(m => m.id === cfg.method)?.tokenPlaceholder} />
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>{src?.methods.find(m => m.id === cfg.method)?.help}</div>
                        </div>
                    ) : (
                        <div className="form-group">
                            <label>Export File (JSON)</label>
                            <input type="file" accept=".json" onChange={e => handleFileChange(currentSourceId, e)} style={{ color: 'var(--text)' }} />
                            {cfg.fileName && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>Selected: {cfg.fileName}</div>}
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 'var(--space-sm)' }}>{src?.methods.find(m => m.id === cfg.method)?.help}</div>
                        </div>
                    )}
                </div>

                <div className="settings-section" style={{ marginBottom: 'var(--space-md)' }}>
                    <div className="settings-section-title">Import Target</div>
                    <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                        {Object.entries(TARGET_LABELS).map(([value, label]) => (
                            <button key={value} onClick={() => updateSourceConfig(currentSourceId, { target: value })}
                                style={{
                                    flex: 1, padding: 'var(--space-md)', cursor: 'pointer', textAlign: 'center',
                                    background: cfg.target === value ? 'var(--accent-subtle)' : 'var(--bg-card)',
                                    border: `1px solid ${cfg.target === value ? 'var(--accent)' : 'var(--glass-border)'}`,
                                    borderRadius: 'var(--radius)', transition: 'all 0.2s',
                                    color: 'var(--text)', fontFamily: 'var(--font-accent)'
                                }}>
                                <div style={{ fontWeight: 600 }}>{label}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {(importMode === 'advanced' || importMode === 'intermediate') && (
                    <div className="settings-section" style={{ marginBottom: 'var(--space-md)' }}>
                        <div className="settings-section-title">Options</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--font-accent)' }}>
                                <input type="checkbox" checked={cfg.includeGroups} onChange={e => updateSourceConfig(currentSourceId, { includeGroups: e.target.checked })} style={{ width: '18px', height: '18px' }} />
                                Include groups
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--font-accent)' }}>
                                <input type="checkbox" checked={cfg.includeSwitches} onChange={e => updateSourceConfig(currentSourceId, { includeSwitches: e.target.checked })} style={{ width: '18px', height: '18px' }} />
                                Include switch history
                            </label>
                        </div>
                    </div>
                )}

                {importMode === 'simple' && (
                    <div className="settings-section" style={{ marginBottom: 'var(--space-md)', background: 'rgba(196,181,253,0.08)', border: '1px solid var(--glass-border)' }}>
                        <div style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>Simple mode defaults</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Target: <strong>Main Profile</strong> · All members/groups/switches will be imported automatically.
                        </div>
                    </div>
                )}

                {error && (
                    <div className="settings-section" style={{ borderLeft: '3px solid var(--color-error)', marginBottom: 'var(--space-md)' }}>
                        <p style={{ color: 'var(--color-error)', margin: 0 }}><Icon name="x" size={16} /> {error}</p>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
                    {currentIdx > 0 && (
                        <button className="btn btn-ghost" onClick={() => setConfiguringSource(sourcesArray[currentIdx - 1])} style={{ flex: 1 }}>
                            ← Previous
                        </button>
                    )}
                    {currentIdx < sourcesArray.length - 1 ? (
                        <button className="btn-gradient btn-gradient-primary" onClick={() => setConfiguringSource(sourcesArray[currentIdx + 1])} style={{ flex: 1 }}>
                            Next →
                        </button>
                    ) : (
                        <button className="btn-gradient btn-gradient-primary" onClick={() => setPhase('preview')} style={{ flex: 1 }}>
                            Review Preview →
                        </button>
                    )}
                </div>
            </div>
        )
    }

    // ===== PHASE 3: Preview & Import =====
    if (phase === 'preview') {
        const sourcesArray = Array.from(selectedSources)
        const hasAnyPreview = sourcesArray.some(id => previews[id])

        return (
            <div className="settings-page">
                <button className="btn btn-back" onClick={() => setPhase('configure')} style={{ marginBottom: 'var(--space-md)' }}>← Back</button>
                <h1>Review Import</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                    {importMode === 'simple' ? 'Confirm before importing.'
                        : importMode === 'intermediate'
                            ? 'Review targets for each source.'
                            : 'Review each source and its settings.'}
                </p>

                {!hasAnyPreview && fetchStatus?.phase === 'fetching' && (
                    <div className="settings-section" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-lg)' }}>
                        <div className="spinner" style={{ width: 20, height: 20, border: '2px solid var(--glass-border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{fetchStatus.label || 'Loading...'}</span>
                    </div>
                )}

                {sourcesArray.map(sourceId => {
                    const preview = previews[sourceId]
                    const cfg = sourceConfigs[sourceId]
                    const src = SOURCES.find(s => s.id === sourceId)
                    const hasPrivacyBuckets = SOURCE_HAS_PRIVACY_BUCKETS[sourceId]
                    if (!preview) return null

                    return (
                        <div key={sourceId} className="settings-section" style={{ marginBottom: 'var(--space-lg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                            <div style={{ padding: 'var(--space-md)', background: 'var(--bg-card)', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                <Icon name={src?.icon} size={20} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>{src?.label}</div>
                                    {importMode !== 'simple' && (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            Target: <strong>{targetLabel(cfg.target)}</strong>
                                        </div>
                                    )}
                                    {hasPrivacyBuckets && (
                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: cfg.importPrivacyBuckets ? 'var(--color-warning)' : 'var(--text-muted)', marginTop: '2px', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={cfg.importPrivacyBuckets} onChange={() => updateSourceConfig(sourceId, { importPrivacyBuckets: !cfg.importPrivacyBuckets })} style={{ width: '16px', height: '16px' }} />
                                            {cfg.importPrivacyBuckets ? (SOURCE_PRIVACY_LABEL[sourceId] || 'import privacy buckets') : 'skip'}
                                        </label>
                                    )}
                                    {!hasPrivacyBuckets && cfg.importPrivacyBuckets && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Privacy buckets not available for this source</div>
                                    )}
                                </div>
                            </div>

                            <div style={{ padding: 'var(--space-md)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-sm)', fontSize: '0.9rem', marginBottom: 'var(--space-md)' }}>
                                    <div className="settings-section" style={{ padding: 'var(--space-sm)' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '2px' }}>Members</div>
                                        <div style={{ fontWeight: 600 }}>{preview.members.length}</div>
                                    </div>
                                    <div className="settings-section" style={{ padding: 'var(--space-sm)' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '2px' }}>Groups</div>
                                        <div style={{ fontWeight: 600 }}>{preview.groups.length}</div>
                                    </div>
                                    <div className="settings-section" style={{ padding: 'var(--space-sm)', borderLeft: '3px solid var(--color-success)' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '2px' }}>New</div>
                                        <div style={{ color: 'var(--color-success)', fontWeight: 700 }}>{preview.members.filter(m => m.action === 'new').length}</div>
                                    </div>
                                    <div className="settings-section" style={{ padding: 'var(--space-sm)', borderLeft: '3px solid var(--color-warning)' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '2px' }}>Will update</div>
                                        <div style={{ color: 'var(--color-warning)', fontWeight: 700 }}>{preview.members.filter(m => m.action === 'update').length}</div>
                                    </div>
                                    {preview.switches && (
                                        <div className="settings-section" style={{ padding: 'var(--space-sm)', borderLeft: '3px solid var(--accent)', gridColumn: 'span 2' }}>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '2px' }}>Switch / fronting history</div>
                                            <div style={{ fontWeight: 600 }}>{preview.switches.length} events</div>
                                        </div>
                                    )}
                                </div>

                                {importMode === 'advanced' && (
                                    <div>
                                        <div style={{ fontWeight: 500, marginBottom: 'var(--space-xs)' }}>Import As</div>
                                        <div style={{ display: 'flex', gap: 'var(--space-xs)', marginBottom: 'var(--space-sm)' }}>
                                            {[
                                                { id: 'all_alters', label: 'All Alters' },
                                                { id: 'mixed', label: 'Mixed' },
                                                { id: 'all_states', label: 'All States' },
                                            ].map(opt => (
                                                <button key={opt.id} onClick={() => {
                                                    const types = {}
                                                    if (opt.id === 'all_states') preview.members.forEach(m => { types[m.sourceId] = 'state' })
                                                    else if (opt.id === 'all_alters') preview.members.forEach(m => { types[m.sourceId] = 'alter' })
                                                    else preview.members.forEach(m => { types[m.sourceId] = cfg.memberEntityTypes?.[m.sourceId] || 'alter' })
                                                    updateSourceConfig(sourceId, { entityTypeMode: opt.id, memberEntityTypes: types })
                                                }} style={{
                                                    flex: 1, padding: 'var(--space-sm)',
                                                    border: `1px solid ${cfg.entityTypeMode === opt.id ? 'var(--accent)' : 'var(--glass-border)'}`,
                                                    background: cfg.entityTypeMode === opt.id ? 'var(--accent-subtle)' : 'var(--bg-card)',
                                                    borderRadius: 'var(--radius)',
                                                    color: cfg.entityTypeMode === opt.id ? 'var(--accent)' : 'var(--text-secondary)',
                                                    cursor: 'pointer', fontSize: '0.85rem', fontWeight: cfg.entityTypeMode === opt.id ? 600 : 400
                                                }}>
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>

                                        {cfg.entityTypeMode === 'mixed' && (
                                            <div style={{ marginTop: 'var(--space-md)', maxHeight: '300px', overflowY: 'auto' }}>
                                                <div className="settings-section-title" style={{ marginBottom: 'var(--space-xs)' }}>Member Types</div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
                                                    {preview.members.map(m => (
                                                        <span key={m.sourceId} onClick={() => updateSourceConfig(sourceId, {
                                                            memberEntityTypes: { ...cfg.memberEntityTypes, [m.sourceId]: cfg.memberEntityTypes?.[m.sourceId] === 'state' ? 'alter' : 'state' }
                                                        })} style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                            padding: '4px 10px', borderRadius: '999px',
                                                            background: cfg.memberEntityTypes?.[m.sourceId] === 'state' ? 'var(--color-success-subtle, rgba(34,197,94,0.15))' : 'var(--accent-subtle, rgba(196,181,253,0.15))',
                                                            border: `1px solid ${cfg.memberEntityTypes?.[m.sourceId] === 'state' ? 'var(--color-success, #22c55e)' : 'var(--accent, #c4b5fd)'}`,
                                                            color: cfg.memberEntityTypes?.[m.sourceId] === 'state' ? 'var(--color-success, #22c55e)' : 'var(--accent, #c4b5fd)',
                                                            fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
                                                        }}>
                                                            {m.name || m.sourceId} <span style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>
                                                                {cfg.memberEntityTypes?.[m.sourceId] === 'state' ? 'State' : 'Alter'}
                                                            </span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {preview.groups.length > 0 && (
                                            <div style={{ marginTop: 'var(--space-md)' }}>
                                                <div className="settings-section-title" style={{ marginBottom: 'var(--space-xs)' }}>Groups to Import</div>
                                                <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {preview.groups.map(g => {
                                                        const selected = (cfg.selectedGroupIds || new Set()).has(g.sourceId)
                                                        return (
                                                            <label key={g.sourceId} style={{
                                                                display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                                                                padding: 'var(--space-xs) var(--space-sm)', cursor: 'pointer',
                                                                background: selected ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                                                                border: `1px solid ${selected ? 'var(--accent)' : 'var(--glass-border)'}`,
                                                                borderRadius: 'var(--radius)', fontSize: '0.85rem'
                                                            }}>
                                                                <input type="checkbox" checked={selected} onChange={() => {
                                                                    const next = new Set(cfg.selectedGroupIds || preview.groups.map(x => x.sourceId))
                                                                    if (next.has(g.sourceId)) next.delete(g.sourceId)
                                                                    else next.add(g.sourceId)
                                                                    updateSourceConfig(sourceId, { selectedGroupIds: next })
                                                                }} style={{ width: '18px', height: '18px' }} />
                                                                <span>{g.name || g.sourceId}</span>
                                                            </label>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
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
                    <button className={`${importing ? 'btn-loading' : 'btn-gradient'} btn-gradient-primary`} onClick={handleImportAll} disabled={importing || fetchStatus?.phase === 'fetching'} style={{ flex: 2 }}>
                        {importing ? 'Importing...' : fetchStatus?.phase === 'fetching' ? 'Fetching preview...' : 'Import and Continue →'}
                    </button>
                </div>
            </div>
        )
    }

    // ===== PHASE 4: Importing =====
    if (phase === 'importing') {
        const sourcesArray = Array.from(selectedSources);
        const stagedResults = (session?.stagedImports || []).slice();
        const completedSourceIds = new Set(stagedResults.map(r => r.sourceId));
        const activeSourceId = sourcesArray.find(id => !completedSourceIds.has(id)) || null;
        const activeSource = activeSourceId ? SOURCES.find(s => s.id === activeSourceId) : null;

        return (
            <div className="settings-page" style={{ position: 'relative' }}>
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13, 13, 20, 0.85)', backdropFilter: 'blur(8px)' }}>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius)', padding: 'var(--space-xl) var(--space-2xl)', textAlign: 'center', maxWidth: '480px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-sm)' }}><Icon name="download" size={32} /></div>
                        <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 'var(--space-xs)' }}>
                            Importing {sourcesArray.length} source{sourcesArray.length !== 1 ? 's' : ''}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                            Please don't close this window
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', padding: 'var(--space-sm)', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-md)', textAlign: 'left' }}>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                {activeSource ? `Importing from ${activeSource.label}` : 'Finishing up...'}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                {activeSource ? 'This may take a moment while we fetch and sync members, groups, and history.' : 'Wrapping up the last details.'}
                            </div>
                            {stagedResults.filter(r => r.success).length > 0 && (
                                <div style={{ color: 'var(--color-success)', fontSize: '0.8rem', marginTop: 'var(--space-xs)' }}>
                                    Imported {stagedResults.filter(r => r.success).length} of {sourcesArray.length} sources
                                </div>
                            )}
                        </div>

                        {!!stagedResults.length && (
                            <div style={{ flex: 1, overflowY: 'auto', textAlign: 'left', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius)', padding: 'var(--space-sm)', fontSize: '0.8rem', fontFamily: 'var(--font-body)', color: 'var(--text-secondary)', maxHeight: '260px' }}>
                                {stagedResults.map((r, i) => {
                                    const src = SOURCES.find(s => s.id === r.sourceId);
                                    return (
                                        <div key={i} style={{ padding: 'var(--space-xs) 0', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                            <Icon name={src?.icon} size={16} />
                                            <span style={{ color: r.success ? 'var(--color-success)' : 'var(--color-error)' }}>
                                                {r.success ? 'Imported' : 'Failed'}: {src?.label || r.sourceId}
                                            </span>
                                            {r.success && r.result ? (
                                                <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>
                                                    {r.result?.result?.membersImported ?? 0} members, {r.result?.result?.groupsImported ?? 0} groups
                                                </span>
                                            ) : null}
                                            {!r.success ? <span style={{ opacity: 0.8 }}>{r.error}</span> : null}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ===== PHASE 5: Complete =====
    if (phase === 'complete') {
        const results = session?.stagedImports || []
        const allSuccess = results.length > 0 && results.every(r => r.success)
        const totalMembers = results.reduce((sum, r) => sum + (r.result?.result?.membersImported || 0), 0)
        const totalGroups = results.reduce((sum, r) => sum + (r.result?.result?.groupsImported || 0), 0)

        return (
            <div className="settings-page">
                <button className="btn btn-back" onClick={handleBack} style={{ marginBottom: 'var(--space-md)' }}>← Back</button>
                <h1>Import Complete</h1>

                <div className="settings-section" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>{allSuccess ? <Icon name="check" size={48} color="var(--color-success)" /> : <Icon name="alert" size={48} color="var(--color-warning)" />}</div>
                    <div style={{ fontWeight: 600, fontSize: '1.2rem', marginBottom: 'var(--space-sm)', color: allSuccess ? 'var(--color-success)' : 'var(--color-warning)' }}>
                        {allSuccess ? 'Your import is done! Welcome to Systemiser!' : 'Some parts of the import need attention'}
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                        Imported <strong>{totalMembers}</strong> member{totalMembers !== 1 ? 's' : ''} and <strong>{totalGroups}</strong> group{totalGroups !== 1 ? 's' : ''}
                        {' '}across <strong>{results.length}</strong> source{results.length !== 1 ? 's' : ''}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)', flexWrap: 'wrap' }}>
                    <button className="btn-gradient btn-gradient-primary" onClick={handleContinueToNameStep} style={{ flex: 1, minWidth: '200px', height: '56px', fontSize: '1.1rem' }}>
                        Continue to System Setup →
                    </button>
                </div>
            </div>
        )
    }

    return null
}

export default RegistrationImportPage
