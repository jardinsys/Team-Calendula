import React, { useState, useEffect, useCallback } from 'react'
import { useDiscordSdk } from '../../hooks/useDiscordSdk'
import { api, EntityCardList, EntityDetailModal, EntityFormModal, FrontDisplay, NoteCardGrid, NoteModal } from '@chameleon/shared'

function getDisplayName(entity, fallbackName) {
    if (!entity) return fallbackName || 'Unknown'
    if (typeof entity.name === 'string') return entity.name
    return entity.name?.display || entity.name?.indexable || fallbackName || 'Unknown'
}

export function ProfilePage({ system: systemProp }) {
    const { session } = useDiscordSdk()
    const [subPage, setSubPage] = useState(null)
    const [system, setSystem] = useState(systemProp)
    const [frontData, setFrontData] = useState(null)
    const [states, setStates] = useState([])
    const [notes, setNotes] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const [selectedEntity, setSelectedEntity] = useState(null)
    const [showCreateEntity, setShowCreateEntity] = useState(false)
    const [editingEntity, setEditingEntity] = useState(null)

    const [selectedNote, setSelectedNote] = useState(null)

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true)
            const [sysData, frontResult, statesData, notesData] = await Promise.all([
                systemProp ? Promise.resolve(systemProp) : api.getSystemFull(),
                api.getFront().catch(() => null),
                api.getStates().catch(() => []),
                api.getNotes('all', null, 0, 6).catch(() => ({ notes: [] }))
            ])
            setSystem(sysData)
            setFrontData(frontResult)
            setStates(statesData)
            setNotes(notesData.notes || [])
            setLoading(false)
        } catch (err) {
            setError(err.message)
            setLoading(false)
        }
    }, [systemProp])

    useEffect(() => { fetchAll() }, [fetchAll])

    const handleEntityCreated = () => { fetchAll(); setShowCreateEntity(null) }
    const handleEntityUpdated = () => { fetchAll(); setEditingEntity(null); setSelectedEntity(null) }
    const handleEntityDeleted = () => { fetchAll(); setSelectedEntity(null) }

    const handleEntityClick = (entity) => {
        setSelectedEntity(entity)
    }

    const handleEditEntity = (entity) => {
        setSelectedEntity(null)
        setEditingEntity(entity)
    }

    if (loading && !system) {
        return (
            <div className="status-screen">
                <div className="spinner" />
                <p>Loading...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="empty-state">
                <span className="empty-icon">⚠️</span>
                <h3>Something went wrong</h3>
                <p>{error}</p>
            </div>
        )
    }

    if (!system) {
        return (
            <div className="empty-state">
                <span className="empty-icon">🌐</span>
                <h3>No profile found</h3>
                <p>Create a profile to get started</p>
            </div>
        )
    }

    const systemName = getDisplayName(system, session?.global_name || session?.username)
    const avatar = system.avatar?.url
    const fallbackName = session?.global_name || session?.username

    if (subPage === 'states') {
        return (
            <div>
                <button className="btn-ghost" onClick={() => setSubPage(null)} style={{ fontSize: '0.75rem', marginBottom: '12px' }}>
                    ← Back
                </button>
                <div className="section-header">
                    <div>
                        <h2 className="section-title">States</h2>
                        <span className="section-count">{states.length} state{states.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>
                <EntityCardList
                    entities={states}
                    type="state"
                    typeLabel="State"
                    onEntityClick={handleEntityClick}
                    fallbackName={fallbackName}
                />
                <button className="fab" onClick={() => setShowCreateEntity(true)}>+</button>
                {selectedEntity && (
                    <EntityDetailModal
                        entity={selectedEntity}
                        type="state"
                        typeLabel="State"
                        onClose={() => setSelectedEntity(null)}
                        onUpdated={handleEditEntity}
                        onDeleted={handleEntityDeleted}
                        fallbackName={fallbackName}
                    />
                )}
                {showCreateEntity && (
                    <EntityFormModal
                        type="state"
                        typeLabel="State"
                        onClose={() => setShowCreateEntity(false)}
                        onCreated={handleEntityCreated}
                    />
                )}
                {editingEntity && (
                    <EntityFormModal
                        entity={editingEntity}
                        type="state"
                        typeLabel="State"
                        onClose={() => setEditingEntity(null)}
                        onUpdated={handleEntityUpdated}
                    />
                )}
            </div>
        )
    }

    if (subPage === 'front') {
        return (
            <div>
                <button className="btn-ghost" onClick={() => setSubPage(null)} style={{ fontSize: '0.75rem', marginBottom: '12px' }}>
                    ← Back
                </button>
                <h2 className="section-title" style={{ marginBottom: '16px' }}>Current Front</h2>
                <FrontDisplay frontData={frontData} isOwner={true} />
            </div>
        )
    }

    if (subPage === 'notes') {
        return (
            <div>
                <button className="btn-ghost" onClick={() => setSubPage(null)} style={{ fontSize: '0.75rem', marginBottom: '12px' }}>
                    ← Back
                </button>
                <h2 className="section-title" style={{ marginBottom: '16px' }}>Notes</h2>
                <NoteCardGrid notes={notes} onNoteClick={setSelectedNote} />
                {selectedNote && (
                    <NoteModal
                        note={selectedNote}
                        onClose={() => setSelectedNote(null)}
                        onUpdated={() => fetchAll()}
                        onDeleted={() => { fetchAll(); setSelectedNote(null) }}
                    />
                )}
            </div>
        )
    }

    if (subPage === 'edit') {
        return (
            <div>
                <button className="btn-ghost" onClick={() => setSubPage(null)} style={{ fontSize: '0.75rem', marginBottom: '12px' }}>
                    ← Back
                </button>
                <EditProfileSubPage system={system} onSaved={() => { fetchAll(); setSubPage(null) }} />
            </div>
        )
    }

    return (
        <div>
            <header className="page-header">
                <h1>You</h1>
            </header>

            <div className="system-overview">
                <div className="system-overview-avatar">
                    {avatar ? (
                        <img src={avatar} alt="" />
                    ) : (
                        <div className="system-overview-avatar-fallback">
                            {systemName.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
                <div className="system-overview-info">
                    <div className="system-overview-name">{systemName}</div>
                    {system.description && (
                        <div className="system-overview-desc">{system.description}</div>
                    )}
                </div>
            </div>

            <FrontDisplay frontData={frontData} compact={true} isOwner={true} />

            <div className="subpage-nav">
                <button className="subpage-btn" onClick={() => setSubPage('front')}>
                    <span className="subpage-btn-icon">🌙</span>
                    <div className="subpage-btn-info">
                        <div className="subpage-btn-label">Current Front</div>
                        <div className="subpage-btn-count">
                            {frontData?.layers?.flatMap(l => l.fronters || []).length || 0} fronting
                        </div>
                    </div>
                    <span className="subpage-btn-arrow">›</span>
                </button>
                <button className="subpage-btn" onClick={() => setSubPage('states')}>
                    <span className="subpage-btn-icon">🌊</span>
                    <div className="subpage-btn-info">
                        <div className="subpage-btn-label">States</div>
                        <div className="subpage-btn-count">{states.length} state{states.length !== 1 ? 's' : ''}</div>
                    </div>
                    <span className="subpage-btn-arrow">›</span>
                </button>
                <button className="subpage-btn" onClick={() => setSubPage('notes')}>
                    <span className="subpage-btn-icon">📝</span>
                    <div className="subpage-btn-info">
                        <div className="subpage-btn-label">Notes</div>
                        <div className="subpage-btn-count">{notes.length} note{notes.length !== 1 ? 's' : ''}</div>
                    </div>
                    <span className="subpage-btn-arrow">›</span>
                </button>
                <button className="subpage-btn" onClick={() => setSubPage('edit')}>
                    <span className="subpage-btn-icon">⚙️</span>
                    <div className="subpage-btn-info">
                        <div className="subpage-btn-label">Edit Profile</div>
                        <div className="subpage-btn-count">Name, description, settings</div>
                    </div>
                    <span className="subpage-btn-arrow">›</span>
                </button>
            </div>
        </div>
    )
}

function EditProfileSubPage({ system, onSaved }) {
    const [name, setName] = useState(system?.name?.display || '')
    const [description, setDescription] = useState(system?.description || '')
    const [color, setColor] = useState(system?.color || '#c4b5fd')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const COLORS = [
        '#c4b5fd', '#fda4af', '#fdba74', '#fde047',
        '#86efac', '#7dd3fc', '#d8b4fe', '#f9a8d4', '#94a3b8'
    ]

    const handleSave = async (e) => {
        e.preventDefault()
        setSaving(true)
        setError(null)
        try {
            await api.updateSystem({
                name: name.trim() || undefined,
                description: description.trim() || undefined,
                color: color !== COLORS[0] ? color : undefined
            })
            onSaved?.()
        } catch (err) {
            setError(err.message)
            setSaving(false)
        }
    }

    return (
        <div>
            <h2 className="section-title" style={{ marginBottom: '16px' }}>Edit Profile</h2>
            <form onSubmit={handleSave}>
                <div className="form-group">
                    <label>Profile name</label>
                    <input
                        className="text-input"
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Your profile name"
                        maxLength={100}
                    />
                </div>
                <div className="form-group">
                    <label>Description</label>
                    <textarea
                        className="text-input"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="About your profile..."
                        rows={4}
                    />
                </div>
                <div className="form-group">
                    <label>Color</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {COLORS.map(c => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setColor(c)}
                                style={{
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    backgroundColor: c,
                                    border: color === c ? '2px solid white' : '2px solid transparent',
                                    cursor: 'pointer',
                                    boxShadow: color === c ? `0 0 8px ${c}40` : 'none'
                                }}
                            />
                        ))}
                    </div>
                </div>
                {error && (
                    <p style={{ color: 'var(--color-error)', fontSize: '0.8rem', marginBottom: '12px' }}>{error}</p>
                )}
                <div className="modal-actions" style={{ borderTop: 'none', paddingTop: 0 }}>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    )
}

export default ProfilePage
