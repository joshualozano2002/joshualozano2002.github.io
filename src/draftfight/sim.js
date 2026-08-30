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
 *
 * Format: everyone starts at the bell. Length and drama come from pacing —
 * recovery between exchanges, crowd-thinned damage early, one hang-on save
 * apiece, and dig-deep resets at the final four and final two.
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
const REACH = 46
const FLY_TICKS = 26 // over-the-rope flight, elimination to landing
const OUTRO_TICKS = 160 // recorded celebration before the results panel takes over
const LO = RING_MIN + BODY + 4 // where the ropes push back
const HI = RING_MAX - BODY - 4

/** Damage scales up over time so no fight can stall out in a corner. */
const ramp = (t) => {
  const over = t - TICK_HZ * 72
  if (over <= 0) return 1
  const r = 1 + over / (TICK_HZ * 30)
  return r > 5 ? 5 : r
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

  const MAX_TICKS = TICK_HZ * 300

  // The arsenal. Schedules, types, and placements come from a separate
  // stream, drawn entirely up front, so the main combat stream is never
  // disturbed. Every weapon is seeded — the same fight for every viewer.
  const WEAPONS = {
    chair: { uses: 7, mult: 2.2 }, // the classic
    kendo: { uses: 12, mult: 1.5 }, // fast and mean
    can: { uses: 1, mult: 3.0 }, // one shot, and the target sees stars
  }
  const WKINDS = ['chair', 'kendo', 'can']
  const objRng = makeRng(`${seed}:objects`)
  // A rolling armoury: a fresh weapon slides in a beat after the last one
  // breaks, so there is nearly always something on the mat worth grabbing.
  const chairPlan = []
  for (let k = 0; k < 10; k++) {
    chairPlan.push({
      gap: Math.floor(TICK_HZ * (2 + objRng() * 3)),
      w: ((r) => (r < 0.4 ? 'chair' : r < 0.8 ? 'kendo' : 'can'))(objRng()),
      ang: objRng(),
      rad: 95 + objRng() * 65,
    })
  }
  let nextSpawnAt = Math.floor(TICK_HZ * (6 + objRng() * 5))
  // The table: set up mid-ring, waiting for somebody to be put through it.
  const tablePlan = {
    happens: objRng() < 0.75,
    at: Math.floor(TICK_HZ * (45 + objRng() * 45)),
    x: 320 + objRng() * 360,
    y: 320 + objRng() * 360,
  }
  const objects = [] // renderer + booth event feed
  let chairPlanIdx = 0
  let chairHolder = -1
  let weaponKind = null // what the holder is swinging
  let chairOnMat = false
  let chairX = 0
  let chairY = 0
  let chairSwings = 0
  let chairLandT = 0 // pickup waits for the slide-in to finish
  let tableUp = false
  let tableDone = false
  const stunnedUntil = new Int32Array(n).fill(-1)
  const showOffUntil = new Int32Array(n).fill(-1) // the he's-got-the-chair beat

  // Earned specials: deal enough damage and you take to the top rope; absorb
  // enough and the comeback kicks in. Thresholds, not dice — you earn them.
  const dealtSince = new Float64Array(n)
  const takenSince = new Float64Array(n)
  const mode = new Uint8Array(n) // 0 fighting · 1 climbing · 2 diving
  const modeT = new Int32Array(n)
  const diveTX = new Float64Array(n)
  const diveTY = new Float64Array(n)
  const diveSX = new Float64Array(n)
  const diveSY = new Float64Array(n)
  const diveCount = new Uint8Array(n)
  const raged = new Uint8Array(n)
  let lastDiveT = -9999
  let divesLeft = Math.ceil(n * 0.55) // high spots stay special
  const rageUntil = new Int32Array(n).fill(-1)
  const CORNERS_IN = [
    [LO + 6, LO + 6],
    [HI - 6, LO + 6],
    [HI - 6, HI - 6],
    [LO + 6, HI - 6],
  ]

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

  // Fight-story bookkeeping. Pure observation of the existing stream — none of
  // this may draw from rng, or every previously shared link changes its result.
  const lastHitBy = new Int32Array(n).fill(-1)
  const lastHurtT = new Int32Array(n).fill(-9999)
  const lastSpec = new Int32Array(n).fill(-9999)
  let lastSpecAny = -9999 // signature moves are a moment; keep them scarce globally
  const sDmg = new Float64Array(n)
  const sTaken = new Float64Array(n)
  const sKos = new Int32Array(n)
  const sHits = new Int32Array(n)
  const sChair = new Float64Array(n)
  const sOut = new Int32Array(n).fill(-1)
  const hangUsed = new Uint8Array(n)
  const saves = [] // once-per-fighter cheat-death moments
  const pairDmg = new Float64Array(n * n)
  let feudEvent = null

  // Which manager stands where is drawn, not derived from list position.
  const slots = shuffle(rng, SPAWNS[n].slice())

  for (let i = 0; i < n; i++) {
    const [ux, uy] = slots[i]
    const spread = 240 + rng() * 40
    x[i] = CX + ux * spread
    y[i] = CY + uy * spread
    hpMax[i] = 120 * (0.72 + rng() * 0.55)
    hp[i] = hpMax[i]
    speed[i] = 2.05 + rng() * 1.35
    power[i] = 0.68 + rng() * 0.62
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
      pstate[k] =
        state[i] === 2 && mode[i] === 1 ? 4 : state[i] === 2 && mode[i] === 2 ? 5 : state[i]
    }
    ticks = t + 1

    if (alive <= 1) {
      outro++
      if (outro > OUTRO_TICKS) break
    }

    // Slide a chair in on schedule — near the action, so somebody trips over
    // it soon. Position comes from the live centroid plus a pre-drawn offset.
    if (
      nextSpawnAt >= 0 &&
      t >= nextSpawnAt &&
      chairHolder < 0 &&
      !chairOnMat &&
      alive > 2
    ) {
      nextSpawnAt = -1 // re-armed when this one breaks
      const plan = chairPlan[chairPlanIdx++ % chairPlan.length]
      let mx = 0
      let my = 0
      let mc = 0
      for (let i = 0; i < n; i++) {
        if (state[i] !== 2) continue
        mx += x[i]
        my += y[i]
        mc++
      }
      mx /= mc
      my /= mc
      // A point on the unit circle from one uniform draw, no trig: pick a
      // side by quadrant and spread along it. Exact arithmetic only.
      const u = plan.ang * 4
      const q = Math.floor(u)
      const f = (u - q) * 2 - 1
      const d = 1 + f * f
      const ux = q % 2 === 0 ? (1 - f * f) / d : (2 * f) / d
      const uy = q % 2 === 0 ? (2 * f) / d : (1 - f * f) / d
      chairX = mx + ux * plan.rad * (q < 2 ? 1 : -1)
      chairY = my + uy * plan.rad * (q < 2 ? 1 : -1)
      if (chairX < LO + 20) chairX = LO + 20
      if (chairX > HI - 20) chairX = HI - 20
      if (chairY < LO + 20) chairY = LO + 20
      if (chairY > HI - 20) chairY = HI - 20
      chairOnMat = true
      // Where it slid in from: the nearest rope edge.
      const edges = [
        [chairX, RING_MIN - 60],
        [chairX, RING_MAX + 60],
        [RING_MIN - 60, chairY],
        [RING_MAX + 60, chairY],
      ]
      let ei = 0
      let ed = Infinity
      for (let k = 0; k < 4; k++) {
        const dx = edges[k][0] - chairX
        const dy = edges[k][1] - chairY
        const dd = dx * dx + dy * dy
        if (dd < ed) {
          ed = dd
          ei = k
        }
      }
      chairLandT = t + 16
      weaponKind = plan.w
      objects.push({ k: 'spawn', w: plan.w, t, x: chairX, y: chairY, fx: edges[ei][0], fy: edges[ei][1] })
    }

    // The table gets set up once the crowd is warm.
    if (tablePlan.happens && !tableUp && !tableDone && t >= tablePlan.at && alive > 3) {
      tableUp = true
      objects.push({ k: 'tspawn', t, x: tablePlan.x, y: tablePlan.y })
    }

    // First fighter to reach a loose chair takes it. Checked in the drawn
    // order, so no roster slot gets first grab.
    if (chairOnMat && t >= chairLandT) {
      for (let q = 0; q < n; q++) {
        const i = ord[q]
        if (state[i] !== 2) continue
        const dx = x[i] - chairX
        const dy = y[i] - chairY
        if (dx * dx + dy * dy < 42 * 42) {
          chairOnMat = false
          chairHolder = i
          chairSwings = WEAPONS[weaponKind].uses
          showOffUntil[i] = t + 16
          objects.push({ k: 'pick', w: weaponKind, t, by: i })
          break
        }
      }
    }

    // Down to the final pairs the crowd wants an ending, not a stamina duel.
    const dmgMul = ramp(t) * (alive <= 2 ? 1.3 : alive <= 3 ? 1.05 : 1)
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

      if (forceEnd) hp[i] -= 2

      // The comeback: soak enough punishment and you start swinging harder.
      if (!raged[i] && takenSince[i] >= 125 && alive > 2) {
        raged[i] = 1
        rageUntil[i] = t + 150
        takenSince[i] = 0
        objects.push({ k: 'rage', t, by: i })
      }

      // Climbing: head for the corner, perch, pick a victim, and fly.
      if (mode[i] === 1) {
        const dx = diveTX[i] - x[i]
        const dy = diveTY[i] - y[i]
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 8) {
          const sp = (speed[i] * 1.5) / dist
          x[i] += dx * sp
          y[i] += dy * sp
        } else {
          modeT[i]++
          if (modeT[i] >= 14) {
            let best = -1
            let bestD = Infinity
            for (let j = 0; j < n; j++) {
              if (j === i || state[j] !== 2 || mode[j] !== 0) continue
              const jx = x[j] - x[i]
              const jy = y[j] - y[i]
              const d = jx * jx + jy * jy
              if (d < bestD) {
                bestD = d
                best = j
              }
            }
            if (best < 0) {
              mode[i] = 0
              dealtSince[i] = 0
            } else {
              mode[i] = 2
              modeT[i] = 0
              diveSX[i] = x[i]
              diveSY[i] = y[i]
              diveTX[i] = x[best]
              diveTY[i] = y[best]
            }
          }
        }
        continue
      }

      // Airborne: sixteen ticks of flight, then everybody near the landing pays.
      if (mode[i] === 2) {
        modeT[i]++
        const pr = modeT[i] / 16
        if (pr >= 1) {
          x[i] = diveTX[i]
          y[i] = diveTY[i]
          mode[i] = 0
          dealtSince[i] = 0
          const crowd = alive > 2 ? Math.min(1, (2.0 + 0.2 * alive) / alive) : 1
          for (let j = 0; j < n; j++) {
            if (j === i || state[j] !== 2) continue
            const jx = x[j] - x[i]
            const jy = y[j] - y[i]
            const d = Math.sqrt(jx * jx + jy * jy)
            if (d < 58) {
              const D = 15 * power[i] * dmgMul * crowd
              hp[j] -= D
              lastHitBy[j] = i
              lastHurtT[j] = t
              sDmg[i] += D
              sTaken[j] += D
              takenSince[j] += D
              const kb = d > 0.001 ? 7 / d : 0
              ix[j] += jx * kb
              iy[j] += jy * kb
            }
          }
          objects.push({ k: 'dive', t, by: i, x: x[i], y: y[i] })
        } else {
          x[i] = diveSX[i] + (diveTX[i] - diveSX[i]) * pr
          y[i] = diveSY[i] + (diveTY[i] - diveSY[i]) * pr
        }
        continue
      }

      // Earn the top rope: enough damage dealt, no weapon in hand, field open.
      if (
        mode[i] === 0 &&
        divesLeft > 0 &&
        diveCount[i] < 1 &&
        dealtSince[i] >= 42 &&
        t - lastDiveT > TICK_HZ * 9 &&
        chairHolder !== i &&
        alive > 2
      ) {
        let ci = 0
        let cd = Infinity
        for (let c = 0; c < 4; c++) {
          const dx = CORNERS_IN[c][0] - x[i]
          const dy = CORNERS_IN[c][1] - y[i]
          const d = dx * dx + dy * dy
          if (d < cd) {
            cd = d
            ci = c
          }
        }
        mode[i] = 1
        modeT[i] = 0
        lastDiveT = t
        divesLeft--
        diveCount[i]++
        diveTX[i] = CORNERS_IN[ci][0]
        diveTY[i] = CORNERS_IN[ci][1]
        continue
      }

      // Seeing stars — or showing the crowd what you just picked up. Either
      // way you're not swinging for a moment.
      if (t < stunnedUntil[i] || t < showOffUntil[i]) {
        x[i] += ix[i]
        y[i] += iy[i]
        ix[i] *= 0.86
        iy[i] *= 0.86
        if (x[i] < LO) x[i] = LO
        if (x[i] > HI) x[i] = HI
        if (y[i] < LO) y[i] = LO
        if (y[i] > HI) y[i] = HI
        continue
      }

      // Retarget when the current mark is down, or on a staggered timer.
      if (target[i] < 0 || state[target[i]] !== 2 || (t + phase[i]) % 24 === 0) {
        // Sharks smell blood: closeness matters most, but a wounded opponent
        // nearby is irresistible. Spreads eliminations across the fight
        // instead of the whole ring collapsing at once.
        let best = -1
        let bestD = Infinity
        for (let j = 0; j < n; j++) {
          if (j === i || state[j] !== 2 || mode[j] === 2) continue
          const dx = x[j] - x[i]
          const dy = y[j] - y[i]
          const d = (dx * dx + dy * dy) * (hp[j] / hpMax[j] + 0.3)
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
          const roll = 0.62 + rng() * 0.62
          const chair = chairHolder === i
          const crowd = alive > 2 ? Math.min(1, (2.0 + 0.2 * alive) / alive) : 1
          let dmg =
            roll *
            power[i] *
            dmgMul *
            crowd *
            (chair ? WEAPONS[weaponKind].mult : 1) *
            (t < rageUntil[i] ? 1.7 : 1)
          // Anyone hit while standing next to the table goes THROUGH it.
          let slammed = false
          if (tableUp) {
            const tdx = x[tg] - tablePlan.x
            const tdy = y[tg] - tablePlan.y
            if (tdx * tdx + tdy * tdy < 52 * 52) {
              slammed = true
              tableUp = false
              tableDone = true
              dmg *= 2.6
              objects.push({ k: 'tslam', t, by: i, on: tg })
            }
          }
          hp[tg] -= dmg
          lastHitBy[tg] = i
          lastHurtT[tg] = t
          {
            const lo = i < tg ? i : tg
            const hi = i < tg ? tg : i
            pairDmg[lo * n + hi] += dmg
            if (!feudEvent && pairDmg[lo * n + hi] > 60) feudEvent = { t, a: lo, b: hi }
          }
          sDmg[i] += dmg
          sTaken[tg] += dmg
          // The top-rope meter counts effort thrown, not crowd-damped output —
          // otherwise nobody earns the high spot until the fight is old.
          dealtSince[i] += roll * power[i]
          takenSince[tg] += dmg
          sHits[i]++
          if (chair) {
            sChair[i] += dmg
            if (weaponKind === 'can') stunnedUntil[tg] = t + 42
            chairSwings--
            if (chairSwings <= 0) {
              chairHolder = -2
              nextSpawnAt = t + chairPlan[chairPlanIdx % chairPlan.length].gap
              objects.push({ k: 'break', w: weaponKind, t, by: i, on: tg })
            }
          }
          if (slammed) sChair[i] += dmg * 0.4
          // A top-of-the-range roll, not too soon after the last one, is this
          // fighter's signature move. Derived from the roll, so it costs no rng.
          const special =
            roll > 2.24 && t - lastSpec[i] > TICK_HZ * 14 && t - lastSpecAny > TICK_HZ * 6
          if (special) {
            lastSpec[i] = t
            lastSpecAny = t
          }
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
            s: special,
            c: chair,
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

      // Catching your breath: three seconds without taking a hit and health
      // starts creeping back. Active beatdowns still finish; what this stops
      // is the whole ring wearing down in lockstep and collapsing at once.
      if (hp[i] < hpMax[i] && t - lastHurtT[i] > TICK_HZ * 3) {
        hp[i] += (0.065 * hpMax[i]) / 100
        if (hp[i] > hpMax[i]) hp[i] = hpMax[i]
      }

      // A loose chair is irresistible: anyone close by drifts toward it.
      if (chairOnMat && t >= chairLandT) {
        const dxr = chairX - x[i]
        const dyr = chairY - y[i]
        const dr = Math.sqrt(dxr * dxr + dyr * dyr)
        if (dr > 0.001 && dr < 150) {
          const w = (speed[i] * 0.6) / dr
          x[i] += dxr * w
          y[i] += dyr * w
        }
      }

      // Jitter keeps the sprites from tracking in dead-straight lines.
      x[i] += (rng() - 0.5) * 1.6
      y[i] += (rng() - 0.5) * 1.6

      x[i] += ix[i]
      y[i] += iy[i]
      ix[i] *= 0.86
      iy[i] *= 0.86

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

      // Everyone gets one miracle: the first time you'd go over the ropes
      // (outside the final duel), you hang on by your fingertips instead.
      // Symmetric, so it favours nobody — it just makes near-death a story.
      if (!hangUsed[i] && alive > 2 && alive <= n - 2 && !forceEnd) {
        hangUsed[i] = 1
        hp[i] = hpMax[i] * 0.06
        saves.push({ t, id: i })
        continue
      }
      hp[i] = 0
      state[i] = 1
      mode[i] = 0
      koTick[i] = t
      alive--

      // Landing slot at ringside, in front of the ring, filled left to right
      // in elimination order — the floor becomes a readable record of the fight.
      const slot = elims.length
      flyX0[i] = x[i]
      flyY0[i] = y[i]
      flyX1[i] = 165 + (670 * slot) / (n - 2 || 1) + (rng() - 0.5) * 22
      flyY1[i] = 896 + rng() * 26

      sOut[i] = t
      if (lastHitBy[i] >= 0) sKos[lastHitBy[i]]++
      if (chairHolder === i) {
        chairHolder = -1
        chairOnMat = true
        chairX = Math.min(HI - 20, Math.max(LO + 20, x[i]))
        chairY = Math.min(HI - 20, Math.max(LO + 20, y[i]))
        objects.push({ k: 'drop', w: weaponKind, t, x: chairX, y: chairY })
      }

      order.push(i)
      // First one out picks last: the pick a knockout settles counts down from
      // the full field, not from whoever happens to be in the ring right now.
      elims.push({ t, id: i, x: x[i], y: y[i], pick: n - order.length + 1, by: lastHitBy[i] })

      // The survivors dig deep. Symmetric heals at the final four and the
      // final two reset accumulated wear, so a late entry number is a real
      // edge but never a coronation — the endgame belongs to everyone in it.
      if (alive === 4) {
        for (let j = 0; j < n; j++) {
          if (state[j] === 2 && hp[j] < hpMax[j] * 0.5) hp[j] = hpMax[j] * 0.5
        }
      }
      if (alive === 2) {
        for (let j = 0; j < n; j++) {
          if (state[j] === 2 && hp[j] < hpMax[j] * 0.45) hp[j] = hpMax[j] * 0.45
        }
      }
    }
  }

  // Whoever is still standing takes pick 1; the rest count back from the door.
  let winner = -1
  for (let i = 0; i < n; i++) if (state[i] === 2) winner = i
  if (winner < 0) winner = order.length ? order[order.length - 1] : 0

  const stats = Array.from({ length: n }, (_, i) => ({
    dmg: Math.round(sDmg[i]),
    taken: Math.round(sTaken[i]),
    kos: sKos[i],
    hits: sHits[i],
    chair: Math.round(sChair[i]),
    survived: sOut[i] < 0 ? ticks : sOut[i],
  }))

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
    stats,
    saves,
    feudEvent,
    feud: (() => {
      let best = 0
      let a = -1
      let b = -1
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++)
          if (pairDmg[i * n + j] > best) {
            best = pairDmg[i * n + j]
            a = i
            b = j
          }
      return a >= 0 ? { a, b, dmg: Math.round(best) } : null
    })(),
    objects,
    hits,
    elims,
    order: picks,
    winner,
    durationMs: (ticks / TICK_HZ) * 1000,
  }
}
