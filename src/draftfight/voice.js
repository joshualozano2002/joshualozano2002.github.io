/**
 * The ring announcer — the booth's lines, spoken aloud.
 *
 * Uses the browser's built-in speech engine: free, offline, no API keys.
 * Voice quality is whatever the viewer's device ships (Macs and iPhones are
 * decent); we pick the best English voice we can find. Narration only ever
 * reads lines the deterministic booth already produced, so the fight itself
 * is untouched.
 */
let live = 0 // utterances speaking or queued

export const voiceSupported = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window

const PREFERRED = [
  'Daniel', // macOS/iOS UK — the closest thing to a broadcast voice
  'Reed',
  'Aaron',
  'Evan',
  'Samantha',
  'Google UK English Male',
  'Google US English',
]

function pickVoice() {
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  const en = voices.filter((v) => v.lang && v.lang.startsWith('en'))
  const pool = en.length ? en : voices
  // The compact system voices are robotic; the downloadable Enhanced/Premium
  // ones are dramatically better. If the device has one, always use it —
  // ideally one from the preferred list, otherwise any of them.
  const rich = pool.filter((v) => /enhanced|premium|natural/i.test(v.name))
  for (const set of [rich, pool]) {
    for (const p of PREFERRED) {
      const v = set.find((v) => v.name === p || v.name.startsWith(`${p} `))
      if (v) return v
    }
    if (set === rich && rich.length) return rich[0]
  }
  return pool[0]
}

/**
 * Speak one booth line. If the announcer is more than a line behind, he drops
 * the backlog and jumps to the newest call — fights move fast.
 */
export function speakLine(text) {
  if (!voiceSupported()) return
  const ss = window.speechSynthesis
  if (live >= 2) {
    ss.cancel()
    live = 0
  }
  const u = new SpeechSynthesisUtterance(text)
  const v = pickVoice()
  if (v) u.voice = v
  // Excited calls get an excited read; colour lines stay conversational.
  const hype = /!$/.test(text.trim())
  u.rate = hype ? 1.18 : 1.08
  u.pitch = hype ? 1.06 : 0.98
  u.volume = 1
  live++
  u.onend = () => {
    live = Math.max(0, live - 1)
  }
  u.onerror = u.onend
  ss.speak(u)
}

/** Cut the mic (toggle off, page change). */
export function quietVoice() {
  if (!voiceSupported()) return
  window.speechSynthesis.cancel()
  live = 0
}
