import React, { useState, useEffect } from 'react'
import api from '../api/client.js'

function AttributionEditor({ attribution = [], onChange, compact = false }) {
    const [entities, setEntities] = useState([])
    const [activeTab, setActiveTab] = useState('alter')
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [frontEntities, setFrontEntities] = useState([])
    const [loadingFront, setLoadingFront] = useState(false)

    useEffect(() => {
        loadEntities()
    }, [activeTab])

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
                for (const f of layer.fronters || []) {
                    all.push({ type: f.type, id: f._id, name: f.name, avatar: f.avatar, color: f.color })
                }
            }
            setFrontEntities(all)
        } catch (err) {
            setError(err.message)
        }
        setLoadingFront(false)
    }

    const addEntity = (entity) => {
        if (attributions.some(a => a.type === entity.type && a.id === entity._id || a.id === entity.id)) return
        const newEntry = { type: entity.type || activeTab, id: entity._id || entity.id, name: entity.name?.display || entity.name?.indexable || entity.name || 'Unknown', avatar: entity.avatar?.url || entity.avatar, color: entity.color }
        const updated = [...attributions, newEntry]
        onChange?.(updated)
    }

    const removeEntity = (index) => {
        const updated = attributions.filter((_, i) => i !== index)
        onChange?.(updated)
    }

    const addFromFront = async () => {
        if (!frontEntities.length) await loadFront()
        const current = frontEntities.length ? frontEntities : []
        for (const ent of current) {
            if (!attributions.some(a => a.type === ent.type && a.id === ent.id)) {
                attributions.push(ent)
            }
        }
        onChange?.([...attributions])
    }

    const filtered = entities.filter(e => {
        const name = e.name?.display || e.name?.indexable || ''
        return name.toLowerCase().includes(search.toLowerCase())
    })

    const isLinked = (entity) => {
        const eid = entity._id || entity.id
        return attributions.some(a => a.type === activeTab && a.id === eid)
    }

    return (
        <div className="attribution-editor">
            {attributions.length > 0 && (
                <div className="attribution-chips">
                    {attributions.map((ent, i) => (
                        <span key={`${ent.type}-${ent.id}-${i}`} className="attribution-chip" style={{ borderColor: ent.color || 'var(--glass-border)' }}>
                            {ent.avatar && <img src={ent.avatar} alt="" className="attribution-chip-avatar" />}
                            <span className="attribution-chip-name">{ent.name}</span>
                            <button className="attribution-chip-remove" onClick={() => removeEntity(i)}>&times;</button>
                        </span>
                    ))}
                </div>
            )}

            <div className="attribution-actions">
                <button className="btn btn-secondary btn-sm" onClick={addFromFront} disabled={loadingFront}>
                    {loadingFront ? 'Loading...' : 'From Front'}
                </button>
            </div>

            {!compact && (
                <>
                    <div className="entity-tabs">
                        {['alter', 'state', 'group'].map(tab => (
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

                    <input
                        className="text-input"
                        type="text"
                        placeholder={`Search ${activeTab}s...`}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />

                    <div className="attribution-entity-list">
                        {loading ? (
                            <div className="status-screen" style={{ padding: '16px' }}>
                                <div className="spinner" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <p className="empty-state" style={{ padding: '12px 0', color: 'var(--text-secondary)' }}>
                                {entities.length === 0 ? `No ${activeTab}s` : 'No matches'}
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
                </>
            )}

            {error && (
                <p style={{ color: 'var(--color-error)', fontSize: '0.8rem', marginTop: '8px' }}>{error}</p>
            )}
        </div>
    )
}

export default AttributionEditor
