// Note presence over the sync protocol.
// Client writes its room state to np.<noteId>; the server merges it into
// a per-note room and broadcasts npp.<noteId> updates to all watchers.
import { useEffect, useRef, useState, useCallback } from 'react'
import { syncUpdate, syncWatch } from './useWebSocket'
import { syncClient } from './syncClient'

// Lazily-learned identity (userId) from the server's hello frame.
// initSyncIdentity lives in useWebSocket.js; import from there.
import { initSyncIdentity } from './useWebSocket'

export { initSyncIdentity }

export function useNotePresence(noteId, username) {
  const [viewers, setViewers] = useState([])
  const [editors, setEditors] = useState([])
  const [lastSavedBy, setLastSavedBy] = useState(null)
  const noteIdRef = useRef(noteId)
  const usernameRef = useRef(username)

  useEffect(() => { usernameRef.current = username }, [username])

  useEffect(() => {
    if (!noteId) return
    noteIdRef.current = noteId

    // Announce ourselves in the room (server merges + broadcasts)
    syncUpdate(['np', noteId], { username: usernameRef.current, editing: false })

    // Watch the merged room state
    const off = syncWatch(['npp', noteId], (data) => {
      const all = data?.users || []
      setViewers(all.filter(u => !u.editing))
      setEditors(all.filter(u => u.editing))
      if (data?.lastSaved && data.lastSaved.userId !== syncClient.lastIdentity?.userId) {
        setLastSavedBy({ username: data.lastSaved.username, timestamp: data.lastSaved.timestamp })
      }
    })

    return () => {
      off()
      // Server drops us when the socket closes; for live in-app navigation
      // signal departure via a 'leaving' write the server merges out.
      syncUpdate(['np', noteIdRef.current], { leaving: true })
      setViewers([])
      setEditors([])
      setLastSavedBy(null)
    }
  }, [noteId])

  const notifyFocus = useCallback(() => {
    if (!noteIdRef.current) return
    syncUpdate(['np', noteIdRef.current], { username: usernameRef.current, editing: true })
  }, [])

  const notifyBlur = useCallback(() => {
    if (!noteIdRef.current) return
    syncUpdate(['np', noteIdRef.current], { username: usernameRef.current, editing: false })
  }, [])

  const notifySaved = useCallback(() => {
    if (!noteIdRef.current) return
    syncUpdate(['np', noteIdRef.current], { username: usernameRef.current, editing: false, saved: true })
  }, [])

  return { viewers, editors, lastSavedBy, notifyFocus, notifyBlur, notifySaved }
}
