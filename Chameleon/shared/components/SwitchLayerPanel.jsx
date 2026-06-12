import React, { useState } from 'react'
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
    useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '../icons.jsx'

const DEFAULT_COLOR = '#c4b5fd'

function getDisplayName(entity) {
    return entity?.name?.display || entity?.name?.indexable || entity?.name || 'Unknown'
}

function EntityChip({ entity, onRemove, isDragging, dragListeners, dragAttributes }) {
    const color = entity?.color || DEFAULT_COLOR
    const name = getDisplayName(entity)

    const style = {
        '--chip-color': color,
        opacity: isDragging ? 0.5 : 1,
    }

    return (
        <div className="switch-layer-chip" style={style}>
            {dragListeners && (
                <span className="switch-layer-chip-drag" {...dragListeners} {...dragAttributes}>
                    <Icon name="gripVertical" size={12} />
                </span>
            )}
            <span className="switch-layer-chip-color" style={{ backgroundColor: color }} />
            <span className="switch-layer-chip-name">{name}</span>
            {onRemove && (
                <button
                    className="switch-layer-chip-remove"
                    onClick={(e) => { e.stopPropagation(); onRemove(entity) }}
                >
                    <Icon name="x" size={12} />
                </button>
            )}
        </div>
    )
}

function SortableEntityChip({ entity, onRemove }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: `chip-${entity._id}` })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    return (
        <div ref={setNodeRef} style={style} className="switch-layer-chip-wrapper">
            <EntityChip
                entity={entity}
                onRemove={onRemove}
                isDragging={isDragging}
                dragListeners={listeners}
                dragAttributes={attributes}
            />
        </div>
    )
}

