import React, { useState, useEffect, useCallback } from 'react'
import { api, EntityFormModal, Icon } from '@chameleon/shared'

function getDisplayName(entity) {
    if (!entity) return 'Unknown'
    if (typeof entity.name === 'string') return entity.name
    return entity.name?.display || entity.name?.indexable || 'Unknown'
}

export function EntityViewPage({ system, onNavigate, entityId, entityType }) {
    const [entity, setEntity] = useState(null)
    const [isOwner, setIsOwner] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [editing, setEditing] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const fetchEntity = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const result = await api.getPublicEntity(entityType, entityId)
            setEntity(result.entity)
            setIsOwner(result.isOwner)
            setLoading(false)
        } catch (err) {
            setError(err.message)
            setLoading(false)
        }
    }, [entityType, entityId])

    useEffect(() => { fetchEntity() }, [fetchEntity])

    const handleEntityUpdated = () => {
        setEditing(false)
        fetchEntity()
    }

    const handleDelete = async () => {
        setDeleting(true)
        try {
            if (entityType === 'alter') await api.deleteAlter(entityId)
            else if (entityType === 'state') await api.deleteState(entityId)
            else if (entityType === 'group') await api.deleteGroup(entityId)
            onNavigate?.('system')
        } catch (err) {
            setError(err.message)
            setDeleting(false)
        }
    }

    const typeLabel = entityType.charAt(0).toUpperCase() + entityType.slice(1)

    if (loading) {
        return (
            <div className="entity-page">
                <div className="status-screen">
                    <div className="spinner" />
                    <p>Loading {typeLabel.toLowerCase()}...</p>
                </div>
            </div>
        )
    }

    if (error && !entity) {
        return (
            <div className="entity-page">
                <div className="empty-state">
                    <span className="empty-icon"><Icon name="alert" size={48} /></span>
                    <h3>Something went wrong</h3>
                    <p>{error}</p>
                </div>
            </div>
        )
    }

    if (!entity) {
        return (
            <div className="entity-page">
                <div className="empty-state">
                    <span className="empty-icon"><Icon name="globe" size={48} /></span>
                    <h3>Entity not found</h3>
                </div>
            </div>
        )
    }

    const color = entity.color || '#c4b5fd'
    const name = getDisplayName(entity)
    const avatar = entity.avatar?.url || entity.avatar
    const pronouns = entity.pronouns?.join?.(', ') || entity.pronouns

    if (editing) {
        return (
            <div className="entity-page">
                <EntityFormModal
                    entity={entity}
                    type={entityType}
                    typeLabel={typeLabel}
                    onClose={() => setEditing(false)}
                    onUpdated={handleEntityUpdated}
                />
            </div>
        )
    }

    if (confirmDelete) {
        return (
            <div className="entity-page">
                <div className="entity-page-header">
                    <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>← Back</button>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Delete {typeLabel}</h2>
                    <div style={{ width: '60px' }} />
                </div>
                <div className="entity-page-body" style={{ padding: '24px 16px' }}>
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
        <div className="entity-page">
            <div className="entity-page-header">
                <button className="btn-ghost" onClick={() => onNavigate?.(null)}>← Back</button>
                <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{name}</h2>
                {isOwner ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-icon" title="Edit" onClick={() => setEditing(true)}>
                            <Icon name="pencil" size={18} />
                        </button>
                        <button className="btn-icon" title="Delete" onClick={() => setConfirmDelete(true)}>
                            <Icon name="trash" size={18} />
                        </button>
                    </div>
                ) : <div style={{ width: '60px' }} />}
            </div>

            <div className="entity-page-body">
                <div className="entity-page-preview" style={{ borderTop: `4px solid ${color}` }}>
                    <div className="entity-page-preview-header">
                        {avatar ? (
                            <img src={avatar} alt="" className="entity-page-avatar" />
                        ) : (
                            <div className="entity-page-avatar entity-page-avatar--fallback" style={{ backgroundColor: color }}>
                                {name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div>
                            <h2 className="entity-page-name" style={{ color }}>{name}</h2>
                            {pronouns && <div className="entity-page-pronouns">{pronouns}</div>}
                            <div className="entity-page-type">{typeLabel}</div>
                        </div>
                    </div>
                </div>

                {entity.description && (
                    <div className="entity-page-section">
                        <label className="entity-page-label">Description</label>
                        <p>{entity.description}</p>
                    </div>
                )}

                {entity.birthday && (
                    <div className="entity-page-section">
                        <label className="entity-page-label">Birthday</label>
                        <p>{new Date(entity.birthday).toLocaleDateString()}</p>
                    </div>
                )}

                {entity.signoff && (
                    <div className="entity-page-section">
                        <label className="entity-page-label">Sign-off</label>
                        <p>{entity.signoff}</p>
                    </div>
                )}

                {entity.proxy?.length > 0 && (
                    <div className="entity-page-section">
                        <label className="entity-page-label">Proxy patterns</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {entity.proxy.map(p => (
                                <span key={p} className="tag-pill">{p}</span>
                            ))}
                        </div>
                    </div>
                )}

                {entityType === 'alter' && entity.states?.length > 0 && (
                    <div className="entity-page-section">
                        <label className="entity-page-label">States</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {entity.states.map((s, i) => (
                                <span key={i} className="tag-pill">{s.name?.display || s.name?.indexable || `State ${i + 1}`}</span>
                            ))}
                        </div>
                    </div>
                )}

                {entityType === 'alter' && entity.activeStates?.all?.length > 0 && (
                    <div className="entity-page-section">
                        <label className="entity-page-label">Active States</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {entity.activeStates.all.map((stateId) => {
                                const state = entity.states?.find(s => s.connected_id === stateId)
                                const stateName = state?.name?.display || state?.name?.indexable || 'Unknown'
                                const isPriority = stateId === entity.activeStates.priority
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

                {entityType === 'alter' && entity.groups?.length > 0 && (
                    <div className="entity-page-section">
                        <label className="entity-page-label">Groups</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {entity.groups.map(g => (
                                <span key={g._id} className="tag-pill" style={{ borderLeft: `3px solid ${g.color || '#c4b5fd'}` }}>
                                    {g.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {entityType === 'group' && entity.members && (
                    <div className="entity-page-section">
                        <label className="entity-page-label">Members</label>
                        {entity.members.alters?.length > 0 && (
                            <div style={{ marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Alters: </span>
                                {entity.members.alters.map(a => a.name).join(', ')}
                            </div>
                        )}
                        {entity.members.states?.length > 0 && (
                            <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>States: </span>
                                {entity.members.states.map(s => s.name).join(', ')}
                            </div>
                        )}
                    </div>
                )}

                {entityType === 'group' && entity.type && (
                    <div className="entity-page-section">
                        <label className="entity-page-label">Type</label>
                        <p>{entity.type.name || 'General'}{entity.type.canFront === 'no' ? ' (cannot front)' : ''}</p>
                    </div>
                )}

                {entity.caution && (entity.caution.c_type || entity.caution.detail) && (
                    <div className="entity-page-section">
                        <label className="entity-page-label">Caution</label>
                        <p>
                            {entity.caution.c_type && <><strong>Type:</strong> {entity.caution.c_type}<br /></>}
                            {entity.caution.detail && <><strong>Details:</strong> {entity.caution.detail}</>}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default EntityViewPage
