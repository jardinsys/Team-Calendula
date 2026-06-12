import React from 'react'
import { Icon, getBatteryIcon } from '../icons.jsx'

function FriendCard({ friend, onClick, fallbackName }) {
    const displayName = friend.customName || friend.system?.name || fallbackName || 'Unknown'
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
                        {(() => { const b = getBatteryIcon(battery); return b ? <Icon name={b.name} size={14} color={b.color} /> : null })()}
                    </span>
                )}
            </div>
        </div>
    )
}

function FriendCardList({ friends, onFriendClick, emptyMessage, fallbackName }) {
    if (!friends?.length) {
        return (
            <div className="empty-state">
                <span className="empty-icon"><Icon name="users" size={48} /></span>
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
                    fallbackName={fallbackName}
                />
            ))}
        </div>
    )
}

export { FriendCard, FriendCardList }
