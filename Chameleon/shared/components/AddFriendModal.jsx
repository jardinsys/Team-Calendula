import React, { useState } from 'react'
import api from '../api/client.js'

function AddFriendModal({ onClose, onAdded }) {
    const [friendId, setFriendId] = useState('')
    const [customName, setCustomName] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose?.()
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!friendId.trim()) return

        setSaving(true)
        setError(null)

        try {
            await api.addFriend({
                friendId: friendId.trim(),
                customName: customName.trim() || undefined
            })
            onAdded?.()
            onClose?.()
        } catch (err) {
            setError(err.message)
            setSaving(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={handleBackdropClick}>
            <div className="modal-content">
                <div className="modal-header">
                    <button className="btn-ghost" onClick={onClose}>← Back</button>
                    <h2 className="modal-title">Add Friend</h2>
                    <div style={{ width: '60px' }} />
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Friend ID</label>
                        <input
                            className="text-input"
                            type="text"
                            value={friendId}
                            onChange={e => setFriendId(e.target.value)}
                            placeholder="Enter their friend ID"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label>Custom name (optional)</label>
                        <input
                            className="text-input"
                            type="text"
                            value={customName}
                            onChange={e => setCustomName(e.target.value)}
                            placeholder="How you know them"
                        />
                    </div>

                    {error && (
                        <p style={{ color: 'var(--color-error)', fontSize: '0.8rem', marginBottom: '12px' }}>
                            {error}
                        </p>
                    )}

                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving || !friendId.trim()}>
                            {saving ? 'Adding...' : 'Add Friend'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default AddFriendModal
