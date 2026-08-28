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

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
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
