// Dashboard Page
// Main dashboard with front status and quick actions

const React = require('react');
const { useAuth } = require('../context/AuthContext');
const { useQuery } = require('@tanstack/react-query');
const { Link } = require('react-router-dom');
const api = require('../api/client');

function Dashboard() {
    const { user, system, userType } = useAuth();

    // Fetch quick switch data for current front
    const { data: frontData, isLoading } = useQuery({
        queryKey: ['quickSwitch'],
        queryFn: () => api.getQuickSwitch(),
        enabled: !!system
    });

    // Fetch recent notes
    const { data: notesData } = useQuery({
        queryKey: ['quickNotes'],
        queryFn: () => api.getQuickNotes(),
        enabled: !!user
    });

    // No system yet - show setup prompt
    if (!system) {
        return (
            <div className="dashboard-page">
                <div className="welcome-card">
                    <h1>Welcome to Systemiser! 👋</h1>
                    <p>Let's set up your profile to get started.</p>
                    <Link to="/app/setup" className="btn btn-primary">
                        Set Up Your System
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-page">
            {/* Header */}
            <header className="dashboard-header">
                <h1>Dashboard</h1>
                <p>Welcome back, {system.name?.display || 'friend'}!</p>
            </header>

            {/* Front Status Card */}
            <section className="dashboard-card front-status-card">
                <div className="card-header">
                    <h2>🎭 Current Front</h2>
                    <Link to="/app/quick-switch" className="btn btn-small">
                        ⚡ Quick Switch
                    </Link>
                </div>

                {isLoading ? (
                    <div className="loading-placeholder">Loading...</div>
                ) : (
                    <div className="front-content">
                        {/* Fronters */}
                        {frontData?.currentFront?.length > 0 ? (
                            <div className="fronters-list">
                                {frontData.currentFront.map(fronter => (
                                    <div
                                        key={fronter._id}
                                        className="fronter-item"
                                        style={{ '--entity-color': fronter.color || '#888' }}
                                    >
                                        <div className="fronter-avatar">
                                            {fronter.avatar ? (
                                                <img src={fronter.avatar} alt="" />
                                            ) : (
                                                <div className="avatar-placeholder">
                                                    {(fronter.name || '?')[0]}
                                                </div>
                                            )}
                                        </div>
                                        <div className="fronter-info">
                                            <span className="fronter-name">{fronter.name}</span>
                                            <span className="fronter-type">{fronter.type}</span>
                                            {fronter.status && (
                                                <span className="fronter-status">{fronter.status}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="no-front">No one currently fronting</p>
                        )}

                        {/* Status & Battery */}
                        <div className="front-meta">
                            {frontData?.status && (
                                <div className="status-display">
                                    <span className="label">Status:</span>
                                    <span className="value">{frontData.status}</span>
                                </div>
                            )}
                            {frontData?.battery !== undefined && (
                                <div className="battery-display">
                                    <span className="label">🔋 Social Battery:</span>
                                    <div className="battery-bar">
                                        <div
                                            className="battery-fill"
                                            style={{ width: `${frontData.battery}%` }}
                                        />
                                    </div>
                                    <span className="value">{frontData.battery}%</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </section>

            {/* Quick Actions */}
            <section className="dashboard-card quick-actions-card">
                <h2>⚡ Quick Actions</h2>
                <div className="quick-actions-grid">
                    <Link to="/app/quick-switch" className="quick-action">
                        <span className="icon">🔄</span>
                        <span>Switch</span>
                    </Link>

                    <Link to="/app/notes" className="quick-action">
                        <span className="icon">📝</span>
                        <span>New Note</span>
                    </Link>

                    {userType === 'system' && (
                        <Link to="/app/alters" className="quick-action">
                            <span className="icon">➕</span>
                            <span>Add {system.alterSynonym?.singular || 'Alter'}</span>
                        </Link>
                    )}

                    {(userType === 'system' || userType === 'fractured') && (
                        <Link to="/app/states" className="quick-action">
                            <span className="icon">🔀</span>
                            <span>Add State</span>
                        </Link>
                    )}

                    <Link to="/app/friends" className="quick-action">
                        <span className="icon">💜</span>
                        <span>Friends</span>
                    </Link>
                </div>
            </section>

            {/* Recent Notes */}
            <section className="dashboard-card notes-card">
                <div className="card-header">
                    <h2>📝 Recent Notes</h2>
                    <Link to="/app/notes" className="btn btn-small">View All</Link>
                </div>

                {notesData?.notes?.length > 0 ? (
                    <div className="notes-list">
                        {notesData.notes.slice(0, 5).map(note => (
                            <div key={note._id} className="note-item">
                                <span className="note-icon">
                                    {note.pinned ? '📌' : '📝'}
                                </span>
                                <span className="note-title">{note.title}</span>
                                {note.tags?.length > 0 && (
                                    <div className="note-tags">
                                        {note.tags.slice(0, 3).map(tag => (
                                            <span key={tag} className="tag">{tag}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="no-notes">No notes yet. Create your first note!</p>
                )}
            </section>

            {/* System Stats */}
            {(userType === 'system' || userType === 'fractured') && (
                <section className="dashboard-card stats-card">
                    <h2>📊 System Stats</h2>
                    <div className="stats-grid">
                        {userType === 'system' && (
                            <div className="stat">
                                <span className="stat-value">--</span>
                                <span className="stat-label">{system.alterSynonym?.plural || 'Alters'}</span>
                            </div>
                        )}
                        <div className="stat">
                            <span className="stat-value">--</span>
                            <span className="stat-label">States</span>
                        </div>
                        <div className="stat">
                            <span className="stat-value">--</span>
                            <span className="stat-label">Groups</span>
                        </div>
                        <div className="stat">
                            <span className="stat-value">{notesData?.notes?.length || 0}</span>
                            <span className="stat-label">Notes</span>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}

module.exports = Dashboard;