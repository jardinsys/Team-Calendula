import React, { useState, useMemo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '../icons.jsx'

const DEFAULT_COLOR = '#c4b5fd'

function getDisplayName(entity, fallbackName) {
    return entity?.name?.display || entity?.name?.indexable || entity?.name || fallbackName || 'Unknown'
}

function SwitchEntityCard({ entity, type, selected, onToggle, fallbackName, isDragging, dragListeners, dragAttributes }) {
    const color = entity?.color || DEFAULT_COLOR
    const name = getDisplayName(entity, fallbackName)
    const avatar = entity?.avatar?.url || entity?.avatar
    const isSelected = selected

    const style = {
        '--entity-color': color,
        opacity: isDragging ? 0.5 : 1,
        transform: CSS.Transform?.toString?.(dragAttributes?.transform) || undefined,
        zIndex: isDragging ? 999 : undefined,
    }

    return (
        <div
            className={`switch-entity-card ${isSelected ? 'selected' : ''}`}
            style={style}
            onClick={() => onToggle?.(entity)}
            role="button"
            tabIndex={0}
        >
            {dragListeners && (
                <div className="switch-entity-drag-handle" {...dragListeners} {...dragAttributes}>
                    <Icon name="gripVertical" size={14} />
                </div>
            )}
            <div className="switch-entity-avatar">
                {avatar ? (
                    <img src={avatar} alt="" />
                ) : (
                    <span className="switch-entity-avatar-fallback" style={{ backgroundColor: color }}>
                        {name.charAt(0).toUpperCase()}
                    </span>
                )}
            </div>
            <div className="switch-entity-info">
                <div className="switch-entity-name">{name}</div>
                {type && <div className="switch-entity-type">{type}</div>}
            </div>
            <div className="switch-entity-check">
                {isSelected && <Icon name="check" size={16} color="var(--color-success)" />}
            </div>
        </div>
    )
}

function SortableSwitchEntityCard({ entity, type, selected, onToggle, fallbackName }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: `entity-${entity._id}` })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    return (
        <div ref={setNodeRef} style={style}>
            <SwitchEntityCard
                entity={entity}
                type={type}
                selected={selected}
                onToggle={onToggle}
                fallbackName={fallbackName}
                isDragging={isDragging}
                dragListeners={listeners}
                dragAttributes={attributes}
            />
        </div>
    )
}

function SwitchEntityGrid({ entities, selectedIds = [], onToggle, searchQuery = '', onSearchChange, fallbackName, enableDrag = false }) {
    const [activeTab, setActiveTab] = useState('all')

    const filtered = useMemo(() => {
        let list = entities || []
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            list = list.filter(e => {
                const name = getDisplayName(e, '').toLowerCase()
                const pronouns = (e.pronouns?.join?.(', ') || e.pronouns || '').toLowerCase()
                return name.includes(q) || pronouns.includes(q)
            })
        }
        if (activeTab !== 'all') {
            list = list.filter(e => e._entityType === activeTab)
        }
        return list
    }, [entities, searchQuery, activeTab])

    const selectedCount = selectedIds?.length || 0

    return (
        <div className="switch-entity-grid">
            <div className="switch-entity-grid-header">
                <div className="section-header">
                    <h3 className="section-title">Select Entities</h3>
                    {selectedCount > 0 && (
                        <span className="section-count">{selectedCount} selected</span>
                    )}
                </div>
                <div className="switch-entity-search">
                    <Icon name="inbox" size={16} color="var(--text-muted)" />
                    <input
                        type="text"
                        placeholder="Search entities..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange?.(e.target.value)}
                        className="text-input switch-search-input"
                    />
                    {searchQuery && (
                        <button
                            className="btn-ghost"
                            onClick={() => onSearchChange?.('')}
                            style={{ padding: '4px' }}
                        >
                            <Icon name="x" size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div className="switch-entity-tabs">
                {['all', 'alter', 'state', 'group'].map(tab => {
                    const count = tab === 'all'
                        ? (entities?.length || 0)
                        : (entities?.filter(e => e._entityType === tab)?.length || 0)
                    if (tab !== 'all' && count === 0) return null
                    return (
                        <button
                            key={tab}
                            className={`filter-pill ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}s
                            <span className="switch-tab-count">{count}</span>
                        </button>
                    )
                })}
            </div>

            <div className="switch-entity-list">
                {filtered.length === 0 ? (
                    <div className="empty-state" style={{ padding: 'var(--space-lg)' }}>
                        <Icon name="inbox" size={32} color="var(--text-muted)" />
                        <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-sm)' }}>
                            {searchQuery ? 'No entities match your search' : 'No entities available'}
                        </p>
                    </div>
                ) : (
                    filtered.map(entity => {
                        const isSelected = selectedIds?.includes(entity._id)
                        if (enableDrag) {
                            return (
                                <SortableSwitchEntityCard
                                    key={entity._id}
                                    entity={entity}
                                    type={entity._entityType}
                                    selected={isSelected}
                                    onToggle={onToggle}
                                    fallbackName={fallbackName}
                                />
                            )
                        }
                        return (
                            <SwitchEntityCard
                                key={entity._id}
                                entity={entity}
                                type={entity._entityType}
                                selected={isSelected}
                                onToggle={onToggle}
                                fallbackName={fallbackName}
                            />
                        )
                    })
                )}
            </div>
        </div>
    )
}

export { SwitchEntityGrid, SwitchEntityCard }
