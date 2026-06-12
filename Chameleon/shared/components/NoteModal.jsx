import React, { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import api from '../api/client.js'
import RichTextEditor from './RichTextEditor.jsx'
import TagInput from './TagInput.jsx'
import ShareNoteModal from './ShareNoteModal.jsx'
import AttributionEditor from './AttributionEditor.jsx'
import EditHistoryPanel from './EditHistoryPanel.jsx'
import { Icon } from '../icons.jsx'

const DEFAULT_NOTE_COLOR = '#8b5cf6'
const NOTE_COLORS = [
    '#8b5cf6', '#ED4245', '#E67E22', '#F1C40F',
    '#57F287', '#3498DB', '#9B59B6', '#EB459E', '#95A5A6'
]

function NoteModal({ note, system, onClose, onUpdated, onDeleted }) {
    const [fullNote, setFullNote] = useState(null)
    const [contentText, setContentText] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [editMode, setEditMode] = useState(false)
    const [editTitle, setEditTitle] = useState('')
    const [editContent, setEditContent] = useState('')
    const [editTags, setEditTags] = useState([])
    const [editColor, setEditColor] = useState(DEFAULT_NOTE_COLOR)
    const [editAttribution, setEditAttribution] = useState([])
    const [editorMode, setEditorMode] = useState('rich')
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showShare, setShowShare] = useState(false)
    const [existingTags, setExistingTags] = useState([])
    const [showAttributionEditor, setShowAttributionEditor] = useState(false)
    const [userAttributionStyle, setUserAttributionStyle] = useState('entityAndUser')

    useEffect(() => {
        let cancelled = false
        async function fetchNote() {
            try {
                const [data, tags] = await Promise.all([
                    api.getNote(note._id),
                    api.getNoteTags()
                ])
                if (!cancelled) {
                    setFullNote(data)
                    setExistingTags(tags || [])

                    let fetchedContent = data.contentPreview || ''
                    if (typeof data.content === 'string') {
                        fetchedContent = data.content
                    } else if (data.content?.url) {
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
                        setEditTags(data.tags || [])
                        setEditColor(data.color || DEFAULT_NOTE_COLOR)
                        const latestAttr = data.attribution?.length
                            ? data.attribution[data.attribution.length - 1].entities?.map(e => ({
                                type: e.entity?.type, id: e.entity?.ID, name: e.entity?.name, avatar: e.entity?.avatar, color: e.entity?.color,
                                entityStates: e.entityStates
                            })) || []
                            : []
                        setEditAttribution(latestAttr)
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
        setShowShare(false)
        setShowAttributionEditor(false)
        onClose?.()
    }

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) handleClose()
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            await api.updateNote(note._id, {
                title: editTitle.trim() || undefined,
                content: editContent,
                tags: editTags,
                color: editColor === DEFAULT_NOTE_COLOR ? undefined : editColor,
                attribution: editAttribution.map(e => ({
                    entity: { type: e.type, ID: e.id },
                    entityStates: e.entityStates
                }))
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
    const latestAttribution = displayNote.attribution?.length
        ? displayNote.attribution[displayNote.attribution.length - 1]
        : null

    if (showShare) {
        return <ShareNoteModal note={displayNote} onClose={() => setShowShare(false)} onShared={onUpdated} />
    }

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
                <div className="modal-content modal-note-edit">
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
                        <RichTextEditor
                            content={editContent}
                            onChange={setEditContent}
                            placeholder="Write your note..."
                            mode={editorMode}
                            onModeChange={setEditorMode}
                            height={250}
                        />
                    </div>

                    <div className="form-group">
                        <label>Tags</label>
                        <TagInput
                            tags={editTags}
                            onChange={setEditTags}
                            existingTags={existingTags}
                        />
                    </div>

                    <div className="form-group">
                        <label>Color</label>
                        <div className="color-picker">
                            {NOTE_COLORS.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    className={`color-swatch ${editColor === color ? 'selected' : ''}`}
                                    style={{ backgroundColor: color }}
                                    onClick={() => setEditColor(color)}
                                />
                            ))}
                        </div>
                    </div>

                    {(system?.sys_type?.isSystem || system?.sys_type?.isFragmented || system?.sys_type?.isDissociative) && (
                    <div className="form-group">
                        <label>Attribution</label>
                        <AttributionEditor
                            attributions={editAttribution}
                            onChange={setEditAttribution}
                            sysType={system?.sys_type}
                            isShared={!!(displayNote?.users?.rwAccess?.length || displayNote?.users?.rAccess?.length)}
                            compact
                        />
                    </div>
                    )}

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
            <div
                className="modal-content modal-note-view"
                style={{
                    '--note-color': noteColor,
                    '--note-gradient': `linear-gradient(180deg, ${noteColor}18 0%, ${noteColor}08 40%, transparent 100%)`,
                }}
            >
                <div className="modal-header">
                    <button className="btn-ghost" onClick={handleClose}>← Back</button>
                    <div className="modal-actions">
                        <button className="btn-icon" title="Share" onClick={() => setShowShare(true)}><Icon name="users" size={18} /></button>
                        <button className="btn-icon" title="Edit" onClick={() => setEditMode(true)}><Icon name="pencil" size={18} /></button>
                        <button className="btn-icon" title="Delete" onClick={() => setShowDeleteConfirm(true)}><Icon name="trash" size={18} /></button>
                    </div>
                </div>

                <h2 className="modal-title note-view-title" style={{ color: 'var(--text)' }}>
                    {displayNote.title || 'Untitled'}
                </h2>

                {displayNote.tags?.length > 0 && (
                    <div className="note-card-tags" style={{ marginTop: '8px', marginBottom: '12px' }}>
                        {displayNote.tags.map(tag => (
                            <span key={tag} className="note-card-tag">{tag}</span>
                        ))}
                    </div>
                )}

                {latestAttribution && latestAttribution.entities?.length > 0 && (system?.sys_type?.isSystem || system?.sys_type?.isFragmented || system?.sys_type?.isDissociative) && (
                    <div className="note-attribution-display" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        {latestAttribution.entities.map((ent, i) => (
                            <span key={i} className="attribution-chip" style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '2px 8px', borderRadius: '12px',
                                border: `1px solid ${ent.entity?.color || 'var(--glass-border)'}`,
                                fontSize: '0.75rem', color: 'var(--text)'
                            }}>
                                {ent.entity?.avatar && (
                                    <img src={ent.entity.avatar} alt="" style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }} />
                                )}
                                <span>{ent.entity?.name}</span>
                                {ent.entityStates?.priority && (
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginLeft: '2px' }}>
                                        ({ent.entityStates.priority.name})
                                    </span>
                                )}
                            </span>
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

                <EditHistoryPanel
                    noteId={displayNote._id || note._id}
                    attributionStyle={userAttributionStyle}
                />

                <div className="modal-actions">
                    <span className="note-card-meta">
                        {displayNote.pinned && <><Icon name="pin" size={14} /> </>}{new Date(displayNote.updatedAt).toLocaleDateString()}
                    </span>
                </div>
            </div>
        </div>
    )
}

export default NoteModal
