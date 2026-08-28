/**
 * Deterministic randomness for the draft fight.
 *
 * Every viewer of an invite link has to see the identical fight, so nothing in
 * the simulation may touch Math.random. One seed string drives one PRNG stream,
 * and the stream is consumed in a fixed order by the tick loop.
 */

/** FNV-1a over the seed string — turns 'a7f3c1d9' into a 32-bit state. */
export function hashSeed(seed) {
  let h = 0x811c9dc5
  const s = String(seed)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * mulberry32 — small, fast, and identical across every JS engine because it
 * uses only integer ops. Returns a function producing floats in [0, 1).
 */
export function makeRng(seed) {
  let a = hashSeed(seed)
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Integer in [0, n). */
export const randInt = (rng, n) => Math.floor(rng() * n) % n

/** Fisher-Yates, in place, driven by the supplied stream. */
export function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1)
    const t = arr[i]
    arr[i] = arr[j]
    arr[j] = t
  }
  return arr
}

/** A fresh seed for a brand new fight. Never used inside the simulation. */
export function newSeed() {
  const bytes = new Uint8Array(5)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
