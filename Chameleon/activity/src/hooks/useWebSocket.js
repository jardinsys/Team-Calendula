import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { eventToKeys } from '@chameleon/shared'

const WS_RECONNECT_DELAY = 2000
const WS_MAX_RECONNECT_DELAY = 30000

export function useWebSocket() {
  const queryClient = useQueryClient()
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)
  const reconnectDelay = useRef(WS_RECONNECT_DELAY)
  const mountedRef = useRef(true)
  const [connected, setConnected] = useState(false)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const token = localStorage.getItem('systemiser_token')
    if (!token) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const url = `${protocol}//${host}?token=${token}`

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        reconnectDelay.current = WS_RECONNECT_DELAY
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'connected') return

          const keys = eventToKeys(data)
          if (keys.length) {
            for (const key of keys) {
              queryClient.invalidateQueries({ queryKey: key })
            }
          }
        } catch (_) {}
      }

      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null
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
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  return { connected }
}
