import React, { useState, useRef, useEffect } from 'react'
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

const CAUTION_TYPES = [
    { value: '', label: 'None' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'crisis', label: 'Crisis' },
]

function FronterEditPopover({ fronter, onSave, onClose }) {
    const [status, setStatus] = useState(fronter.status || '')
    const [battery, setBattery] = useState(fronter.battery != null ? String(fronter.battery) : '')
    const [cautionType, setCautionType] = useState(fronter.caution?.c_type || '')
    const [cautionDetail, setCautionDetail] = useState(fronter.caution?.detail || '')
    const [applyTo, setApplyTo] = useState('shift')
    const [saving, setSaving] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                onClose()
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [onClose])

    const handleSave = async () => {
        setSaving(true)
        try {
            const data = {
                applyTo,
            }
            if (status !== '' || fronter.status !== undefined) data.status = status || null
            if (battery !== '') data.battery = battery !== '' ? Number(battery) : null
            if (cautionType) {
                data.caution = { c_type: cautionType, detail: cautionDetail || '' }
            } else {
                data.caution = null
            }
            await onSave(data)
            onClose()
        } catch (err) {
            console.error('[FronterEdit] Save error:', err)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div ref={ref} className="fronter-edit-popover">
            <div className="fronter-edit-popover-header">
                <FronterAvatar fronter={fronter} size={28} />
                <span className="fronter-edit-popover-name">{fronter.name}</span>
            </div>

            <div className="fronter-edit-popover-field">
                <label className="fronter-edit-label">Status</label>
                <input
                    className="text-input fronter-edit-input"
                    type="text"
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    placeholder="Status message..."
                    maxLength={100}
                />
            </div>

            <div className="fronter-edit-popover-field">
                <label className="fronter-edit-label">Battery</label>
                <div className="fronter-edit-battery">
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={battery !== '' ? Number(battery) : 0}
                        onChange={e => setBattery(e.target.value)}
                        className="fronter-edit-slider"
                    />
                    <input
                        className="text-input fronter-edit-input fronter-edit-battery-input"
                        type="number"
                        min="0"
                        max="100"
                        value={battery}
                        onChange={e => setBattery(e.target.value)}
                        placeholder="0-100"
                    />
                    <span className="fronter-edit-battery-unit">%</span>
                </div>
            </div>

            <div className="fronter-edit-popover-field">
                <label className="fronter-edit-label">Caution</label>
                <select
                    className="text-input fronter-edit-input"
                    value={cautionType}
                    onChange={e => setCautionType(e.target.value)}
                >
                    {CAUTION_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                </select>
                {cautionType && (
                    <input
                        className="text-input fronter-edit-input"
                        type="text"
                        value={cautionDetail}
                        onChange={e => setCautionDetail(e.target.value)}
                        placeholder="Details (optional)"
                        style={{ marginTop: '6px' }}
                    />
                )}
            </div>

            <div className="fronter-edit-popover-field">
                <label className="fronter-edit-label">Apply to</label>
                <div className="fronter-edit-apply-to">
                    {[
                        { value: 'shift', label: 'This shift only' },
                        { value: 'preset', label: 'Entity preset' },
                        { value: 'both', label: 'Both' },
                    ].map(opt => (
                        <button
                            key={opt.value}
                            className={`fronter-edit-apply-btn${applyTo === opt.value ? ' fronter-edit-apply-btn--active' : ''}`}
                            onClick={() => setApplyTo(opt.value)}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="fronter-edit-popover-actions">
                <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
                    Cancel
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>
    )
}

function FrontDisplay({ frontData, compact = false, isOwner = true, onFronterClick, onFronterSave }) {
    const [editingFronter, setEditingFronter] = useState(null)

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

    const handleFronterClick = (fronter) => {
        if (isOwner && fronter.shiftId) {
            setEditingFronter(editingFronter?._id === fronter._id ? null : fronter)
        } else if (onFronterClick) {
            onFronterClick(fronter)
        }
    }

    const handleFronterSave = async (data) => {
        if (onFronterSave && editingFronter?.shiftId) {
            await onFronterSave(editingFronter.shiftId, data)
        }
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
                            <div key={fronter._id || j} className="fronter-row" style={{ position: 'relative' }}>
                                <FronterAvatar
                                    fronter={fronter}
                                    size={40}
                                    onClick={isOwner && fronter.shiftId ? () => handleFronterClick(fronter) : (onFronterClick ? () => onFronterClick(fronter) : undefined)}
                                />
                                <div className="fronter-info">
                                    <span
                                        className={`fronter-name${(isOwner && fronter.shiftId) ? ' fronter-name--clickable' : ''}${onFronterClick ? ' fronter-name--clickable' : ''}`}
                                        style={{ color: fronter.color || 'var(--text)', cursor: (isOwner && fronter.shiftId) || onFronterClick ? 'pointer' : undefined }}
                                        onClick={() => handleFronterClick(fronter)}
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
                                {editingFronter?._id === fronter._id && (
                                    <FronterEditPopover
                                        fronter={{ ...fronter, caution: frontData.caution }}
                                        onSave={handleFronterSave}
                                        onClose={() => setEditingFronter(null)}
                                    />
                                )}
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