import React, { useState, useEffect } from 'react'
import api from '../api/client.js'

const COLORS = [
    '#c4b5fd', '#fda4af', '#fdba74', '#fde047',
    '#86efac', '#7dd3fc', '#d8b4fe', '#f9a8d4', '#94a3b8'
]

function EntityFormModal({ entity, type = 'alter', typeLabel: typeLabelProp, onClose, onCreated, onUpdated }) {
    const isEdit = !!entity
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [pronouns, setPronouns] = useState('')
    const [color, setColor] = useState(COLORS[0])
    const [signoff, setSignoff] = useState('')
    const [proxy, setProxy] = useState('')
    const [groupType, setGroupType] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (entity) {
            setName(typeof entity.name === 'string' ? entity.name : entity.name?.display || '')
            setDescription(entity.description || '')
            setPronouns(entity.pronouns?.join?.(', ') || '')
            setColor(entity.color || COLORS[0])
            setSignoff(entity.signoff || '')
            setProxy(entity.proxy?.[0] || '')
            if (type === 'group' && entity.type) {
                setGroupType(entity.type.name || '')
            }
        }
    }, [entity, type])

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose?.()
    }

    const handleSave = async (e) => {
        e.preventDefault()
        if (!name.trim()) return

        setSaving(true)
        setError(null)

        try {
            const data = {
                name: name.trim(),
                description: description.trim() || undefined,
                color: color !== COLORS[0] ? color : undefined,
                signoff: signoff.trim() || undefined
            }

            if (type !== 'group') {
                data.pronouns = pronouns ? pronouns.split(',').map(p => p.trim()).filter(Boolean) : []
            }

            if (proxy.trim()) {
                data.proxy = [proxy.trim()]
            }

            if (type === 'group') {
                data.type = { name: groupType.trim() || 'General', canFront: 'yes' }
            }

            if (isEdit) {
                if (type === 'alter') await api.updateAlter(entity._id, data)
                else if (type === 'state') await api.updateState(entity._id, data)
                else if (type === 'group') await api.updateGroup(entity._id, data)
                onUpdated?.()
            } else {
                if (type === 'alter') await api.createAlter(data)
                else if (type === 'state') await api.createState(data)
                else if (type === 'group') await api.createGroup(data)
                onCreated?.()
            }

            onClose?.()
        } catch (err) {
            setError(err.message)
            setSaving(false)
        }
    }

    const typeLabel = typeLabelProp || type.charAt(0).toUpperCase() + type.slice(1)

    return (
        <div className="modal-overlay" onClick={handleBackdropClick}>
            <div className="modal-content">
                <div className="modal-header">
                    <button className="btn-ghost" onClick={onClose}>← Back</button>
                    <h2 className="modal-title">{isEdit ? `Edit ${typeLabel}` : `New ${typeLabel}`}</h2>
                    <div style={{ width: '60px' }} />
                </div>

                <form onSubmit={handleSave}>
                    <div className="form-group">
                        <label>Name</label>
                        <input
                            className="text-input"
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder={`${typeLabel} name`}
                            maxLength={100}
                            required
                            autoFocus
                        />
                    </div>

                    {type !== 'group' && (
                        <div className="form-group">
                            <label>Pronouns (comma-separated)</label>
                            <input
                                className="text-input"
                                type="text"
                                value={pronouns}
                                onChange={e => setPronouns(e.target.value)}
                                placeholder="he/him, they/them"
                            />
                        </div>
                    )}

                    {type === 'group' && (
                        <div className="form-group">
                            <label>Group type</label>
                            <input
                                className="text-input"
                                type="text"
                                value={groupType}
                                onChange={e => setGroupType(e.target.value)}
                                placeholder="e.g. Subsystem, Faction, General"
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            className="text-input"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder={`About this ${type}...`}
                            rows={3}
                        />
                    </div>

                    <div className="form-group">
                        <label>Color</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {COLORS.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    style={{
                                        width: '28px', height: '28px', borderRadius: '50%',
                                        backgroundColor: c,
                                        border: color === c ? '2px solid white' : '2px solid transparent',
                                        cursor: 'pointer',
                                        boxShadow: color === c ? `0 0 8px ${c}40` : 'none'
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Sign-off</label>
                        <input
                            className="text-input"
                            type="text"
                            value={signoff}
                            onChange={e => setSignoff(e.target.value)}
                            placeholder="e.g. 💜"
                        />
                    </div>

                    {!isEdit && (
                        <div className="form-group">
                            <label>Proxy pattern (optional)</label>
                            <input
                                className="text-input"
                                type="text"
                                value={proxy}
                                onChange={e => setProxy(e.target.value)}
                                placeholder='e.g. a:text'
                            />
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Use "text" as a placeholder for the message content
                            </p>
                        </div>
                    )}

                    {error && (
                        <p style={{ color: 'var(--color-error)', fontSize: '0.8rem', marginBottom: '12px' }}>
                            {error}
                        </p>
                    )}

                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
                            {saving ? 'Saving...' : isEdit ? 'Save' : `Create ${typeLabel}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default EntityFormModal
