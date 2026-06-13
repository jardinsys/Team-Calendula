import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DiscordContextProvider } from '../hooks/useDiscordSdk'
import { useWebSocket } from '../hooks/useWebSocket'
import { Activity } from './Activity'
import './App.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
    },
  },
})

function WebSocketGate({ children }) {
  useWebSocket()
  return children
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DiscordContextProvider authenticate scope={['identify']}>
        <WebSocketGate>
          <Activity />
        </WebSocketGate>
      </DiscordContextProvider>
    </QueryClientProvider>
  )
}