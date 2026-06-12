import React, { useState, useEffect } from 'react'
import api from '../api/client.js'
import { Icon } from '../icons.jsx'

function getDisplayName(entity, fallbackName) {
    if (!entity) return fallbackName || 'Unknown'
    if (typeof entity.name === 'string') return entity.name
    return entity.name?.display || entity.name?.indexable || fallbackName || 'Unknown'
}

function EntityDetailModal({ entity, type = 'alter', typeLabel, onClose, onUpdated, onDeleted, fallbackName }) {
    const [fullEntity, setFullEntity] = useState(entity)
    const [loading, setLoading] = useState(!entity?.description && !entity?.pronouns)
    const [error, setError] = useState(null)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        let cancelled = false
        async function fetchDetail() {
            try {
                let data
                if (type === 'alter') {
                    data = await api.getAlter(entity._id, true)
                } else if (type === 'group') {
                    data = await api.getGroup(entity._id, true)
                } else {
                    data = await api.getState(entity._id)
                }
                if (!cancelled) {
                    setFullEntity(data)
                    setLoading(false)
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err.message)
                    setLoading(false)
                }
            }
        }
        fetchDetail()
        return () => { cancelled = true }
    }, [entity?._id, type])

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose?.()
    }

    const handleDelete = async () => {
        setDeleting(true)
        try {
            if (type === 'alter') await api.deleteAlter(entity._id)
            else if (type === 'state') await api.deleteState(entity._id)
            else if (type === 'group') await api.deleteGroup(entity._id)
            onDeleted?.()
            onClose?.()
        } catch (err) {
            setError(err.message)
            setDeleting(false)
        }
    }

    if (loading) {
        return (
            <div className="modal-overlay" onClick={handleBackdropClick}>
                <div className="modal-content">
                    <div className="status-screen" style={{ minHeight: '200px' }}>
                        <div className="spinner" />
                    </div>
                </div>
            </div>
        )
    }

    if (error && !fullEntity) {
        return (
            <div className="modal-overlay" onClick={handleBackdropClick}>
                <div className="modal-content">
                    <div className="modal-header">
                        <button className="btn-ghost" onClick={onClose}>← Back</button>
                    </div>
                    <p style={{ color: 'var(--color-error)' }}>{error}</p>
                </div>
            </div>
        )
    }

    const e = fullEntity || entity
    const color = e.color || '#c4b5fd'
    const name = getDisplayName(e, fallbackName)
    const avatar = e.avatar?.url || e.avatar
    const pronouns = e.pronouns?.join?.(', ') || e.pronouns
    const label = typeLabel || type

    if (confirmDelete) {
        return (
            <div className="modal-overlay" onClick={handleBackdropClick}>
                <div className="modal-content">
                    <div className="modal-header">
                        <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>← Back</button>
                        <h2 className="modal-title">Delete {label}</h2>
                        <div style={{ width: '60px' }} />
                    </div>
                    <p style={{ marginBottom: '24px' }}>
                        Are you sure you want to delete <strong>{name}</strong>? This cannot be undone.
                    </p>
                    {error && <p style={{ color: 'var(--color-error)', fontSize: '0.8rem', marginBottom: '12px' }}>{error}</p>}
                    <div className="modal-actions">
                        <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
                        <button className="btn btn-primary" style={{ backgroundColor: 'var(--color-error)' }} onClick={handleDelete} disabled={deleting}>
                            {deleting ? 'Deleting...' : 'Delete'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="modal-overlay" onClick={handleBackdropClick}>
            <div className="modal-content" style={{ borderTop: `4px solid ${color}` }}>
                <div className="modal-header">
                    <button className="btn-ghost" onClick={onClose}>← Back</button>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {onUpdated && (
                            <button className="btn-icon" title="Edit" onClick={() => onUpdated(e, type)}><Icon name="pencil" size={18} /></button>
                        )}
                        {onDeleted && (
                            <button className="btn-icon" title="Delete" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={18} /></button>
                        )}
                    </div>
                </div>

                <div className="entity-detail-header">
                    {avatar ? (
                        <img src={avatar} alt="" className="entity-detail-avatar" />
                    ) : (
                        <div className="entity-detail-avatar entity-detail-avatar--fallback" style={{ backgroundColor: color }}>
                            {name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <h2 className="modal-title" style={{ color }}>{name}</h2>
                        {pronouns && <div className="entity-detail-pronouns">{pronouns}</div>}
                        <div className="entity-detail-type" style={{ textTransform: 'capitalize' }}>{label}</div>
                    </div>
                </div>

                <div className="entity-detail-body">
                    {e.description && (
                        <div className="entity-detail-section">
                            <label className="entity-detail-label">Description</label>
                            <p>{e.description}</p>
                        </div>
                    )}

                    {e.birthday && (
                        <div className="entity-detail-section">
                            <label className="entity-detail-label">Birthday</label>
                            <p>{new Date(e.birthday).toLocaleDateString()}</p>
                        </div>
                    )}

                    {e.signoff && (
                        <div className="entity-detail-section">
                            <label className="entity-detail-label">Sign-off</label>
                            <p>{e.signoff}</p>
                        </div>
                    )}

                    {e.proxy?.length > 0 && (
                        <div className="entity-detail-section">
                            <label className="entity-detail-label">Proxy patterns</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {e.proxy.map(p => (
                                    <span key={p} className="tag-pill">{p}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {type === 'alter' && e.states?.length > 0 && (
                        <div className="entity-detail-section">
                            <label className="entity-detail-label">States</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {e.states.map((s, i) => (
                                    <span key={i} className="tag-pill">{s.name?.display || s.name?.indexable || `State ${i + 1}`}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {type === 'alter' && e.activeStates?.all?.length > 0 && (
                        <div className="entity-detail-section">
                            <label className="entity-detail-label">Active States</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {e.activeStates.all.map((stateId) => {
                                    const state = e.states?.find(s => s.connected_id === stateId)
                                    const stateName = state?.name?.display || state?.name?.indexable || 'Unknown'
                                    const isPriority = stateId === e.activeStates.priority
                                    return (
                                        <span
                                            key={stateId}
                                            className="tag-pill"
                                            style={isPriority ? { backgroundColor: 'var(--accent-subtle)', border: '1px solid var(--accent)' } : {}}
                                        >
                                            {isPriority && <><Icon name="star" size={12} /> </>}{stateName}
                                        </span>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {type === 'alter' && e.groups?.length > 0 && (
                        <div className="entity-detail-section">
                            <label className="entity-detail-label">Groups</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {e.groups.map(g => (
                                    <span key={g._id} className="tag-pill" style={{ borderLeft: `3px solid ${g.color || '#c4b5fd'}` }}>
                                        {g.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {type === 'group' && e.members && (
                        <div className="entity-detail-section">
                            <label className="entity-detail-label">Members</label>
                            {e.members.alters?.length > 0 && (
                                <div style={{ marginBottom: '8px' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Alters: </span>
                                    {e.members.alters.map(a => a.name).join(', ')}
                                </div>
                            )}
                            {e.members.states?.length > 0 && (
                                <div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>States: </span>
                                    {e.members.states.map(s => s.name).join(', ')}
                                </div>
                            )}
                        </div>
                    )}

                    {type === 'group' && e.type && (
                        <div className="entity-detail-section">
                            <label className="entity-detail-label">Type</label>
                            <p>{e.type.name || 'General'}{e.type.canFront === 'no' ? ' (cannot front)' : ''}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default EntityDetailModal
