import { DiscordProxy } from '@robojs/patch'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = JSON.parse(readFileSync(resolve(__dirname, '../config.json'), 'utf-8'))

const clientId = config.discordClientIDs?.system
const apiUrl = config.activity?.apiUrl || '/api'

const isDev = process.env.NODE_ENV !== 'production'

export default defineConfig({
  define: {
    'process.env.VITE_DISCORD_CLIENT_ID': JSON.stringify(clientId),
    'process.env.VITE_API_BASE': JSON.stringify(apiUrl)
  },
  plugins: [react(), isDev && DiscordProxy.Vite()].filter(Boolean),
  resolve: {
    alias: {
      '@chameleon/shared': resolve(__dirname, '../../shared'),
      'react': resolve(__dirname, '../node_modules/react'),
      'react-dom': resolve(__dirname, '../node_modules/react-dom'),
      '@tiptap/react': resolve(__dirname, '../node_modules/@tiptap/react'),
      '@tiptap/pm': resolve(__dirname, '../node_modules/@tiptap/pm'),
      '@tiptap/starter-kit': resolve(__dirname, '../node_modules/@tiptap/starter-kit'),
      '@tiptap/extension-underline': resolve(__dirname, '../node_modules/@tiptap/extension-underline'),
      '@tiptap/extension-highlight': resolve(__dirname, '../node_modules/@tiptap/extension-highlight'),
      '@tiptap/extension-link': resolve(__dirname, '../node_modules/@tiptap/extension-link'),
      '@tiptap/extension-task-list': resolve(__dirname, '../node_modules/@tiptap/extension-task-list'),
      '@tiptap/extension-task-item': resolve(__dirname, '../node_modules/@tiptap/extension-task-item'),
      '@tiptap/extension-image': resolve(__dirname, '../node_modules/@tiptap/extension-image'),
      'tiptap-markdown': resolve(__dirname, '../node_modules/tiptap-markdown'),
      '@tiptap/core': resolve(__dirname, '../node_modules/@tiptap/core'),
      '@tiptap/extension-bold': resolve(__dirname, '../node_modules/@tiptap/extension-bold'),
      '@tiptap/extension-italic': resolve(__dirname, '../node_modules/@tiptap/extension-italic'),
      '@tiptap/extension-strike': resolve(__dirname, '../node_modules/@tiptap/extension-strike'),
      '@tiptap/extension-code': resolve(__dirname, '../node_modules/@tiptap/extension-code'),
      '@tiptap/extension-heading': resolve(__dirname, '../node_modules/@tiptap/extension-heading'),
      '@tiptap/extension-bullet-list': resolve(__dirname, '../node_modules/@tiptap/extension-bullet-list'),
      '@tiptap/extension-ordered-list': resolve(__dirname, '../node_modules/@tiptap/extension-ordered-list'),
      '@tiptap/extension-blockquote': resolve(__dirname, '../node_modules/@tiptap/extension-blockquote'),
      '@tiptap/extension-horizontal-rule': resolve(__dirname, '../node_modules/@tiptap/extension-horizontal-rule'),
      '@tiptap/extension-code-block': resolve(__dirname, '../node_modules/@tiptap/extension-code-block'),
    }
  },
  build: {
    crossorigin: ''
  },
  server: {
    allowedHosts: true,
    proxy: {
      '/api/notes':    { target: 'http://localhost:3001', changeOrigin: true },
      '/api/auth':     { target: 'http://localhost:3001', changeOrigin: true },
      '/api/import':   { target: 'http://localhost:3001', changeOrigin: true }
    }
  },
  optimizeDeps: {
    include: ['@chameleon/shared', '@tiptap/react', '@tiptap/pm', '@tiptap/starter-kit']
  }
})
