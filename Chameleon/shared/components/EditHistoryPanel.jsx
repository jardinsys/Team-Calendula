import React, { useState, useEffect } from 'react'
import api from '../api/client.js'

function EditHistoryPanel({ noteId, attributionStyle = 'entityAndUser' }) {
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [expanded, setExpanded] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [total, setTotal] = useState(0)

    const fetchHistory = async (reset = true) => {
        setLoading(true)
        setError(null)
        try {
            const skip = reset ? 0 : history.length
            const data = await api.getNoteHistory(noteId, skip, 20)
            if (reset) {
                setHistory(data.history || [])
            } else {
                setHistory(prev => [...prev, ...(data.history || [])])
            }
            setHasMore(data.hasMore || false)
            setTotal(data.total || 0)
        } catch (err) {
            setError(err.message)
        }
        setLoading(false)
    }

    useEffect(() => {
        if (expanded && history.length === 0) {
            fetchHistory()
        }
    }, [expanded])

    const relativeTime = (date) => {
        const now = new Date()
        const then = new Date(date)
        const diffMs = now - then
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMins / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffMins < 1) return 'just now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays < 7) return `${diffDays}d ago`
        return then.toLocaleDateString()
    }

    const actionLabel = (action) => {
        switch (action) {
            case 'create': return 'created'
            case 'edit': return 'edited'
            case 'append': return 'appended to'
            default: return 'modified'
        }
    }

    if (!expanded) {
        return (
            <button
                className="btn btn-ghost btn-sm"
                onClick={() => setExpanded(true)}
                style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}
            >
                {total > 0 ? `History (${total} edits)` : 'History'}
            </button>
        )
    }

    return (
        <div className="edit-history-panel" style={{ marginTop: '12px', borderTop: '1px solid var(--glass-border)', paddingTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Edit History</span>
                <button className="btn-ghost btn-sm" onClick={() => setExpanded(false)} style={{ fontSize: '0.75rem' }}>Hide</button>
            </div>

            {error && <p style={{ color: 'var(--color-error)', fontSize: '0.8rem' }}>{error}</p>}

            {loading && history.length === 0 ? (
                <div className="status-screen" style={{ padding: '16px' }}>
                    <div className="spinner" />
                </div>
            ) : history.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontStyle: 'italic' }}>No history yet</p>
            ) : (
                <div className="edit-history-timeline">
                    {history.map((entry, i) => (
                        <div key={i} className="edit-history-entry" style={{ display: 'flex', gap: '8px', padding: '6px 0', borderBottom: '1px solid var(--glass-border)' }}>
                            <div className="edit-history-avatars" style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                                {(entry.entities || []).map((ent, j) => (
                                    <span
                                        key={j}
                                        className="edit-history-avatar"
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            backgroundColor: ent.color || 'var(--bg-surface)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.65rem',
                                            fontWeight: 600,
                                            color: 'var(--text)',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        {ent.avatar ? (
                                            <img src={ent.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            (ent.name || '?')[0]
                                        )}
                                    </span>
                                ))}
                            </div>

                            <div className="edit-history-details" style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.8rem' }}>
                                    <span style={{ color: 'var(--text)' }}>
                                        {(entry.entities || []).map(e => e.name).join(', ') || 'Unknown'}
                                    </span>
                                    <span style={{ color: 'var(--text-secondary)', marginLeft: '4px' }}>
                                        {actionLabel(entry.action)}
                                    </span>
                                </div>
                                {attributionStyle === 'entityAndUser' && (
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.6 }}>
                                        {relativeTime(entry.timestamp)}
                                    </div>
                                )}
                            </div>

                            <div className="edit-history-time" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', flexShrink: 0, alignSelf: 'center' }}>
                                {relativeTime(entry.timestamp)}
                            </div>
                        </div>
                    ))}

                    {hasMore && (
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => fetchHistory(false)}
                            disabled={loading}
                            style={{ marginTop: '8px', fontSize: '0.8rem' }}
                        >
                            {loading ? 'Loading...' : 'Load more'}
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

export default EditHistoryPanel
