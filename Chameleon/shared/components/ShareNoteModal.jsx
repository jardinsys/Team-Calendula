import React, { useState, useEffect } from 'react'
import api from '../api/client.js'

function ShareNoteModal({ note, onClose, onShared }) {
    const [friends, setFriends] = useState([])
    const [loading, setLoading] = useState(true)
    const [sharing, setSharing] = useState(false)
    const [error, setError] = useState(null)
    const [discordId, setDiscordId] = useState('')
    const [access, setAccess] = useState('r')
    const [shareLink, setShareLink] = useState('')
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        loadFriends()
    }, [])

    const loadFriends = async () => {
        try {
            const data = await api.getFriends()
            setFriends(data || [])
        } catch (err) {
            console.error('Failed to load friends:', err)
        }
        setLoading(false)
    }

    const handleShare = async () => {
        if (!discordId.trim()) return
        setSharing(true)
        setError(null)
        try {
            await api.shareNote(note._id, { discordId: discordId.trim(), access })
            onShared?.()
            setDiscordId('')
        } catch (err) {
            setError(err.message)
        }
        setSharing(false)
    }

    const handleUnshare = async (userId) => {
        try {
            await api.unshareNote(note._id, { discordId: userId })
            onShared?.()
        } catch (err) {
            setError(err.message)
        }
    }

    const handleCopyLink = () => {
        navigator.clipboard.writeText(`${window.location.origin}/note/${note.id || note._id}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const currentShared = [
        ...(note.users?.rAccess || []).map(u => ({ ...u, access: 'r' })),
        ...(note.users?.rwAccess || []).map(u => ({ ...u, access: 'rw' })),
    ]

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <button className="btn-ghost" onClick={onClose}>← Back</button>
                    <h2 className="modal-title">Share Note</h2>
                    <div style={{ width: '60px' }} />
                </div>

                <div className="form-group">
                    <label>Share with Friend</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            className="text-input"
                            type="text"
                            placeholder="Discord ID or Friend ID"
                            value={discordId}
                            onChange={e => setDiscordId(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleShare()}
                        />
                        <select
                            className="text-input"
                            value={access}
                            onChange={e => setAccess(e.target.value)}
                            style={{ width: '120px' }}
                        >
                            <option value="r">Read</option>
                            <option value="rw">Read + Edit</option>
                        </select>
                        <button
                            className="btn btn-primary"
                            onClick={handleShare}
                            disabled={sharing || !discordId.trim()}
                        >
                            {sharing ? 'Sharing...' : 'Share'}
                        </button>
                    </div>
                </div>

                {friends.length > 0 && (
                    <div className="form-group">
                        <label>Or pick from friends</label>
                        <div className="friend-picker-list">
                            {friends.map(friend => (
                                <button
                                    key={friend._id}
                                    type="button"
                                    className="friend-picker-item"
                                    onClick={() => { setDiscordId(friend.discordID || friend.friendID); setAccess('r') }}
                                >
                                    {friend.name || 'Unknown'}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {currentShared.length > 0 && (
                    <div className="form-group">
                        <label>Currently shared with</label>
                        <div className="shared-users-list">
                            {currentShared.map((item, i) => (
                                <div key={i} className="shared-user-row">
                                    <span className="shared-user-name">{item.userID}</span>
                                    <span className="shared-user-access">{item.access === 'rw' ? 'Read + Edit' : 'Read Only'}</span>
                                    <button className="btn btn-ghost btn-sm btn-danger-text" onClick={() => handleUnshare(item.userID)}>Remove</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="form-group">
                    <label>Link</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            className="text-input"
                            type="text"
                            value={`${window.location.origin}/note/${note.id || note._id}`}
                            readOnly
                        />
                        <button className="btn btn-secondary" onClick={handleCopyLink}>
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                </div>

                {error && (
                    <p style={{ color: 'var(--color-error)', fontSize: '0.8rem' }}>{error}</p>
                )}
            </div>
        </div>
    )
}

export { ShareNoteModal }
export default ShareNoteModal