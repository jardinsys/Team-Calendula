import React, { useState, useEffect, useCallback } from 'react'
import { useDiscordSdk } from '../../hooks/useDiscordSdk'
import { api, FriendCardList, FriendDetailModal, AddFriendModal } from '@chameleon/shared'

export function FriendsPage() {
    const { session } = useDiscordSdk()
    const [friends, setFriends] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [myFriendId, setMyFriendId] = useState(null)

    const [selectedFriend, setSelectedFriend] = useState(null)
    const [showAddFriend, setShowAddFriend] = useState(false)
    const [showRequests, setShowRequests] = useState(false)

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true)
            const [friendsData, idData] = await Promise.all([
                api.getFriends().catch(() => []),
                api.getMyFriendId().catch(() => null)
            ])
            setFriends(friendsData)
            setMyFriendId(idData)
            setLoading(false)
        } catch (err) {
            setError(err.message)
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    const handleFriendAdded = () => { fetchAll(); setShowAddFriend(false) }
    const handleFriendRemoved = () => { fetchAll(); setSelectedFriend(null) }
    const handleFriendBlocked = () => { fetchAll(); setSelectedFriend(null) }

    if (loading && !friends.length) {
        return (
            <div className="status-screen">
                <div className="spinner" />
                <p>Loading friends...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="empty-state">
                <span className="empty-icon">⚠️</span>
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
                { myFriendId?.friendID && (
                    <div
                        style={{
                            background: 'var(--bg-surface)', border: '1px solid var(--glass-border)',
                            borderRadius: 'var(--radius)', padding: '6px 10px', cursor: 'pointer',
                            fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-accent)',
                            flexShrink: 0
                        }}
                        onClick={() => {
                            {/* try { navigator.clipboard?.writeText(myFriendId.friendID) } catch {} */}
                        }}
                        title="Use this ID to add friends!"
                    >
                        ID: {myFriendId.friendID}
                    </div>
                )}
            </header>

            <FriendCardList
                friends={friends}
                onFriendClick={setSelectedFriend}
                fallbackName={session?.global_name || session?.username}
            />

            <button className="fab" title="Add friend" onClick={() => setShowAddFriend(true)}>+</button>

            {selectedFriend && (
                <FriendDetailModal
                    friend={selectedFriend}
                    onClose={() => setSelectedFriend(null)}
                    onRemoved={handleFriendRemoved}
                    onBlocked={handleFriendBlocked}
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
