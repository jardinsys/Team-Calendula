import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useDiscordSdk } from '../../hooks/useDiscordSdk'
import {
    api, Icon,
    isSystemUser, isFragmentedUser, isDissociativeUser,
    getSystemTerm, getAlterTerm, getStateTerm, getGroupTerm
} from '@chameleon/shared'
import { LayerCard } from '@chameleon/shared/components/LayerCard.jsx'
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'

function getDisplayName(entity, fallbackName) {
    if (!entity) return fallbackName || 'Unknown'
    if (typeof entity.name === 'string') return entity.name
    return entity.name?.display || entity.name?.indexable || fallbackName || 'Unknown'
}

function buildEntityTypeList(system) {
    const types = []
    if (isSystemUser(system)) {
        types.push('alter')
    }
    if (isFragmentedUser(system) || isSystemUser(system)) {
        types.push('state')
        types.push('group')
    }
    if (isDissociativeUser(system) && !isSystemUser(system) && !isFragmentedUser(system)) {
        types.push('state')
    }
    return types
}

export function SwitchPage({ system: systemProp, onNavigate, onOpenSettings }) {
    const { session } = useDiscordSdk()
    const [system, setSystem] = useState(systemProp)
    const [frontData, setFrontData] = useState(null)
    const [alters, setAlters] = useState([])
    const [states, setStates] = useState([])
    const [groups, setGroups] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [saving, setSaving] = useState(false)

    // Layer state
    const [layers, setLayers] = useState([{ name: 'Main', entityIds: [] }])

    // Per-entity pre-set values (status/battery/caution for the upcoming switch)
    const [entityMeta, setEntityMeta] = useState({})

    // Which entity's popover is open
    const [editingEntityId, setEditingEntityId] = useState(null)

    // System-level status/battery
    const [status, setStatus] = useState('')
    const [battery, setBattery] = useState('')

    // Change tracking for button label
    const [entityChanges, setEntityChanges] = useState(false)
    const [metadataChanges, setMetadataChanges] = useState(false)

    // Layer DnD state
    const [activeId, setActiveId] = useState(null)

    const showLayers = isSystemUser(system) || isFragmentedUser(system)
    const showDissociativeButton = isDissociativeUser(system)

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        })
    )

    // Fetch all data
    const fetchAll = useCallback(async () => {
        try {
            setLoading(true)
            const sysData = systemProp || await api.getSystemFull()
            const types = buildEntityTypeList(sysData)
            const fetches = [
                api.getFront().catch(() => null),
                types.includes('alter') ? api.getAlters(true).catch(() => []) : Promise.resolve([]),
                types.includes('state') ? api.getStates(true).catch(() => []) : Promise.resolve([]),
                types.includes('group') ? api.getGroups(true).catch(() => []) : Promise.resolve([]),
            ]
            const [frontResult, altersData, statesData, groupsData] = await Promise.all(fetches)

            setSystem(sysData)
            setFrontData(frontResult)
            setAlters(altersData || [])
            setStates(statesData || [])
            setGroups(groupsData || [])

            // Pre-populate layers from current front
            if (frontResult?.layers?.length) {
                const newLayers = []
                const newEntityMeta = {}
                for (const layer of frontResult.layers) {
                    const entityIds = []
                    for (const fronter of layer.fronters || []) {
                        entityIds.push(fronter._id)
                        // Pre-populate entity meta from existing front
                        if (fronter.status || fronter.battery != null || fronter.caution) {
                            newEntityMeta[fronter._id] = {
                                status: fronter.status || '',
                                battery: fronter.battery != null ? String(fronter.battery) : '',
                                caution: fronter.caution || null,
                                applyTo: 'shift',
                            }
                        }
                    }
                    newLayers.push({
                        name: layer.name || `Layer ${newLayers.length + 1}`,
                        entityIds,
                    })
                }
                if (newLayers.length > 0) {
                    setLayers(newLayers)
                    setEntityMeta(newEntityMeta)
                }
                if (frontResult.status) setStatus(frontResult.status)
                if (frontResult.battery != null) setBattery(String(frontResult.battery))
            }

            setLoading(false)
        } catch (err) {
            setError(err.message)
            setLoading(false)
        }
    }, [systemProp])

    useEffect(() => { fetchAll() }, [fetchAll])

    // Build entity map for lookup
    const entityMap = useMemo(() => {
        const map = {}
        for (const e of alters) map[e._id] = { ...e, _entityType: 'alter' }
        for (const e of states) map[e._id] = { ...e, _entityType: 'state' }
        for (const e of groups) map[e._id] = { ...e, _entityType: 'group' }
        return map
    }, [alters, states, groups])

    // All available entities with type annotation
    const allEntities = useMemo(() => {
        return [
            ...alters.map(e => ({ ...e, _entityType: 'alter' })),
            ...states.map(e => ({ ...e, _entityType: 'state' })),
            ...groups.map(e => ({ ...e, _entityType: 'group' })),
        ]
    }, [alters, states, groups])

    // Available entity types for this system
    const availableEntityTypes = useMemo(() => buildEntityTypeList(system), [system])

    // ---- Entity operations per layer ----

    const handleAddEntity = useCallback((entityId, entityType) => {
        setLayers(prev => {
            const newLayers = [...prev]
            if (newLayers.length === 0) {
                newLayers.push({ name: 'Main', entityIds: [entityId] })
            } else {
                // Add to first layer if not already there
                if (!newLayers[0].entityIds.includes(entityId)) {
                    newLayers[0] = { ...newLayers[0], entityIds: [...newLayers[0].entityIds, entityId] }
                }
            }
            return newLayers
        })
        setEntityChanges(true)
    }, [])

    const handleRemoveEntity = useCallback((entityId, layerIndex) => {
        setLayers(prev => {
            const newLayers = prev.map(l => ({ ...l, entityIds: [...l.entityIds] }))
            if (newLayers[layerIndex]) {
                newLayers[layerIndex].entityIds = newLayers[layerIndex].entityIds.filter(id => id !== entityId)
            }
            return newLayers
        })
        setEntityChanges(true)
    }, [])

    const handleReplaceEntity = useCallback((oldEntityId, newEntityId) => {
        setLayers(prev => {
            const newLayers = prev.map(l => ({ ...l, entityIds: [...l.entityIds] }))
            for (const layer of newLayers) {
                const idx = layer.entityIds.indexOf(oldEntityId)
                if (idx !== -1) {
                    layer.entityIds[idx] = newEntityId
                    break
                }
            }
            return newLayers
        })
        setEntityChanges(true)
    }, [])

    const handleReplaceAll = useCallback((layerIndex) => {
        setLayers(prev => {
            const newLayers = prev.map(l => ({ ...l, entityIds: [...l.entityIds] }))
            if (newLayers[layerIndex]) {
                newLayers[layerIndex] = { ...newLayers[layerIndex], entityIds: [] }
            }
            return newLayers
        })
        setEntityChanges(true)
    }, [])

    const handleMoveEntity = useCallback((entityId, fromLayerIndex, toLayerIndex) => {
        setLayers(prev => {
            const newLayers = prev.map(l => ({ ...l, entityIds: [...l.entityIds] }))
            const fromLayer = newLayers[fromLayerIndex]
            const toLayer = newLayers[toLayerIndex]
            if (fromLayer && toLayer && fromLayerIndex !== toLayerIndex) {
                fromLayer.entityIds = fromLayer.entityIds.filter(id => id !== entityId)
                toLayer.entityIds.push(entityId)
            }
            return newLayers
        })
        setEntityChanges(true)
    }, [])

    // ---- Layer operations ----

    const handleReorderLayers = useCallback((newLayers) => {
        setLayers(newLayers)
        setEntityChanges(true)
    }, [])

    const handleRenameLayer = useCallback((layerIndex, name) => {
        setLayers(prev => {
            const newLayers = [...prev]
            newLayers[layerIndex] = { ...newLayers[layerIndex], name }
            return newLayers
        })
    }, [])

    const handleAddLayer = useCallback(() => {
        setLayers(prev => [...prev, { name: `Layer ${prev.length + 1}`, entityIds: [] }])
    }, [])

    const handleRemoveLayer = useCallback((layerIndex) => {
        setLayers(prev => {
            if (prev.length <= 1) return prev
            const removed = prev[layerIndex]
            const newLayers = prev.filter((_, i) => i !== layerIndex)
            // Move entities from removed layer to first layer
            if (removed?.entityIds?.length > 0 && newLayers.length > 0) {
                newLayers[0] = {
                    ...newLayers[0],
                    entityIds: [...newLayers[0].entityIds, ...removed.entityIds]
                }
            }
            return newLayers
        })
        setEntityChanges(true)
    }, [])

    // ---- Entity popover ----

    const handleEntityClick = useCallback((entity, layerIndex) => {
        setEditingEntityId(prev => prev === entity._id ? null : entity._id)
    }, [])

    const handleEditEntityClose = useCallback(() => {
        setEditingEntityId(null)
    }, [])

    const handleEditEntitySave = useCallback((entityId, data) => {
        setEntityMeta(prev => ({
            ...prev,
            [entityId]: { ...prev[entityId], ...data }
        }))
        setMetadataChanges(true)
        setEditingEntityId(null)
    }, [])

    // ---- Dissociative toggle ----

    const dissociativeStateName = system?.sys_type?.dissociativeStateName || 'Dissociated'
    const dissociativeState = useMemo(() => {
        return states.find(s =>
            s.name?.display?.toLowerCase() === dissociativeStateName.toLowerCase() ||
            s.name?.indexable?.toLowerCase() === dissociativeStateName.toLowerCase()
        )
    }, [states, dissociativeStateName])

    // Check if dissociative state is currently in any layer
    const isDissociativeFronting = useMemo(() => {
        if (!dissociativeState) return false
        return layers.some(l => l.entityIds.includes(dissociativeState._id))
    }, [layers, dissociativeState])

    const handleDissociativeToggle = useCallback(() => {
        if (!dissociativeState) {
            setError(`No "${dissociativeStateName}" state found. Create a state first.`)
            return
        }
        if (isDissociativeFronting) {
            // Remove from all layers
            setLayers(prev => prev.map(l => ({
                ...l,
                entityIds: l.entityIds.filter(id => id !== dissociativeState._id)
            })))
        } else {
            // Add to top layer (first layer)
            setLayers(prev => {
                const newLayers = [...prev]
                if (newLayers.length === 0) {
                    newLayers.push({ name: 'Main', entityIds: [dissociativeState._id] })
                } else {
                    if (!newLayers[0].entityIds.includes(dissociativeState._id)) {
                        newLayers[0] = { ...newLayers[0], entityIds: [...dissociativeState._id, ...newLayers[0].entityIds] }
                    }
                }
                return newLayers
            })
        }
        setEntityChanges(true)
    }, [dissociativeState, dissociativeStateName, isDissociativeFronting])

    // ---- Switch/Update ----

    const handleConfirmSwitch = useCallback(async () => {
        try {
            setSaving(true)
            const layerPayload = layers
                .filter(l => l.entityIds.length > 0)
                .map(l => ({
                    name: l.name,
                    entities: l.entityIds.map(id => {
                        const ent = entityMap[id]
                        return { id, type: ent?._entityType || 'alter' }
                    }).filter(e => e.type)
                }))

            if (layerPayload.length === 0) {
                await api.switchOut()
            } else {
                await api.guidedSwitch({
                    layers: layerPayload,
                    status: status || undefined,
                    battery: battery ? Number(battery) : undefined,
                })
            }

            // Apply per-entity metadata to shifts
            // guidedSwitch returns full front data with shift IDs
            const freshFront = await api.getFront().catch(() => null)
            if (freshFront?.layers) {
                for (const layer of freshFront.layers) {
                    for (const fronter of (layer.fronters || [])) {
                        const meta = entityMeta[fronter._id]
                        if (meta && (meta.status || meta.battery != null || meta.caution)) {
                            if (fronter.shiftId) {
                                await api.updateShiftStatus(fronter.shiftId, {
                                    status: meta.status || undefined,
                                    battery: meta.battery != null ? Number(meta.battery) : undefined,
                                    caution: meta.caution || undefined,
                                    applyTo: meta.applyTo || 'shift',
                                }).catch(() => {})
                            }
                        }
                    }
                }
            }

            setEntityChanges(false)
            setMetadataChanges(false)
            setEntityMeta({})
            setEditingEntityId(null)
            await fetchAll()
            setSaving(false)
        } catch (err) {
            setError(err.message)
            setSaving(false)
        }
    }, [layers, entityMap, status, battery, entityMeta, fetchAll])

    const handleCancel = useCallback(() => {
        setEntityChanges(false)
        setMetadataChanges(false)
        setEntityMeta({})
        setEditingEntityId(null)
        fetchAll()
    }, [fetchAll])

    // ---- Layer DnD ----

    const handleLayerDragStart = (event) => {
        setActiveId(event.active.id)
    }

    const handleLayerDragEnd = (event) => {
        const { active, over } = event
        setActiveId(null)
        if (!over) return

        const activeIdStr = active.id
        const overIdStr = over.id

        if (typeof activeIdStr === 'string' && activeIdStr.startsWith('layer-') &&
            typeof overIdStr === 'string' && overIdStr.startsWith('layer-')) {
            const fromIndex = parseInt(activeIdStr.replace('layer-', ''))
            const toIndex = parseInt(overIdStr.replace('layer-', ''))
            if (fromIndex !== toIndex) {
                const reordered = arrayMove(layers, fromIndex, toIndex)
                handleReorderLayers(reordered)
            }
        }
    }

    // ---- Terminology ----

    const alterLabel = useMemo(() => getAlterTerm(system, { plural: false }), [system])
    const stateLabel = useMemo(() => getStateTerm(system, { plural: false }), [system])
    const groupLabel = useMemo(() => getGroupTerm(system, { plural: false }), [system])

    // Button label
    const hasChanges = entityChanges || metadataChanges
    const buttonLabel = saving
        ? 'Switching...'
        : entityChanges
            ? 'Switch'
            : metadataChanges
                ? 'Update'
                : 'Switch'

    if (loading && !system) {
        return (
            <div className="status-screen">
                <div className="spinner" />
                <p>Loading switch...</p>
            </div>
        )
    }

    return (
        <div className="switch-page">
            {/* Settings button */}
            <button
                className="btn btn-ghost btn-sm"
                onClick={onOpenSettings}
                title="Settings"
                style={{ position: 'absolute', top: 'var(--space-md)', right: 'var(--space-md)', padding: '6px', minWidth: 'auto', zIndex: 5 }}
            >
                <Icon name="settings" size={16} />
            </button>

            {/* History button */}
            <button
                className="btn btn-ghost btn-sm"
                onClick={() => onNavigate('front-history')}
                title="Front History"
                style={{ position: 'absolute', top: 'var(--space-md)', right: 'calc(var(--space-md) + 34px)', padding: '6px', minWidth: 'auto', zIndex: 5 }}
            >
                <Icon name="notepadText" size={16} />
            </button>

            {/* Dissociative button — always first if applicable */}
            {showDissociativeButton && dissociativeState && (
                <button
                    className="switch-dissociative-btn"
                    onClick={handleDissociativeToggle}
                    disabled={saving}
                >
                    <div className="switch-dissociative-icon">
                        <Icon name="moon" size={28} />
                    </div>
                    <div className="switch-dissociative-text">
                        <span className="switch-dissociative-title">
                            {isDissociativeFronting ? `End ${dissociativeStateName}` : dissociativeStateName}
                        </span>
                        <span className="switch-dissociative-subtitle">
                            {isDissociativeFronting
                                ? `Remove ${dissociativeStateName.toLowerCase()} from front`
                                : `Pull ${dissociativeStateName.toLowerCase()} to front`
                            }
                        </span>
                    </div>
                </button>
            )}

            {/* Layers — full-width container */}
            {showLayers && (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleLayerDragStart}
                    onDragEnd={handleLayerDragEnd}
                >
                    <SortableContext items={layers.map((_, i) => `layer-${i}`)} strategy={verticalListSortingStrategy}>
                        <div className="switch-layers-container">
                            {layers.map((layer, index) => (
                                <LayerCard
                                    key={`layer-${index}`}
                                    layer={layer}
                                    layerIndex={index}
                                    allEntities={allEntities}
                                    entityMap={entityMap}
                                    entityMeta={entityMeta}
                                    onAddEntity={handleAddEntity}
                                    onRemoveEntity={handleRemoveEntity}
                                    onReplaceEntity={handleReplaceEntity}
                                    onReplaceAll={handleReplaceAll}
                                    onMoveEntity={handleMoveEntity}
                                    onRename={handleRenameLayer}
                                    onDelete={handleRemoveLayer}
                                    layerCount={layers.length}
                                    allLayers={layers}
                                    editingEntityId={editingEntityId}
                                    onEntityClick={handleEntityClick}
                                    onEditEntityClose={handleEditEntityClose}
                                    onEditEntitySave={handleEditEntitySave}
                                />
                            ))}
                        </div>
                    </SortableContext>

                    <DragOverlay>
                        {activeId ? (
                            <div className="switch-layer-drag-overlay">
                                {typeof activeId === 'string' && activeId.startsWith('layer-') && (
                                    <div className="switch-layer-drag-label">
                                        {layers[parseInt(activeId.replace('layer-', ''))]?.name || 'Layer'}
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            )}

            {/* Add Layer button */}
            {showLayers && (
                <button className="switch-add-layer-btn" onClick={handleAddLayer}>
                    <Icon name="plus" size={16} />
                    Add Layer
                </button>
            )}

            {/* Status & Battery */}
            <div className="switch-status-section">
                <div className="switch-status-field">
                    <label className="switch-field-label">Status</label>
                    <input
                        type="text"
                        className="text-input"
                        placeholder="How are you feeling?"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    />
                </div>
                <div className="switch-status-field">
                    <label className="switch-field-label">Battery</label>
                    <div className="switch-battery-input">
                        <input
                            type="number"
                            className="text-input"
                            placeholder="0-100"
                            min="0"
                            max="100"
                            value={battery}
                            onChange={(e) => setBattery(e.target.value)}
                        />
                        <span className="switch-battery-unit">%</span>
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="switch-error" onClick={() => setError(null)}>
                    <Icon name="alert" size={16} color="var(--color-error)" />
                    <span>{error}</span>
                </div>
            )}

            {/* Actions */}
            <div className="switch-actions">
                <button
                    className="btn btn-secondary"
                    onClick={handleCancel}
                    disabled={saving}
                >
                    Cancel
                </button>
                <button
                    className="btn btn-primary"
                    onClick={handleConfirmSwitch}
                    disabled={saving}
                >
                    {buttonLabel}
                </button>
            </div>
        </div>
    )
}

export default SwitchPage
