/**
 * Draft Fight watch-party worker — Cloudflare Worker + Durable Object.
 *
 * One room per fight (keyed by the fight seed). Tracks who is connected,
 * relays emoji reactions, and tallies pick-1 predictions. Holds no fight
 * data and decides nothing: the fight stays fully deterministic and
 * client-side. If this worker is down, the fight plays exactly the same —
 * the page just hides the presence layer.
 *
 * Deploy:  npx wrangler deploy   (see party/README.md)
 */

const ALLOWED_EMOJI = new Set(['🔥', '👏', '😂', '💀', '🍿', '🪑'])
const THROWABLES = new Set(['tomato', 'can', 'rose', 'money'])

// ---- Announcer TTS -------------------------------------------------------
// The fight's whole script is known in advance (deterministic sim), so the
// site posts every line once; we synthesize through ElevenLabs, cache the
// audio in KV forever, and the entire league replays from cache. If the
// ELEVEN_KEY secret is missing or the quota is gone, the site quietly falls
// back to the browser voice — the fight is never blocked on audio.

const TTS_MODEL = 'eleven_flash_v2_5'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

async function lineId(voice, text) {
  const data = new TextEncoder().encode(`${voice}|${TTS_MODEL}|${text}`)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(hash)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function handleTts(request, env, url) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
  const voice = env.VOICE_ID ?? 'pNInz6obpgDQGcFmaJgB' // "Adam" — deep, broadcast-ready

  if (url.pathname === '/tts/health') {
    return Response.json({ ok: Boolean(env.ELEVEN_KEY) }, { headers: CORS })
  }

  const audio = url.pathname.match(/^\/tts\/audio\/([0-9a-f]{24})$/)
  if (audio) {
    const buf = await env.TTS.get(audio[1], 'arrayBuffer')
    if (!buf) return new Response('not found', { status: 404, headers: CORS })
    return new Response(buf, {
      headers: {
        ...CORS,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }

  if (url.pathname === '/tts' && request.method === 'POST') {
    if (!env.ELEVEN_KEY) return Response.json({ ok: false }, { status: 503, headers: CORS })
    let body
    try {
      body = await request.json()
    } catch {
      return new Response('bad request', { status: 400, headers: CORS })
    }
    const lines = (body.lines ?? [])
      .filter((l) => typeof l === 'string' && l.length > 0 && l.length <= 220)
      .slice(0, 80)
    const out = {}
    for (const text of lines) {
      const id = await lineId(voice, text)
      const hit = await env.TTS.get(id, 'stream')
      if (hit) {
        out[text] = id
        continue
      }
      try {
        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_22050_32`,
          {
            method: 'POST',
            headers: { 'xi-api-key': env.ELEVEN_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              model_id: TTS_MODEL,
              voice_settings: { stability: 0.35, similarity_boost: 0.7, style: 0.55 },
            }),
          },
        )
        if (!res.ok) continue // quota or transient failure: skip this line
        const buf = await res.arrayBuffer()
        if (buf.byteLength < 500) continue
        await env.TTS.put(id, buf)
        out[text] = id
      } catch {
        // network hiccup: the line just won't be spoken
      }
    }
    return Response.json({ ok: true, clips: out }, { headers: CORS })
  }
  return new Response('draft fight tts', { status: 404, headers: CORS })
}


export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/tts')) return handleTts(request, env, url)
    const m = url.pathname.match(/^\/room\/([a-zA-Z0-9-]{4,40})$/)
    if (!m) return new Response('draft fight party worker', { status: 200 })
    const id = env.ROOMS.idFromName(m[1])
    return env.ROOMS.get(id).fetch(request)
  },
}

export class Room {
  constructor(state) {
    this.state = state
    this.sessions = new Set()
    this.calls = new Map() // sessionId -> predicted fighter index
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket')
      return new Response('expected websocket', { status: 426 })

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    server.accept()

    const session = { ws: server, id: crypto.randomUUID() }
    this.sessions.add(session)
    this.broadcast()

    server.addEventListener('message', (evt) => {
      let msg
      try {
        msg = JSON.parse(evt.data)
      } catch {
        return
      }
      if (msg.t === 'react' && ALLOWED_EMOJI.has(msg.e)) {
        this.send({ t: 'react', e: msg.e })
      } else if (msg.t === 'throw' && THROWABLES.has(msg.k)) {
        // The crowd throws things at the ring. Cosmetic for every viewer —
        // never touches the fight — and rate-limited so nobody floods it.
        const now = Date.now()
        if (now - (session.lastThrow ?? 0) >= 700) {
          session.lastThrow = now
          this.send({ t: 'throw', k: msg.k })
        }
      } else if (msg.t === 'call' && Number.isInteger(msg.who) && msg.who >= -1 && msg.who < 16) {
        if (msg.who === -1) this.calls.delete(session.id)
        else this.calls.set(session.id, msg.who)
        this.broadcast()
      }
    })

    const drop = () => {
      this.sessions.delete(session)
      this.calls.delete(session.id)
      this.broadcast()
    }
    server.addEventListener('close', drop)
    server.addEventListener('error', drop)

    return new Response(null, { status: 101, webSocket: client })
  }

  /** Presence + prediction tally, to everyone. */
  broadcast() {
    const tally = {}
    for (const who of this.calls.values()) tally[who] = (tally[who] ?? 0) + 1
    this.send({ t: 'state', watching: this.sessions.size, tally })
  }

  send(obj) {
    const data = JSON.stringify(obj)
    for (const s of this.sessions) {
      try {
        s.ws.send(data)
      } catch {
        this.sessions.delete(s)
      }
    }
  }
}
