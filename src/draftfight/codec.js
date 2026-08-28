/**
 * The whole fight lives in the URL fragment.
 *
 * There is no backend here — the site is static. Encoding the league and the
 * seed into the hash means an invite link is fully self-contained: whoever
 * opens it re-runs the same deterministic simulation and sees the same fight,
 * and because it is a fragment the roster never leaves the recipient's browser.
 */

export const MIN_MANAGERS = 6
export const MAX_MANAGERS = 16
export const HASH_KEY = 'f'

const toBase64Url = (bytes) => {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (str) => {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/**
 * Compact wire form: [3, league, seed, startAt, champ, ...managers].
 *
 * startAt is the bell time in epoch ms, or 0 for a watch-on-demand fight.
 * A scheduled fight is a live broadcast with no server: every device counts
 * down to the same wall-clock moment and runs the same deterministic playback,
 * so the whole league watches the same hit land at the same time.
 *
 * champ is the roster index of last season's Pick 1 (-1 for nobody): pure
 * presentation — gold gear and a last entrance — never a gameplay edge.
 */
export function encodeFight({ league, seed, managers, startAt = 0, champ = -1 }) {
  const payload = [3, league, seed, startAt || 0, champ ?? -1, ...managers]
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
}

/** Returns null for anything malformed — a bad link falls back to the setup form. */
export function decodeFight(token) {
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(token)))
    if (!Array.isArray(payload)) return null
    let league, seed, startAt, champ, managers
    if (payload[0] === 1) {
      // First shipped format, before scheduled fights existed.
      ;[, league, seed, ...managers] = payload
      startAt = 0
      champ = -1
    } else if (payload[0] === 2) {
      ;[, league, seed, startAt, ...managers] = payload
      champ = -1
    } else if (payload[0] === 3) {
      ;[, league, seed, startAt, champ, ...managers] = payload
      if (!Number.isInteger(champ) || champ < -1 || champ >= MAX_MANAGERS) return null
    } else {
      return null
    }
    if (payload[0] >= 2 && (!Number.isFinite(startAt) || startAt < 0 || startAt > 1e13))
      return null
    startAt = Math.floor(startAt)
    if (typeof seed !== 'string' || !seed) return null
    const names = managers.map((m) => String(m).trim()).filter(Boolean)
    if (names.length < MIN_MANAGERS || names.length > MAX_MANAGERS) return null
    if (champ >= names.length) champ = -1
    return { league: String(league ?? '').trim() || 'The League', seed, startAt, champ, managers: names }
  } catch {
    return null
  }
}

/** Reads `#f=...` out of a location hash. */
export function readHash(hash = '') {
  const raw = String(hash).replace(/^#/, '')
  if (!raw) return null
  const params = new URLSearchParams(raw)
  const token = params.get(HASH_KEY)
  return token ? decodeFight(token) : null
}

export const fightHash = (fight) => `#${HASH_KEY}=${encodeFight(fight)}`