function LayerCard({ layer, layerIndex, onRemoveEntity, onRename, onRemoveLayer, canRemoveLayer, entityMap }) {
    const [editing, setEditing] = useState(false)
    const [nameValue, setNameValue] = useState(layer.name)

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: `layer-${layerIndex}` })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }

    const handleNameSubmit = () => {
        const trimmed = nameValue.trim()
        if (trimmed && trimmed !== layer.name) {
            onRename?.(layerIndex, trimmed)
        } else {
            setNameValue(layer.name)
        }
        setEditing(false)
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleNameSubmit()
        if (e.key === 'Escape') {
            setNameValue(layer.name)
            setEditing(false)
        }
    }

    const entities = (layer.entityIds || [])
        .map(id => entityMap?.[id])
        .filter(Boolean)

    return (
        <div ref={setNodeRef} style={style} className="switch-layer-card">
            <div className="switch-layer-header">
                <div className="switch-layer-drag-handle" {...attributes} {...listeners}>
                    <Icon name="gripVertical" size={16} />
                </div>
                <div className="switch-layer-info">
                    {editing ? (
                        <input
                            type="text"
                            className="text-input switch-layer-name-input"
                            value={nameValue}
                            onChange={(e) => setNameValue(e.target.value)}
                            onBlur={handleNameSubmit}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                    ) : (
                        <span
                            className="switch-layer-name"
                            onClick={() => setEditing(true)}
                            title="Click to rename"
                        >
                            {layer.name || `Layer ${layerIndex + 1}`}
                        </span>
                    )}
                    <span className="switch-layer-count">{entities.length}</span>
                </div>
                {canRemoveLayer && (
                    <button
                        className="btn-ghost switch-layer-remove-btn"
                        onClick={() => onRemoveLayer?.(layerIndex)}
                        title="Remove layer"
                    >
                        <Icon name="trash" size={14} />
                    </button>
                )}
            </div>

            <div className="switch-layer-body">
                {entities.length === 0 ? (
                    <div className="switch-layer-empty">
                        Drag entities here or click entities to add
                    </div>
                ) : (
                    <SortableContext items={entities.map(e => `chip-${e._id}`)} strategy={verticalListSortingStrategy}>
                        <div className="switch-layer-chips">
                            {entities.map(entity => (
                                <SortableEntityChip
                                    key={entity._id}
                                    entity={entity}
                                    onRemove={(ent) => onRemoveEntity?.(ent, layerIndex)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                )}
            </div>
        </div>
    )
}

function SwitchLayerPanel({
    layers = [],
    selectedEntities = [],
    onReorderLayers,
    onMoveEntity,
    onRemoveEntity,
    onRenameLayer,
    onAddLayer,
    onRemoveLayer,
}) {
    const [activeId, setActiveId] = useState(null)

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        })
    )

    const entityMap = {}
    for (const ent of selectedEntities) {
        entityMap[ent._id] = ent
    }

    const handleDragStart = (event) => {
        setActiveId(event.active.id)
    }

    const handleDragEnd = (event) => {
        const { active, over } = event
        setActiveId(null)

        if (!over) return

        const activeId = active.id
        const overId = over.id

        // Layer reorder
        if (typeof activeId === 'string' && activeId.startsWith('layer-') &&
            typeof overId === 'string' && overId.startsWith('layer-')) {
            const fromIndex = parseInt(activeId.replace('layer-', ''))
            const toIndex = parseInt(overId.replace('layer-', ''))
            if (fromIndex !== toIndex) {
                const reordered = [...layers]
                const [moved] = reordered.splice(fromIndex, 1)
                reordered.splice(toIndex, 0, moved)
                onReorderLayers?.(reordered)
            }
            return
        }

        // Entity move between layers
        if (typeof activeId === 'string' && activeId.startsWith('chip-') &&
            typeof overId === 'string' && overId.startsWith('layer-')) {
            const entityId = activeId.replace('chip-', '')
            const toLayerIndex = parseInt(overId.replace('layer-', ''))

            // Find which layer the entity is currently in
            const fromLayerIndex = layers.findIndex(l =>
                l.entityIds?.includes(entityId)
            )

            if (fromLayerIndex !== -1 && fromLayerIndex !== toLayerIndex) {
                onMoveEntity?.(entityId, fromLayerIndex, toLayerIndex)
            } else if (fromLayerIndex === -1) {
                // Entity not in any layer — add to target
                onMoveEntity?.(entityId, -1, toLayerIndex)
            }
            return
        }

        // Entity reorder within same layer (chip on chip)
        if (typeof activeId === 'string' && activeId.startsWith('chip-') &&
            typeof overId === 'string' && overId.startsWith('chip-')) {
            const activeEntityId = activeId.replace('chip-', '')
            const overEntityId = overId.replace('chip-', '')

            // Find both layers
            const fromLayerIndex = layers.findIndex(l => l.entityIds?.includes(activeEntityId))
            const toLayerIndex = layers.findIndex(l => l.entityIds?.includes(overEntityId))

            if (fromLayerIndex === toLayerIndex && fromLayerIndex !== -1) {
                // Reorder within same layer
                const layer = layers[fromLayerIndex]
                const fromIdx = layer.entityIds.indexOf(activeEntityId)
                const toIdx = layer.entityIds.indexOf(overEntityId)
                if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
                    const newIds = [...layer.entityIds]
                    newIds.splice(fromIdx, 1)
                    newIds.splice(toIdx, 0, activeEntityId)
                    const newLayers = [...layers]
                    newLayers[fromLayerIndex] = { ...layer, entityIds: newIds }
                    onReorderLayers?.(newLayers)
                }
            } else if (fromLayerIndex !== -1 && toLayerIndex !== -1) {
                // Move between layers
                onMoveEntity?.(activeEntityId, fromLayerIndex, toLayerIndex)
            }
        }
    }

    const handleDragOver = (event) => {
        const { active, over } = event
        if (!over) return

        const activeId = active.id
        const overId = over.id

        // If dragging a chip over a layer that doesn't contain it, add it
        if (typeof activeId === 'string' && activeId.startsWith('chip-') &&
            typeof overId === 'string' && overId.startsWith('layer-')) {
            const entityId = activeId.replace('chip-', '')
            const toLayerIndex = parseInt(overId.replace('layer-', ''))

            const isInAnyLayer = layers.some(l => l.entityIds?.includes(entityId))
            if (!isInAnyLayer) {
                onMoveEntity?.(entityId, -1, toLayerIndex)
            }
        }
    }

    return (
        <div className="switch-layer-panel">
            <div className="section-header">
                <h3 className="section-title">Layers</h3>
                <span className="section-count">{layers.length}</span>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
            >
                <SortableContext items={layers.map((_, i) => `layer-${i}`)} strategy={verticalListSortingStrategy}>
                    <div className="switch-layer-list">
                        {layers.map((layer, index) => (
                            <LayerCard
                                key={`layer-${index}`}
                                layer={layer}
                                layerIndex={index}
                                onRemoveEntity={onRemoveEntity}
                                onRename={onRenameLayer}
                                onRemoveLayer={onRemoveLayer}
                                canRemoveLayer={layers.length > 1}
                                entityMap={entityMap}
                            />
                        ))}
                    </div>
                </SortableContext>

                <DragOverlay>
                    {activeId ? (
                        <div className="switch-layer-drag-overlay">
                            {(() => {
                                if (typeof activeId === 'string' && activeId.startsWith('chip-')) {
                                    const entityId = activeId.replace('chip-', '')
                                    const entity = entityMap[entityId]
                                    if (entity) return <EntityChip entity={entity} />
                                }
                                if (typeof activeId === 'string' && activeId.startsWith('layer-')) {
                                    const idx = parseInt(activeId.replace('layer-', ''))
                                    return <div className="switch-layer-drag-label">{layers[idx]?.name || `Layer ${idx + 1}`}</div>
                                }
                                return null
                            })()}
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            <button className="switch-add-layer-btn" onClick={onAddLayer}>
                <Icon name="plus" size={16} />
                Add Layer
            </button>
        </div>
    )
}

export { SwitchLayerPanel }
