import { useState, useEffect } from 'react'
import { X, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { api } from '../index.js'

export function ShiftEditModal({ shift, entityName, onClose, onSaved }) {
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [statuses, setStatuses] = useState([])
  const [reopen, setReopen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [overlap, setOverlap] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!shift) return
    setStartTime(formatDatetimeLocal(shift.startTime))
    setEndTime(shift.endTime ? formatDatetimeLocal(shift.endTime) : '')
    setReopen(!shift.endTime)
    setStatuses((shift.statuses || []).map(s => ({
      _id: s._id,
      status: s.status || '',
      battery: s.battery ?? '',
      cautionType: s.caution?.c_type || '',
      cautionDetail: s.caution?.detail || '',
      startTime: formatDatetimeLocal(s.startTime),
      endTime: s.endTime ? formatDatetimeLocal(s.endTime) : ''
    })))
  }, [shift])

  function formatDatetimeLocal(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const offset = d.getTimezoneOffset()
    const local = new Date(d.getTime() - offset * 60000)
    return local.toISOString().slice(0, 16)
  }

  function toISO(dtLocal) {
    if (!dtLocal) return null
    return new Date(dtLocal).toISOString()
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setOverlap(null)

    try {
      const data = {
        startTime: toISO(startTime),
        endTime: reopen ? null : toISO(endTime),
        statuses: statuses.map(s => ({
          _id: s._id,
          status: s.status || null,
          battery: s.battery !== '' ? parseInt(s.battery) : null,
          caution: s.cautionType ? { c_type: s.cautionType, detail: s.cautionDetail } : null,
          startTime: toISO(s.startTime),
          endTime: s.endTime ? toISO(s.endTime) : null
        }))
      }

      const result = await api.updateShift(shift._id, data)

      if (result.overlaps?.length > 0) {
        setOverlap(result.overlaps[0])
        setSaving(false)
        return
      }

      onSaved?.()
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleMerge = async () => {
    if (!overlap) return
    setSaving(true)
    try {
      await api.mergeShifts([shift._id, overlap._id])
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to merge')
    } finally {
      setSaving(false)
    }
  }

  const addStatus = () => {
    setStatuses([...statuses, {
      status: '',
      battery: '',
      cautionType: '',
      cautionDetail: '',
      startTime: formatDatetimeLocal(new Date()),
      endTime: ''
    }])
  }

  const removeStatus = (idx) => {
    setStatuses(statuses.filter((_, i) => i !== idx))
  }

  const updateStatus = (idx, field, value) => {
    const next = [...statuses]
    next[idx] = { ...next[idx], [field]: value }
    setStatuses(next)
  }

  if (!shift) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-accent">Edit Shift — {entityName}</h3>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
          {overlap && (
            <div className="overlap-warning">
              <AlertTriangle size={16} />
              <span>This shift overlaps with another shift for this entity ({overlap.type_name}).</span>
              <button className="btn-accent btn-sm" onClick={handleMerge} disabled={saving}>
                Merge
              </button>
            </div>
          )}

          {error && <div className="error-text">{error}</div>}

          <label className="field-label">Start Time</label>
          <input
            type="datetime-local"
            className="field-input"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
          />

          <label className="field-label">End Time</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="datetime-local"
              className="field-input"
              value={endTime}
              disabled={reopen}
              onChange={e => setEndTime(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              className={`btn-ghost btn-sm ${reopen ? 'active' : ''}`}
              onClick={() => setReopen(!reopen)}
              title="Reopen shift (set end time to null)"
            >
              Reopen
            </button>
          </div>

          <div className="statuses-section">
            <div className="statuses-header">
              <span className="field-label" style={{ margin: 0 }}>Status Entries</span>
              <button className="btn-ghost btn-sm" onClick={addStatus}>
                <Plus size={14} /> Add
              </button>
            </div>

            {statuses.length === 0 && (
              <p className="empty-text">No status entries</p>
            )}

            {statuses.map((s, idx) => (
              <div key={idx} className="status-entry">
                <div className="status-entry-header">
                  <input
                    type="text"
                    className="field-input"
                    placeholder="Status text"
                    value={s.status}
                    onChange={e => updateStatus(idx, 'status', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className="btn-ghost btn-icon" onClick={() => removeStatus(idx)} title="Remove">
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="status-entry-fields">
                  <div className="field-group">
                    <label className="field-label-sm">Battery</label>
                    <input
                      type="number"
                      className="field-input field-input-sm"
                      min="0"
                      max="100"
                      placeholder="0-100"
                      value={s.battery}
                      onChange={e => updateStatus(idx, 'battery', e.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label-sm">Caution</label>
                    <select
                      className="field-input field-input-sm"
                      value={s.cautionType}
                      onChange={e => updateStatus(idx, 'cautionType', e.target.value)}
                    >
                      <option value="">None</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="crisis">Crisis</option>
                    </select>
                  </div>
                </div>

                {s.cautionType && (
                  <input
                    type="text"
                    className="field-input"
                    placeholder="Caution detail"
                    value={s.cautionDetail}
                    onChange={e => updateStatus(idx, 'cautionDetail', e.target.value)}
                  />
                )}

                <div className="status-entry-fields">
                  <div className="field-group">
                    <label className="field-label-sm">Status Start</label>
                    <input
                      type="datetime-local"
                      className="field-input field-input-sm"
                      value={s.startTime}
                      onChange={e => updateStatus(idx, 'startTime', e.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label-sm">Status End</label>
                    <input
                      type="datetime-local"
                      className="field-input field-input-sm"
                      value={s.endTime}
                      onChange={e => updateStatus(idx, 'endTime', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-accent" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
