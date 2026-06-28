import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { patchUrlMappings } from '@discord/embedded-app-sdk'

// Patch URL mappings for Discord proxy (bypasses portal propagation delay)
if (import.meta.env.PROD) {
  patchUrlMappings([{ prefix: '/api', target: 'api.teamcalendula.net' }])
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
