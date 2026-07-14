import React, { useState, useEffect } from 'react'
import api from '../api/client.js'
import { Icon } from '../icons.jsx'
import FrontDisplay from './FrontDisplay.jsx'

function FriendDetailModal({ friend, onClose, onRemoved, onBlocked, onEntityClick, fallbackName }) {
    const [frontData, setFrontData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [actionLoading, setActionLoading] = useState(false)
    const [confirmAction, setConfirmAction] = useState(null) // 'remove' | 'block'

    const displayName = friend.customName || friend.system?.name || fallbackName || 'Unknown'

    useEffect(() => {
        let cancelled = false
        async function fetchFront() {
            try {
                const friendId = friend.friendID || friend.discordID || friend._id
                const data = await api.getFriendFront(friendId)
                if (!cancelled) {
                    setFrontData(data)
                    setLoading(false)
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err.message)
                    setLoading(false)
                }
            }
        }
        fetchFront()
        return () => { cancelled = true }
    }, [friend.friendID, friend.discordID, friend._id])

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose?.()
    }

    const handleRemove = async () => {
        setActionLoading(true)
        try {
            const friendId = friend.friendID || friend.discordID
            await api.removeFriend(friendId)
            onRemoved?.()
            onClose?.()
        } catch (err) {
            setError(err.message)
            setActionLoading(false)
        }
    }

    const handleBlock = async () => {
        setActionLoading(true)
        try {
            await api.blockUser({ discordId: friend.discordID })
            onBlocked?.()
            onClose?.()
        } catch (err) {
            setError(err.message)
            setActionLoading(false)
        }
    }

    if (confirmAction === 'remove') {
        return (
            <div className="modal-overlay" onClick={handleBackdropClick}>
                <div className="modal-content">
                    <div className="modal-header">
                        <button className="btn-ghost" onClick={() => setConfirmAction(null)}>← Back</button>
                        <h2 className="modal-title">Remove Friend</h2>
                        <div style={{ width: '60px' }} />
                    </div>
                    <p style={{ marginBottom: '24px' }}>
                        Remove <strong>{displayName}</strong> from your friends?
                    </p>
                    <div className="modal-actions">
                        <button className="btn btn-secondary" onClick={() => setConfirmAction(null)}>Cancel</button>
                        <button className="btn btn-primary" style={{ backgroundColor: 'var(--color-error)' }} onClick={handleRemove} disabled={actionLoading}>
                            {actionLoading ? 'Removing...' : 'Remove'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (confirmAction === 'block') {
        return (
            <div className="modal-overlay" onClick={handleBackdropClick}>
                <div className="modal-content">
                    <div className="modal-header">
                        <button className="btn-ghost" onClick={() => setConfirmAction(null)}>← Back</button>
                        <h2 className="modal-title">Block User</h2>
                        <div style={{ width: '60px' }} />
                    </div>
                    <p style={{ marginBottom: '24px' }}>
                        Block <strong>{displayName}</strong>? They will be removed from your friends list.
                    </p>
                    <div className="modal-actions">
                        <button className="btn btn-secondary" onClick={() => setConfirmAction(null)}>Cancel</button>
                        <button className="btn btn-primary" style={{ backgroundColor: 'var(--color-error)' }} onClick={handleBlock} disabled={actionLoading}>
                            {actionLoading ? 'Blocking...' : 'Block'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="modal-overlay" onClick={handleBackdropClick}>
            <div className="modal-content">
                <div className="modal-header">
                    <button className="btn-ghost" onClick={onClose}>← Back</button>
                    <h2 className="modal-title">{displayName}</h2>
                    <div style={{ width: '60px' }} />
                </div>

                {friend.system?.name && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
                        {friend.system.name}
                    </p>
                )}

                {loading && (
                    <div className="status-screen" style={{ minHeight: '150px' }}>
                        <div className="spinner" />
                        <p>Loading front...</p>
                    </div>
                )}

                {error && (
                    <p style={{ color: 'var(--color-error)', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</p>
                )}

                {!loading && frontData && (
                    <FrontDisplay
                        frontData={frontData}
                        isOwner={false}
                        onFronterClick={onEntityClick}
                    />
                )}

                {!loading && !frontData && !error && (
                    <div className="empty-state">
                        <span className="empty-icon"><Icon name="moon" size={32} /></span>
                        <h3>Nothing to show</h3>
                    </div>
                )}

                <div className="modal-actions" style={{ flexDirection: 'column', gap: '8px' }}>
                    <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setConfirmAction('remove')}>
                        Remove Friend
                    </button>
                    <button className="btn btn-ghost" style={{ width: '100%', color: 'var(--color-error)' }} onClick={() => setConfirmAction('block')}>
                        Block User
                    </button>
                </div>
            </div>
        </div>
    )
}

export default FriendDetailModal
