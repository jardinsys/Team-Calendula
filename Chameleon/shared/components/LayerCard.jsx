import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '../icons.jsx'

const DEFAULT_COLOR = '#c4b5fd'

const CAUTION_TYPES = [
    { value: '', label: 'None' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'crisis', label: 'Crisis' },
]

const SEARCH_MODES = [
    { key: 'add', icon: 'plus', label: 'Add' },
    { key: 'replace', icon: 'refresh', label: 'Replace' },
    { key: 'remove', icon: 'x', label: 'Remove' },
    { key: 'move', icon: 'arrowLeft', label: 'Move' },
]

function getDisplayName(entity, fallback) {
    if (!entity) return fallback || 'Unknown'
    if (typeof entity.name === 'string') return entity.name
    return entity.name?.display || entity.name?.indexable || fallback || 'Unknown'
}

function EntityShiftPopover({ entity, meta, hasShiftId, onSave, onClose }) {
    const [status, setStatus] = useState(meta?.status || '')
    const [battery, setBattery] = useState(meta?.battery != null ? String(meta.battery) : '')
    const [cautionType, setCautionType] = useState(meta?.caution?.c_type || '')
    const [cautionDetail, setCautionDetail] = useState(meta?.caution?.detail || '')
    const [applyTo, setApplyTo] = useState(meta?.applyTo || 'shift')
    const [saving, setSaving] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                onClose()
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [onClose])

    const handleSave = () => {
        const data = {}
        if (status) data.status = status
        if (battery !== '') data.battery = Number(battery)
        if (cautionType) {
            data.caution = { c_type: cautionType, detail: cautionDetail || '' }
        }
        if (hasShiftId) data.applyTo = applyTo
        onSave(data)
        onClose()
    }

    const name = getDisplayName(entity, '?')
    const color = entity?.color || DEFAULT_COLOR

    return (
        <div ref={ref} className="fronter-edit-popover">
            <div className="fronter-edit-popover-header">
                <div
                    className="fronter-avatar"
                    style={{
                        width: 28, height: 28, borderRadius: '50%', overflow: 'hidden',
                        flexShrink: 0, backgroundColor: color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 11, fontFamily: 'var(--font-accent)', fontWeight: 700,
                    }}
                >
                    {entity?.avatar?.url ? (
                        <img src={entity.avatar.url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                        name.charAt(0).toUpperCase()
                    )}
                </div>
                <span className="fronter-edit-popover-name">{name}</span>
            </div>

            <div className="fronter-edit-popover-field">
                <label className="fronter-edit-label">Status</label>
                <input
                    className="text-input fronter-edit-input"
                    type="text"
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    placeholder="Status message..."
                    maxLength={100}
                />
            </div>

            <div className="fronter-edit-popover-field">
                <label className="fronter-edit-label">Battery</label>
                <div className="fronter-edit-battery">
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={battery !== '' ? Number(battery) : 0}
                        onChange={e => setBattery(e.target.value)}
                        className="fronter-edit-slider"
                    />
                    <input
                        className="text-input fronter-edit-input fronter-edit-battery-input"
                        type="number"
                        min="0"
                        max="100"
                        value={battery}
                        onChange={e => setBattery(e.target.value)}
                        placeholder="0-100"
                    />
                    <span className="fronter-edit-battery-unit">%</span>
                </div>
            </div>

            <div className="fronter-edit-popover-field">
                <label className="fronter-edit-label">Caution</label>
                <select
                    className="text-input fronter-edit-input"
                    value={cautionType}
                    onChange={e => setCautionType(e.target.value)}
                >
                    {CAUTION_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                </select>
                {cautionType && (
                    <input
                        className="text-input fronter-edit-input"
                        type="text"
                        value={cautionDetail}
                        onChange={e => setCautionDetail(e.target.value)}
                        placeholder="Details (optional)"
                        style={{ marginTop: '6px' }}
                    />
                )}
            </div>

            {hasShiftId && (
                <div className="fronter-edit-popover-field">
                    <label className="fronter-edit-label">Apply to</label>
                    <div className="fronter-edit-apply-to">
                        {[
                            { value: 'shift', label: 'This shift only' },
                            { value: 'preset', label: 'Entity preset' },
                            { value: 'both', label: 'Both' },
                        ].map(opt => (
                            <button
                                key={opt.value}
                                className={`fronter-edit-apply-btn${applyTo === opt.value ? ' fronter-edit-apply-btn--active' : ''}`}
                                onClick={() => setApplyTo(opt.value)}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="fronter-edit-popover-actions">
                <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
                    Cancel
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    Save
                </button>
            </div>
        </div>
    )
}

function LayerCard({
    layer,
    layerIndex,
    allEntities,
    entityMap,
    entityMeta,
    onAddEntity,
    onRemoveEntity,
    onReplaceEntity,
    onReplaceAll,
    onMoveEntity,
    onRename,
    onDelete,
    layerCount,
    allLayers,
    editingEntityId,
    onEntityClick,
    onEditEntityClose,
    onEditEntitySave,
}) {
    const [searchQuery, setSearchQuery] = useState('')
    const [searchMode, setSearchMode] = useState('add')
    const [replaceTarget, setReplaceTarget] = useState(null)
    const [moveTarget, setMoveTarget] = useState(null)
    const [editingName, setEditingName] = useState(false)
    const [nameInput, setNameInput] = useState(layer.name)

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

    const entities = useMemo(() =>
        (layer.entityIds || []).map(id => entityMap?.[id]).filter(Boolean),
        [layer.entityIds, entityMap]
    )

    const filteredSearch = useMemo(() => {
        if (!searchQuery) return []
        const q = searchQuery.toLowerCase()
        let list = allEntities || []
        if (searchMode === 'replace' && replaceTarget) {
            list = list.filter(e => e._id !== replaceTarget)
        }
        return list.filter(e => {
            const name = getDisplayName(e, '').toLowerCase()
            const pronouns = (e.pronouns?.join?.(', ') || e.pronouns || '').toLowerCase()
            return name.includes(q) || pronouns.includes(q)
        }).slice(0, 20)
    }, [allEntities, searchQuery, searchMode, replaceTarget])

    const handleNameSubmit = () => {
        const trimmed = nameInput.trim()
        if (trimmed && trimmed !== layer.name) {
            onRename?.(layerIndex, trimmed)
        } else {
            setNameInput(layer.name)
        }
        setEditingName(false)
    }

    const handleNameKeyDown = (e) => {
        if (e.key === 'Enter') handleNameSubmit()
        if (e.key === 'Escape') {
            setNameInput(layer.name)
            setEditingName(false)
        }
    }

    const handleEntityResultClick = (entity) => {
        if (searchMode === 'add') {
            onAddEntity?.(entity._id, entity._entityType)
            setSearchQuery('')
        } else if (searchMode === 'replace' && replaceTarget) {
            onReplaceEntity?.(replaceTarget, entity._id)
            setReplaceTarget(null)
            setSearchQuery('')
        }
    }

    const handleChipClick = (entity) => {
        if (searchMode === 'remove') {
            onRemoveEntity?.(entity._id, layerIndex)
        } else if (searchMode === 'replace') {
            setReplaceTarget(entity._id)
            setSearchQuery('')
        } else if (searchMode === 'move') {
            setMoveTarget(entity._id)
        } else {
            onEntityClick?.(entity, layerIndex)
        }
    }

    const handleMoveToLayer = (toIndex) => {
        if (moveTarget && toIndex !== layerIndex) {
            onMoveEntity?.(moveTarget, layerIndex, toIndex)
        }
        setMoveTarget(null)
    }

    const handleReplaceAll = () => {
        onReplaceAll?.(layerIndex)
        setReplaceTarget(null)
        setSearchQuery('')
    }

    return (
        <div ref={setNodeRef} style={style} className="layer-card">
            <div className="layer-card-header">
                <div className="layer-card-drag-handle" {...attributes} {...listeners}>
                    <Icon name="gripVertical" size={16} />
                </div>

                <div className="layer-card-info">
                    {editingName ? (
                        <input
                            type="text"
                            className="text-input layer-card-name-input"
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            onBlur={handleNameSubmit}
                            onKeyDown={handleNameKeyDown}
                            autoFocus
                        />
                    ) : (
                        <span
                            className="layer-card-name"
                            onClick={() => setEditingName(true)}
                            title="Click to rename"
                        >
                            {layer.name || `Layer ${layerIndex + 1}`}
                        </span>
                    )}
                    <span className="layer-card-count">{entities.length}</span>
                </div>

                {layerCount > 1 && (
                    <button
                        className="btn-ghost layer-card-delete-btn"
                        onClick={() => onDelete?.(layerIndex)}
                        title="Remove layer"
                    >
                        <Icon name="trash" size={14} />
                    </button>
                )}
            </div>

            <div className="layer-card-body">
                {/* Current entities — always visible */}
                {entities.length > 0 && (
                    <div className="layer-card-chips">
                        {entities.map(entity => {
                            const hasMeta = entityMeta?.[entity._id] &&
                                (entityMeta[entity._id].status || entityMeta[entity._id].battery != null || entityMeta[entity._id].caution)
                            const color = entity.color || DEFAULT_COLOR
                            return (
                                <div key={entity._id} className="layer-card-chip-wrapper" style={{ position: 'relative' }}>
                                    <button
                                        className={`layer-card-chip ${hasMeta ? 'layer-card-chip--has-meta' : ''} ${searchMode === 'replace' && replaceTarget === entity._id ? 'layer-card-chip--selected' : ''} ${searchMode === 'move' && moveTarget === entity._id ? 'layer-card-chip--selected' : ''}`}
                                        style={{ '--chip-color': color }}
                                        onClick={() => handleChipClick(entity)}
                                    >
                                        <span className="layer-card-chip-color" style={{ backgroundColor: color }} />
                                        <span className="layer-card-chip-name">{getDisplayName(entity)}</span>
                                        {searchMode === 'remove' && (
                                            <span className="layer-card-chip-action">
                                                <Icon name="x" size={12} color="var(--color-error)" />
                                            </span>
                                        )}
                                    </button>
                                    {editingEntityId === entity._id && (
                                        <EntityShiftPopover
                                            entity={entity}
                                            meta={entityMeta?.[entity._id]}
                                            hasShiftId={!!entity.shiftId}
                                            onSave={(data) => onEditEntitySave?.(entity._id, data)}
                                            onClose={onEditEntityClose}
                                        />
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}

                {entities.length === 0 && !searchQuery && (
                    <div className="layer-card-empty">
                        Search below to add entities
                    </div>
                )}

                {/* Search bar */}
                <div className="layer-card-search">
                    <input
                        type="text"
                        className="text-input layer-card-search-input"
                        placeholder={
                            searchMode === 'add' ? 'Search to add...' :
                            searchMode === 'replace' ? (replaceTarget ? 'Search replacement...' : 'Click entity to replace...') :
                            searchMode === 'move' ? (moveTarget ? 'Pick target layer below...' : 'Click entity to move...') :
                            'Click entity to remove...'
                        }
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        disabled={searchMode === 'remove' || (searchMode === 'move' && !moveTarget) || (searchMode === 'replace' && !replaceTarget)}
                    />
                    <div className="layer-mode-toggle">
                        {SEARCH_MODES.map(mode => (
                            <button
                                key={mode.key}
                                className={`layer-mode-btn ${searchMode === mode.key ? 'layer-mode-btn--active' : ''}`}
                                onClick={() => {
                                    setSearchMode(mode.key)
                                    setReplaceTarget(null)
                                    setMoveTarget(null)
                                    setSearchQuery('')
                                }}
                                title={mode.label}
                            >
                                <Icon name={mode.icon} size={14} />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Replace All button */}
                {searchMode === 'replace' && entities.length > 0 && (
                    <button className="layer-replace-all-btn" onClick={handleReplaceAll}>
                        <Icon name="refresh" size={14} /> Replace All
                    </button>
                )}

                {/* Move target picker */}
                {searchMode === 'move' && moveTarget && (
                    <div className="layer-move-picker">
                        {allLayers.map((l, i) => (
                            <button
                                key={i}
                                className={`layer-move-target-btn ${i === layerIndex ? 'layer-move-target-btn--disabled' : ''}`}
                                onClick={() => handleMoveToLayer(i)}
                                disabled={i === layerIndex}
                            >
                                {l.name || `Layer ${i + 1}`}
                            </button>
                        ))}
                    </div>
                )}

                {/* Search results */}
                {searchQuery && filteredSearch.length > 0 && (
                    <div className="layer-card-results">
                        {filteredSearch.map(entity => {
                            const color = entity.color || DEFAULT_COLOR
                            return (
                                <button
                                    key={entity._id}
                                    className="layer-card-result"
                                    onClick={() => handleEntityResultClick(entity)}
                                >
                                    <div
                                        className="layer-card-result-avatar"
                                        style={{ backgroundColor: color }}
                                    >
                                        {entity.avatar?.url ? (
                                            <img src={entity.avatar.url} alt="" />
                                        ) : (
                                            <span>{getDisplayName(entity, '?').charAt(0).toUpperCase()}</span>
                                        )}
                                    </div>
                                    <div className="layer-card-result-info">
                                        <span className="layer-card-result-name">{getDisplayName(entity)}</span>
                                        <span className="layer-card-result-type">{entity._entityType}</span>
                                    </div>
                                    <Icon name="plus" size={14} color="var(--accent)" />
                                </button>
                            )
                        })}
                    </div>
                )}

                {searchQuery && filteredSearch.length === 0 && (
                    <div className="layer-card-empty">
                        No entities match your search
                    </div>
                )}
            </div>
        </div>
    )
}

export { LayerCard }
