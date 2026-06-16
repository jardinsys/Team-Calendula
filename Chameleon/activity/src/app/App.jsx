import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DiscordContextProvider } from '../hooks/useDiscordSdk'
import { Activity } from './Activity'
import { ConnectionToast } from './ConnectionToast'
import './App.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DiscordContextProvider authenticate scope={['identify']}>
        <Activity />
      </DiscordContextProvider>
    </QueryClientProvider>
  )
}