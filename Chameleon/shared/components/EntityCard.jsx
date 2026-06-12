import React from 'react'
import { Icon } from '../icons.jsx'

const DEFAULT_COLOR = '#c4b5fd'

function getDisplayName(entity, fallbackName) {
    return entity?.name?.display || entity?.name?.indexable || entity?.name || fallbackName || 'Unknown'
}

function EntityCard({ entity, type = 'alter', typeLabel, onClick, fallbackName }) {
    const color = entity?.color || DEFAULT_COLOR
    const name = getDisplayName(entity, fallbackName)
    const avatar = entity?.avatar?.url || entity?.avatar
    const pronouns = entity?.pronouns?.join?.(', ') || entity?.pronouns

    const subtitle = type === 'group'
        ? entity?.type?.name || 'Group'
        : type === 'state'
            ? `${entity?.alters?.length || 0} alter${(entity?.alters?.length || 0) !== 1 ? 's' : ''}`
            : pronouns || null

    return (
        <div
            className="entity-card"
            style={{ '--entity-color': color }}
            onClick={() => onClick?.(entity)}
            role="button"
            tabIndex={0}
        >
            <div className="entity-card-avatar">
                {avatar ? (
                    <img src={avatar} alt="" />
                ) : (
                    <span className="entity-card-avatar-fallback" style={{ backgroundColor: color }}>
                        {name.charAt(0).toUpperCase()}
                    </span>
                )}
            </div>
            <div className="entity-card-info">
                <div className="entity-card-name">{name}</div>
                {subtitle && <div className="entity-card-subtitle">{subtitle}</div>}
            </div>
            <div className="entity-card-meta">
                {type === 'alter' && entity?.proxy?.length > 0 && (
                    <span className="entity-card-badge">{entity.proxy.length} proxy</span>
                )}
                {type === 'group' && (
                    <span className="entity-card-badge">
                        {(entity?.alterIDs?.length || 0) + (entity?.stateIDs?.length || 0)} member{((entity?.alterIDs?.length || 0) + (entity?.stateIDs?.length || 0)) !== 1 ? 's' : ''}
                    </span>
                )}
            </div>
        </div>
    )
}

function EntityCardList({ entities, type = 'alter', typeLabel, onEntityClick, emptyMessage, fallbackName }) {
    const label = typeLabel || type
    if (!entities?.length) {
        return (
            <div className="empty-state">
                <span className="empty-icon">
                    <Icon name={type === 'alter' ? 'user' : type === 'state' ? 'waves' : 'package'} size={48} />
                </span>
                <h3>{emptyMessage || `No ${label}s yet`}</h3>
                <p>Create your first {label} to get started</p>
            </div>
        )
    }

    return (
        <div className="entity-list">
            {entities.map(entity => (
                <EntityCard
                    key={entity._id}
                    entity={entity}
                    type={type}
                    onClick={onEntityClick}
                    fallbackName={fallbackName}
                />
            ))}
        </div>
    )
}

export { EntityCard, EntityCardList }
