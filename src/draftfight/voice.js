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
  'Samantha',
  'Google UK English Male',
  'Google US English',
]

function pickVoice() {
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  for (const p of PREFERRED) {
    const v = voices.find((v) => v.name === p || v.name.startsWith(`${p} `))
    if (v) return v
  }
  return voices.find((v) => v.lang && v.lang.startsWith('en')) ?? voices[0]
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
  u.rate = 1.12
  u.pitch = 1.0
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
