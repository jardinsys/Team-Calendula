import React, { useState } from 'react'

function TagFilterBar({ tags = [], selectedTags = [], onToggleTag, onClearTags, onManageTags, filter = 'all', onFilterChange }) {
    const [expanded, setExpanded] = useState(false)

    return (
        <div className="tag-filter-bar">
            <div className="tag-filter-row">
                <div className="tag-filter-pills">
                    <button
                        type="button"
                        className={`filter-pill ${filter === 'all' && selectedTags.length === 0 ? 'active' : ''}`}
                        onClick={() => { onFilterChange?.('all'); onClearTags?.() }}
                    >
                        All
                    </button>
                    <button
                        type="button"
                        className={`filter-pill ${filter === 'owned' ? 'active' : ''}`}
                        onClick={() => { onFilterChange?.('owned'); onClearTags?.() }}
                    >
                        Owned
                    </button>
                    <button
                        type="button"
                        className={`filter-pill ${filter === 'shared' ? 'active' : ''}`}
                        onClick={() => { onFilterChange?.('shared'); onClearTags?.() }}
                    >
                        Shared
                    </button>
                </div>

                {tags.length > 0 && (
                    <>
                        <span className="filter-divider" />
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setExpanded(!expanded)}
                        >
                            {expanded ? 'Hide Tags' : 'Tags'}
                            {selectedTags.length > 0 && (
                                <span className="badge">{selectedTags.length}</span>
                            )}
                        </button>
                    </>
                )}

                {onManageTags && (
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={onManageTags}
                    >
                        Manage
                    </button>
                )}
            </div>

            {expanded && tags.length > 0 && (
                <div className="tag-filter-chips">
                    {selectedTags.length > 0 && (
                        <button
                            type="button"
                            className="filter-chip clear"
                            onClick={onClearTags}
                        >
                            Clear ×
                        </button>
                    )}
                    {tags.map(tag => (
                        <button
                            key={tag}
                            type="button"
                            className={`filter-chip ${selectedTags.includes(tag) ? 'active' : ''}`}
                            onClick={() => onToggleTag?.(tag)}
                        >
                            #{tag}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export { TagFilterBar }
export default TagFilterBar