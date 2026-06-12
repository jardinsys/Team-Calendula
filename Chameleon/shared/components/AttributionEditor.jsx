import React, { useState, useEffect } from 'react'
import api from '../api/client.js'

function AttributionEditor({ attributions = [], onChange, sysType, isShared = false, compact = false }) {
    const [showPicker, setShowPicker] = useState(false)
    const [entities, setEntities] = useState([])
    const [activeTab, setActiveTab] = useState('alter')
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [frontEntities, setFrontEntities] = useState([])
    const [loadingFront, setLoadingFront] = useState(false)

    const isSystem = !!sysType?.isSystem
    const isFragmented = !!sysType?.isFragmented
    const isDissociative = !!sysType?.isDissociative
    const isBasic = !isSystem && !isFragmented && !isDissociative

    const showAttribution = isSystem || isFragmented || isDissociative || isShared

    const entityTabs = ['alter', 'group']

    useEffect(() => {
        if (showPicker) {
            setActiveTab(isDissociative ? 'state' : 'alter')
            setSearch('')
            setEntities([])
        }
    }, [showPicker, isDissociative])

    useEffect(() => {
        if (showPicker) loadEntities()
    }, [activeTab, showPicker])

    const loadEntities = async () => {
        setLoading(true)
        setError(null)
        try {
            let data
            if (activeTab === 'alter') data = await api.getAlters()
            else if (activeTab === 'state') data = await api.getStates()
            else data = await api.getGroups()
            setEntities(data || [])
        } catch (err) {
            setError(err.message)
        }
        setLoading(false)
    }

    const loadFront = async () => {
        setLoadingFront(true)
        try {
            const front = await api.getFront()
            const all = []
            for (const layer of front.layers || []) {
                const stateIds = []
                const layerEntities = []
                for (const f of layer.fronters || []) {
                    if (f.type === 'state') {
                        stateIds.push(f._id)
                        continue
                    }
                    if (!['alter', 'group'].includes(f.type)) continue
                    layerEntities.push({
                        type: f.type,
                        id: f._id,
                        name: f.name?.display || f.name?.indexable || 'Unknown',
                        avatar: f.avatar?.url || f.avatar,
                        color: f.color,
                        entityStates: stateIds.length ? { priorityID: stateIds[0], allIDs: stateIds } : undefined
                    })
                }
                all.push(...layerEntities)
            }
            setFrontEntities(all)
        } catch (err) {
            setError(err.message)
        }
        setLoadingFront(false)
    }

    const addEntity = (entity) => {
        const eid = entity._id || entity.id
        if (attributions.some(a => a.type === entity.type && a.id === eid)) return
        const newEntry = {
            type: entity.type || activeTab,
            id: eid,
            name: entity.name?.display || entity.name?.indexable || entity.name || 'Unknown',
            avatar: entity.avatar?.url || entity.avatar,
            color: entity.color
        }
        onChange?.([...attributions, newEntry])
    }

    const removeEntity = (index) => {
        onChange?.(attributions.filter((_, i) => i !== index))
    }

    const addFromFront = async () => {
        if (!frontEntities.length) await loadFront()
        const current = frontEntities.length ? frontEntities : []
        const existingIds = new Set(attributions.map(a => `${a.type}:${a.id}`))
        const newOnes = current.filter(e => !existingIds.has(`${e.type}:${e.id}`))
        if (newOnes.length) {
            onChange?.([...attributions, ...newOnes])
        }
    }

    const filtered = entities.filter(e => {
        const name = e.name?.display || e.name?.indexable || ''
        return name.toLowerCase().includes(search.toLowerCase())
    })

    const isLinked = (entity) => {
        const eid = entity._id || entity.id
        return attributions.some(a => a.type === activeTab && a.id === eid)
    }

    if (!showAttribution) return null

    const buttonLabel = isDissociative ? 'Configure Attribution' : 'Add Attribution'

    return (
        <>
            {attributions.length > 0 && (
                <div className="attribution-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: compact ? '8px' : '12px' }}>
                    {attributions.map((ent, i) => (
                        <span key={`${ent.type}-${ent.id}-${i}`} className="attribution-chip" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '2px 8px', borderRadius: '12px',
                            border: `1px solid ${ent.color || 'var(--glass-border)'}`,
                            fontSize: '0.75rem', color: 'var(--text)',
                            background: 'var(--bg-surface)'
                        }}>
                            {ent.avatar && <img src={ent.avatar} alt="" style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }} />}
                            <span>{ent.name}</span>
                            <button
                                type="button"
                                onClick={() => removeEntity(i)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0', fontSize: '0.9rem', lineHeight: 1 }}
                            >
                                &times;
                            </button>
                        </span>
                    ))}
                </div>
            )}

            <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowPicker(true)}
            >
                {attributions.length > 0 ? 'Edit Attribution' : buttonLabel}
            </button>

            {showPicker && (
                <div className="modal-overlay" onClick={() => setShowPicker(false)} style={{ zIndex: 300 }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ borderRadius: '20px', maxHeight: '70vh' }}>
                        <div className="modal-header">
                            <button className="btn-ghost" onClick={() => setShowPicker(false)}>&larr; Done</button>
                            <h2 className="modal-title" style={{ fontSize: '1.1rem' }}>
                                {isDissociative ? 'Configure Attribution' : 'Add Attribution'}
                            </h2>
                            <div style={{ width: '60px' }} />
                        </div>

                        {attributions.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                                {attributions.map((ent, i) => (
                                    <span key={`${ent.type}-${ent.id}-${i}`} style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        padding: '4px 10px', borderRadius: '12px',
                                        border: `1px solid ${ent.color || 'var(--glass-border)'}`,
                                        fontSize: '0.8rem', color: 'var(--text)',
                                        background: 'var(--bg-surface)'
                                    }}>
                                        {ent.avatar && <img src={ent.avatar} alt="" style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }} />}
                                        <span>{ent.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeEntity(i)}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0', fontSize: '1rem', lineHeight: 1 }}
                                        >
                                            &times;
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={addFromFront}
                                disabled={loadingFront}
                                style={{ flex: 1 }}
                            >
                                {loadingFront ? 'Loading...' : 'From Front'}
                            </button>
                        </div>

                        {entityTabs.length > 1 && (
                            <div className="entity-tabs" style={{ marginBottom: '8px' }}>
                                {entityTabs.map(tab => (
                                    <button
                                        key={tab}
                                        type="button"
                                        className={`entity-tab ${activeTab === tab ? 'active' : ''}`}
                                        onClick={() => { setActiveTab(tab); setSearch('') }}
                                    >
                                        {tab.charAt(0).toUpperCase() + tab.slice(1)}s
                                    </button>
                                ))}
                            </div>
                        )}

                        <input
                            className="text-input"
                            type="text"
                            placeholder={`Search ${activeTab}s...`}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoFocus
                        />

                        <div style={{ marginTop: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                            {loading ? (
                                <div className="status-screen" style={{ padding: '16px' }}>
                                    <div className="spinner" />
                                </div>
                            ) : filtered.length === 0 ? (
                                <p style={{ padding: '12px 0', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.85rem' }}>
                                    {entities.length === 0 ? `No ${activeTab}s found` : 'No matches'}
                                </p>
                            ) : (
                                filtered.map(entity => {
                                    const name = entity.name?.display || entity.name?.indexable || 'Unknown'
                                    const linked = isLinked(entity)
                                    return (
                                        <button
                                            key={entity._id}
                                            type="button"
                                            className={`entity-picker-item ${linked ? 'linked' : ''}`}
                                            onClick={() => !linked && addEntity(entity)}
                                            disabled={linked}
                                        >
                                            <span className="entity-picker-dot" style={{ backgroundColor: entity.color }} />
                                            <span className="entity-picker-name">{name}</span>
                                            {linked && <span className="entity-picker-badge">Added</span>}
                                        </button>
                                    )
                                })
                            )}
                        </div>

                        {error && (
                            <p style={{ color: 'var(--color-error)', fontSize: '0.8rem', marginTop: '8px' }}>{error}</p>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}

export default AttributionEditor
