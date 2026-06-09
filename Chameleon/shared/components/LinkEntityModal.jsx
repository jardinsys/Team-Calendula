import React, { useState, useEffect } from 'react'
import api from '../api/client.js'

function LinkEntityModal({ note, onClose, onLinked }) {
    const [entities, setEntities] = useState([])
    const [loading, setLoading] = useState(true)
    const [linking, setLinking] = useState(false)
    const [error, setError] = useState(null)
    const [search, setSearch] = useState('')
    const [activeTab, setActiveTab] = useState('alter')

    useEffect(() => {
        loadEntities()
    }, [activeTab])

    const loadEntities = async () => {
        setLoading(true)
        setError(null)
        try {
            let data
            if (activeTab === 'alter') {
                data = await api.getAlters()
            } else if (activeTab === 'state') {
                data = await api.getStates()
            } else {
                data = await api.getGroups()
            }
            setEntities(data || [])
        } catch (err) {
            setError(err.message)
        }
        setLoading(false)
    }

    const handleLink = async (entityId) => {
        setLinking(true)
        setError(null)
        try {
            await api.linkEntityToNote(note._id, { type: activeTab, entityId })
            onLinked?.()
        } catch (err) {
            setError(err.message)
        }
        setLinking(false)
    }

    const handleUnlink = async (entityId) => {
        try {
            await api.unlinkEntityFromNote(note._id, { type: activeTab, entityId })
            onLinked?.()
        } catch (err) {
            setError(err.message)
        }
    }

    const linked = note.author?.[`${activeTab}s`] || note.linkedEntities?.[`${activeTab}s`] || []

    const filtered = entities.filter(e => {
        const name = e.name?.display || e.name?.indexable || ''
        return name.toLowerCase().includes(search.toLowerCase())
    })

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <button className="btn-ghost" onClick={onClose}>← Back</button>
                    <h2 className="modal-title">Link Entity</h2>
                    <div style={{ width: '60px' }} />
                </div>

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
                    autoFocus
                />

                <div className="linked-entities-list">
                    {linked.length > 0 && (
                        <div className="form-group">
                            <label>Linked</label>
                            {linked.map(entity => (
                                <div key={entity._id} className="linked-entity-row">
                                    <span
                                        className="linked-entity-dot"
                                        style={{ backgroundColor: entity.color }}
                                    />
                                    <span className="linked-entity-name">{entity.name}</span>
                                    <button
                                        className="btn btn-ghost btn-sm btn-danger-text"
                                        onClick={() => handleUnlink(entity._id)}
                                    >
                                        Unlink
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {loading ? (
                        <div className="status-screen" style={{ padding: '24px' }}>
                            <div className="spinner" />
                            <p>Loading...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="empty-state" style={{ padding: '24px 0' }}>
                            <p>{entities.length === 0 ? `No ${activeTab}s to link` : 'No matches'}</p>
                        </div>
                    ) : (
                        <div className="entity-picker-list">
                            {filtered.map(entity => {
                                const name = entity.name?.display || entity.name?.indexable || 'Unknown'
                                const isLinked = linked.some(l => l._id === entity._id)
                                return (
                                    <button
                                        key={entity._id}
                                        type="button"
                                        className={`entity-picker-item ${isLinked ? 'linked' : ''}`}
                                        onClick={() => !isLinked && handleLink(entity._id)}
                                        disabled={isLinked || linking}
                                    >
                                        <span className="entity-picker-dot" style={{ backgroundColor: entity.color }} />
                                        <span className="entity-picker-name">{name}</span>
                                        {isLinked && <span className="entity-picker-badge">Linked</span>}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                {error && (
                    <p style={{ color: 'var(--color-error)', fontSize: '0.8rem', marginTop: '8px' }}>{error}</p>
                )}
            </div>
        </div>
    )
}

export { LinkEntityModal }
export default LinkEntityModal