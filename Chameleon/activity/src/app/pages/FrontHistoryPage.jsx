import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, List, Calendar, Trash2, Edit3, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react'
import { api, getBatteryIcon, frontKeys } from '@chameleon/shared'
import { ShiftEditModal } from '../components/ShiftEditModal.jsx'

function formatDuration(ms) {
  if (!ms || ms < 0) return '—'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 24) {
    const d = Math.floor(h / 24)
    const rh = h % 24
    return `${d}d ${rh}h`
  }
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function batteryEmoji(level) {
  if (level == null) return ''
  if (level >= 70) return '🔋'
  if (level >= 30) return '🪫'
  return '⚠️'
}

export function FrontHistoryPage({ system, onNavigate }) {
  const queryClient = useQueryClient()
  const [view, setView] = useState('list')
  const [dateRange, setDateRange] = useState('7d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [editingShift, setEditingShift] = useState(null)
  const [editingEntityName, setEditingEntityName] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const getDateRange = useCallback(() => {
    const now = new Date()
    let from = null
    const to = now.toISOString()

    switch (dateRange) {
      case '24h': from = new Date(now - 86400000).toISOString(); break
      case '7d': from = new Date(now - 7 * 86400000).toISOString(); break
      case '30d': from = new Date(now - 30 * 86400000).toISOString(); break
      case 'custom':
        from = customFrom ? new Date(customFrom).toISOString() : null
        break
      default: from = new Date(now - 7 * 86400000).toISOString()
    }
    return { from, to }
  }, [dateRange, customFrom, customTo])

  const { from, to } = getDateRange()

  const [allShifts, setAllShifts] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loadMoreError, setLoadMoreError] = useState(null)
  const isAccumulating = useRef(false)

  const { data, isLoading: loading, error: queryError } = useQuery({
    queryKey: frontKeys.history({ limit: 100, from, to }),
    queryFn: async () => {
      return api.getFrontHistory(100, undefined, from, to)
    },
  })

  useEffect(() => {
    if (data && !isAccumulating.current) {
      setAllShifts(data.history || [])
      setNextCursor(data.hasMore ? data.history?.[data.history.length - 1]?.startTime : null)
    }
    isAccumulating.current = false
  }, [data])

  const shifts = allShifts
  const hasMore = nextCursor != null
  const [loadingMore, setLoadingMore] = useState(false)
  const error = loadMoreError || (queryError ? queryError.message : null)

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    setLoadMoreError(null)
    isAccumulating.current = true
    try {
      const nextPage = await api.getFrontHistory(100, nextCursor, from, to)
      setAllShifts(prev => [...prev, ...(nextPage.history || [])])
      setNextCursor(nextPage.hasMore ? nextPage.history?.[nextPage.history.length - 1]?.startTime : null)
    } catch (err) {
      setLoadMoreError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }

  const handleDelete = async (shiftId) => {
    try {
      await api.deleteShift(shiftId)
      queryClient.invalidateQueries({ queryKey: frontKeys.all })
      setDeletingId(null)
    } catch (err) {
      console.error('Failed to delete shift:', err)
    }
  }

  const handleEdit = (shift) => {
    setEditingShift(shift)
    setEditingEntityName(shift.entityName)
  }

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: frontKeys.all })
    setEditingShift(null)
  }

  // Group shifts by date
  const shiftsByDate = {}
  for (const shift of shifts) {
    const dateKey = new Date(shift.startTime).toLocaleDateString()
    if (!shiftsByDate[dateKey]) shiftsByDate[dateKey] = []
    shiftsByDate[dateKey].push(shift)
  }

  // Build timeline segments for the timeline view
  const buildTimelineSegments = () => {
    if (shifts.length === 0) return []

    const { from, to } = getDateRange()
    const rangeStart = from ? new Date(from).getTime() : new Date(shifts[shifts.length - 1].startTime).getTime()
    const rangeEnd = new Date(to).getTime()
    const totalDuration = rangeEnd - rangeStart

    const segments = []
    const sortedShifts = [...shifts].sort((a, b) => new Date(a.startTime) - new Date(b.startTime))

    let lastEnd = rangeStart

    for (const shift of sortedShifts) {
      const shiftStart = new Date(shift.startTime).getTime()
      const shiftEnd = shift.endTime ? new Date(shift.endTime).getTime() : rangeEnd

      // Gap before this shift
      if (shiftStart > lastEnd + 60000) {
        segments.push({
          type: 'gap',
          start: lastEnd,
          end: shiftStart,
          width: ((shiftStart - lastEnd) / totalDuration) * 100
        })
      }

      segments.push({
        type: 'shift',
        shift,
        start: Math.max(shiftStart, rangeStart),
        end: Math.min(shiftEnd, rangeEnd),
        width: (Math.min(shiftEnd, rangeEnd) - Math.max(shiftStart, rangeStart)) / totalDuration * 100,
        color: shift.color || 'var(--accent)'
      })

      lastEnd = Math.min(shiftEnd, rangeEnd)
    }

    // Final gap
    if (lastEnd < rangeEnd - 60000) {
      segments.push({
        type: 'gap',
        start: lastEnd,
        end: rangeEnd,
        width: ((rangeEnd - lastEnd) / totalDuration) * 100
      })
    }

    return segments
  }

  return (
    <div className="front-history-page">
      <div className="page-header">
        <h2 className="font-title">Front History</h2>
        <p>Track who has been fronting over time</p>
      </div>

      <div className="history-controls">
        <div className="view-toggle">
          <button
            className={`view-btn ${view === 'list' ? 'active' : ''}`}
            onClick={() => setView('list')}
            title="List View"
          >
            <List size={16} />
          </button>
          <button
            className={`view-btn ${view === 'timeline' ? 'active' : ''}`}
            onClick={() => setView('timeline')}
            title="Timeline View"
          >
            <Clock size={16} />
          </button>
        </div>

        <div className="date-range-controls">
          {['24h', '7d', '30d'].map(r => (
            <button
              key={r}
              className={`range-btn ${dateRange === r ? 'active' : ''}`}
              onClick={() => setDateRange(r)}
            >
              {r}
            </button>
          ))}
          <button
            className={`range-btn ${dateRange === 'custom' ? 'active' : ''}`}
            onClick={() => setDateRange('custom')}
          >
            Custom
          </button>
        </div>

        {dateRange === 'custom' && (
          <div className="custom-date-inputs">
            <input
              type="date"
              className="field-input field-input-sm"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
            />
            <span className="date-separator">to</span>
            <input
              type="date"
              className="field-input field-input-sm"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading history...</p>
        </div>
      ) : shifts.length === 0 ? (
        <div className="empty-state">
          <Clock size={48} strokeWidth={1} />
          <p>No shifts found for this period</p>
        </div>
      ) : view === 'timeline' ? (
        <div className="timeline-view">
          <div className="timeline-bar">
            {buildTimelineSegments().map((seg, i) => (
              <div
                key={i}
                className={`timeline-segment ${seg.type}`}
                style={{
                  width: `${Math.max(seg.width, 0.5)}%`,
                  backgroundColor: seg.type === 'gap' ? 'var(--bg-surface)' : seg.color
                }}
                onClick={() => seg.type === 'shift' && handleEdit(seg.shift)}
                title={seg.type === 'shift'
                  ? `${seg.shift.entityName} — ${formatDuration(seg.shift.duration)}`
                  : 'Baseline'}
              >
                {seg.width > 5 && seg.type === 'shift' && (
                  <span className="timeline-label">{seg.shift.entityName}</span>
                )}
                {seg.type === 'gap' && seg.width > 3 && (
                  <span className="timeline-label gap-label">Baseline</span>
                )}
              </div>
            ))}
          </div>

          <div className="timeline-legend">
            {shifts.slice(0, 10).map((s, i) => (
              <div key={i} className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: s.color || 'var(--accent)' }} />
                <span>{s.entityName}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="list-view">
          {Object.entries(shiftsByDate).map(([date, dateShifts]) => (
            <div key={date} className="date-group">
              <div className="date-header font-accent">{date}</div>
              {dateShifts.map(shift => (
                <div key={shift._id} className="shift-card">
                  <div
                    className="shift-card-main"
                    onClick={() => setExpandedId(expandedId === shift._id ? null : shift._id)}
                  >
                    <div className="shift-avatar">
                      {shift.avatar ? (
                        <img src={shift.avatar} alt="" className="shift-avatar-img" />
                      ) : (
                        <div
                          className="shift-avatar-placeholder"
                          style={{ backgroundColor: shift.color || 'var(--accent)' }}
                        >
                          {shift.entityName?.[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="shift-info">
                      <div className="shift-name font-accent">{shift.entityName}</div>
                      <div className="shift-time">
                        {formatTime(shift.startTime)} — {shift.endTime ? formatTime(shift.endTime) : 'now'}
                        <span className="shift-duration">{formatDuration(shift.duration)}</span>
                      </div>
                      {shift.statuses?.[shift.statuses.length - 1]?.status && (
                        <div className="shift-status">
                          {shift.statuses[shift.statuses.length - 1].status}
                        </div>
                      )}
                    </div>

                    <div className="shift-meta">
                      {shift.statuses?.[shift.statuses.length - 1]?.battery != null && (
                        <span className="shift-battery">
                          {batteryEmoji(shift.statuses[shift.statuses.length - 1].battery)}
                          {shift.statuses[shift.statuses.length - 1].battery}%
                        </span>
                      )}
                      {expandedId === shift._id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {expandedId === shift._id && (
                    <div className="shift-expanded">
                      <div className="shift-actions">
                        <button className="btn-ghost btn-sm" onClick={() => handleEdit(shift)}>
                          <Edit3 size={14} /> Edit
                        </button>
                        {deletingId === shift._id ? (
                          <div className="delete-confirm">
                            <span className="delete-warning">Delete this shift permanently?</span>
                            <button className="btn-danger btn-sm" onClick={() => handleDelete(shift._id)}>Delete</button>
                            <button className="btn-ghost btn-sm" onClick={() => setDeletingId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <button className="btn-ghost btn-sm btn-danger-text" onClick={() => setDeletingId(shift._id)}>
                            <Trash2 size={14} /> Delete
                          </button>
                        )}
                      </div>

                      {shift.statuses?.length > 0 && (
                        <div className="shift-statuses-timeline">
                          {shift.statuses.map((s, i) => (
                            <div key={i} className="status-timeline-entry">
                              <div className="status-timeline-dot" style={{ backgroundColor: shift.color || 'var(--accent)' }} />
                              <div className="status-timeline-content">
                                <div className="status-timeline-time">
                                  {formatTime(s.startTime)}
                                  {s.endTime && ` — ${formatTime(s.endTime)}`}
                                </div>
                                {s.status && <div className="status-timeline-text">{s.status}</div>}
                                <div className="status-timeline-meta">
                                  {s.battery != null && <span>{batteryEmoji(s.battery)} {s.battery}%</span>}
                                  {s.caution && <span className="caution-badge">{s.caution.c_type}</span>}
                                  {s.layerName && <span className="layer-badge">{s.layerName}</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {shifts.length > 0 && hasMore && (
        <div className="load-more-container" style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
          <button
            className="btn btn-ghost"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {editingShift && (
        <ShiftEditModal
          shift={editingShift}
          entityName={editingEntityName}
          onClose={() => setEditingShift(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
