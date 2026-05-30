import React, { useState } from 'react'
import api from '../api/client.js'

const NOTE_COLORS = [
    '#8b5cf6', '#ED4245', '#E67E22', '#F1C40F',
    '#57F287', '#3498DB', '#9B59B6', '#EB459E', '#95A5A6'
]

function CreateNoteModal({ onClose, onCreated }) {
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [tagsInput, setTagsInput] = useState('')
    const [selectedColor, setSelectedColor] = useState(NOTE_COLORS[0])
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState(null)

    const handleCreate = async (e) => {
        e.preventDefault()
        if (!content.trim()) return

        setCreating(true)
        setError(null)

        try {
            const tags = tagsInput
                .split(',')
                .map(t => t.trim())
                .filter(Boolean)

            await api.createNote({
                title: title.trim() || undefined,
                content,
                tags,
                color: selectedColor
            })

            onCreated?.()
            onClose?.()
        } catch (err) {
            setError(err.message)
            setCreating(false)
        }
    }

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose?.()
    }

    return (
        <div className="modal-overlay" onClick={handleBackdropClick}>
            <div className="modal-content">
                <div className="modal-header">
                    <button className="btn-ghost" onClick={() => onClose?.()}>← Back</button>
                    <h2 className="modal-title">New Note</h2>
                    <div style={{ width: '60px' }} />
                </div>

                <form onSubmit={handleCreate}>
                    <div className="form-group">
                        <label>Title</label>
                        <input
                            className="text-input"
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Note title (optional)"
                            maxLength={100}
                        />
                    </div>

                    <div className="form-group">
                        <label>Content</label>
                        <textarea
                            className="text-input"
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="Write your note in markdown..."
                            rows={6}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Tags (comma-separated)</label>
                        <input
                            className="text-input"
                            type="text"
                            value={tagsInput}
                            onChange={e => setTagsInput(e.target.value)}
                            placeholder="personal, ideas, todo"
                        />
                    </div>

                    <div className="form-group">
                        <label>Color</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {NOTE_COLORS.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setSelectedColor(color)}
                                    style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        backgroundColor: color,
                                        border: selectedColor === color ? '2px solid white' : '2px solid transparent',
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
                        <button type="button" className="btn btn-secondary" onClick={() => onClose?.()}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={creating || !content.trim()}>
                            {creating ? 'Creating...' : 'Create Note'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default CreateNoteModal
