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

function getToken() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem('systemiser_token')
}

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
    const token = getToken()
    if (!token) return

    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const url = `${protocol}//${host}?token=${encodeURIComponent(token)}`

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws
      globalWs = ws

      ws.onopen = () => {
        openedAt.current = Date.now()
        setConnected(true)
        setDisconnected(false)
        for (const fn of globalListeners) fn(true)

        if (pingInterval.current) clearInterval(pingInterval.current)
        pingInterval.current = setInterval(() => {
          sendRaw({ type: 'ping' })
        }, WS_PING_INTERVAL)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'ping') {
            sendRaw({ type: 'pong' })
            return
          }
          if (data.type === 'connected') return

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
        if (pingInterval.current) {
          clearInterval(pingInterval.current)
          pingInterval.current = null
        }
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

    const tokenChanged = () => {
      const token = getToken()
      if (token) {
        reconnectDelay.current = WS_RECONNECT_DELAY
        connect()
      }
    }

    const onCrossStorage = (event) => {
      if (event.key === 'systemiser_token') tokenChanged()
    }
    const onCustom = (event) => {
      if (event?.detail?.key === 'systemiser_token') tokenChanged()
    }
    const onFocus = () => tokenChanged()
    const onDiscordFrameUpdate = () => tokenChanged()

    window.addEventListener('storage', onCrossStorage)
    window.addEventListener('systemiser_token_updated', onCustom)
    window.addEventListener('focus', onFocus)
    window.addEventListener('discord_frame_update', onDiscordFrameUpdate)

    return () => {
      mountedRef.current = false
      window.removeEventListener('storage', onCrossStorage)
      window.removeEventListener('systemiser_token_updated', onCustom)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('discord_frame_update', onDiscordFrameUpdate)
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
