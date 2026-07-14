import React, { useState, useEffect } from 'react'
import { Paintbrush } from 'lucide-react'
import { Icon } from '../icons.jsx'
import api from '../api/client.js'

const COLORS = [
    '#c4b5fd', '#fda4af', '#fdba74', '#fde047',
    '#86efac', '#7dd3fc', '#d8b4fe', '#f9a8d4', '#94a3b8'
]

function normalizeHexColor(color) {
    if (!color) return null
    const cleaned = color.replace('#', '')
    if (/^[0-9A-Fa-f]{6}$/.test(cleaned)) {
        return `#${cleaned.toLowerCase()}`
    }
    return null
}

const CONDITION_OPTIONS = [
    { value: '', label: 'None' },
    { value: 'active', label: 'Active' },
    { value: 'dormant', label: 'Dormant' },
    { value: 'remission', label: 'Remission' }
]

function EntityFormModal({ entity, type = 'alter', typeLabel: typeLabelProp, onClose, onCreated, onUpdated }) {
    const isEdit = !!entity
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [pronouns, setPronouns] = useState('')
    const [color, setColor] = useState(COLORS[0])
    const [showCustomColor, setShowCustomColor] = useState(false)
    const [customColorValue, setCustomColorValue] = useState('')
    const [customColorError, setCustomColorError] = useState(false)
    const [signoff, setSignoff] = useState('')
    const [proxy, setProxy] = useState('')
    const [groupType, setGroupType] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [showMore, setShowMore] = useState(false)
    const [birthday, setBirthday] = useState('')
    const [aliases, setAliases] = useState('')
    const [cautionType, setCautionType] = useState('')
    const [cautionDetail, setCautionDetail] = useState('')
    const [condition, setCondition] = useState('')
    const [defaultStatus, setDefaultStatus] = useState('')
    const [defaultBattery, setDefaultBattery] = useState('')

    useEffect(() => {
        if (entity) {
            setName(typeof entity.name === 'string' ? entity.name : entity.name?.display || '')
            setDescription(entity.description || '')
            setPronouns(entity.pronouns?.join?.(', ') || '')
            const entityColor = entity.color
            if (entityColor && !COLORS.includes(entityColor.toLowerCase())) {
                setColor(COLORS[0])
                setShowCustomColor(true)
                setCustomColorValue(entityColor)
            } else {
                setColor(entityColor || COLORS[0])
                setShowCustomColor(false)
                setCustomColorValue('')
            }
            setSignoff(entity.signoff || '')
            setProxy(entity.proxy?.join(', ') || '')
            if (type === 'group' && entity.type) {
                setGroupType(entity.type.name || '')
            }
            if (entity.birthday) {
                const d = new Date(entity.birthday)
                const mm = String(d.getMonth() + 1).padStart(2, '0')
                const dd = String(d.getDate()).padStart(2, '0')
                setBirthday(`${d.getFullYear()}-${mm}-${dd}`)
            }
            setAliases(entity.name?.aliases?.join(', ') || '')
            if (entity.caution) {
                setCautionType(entity.caution.c_type || '')
                setCautionDetail(entity.caution.detail || '')
            }
            setCondition(entity.condition || '')
            setDefaultStatus(entity.setting?.default_status || '')
            setDefaultBattery(entity.setting?.default_battery != null ? String(entity.setting.default_battery) : '')
        }
    }, [entity, type])

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose?.()
    }

    const handleSave = async (e) => {
        e.preventDefault()
        if (!name.trim()) return

        let finalColor = color
        if (showCustomColor && customColorValue) {
            const normalized = normalizeHexColor(customColorValue)
            if (!normalized) {
                setCustomColorError(true)
                setSaving(false)
                return
            }
            finalColor = normalized
        }

        setSaving(true)
        setError(null)
        setCustomColorError(false)

        try {
            const data = {
                name: name.trim(),
                description: description.trim() || undefined,
                color: finalColor || undefined,
                signoff: signoff.trim() || undefined
            }

            if (type !== 'group') {
                data.pronouns = pronouns ? pronouns.split(',').map(p => p.trim()).filter(Boolean) : []
            }

            if (proxy.trim()) {
                data.proxy = proxy.split(',').map(p => p.trim()).filter(Boolean)
            }

            if (type === 'group') {
                data.type = { name: groupType.trim() || 'General', canFront: 'yes' }
            }

            if (isEdit) {
                if (birthday !== undefined) {
                    data.birthday = birthday || null
                }
                if (aliases !== undefined) {
                    const aliasList = aliases ? aliases.split(',').map(a => a.trim()).filter(Boolean) : []
                    data.name = {
                        ...(typeof data.name === 'string' ? { display: data.name } : data.name),
                        aliases: aliasList.length > 0 ? aliasList : undefined
                    }
                }
                if (cautionType !== undefined || cautionDetail !== undefined) {
                    data.caution = {
                        ...(entity?.caution || {}),
                        c_type: cautionType || undefined,
                        detail: cautionDetail || undefined
                    }
                }
                if (condition !== undefined) {
                    data.condition = condition || undefined
                }
                const settingUpdates = {}
                if (defaultStatus !== undefined) {
                    settingUpdates.default_status = defaultStatus || undefined
                }
                if (defaultBattery !== undefined) {
                    settingUpdates.default_battery = defaultBattery !== '' ? Number(defaultBattery) : undefined
                }
                if (Object.keys(settingUpdates).length > 0) {
                    data.setting = settingUpdates
                }
            }

            if (isEdit) {
                if (type === 'alter') await api.updateAlter(entity._id, data)
                else if (type === 'state') await api.updateState(entity._id, data)
                else if (type === 'group') await api.updateGroup(entity._id, data)
                onUpdated?.()
            } else {
                if (type === 'alter') await api.createAlter(data)
                else if (type === 'state') await api.createState(data)
                else if (type === 'group') await api.createGroup(data)
                onCreated?.()
            }

            onClose?.()
        } catch (err) {
            setError(err.message)
            setSaving(false)
        }
    }

    const typeLabel = typeLabelProp || type.charAt(0).toUpperCase() + type.slice(1)

    return (
        <div className="modal-overlay" onClick={handleBackdropClick}>
            <div className="modal-content">
                <div className="modal-header">
                    <button className="btn-ghost" onClick={onClose}>← Back</button>
                    <h2 className="modal-title">{isEdit ? `Edit ${typeLabel}` : `New ${typeLabel}`}</h2>
                    <div style={{ width: '60px' }} />
                </div>

                <form onSubmit={handleSave}>
                    <div className="form-group">
                        <label>Name</label>
                        <input
                            className="text-input"
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder={`${typeLabel} name`}
                            maxLength={100}
                            required
                            autoFocus
                        />
                    </div>

                    {type !== 'group' && (
                        <div className="form-group">
                            <label>Pronouns (comma-separated)</label>
                            <input
                                className="text-input"
                                type="text"
                                value={pronouns}
                                onChange={e => setPronouns(e.target.value)}
                                placeholder="he/him, they/them"
                            />
                        </div>
                    )}

                    {type === 'group' && (
                        <div className="form-group">
                            <label>Group type</label>
                            <input
                                className="text-input"
                                type="text"
                                value={groupType}
                                onChange={e => setGroupType(e.target.value)}
                                placeholder="e.g. Subsystem, Faction, General"
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            className="text-input"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder={`About this ${type}...`}
                            rows={3}
                        />
                    </div>

                    <div className="form-group">
                        <label>Color</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {COLORS.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => {
                                        setColor(c)
                                        setShowCustomColor(false)
                                        setCustomColorValue('')
                                        setCustomColorError(false)
                                    }}
                                    style={{
                                        width: '28px', height: '28px', borderRadius: '50%',
                                        backgroundColor: c,
                                        border: color === c && !showCustomColor ? '2px solid white' : '2px solid transparent',
                                        cursor: 'pointer',
                                        boxShadow: color === c && !showCustomColor ? `0 0 8px ${c}40` : 'none'
                                    }}
                                />
                            ))}
                            <button
                                type="button"
                                onClick={() => setShowCustomColor(!showCustomColor)}
                                style={{
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    backgroundColor: showCustomColor ? color : 'transparent',
                                    border: showCustomColor ? '2px solid white' : '2px dashed var(--glass-border)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: showCustomColor ? 'white' : 'var(--text-muted)',
                                    transition: 'all var(--transition-smooth)'
                                }}
                                aria-label={showCustomColor ? 'Use palette color' : 'Custom color'}
                            >
                                <Paintbrush size={14} strokeWidth={2.5} />
                            </button>
                            {showCustomColor && (
                                <input
                                    type="text"
                                    className="text-input"
                                    style={{ width: '100px', marginLeft: '8px' }}
                                    value={customColorValue}
                                    onChange={e => {
                                        setCustomColorValue(e.target.value)
                                        setCustomColorError(false)
                                    }}
                                    onBlur={e => {
                                        const normalized = normalizeHexColor(e.target.value)
                                        if (normalized) {
                                            setCustomColorValue(normalized)
                                        }
                                    }}
                                    placeholder="#RRGGBB"
                                    maxLength={7}
                                    spellCheck={false}
                                    autoComplete="off"
                                />
                            )}
                        </div>
                        {showCustomColor && customColorError && (
                            <p style={{ fontSize: '0.7rem', color: 'var(--color-error)', marginTop: '4px' }}>
                                Invalid hex color. Use format #RRGGBB
                            </p>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Sign-off</label>
                        <input
                            className="text-input"
                            type="text"
                            value={signoff}
                            onChange={e => setSignoff(e.target.value)}
                            placeholder="e.g. 💜"
                        />
                    </div>

                    {!isEdit && (
                        <div className="form-group">
                            <label>Proxy pattern (optional)</label>
                            <input
                                className="text-input"
                                type="text"
                                value={proxy}
                                onChange={e => setProxy(e.target.value)}
                                placeholder='e.g. a:text'
                            />
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Use "text" as a placeholder for the message content
                            </p>
                        </div>
                    )}

                    {isEdit && (
                        <div className="form-group" style={{ marginTop: '8px' }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ width: '100%', fontSize: '0.85rem' }}
                                onClick={() => setShowMore(!showMore)}
                            >
                                {showMore ? <><Icon name="chevronUp" size={14} /> Hide more options</> : <><Icon name="chevronDown" size={14} /> More options</>}
                            </button>
                        </div>
                    )}

                    {isEdit && showMore && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                            <div className="form-group">
                                <label>Birthday</label>
                                <input
                                    className="text-input"
                                    type="date"
                                    value={birthday}
                                    onChange={e => setBirthday(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label>Aliases (comma-separated)</label>
                                <input
                                    className="text-input"
                                    type="text"
                                    value={aliases}
                                    onChange={e => setAliases(e.target.value)}
                                    placeholder="e.g. nickname, alt name"
                                />
                            </div>

                            <div className="form-group">
                                <label>Caution type</label>
                                <input
                                    className="text-input"
                                    type="text"
                                    value={cautionType}
                                    onChange={e => setCautionType(e.target.value)}
                                    placeholder="e.g. trauma, flashing"
                                />
                            </div>

                            <div className="form-group">
                                <label>Caution detail</label>
                                <input
                                    className="text-input"
                                    type="text"
                                    value={cautionDetail}
                                    onChange={e => setCautionDetail(e.target.value)}
                                    placeholder="Additional caution info"
                                />
                            </div>

                            <div className="form-group">
                                <label>Condition</label>
                                <select
                                    className="text-input"
                                    value={condition}
                                    onChange={e => setCondition(e.target.value)}
                                >
                                    {CONDITION_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Default status</label>
                                <input
                                    className="text-input"
                                    type="text"
                                    value={defaultStatus}
                                    onChange={e => setDefaultStatus(e.target.value)}
                                    placeholder="e.g. feeling okay"
                                />
                            </div>

                            <div className="form-group">
                                <label>Default battery (0–100)</label>
                                <input
                                    className="text-input"
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={defaultBattery}
                                    onChange={e => setDefaultBattery(e.target.value)}
                                    placeholder="0–100"
                                />
                            </div>
                        </div>
                    )}

                    {error && (
                        <p style={{ color: 'var(--color-error)', fontSize: '0.8rem', marginBottom: '12px' }}>
                            {error}
                        </p>
                    )}

                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
                            {saving ? 'Saving...' : isEdit ? 'Save' : `Create ${typeLabel}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default EntityFormModal