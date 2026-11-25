/**
 * Gift claims for the Christmas list — end-to-end encrypted on purpose.
 *
 * The point of the feature is that family can see what has already been
 * bought without spoiling it for the person whose list it is. That person
 * owns the site and the worker, so hiding the data behind a UI toggle would
 * be theatre: he could just read the KV.
 *
 * So nothing readable ever leaves the browser. A shared family passphrase
 * derives two things — a list id that buckets the claims, and an AES-GCM key
 * that encrypts them. The worker stores opaque ciphertext under opaque hex
 * ids and can tell you nothing about either. Without the passphrase there is
 * no item name, no buyer name, not even a count you can attribute.
 *
 * The passphrase lives in sessionStorage, not localStorage: close the tab and
 * shopping mode is gone.
 */
import { GIFTS_URL } from './gifts-config'

const enc = new TextEncoder()
const dec = new TextDecoder()

// Fixed so every family member derives the same key from the same phrase.
const SALT = enc.encode('joshua-christmas-list-2026')
const ITERATIONS = 150_000

export const SESSION_KEY = 'xmas-crew'

const hex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

const sha256Hex = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)))

const b64 = (bytes) => btoa(String.fromCharCode(...bytes))
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

/** Normalised so "Reindeer", " reindeer " and "REINDEER" are one list. */
const normalise = (passphrase) => passphrase.trim().replace(/\s+/g, ' ').toLowerCase()

/** Derives the list id and encryption key. Nothing here touches the network. */
export async function unlock(passphrase) {
  const pass = normalise(passphrase)
  if (!pass) throw new Error('empty passphrase')

  const listId = (await sha256Hex(`list|${pass}`)).slice(0, 16)
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, [
    'deriveKey',
  ])
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
  return { listId, key }
}

/**
 * One deterministic id per item, so claiming twice overwrites instead of
 * duplicating and unclaiming knows what to delete. Derived from the list id,
 * so it is only computable by someone who already has the passphrase.
 */
const claimId = async (listId, item) => (await sha256Hex(`claim|${listId}|${item}`)).slice(0, 16)

async function seal(key, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value))),
  )
  const out = new Uint8Array(iv.length + ct.length)
  out.set(iv)
  out.set(ct, iv.length)
  return b64(out)
}

/** Returns null for anything that will not decrypt — a wrong phrase, or junk. */
async function unseal(key, blob) {
  try {
    const raw = unb64(blob)
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: raw.slice(0, 12) },
      key,
      raw.slice(12),
    )
    return JSON.parse(dec.decode(pt))
  } catch {
    return null
  }
}

export const configured = Boolean(GIFTS_URL)

/**
 * A network failure here is the ordinary case — the worker may be asleep,
 * undeployed, or blocked — so it gets a sentence rather than a stack trace.
 */
const reachable = async (url, init) => {
  let res
  try {
    res = await fetch(url, init)
  } catch {
    throw new Error('shopping list is offline — try again in a minute')
  }
  if (!res.ok) throw new Error(`shopping list is unavailable (${res.status})`)
  return res
}

/** Map of item id -> { name, at }. Throws if the worker cannot be reached. */
export async function fetchClaims({ listId, key }) {
  const res = await reachable(`${GIFTS_URL}/gifts/${listId}`, { cache: 'no-store' })
  let claims = []
  try {
    ;({ claims = [] } = await res.json())
  } catch {
    throw new Error('shopping list is offline — try again in a minute')
  }

  const out = new Map()
  for (const c of claims) {
    const value = await unseal(key, c.blob)
    if (value?.item) out.set(value.item, { name: value.name ?? '', at: value.at ?? 0 })
  }
  return out
}

export async function setClaim({ listId, key }, item, name) {
  await reachable(`${GIFTS_URL}/gifts/${listId}/${await claimId(listId, item)}`, {
    method: 'PUT',
    body: await seal(key, { item, name, at: Date.now() }),
  })
}

export async function clearClaim({ listId }, item) {
  await reachable(`${GIFTS_URL}/gifts/${listId}/${await claimId(listId, item)}`, {
    method: 'DELETE',
  })
}
