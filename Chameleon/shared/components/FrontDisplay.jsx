import React from 'react'
import { Icon, getBatteryIcon } from '../icons.jsx'

function formatDuration(ms) {
    if (!ms || ms < 0) return ''
    const hours = Math.floor(ms / 3600000)
    const minutes = Math.floor((ms % 3600000) / 60000)
    if (hours > 0) return `${hours}h ${minutes}m`
    if (minutes > 0) return `${minutes}m`
    return 'just now'
}

function FronterAvatar({ fronter, size = 40, onClick }) {
    const color = fronter.color || '#c4b5fd'
    const name = fronter.name || '?'
    const avatar = fronter.avatar

    return (
        <div
            className={`fronter-avatar${onClick ? ' fronter-avatar--clickable' : ''}`}
            style={{ width: size, height: size, cursor: onClick ? 'pointer' : undefined }}
            onClick={onClick}
        >
            {avatar ? (
                <img src={avatar} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
                <div
                    className="fronter-avatar-fallback"
                    style={{
                        width: size, height: size, borderRadius: '50%',
                        backgroundColor: color, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: '#fff', fontSize: size * 0.4,
                        fontFamily: 'var(--font-accent)', fontWeight: 700
                    }}
                >
                    {name.charAt(0).toUpperCase()}
                </div>
            )}
        </div>
    )
}

function FrontDisplay({ frontData, compact = false, isOwner = true, onFronterClick }) {
    if (!frontData) {
        return (
            <div className="front-display empty-state">
                <span className="empty-icon"><Icon name="moon" size={48} /></span>
                <h3>No one is fronting</h3>
            </div>
        )
    }

    const { status, battery, caution, layers = [] } = frontData
    const activeLayers = layers.filter(l => l.fronters?.length > 0)

    if (activeLayers.length === 0 && !status) {
        return (
            <div className="front-display empty-state">
                <span className="empty-icon"><Icon name="moon" size={48} /></span>
                <h3>No one is fronting</h3>
            </div>
        )
    }

    if (compact) {
        const allFronters = activeLayers.flatMap(l => l.fronters || [])
        return (
            <div className="front-display front-display--compact">
                <div className="front-display-fronters">
                    {allFronters.slice(0, 6).map((f, i) => (
                        <FronterAvatar key={f._id || i} fronter={f} size={32} onClick={onFronterClick ? () => onFronterClick(f) : undefined} />
                    ))}
                    {allFronters.length > 6 && (
                        <span className="front-display-overflow">+{allFronters.length - 6}</span>
                    )}
                </div>
                {status && (
                    <div className="front-display-status">{status}</div>
                )}
                {isOwner && battery != null && (
                    <span className="front-display-battery">
                        {(() => { const b = getBatteryIcon(battery); return b ? <Icon name={b.name} size={14} color={b.color} /> : null })()}
                        {' '}{battery}%
                    </span>
                )}
            </div>
        )
    }

    return (
        <div className="front-display">
            {(status || battery != null) && (
                <div className="front-display-header">
                    {status && <div className="front-display-status">{status}</div>}
                    {isOwner && battery != null && (
                        <div className="front-display-battery">
                            {(() => { const b = getBatteryIcon(battery); return b ? <Icon name={b.name} size={14} color={b.color} /> : null })()}
                            {' '}{battery}%
                        </div>
                    )}
                </div>
            )}

            {activeLayers.map((layer, i) => (
                <div key={layer._id || i} className="front-layer">
                    {activeLayers.length > 1 && (
                        <div className="front-layer-name" style={{ color: layer.color || 'var(--text-secondary)' }}>
                            {layer.name || `Layer ${i + 1}`}
                        </div>
                    )}
                    <div className="front-layer-fronters">
                        {layer.fronters?.map((fronter, j) => (
                            <div key={fronter._id || j} className="fronter-row">
                                <FronterAvatar fronter={fronter} size={40} onClick={onFronterClick ? () => onFronterClick(fronter) : undefined} />
                                <div className="fronter-info">
                                    <span
                                        className={`fronter-name${onFronterClick ? ' fronter-name--clickable' : ''}`}
                                        style={{ color: fronter.color || 'var(--text)', cursor: onFronterClick ? 'pointer' : undefined }}
                                        onClick={onFronterClick ? () => onFronterClick(fronter) : undefined}
                                    >
                                        {fronter.name}
                                    </span>
                                    {fronter.status && (
                                        <span className="fronter-status">{fronter.status}</span>
                                    )}
                                    {fronter.startTime && (
                                        <span className="fronter-duration">
                                            {formatDuration(Date.now() - new Date(fronter.startTime).getTime())}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

export default FrontDisplay
export { FronterAvatar, FrontDisplay }
