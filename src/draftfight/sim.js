/**
 * The fight itself — a fixed-step battle royale that resolves the draft order.
 *
 * The entire fight is simulated up front, before a single frame is drawn, and
 * playback is pure lookup into the recorded timeline. That is deliberate: if
 * the simulation advanced during rendering, a dropped frame or a slow phone
 * could nudge the physics and two people watching the same invite link would
 * get different draft orders. Precomputing makes the result a property of the
 * seed alone.
 *
 * For the same reason the maths here sticks to +, -, *, / and Math.sqrt, all of
 * which IEEE-754 pins down exactly. Math.sin and friends are allowed to differ
 * in the last bit between engines, and in a chaotic system that is enough to
 * change who wins, so they are kept out of the loop and used only for drawing.
 *
 * Geometry: a square wrestling ring. Fighters bounce off the ropes, and a
 * knockout throws you over the top rope — you fly out and land at ringside,
 * lined up in elimination order so the aftermath reads like a draft board.
 */
import { makeRng, shuffle } from './rng.js'
import { SPAWNS } from './spawns.js'

export const TICK_HZ = 30
export const WORLD = 1000
export const BODY = 20
export const RING_MIN = 190
export const RING_MAX = 810
const CX = 500
const CY = 500
const MAX_TICKS = TICK_HZ * 180
const REACH = 46
const FLY_TICKS = 26 // over-the-rope flight, elimination to landing
const OUTRO_TICKS = 160 // recorded celebration before the results panel takes over
const LO = RING_MIN + BODY + 4 // where the ropes push back
const HI = RING_MAX - BODY - 4

/** Damage scales up over time so no fight can stall out in a corner. */
const ramp = (t) => {
  const over = t - TICK_HZ * 58
  if (over <= 0) return 1
  const r = 1 + over / (TICK_HZ * 30)
  return r > 4 ? 4 : r
}

/**
 * Runs the whole fight.
 *
 * Fighter states in the recorded timeline:
 *   2 = fighting in the ring
 *   1 = knocked out, flying over the ropes
 *   3 = out, resting at ringside
 *
 * @returns timeline arrays indexed `[tick * n + fighter]`, the event lists the
 *   renderer draws from, and `order` — fighter ids by pick, winner first.
 */
