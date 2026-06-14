import { useEffect, useRef, useState, useCallback } from 'react'
import { wsSend, onWsMessage } from './useWebSocket'

export function useNotePresence(noteId, username) {
  const [viewers, setViewers] = useState([])
  const [editors, setEditors] = useState([])
  const [lastSavedBy, setLastSavedBy] = useState(null)
  const noteIdRef = useRef(noteId)

  useEffect(() => {
    if (!noteId) return
    noteIdRef.current = noteId

    wsSend({ type: 'note:open', noteId, username })

    const unsubscribe = onWsMessage((data) => {
      try {
        if (data.type === 'note:presence' && data.noteId === noteId) {
          const all = data.users || []
          setViewers(all.filter(u => !u.editing))
          setEditors(all.filter(u => u.editing))
        }
        if (data.type === 'note:editing' && data.noteId === noteId) {
          setEditors(prev => {
            const exists = prev.some(u => u.userId === data.userId)
            if (data.editing && !exists) return [...prev, { userId: data.userId, username: data.username }]
            if (!data.editing) return prev.filter(u => u.userId !== data.userId)
            return prev
          })
        }
        if (data.type === 'note:saved' && data.noteId === noteId) {
          setLastSavedBy({ username: data.username, timestamp: data.timestamp })
        }
      } catch {}
    })

    return () => {
      unsubscribe()
      wsSend({ type: 'note:close', noteId: noteIdRef.current })
      setViewers([])
      setEditors([])
      setLastSavedBy(null)
    }
  }, [noteId, username])

  const notifyFocus = useCallback(() => {
    wsSend({ type: 'note:focus', noteId })
  }, [noteId])

  const notifyBlur = useCallback(() => {
    wsSend({ type: 'note:blur', noteId })
  }, [noteId])

  const notifySaved = useCallback(() => {
    wsSend({ type: 'note:saved', noteId, username })
  }, [noteId, username])

  return { viewers, editors, lastSavedBy, notifyFocus, notifyBlur, notifySaved }
}
