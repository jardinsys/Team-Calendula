import { useState, useEffect } from 'react'
import { useDiscordSdk } from '../hooks/useDiscordSdk'
import { api } from '@chameleon/shared'

export function useApiAuth() {
  const { accessToken, session, status } = useDiscordSdk()
  const [jwt, setJwt] = useState(null)
  const [authStatus, setAuthStatus] = useState('PENDING')
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    if (status !== 'AUTHENTICATED') return
    if (!accessToken || !session?.id) {
      setAuthError('No Discord session')
      setAuthStatus('ERROR')
      return
    }

    let cancelled = false

    async function exchange() {
      const baseUrl = process.env.VITE_API_BASE || '/api'
      api.setBaseUrl(baseUrl)

      try {
        const res = await fetch(`${baseUrl}/auth/activity/token`, {
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
          setAuthStatus('READY')
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
  }, [accessToken, session?.id, status])

  return { jwt, authStatus, authError }
}
