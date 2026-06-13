import React, { useState, useMemo } from 'react'
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDiscordSdk } from '../../hooks/useDiscordSdk'
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll'
import { api, FriendCardList, FriendDetailModal, AddFriendModal, Icon, friendKeys } from '@chameleon/shared'

const TABS = [
    { key: 'friends', label: 'Friends' },
    { key: 'requests', label: 'Requests' },
    { key: 'blocked', label: 'Blocked' }
]

export function FriendsPage({ onNavigate, onOpenSettings }) {
    const { session } = useDiscordSdk()
    const queryClient = useQueryClient()
    const [activeTab, setActiveTab] = useState('friends')

    const [selectedFriend, setSelectedFriend] = useState(null)
    const [showAddFriend, setShowAddFriend] = useState(false)

    const [actionLoading, setActionLoading] = useState({})

    const friendsQuery = useInfiniteQuery({
        queryKey: friendKeys.lists(),
        queryFn: ({ pageParam = 0 }) => api.getFriends(pageParam, 20).catch(() => ({ data: [], total: 0, hasMore: false })),
        getNextPageParam: (lastPage, allPages) => lastPage.hasMore ? allPages.length * 20 : undefined,
    })

    const requestsQuery = useQuery({
        queryKey: friendKeys.requests(),
        queryFn: () => api.getFriendRequests().catch(() => []),
    })

    const blockedQuery = useQuery({
        queryKey: friendKeys.blocked(),
        queryFn: () => api.getBlocked().catch(() => []),
    })

    const myIdQuery = useQuery({
        queryKey: friendKeys.myId(),
        queryFn: () => api.getMyFriendId().catch(() => null),
    })

    const friends = useMemo(() => friendsQuery.data?.pages?.flatMap(p => p.data || p) ?? [], [friendsQuery.data])
    const friendsSentinel = useInfiniteScroll(friendsQuery.fetchNextPage, friendsQuery.hasNextPage, friendsQuery.isFetchingNextPage)
    const requests = requestsQuery.data ?? []
    const blocked = blockedQuery.data ?? []
    const myFriendId = myIdQuery.data ?? null
    const loading = friendsQuery.isLoading || requestsQuery.isLoading || blockedQuery.isLoading || myIdQuery.isLoading
    const error = friendsQuery.error?.message || requestsQuery.error?.message || blockedQuery.error?.message || null

    const acceptMutation = useMutation({
        mutationFn: (index) => api.acceptFriendRequest(index),
        onMutate: (index) => {
            setActionLoading(prev => ({ ...prev, [`accept-${index}`]: true }))
        },
        onSettled: (_data, _err, index) => {
            setActionLoading(prev => ({ ...prev, [`accept-${index}`]: false }))
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: friendKeys.lists() })
            queryClient.invalidateQueries({ queryKey: friendKeys.requests() })
        },
    })

    const declineMutation = useMutation({
        mutationFn: (index) => api.declineFriendRequest(index),
        onMutate: (index) => {
            setActionLoading(prev => ({ ...prev, [`decline-${index}`]: true }))
        },
        onSettled: (_data, _err, index) => {
            setActionLoading(prev => ({ ...prev, [`decline-${index}`]: false }))
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: friendKeys.requests() })
        },
    })

    const unblockMutation = useMutation({
        mutationFn: (blockedId) => api.unblockUser(blockedId),
        onMutate: (blockedId) => {
            setActionLoading(prev => ({ ...prev, [`unblock-${blockedId}`]: true }))
        },
        onSettled: (_data, _err, blockedId) => {
            setActionLoading(prev => ({ ...prev, [`unblock-${blockedId}`]: false }))
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: friendKeys.blocked() })
        },
    })

    const handleAcceptRequest = (index) => acceptMutation.mutate(index)
    const handleDeclineRequest = (index) => declineMutation.mutate(index)
    const handleUnblock = (blockedId) => unblockMutation.mutate(blockedId)

    const handleFriendAdded = () => {
        queryClient.invalidateQueries({ queryKey: friendKeys.lists() })
        queryClient.invalidateQueries({ queryKey: friendKeys.requests() })
        setShowAddFriend(false)
    }
    const handleFriendRemoved = () => {
        queryClient.invalidateQueries({ queryKey: friendKeys.lists() })
        setSelectedFriend(null)
    }
    const handleFriendBlocked = () => {
        queryClient.invalidateQueries({ queryKey: friendKeys.lists() })
        queryClient.invalidateQueries({ queryKey: friendKeys.blocked() })
        setSelectedFriend(null)
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
                        onClick={() => setActiveTab(tab.key)}
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
                    <div ref={friendsSentinel} style={{ height: 1 }} />
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
