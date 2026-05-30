import React, { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import api from '../api/client.js'

const DEFAULT_NOTE_COLOR = '#8b5cf6'
const NOTE_COLORS = [
    '#8b5cf6', '#ED4245', '#E67E22', '#F1C40F',
    '#57F287', '#3498DB', '#9B59B6', '#EB459E', '#95A5A6'
]

function NoteModal({ note, onClose, onUpdated, onDeleted }) {
    const [fullNote, setFullNote] = useState(null)
    const [contentText, setContentText] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [editMode, setEditMode] = useState(false)

    const [editTitle, setEditTitle] = useState('')
    const [editContent, setEditContent] = useState('')
    const [editTagsInput, setEditTagsInput] = useState('')
    const [editColor, setEditColor] = useState(DEFAULT_NOTE_COLOR)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    useEffect(() => {
        let cancelled = false
        async function fetchNote() {
            try {
                const data = await api.getNote(note._id)
                if (!cancelled) {
                    setFullNote(data)

                    let fetchedContent = data.contentPreview || ''
                    if (data.content?.url) {
                        try {
                            const res = await fetch(data.content.url)
                            fetchedContent = await res.text()
                        } catch {
                            fetchedContent = data.contentPreview || ''
                        }
                    }
                    if (!cancelled) {
                        setContentText(fetchedContent)
                        setEditTitle(data.title || '')
                        setEditContent(fetchedContent)
                        setEditTagsInput((data.tags || []).join(', '))
                        setEditColor(data.color || DEFAULT_NOTE_COLOR)
                        setLoading(false)
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err.message)
                    setLoading(false)
                }
            }
        }
        fetchNote()
        return () => { cancelled = true }
    }, [note._id])

    const handleClose = () => {
        setEditMode(false)
        setShowDeleteConfirm(false)
        onClose?.()
    }

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) handleClose()
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const tags = editTagsInput
                .split(',')
                .map(t => t.trim())
                .filter(Boolean)

            await api.updateNote(note._id, {
                title: editTitle.trim() || undefined,
                content: editContent,
                tags,
                color: editColor === DEFAULT_NOTE_COLOR ? undefined : editColor
            })

            setEditMode(false)
            onUpdated?.()
        } catch (err) {
            setError(err.message)
        }
        setSaving(false)
    }

    const handleDelete = async () => {
        setDeleting(true)
        try {
            await api.deleteNote(note._id)
            onDeleted?.()
            onClose?.()
        } catch (err) {
            setError(err.message)
            setDeleting(false)
        }
    }

    if (loading) {
        return (
            <div className="modal-overlay" onClick={handleBackdropClick}>
                <div className="modal-content">
                    <div className="status-screen" style={{ minHeight: '200px' }}>
                        <div className="spinner" />
                        <p>Loading note...</p>
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="modal-overlay" onClick={handleBackdropClick}>
                <div className="modal-content">
                    <div className="modal-header">
                        <button className="btn-ghost" onClick={handleClose}>← Back</button>
                    </div>
                    <p style={{ color: 'var(--color-error)' }}>{error}</p>
                </div>
            </div>
        )
    }

    const displayNote = fullNote || note
    const noteColor = displayNote.color || DEFAULT_NOTE_COLOR

    if (showDeleteConfirm) {
        return (
            <div className="modal-overlay" onClick={handleBackdropClick}>
                <div className="modal-content">
                    <div className="modal-header">
                        <button className="btn-ghost" onClick={() => setShowDeleteConfirm(false)}>← Back</button>
                        <h2 className="modal-title">Delete Note</h2>
                        <div style={{ width: '60px' }} />
                    </div>
                    <p style={{ marginBottom: '24px' }}>
                        Are you sure you want to delete <strong>{displayNote.title || 'this note'}</strong>? This cannot be undone.
                    </p>
                    <div className="modal-actions">
                        <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                            Cancel
                        </button>
                        <button className="btn btn-primary" style={{ backgroundColor: 'var(--color-error)' }} onClick={handleDelete} disabled={deleting}>
                            {deleting ? 'Deleting...' : 'Delete'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (editMode) {
        return (
            <div className="modal-overlay" onClick={handleBackdropClick}>
                <div className="modal-content">
                    <div className="modal-header">
                        <button className="btn-ghost" onClick={() => setEditMode(false)}>← Back</button>
                        <h2 className="modal-title">Edit Note</h2>
                        <div style={{ width: '60px' }} />
                    </div>

                    <div className="form-group">
                        <label>Title</label>
                        <input
                            className="text-input"
                            type="text"
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            placeholder="Note title"
                            maxLength={100}
                        />
                    </div>

                    <div className="form-group">
                        <label>Content</label>
                        <textarea
                            className="text-input"
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            rows={8}
                        />
                    </div>

                    <div className="form-group">
                        <label>Tags (comma-separated)</label>
                        <input
                            className="text-input"
                            type="text"
                            value={editTagsInput}
                            onChange={e => setEditTagsInput(e.target.value)}
                            placeholder="tag1, tag2"
                        />
                    </div>

                    <div className="form-group">
                        <label>Color</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {NOTE_COLORS.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setEditColor(color)}
                                    style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        backgroundColor: color,
                                        border: editColor === color ? '2px solid white' : '2px solid transparent',
                                        cursor: 'pointer'
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    {error && (
                        <p style={{ color: 'var(--color-error)', fontSize: '0.8rem', marginBottom: '12px' }}>
                            {error}
                        </p>
                    )}

                    <div className="modal-actions">
                        <button className="btn btn-secondary" onClick={() => setEditMode(false)}>
                            Cancel
                        </button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="modal-overlay" onClick={handleBackdropClick}>
            <div className="modal-content" style={{ borderTop: `4px solid ${noteColor}` }}>
                <div className="modal-header">
                    <button className="btn-ghost" onClick={handleClose}>← Back</button>
                    <div className="modal-actions">
                        <button className="btn-icon" title="Edit" onClick={() => setEditMode(true)}>✏️</button>
                        <button className="btn-icon" title="Delete" onClick={() => setShowDeleteConfirm(true)}>🗑️</button>
                    </div>
                </div>

                <h2 className="modal-title" style={{ color: noteColor }}>
                    {displayNote.title || 'Untitled'}
                </h2>

                {displayNote.tags?.length > 0 && (
                    <div className="note-card-tags" style={{ marginTop: '8px', marginBottom: '16px' }}>
                        {displayNote.tags.map(tag => (
                            <span key={tag} className="note-card-tag">{tag}</span>
                        ))}
                    </div>
                )}

                <div className="modal-body">
                    {displayNote.media?.map((item, i) => (
                        item.media?.url && (
                            <img
                                key={i}
                                src={item.media.url}
                                alt={item.caption || ''}
                                style={{ width: '100%', borderRadius: 'var(--radius)', marginBottom: '12px' }}
                            />
                        )
                    ))}

                    <div className="markdown-body">
                        {contentText ? (
                            <ReactMarkdown>{contentText}</ReactMarkdown>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                No content
                            </p>
                        )}
                    </div>
                </div>

                <div className="modal-actions">
                    <span className="note-card-meta">
                        {displayNote.pinned && '📌 '}{new Date(displayNote.updatedAt).toLocaleDateString()}
                    </span>
                </div>
            </div>
        </div>
    )
}

export default NoteModal
