import { createHash } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

type TtsConfig = {
  endpoint: string
  apiKey: string
  authHeader: string
  authPrefix: string
  voice: string
  model: string
}

const cache = new Map<string, { contentType: string; data: Uint8Array }>()

function readJson(request: IncomingMessage): Promise<{ text?: string; romanization?: string }> {
  return new Promise((resolve, reject) => {
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
      if (body.length > 8_192) reject(new Error('Request too large'))
    })
    request.on('end', () => {
      try { resolve(JSON.parse(body)) } catch { reject(new Error('Invalid JSON')) }
    })
    request.on('error', reject)
  })
}

async function synthesize(config: TtsConfig, text: string, romanization?: string) {
  const key = createHash('sha256').update(`${text}|${romanization}|${config.voice}|${config.model}`).digest('hex')
  const cached = cache.get(key)
  if (cached) return cached

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.apiKey) headers[config.authHeader] = `${config.authPrefix}${config.apiKey}`
  const upstream = await fetch(config.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text, romanization, language: 'nan-TW', voice: config.voice, model: config.model, output_format: 'wav' }),
  })
  if (!upstream.ok) throw new Error(`TTS upstream returned ${upstream.status}`)

  let audioResponse = upstream
  const contentType = upstream.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const result = await upstream.json() as { audio_url?: string; audioUrl?: string }
    const audioUrl = result.audio_url ?? result.audioUrl
    if (!audioUrl) throw new Error('TTS response did not include audio_url')
    audioResponse = await fetch(audioUrl)
    if (!audioResponse.ok) throw new Error(`TTS audio returned ${audioResponse.status}`)
  }
  const result = {
    contentType: audioResponse.headers.get('content-type') ?? 'audio/wav',
    data: new Uint8Array(await audioResponse.arrayBuffer()),
  }
  if (cache.size >= 100) cache.delete(cache.keys().next().value!)
  cache.set(key, result)
  return result
}

function minnanTtsPlugin(config: TtsConfig): Plugin {
  const middleware = () => async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    if (request.url !== '/api/minnan-tts' || request.method !== 'POST') return next()
    if (!config.endpoint) {
      response.statusCode = 503
      return response.end('MINNAN_TTS_ENDPOINT is not configured')
    }
    try {
      const { text, romanization } = await readJson(request)
      if (!text || text.length > 80) {
        response.statusCode = 400
        return response.end('A text value of 1-80 characters is required')
      }
      const audio = await synthesize(config, text, romanization)
      response.setHeader('Content-Type', audio.contentType)
      response.setHeader('Cache-Control', 'private, max-age=86400')
      response.end(audio.data)
    } catch (error) {
      console.error('[minnan-tts]', error)
      response.statusCode = 502
      response.end('Minnan TTS request failed')
    }
  }
  return {
    name: 'minnan-tts-proxy',
    configureServer(server) { server.middlewares.use(middleware()) },
    configurePreviewServer(server) { server.middlewares.use(middleware()) },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const ttsConfig: TtsConfig = {
    endpoint: env.MINNAN_TTS_ENDPOINT ?? '',
    apiKey: env.MINNAN_TTS_API_KEY ?? '',
    authHeader: env.MINNAN_TTS_AUTH_HEADER ?? 'Authorization',
    authPrefix: env.MINNAN_TTS_AUTH_PREFIX ?? 'Bearer ',
    voice: env.MINNAN_TTS_VOICE ?? 'taiwanese_female',
    model: env.MINNAN_TTS_MODEL ?? '',
  }
  return { plugins: [react(), minnanTtsPlugin(ttsConfig)] }
})
