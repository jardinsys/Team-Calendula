// Sync client — speaks the @robojs/sync wire protocol directly against
// the JWT-gated /sync endpoint on the same host. Alternative to the
// plugin's SyncContextProvider, which can't attach the auth token.
//
// Protocol (JSON per message):
//   client->server: { type:'on'|'off', key:[..] } watch/unwatch a key
//                   { type:'update', key:[..], data } write shared state
//                   { type:'pong' } respond to keepalive ping
//   server->client: { type:'ping' } keepalive
//                   { type:'update', key:[..], data } state change

class SyncClient {
  constructor() {
    this.ws = null
    this.messageCbs = new Map()   // cleanKey -> Set<fn>
    this.connCbs = new Set()
    this.cache = new Map()        // cleanKey -> last data
    this.backoff = 1000
    this.manualClose = false
    this.pingTimer = null
    this.reconnectTimer = null
    this.connected = false
  }

  connect() {
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return
    if (typeof window === 'undefined') return
    const token = window.localStorage.getItem('systemiser_token')
    if (!token) return

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${proto}//${window.location.host}/sync?token=${encodeURIComponent(token)}`

    try {
      const ws = new WebSocket(url)
      this.ws = ws
      this.manualClose = false

      ws.onopen = () => {
        this.connected = true
        this.backoff = 1000
        for (const fn of this.connCbs) { try { fn(true) } catch (_) {} }
        // Re-arm watches after any reconnect
        for (const key of this.messageCbs.keys()) {
          this._send({ type: 'on', key: key.split('.') })
        }
        if (!this.pingTimer) {
          this.pingTimer = setInterval(() => this._send({ type: 'ping' }), 25000)
        }
      }

      ws.onmessage = (event) => {
        let data
        try { data = JSON.parse(event.data) } catch (_) { return }
        if (data.type === 'ping') {
          this._send({ type: 'pong' })
          return
        }
        if (data.type !== 'update' || !Array.isArray(data.key)) return
        const cleanKey = data.key.join('.')
        this.cache.set(cleanKey, data.data)
        const cbs = this.messageCbs.get(cleanKey)
        if (cbs) {
          for (const fn of cbs) { try { fn(data.data, data.key) } catch (_) {} }
        }
      }

      ws.onclose = () => {
        this.connected = false
        for (const fn of this.connCbs) { try { fn(false) } catch (_) {} }
        if (!this.manualClose) {
          this.scheduleReconnect()
        }
      }
      ws.onerror = () => { try { ws.close() } catch (_) {} }
    } catch (_) {
      this.scheduleReconnect()
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.backoff = Math.min(this.backoff * 2, 30000)
      this.connect()
    }, this.backoff)
  }

  ensureConnected() {
    if (!this.connected && !this.ws) this.connect()
    if (this.ws && this.ws.readyState === 3) {
      this.ws = null
      this.connect()
    }
  }

  _send(obj) {
    if (this.ws?.readyState === 1) {
      this.ws.send(JSON.stringify(obj))
    }
  }

  // Watch a key. Returns unsubscribe.
  watch(key, fn) {
    const cleanKey = Array.isArray(key) ? key.join('.') : String(key)
    if (!this.messageCbs.has(cleanKey)) {
      this.messageCbs.set(cleanKey, new Set())
      this._send({ type: 'on', key: Array.isArray(key) ? key : [key] })
    }
    this.messageCbs.get(cleanKey).add(fn)
    // Replay last known value for immediate hydration
    const cached = this.cache.get(cleanKey)
    if (cached !== undefined) { try { fn(cached, cleanKey.split('.')) } catch (_) {} }
    return () => {
      const set = this.messageCbs.get(cleanKey)
      if (!set) return
      set.delete(fn)
      if (set.size === 0) {
        this.messageCbs.delete(cleanKey)
        this._send({ type: 'off', key: Array.isArray(key) ? key : [key] })
      }
    }
  }

  update(key, data) {
    this._send({ type: 'update', key: Array.isArray(key) ? key : [key], data })
  }

  close() {
    this.manualClose = true
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null }
    if (this.ws) { try { this.ws.close() } catch (_) {} this.ws = null }
    this.connected = false
  }
}

export const syncClient = new SyncClient()
