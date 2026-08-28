/**
 * Arcade noises, synthesised on the fly. No audio files to ship, and nothing
 * plays until the viewer presses START, which is also the gesture browsers
 * require before an AudioContext may make sound.
 */
let ctx = null

const context = () => {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

/** Call from a click handler so the context starts unblocked. */
export const primeAudio = () => context()

function blip({ freq, to, dur, type = 'square', gain = 0.08, delay = 0 }) {
  const ac = context()
  if (!ac) return
  const t0 = ac.currentTime + delay
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur)
  amp.gain.setValueAtTime(gain, t0)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(amp).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

/** Filtered white noise — the raw material for thwacks and crowd roars. */
function noise({ dur, gain, freq, q = 0.8, type = 'lowpass', delay = 0, attack = 0.01 }) {
  const ac = context()
  if (!ac) return
  const t0 = ac.currentTime + delay
  const len = Math.ceil(ac.sampleRate * dur)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = ac.createBufferSource()
  src.buffer = buf
  const filter = ac.createBiquadFilter()
  filter.type = type
  filter.frequency.setValueAtTime(freq, t0)
  const amp = ac.createGain()
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.linearRampToValueAtTime(gain, t0 + attack)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(filter).connect(amp).connect(ac.destination)
  src.start(t0)
  src.stop(t0 + dur + 0.02)
}

/** A punch landing: low thump plus a snap of noise. Pitch tracks the damage. */
export const sfxHit = (power = 0.5) => {
  blip({ freq: 120 + power * 60, to: 42, dur: 0.09, type: 'triangle', gain: 0.09 })
  noise({ dur: 0.06, gain: 0.05, freq: 1600 + power * 900, type: 'highpass' })
}

/** The crowd reacting — a swell of filtered noise. */
export const sfxRoar = (level = 1) =>
  noise({ dur: 1.1 + level * 0.5, gain: 0.05 * level, freq: 750, attack: 0.12 })

/** Somebody just went over the top rope. */
export const sfxElim = () => {
  blip({ freq: 420, to: 80, dur: 0.32, type: 'sawtooth', gain: 0.07 })
  blip({ freq: 110, to: 50, dur: 0.36, type: 'triangle', gain: 0.07, delay: 0.05 })
  sfxRoar(0.9)
}

/** Last one standing. */
export const sfxWin = () => {
  ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    blip({ freq: f, dur: 0.26, type: 'square', gain: 0.06, delay: i * 0.11 }),
  )
  sfxRoar(1.5)
}

/** A signature move connecting — riser into a heavy slam. */
export const sfxSpecial = () => {
  blip({ freq: 180, to: 720, dur: 0.16, type: 'sawtooth', gain: 0.05 })
  blip({ freq: 150, to: 38, dur: 0.22, type: 'triangle', gain: 0.11, delay: 0.14 })
  noise({ dur: 0.12, gain: 0.07, freq: 1200, type: 'highpass', delay: 0.14 })
  sfxRoar(0.5)
}

/** The crowd stomping and clapping for the final two. */
export const sfxChant = () => {
  for (let k = 0; k < 2; k++) {
    const base = k * 0.62
    noise({ dur: 0.1, gain: 0.07, freq: 260, delay: base })
    noise({ dur: 0.1, gain: 0.07, freq: 260, delay: base + 0.17 })
    noise({ dur: 0.12, gain: 0.08, freq: 1400, type: 'highpass', delay: base + 0.36 })
  }
  sfxRoar(0.4)
}

/** The bell that starts it. */
export const sfxBell = () => {
  ;[0, 0.28, 0.56].forEach((d) => {
    blip({ freq: 880, dur: 0.4, type: 'triangle', gain: 0.09, delay: d })
    blip({ freq: 1318.5, dur: 0.34, type: 'triangle', gain: 0.05, delay: d + 0.02 })
  })
  sfxRoar(0.7)
}
