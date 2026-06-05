import React from 'react'

function FriendCard({ friend, onClick }) {
    const displayName = friend.customName || friend.system?.name || 'Unknown'
    const systemName = friend.system?.name || 'No system'
    const avatar = friend.currentFront?.[0]?.avatar || friend.system?.avatar
    const fronters = friend.currentFront || []
    const status = friend.system?.status
    const battery = friend.system?.battery

    return (
        <div
            className="friend-card"
            onClick={() => onClick?.(friend)}
            role="button"
            tabIndex={0}
        >
            <div className="friend-card-left">
                <div className="friend-card-avatar">
                    {avatar ? (
                        <img src={avatar} alt="" />
                    ) : (
                        <div className="friend-card-avatar-fallback">
                            {displayName.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
            </div>
            <div className="friend-card-info">
                <div className="friend-card-name">{displayName}</div>
                <div className="friend-card-system">{systemName}</div>
                {status && <div className="friend-card-status">{status}</div>}
            </div>
            <div className="friend-card-right">
                {fronters.length > 0 && (
                    <div className="friend-card-fronters">
                        {fronters.slice(0, 3).map((f, i) => (
                            <div
                                key={i}
                                className="friend-card-front-dot"
                                style={{ backgroundColor: f.color || '#c4b5fd' }}
                                title={f.name}
                            />
                        ))}
                        {fronters.length > 3 && (
                            <span className="friend-card-front-overflow">+{fronters.length - 3}</span>
                        )}
                    </div>
                )}
                {battery != null && (
                    <span className="friend-card-battery">
                        {battery >= 70 ? '🔋' : battery >= 30 ? '🪫' : '⚠️'}
                    </span>
                )}
            </div>
        </div>
    )
}

function FriendCardList({ friends, onFriendClick, emptyMessage }) {
    if (!friends?.length) {
        return (
            <div className="empty-state">
                <span className="empty-icon">👥</span>
                <h3>{emptyMessage || 'No friends yet'}</h3>
                <p>Add friends to see their front status</p>
            </div>
        )
    }

    return (
        <div className="entity-list">
            {friends.map(friend => (
                <FriendCard
                    key={friend._id || friend.friendID}
                    friend={friend}
                    onClick={onFriendClick}
                />
            ))}
        </div>
    )
}

export { FriendCard, FriendCardList }
