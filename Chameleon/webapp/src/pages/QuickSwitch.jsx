// Quick Switch Page
// Fast switching interface for both Discord embeds and webapp
const { useState, useEffect } = require('react');

const { useQuery, useMutation, useQueryClient } = require('@tanstack/react-query');
const { useAuth } = require('../context/AuthContext');
const api = require('../api/client');

function QuickSwitch() {
    const { system } = useAuth();
    const queryClient = useQueryClient();

    const [selectedEntities, setSelectedEntities] = useState([]);
    const [status, setStatus] = useState('');
    const [battery, setBattery] = useState(50);
    const [showSuccess, setShowSuccess] = useState(false);

    // Fetch current front and quick entities
    const { data, isLoading, error } = useQuery({
        queryKey: ['quickSwitch'],
        queryFn: () => api.getQuickSwitch()
    });

    // Switch mutation
    const switchMutation = useMutation({
        mutationFn: (data) => api.doQuickSwitch(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['quickSwitch']);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        }
    });

    // Switch out mutation
    const switchOutMutation = useMutation({
        mutationFn: () => api.doSwitchOut(),
        onSuccess: () => {
            queryClient.invalidateQueries(['quickSwitch']);
            setSelectedEntities([]);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        }
    });

    // Initialize state from current front
    useEffect(() => {
        if (data) {
            setStatus(data.status || '');
            setBattery(data.battery ?? 50);
            setSelectedEntities(
                data.currentFront.map(f => ({ id: f._id, type: f.type }))
            );
        }
    }, [data]);

    const toggleEntity = (entity) => {
        const exists = selectedEntities.find(e => e.id === entity._id);
        if (exists) {
            setSelectedEntities(selectedEntities.filter(e => e.id !== entity._id));
        } else {
            setSelectedEntities([...selectedEntities, { id: entity._id, type: entity.type }]);
        }
    };

    const isSelected = (entityId) => {
        return selectedEntities.some(e => e.id === entityId);
    };

    const handleSwitch = () => {
        switchMutation.mutate({
            entities: selectedEntities,
            status: status || undefined,
            battery
        });
    };

    const handleSwitchOut = () => {
        switchOutMutation.mutate();
    };

    if (isLoading) {
        return (
            <div className="quick-switch-page loading">
                <div className="loading-spinner" />
                <p>Loading front data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="quick-switch-page error">
                <p>Failed to load front data: {error.message}</p>
            </div>
        );
    }

    return (
        <div className="quick-switch-page">
            {/* Header */}
            <header className="page-header">
                <h1>⚡ Quick Switch</h1>
                <p>Tap entities to toggle selection, then register your switch.</p>
            </header>

            {/* Success Toast */}
            {showSuccess && (
                <div className="success-toast">
                    ✅ Switch registered successfully!
                </div>
            )}

            {/* Current Front */}
            <section className="switch-section current-front">
                <h2>🎭 Current Front</h2>

                {data?.currentFront?.length > 0 ? (
                    <div className="fronters-grid">
                        {data.currentFront.map(fronter => (
                            <div
                                key={fronter._id}
                                className="fronter-card"
                                style={{ borderColor: fronter.color || '#888' }}
                            >
                                <div className="fronter-avatar">
                                    {fronter.avatar ? (
                                        <img src={fronter.avatar} alt="" />
                                    ) : (
                                        <div
                                            className="avatar-placeholder"
                                            style={{ backgroundColor: fronter.color || '#888' }}
                                        >
                                            {(fronter.name || '?')[0]}
                                        </div>
                                    )}
                                </div>
                                <div className="fronter-details">
                                    <span className="name">{fronter.name}</span>
                                    <span className="type-badge">{fronter.type}</span>
                                    {fronter.status && (
                                        <span className="status">{fronter.status}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="no-front">No one currently fronting</p>
                )}
            </section>

            {/* Status & Battery */}
            <section className="switch-section meta-section">
                <div className="input-group">
                    <label htmlFor="status">Status</label>
                    <input
                        id="status"
                        type="text"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        placeholder="How are you feeling?"
                        className="status-input"
                    />
                </div>

                <div className="input-group battery-group">
                    <label htmlFor="battery">🔋 Social Battery: {battery}%</label>
                    <input
                        id="battery"
                        type="range"
                        min="0"
                        max="100"
                        value={battery}
                        onChange={(e) => setBattery(parseInt(e.target.value))}
                        className="battery-slider"
                    />
                    <div className="battery-labels">
                        <span>Empty</span>
                        <span>Full</span>
                    </div>
                </div>
            </section>

            {/* Quick Select Grid */}
            <section className="switch-section quick-select">
                <h2>🚀 Quick Select</h2>
                <p className="hint">Tap to toggle. Selected entities will be switched in.</p>

                {data?.quickEntities?.length > 0 ? (
                    <div className="entities-grid">
                        {data.quickEntities.map(entity => (
                            <button
                                key={entity._id}
                                className={`entity-btn ${isSelected(entity._id) ? 'selected' : ''}`}
                                style={{
                                    '--entity-color': entity.color || '#888'
                                }}
                                onClick={() => toggleEntity(entity)}
                            >
                                <div className="entity-avatar">
                                    {entity.avatar ? (
                                        <img src={entity.avatar} alt="" />
                                    ) : (
                                        <div className="avatar-placeholder">
                                            {(entity.name || '?')[0]}
                                        </div>
                                    )}
                                </div>
                                <span className="entity-name">{entity.name}</span>
                                <span className="entity-type">{entity.type}</span>
                                {isSelected(entity._id) && (
                                    <span className="check-mark">✓</span>
                                )}
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="no-entities">
                        No recent entities. Switch using Discord commands first,
                        or add {system?.alterSynonym?.plural || 'alters'}/states to your system.
                    </p>
                )}
            </section>

            {/* Action Buttons */}
            <section className="switch-section action-bar">
                <button
                    className="btn btn-primary switch-btn"
                    onClick={handleSwitch}
                    disabled={switchMutation.isPending}
                >
                    {switchMutation.isPending ? 'Switching...' : '🔄 Register Switch'}
                </button>

                <button
                    className="btn btn-secondary switch-out-btn"
                    onClick={handleSwitchOut}
                    disabled={switchOutMutation.isPending}
                >
                    {switchOutMutation.isPending ? '...' : '📭 Switch Out (No Front)'}
                </button>
            </section>

            {/* Selected Summary */}
            {selectedEntities.length > 0 && (
                <div className="selection-summary">
                    <strong>Selected:</strong> {selectedEntities.length}{' '}
                    {selectedEntities.length === 1 ? 'entity' : 'entities'}
                </div>
            )}
        </div>
    );
}

module.exports = QuickSwitch;