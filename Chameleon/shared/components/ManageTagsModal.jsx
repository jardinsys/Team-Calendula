import React, { useState } from 'react'

function ManageTagsModal({ tags = [], notes = [], onRename, onDelete, onClose }) {
    const [search, setSearch] = useState('')
    const [renaming, setRenaming] = useState(null)
    const [renameValue, setRenameValue] = useState('')
    const [confirmDelete, setConfirmDelete] = useState(null)

    const tagCounts = {}
    for (const note of notes) {
        for (const tag of note.tags || []) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1
        }
    }

    const filtered = tags.filter(t =>
        t.toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => (tagCounts[b] || 0) - (tagCounts[a] || 0))

    const startRename = (tag) => {
        setRenaming(tag)
        setRenameValue(tag)
    }

    const handleRename = () => {
        if (renaming && renameValue.trim() && renameValue.trim() !== renaming) {
            onRename?.(renaming, renameValue.trim())
        }
        setRenaming(null)
        setRenameValue('')
    }

    const handleDelete = (tag) => {
        onDelete?.(tag)
        setConfirmDelete(null)
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <button className="btn-ghost" onClick={onClose}>← Back</button>
                    <h2 className="modal-title">Manage Tags</h2>
                    <div style={{ width: '60px' }} />
                </div>

                <input
                    className="text-input"
                    type="text"
                    placeholder="Search tags..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    autoFocus
                />

                <div className="manage-tags-list">
                    {filtered.length === 0 ? (
                        <div className="empty-state" style={{ padding: '24px 0' }}>
                            <p>{tags.length === 0 ? 'No tags yet' : 'No tags match your search'}</p>
                        </div>
                    ) : (
                        filtered.map(tag => (
                            <div key={tag} className="manage-tag-row">
                                {renaming === tag ? (
                                    <div className="manage-tag-rename">
                                        <input
                                            className="text-input"
                                            type="text"
                                            value={renameValue}
                                            onChange={e => setRenameValue(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleRename()
                                                if (e.key === 'Escape') setRenaming(null)
                                            }}
                                            autoFocus
                                        />
                                        <button className="btn btn-primary btn-sm" onClick={handleRename}>Save</button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => setRenaming(null)}>Cancel</button>
                                    </div>
                                ) : (
                                    <>
                                        <span className="manage-tag-name">#{tag}</span>
                                        <span className="manage-tag-count">{tagCounts[tag] || 0} notes</span>
                                        <div className="manage-tag-actions">
                                            <button className="btn btn-ghost btn-sm" onClick={() => startRename(tag)}>Rename</button>
                                            {confirmDelete === tag ? (
                                                <>
                                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(tag)}>Delete</button>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
                                                </>
                                            ) : (
                                                <button className="btn btn-ghost btn-sm btn-danger-text" onClick={() => setConfirmDelete(tag)}>Delete</button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

export { ManageTagsModal }
export default ManageTagsModal