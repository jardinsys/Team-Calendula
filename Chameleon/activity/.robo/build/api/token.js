import { readFileSync } from 'fs'
import { resolve } from 'path'
const config = JSON.parse(readFileSync(resolve(process.cwd(), '../config.json'), 'utf-8'))

export default async (req) => {
  const { code } = await req.json()

  const response = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.discordClientIDs.system,
      client_secret: config.discordClientSecret.system,
      grant_type: 'authorization_code',
      code: code,
    }),
  })

  const { access_token } = await response.json()
  return { access_token }
}
