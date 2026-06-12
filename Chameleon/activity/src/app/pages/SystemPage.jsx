import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useDiscordSdk } from '../../hooks/useDiscordSdk'
import { api, EntityCardList, EntityFormModal, FrontDisplay, Icon, getSystemTerm, getAlterTerm, getStateTerm, getGroupTerm, isFragmentedUser, isDissociativeUser } from '@chameleon/shared'

function getDisplayName(entity, fallbackName) {
    if (!entity) return fallbackName || 'Unknown'
    if (typeof entity.name === 'string') return entity.name
    return entity.name?.display || entity.name?.indexable || fallbackName || 'Unknown'
}

export function SystemPage({ system: systemProp, onNavigate }) {
    const { session } = useDiscordSdk()
    const [subPage, setSubPage] = useState(null)
    const [system, setSystem] = useState(systemProp)
    const [frontData, setFrontData] = useState(null)
    const [alters, setAlters] = useState([])
    const [states, setStates] = useState([])
    const [groups, setGroups] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const [showCreateEntity, setShowCreateEntity] = useState(null)

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true)
            const sysData = systemProp ? await Promise.resolve(systemProp) : await api.getSystemFull()
            const isStatesEnabled = isFragmentedUser(sysData) || isDissociativeUser(sysData)
            const [frontResult, altersData, statesData, groupsData] = await Promise.all([
                api.getFront().catch(() => null),
                api.getAlters().catch(() => []),
                isStatesEnabled ? api.getStates().catch(() => []) : Promise.resolve([]),
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
    }, [systemProp])

    useEffect(() => { fetchAll() }, [fetchAll])

    const handleEntityCreated = () => { fetchAll(); setShowCreateEntity(null) }

    const handleEntityClick = (entity, type) => {
        onNavigate('entity', { entityType: type, entityId: entity._id })
    }

    const alterLabel = useMemo(() => getAlterTerm(system, { plural: false }), [system])
    const alterLabelPlural = useMemo(() => getAlterTerm(system, { plural: true }), [system])
    const stateLabel = useMemo(() => getStateTerm(system, { plural: false }), [system])
    const stateLabelPlural = useMemo(() => getStateTerm(system, { plural: true }), [system])
    const groupLabel = useMemo(() => getGroupTerm(system, { plural: false }), [system])
    const groupLabelPlural = useMemo(() => getGroupTerm(system, { plural: true }), [system])
    const systemLabel = useMemo(() => getSystemTerm(system, { context: 'activity' }), [system])

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
                <span className="empty-icon"><Icon name="alert" size={48} /></span>
                <h3>Something went wrong</h3>
                <p>{error}</p>
            </div>
        )
    }

    if (!system) {
        return (
            <div className="empty-state">
                <span className="empty-icon"><Icon name="globe" size={48} /></span>
                <h3>No system found</h3>
                <p>Create a system to get started</p>
            </div>
        )
    }

    const systemName = getDisplayName(system, session?.global_name || session?.username)
    const avatar = system.avatar?.url
    const counts = system.counts || { alters: alters.length, states: states.length, groups: groups.length }
    const fallbackName = session?.global_name || session?.username

    if (subPage === 'alters') {
        return (
            <div>
                <button className="btn-ghost" onClick={() => setSubPage(null)} style={{ fontSize: '0.75rem', marginBottom: '12px' }}>
                    ← Back
                </button>
                <div className="section-header">
                    <div>
                        <h2 className="section-title">{alterLabelPlural.charAt(0).toUpperCase() + alterLabelPlural.slice(1)}</h2>
                        <span className="section-count">{alters.length} {alterLabel}{alters.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>
                <EntityCardList
                    entities={alters}
                    type="alter"
                    typeLabel={alterLabel}
                    onEntityClick={(e) => handleEntityClick(e, 'alter')}
                    fallbackName={fallbackName}
                />
                <button className="fab" onClick={() => setShowCreateEntity('alter')}>+</button>
                {showCreateEntity === 'alter' && (
                    <EntityFormModal
                        type="alter"
                        typeLabel={alterLabel}
                        onClose={() => setShowCreateEntity(null)}
                        onCreated={handleEntityCreated}
                    />
                )}
            </div>
        )
    }

    if (subPage === 'states') {
        if (!isFragmentedUser(system) && !isDissociativeUser(system)) {
            setSubPage(null)
            return null
        }
        return (
            <div>
                <button className="btn-ghost" onClick={() => setSubPage(null)} style={{ fontSize: '0.75rem', marginBottom: '12px' }}>
                    ← Back
                </button>
                <div className="section-header">
                    <div>
                        <h2 className="section-title">{stateLabelPlural.charAt(0).toUpperCase() + stateLabelPlural.slice(1)}</h2>
                        <span className="section-count">{states.length} {stateLabel}{states.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>
                <EntityCardList
                    entities={states}
                    type="state"
                    typeLabel={stateLabel}
                    onEntityClick={(e) => handleEntityClick(e, 'state')}
                    fallbackName={fallbackName}
                />
                <button className="fab" onClick={() => setShowCreateEntity('state')}>+</button>
                {showCreateEntity === 'state' && (
                    <EntityFormModal
                        type="state"
                        typeLabel={stateLabel}
                        onClose={() => setShowCreateEntity(null)}
                        onCreated={handleEntityCreated}
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
                        <h2 className="section-title">{groupLabelPlural.charAt(0).toUpperCase() + groupLabelPlural.slice(1)}</h2>
                        <span className="section-count">{groups.length} {groupLabel}{groups.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>
                <EntityCardList
                    entities={groups}
                    type="group"
                    typeLabel={groupLabel}
                    onEntityClick={(e) => handleEntityClick(e, 'group')}
                    fallbackName={fallbackName}
                />
                <button className="fab" onClick={() => setShowCreateEntity('group')}>+</button>
                {showCreateEntity === 'group' && (
                    <EntityFormModal
                        type="group"
                        typeLabel={groupLabel}
                        onClose={() => setShowCreateEntity(null)}
                        onCreated={handleEntityCreated}
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
                {onNavigate && (
                    <button
                        className="btn btn-primary"
                        onClick={() => onNavigate('switch')}
                        style={{ marginTop: '16px', width: '100%' }}
                    >
                        Open Switch
                    </button>
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
                <EditSystemSubPage system={system} onSaved={() => { fetchAll(); setSubPage(null) }} />
            </div>
        )
    }

    return (
        <div>
            <header className="page-header">
                <h1>{systemLabel}</h1>
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
                    <span className="subpage-btn-icon"><Icon name="moon" size={24} /></span>
                    <div className="subpage-btn-info">
                        <div className="subpage-btn-label">Current Front</div>
                        <div className="subpage-btn-count">
                            {frontData?.layers?.flatMap(l => l.fronters || []).length || 0} fronting
                        </div>
                    </div>
                    <span className="subpage-btn-arrow">›</span>
                </button>
                <button className="subpage-btn" onClick={() => setSubPage('alters')}>
                    <span className="subpage-btn-icon"><Icon name="user" size={24} /></span>
                    <div className="subpage-btn-info">
                        <div className="subpage-btn-label">{alterLabelPlural.charAt(0).toUpperCase() + alterLabelPlural.slice(1)}</div>
                        <div className="subpage-btn-count">{counts.alters} {alterLabel}{counts.alters !== 1 ? 's' : ''}</div>
                    </div>
                    <span className="subpage-btn-arrow">›</span>
                </button>
                {(isFragmentedUser(system) || isDissociativeUser(system)) && (
                <button className="subpage-btn" onClick={() => setSubPage('states')}>
                    <span className="subpage-btn-icon"><Icon name="waves" size={24} /></span>
                    <div className="subpage-btn-info">
                        <div className="subpage-btn-label">{stateLabelPlural.charAt(0).toUpperCase() + stateLabelPlural.slice(1)}</div>
                        <div className="subpage-btn-count">{counts.states} {stateLabel}{counts.states !== 1 ? 's' : ''}</div>
                    </div>
                    <span className="subpage-btn-arrow">›</span>
                </button>
                )}
                {!isDissociativeUser(system) && (
                    <button className="subpage-btn" onClick={() => setSubPage('groups')}>
                        <span className="subpage-btn-icon"><Icon name="package" size={24} /></span>
                        <div className="subpage-btn-info">
                            <div className="subpage-btn-label">{groupLabelPlural.charAt(0).toUpperCase() + groupLabelPlural.slice(1)}</div>
                            <div className="subpage-btn-count">{counts.groups} {groupLabel}{counts.groups !== 1 ? 's' : ''}</div>
                        </div>
                        <span className="subpage-btn-arrow">›</span>
                    </button>
                )}
                <button className="subpage-btn" onClick={() => setSubPage('edit')}>
                    <span className="subpage-btn-icon"><Icon name="settings" size={24} /></span>
                    <div className="subpage-btn-info">
                        <div className="subpage-btn-label">Edit {systemLabel}</div>
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

    const systemLabel = getSystemTerm(system, { context: 'activity' })

    return (
        <div>
            <h2 className="section-title" style={{ marginBottom: '16px' }}>Edit {systemLabel}</h2>
            <form onSubmit={handleSave}>
                <div className="form-group">
                    <label>{systemLabel} name</label>
                    <input
                        className="text-input"
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder={`Your ${systemLabel.toLowerCase()} name`}
                        maxLength={100}
                    />
                </div>
                <div className="form-group">
                    <label>Description</label>
                    <textarea
                        className="text-input"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder={`About your ${systemLabel.toLowerCase()}...`}
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
