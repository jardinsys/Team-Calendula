// Sync bridge over syncClient. Keeps the legacy hook surface
// (useWebSocket / wsSend / onConnectionChange / onWsMessage / syncUpdate /
// syncWatch) so Activity.jsx and useNotePresence.js keep working.
import { useEffect, useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { eventToKeys } from '@chameleon/shared'
import { syncClient } from './syncClient'

// Legacy message fan-out (useNotePresence etc.) keyed by cleanKey
const messageCbs = new Map()

export function useWebSocket(enabled = true) {
  const [connected, setConnected] = useState(false)
  const [disconnected, setDisconnected] = useState(false)
  const queryClient = useQueryClient()
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const onConn = (up) => {
      if (mounted.current) {
        setConnected(up)
        setDisconnected(!up)
      }
    }
    syncClient.connCbs.add(onConn)
    setConnected(syncClient.connected)
    setDisconnected(syncClient.ws !== null && !syncClient.connected)
    syncClient.ensureConnected()
    return () => {
      mounted.current = false
      syncClient.connCbs.delete(onConn)
    }
  }, [enabled])

  // Server bridges Redis system events onto the well-known key ['evt','_all']
  // (see server.js broadcastSystemEvent — events carry systemId in payload).
  useEffect(() => {
    if (!enabled) return
    const off = syncClient.watch(['evt', '_all'], (data) => {
      if (!data?.event) return
      const keys = eventToKeys(data.event)
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: key })
      }
      const legacySet = messageCbs.get('evt._all')
      if (legacySet) {
        for (const fn of legacySet) { try { fn(data.event) } catch (_) {} }
      }
    })
    syncClient.ensureConnected()
    return () => { off() }
  }, [enabled, queryClient])

  return { connected, disconnected }
}

// Legacy API preserved -----------------------------------------------

export function initSyncIdentity() {
  syncClient.ensureConnected()
  // hello frame carries { userId, systemId } — private per-connection
  return syncClient.watch(['hello'], (data) => {
    if (data?.userId) {
      syncClient.lastIdentity = { userId: data.userId, systemId: data.systemId }
    }
  })
}

export function onWsMessage(fn) {
  if (!messageCbs.has('evt._all')) messageCbs.set('evt._all', new Set())
  messageCbs.get('evt._all').add(fn)
  return () => {
    const set = messageCbs.get('evt._all')
    if (set) {
      set.delete(fn)
      if (set.size === 0) messageCbs.delete('evt._all')
    }
  }
}

export function onConnectionChange(fn) {
  syncClient.connCbs.add(fn)
  return () => syncClient.connCbs.delete(fn)
}

// Legacy no-op — presence sends now go through syncUpdate()
export function wsSend(data) {}

// Shared-state write/watch helpers for hooks like useNotePresence
export function syncUpdate(key, data) {
  syncClient.ensureConnected()
  syncClient.update(key, data)
}

export function syncWatch(key, fn) {
  syncClient.ensureConnected()
  return syncClient.watch(key, fn)
}
