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

  useStableEffect(() => {
    let isMounted = true
    let sdk

    async function init() {
      try {
        const params = new URLSearchParams(window.location.search)
        const frameId = params.get('frame_id')

        if (frameId) {
          sdk = new DiscordSDK(process.env.VITE_DISCORD_CLIENT_ID)
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
          sdk._updateCommandMocks({ authenticate: async () => mockConfig })
        }

        await sdk.ready()
        if (!isMounted) return
        setDiscordSdk(sdk)
        setStatus('READY')

        if (authenticate) {
          const authResponse = await sdk.commands.authenticate({
            client_id: process.env.VITE_DISCORD_CLIENT_ID,
            scope,
          })
          if (!isMounted) return
          setAccessToken(authResponse.access_token)
          setAuthenticated(true)
          setSession(authResponse.user)
          setStatus('AUTHENTICATED')
        }
      } catch (err) {
        if (!isMounted) return
        console.error('[DiscordSDK] Init error:', err)
        setError(err.message)
        setStatus('ERROR')
      }
    }

    init()

    return () => {
      isMounted = false
    }
  }, [])

  const value = { discordSdk, accessToken, authenticated, session, status, error }

  return (
    <DiscordContext.Provider value={value}>
      {children}
    </DiscordContext.Provider>
  )
}
