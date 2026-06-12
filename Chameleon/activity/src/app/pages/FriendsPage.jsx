import React, { useState, useEffect, useCallback } from 'react'
import { useDiscordSdk } from '../../hooks/useDiscordSdk'
import { api, FriendCardList, FriendDetailModal, AddFriendModal, Icon } from '@chameleon/shared'

const TABS = [
    { key: 'friends', label: 'Friends' },
    { key: 'requests', label: 'Requests' },
    { key: 'blocked', label: 'Blocked' }
]

export function FriendsPage({ onNavigate, onOpenSettings }) {
    const { session } = useDiscordSdk()
    const [activeTab, setActiveTab] = useState('friends')
    const [friends, setFriends] = useState([])
    const [requests, setRequests] = useState([])
    const [blocked, setBlocked] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [myFriendId, setMyFriendId] = useState(null)

    const [selectedFriend, setSelectedFriend] = useState(null)
    const [showAddFriend, setShowAddFriend] = useState(false)

    const [actionLoading, setActionLoading] = useState({})

    const fetchFriends = useCallback(async () => {
        try {
            const [friendsData, idData] = await Promise.all([
                api.getFriends().catch(() => []),
                api.getMyFriendId().catch(() => null)
            ])
            setFriends(friendsData)
            setMyFriendId(idData)
        } catch (err) {
            setError(err.message)
        }
    }, [])

    const fetchRequests = useCallback(async () => {
        try {
            const data = await api.getFriendRequests().catch(() => [])
            setRequests(data)
        } catch (err) {
            setError(err.message)
        }
    }, [])

    const fetchBlocked = useCallback(async () => {
        try {
            const data = await api.getBlocked().catch(() => [])
            setBlocked(data)
        } catch (err) {
            setError(err.message)
        }
    }, [])

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true)
            await Promise.all([fetchFriends(), fetchRequests(), fetchBlocked()])
            setLoading(false)
        } catch (err) {
            setError(err.message)
            setLoading(false)
        }
    }, [fetchFriends, fetchRequests, fetchBlocked])

    useEffect(() => { fetchAll() }, [fetchAll])

    const refreshCurrentTab = useCallback(async () => {
        if (activeTab === 'friends') await fetchFriends()
        else if (activeTab === 'requests') await fetchRequests()
        else if (activeTab === 'blocked') await fetchBlocked()
    }, [activeTab, fetchFriends, fetchRequests, fetchBlocked])

    const handleFriendAdded = () => { fetchFriends(); fetchRequests(); setShowAddFriend(false) }
    const handleFriendRemoved = () => { fetchFriends(); setSelectedFriend(null) }
    const handleFriendBlocked = () => { fetchFriends(); fetchBlocked(); setSelectedFriend(null) }

    const handleAcceptRequest = async (index) => {
        const key = `accept-${index}`
        setActionLoading(prev => ({ ...prev, [key]: true }))
        try {
            await api.acceptFriendRequest(index)
            await Promise.all([fetchFriends(), fetchRequests()])
        } catch (err) {
            setError(err.message)
        } finally {
            setActionLoading(prev => ({ ...prev, [key]: false }))
        }
    }

    const handleDeclineRequest = async (index) => {
        const key = `decline-${index}`
        setActionLoading(prev => ({ ...prev, [key]: true }))
        try {
            await api.declineFriendRequest(index)
            await fetchRequests()
        } catch (err) {
            setError(err.message)
        } finally {
            setActionLoading(prev => ({ ...prev, [key]: false }))
        }
    }

    const handleUnblock = async (blockedId) => {
        const key = `unblock-${blockedId}`
        setActionLoading(prev => ({ ...prev, [key]: true }))
        try {
            await api.unblockUser(blockedId)
            await fetchBlocked()
        } catch (err) {
            setError(err.message)
        } finally {
            setActionLoading(prev => ({ ...prev, [key]: false }))
        }
    }

    if (loading && !friends.length && !requests.length && !blocked.length) {
        return (
            <div className="status-screen">
                <div className="spinner" />
                <p>Loading friends...</p>
            </div>
        )
    }

    if (error && !friends.length && !requests.length && !blocked.length) {
        return (
            <div className="empty-state">
                <span className="empty-icon"><Icon name="alert" size={48} /></span>
                <h3>Something went wrong</h3>
                <p>{error}</p>
            </div>
        )
    }

    return (
        <div>
            <header className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <h1>Friends</h1>
                    <p>{friends.length} friend{friends.length !== 1 ? 's' : ''}</p>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                    {myFriendId?.friendID && (
                        <div
                            style={{
                                background: 'var(--bg-surface)', border: '1px solid var(--glass-border)',
                                borderRadius: 'var(--radius)', padding: '6px 10px', cursor: 'pointer',
                                fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-accent)',
                            }}
                            title="Use this ID to add friends!"
                        >
                            ID: {myFriendId.friendID}
                        </div>
                    )}
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={onOpenSettings}
                        title="Settings"
                        style={{ padding: '6px', minWidth: 'auto' }}
                    >
                        <Icon name="settings" size={16} />
                    </button>
                </div>
            </header>

            <div className="friends-tabs">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        className={`friends-tab ${activeTab === tab.key ? 'friends-tab--active' : ''}`}
                        onClick={() => { setActiveTab(tab.key); setError(null) }}
                    >
                        {tab.label}
                        {tab.key === 'requests' && requests.length > 0 && (
                            <span className="friends-tab-badge">{requests.length}</span>
                        )}
                    </button>
                ))}
            </div>

            {activeTab === 'friends' && (
                <>
                    <FriendCardList
                        friends={friends}
                        onFriendClick={setSelectedFriend}
                        fallbackName={session?.global_name || session?.username}
                    />
                    <button className="fab" title="Add friend" onClick={() => setShowAddFriend(true)}>+</button>
                </>
            )}

            {activeTab === 'requests' && (
                <div className="friends-section">
                    {requests.length === 0 ? (
                        <div className="empty-state">
                            <span className="empty-icon"><Icon name="inbox" size={48} /></span>
                            <h3>No requests</h3>
                            <p>Pending friend requests will appear here</p>
                        </div>
                    ) : (
                        <div className="entity-list">
                            {requests.map((req, index) => (
                                <div key={index} className="friend-request-card">
                                    <div className="friend-request-info">
                                        <div className="friend-request-avatar">
                                            <div className="friend-card-avatar-fallback">
                                                {(req.fromName || '?').charAt(0).toUpperCase()}
                                            </div>
                                        </div>
                                        <div className="friend-request-details">
                                            <div className="friend-card-name">{req.fromName || 'Unknown'}</div>
                                            {req.fromSystemName && (
                                                <div className="friend-card-system">{req.fromSystemName}</div>
                                            )}
                                            {req.sentAt && (
                                                <div className="friend-card-status">
                                                    {new Date(req.sentAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="friend-request-actions">
                                        <button
                                            className="btn btn-primary friends-request-btn"
                                            disabled={actionLoading[`accept-${index}`]}
                                            onClick={() => handleAcceptRequest(index)}
                                        >
                                            {actionLoading[`accept-${index}`] ? '...' : 'Accept'}
                                        </button>
                                        <button
                                            className="btn btn-danger friends-request-btn"
                                            disabled={actionLoading[`decline-${index}`]}
                                            onClick={() => handleDeclineRequest(index)}
                                        >
                                            {actionLoading[`decline-${index}`] ? '...' : 'Decline'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'blocked' && (
                <div className="friends-section">
                    {blocked.length === 0 ? (
                        <div className="empty-state">
                            <span className="empty-icon"><Icon name="x" size={48} /></span>
                            <h3>No blocked users</h3>
                            <p>Blocked users will appear here</p>
                        </div>
                    ) : (
                        <div className="entity-list">
                            {blocked.map((user, index) => {
                                const blockedId = user.friendID || user.discordID
                                return (
                                    <div key={blockedId || index} className="friend-request-card">
                                        <div className="friend-request-info">
                                            <div className="friend-request-avatar">
                                                <div className="friend-card-avatar-fallback" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-error)' }}>
                                                    {(user.discordName || user.friendID || '?').charAt(0).toUpperCase()}
                                                </div>
                                            </div>
                                            <div className="friend-request-details">
                                                <div className="friend-card-name" style={{ color: 'var(--text-secondary)' }}>
                                                    {user.discordName || user.friendID || 'Unknown'}
                                                </div>
                                                {user.addedAt && (
                                                    <div className="friend-card-status">
                                                        Blocked {new Date(user.addedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="friend-request-actions">
                                            <button
                                                className="btn btn-secondary friends-request-btn"
                                                disabled={actionLoading[`unblock-${blockedId}`]}
                                                onClick={() => handleUnblock(blockedId)}
                                            >
                                                {actionLoading[`unblock-${blockedId}`] ? '...' : 'Unblock'}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {selectedFriend && (
                <FriendDetailModal
                    friend={selectedFriend}
                    onClose={() => setSelectedFriend(null)}
                    onRemoved={handleFriendRemoved}
                    onBlocked={handleFriendBlocked}
                    onEntityClick={onNavigate ? (fronter) => onNavigate('entity', { entityType: fronter.type, entityId: fronter._id }) : undefined}
                    fallbackName={session?.global_name || session?.username}
                />
            )}

            {showAddFriend && (
                <AddFriendModal
                    onClose={() => setShowAddFriend(false)}
                    onAdded={handleFriendAdded}
                />
            )}
        </div>
    )
}

export default FriendsPage