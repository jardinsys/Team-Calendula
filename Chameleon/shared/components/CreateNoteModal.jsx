import React, { useState, useEffect } from 'react'
import api from '../api/client.js'
import RichTextEditor from './RichTextEditor.jsx'
import TagInput from './TagInput.jsx'
import AttributionEditor from './AttributionEditor.jsx'

const NOTE_COLORS = [
    '#8b5cf6', '#ED4245', '#E67E22', '#F1C40F',
    '#57F287', '#3498DB', '#9B59B6', '#EB459E', '#95A5A6'
]

function CreateNoteModal({ onClose, onCreated }) {
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [tags, setTags] = useState([])
    const [selectedColor, setSelectedColor] = useState(NOTE_COLORS[0])
    const [editorMode, setEditorMode] = useState('rich')
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState(null)
    const [existingTags, setExistingTags] = useState([])
    const [entityOwner, setEntityOwner] = useState(null)
    const [entities, setEntities] = useState([])
    const [entityTab, setEntityTab] = useState('alter')
    const [attribution, setAttribution] = useState([])

    useEffect(() => {
        api.getNoteTags().then(t => setExistingTags(t || [])).catch(() => {})
        loadEntities()
    }, [])

    useEffect(() => {
        loadEntities()
    }, [entityTab])

    const loadEntities = async () => {
        try {
            let data
            if (entityTab === 'alter') data = await api.getAlters()
            else if (entityTab === 'state') data = await api.getStates()
            else data = await api.getGroups()
            setEntities(data || [])
        } catch {
            setEntities([])
        }
    }

    const handleCreate = async (e) => {
        e.preventDefault()
        if (!content.trim()) return
        setCreating(true)
        setError(null)
        try {
            const payload = {
                title: title.trim() || undefined,
                content,
                tags,
                color: selectedColor,
                attribution: attribution.map(e => ({ type: e.type, id: e.id }))
            }
            if (entityOwner) {
                payload.entityOwner = { type: entityOwner.type, id: entityOwner.id }
            }
            await api.createNote(payload)
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
            <div className="modal-content modal-note-create">
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
                        <RichTextEditor
                            content={content}
                            onChange={setContent}
                            placeholder="Write your note..."
                            mode={editorMode}
                            onModeChange={setEditorMode}
                            height={250}
                        />
                    </div>

                    <div className="form-group">
                        <label>Tags</label>
                        <TagInput
                            tags={tags}
                            onChange={setTags}
                            existingTags={existingTags}
                        />
                    </div>

                    <div className="form-group">
                        <label>Owned by Entity (optional)</label>
                        <select
                            className="text-input"
                            value={entityOwner ? `${entityOwner.type}:${entityOwner.id}` : ''}
                            onChange={e => {
                                const val = e.target.value
                                if (!val) { setEntityOwner(null); return }
                                const [type, id] = val.split(':')
                                const ent = entities.find(en => en._id === id)
                                setEntityOwner({ type, id, name: ent?.name?.display || ent?.name?.indexable || 'Unknown' })
                            }}
                        >
                            <option value="">None</option>
                            {entities.map(ent => {
                                const name = ent.name?.display || ent.name?.indexable || 'Unknown'
                                return <option key={ent._id} value={`${entityTab}:${ent._id}`}>{name}</option>
                            })}
                        </select>
                        <div className="entity-tabs" style={{ marginTop: '8px' }}>
                            {['alter', 'state', 'group'].map(tab => (
                                <button
                                    key={tab}
                                    type="button"
                                    className={`entity-tab ${entityTab === tab ? 'active' : ''}`}
                                    onClick={() => setEntityTab(tab)}
                                >
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}s
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Attribution</label>
                        <AttributionEditor
                            attribution={attribution}
                            onChange={setAttribution}
                            compact
                        />
                    </div>

                    <div className="form-group">
                        <label>Color</label>
                        <div className="color-picker">
                            {NOTE_COLORS.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    className={`color-swatch ${selectedColor === color ? 'selected' : ''}`}
                                    style={{ backgroundColor: color }}
                                    onClick={() => setSelectedColor(color)}
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
