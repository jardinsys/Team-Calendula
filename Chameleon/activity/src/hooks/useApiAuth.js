import { useState, useEffect } from 'react'
import { useDiscordSdk } from '../hooks/useDiscordSdk'
import { api } from '@chameleon/shared'

export function useApiAuth() {
  const { accessToken, session, status, isMock } = useDiscordSdk()
  const [jwt, setJwt] = useState(null)
  const [authStatus, setAuthStatus] = useState('PENDING')
  const [authError, setAuthError] = useState(null)
  const [hasSystem, setHasSystem] = useState(false)
  const [discordUser, setDiscordUser] = useState(null)

  useEffect(() => {
    if (status !== 'AUTHENTICATED') return

    if (isMock) {
      api.setBaseUrl('/api')
      // Fetch a real JWT from the dev-token endpoint so API calls work in local dev
      fetch('/api/auth/dev-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordId: session?.id || '1000000000000000001', username: session?.username || 'MockUser' })
      })
        .then(r => r.ok ? r.json() : Promise.reject(new Error(`dev-token ${r.status}`)))
        .then(data => {
          api.setToken(data.token)
          setHasSystem(data.user?.hasSystem || false)
          setDiscordUser(data.user || null)
          setAuthStatus('READY')
          // Notify WebSocket hook that token is available
          try {
            window.dispatchEvent(new CustomEvent('systemiser_token_updated', { detail: { key: 'systemiser_token' } }))
          } catch (_) {}
        })
        .catch(err => {
          console.warn('[Mock Auth] dev-token failed, continuing without token:', err.message)
          setAuthStatus('READY')
        })
      return
    }

    if (!accessToken || !session?.id) {
      const missing = []
      if (!accessToken) missing.push('accessToken')
      if (!session?.id) missing.push('session.id')
      setAuthError('No Discord session (missing: ' + missing.join(', ') + ')')
      setAuthStatus('ERROR')
      return
    }

    let cancelled = false

    async function exchange() {
      api.setBaseUrl('/api')

      try {
        const res = await fetch('/api/auth/activity/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            discordId: session.id,
            discordAccessToken: accessToken
          })
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Token exchange failed' }))
          throw new Error(err.error || 'Token exchange failed')
        }

        const data = await res.json()
        if (!cancelled) {
          api.setToken(data.token)
          setJwt(data.token)
          setHasSystem(data.user?.hasSystem || false)
          setDiscordUser(data.user || null)
          setAuthStatus('READY')

          const tokenChanged = () => {}
          try {
            tokenChanged()
            window.dispatchEvent(new CustomEvent('systemiser_token_updated', { detail: { key: 'systemiser_token' } }))
          } catch (_) {}
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[Activity Auth] Exchange error:', err)
          setAuthError(err.message)
          setAuthStatus('ERROR')
        }
      }
    }

    exchange()
    return () => { cancelled = true }
  }, [accessToken, session?.id, status, isMock])

  return { jwt, authStatus, authError, hasSystem, discordUser }
}
