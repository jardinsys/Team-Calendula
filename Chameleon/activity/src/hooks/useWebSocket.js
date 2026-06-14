import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { eventToKeys } from '@chameleon/shared'

const WS_RECONNECT_DELAY = 2000
const WS_MAX_RECONNECT_DELAY = 30000
const WS_PING_INTERVAL = 25000
const WS_STABLE_CONNECTION_MS = 10000

let globalWs = null
let globalListeners = new Set()
let globalMessageListeners = new Set()

function sendRaw(data) {
  if (globalWs?.readyState === WebSocket.OPEN) {
    globalWs.send(JSON.stringify(data))
  }
}

export function useWebSocket() {
  const queryClient = useQueryClient()
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)
  const reconnectDelay = useRef(WS_RECONNECT_DELAY)
  const mountedRef = useRef(true)
  const openedAt = useRef(null)
  const pingInterval = useRef(null)
  const [connected, setConnected] = useState(false)
  const [disconnected, setDisconnected] = useState(false)

  const connect = useCallback(() => {
    // Guard against OPEN and CONNECTING states
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return

    const token = localStorage.getItem('systemiser_token')
    if (!token) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const url = `${protocol}//${host}?token=${token}`

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws
      globalWs = ws

      ws.onopen = () => {
        openedAt.current = Date.now()
        setConnected(true)
        setDisconnected(false)
        for (const fn of globalListeners) fn(true)

        // Start client-side JSON ping (bypasses Discord proxy stripping protocol-level pings)
        if (pingInterval.current) clearInterval(pingInterval.current)
        pingInterval.current = setInterval(() => {
          sendRaw({ type: 'ping' })
        }, WS_PING_INTERVAL)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          // Auto-respond to server JSON pings
          if (data.type === 'ping') {
            sendRaw({ type: 'pong' })
            return
          }

          if (data.type === 'connected') return

          // Notify message listeners (for hooks like useNotePresence)
          for (const fn of globalMessageListeners) {
            try { fn(data) } catch (_) {}
          }

          const keys = eventToKeys(data)
          if (keys.length) {
            for (const key of keys) {
              queryClient.invalidateQueries({ queryKey: key })
            }
          }
        } catch (_) {}
      }

      ws.onclose = () => {
        // Stop ping interval
        if (pingInterval.current) {
          clearInterval(pingInterval.current)
          pingInterval.current = null
        }

        // Only reset backoff if connection was stable (open for > 10s)
        const wasStable = openedAt.current && (Date.now() - openedAt.current) > WS_STABLE_CONNECTION_MS
        if (wasStable) {
          reconnectDelay.current = WS_RECONNECT_DELAY
        }

        setConnected(false)
        setDisconnected(true)
        for (const fn of globalListeners) fn(false)
        wsRef.current = null
        globalWs = null

        if (mountedRef.current) {
          reconnectTimer.current = setTimeout(() => {
            reconnectDelay.current = Math.min(reconnectDelay.current * 2, WS_MAX_RECONNECT_DELAY)
            connect()
          }, reconnectDelay.current)
        }
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch (_) {}
  }, [queryClient])

  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (pingInterval.current) clearInterval(pingInterval.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
        globalWs = null
      }
    }
  }, [connect])

  return { connected, disconnected }
}

// Expose send for note presence events
export function wsSend(data) {
  sendRaw(data)
}

// Subscribe to connection state changes (for components outside the provider)
export function onConnectionChange(fn) {
  globalListeners.add(fn)
  return () => globalListeners.delete(fn)
}

// Subscribe to WebSocket messages (for hooks like useNotePresence)
export function onWsMessage(fn) {
  globalMessageListeners.add(fn)
  return () => globalMessageListeners.delete(fn)
}
