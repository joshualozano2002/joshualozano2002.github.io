/**
 * Client side of the watch party. Connects one WebSocket per fight room and
 * degrades to nothing: if PARTY_URL is unset, the server is down, or the
 * socket drops, the page simply behaves like the static site it is.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { PARTY_URL } from './party-config.js'

export const PARTY_EMOJI = ['🔥', '👏', '😂', '💀', '🍿', '🪑']
export const PARTY_THROWS = [
  { k: 'tomato', icon: '🍅' },
  { k: 'can', icon: '🥤' },
  { k: 'rose', icon: '🌹' },
  { k: 'money', icon: '💵' },
]

export function useParty(roomKey) {
  const [watching, setWatching] = useState(0)
  const [tally, setTally] = useState({})
  const [reactions, setReactions] = useState([]) // floating emoji, newest last
  const wsRef = useRef(null)
  const reactId = useRef(0)
  const throwFeedRef = useRef([]) // drained by the arena, one canvas throw each

  useEffect(() => {
    if (!PARTY_URL || !roomKey) return undefined
    let ws
    let closed = false
    let retry = 0

    const connect = () => {
      try {
        ws = new WebSocket(`${PARTY_URL}/room/${roomKey}`)
      } catch {
        return
      }
      wsRef.current = ws
      ws.onmessage = (evt) => {
        let msg
        try {
          msg = JSON.parse(evt.data)
        } catch {
          return
        }
        if (msg.t === 'state') {
          setWatching(msg.watching ?? 0)
          setTally(msg.tally ?? {})
        } else if (msg.t === 'throw') {
          throwFeedRef.current.push(msg.k)
          if (throwFeedRef.current.length > 40) throwFeedRef.current.shift()
        } else if (msg.t === 'react') {
          const id = reactId.current++
          setReactions((r) => [...r.slice(-24), { id, e: msg.e, x: 8 + Math.random() * 84 }])
          setTimeout(() => setReactions((r) => r.filter((k) => k.id !== id)), 2600)
        }
      }
      ws.onclose = () => {
        wsRef.current = null
        setWatching(0)
        if (!closed && retry < 5) {
          retry++
          setTimeout(connect, 1500 * retry)
        }
      }
    }
    connect()
    return () => {
      closed = true
      wsRef.current = null
      try {
        ws?.close()
      } catch {
        /* already gone */
      }
    }
  }, [roomKey])

  const sendReact = useCallback((e) => {
    try {
      wsRef.current?.send(JSON.stringify({ t: 'react', e }))
    } catch {
      /* offline: the tap just does nothing */
    }
  }, [])

  const sendThrow = useCallback((k) => {
    try {
      wsRef.current?.send(JSON.stringify({ t: 'throw', k }))
    } catch {
      /* offline */
    }
  }, [])

  const sendCall = useCallback((who) => {
    try {
      wsRef.current?.send(JSON.stringify({ t: 'call', who }))
    } catch {
      /* offline */
    }
  }, [])

  return { enabled: Boolean(PARTY_URL), watching, tally, reactions, throwFeedRef, sendReact, sendThrow, sendCall }
}
