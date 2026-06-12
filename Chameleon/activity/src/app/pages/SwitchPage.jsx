import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useDiscordSdk } from '../../hooks/useDiscordSdk'
import {
    api, Icon, FrontDisplay,
    isSystemUser, isFragmentedUser, isDissociativeUser,
    getSystemTerm, getAlterTerm, getStateTerm, getGroupTerm
} from '@chameleon/shared'
import { SwitchEntityGrid } from '@chameleon/shared/components/SwitchEntityGrid.jsx'
import { SwitchLayerPanel } from '@chameleon/shared/components/SwitchLayerPanel.jsx'

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

export function SwitchPage({ system: systemProp, onNavigate }) {
    const { session } = useDiscordSdk()
    const [system, setSystem] = useState(systemProp)
    const [frontData, setFrontData] = useState(null)
    const [alters, setAlters] = useState([])
    const [states, setStates] = useState([])
    const [groups, setGroups] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [saving, setSaving] = useState(false)

    // Selection state
    const [selectedIds, setSelectedIds] = useState([])
    const [layers, setLayers] = useState([{ name: 'Main', entityIds: [] }])
    const [searchQuery, setSearchQuery] = useState('')
    const [status, setStatus] = useState('')
    const [battery, setBattery] = useState('')

    const showLayers = isSystemUser(system) || isFragmentedUser(system)
    const showDissociativeButton = isDissociativeUser(system)

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

            // Pre-populate from current front
            if (frontResult?.layers?.length) {
                const newLayers = []
                const newSelectedIds = []
                for (const layer of frontResult.layers) {
                    const entityIds = []
                    for (const fronter of layer.fronters || []) {
                        entityIds.push(fronter._id)
                        newSelectedIds.push(fronter._id)
                    }
                    newLayers.push({
                        name: layer.name || `Layer ${newLayers.length + 1}`,
                        entityIds,
                    })
                }
                if (newLayers.length > 0) {
                    setLayers(newLayers)
                    setSelectedIds(newSelectedIds)
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
        for (const e of alters) {
            map[e._id] = { ...e, _entityType: 'alter' }
        }
        for (const e of states) {
            map[e._id] = { ...e, _entityType: 'state' }
        }
        for (const e of groups) {
            map[e._id] = { ...e, _entityType: 'group' }
        }
        return map
    }, [alters, states, groups])

    // All available entities (not already selected)
    const allEntities = useMemo(() => {
        return [...alters.map(e => ({ ...e, _entityType: 'alter' })),
                ...states.map(e => ({ ...e, _entityType: 'state' })),
                ...groups.map(e => ({ ...e, _entityType: 'group' }))]
    }, [alters, states, groups])

    // Handle entity toggle from grid
    const handleToggleEntity = useCallback((entity) => {
        const id = entity._id
        setSelectedIds(prev => {
            if (prev.includes(id)) {
                // Remove from selection and all layers
                setLayers(ls => ls.map(l => ({
                    ...l,
                    entityIds: l.entityIds.filter(eid => eid !== id)
                })))
                return prev.filter(eid => eid !== id)
            } else {
                // Add to first layer
                setLayers(ls => {
                    const newLayers = [...ls]
                    if (newLayers.length === 0) {
                        newLayers.push({ name: 'Main', entityIds: [id] })
                    } else {
                        newLayers[0] = { ...newLayers[0], entityIds: [...newLayers[0].entityIds, id] }
                    }
                    return newLayers
                })
                return [...prev, id]
            }
        })
    }, [])

    // Handle entity move between layers (from DnD)
    const handleMoveEntity = useCallback((entityId, fromLayerIndex, toLayerIndex) => {
        setLayers(prev => {
            const newLayers = prev.map(l => ({ ...l, entityIds: [...l.entityIds] }))

            if (fromLayerIndex === -1) {
                // Not in any layer — add to target
                if (newLayers[toLayerIndex]) {
                    newLayers[toLayerIndex].entityIds.push(entityId)
                }
            } else if (fromLayerIndex === toLayerIndex) {
                // Same layer — reorder is handled by DnD internally
            } else {
                // Move between layers
                const fromLayer = newLayers[fromLayerIndex]
                const toLayer = newLayers[toLayerIndex]
                if (fromLayer && toLayer) {
                    fromLayer.entityIds = fromLayer.entityIds.filter(id => id !== entityId)
                    toLayer.entityIds.push(entityId)
                }
            }
            return newLayers
        })
    }, [])

    // Handle entity remove from layer
    const handleRemoveEntity = useCallback((entity, layerIndex) => {
        const id = entity._id
        setLayers(prev => {
            const newLayers = prev.map(l => ({ ...l, entityIds: [...l.entityIds] }))
            if (newLayers[layerIndex]) {
                newLayers[layerIndex].entityIds = newLayers[layerIndex].entityIds.filter(eid => eid !== id)
            }
            return newLayers
        })
        // Check if entity is still in any layer
        setLayers(currentLayers => {
            const stillPresent = currentLayers.some(l => l.entityIds.includes(id))
            if (!stillPresent) {
                setSelectedIds(prev => prev.filter(eid => eid !== id))
            }
            return currentLayers
        })
    }, [])

    // Layer operations
    const handleReorderLayers = useCallback((newLayers) => {
        setLayers(newLayers)
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
    }, [])

    // Dissociative quick switch
    const handleDissociativeSwitch = useCallback(async () => {
        try {
            setSaving(true)
            // Find the dissociative state (auto-created "Dissociated" state)
            const dissociativeState = states.find(s =>
                s.name?.display?.toLowerCase().includes('dissociat') ||
                s.name?.indexable?.toLowerCase().includes('dissociat')
            )
            if (!dissociativeState) {
                setError('No dissociative state found. Create a state first.')
                setSaving(false)
                return
            }
            await api.switchOut()
            await api.addShiftToLayer(dissociativeState._id, 'state')
            await fetchAll()
            setSaving(false)
        } catch (err) {
            setError(err.message)
            setSaving(false)
        }
    }, [states, fetchAll])

    // Confirm switch
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
                // Switch out — no entities selected
                await api.switchOut()
            } else {
                await api.guidedSwitch({
                    layers: layerPayload,
                    status: status || undefined,
                    battery: battery ? Number(battery) : undefined,
                })
            }
            await fetchAll()
            setSaving(false)
        } catch (err) {
            setError(err.message)
            setSaving(false)
        }
    }, [layers, entityMap, status, battery, fetchAll])

    // Switch out (clear all)
    const handleSwitchOut = useCallback(async () => {
        try {
            setSaving(true)
            await api.switchOut()
            setSelectedIds([])
            setLayers([{ name: 'Main', entityIds: [] }])
            setStatus('')
            setBattery('')
            await fetchAll()
            setSaving(false)
        } catch (err) {
            setError(err.message)
            setSaving(false)
        }
    }, [fetchAll])

    const alterLabel = useMemo(() => getAlterTerm(system, { plural: false }), [system])
    const stateLabel = useMemo(() => getStateTerm(system, { plural: false }), [system])
    const groupLabel = useMemo(() => getGroupTerm(system, { plural: false }), [system])

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
            {/* Current Front Summary */}
            {frontData && (
                <div className="switch-current-front">
                    <FrontDisplay frontData={frontData} compact={true} isOwner={true} />
                </div>
            )}

            {/* Dissociative Quick Button */}
            {showDissociativeButton && (
                <button
                    className="switch-dissociative-btn"
                    onClick={handleDissociativeSwitch}
                    disabled={saving}
                >
                    <div className="switch-dissociative-icon">
                        <Icon name="moon" size={28} />
                    </div>
                    <div className="switch-dissociative-text">
                        <span className="switch-dissociative-title">Dissociative State</span>
                        <span className="switch-dissociative-subtitle">Pull your dissociative state to front</span>
                    </div>
                </button>
            )}

            {/* Layer Panel (only for isSystem / isFragmented) */}
            {showLayers && (
                <SwitchLayerPanel
                    layers={layers}
                    selectedEntities={selectedIds.map(id => entityMap[id]).filter(Boolean)}
                    onReorderLayers={handleReorderLayers}
                    onMoveEntity={handleMoveEntity}
                    onRemoveEntity={handleRemoveEntity}
                    onRenameLayer={handleRenameLayer}
                    onAddLayer={handleAddLayer}
                    onRemoveLayer={handleRemoveLayer}
                />
            )}

            {/* Entity Grid */}
            <SwitchEntityGrid
                entities={allEntities}
                selectedIds={selectedIds}
                onToggle={handleToggleEntity}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
            />

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
                    onClick={() => { fetchAll(); setStatus(''); setBattery('') }}
                    disabled={saving}
                >
                    Cancel
                </button>
                <button
                    className="btn btn-danger"
                    onClick={handleSwitchOut}
                    disabled={saving}
                >
                    Switch Out
                </button>
                <button
                    className="btn btn-primary"
                    onClick={handleConfirmSwitch}
                    disabled={saving}
                >
                    {saving ? 'Switching...' : 'Switch'}
                </button>
            </div>
        </div>
    )
}

export default SwitchPage
