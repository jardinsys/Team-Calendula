import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useDiscordSdk } from '../../hooks/useDiscordSdk'
import { api, EntityCardList, EntityFormModal, FrontDisplay, Icon, getSystemTerm, getAlterTerm, getStateTerm, getGroupTerm, isFragmentedUser, isDissociativeUser, ImageUpload } from '@chameleon/shared'

function getDisplayName(entity, fallbackName) {
    if (!entity) return fallbackName || 'Unknown'
    if (typeof entity.name === 'string') return entity.name
    return entity.name?.display || entity.name?.indexable || fallbackName || 'Unknown'
}

export function SystemPage({ system: systemProp, onNavigate, onOpenSettings }) {
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

    // Batch selection state
    const [selectionMode, setSelectionMode] = useState(false)
    const [selectedIds, setSelectedIds] = useState([])
    const [batchAction, setBatchAction] = useState(null) // 'condition' | 'group' | 'convert' | 'delete'
    const [batchLoading, setBatchLoading] = useState(false)
    const [batchEntityType, setBatchEntityType] = useState(null) // 'alter' | 'state' | 'group'

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

    const handleFronterEdit = useCallback(async (shiftId, data) => {
        await api.updateShiftStatus(shiftId, data)
        await fetchAll()
    }, [fetchAll])

    const handleEntityClick = (entity, type) => {
        if (selectionMode) {
            toggleSelection(entity)
        } else {
            onNavigate('entity', { entityType: type, entityId: entity._id })
        }
    }

    // Batch selection helpers
    const toggleSelection = (entity) => {
        setSelectedIds(prev =>
            prev.includes(entity._id)
                ? prev.filter(id => id !== entity._id)
                : [...prev, entity._id]
        )
    }

    const selectAll = (entities) => {
        const allIds = entities.map(e => e._id)
        setSelectedIds(prev => {
            const allSelected = allIds.every(id => prev.includes(id))
            return allSelected ? [] : allIds
        })
    }

    const enterSelectionMode = (entityType) => {
        setSelectionMode(true)
        setSelectedIds([])
        setBatchAction(null)
        setBatchEntityType(entityType)
    }

    const exitSelectionMode = () => {
        setSelectionMode(false)
        setSelectedIds([])
        setBatchAction(null)
        setBatchEntityType(null)
    }

    // Batch action handlers
    const handleBatchCondition = async (conditionName) => {
        if (!selectedIds.length || !batchEntityType) return
        setBatchLoading(true)
        try {
            if (batchEntityType === 'alter') {
                await api.updateAlters(selectedIds, { condition: conditionName || undefined })
            } else if (batchEntityType === 'state') {
                await api.updateStates(selectedIds, { condition: conditionName || undefined })
            }
            await fetchAll()
            exitSelectionMode()
        } catch (err) {
            setError(err.message)
            setBatchLoading(false)
        }
    }

    const handleBatchDelete = async () => {
        if (!selectedIds.length || !batchEntityType) return
        setBatchLoading(true)
        try {
            if (batchEntityType === 'alter') {
                await api.deleteAlters(selectedIds)
            } else if (batchEntityType === 'state') {
                await api.deleteStates(selectedIds)
            } else if (batchEntityType === 'group') {
                await api.deleteGroups(selectedIds)
            }
            await fetchAll()
            exitSelectionMode()
        } catch (err) {
            setError(err.message)
            setBatchLoading(false)
        }
    }

    const handleBatchGroupAdd = async (groupId) => {
        if (!selectedIds.length || !batchEntityType) return
        setBatchLoading(true)
        try {
            if (batchEntityType === 'alter') {
                await api.addGroupMembers(groupId, { alterIDs: selectedIds })
            } else if (batchEntityType === 'state') {
                await api.addGroupMembers(groupId, { stateIDs: selectedIds })
            }
            await fetchAll()
            exitSelectionMode()
        } catch (err) {
            setError(err.message)
            setBatchLoading(false)
        }
    }

    const handleBatchGroupRemove = async (groupId) => {
        if (!selectedIds.length || !batchEntityType) return
        setBatchLoading(true)
        try {
            if (batchEntityType === 'alter') {
                await api.removeGroupMembers(groupId, { alterIDs: selectedIds })
            } else if (batchEntityType === 'state') {
                await api.removeGroupMembers(groupId, { stateIDs: selectedIds })
            }
            await fetchAll()
            exitSelectionMode()
        } catch (err) {
            setError(err.message)
            setBatchLoading(false)
        }
    }

    const handleBatchConvert = async (targetType) => {
        if (!selectedIds.length || !batchEntityType) return
        setBatchLoading(true)
        try {
            const sourceType = batchEntityType === 'alter' ? 'alter' : 'state'
            const selectedEntities = batchEntityType === 'alter' ? alters : states
            const names = selectedIds
                .map(id => selectedEntities.find(e => e._id === id))
                .filter(Boolean)
                .map(e => e.name?.display || e.name?.indexable)
                .filter(Boolean)
            await api.convertEntities(sourceType, targetType, names)
            await fetchAll()
            exitSelectionMode()
        } catch (err) {
            setError(err.message)
            setBatchLoading(false)
        }
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

    // Get available conditions for batch condition menu
    const getConditions = () => {
        if (batchEntityType === 'alter') return system?.alters?.conditions || []
        if (batchEntityType === 'state') return system?.states?.conditions || []
        return []
    }

    // Get entities that share a group with selected entities (for "remove from" section)
    const getSelectedEntityGroups = () => {
        if (!batchEntityType || batchEntityType === 'group') return []
        const selectedEntities = (batchEntityType === 'alter' ? alters : states).filter(e => selectedIds.includes(e._id))
        const groupIds = new Set()
        selectedEntities.forEach(e => {
            const ids = batchEntityType === 'alter' ? e.groupsIDs : e.groupIDs
            ids?.forEach(id => groupIds.add(id))
        })
        return groups.filter(g => groupIds.has(g._id))
    }

    // Get groups that selected entities are NOT in (for "add to" section)
    const getAvailableGroups = () => {
        if (!batchEntityType || batchEntityType === 'group') return []
        const selectedEntities = (batchEntityType === 'alter' ? alters : states).filter(e => selectedIds.includes(e._id))
        const groupIds = new Set()
        selectedEntities.forEach(e => {
            const ids = batchEntityType === 'alter' ? e.groupsIDs : e.groupIDs
            ids?.forEach(id => groupIds.add(id))
        })
        return groups.filter(g => !groupIds.has(g._id))
    }

    if (subPage === 'alters') {
        return (
            <div>
                <button className="btn-ghost" onClick={() => { exitSelectionMode(); setSubPage(null) }} style={{ fontSize: '0.75rem', marginBottom: '12px' }}>
                    ← Back
                </button>
                <div className="section-header">
                    <div>
                        <h2 className="section-title">{alterLabelPlural.charAt(0).toUpperCase() + alterLabelPlural.slice(1)}</h2>
                        <span className="section-count">{alters.length} {alterLabel}{alters.length !== 1 ? 's' : ''}</span>
                    </div>
                    {!selectionMode && (
                        <button className="btn btn-ghost btn-sm" onClick={() => enterSelectionMode('alter')}>
                            Select
                        </button>
                    )}
                </div>
                <EntityCardList
                    entities={alters}
                    type="alter"
                    typeLabel={alterLabel}
                    onEntityClick={(e) => handleEntityClick(e, 'alter')}
                    fallbackName={fallbackName}
                    selectedIds={selectedIds}
                    onToggle={toggleSelection}
                    selectionMode={selectionMode}
                />
                {selectionMode ? (
                    <BatchActionBar
                        selectedCount={selectedIds.length}
                        totalCount={alters.length}
                        onSelectAll={() => selectAll(alters)}
                        onCondition={() => setBatchAction('condition')}
                        onGroup={() => setBatchAction('group')}
                        onConvert={() => setBatchAction('convert')}
                        onDelete={() => setBatchAction('delete')}
                        onCancel={exitSelectionMode}
                        canConvert={batchEntityType === 'alter' || batchEntityType === 'state'}
                        convertLabel={batchEntityType === 'alter' ? '→ State' : '→ Alter'}
                    />
                ) : (
                    <button className="fab" onClick={() => setShowCreateEntity('alter')}>+</button>
                )}
                {showCreateEntity === 'alter' && (
                    <EntityFormModal
                        type="alter"
                        typeLabel={alterLabel}
                        onClose={() => setShowCreateEntity(null)}
                        onCreated={handleEntityCreated}
                    />
                )}
                {batchAction === 'condition' && (
                    <BatchConditionMenu
                        conditions={getConditions()}
                        onSelect={handleBatchCondition}
                        onClear={() => handleBatchCondition(null)}
                        onBack={() => setBatchAction(null)}
                        loading={batchLoading}
                        entityType={batchEntityType}
                    />
                )}
                {batchAction === 'group' && (
                    <BatchGroupMenu
                        availableGroups={getAvailableGroups()}
                        memberGroups={getSelectedEntityGroups()}
                        onAdd={handleBatchGroupAdd}
                        onRemove={handleBatchGroupRemove}
                        onBack={() => setBatchAction(null)}
                        loading={batchLoading}
                    />
                )}
                {batchAction === 'convert' && batchEntityType === 'alter' && (
                    <BatchConvertMenu
                        targetType="state"
                        targetLabel={stateLabel}
                        onConvert={handleBatchConvert}
                        onBack={() => setBatchAction(null)}
                        loading={batchLoading}
                        count={selectedIds.length}
                    />
                )}
                {batchAction === 'delete' && (
                    <BatchDeleteConfirm
                        entities={(batchEntityType === 'alter' ? alters : batchEntityType === 'state' ? states : groups).filter(e => selectedIds.includes(e._id))}
                        onConfirm={handleBatchDelete}
                        onCancel={() => setBatchAction(null)}
                        loading={batchLoading}
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
                <button className="btn-ghost" onClick={() => { exitSelectionMode(); setSubPage(null) }} style={{ fontSize: '0.75rem', marginBottom: '12px' }}>
                    ← Back
                </button>
                <div className="section-header">
                    <div>
                        <h2 className="section-title">{stateLabelPlural.charAt(0).toUpperCase() + stateLabelPlural.slice(1)}</h2>
                        <span className="section-count">{states.length} {stateLabel}{states.length !== 1 ? 's' : ''}</span>
                    </div>
                    {!selectionMode && (
                        <button className="btn btn-ghost btn-sm" onClick={() => enterSelectionMode('state')}>
                            Select
                        </button>
                    )}
                </div>
                <EntityCardList
                    entities={states}
                    type="state"
                    typeLabel={stateLabel}
                    onEntityClick={(e) => handleEntityClick(e, 'state')}
                    fallbackName={fallbackName}
                    selectedIds={selectedIds}
                    onToggle={toggleSelection}
                    selectionMode={selectionMode}
                />
                {selectionMode ? (
                    <BatchActionBar
                        selectedCount={selectedIds.length}
                        totalCount={states.length}
                        onSelectAll={() => selectAll(states)}
                        onCondition={() => setBatchAction('condition')}
                        onGroup={() => setBatchAction('group')}
                        onConvert={() => setBatchAction('convert')}
                        onDelete={() => setBatchAction('delete')}
                        onCancel={exitSelectionMode}
                        canConvert={batchEntityType === 'alter' || batchEntityType === 'state'}
                        convertLabel={batchEntityType === 'state' ? '→ Alter' : '→ State'}
                    />
                ) : (
                    <button className="fab" onClick={() => setShowCreateEntity('state')}>+</button>
                )}
                {showCreateEntity === 'state' && (
                    <EntityFormModal
                        type="state"
                        typeLabel={stateLabel}
                        onClose={() => setShowCreateEntity(null)}
                        onCreated={handleEntityCreated}
                    />
                )}
                {batchAction === 'condition' && (
                    <BatchConditionMenu
                        conditions={getConditions()}
                        onSelect={handleBatchCondition}
                        onClear={() => handleBatchCondition(null)}
                        onBack={() => setBatchAction(null)}
                        loading={batchLoading}
                        entityType={batchEntityType}
                    />
                )}
                {batchAction === 'group' && (
                    <BatchGroupMenu
                        availableGroups={getAvailableGroups()}
                        memberGroups={getSelectedEntityGroups()}
                        onAdd={handleBatchGroupAdd}
                        onRemove={handleBatchGroupRemove}
                        onBack={() => setBatchAction(null)}
                        loading={batchLoading}
                    />
                )}
                {batchAction === 'convert' && batchEntityType === 'state' && (
                    <BatchConvertMenu
                        targetType="alter"
                        targetLabel={alterLabel}
                        onConvert={handleBatchConvert}
                        onBack={() => setBatchAction(null)}
                        loading={batchLoading}
                        count={selectedIds.length}
                    />
                )}
                {batchAction === 'delete' && (
                    <BatchDeleteConfirm
                        entities={states.filter(e => selectedIds.includes(e._id))}
                        onConfirm={handleBatchDelete}
                        onCancel={() => setBatchAction(null)}
                        loading={batchLoading}
                    />
                )}
            </div>
        )
    }

    if (subPage === 'groups') {
        return (
            <div>
                <button className="btn-ghost" onClick={() => { exitSelectionMode(); setSubPage(null) }} style={{ fontSize: '0.75rem', marginBottom: '12px' }}>
                    ← Back
                </button>
                <div className="section-header">
                    <div>
                        <h2 className="section-title">{groupLabelPlural.charAt(0).toUpperCase() + groupLabelPlural.slice(1)}</h2>
                        <span className="section-count">{groups.length} {groupLabel}{groups.length !== 1 ? 's' : ''}</span>
                    </div>
                    {!selectionMode && (
                        <button className="btn btn-ghost btn-sm" onClick={() => enterSelectionMode('group')}>
                            Select
                        </button>
                    )}
                </div>
                <EntityCardList
                    entities={groups}
                    type="group"
                    typeLabel={groupLabel}
                    onEntityClick={(e) => handleEntityClick(e, 'group')}
                    fallbackName={fallbackName}
                    selectedIds={selectedIds}
                    onToggle={toggleSelection}
                    selectionMode={selectionMode}
                />
                {selectionMode ? (
                    <BatchActionBar
                        selectedCount={selectedIds.length}
                        totalCount={groups.length}
                        onSelectAll={() => selectAll(groups)}
                        onDelete={() => setBatchAction('delete')}
                        onCancel={exitSelectionMode}
                        canConvert={false}
                    />
                ) : (
                    <button className="fab" onClick={() => setShowCreateEntity('group')}>+</button>
                )}
                {showCreateEntity === 'group' && (
                    <EntityFormModal
                        type="group"
                        typeLabel={groupLabel}
                        onClose={() => setShowCreateEntity(null)}
                        onCreated={handleEntityCreated}
                    />
                )}
                {batchAction === 'delete' && (
                    <BatchDeleteConfirm
                        entities={groups.filter(e => selectedIds.includes(e._id))}
                        onConfirm={handleBatchDelete}
                        onCancel={() => setBatchAction(null)}
                        loading={batchLoading}
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
                <FrontDisplay frontData={frontData} isOwner={true} onFronterEdit={handleFronterEdit} />
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
            <header className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <h1>{systemLabel}</h1>
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={onOpenSettings}
                    title="Settings"
                    style={{ padding: '6px', minWidth: 'auto' }}
                >
                    <Icon name="settings" size={16} />
                </button>
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

            <FrontDisplay frontData={frontData} compact={true} isOwner={true} onFronterEdit={handleFronterEdit} />

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

// ============================================
// BATCH ACTION SUB-COMPONENTS
// ============================================

function BatchActionBar({ selectedCount, totalCount, onSelectAll, onCondition, onGroup, onConvert, onDelete, onCancel, canConvert, convertLabel }) {
    const allSelected = selectedCount === totalCount
    return (
        <div className="batch-action-bar">
            <div className="batch-action-bar-top">
                <button className="btn btn-ghost btn-sm" onClick={onSelectAll}>
                    {allSelected ? 'Deselect All' : 'Select All'}
                </button>
                <span className="batch-action-bar-count">{selectedCount} selected</span>
            </div>
            <div className="batch-action-bar-actions">
                {onCondition && (
                    <button className="batch-action-btn" onClick={onCondition}>
                        <Icon name="tag" size={16} />
                        Condition
                    </button>
                )}
                {onGroup && (
                    <button className="batch-action-btn" onClick={onGroup}>
                        <Icon name="package" size={16} />
                        Group
                    </button>
                )}
                {canConvert && onConvert && (
                    <button className="batch-action-btn" onClick={onConvert}>
                        <Icon name="repeat" size={16} />
                        {convertLabel}
                    </button>
                )}
                {onDelete && (
                    <button className="batch-action-btn batch-action-btn-danger" onClick={onDelete}>
                        <Icon name="trash" size={16} />
                        Delete
                    </button>
                )}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onCancel} style={{ marginTop: '8px', width: '100%' }}>
                Cancel
            </button>
        </div>
    )
}

function BatchConditionMenu({ conditions, onSelect, onClear, onBack, loading, entityType }) {
    return (
        <div className="batch-sub-menu">
            <div className="batch-sub-menu-header">
                <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
                <span>Set condition</span>
            </div>
            <div className="batch-sub-menu-options">
                {conditions.map(c => (
                    <button
                        key={c.name}
                        className="batch-sub-menu-option"
                        onClick={() => onSelect(c.name)}
                        disabled={loading}
                    >
                        {c.name}
                        {c.settings?.hide_to_self && <span className="batch-sub-menu-meta">hidden</span>}
                    </button>
                ))}
                <button
                    className="batch-sub-menu-option batch-sub-menu-option-danger"
                    onClick={onClear}
                    disabled={loading}
                >
                    Clear Condition
                </button>
            </div>
        </div>
    )
}

function BatchGroupMenu({ availableGroups, memberGroups, onAdd, onRemove, onBack, loading }) {
    return (
        <div className="batch-sub-menu">
            <div className="batch-sub-menu-header">
                <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
                <span>Manage groups</span>
            </div>
            {availableGroups.length > 0 && (
                <>
                    <div className="batch-sub-menu-label">Add to:</div>
                    <div className="batch-sub-menu-options">
                        {availableGroups.map(g => (
                            <button
                                key={g._id}
                                className="batch-sub-menu-option"
                                onClick={() => onAdd(g._id)}
                                disabled={loading}
                            >
                                <span className="batch-sub-menu-dot" style={{ backgroundColor: g.color || '#c4b5fd' }} />
                                {getDisplayName(g)}
                            </button>
                        ))}
                    </div>
                </>
            )}
            {memberGroups.length > 0 && (
                <>
                    <div className="batch-sub-menu-label">Remove from:</div>
                    <div className="batch-sub-menu-options">
                        {memberGroups.map(g => (
                            <button
                                key={g._id}
                                className="batch-sub-menu-option batch-sub-menu-option-danger"
                                onClick={() => onRemove(g._id)}
                                disabled={loading}
                            >
                                <span className="batch-sub-menu-dot" style={{ backgroundColor: g.color || '#c4b5fd' }} />
                                {getDisplayName(g)}
                            </button>
                        ))}
                    </div>
                </>
            )}
            {availableGroups.length === 0 && memberGroups.length === 0 && (
                <div className="batch-sub-menu-empty">No groups available</div>
            )}
        </div>
    )
}

function BatchConvertMenu({ targetType, targetLabel, onConvert, onBack, loading, count }) {
    const [confirm, setConfirm] = useState(false)
    return (
        <div className="batch-sub-menu">
            <div className="batch-sub-menu-header">
                <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
                <span>Convert {count} entities</span>
            </div>
            {!confirm ? (
                <div className="batch-sub-menu-options">
                    <button
                        className="batch-sub-menu-option"
                        onClick={() => setConfirm(true)}
                    >
                        Convert to {targetLabel}
                    </button>
                </div>
            ) : (
                <div className="batch-sub-menu-confirm">
                    <p>Convert {count} entities to {targetLabel}? This cannot be undone.</p>
                    <div className="batch-sub-menu-confirm-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => onConvert(targetType)} disabled={loading}>
                            {loading ? 'Converting...' : 'Confirm'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)} disabled={loading}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

function BatchDeleteConfirm({ entities, onConfirm, onCancel, loading }) {
    const [confirm, setConfirm] = useState(false)
    const names = entities.map(e => getDisplayName(e)).join(', ')
    return (
        <div className="batch-sub-menu">
            <div className="batch-sub-menu-header">
                <button className="btn btn-ghost btn-sm" onClick={onCancel}>← Back</button>
                <span>Delete {entities.length} entities</span>
            </div>
            {!confirm ? (
                <div className="batch-sub-menu-confirm">
                    <p>Permanently delete <strong>{names}</strong>?</p>
                    <p className="batch-sub-menu-warning">This cannot be undone.</p>
                    <div className="batch-sub-menu-confirm-actions">
                        <button className="btn btn-danger btn-sm" onClick={() => setConfirm(true)}>
                            Delete
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <div className="batch-sub-menu-confirm">
                    <p>Are you sure? This will permanently delete {entities.length} entities.</p>
                    <div className="batch-sub-menu-confirm-actions">
                        <button className="btn btn-danger btn-sm" onClick={onConfirm} disabled={loading}>
                            {loading ? 'Deleting...' : 'Yes, Delete'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)} disabled={loading}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
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

    const handleAvatarChange = async (file) => {
        try {
            await api.uploadSystemAvatar(file)
            onSaved?.()
        } catch (err) {
            setError(err.message)
        }
    }

    const handleBannerChange = async (file) => {
        try {
            await api.uploadSystemBanner(file)
            onSaved?.()
        } catch (err) {
            setError(err.message)
        }
    }

    const handleAvatarRemove = async () => {
        try {
            await api.removeSystemAvatar()
            onSaved?.()
        } catch (err) {
            setError(err.message)
        }
    }

    const handleBannerRemove = async () => {
        try {
            await api.removeSystemBanner()
            onSaved?.()
        } catch (err) {
            setError(err.message)
        }
    }

    const systemLabel = getSystemTerm(system, { context: 'activity' })
    const currentAvatar = system?.avatar?.url || system?.avatar
    const currentBanner = system?.theme?.background?.media?.url

    return (
        <div>
            <h2 className="section-title" style={{ marginBottom: '16px' }}>Edit {systemLabel}</h2>

            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
                <ImageUpload
                    currentImage={currentAvatar}
                    onUpload={handleAvatarChange}
                    onRemove={handleAvatarRemove}
                    label="Avatar"
                    size="lg"
                />
                <ImageUpload
                    currentImage={currentBanner}
                    onUpload={handleBannerChange}
                    onRemove={handleBannerRemove}
                    label="Banner"
                    size="lg"
                />
            </div>

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
