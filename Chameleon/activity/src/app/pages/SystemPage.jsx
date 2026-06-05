import React, { useState, useEffect, useCallback } from 'react'
import { useDiscordSdk } from '../../hooks/useDiscordSdk'
import { api, EntityCardList, EntityDetailModal, EntityFormModal, FrontDisplay } from '@chameleon/shared'

function getDisplayName(entity) {
    if (!entity) return 'Unknown'
    if (typeof entity.name === 'string') return entity.name
    return entity.name?.display || entity.name?.indexable || 'Unknown'
}

export function SystemPage() {
    const { session } = useDiscordSdk()
    const [subPage, setSubPage] = useState(null)
    const [system, setSystem] = useState(null)
    const [frontData, setFrontData] = useState(null)
    const [alters, setAlters] = useState([])
    const [states, setStates] = useState([])
    const [groups, setGroups] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const [selectedEntity, setSelectedEntity] = useState(null)
    const [selectedEntityType, setSelectedEntityType] = useState(null)
    const [showCreateEntity, setShowCreateEntity] = useState(null) // 'alter' | 'state' | 'group'
    const [editingEntity, setEditingEntity] = useState(null)
    const [editingEntityType, setEditingEntityType] = useState(null)

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true)
            const [sysData, frontResult, altersData, statesData, groupsData] = await Promise.all([
                api.getSystemFull(),
                api.getFront().catch(() => null),
                api.getAlters().catch(() => []),
                api.getStates().catch(() => []),
                api.getGroups().catch(() => [])
            ])
            setSystem(sysData)
            setFrontData(frontResult)
            setAlters(altersData)
            setStates(statesData)
            setGroups(groupsData)
            setLoading(false)
        } catch (err) {
            setError(err.message)
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    const handleEntityCreated = () => { fetchAll(); setShowCreateEntity(null) }
    const handleEntityUpdated = () => { fetchAll(); setEditingEntity(null); setSelectedEntity(null) }
    const handleEntityDeleted = () => { fetchAll(); setSelectedEntity(null) }

    const handleEntityClick = (entity, type) => {
        setSelectedEntity(entity)
        setSelectedEntityType(type)
    }

    const handleEditEntity = (entity, type) => {
        setSelectedEntity(null)
        setEditingEntity(entity)
        setEditingEntityType(type)
    }

    if (loading && !system) {
        return (
            <div className="status-screen">
                <div className="spinner" />
                <p>Loading system...</p>
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
                <h3>No system found</h3>
                <p>Create a system to get started</p>
            </div>
        )
    }

    const systemName = getDisplayName(system)
    const avatar = system.avatar?.url
    const counts = system.counts || { alters: alters.length, states: states.length, groups: groups.length }

    if (subPage === 'alters') {
        return (
            <div>
                <button className="btn-ghost" onClick={() => setSubPage(null)} style={{ fontSize: '0.75rem', marginBottom: '12px' }}>
                    ← Back
                </button>
                <div className="section-header">
                    <div>
                        <h2 className="section-title">Alters</h2>
                        <span className="section-count">{alters.length} alter{alters.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>
                <EntityCardList
                    entities={alters}
                    type="alter"
                    onEntityClick={(e) => handleEntityClick(e, 'alter')}
                />
                <button className="fab" onClick={() => setShowCreateEntity('alter')}>+</button>
                {selectedEntity && selectedEntityType === 'alter' && (
                    <EntityDetailModal
                        entity={selectedEntity}
                        type="alter"
                        onClose={() => setSelectedEntity(null)}
                        onUpdated={handleEditEntity}
                        onDeleted={handleEntityDeleted}
                    />
                )}
                {showCreateEntity === 'alter' && (
                    <EntityFormModal
                        type="alter"
                        onClose={() => setShowCreateEntity(null)}
                        onCreated={handleEntityCreated}
                    />
                )}
                {editingEntity && editingEntityType === 'alter' && (
                    <EntityFormModal
                        entity={editingEntity}
                        type="alter"
                        onClose={() => setEditingEntity(null)}
                        onUpdated={handleEntityUpdated}
                    />
                )}
            </div>
        )
    }

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
                    onEntityClick={(e) => handleEntityClick(e, 'state')}
                />
                <button className="fab" onClick={() => setShowCreateEntity('state')}>+</button>
                {selectedEntity && selectedEntityType === 'state' && (
                    <EntityDetailModal
                        entity={selectedEntity}
                        type="state"
                        onClose={() => setSelectedEntity(null)}
                        onUpdated={handleEditEntity}
                        onDeleted={handleEntityDeleted}
                    />
                )}
                {showCreateEntity === 'state' && (
                    <EntityFormModal
                        type="state"
                        onClose={() => setShowCreateEntity(null)}
                        onCreated={handleEntityCreated}
                    />
                )}
                {editingEntity && editingEntityType === 'state' && (
                    <EntityFormModal
                        entity={editingEntity}
                        type="state"
                        onClose={() => setEditingEntity(null)}
                        onUpdated={handleEntityUpdated}
                    />
                )}
            </div>
        )
    }

    if (subPage === 'groups') {
        return (
            <div>
                <button className="btn-ghost" onClick={() => setSubPage(null)} style={{ fontSize: '0.75rem', marginBottom: '12px' }}>
                    ← Back
                </button>
                <div className="section-header">
                    <div>
                        <h2 className="section-title">Groups</h2>
                        <span className="section-count">{groups.length} group{groups.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>
                <EntityCardList
                    entities={groups}
                    type="group"
                    onEntityClick={(e) => handleEntityClick(e, 'group')}
                />
                <button className="fab" onClick={() => setShowCreateEntity('group')}>+</button>
                {selectedEntity && selectedEntityType === 'group' && (
                    <EntityDetailModal
                        entity={selectedEntity}
                        type="group"
                        onClose={() => setSelectedEntity(null)}
                        onUpdated={handleEditEntity}
                        onDeleted={handleEntityDeleted}
                    />
                )}
                {showCreateEntity === 'group' && (
                    <EntityFormModal
                        type="group"
                        onClose={() => setShowCreateEntity(null)}
                        onCreated={handleEntityCreated}
                    />
                )}
                {editingEntity && editingEntityType === 'group' && (
                    <EntityFormModal
                        entity={editingEntity}
                        type="group"
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

    if (subPage === 'edit') {
        return (
            <div>
                <button className="btn-ghost" onClick={() => setSubPage(null)} style={{ fontSize: '0.75rem', marginBottom: '12px' }}>
                    ← Back
                </button>
                <EditSystemSubPage system={system} onSaved={() => { fetchAll(); setSubPage(null) }} />
            </div>
        )
    }

    return (
        <div>
            <header className="page-header">
                <h1>System</h1>
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
                <button className="subpage-btn" onClick={() => setSubPage('alters')}>
                    <span className="subpage-btn-icon">👤</span>
                    <div className="subpage-btn-info">
                        <div className="subpage-btn-label">Alters</div>
                        <div className="subpage-btn-count">{counts.alters} alter{counts.alters !== 1 ? 's' : ''}</div>
                    </div>
                    <span className="subpage-btn-arrow">›</span>
                </button>
                <button className="subpage-btn" onClick={() => setSubPage('states')}>
                    <span className="subpage-btn-icon">🌊</span>
                    <div className="subpage-btn-info">
                        <div className="subpage-btn-label">States</div>
                        <div className="subpage-btn-count">{counts.states} state{counts.states !== 1 ? 's' : ''}</div>
                    </div>
                    <span className="subpage-btn-arrow">›</span>
                </button>
                <button className="subpage-btn" onClick={() => setSubPage('groups')}>
                    <span className="subpage-btn-icon">📦</span>
                    <div className="subpage-btn-info">
                        <div className="subpage-btn-label">Groups</div>
                        <div className="subpage-btn-count">{counts.groups} group{counts.groups !== 1 ? 's' : ''}</div>
                    </div>
                    <span className="subpage-btn-arrow">›</span>
                </button>
                <button className="subpage-btn" onClick={() => setSubPage('edit')}>
                    <span className="subpage-btn-icon">⚙️</span>
                    <div className="subpage-btn-info">
                        <div className="subpage-btn-label">Edit System</div>
                        <div className="subpage-btn-count">Name, description, settings</div>
                    </div>
                    <span className="subpage-btn-arrow">›</span>
                </button>
            </div>
        </div>
    )
}

function EditSystemSubPage({ system, onSaved }) {
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
            <h2 className="section-title" style={{ marginBottom: '16px' }}>Edit System</h2>
            <form onSubmit={handleSave}>
                <div className="form-group">
                    <label>System name</label>
                    <input
                        className="text-input"
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Your system name"
                        maxLength={100}
                    />
                </div>
                <div className="form-group">
                    <label>Description</label>
                    <textarea
                        className="text-input"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="About your system..."
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

export default SystemPage