export function simulate(seed, n) {
  const rng = makeRng(`${seed}:fight`)

  const px = new Float32Array(MAX_TICKS * n)
  const py = new Float32Array(MAX_TICKS * n)
  const php = new Float32Array(MAX_TICKS * n)
  const pstate = new Uint8Array(MAX_TICKS * n)

  const hits = []
  const elims = []
  const order = [] // filled from last pick backwards, reversed at the end

  const x = new Float64Array(n)
  const y = new Float64Array(n)
  const ix = new Float64Array(n)
  const iy = new Float64Array(n)
  const hp = new Float64Array(n)
  const hpMax = new Float64Array(n)
  const speed = new Float64Array(n)
  const power = new Float64Array(n)
  const cool = new Float64Array(n)
  const target = new Int32Array(n)
  const state = new Uint8Array(n)
  const koTick = new Int32Array(n).fill(-1) // when each fighter went down
  const phase = new Int32Array(n) // when in the 24-tick cycle each one re-aims
  const flyX0 = new Float64Array(n) // flight start → ringside landing slot
  const flyY0 = new Float64Array(n)
  const flyX1 = new Float64Array(n)
  const flyY1 = new Float64Array(n)

  // Which manager stands where is drawn, not derived from list position.
  // Spawning next to a crowd is a real disadvantage, so tying it to roster
  // order would quietly punish whoever the commissioner typed in first.
  const slots = shuffle(rng, SPAWNS[n].slice())

  for (let i = 0; i < n; i++) {
    const [ux, uy] = slots[i]
    const spread = 240 + rng() * 40 // inside the ropes, spread around the ring
    x[i] = CX + ux * spread
    y[i] = CY + uy * spread
    hpMax[i] = 100 * (0.88 + rng() * 0.26)
    hp[i] = hpMax[i]
    speed[i] = 2.05 + rng() * 1.35
    power[i] = 0.78 + rng() * 0.48
    cool[i] = 6 + rng() * 18
    target[i] = -1
    state[i] = 2
    // Drawn, not derived from i: re-aiming a tick after everyone else has
    // moved is worth something, and that edge must not follow a roster slot.
    phase[i] = Math.floor(rng() * 24)
  }

  // Fighters are updated one at a time, and moving later means reacting to
  // everyone else's new position — worth about a point of win rate. Drawing
  // the processing order keeps that edge from attaching to a roster slot.
  const ord = shuffle(rng, Array.from({ length: n }, (_, i) => i))

  let alive = n
  let ticks = 0
  let outro = 0

  for (let t = 0; t < MAX_TICKS; t++) {
    for (let i = 0; i < n; i++) {
      const k = t * n + i
      px[k] = x[i]
      py[k] = y[i]
      php[k] = hp[i] > 0 ? hp[i] / hpMax[i] : 0
      pstate[k] = state[i]
    }
    ticks = t + 1

    if (alive <= 1) {
      outro++
      if (outro > OUTRO_TICKS) break
    }

    // Down to the final pairs the crowd wants an ending, not a stamina duel.
    const dmgMul = ramp(t) * (alive <= 2 ? 1.4 : alive <= 3 ? 1.15 : 1)
    const forceEnd = t > MAX_TICKS - 150

    for (let q = 0; q < n; q++) {
      const i = ord[q]

      if (state[i] === 1) {
        // Over the ropes: an eased arc from the knockout to a ringside slot.
        const p = (t - koTick[i]) / FLY_TICKS
        if (p >= 1) {
          state[i] = 3
          x[i] = flyX1[i]
          y[i] = flyY1[i]
        } else {
          const e = p * p * (3 - 2 * p)
          x[i] = flyX0[i] + (flyX1[i] - flyX0[i]) * e
          y[i] = flyY0[i] + (flyY1[i] - flyY0[i]) * e
        }
        continue
      }
      if (state[i] === 3) continue
      if (alive <= 1) continue // the winner holds still for the celebration

      // Retarget when the current mark is down, or on a staggered timer.
      if (target[i] < 0 || state[target[i]] !== 2 || (t + phase[i]) % 24 === 0) {
        let best = -1
        let bestD = Infinity
        for (let j = 0; j < n; j++) {
          if (j === i || state[j] !== 2) continue
          const dx = x[j] - x[i]
          const dy = y[j] - y[i]
          const d = dx * dx + dy * dy
          if (d < bestD) {
            bestD = d
            best = j
          }
        }
        target[i] = best
      }

      const tg = target[i]
      if (tg >= 0) {
        const dx = x[tg] - x[i]
        const dy = y[tg] - y[i]
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 0.001) {
          const s = speed[i] / dist
          x[i] += dx * s
          y[i] += dy * s
        }

        cool[i] -= 1
        if (dist < REACH && cool[i] <= 0) {
          const dmg = (1.05 + rng() * 1.85) * power[i] * dmgMul
          hp[tg] -= dmg
          cool[i] = 11 + rng() * 16
          const kb = dist > 0.001 ? 3.6 * power[i] / dist : 0
          ix[tg] += dx * kb
          iy[tg] += dy * kb
          ix[i] -= dx * kb * 0.35
          iy[i] -= dy * kb * 0.35
          hits.push({
            t,
            x: x[i] + dx * 0.5,
            y: y[i] + dy * 0.5,
            p: dmg / 14,
            a: i,
            d: tg,
          })
        }
      }

      // Nearest-opponent targeting alone pairs everyone off with the manager
      // who spawned beside them, and the whole fight hugs the ropes. A pull
      // toward centre ring, stronger the further out you are, drags the brawl
      // into the part of the ring people are actually looking at.
      {
        const bx = CX - x[i]
        const by = CY - y[i]
        const bd = Math.sqrt(bx * bx + by * by)
        if (bd > 0.001) {
          const w = (speed[i] * 0.17 * (bd / 310)) / bd
          x[i] += bx * w
          y[i] += by * w
        }
      }

      // Jitter keeps the sprites from tracking in dead-straight lines.
      x[i] += (rng() - 0.5) * 1.6
      y[i] += (rng() - 0.5) * 1.6

      x[i] += ix[i]
      y[i] += iy[i]
      ix[i] *= 0.86
      iy[i] *= 0.86

      if (forceEnd) hp[i] -= 2

      // The ropes: hit them and you bounce back in.
      if (x[i] < LO) {
        x[i] = LO
        if (ix[i] < 0) ix[i] = -ix[i] * 0.55
      }
      if (x[i] > HI) {
        x[i] = HI
        if (ix[i] > 0) ix[i] = -ix[i] * 0.55
      }
      if (y[i] < LO) {
        y[i] = LO
        if (iy[i] < 0) iy[i] = -iy[i] * 0.55
      }
      if (y[i] > HI) {
        y[i] = HI
        if (iy[i] > 0) iy[i] = -iy[i] * 0.55
      }
    }

    // Bodies do not overlap. Resolved in the drawn order, so it stays reproducible.
    for (let q = 0; q < n; q++) {
      const i = ord[q]
      if (state[i] !== 2) continue
      for (let r = q + 1; r < n; r++) {
        const j = ord[r]
        if (state[j] !== 2) continue
        const dx = x[j] - x[i]
        const dy = y[j] - y[i]
        const d = Math.sqrt(dx * dx + dy * dy)
        const min = BODY * 2
        if (d < min && d > 0.001) {
          const push = (min - d) * 0.5 / d
          x[i] -= dx * push
          y[i] -= dy * push
          x[j] += dx * push
          y[j] += dy * push
        }
      }
    }

    // Eliminations last; the drawn order breaks same-tick ties.
    for (let q = 0; q < n; q++) {
      const i = ord[q]
      if (state[i] !== 2 || hp[i] > 0) continue
      if (alive <= 1) break
      hp[i] = 0
      state[i] = 1
      koTick[i] = t
      alive--

      // Landing slot at ringside, in front of the ring, filled left to right
      // in elimination order — the floor becomes a readable record of the fight.
      const slot = elims.length
      flyX0[i] = x[i]
      flyY0[i] = y[i]
      flyX1[i] = 165 + (670 * slot) / (n - 2 || 1) + (rng() - 0.5) * 22
      flyY1[i] = 896 + rng() * 26

      order.push(i)
      elims.push({ t, id: i, x: x[i], y: y[i], pick: alive + 1 })
    }
  }

  // Whoever is still standing takes pick 1; the rest count back from the door.
  let winner = -1
  for (let i = 0; i < n; i++) if (state[i] === 2) winner = i
  if (winner < 0) winner = order.length ? order[order.length - 1] : 0

  const picks = [winner, ...order.slice().reverse().filter((id) => id !== winner)]
  const pickOf = new Int32Array(n)
  picks.forEach((id, i) => {
    pickOf[id] = i + 1
  })

  return {
    n,
    ticks,
    px: px.subarray(0, ticks * n),
    py: py.subarray(0, ticks * n),
    hp: php.subarray(0, ticks * n),
    state: pstate.subarray(0, ticks * n),
    koTick,
    pickOf,
    hits,
    elims,
    order: picks,
    winner,
    durationMs: (ticks / TICK_HZ) * 1000,
  }
}
