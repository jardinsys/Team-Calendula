import { DiscordProxy } from '@robojs/patch'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = JSON.parse(readFileSync(resolve(__dirname, '../../../config.json'), 'utf-8'))

const clientId = config.discordClientIDs?.system
const apiUrl = config.activity?.apiUrl || '/api'

export default defineConfig({
  define: {
    'process.env.VITE_DISCORD_CLIENT_ID': JSON.stringify(clientId),
    'process.env.VITE_API_BASE': JSON.stringify(apiUrl)
  },
  plugins: [react(), DiscordProxy.Vite()],
  server: {
    allowedHosts: true,
    proxy: {
      '/api/notes': { target: 'http://localhost:3001', changeOrigin: true },
      '/api/auth': { target: 'http://localhost:3001', changeOrigin: true }
    }
  },
  optimizeDeps: {
    include: ['@chameleon/shared']
  }
})
