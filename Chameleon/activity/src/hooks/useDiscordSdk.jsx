import React, { createContext, useContext, useRef, useEffect, useState } from 'react'
import { DiscordSDK, DiscordSDKMock } from '@discord/embedded-app-sdk'

const DiscordContext = createContext(null)

export function useDiscordSdk() {
  return useContext(DiscordContext)
}

function useStableEffect(effect, deps) {
  const ref = useRef(false)
  useEffect(() => {
    if (ref.current) return
    ref.current = true
    return effect()
  }, deps)
}

export function DiscordContextProvider({ children, authenticate = false, scope = ['identify'] }) {
  const [discordSdk, setDiscordSdk] = useState(null)
  const [accessToken, setAccessToken] = useState(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [session, setSession] = useState(null)
  const [status, setStatus] = useState('INITIALIZING')
  const [error, setError] = useState(null)
  const [isMock, setIsMock] = useState(false)

  useStableEffect(() => {
    let isMounted = true
    let sdk
    let rawMessageListener = null

    async function init() {
      try {
        const params = new URLSearchParams(window.location.search)
        const frameId = params.get('frame_id')

        if (frameId) {
          sdk = new DiscordSDK(process.env.VITE_DISCORD_CLIENT_ID)

          await Promise.race([
            sdk.ready(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('SDK ready() timed out after 10s')), 10000))
          ])
          if (!isMounted) return

          setDiscordSdk(sdk)
          setStatus('READY')

          if (authenticate) {
            const cacheKey = `discord_access_token_${process.env.VITE_DISCORD_CLIENT_ID}`
            const cached = localStorage.getItem(cacheKey)

            let access_token

            if (cached) {
              try {
                const authResponse = await Promise.race([
                  sdk.commands.authenticate({ access_token: cached }),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('SDK authenticate() timed out after 15s')), 15000))
                ])
                access_token = cached
                if (!isMounted) return
                setAccessToken(authResponse.access_token)
                setAuthenticated(true)
                setSession(authResponse.user)
                setStatus('AUTHENTICATED')
              } catch (_) {
                localStorage.removeItem(cacheKey)
              }
            }

            if (!access_token) {
              const { code } = await sdk.commands.authorize({
                client_id: process.env.VITE_DISCORD_CLIENT_ID,
                scope,
              })

              const tokenRes = await fetch('/api/auth/activity/exchange', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
              })
              if (!tokenRes.ok) {
                const err = await tokenRes.json().catch(() => ({ error: 'Token exchange failed' }))
                throw new Error(err.error || 'Token exchange failed')
              }
              access_token = (await tokenRes.json()).access_token

              localStorage.setItem(cacheKey, access_token)

              const authResponse = await Promise.race([
                sdk.commands.authenticate({ access_token }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('SDK authenticate() timed out after 15s')), 15000))
              ])
              if (!isMounted) return
              setAccessToken(authResponse.access_token)
              setAuthenticated(true)
              setSession(authResponse.user)
              setStatus('AUTHENTICATED')
            }
          }
        } else {
          const mockConfig = {
            guildId: '123456789012345678',
            channelId: '123456789012345679',
            guildMember: {
              user: {
                id: 'mock-user-id',
                username: 'MockUser',
                discriminator: '0000',
                avatar: null,
              },
            },
          }
          sdk = new DiscordSDKMock(process.env.VITE_DISCORD_CLIENT_ID, mockConfig.guildId, mockConfig.channelId)
          sdk._updateCommandMocks({
            authenticate: async () => ({
              access_token: 'mock-access-token',
              user: mockConfig.guildMember.user,
              scopes: ['identify'],
            })
          })
          if (isMounted) setIsMock(true)

          await sdk.ready()
          if (!isMounted) return

          setDiscordSdk(sdk)
          setStatus('READY')

          if (authenticate) {
            const authResponse = await sdk.commands.authenticate({})
            if (!isMounted) return
            setAccessToken(authResponse.access_token)
            setAuthenticated(true)
            setSession(authResponse.user)
            setStatus('AUTHENTICATED')
          }
        }
      } catch (err) {
        if (!isMounted) return
        let parentOrigin = 'unknown'
        try {
          parentOrigin = (window.parent && window.parent.origin) || 'unknown'
        } catch (_) {
          parentOrigin = 'cross-origin'
        }
        const envInfo = {
          url: window.location.href,
          referrer: document.referrer,
          hasParent: !!window.parent,
          parentOrigin,
          frameId: new URLSearchParams(window.location.search).get('frame_id'),
        }
        setError(err.message + ' | Env: ' + JSON.stringify(envInfo))
        setStatus('ERROR')
      }
    }

    init()

    return () => {
      isMounted = false
      if (rawMessageListener) {
        window.removeEventListener('message', rawMessageListener)
      }
    }
  }, [])

  const value = { discordSdk, accessToken, authenticated, session, status, error, isMock }

  return (
    <DiscordContext.Provider value={value}>
      {children}
    </DiscordContext.Provider>
  )
}
