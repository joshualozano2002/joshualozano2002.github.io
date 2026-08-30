/**
 * The real announcer: pre-generated ElevenLabs audio for every line of the
 * fight's deterministic script, served from the party worker's cache.
 *
 * Flow: when a viewer turns VOICE on, the fight's full script (built by
 * commentary.js) is posted to the worker once. The worker synthesizes any
 * lines it hasn't cached and returns text → clip ids; playback is then a
 * lookup. Whoever enables voice first pays the credits for a new fight;
 * everyone else — and every replay — plays from cache. If the worker has no
 * key, hits quota, or is unreachable, callers fall back to the device voice.
 */
import { PARTY_URL } from './party-config.js'

const base = PARTY_URL ? PARTY_URL.replace(/^wss:/, 'https:') : null

let clips = {} // exact line text -> clip id
let ready = false
let current = null // the <audio> now speaking
let queued = null // at most one line waits; newer calls replace it

export const announcerConfigured = () => Boolean(base)

/** True once real-voice clips are loaded for this fight. */
export const announcerReady = () => ready

/** Build (or fetch from cache) the fight's audio. Safe to call repeatedly. */
export async function prepareAnnouncer(lines) {
  if (!base) return false
  try {
    const health = await fetch(`${base}/tts/health`).then((r) => r.json())
    if (!health.ok) return false
    // Small batches: each line costs the worker up to three subrequests
    // (cache check, synthesis, store), and the free tier allows 50 per
    // request. Twelve lines a call stays comfortably inside.
    for (let i = 0; i < lines.length; i += 12) {
      const res = await fetch(`${base}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: lines.slice(i, i + 12) }),
      })
      if (!res.ok) continue
      const data = await res.json()
      clips = { ...clips, ...data.clips }
      ready = Object.keys(clips).length > 0
    }
    return ready
  } catch {
    return false
  }
}

/** Speak a booth line in the real voice. Returns false if we have no clip. */
export function sayClip(text) {
  const id = clips[text]
  if (!id) return false
  const play = (t) => {
    const a = new Audio(`${base}/tts/audio/${clips[t]}`)
    current = a
    a.onended = () => {
      current = null
      if (queued) {
        const next = queued
        queued = null
        play(next)
      }
    }
    a.onerror = a.onended
    a.play().catch(() => {
      current = null
    })
  }
  if (current) {
    queued = text // the announcer finishes his call, then jumps to the newest
    return true
  }
  play(text)
  return true
}

/** Cut the mic. */
export function quietAnnouncer() {
  queued = null
  if (current) {
    try {
      current.pause()
    } catch {
      /* already stopped */
    }
    current = null
  }
}
