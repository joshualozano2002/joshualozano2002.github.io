import { useEffect, useRef } from 'react'
import { RING_MAX, RING_MIN, TICK_HZ } from './sim.js'
import { drawChair, drawRef, drawShadow, drawWrestler } from './sprite.js'
import { sfxBell, sfxBuzzer, sfxChair, sfxChant, sfxElim, sfxEntrance, sfxHit, sfxSpecial, sfxWin } from './sound.js'

/**
 * Plays back a finished simulation as a wrestling broadcast.
 *
 * Nothing here decides anything — every position, hit and elimination was
 * settled by sim.js before the first frame. The renderer only reads the
 * timeline at the current time, which is what lets the same link produce the
 * same fight on a 120Hz laptop and a struggling phone. Cosmetics (crowd
 * flicker, confetti, camera shake) may use Math.random freely because they
 * never feed back into the result.
 *
 * The camera: a hard-cam 3/4 view. World y is squashed and world x fans out
 * with depth, so the square ring reads as a trapezoid and far fighters draw
 * smaller. VIEW_H world-units of that projection are shown.
 */

const TAU = Math.PI * 2
const CX = 500
const BANNER_MS = 2200
const REPLAY_HOLD = 3000 // celebration before the slow-mo
const REPLAY_PRE = 75 // ticks of runway before the deciding blow
const REPLAY_POST = 25
const REPLAY_RATE = 0.4
const INTRO_OPEN = 2600 // the tonight-card before the opening pair walks
const INTRO_PER = 1800 // one wrestler's walk
const APPROACH = 52 // ticks a rumble entrant spends coming down the aisle

/**
 * The pre-show: tonight card plus the opening pair's entrances. Everyone else
 * arrives DURING the fight — that's the rumble. Exported so the page can open
 * a live broadcast early enough to catch the whole pre-show.
 */
export const introDurationMs = () => INTRO_OPEN + 2 * INTRO_PER
const VIEW_H = 780
const RING_SPAN = RING_MAX - RING_MIN

// Depth factor: 1 at the front rope, smaller toward the back.
const depth = (y) => {
  const k = Math.max(-0.25, Math.min(1.3, (y - RING_MIN) / RING_SPAN))
  return 0.78 + 0.44 * k
}
const proj = (x, y) => {
  const d = depth(y)
  return [CX + (x - CX) * d, 415 + (y - 500) * 0.56, d]
}

const POWS = ['POW!', 'BAM!', 'WHAM!', 'SMACK!', 'THUD!']
const ROPES = [
  { h: 26, c: '#4fd6ea' },
  { h: 46, c: '#8ea0b4' },
  { h: 66, c: '#ff9d2e' },
]
const CORNERS = [
  [RING_MIN, RING_MIN],
  [RING_MAX, RING_MIN],
  [RING_MAX, RING_MAX],
  [RING_MIN, RING_MAX],
]

export default function Arena({
  fight,
  fighters,
  playing = false,
  speed = 1,
  sound = false,
  runKey = 0,
  clock, // live broadcast: () => ms since the bell; overrides playing/speed
  league = '',
  champ = -1, // roster index defending Pick 1, -1 for nobody
  ctlRef, // page-facing controls: { skipIntro }
  onElim,
  onClock,
  onEnd,
  onTicker, // play-by-play lines for the broadcast booth
}) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)

  // Live props the animation loop reads without being torn down and rebuilt.
  const playingRef = useRef(playing)
  const speedRef = useRef(speed)
  const soundRef = useRef(sound)
  const clockRef = useRef(clock)
  const cbRef = useRef({ onElim, onClock, onEnd, onTicker })

  playingRef.current = playing
  speedRef.current = speed
  soundRef.current = sound
  clockRef.current = clock
  cbRef.current = { onElim, onClock, onEnd, onTicker }

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap || !fight) return
    const ctx = canvas.getContext('2d')
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let size = 0
    let dpr = 1
    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      size = Math.max(280, Math.min(rect.width, 780))
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(size * dpr)
      canvas.height = Math.round(size * (VIEW_H / 1000) * dpr)
      canvas.style.width = `${size}px`
      canvas.style.height = `${size * (VIEW_H / 1000)}px`
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    const {
      n, ticks, px, py, hp, state, koTick, pickOf, hits, elims, objects, winner,
      entries, entryOrder, lastEntryT, saves, feudEvent,
    } = fight
    const introMs = introDurationMs()
    const durMs = fight.durationMs
    const lastElim = elims[elims.length - 1]
    const replayStart = Math.max(0, (lastElim?.t ?? 0) - REPLAY_PRE)
    const replayTicks = (lastElim?.t ?? 0) + REPLAY_POST - replayStart
    const replayLenMs = (replayTicks / TICK_HZ / REPLAY_RATE) * 1000
    const epilogueMs = lastElim ? REPLAY_HOLD + replayLenMs : 0
    const run = {
      elapsed: -(introMs + 1600), // pre-roll countdown, then the entrances
      last: 0,
      hit: 0,
      elim: 0,
      sparks: [],
      pows: [],
      confetti: [],
      shake: 0,
      banner: null,
      ended: false,
      clockAt: -1e9,
      lastAtk: new Array(n).fill(-999),
      lastDef: new Array(n).fill(-999),
      faceX: new Array(n).fill(CX),
      facing: new Array(n).fill(1),
      // Broadcast-booth state.
      special: null, // {at, text, color}
      final2At: 0,
      chantAt: 0,
      zoom: 0,
      prevAlive: n,
      koBy: -1,
      koStreak: 0,
      koAt: -9999,
      hurtCalled: new Array(n).fill(false),
      milestones: new Set(),
      introIdx: -2, // which pre-show entrance is on, -2 before any
      arrived: new Set(), // rumble entries already announced
      save: 0, // pointer into the hang-on feed
      feudSaid: false,
      streak: new Array(n).fill(0), // consecutive hits landed without taking one
      onFire: new Array(n).fill(false),
      obj: 0, // pointer into the chair event feed
      chair: { mode: 'none', x: 0, y: 0, fx: 0, fy: 0, t0: 0, by: -1 },
      belled: false,
    }

    if (ctlRef) {
      ctlRef.current = {
        // On-demand only: jump the pre-show straight to the final countdown.
        skipIntro: () => {
          if (run.elapsed < -1600) run.elapsed = -1600
        },
      }
    }

    const say = (text) => cbRef.current.onTicker?.(text)

    const at = (arr, t, i) => arr[t * n + i]
    const mono = (px_) => `700 ${px_}px "JetBrains Mono", ui-monospace, monospace`

    /** One rope cable between two mat corners, sagging slightly at mid-span. */
    const rope = (c1, c2, h, color, glow = false) => {
      const [x1, y1, d1] = proj(c1[0], c1[1])
      const [x2, y2, d2] = proj(c2[0], c2[1])
      ctx.beginPath()
      ctx.moveTo(x1, y1 - h * d1)
      ctx.quadraticCurveTo(
        (x1 + x2) / 2,
        (y1 - h * d1 + (y2 - h * d2)) / 2 + 5,
        x2,
        y2 - h * d2,
      )
      ctx.lineWidth = 3.5 * ((d1 + d2) / 2)
      ctx.strokeStyle = color
      if (glow) {
        ctx.shadowColor = color
        ctx.shadowBlur = 8
      }
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    /** Corner post with turnbuckle pads at each rope height. */
    const post = (wx, wy) => {
      const [x, y, d] = proj(wx, wy)
      const hgt = 84 * d
      ctx.fillStyle = '#131b27'
      ctx.fillRect(x - 5 * d, y - hgt, 10 * d, hgt)
      ctx.fillStyle = '#2c3d51'
      ctx.fillRect(x - 5 * d, y - hgt, 3 * d, hgt)
      // Pads face centre ring.
      const inX = wx < CX ? 1 : -1
      for (const { h, c } of ROPES) {
        ctx.fillStyle = c
        ctx.fillRect(x - 5 * d + (inX > 0 ? 6 * d : -7 * d), y - h * d - 5 * d, 6 * d, 9 * d)
      }
    }

    const outlined = (text, x, y, px_, fill) => {
      ctx.font = mono(px_)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineWidth = Math.max(3, px_ / 5)
      ctx.lineJoin = 'round'
      ctx.strokeStyle = 'rgba(5,8,12,0.9)'
      ctx.strokeText(text, x, y)
      ctx.fillStyle = fill
      ctx.fillText(text, x, y)
    }

    const draw = (now) => {
      // Clamped at both ends: a long stall (backgrounded tab, slow phone)
      // must not teleport the fight forward, and a clock that ever runs
      // backwards must not rewind it into negative time.
      const dt = run.last ? Math.max(0, Math.min(now - run.last, 120)) : 0
      run.last = now

      if (clockRef.current) {
        // Broadcast: playback position is a property of the wall clock, not of
        // rendered frames. Background the tab and come back and you are at the
        // live moment, exactly like a television.
        run.elapsed = clockRef.current()
      } else if (playingRef.current && !run.ended) {
        run.elapsed += dt * speedRef.current
      }

      // The epilogue: hold the celebration, then show the deciding blow again
      // in slow motion. Driven by elapsed, so a live audience sees it together.
      const pastEnd = Math.max(0, run.elapsed - durMs)
      const inReplay = lastElim && pastEnd > REPLAY_HOLD && pastEnd <= REPLAY_HOLD + replayLenMs
      let tf
      if (inReplay) {
        tf = Math.min(replayStart + ((pastEnd - REPLAY_HOLD) / 1000) * TICK_HZ * REPLAY_RATE, ticks - 1)
      } else {
        tf = Math.max(0, Math.min((run.elapsed / 1000) * TICK_HZ, ticks - 1))
      }
      const t0 = Math.floor(tf)
      const t1 = Math.min(t0 + 1, ticks - 1)
      const a = tf - t0
      const animFrame = Math.floor(now / 130)

      // Fire every event the clock has passed, in order, even at 4x speed.
      if (run.elapsed >= 0) {
        // A late joiner (or a tab coming back from the background) sweeps past
        // a backlog of events in one frame. The bookkeeping always runs; the
        // fireworks only run for events that just happened, so joining a live
        // fight at minute one doesn't detonate forty punches at once.
        while (run.hit < hits.length && hits[run.hit].t <= t0) {
          const h = hits[run.hit++]
          run.lastAtk[h.a] = h.t
          run.lastDef[h.d] = h.t
          run.faceX[h.a] = h.x
          run.faceX[h.d] = h.x
          run.streak[h.a]++
          run.streak[h.d] = 0
          if (run.onFire[h.d]) run.onFire[h.d] = false
          if (run.streak[h.a] === 5 && !run.onFire[h.a]) {
            run.onFire[h.a] = true
            if (t0 - h.t <= 45) say(`${fighters[h.a].name} is ON FIRE!`)
          }
          if (t0 - h.t <= 8) {
            run.sparks.push({ x: h.x, y: h.y, life: 0, p: Math.min(h.p, 1.4) })
            if (h.s) {
              // A signature move: bigger everything, and it gets said out loud.
              const A = fighters[h.a]
              run.special = { at: now, text: `${A.short} HITS THE ${A.move}!`, color: A.color }
              run.sparks.push({ x: h.x, y: h.y, life: 0, p: 2.2 })
              run.shake = 20
              if (soundRef.current) sfxSpecial()
              say(`${A.name} connects with the ${A.move} on ${fighters[h.d].name}!`)
            } else if (h.c) {
              run.pows.push({
                x: h.x,
                y: h.y,
                life: 0,
                txt: 'CLANG!',
                silver: true,
                rot: (Math.random() - 0.5) * 0.4,
              })
              if (soundRef.current) sfxChair()
            } else if (h.p > 0.85) {
              run.pows.push({
                x: h.x,
                y: h.y,
                life: 0,
                txt: POWS[run.hit % POWS.length],
                rot: (Math.random() - 0.5) * 0.4,
              })
            }
            run.shake = Math.min(run.shake + 2 + h.p * 3.5, 15)
            if (soundRef.current) sfxHit(h.p)
          }
        }
        while (run.obj < objects.length && objects[run.obj].t <= t0) {
          const o = objects[run.obj++]
          const ch = run.chair
          if (o.k === 'spawn') {
            Object.assign(ch, { mode: 'sliding', x: o.x, y: o.y, fx: o.fx, fy: o.fy, t0: o.t })
            if (t0 - o.t <= 45) say('A STEEL CHAIR just slid into the ring!')
          } else if (o.k === 'pick') {
            ch.mode = 'held'
            ch.by = o.by
            if (t0 - o.t <= 45) say(`${fighters[o.by].name} has the STEEL CHAIR!`)
          } else if (o.k === 'break') {
            ch.mode = 'none'
            ch.by = -1
            if (t0 - o.t <= 45) {
              say(`${fighters[o.by].name} breaks the chair over ${fighters[o.on].name}!`)
              if (soundRef.current) sfxChair(true)
            }
          } else if (o.k === 'drop') {
            Object.assign(ch, { mode: 'mat', x: o.x, y: o.y, by: -1 })
            if (t0 - o.t <= 45) say('The chair is loose again!')
          }
        }
        while (run.save < saves.length && saves[run.save].t <= t0) {
          const sv = saves[run.save++]
          if (t0 - sv.t <= 45) {
            const f = fighters[sv.id]
            run.special = { at: now, text: `${f.short} HANGS ON!`, color: f.color }
            run.shake = 16
            if (soundRef.current) sfxRoar(0.9)
            say(`${f.name} was GONE — and somehow hangs on by the fingertips!`)
          }
        }
        if (feudEvent && !run.feudSaid && feudEvent.t <= t0) {
          run.feudSaid = true
          if (t0 - feudEvent.t <= 60)
            say(
              `${fighters[feudEvent.a].name} and ${fighters[feudEvent.b].name} just cannot leave each other alone. That's a feud.`,
            )
        }
        while (run.elim < elims.length && elims[run.elim].t <= t0) {
          const e = elims[run.elim++]
          cbRef.current.onElim?.(e)
          if (t0 - e.t <= 45) {
            run.banner = { at: now, e }
            run.shake = 17
            if (soundRef.current) sfxElim()
            const loser = fighters[e.id].name
            if (fighters[e.id].champ) say(`THE CHAMP IS GONE — ${loser} loses Pick 1!`)
            if (e.by >= 0) {
              if (e.by === run.koBy && e.t - run.koAt < TICK_HZ * 20) run.koStreak++
              else run.koStreak = 1
              run.koBy = e.by
              run.koAt = e.t
              const by = fighters[e.by].name
              say(
                run.koStreak >= 2
                  ? `${by} throws out ${loser} — that's ${run.koStreak} eliminations. RAMPAGE!`
                  : `${by} launches ${loser} over the top rope. Pick ${e.pick} is settled.`,
              )
            } else {
              say(`${loser} is gone — pick ${e.pick} is settled.`)
            }
          }
        }
      }

      // Slow-mo FX: re-fire the sparks of the window as the clock passes them.
      if (inReplay) {
        if (run.replayPtr === undefined || pastEnd - REPLAY_HOLD < 80) {
          run.replayPtr = hits.findIndex((h) => h.t >= replayStart)
          if (run.replayPtr < 0) run.replayPtr = hits.length
          run.replayDecided = false
        }
        while (run.replayPtr < hits.length && hits[run.replayPtr].t <= t0) {
          const h = hits[run.replayPtr++]
          run.sparks.push({ x: h.x, y: h.y, life: 0, p: Math.min(h.p, 1.4) })
          if (soundRef.current) sfxHit(h.p * 0.7)
        }
        if (!run.replayDecided && t0 >= lastElim.t) {
          run.replayDecided = true
          run.shake = 16
          if (soundRef.current) sfxElim()
        }
      }

      let aliveNow = 0
      for (let i = 0; i < n; i++) if (at(state, t0, i) === 2) aliveNow++
      // During the epilogue the HUD keeps reporting the settled fight.
      const aliveHud = run.elapsed > durMs && !inReplay ? (n > 1 ? 1 : n) : aliveNow

      // The rumble clock: buzz, reveal, and call each arrival.
      const nextEntry = run.elapsed >= 0 ? entries.find((e) => e.t > t0) : null
      if (run.elapsed >= 0 && !inReplay) {
        for (const en of entries) {
          if (t0 >= en.t - APPROACH && !run.arrived.has(en.num)) {
            run.arrived.add(en.num)
            const f = fighters[en.id]
            if (t0 - en.t <= 60) {
              if (soundRef.current) {
                sfxBuzzer()
                sfxEntrance(en.num + (f.champ ? 5 : 0))
              }
              say(
                f.champ
                  ? `Entry #${en.num} — THE DEFENDING PICK 1! ${f.name}, ${f.callsign}!`
                  : `Entry #${en.num}: ${f.name} — ${f.callsign}!`,
              )
              run.banner = null // entrance card takes the lower third
              run.entryCard = { at: now, en }
            }
          }
        }
      }

      // Booth calls on the shape of the fight.
      if (run.elapsed >= 0) {
        const enteredAll = t0 >= lastEntryT
        if (!run.milestones.has('bell')) {
          run.milestones.add('bell')
          say(
            `The bell rings — two start it off, and a new manager hits the ring every twenty seconds or so. Last one standing takes Pick 1.`,
          )
          if (soundRef.current && run.elapsed < 1500 && !run.belled) {
            run.belled = true
            sfxBell()
          }
        }
        if (enteredAll && !run.milestones.has('full')) {
          run.milestones.add('full')
          say(`That's everybody — ${aliveNow} in the ring and nowhere left to hide.`)
        }
        const half = Math.ceil(n / 2)
        if (run.elim >= half && !run.milestones.has('half')) {
          run.milestones.add('half')
          let iron = -1
          for (let i = 0; i < n; i++)
            if (at(state, t0, i) === 2 && (iron < 0 || fight.entryTick[i] < fight.entryTick[iron]))
              iron = i
          say(
            `Half the picks are settled — ${n - run.elim} alive.` +
              (iron >= 0 && fight.entryTick[iron] === 0
                ? ` And ${fighters[iron].name} has been in there since the opening bell.`
                : ''),
          )
        }
        if (enteredAll && aliveNow === 3 && !run.milestones.has('three')) {
          run.milestones.add('three')
          say(`THREE LEFT. It is anyone's draft.`)
        }
        if (enteredAll && aliveNow === 2 && run.prevAlive > 2) {
          run.final2At = now
          run.milestones.add('two')
          const pair = []
          for (let i = 0; i < n; i++) if (at(state, t0, i) === 2) pair.push(fighters[i].short)
          say(`FINAL TWO — ${pair[0]} and ${pair[1]} both find a second wind. Winner takes Pick 1.`)
          if (soundRef.current) {
            sfxChant()
            run.chantAt = now
          }
        }
        if (aliveNow === 2 && soundRef.current && now - run.chantAt > 9000) {
          run.chantAt = now
          sfxChant()
        }
        // Somebody hanging on by a thread, once each.
        if ((t0 & 7) === 0) {
          for (let i = 0; i < n; i++) {
            if (at(state, t0, i) === 2 && at(hp, t0, i) < 0.14 && !run.hurtCalled[i]) {
              run.hurtCalled[i] = true
              say(`${fighters[i].name} is hanging on by a thread!`)
            }
          }
        }
        run.prevAlive = aliveNow
      }

      const secs = Math.min(run.elapsed, durMs) / 1000
      if (run.clockAt < -1e8 || Math.abs(secs - run.clockAt) > 0.2 || aliveNow <= 1) {
        run.clockAt = secs
        cbRef.current.onClock?.(secs, aliveHud)
      }

      if (!run.won && run.elapsed >= durMs) {
        run.won = true
        if (soundRef.current) sfxWin()
      }
      if (!run.ended && run.elapsed >= durMs + epilogueMs) {
        run.ended = true
        cbRef.current.onEnd?.()
      }
      const finished = aliveNow <= 1 && !inReplay

      // ---- paint (world coords: 1000 wide, VIEW_H tall) ----
      const s = size / 1000
      run.shake *= 0.86
      const sh = reduced ? 0 : run.shake
      const sx = sh > 0.2 ? (Math.random() - 0.5) * sh : 0
      const sy = sh > 0.2 ? (Math.random() - 0.5) * sh : 0
      ctx.setTransform(dpr * s, 0, 0, dpr * s, sx * dpr, sy * dpr)

      ctx.fillStyle = '#04060a'
      ctx.fillRect(-40, -40, 1080, VIEW_H + 80)

      // FINAL TWO: the camera leans in on the survivors.
      const wantZoom = aliveNow === 2 && t0 >= lastEntryT && !finished && run.elapsed >= 0 ? 1 : 0
      run.zoom += (wantZoom - run.zoom) * Math.min(1, dt / 500)
      ctx.save()
      if (run.zoom > 0.01) {
        let zx = 0
        let zy = 0
        let cnt = 0
        for (let i = 0; i < n; i++) {
          if (at(state, t0, i) !== 2) continue
          const [X, Y] = proj(at(px, t0, i), at(py, t0, i))
          zx += X
          zy += Y
          cnt++
        }
        if (cnt > 0) {
          zx /= cnt
          zy /= cnt
          const zs = 1 + 0.16 * run.zoom
          ctx.translate(zx, zy)
          ctx.scale(zs, zs)
          ctx.translate(-zx, -zy)
        }
      }

      // House lights: two beams crossing on the ring.
      for (const [bx, col] of [
        [180, 'rgba(79,214,234,0.05)'],
        [820, 'rgba(255,157,46,0.05)'],
      ]) {
        ctx.beginPath()
        ctx.moveTo(bx - 60, -20)
        ctx.lineTo(bx + 60, -20)
        ctx.lineTo(640, 470)
        ctx.lineTo(360, 470)
        ctx.closePath()
        ctx.fillStyle = col
        ctx.fill()
      }

      // The crowd: rows of heads in the dark, camera flashes popping.
      const flashClock = Math.floor(now / 140)
      for (let row = 0; row < 6; row++) {
        const ry = 34 + row * 25
        const count = 24 + row * 5
        const rad = 5.5 + row * 1.1
        for (let i = 0; i < count; i++) {
          const hsh = (i * 73856093) ^ (row * 19349663)
          const rx = 14 + (972 * i) / (count - 1) + ((hsh >> 3) % 11) - 5
          ctx.beginPath()
          ctx.arc(rx, ry + ((hsh >> 7) % 7), rad, 0, TAU)
          ctx.fillStyle = ['#10161f', '#141c28', '#182130', '#1a2433'][hsh & 3]
          ctx.fill()
          const flashRate = finished ? 23 : 97
          if (!reduced && ((hsh ^ flashClock) % flashRate) === 0) {
            ctx.fillStyle = 'rgba(240,248,255,0.9)'
            ctx.fillRect(rx - 1.5, ry - 2, 3, 3)
          }
        }
      }
      // Haze between crowd and ringside.
      const hazeG = ctx.createLinearGradient(0, 150, 0, 240)
      hazeG.addColorStop(0, 'rgba(4,6,10,0)')
      hazeG.addColorStop(1, 'rgba(4,6,10,0.85)')
      ctx.fillStyle = hazeG
      ctx.fillRect(0, 150, 1000, 90)

      // Ringside floor.
      const floorG = ctx.createLinearGradient(0, 200, 0, VIEW_H)
      floorG.addColorStop(0, '#070b12')
      floorG.addColorStop(1, '#0b1019')
      ctx.fillStyle = floorG
      ctx.fillRect(0, 200, 1000, VIEW_H - 200)

      // ---- the ring ----
      const [tlx, tly] = proj(RING_MIN, RING_MIN)
      const [trx, try_] = proj(RING_MAX, RING_MIN)
      const [brx, bry] = proj(RING_MAX, RING_MAX)
      const [blx, bly] = proj(RING_MIN, RING_MAX)

      // Apron skirt below the front edge.
      ctx.beginPath()
      ctx.moveTo(blx, bly)
      ctx.lineTo(brx, bry)
      ctx.lineTo(brx + 14, bry + 62)
      ctx.lineTo(blx - 14, bly + 62)
      ctx.closePath()
      ctx.fillStyle = '#0c1320'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,157,46,0.55)'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(blx, bly + 3)
      ctx.lineTo(brx, bry + 3)
      ctx.stroke()
      ctx.font = mono(21)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(142,160,180,0.32)'
      ctx.fillText('D R A F T   F I G H T', (blx + brx) / 2, bly + 32)

      // Side skirts, thin.
      ctx.fillStyle = '#0a101b'
      ctx.beginPath()
      ctx.moveTo(tlx, tly)
      ctx.lineTo(blx, bly)
      ctx.lineTo(blx - 14, bly + 62)
      ctx.lineTo(tlx - 6, tly + 40)
      ctx.closePath()
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(trx, try_)
      ctx.lineTo(brx, bry)
      ctx.lineTo(brx + 14, bry + 62)
      ctx.lineTo(trx + 6, try_ + 40)
      ctx.closePath()
      ctx.fill()

      // Mat.
      const matG = ctx.createLinearGradient(0, tly, 0, bly)
      matG.addColorStop(0, '#26344a')
      matG.addColorStop(1, '#1d2939')
      ctx.beginPath()
      ctx.moveTo(tlx, tly)
      ctx.lineTo(trx, try_)
      ctx.lineTo(brx, bry)
      ctx.lineTo(blx, bly)
      ctx.closePath()
      ctx.fillStyle = matG
      ctx.fill()
      ctx.strokeStyle = 'rgba(226,233,240,0.14)'
      ctx.lineWidth = 3
      ctx.stroke()

      // Centre-ring markings.
      const [mcx, mcy, mcd] = proj(CX, CX)
      ctx.beginPath()
      ctx.ellipse(mcx, mcy, 170 * mcd, 170 * mcd * 0.56, 0, 0, TAU)
      ctx.strokeStyle = 'rgba(255,157,46,0.14)'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.font = mono(19)
      ctx.fillStyle = 'rgba(226,233,240,0.1)'
      ctx.fillText('DRAFT FIGHT', mcx, mcy)

      // Back and side ropes + back posts, all behind the fighters.
      post(...CORNERS[0])
      post(...CORNERS[1])
      for (const { h, c } of ROPES) {
        rope(CORNERS[0], CORNERS[1], h, c, c === '#ff9d2e')
        rope(CORNERS[0], CORNERS[3], h, c)
        rope(CORNERS[1], CORNERS[2], h, c)
      }

      // ---- fighters ----
      const introT = run.elapsed + introMs // 0..introMs while the entrances run
      const inIntro = run.elapsed < 0 && introT >= 0
      const entranceIdx = inIntro ? Math.floor((introT - INTRO_OPEN) / INTRO_PER) : 2
      // Only the opening pair walks before the bell; the rumble brings the rest.
      const entOrder = [entryOrder[0], entryOrder[1]]

      // Split: in the ring (drawn between rope layers) vs out/flying (in front).
      const inRing = []
      const outside = []
      if (inIntro) {
        // Pre-show cast: everyone who has entered stands on their mark; the
        // current wrestler walks the aisle from the tunnel to their spot.
        for (let k = 0; k <= entranceIdx && k < 2; k++) {
          const i = entOrder[k]
          const sx = at(px, 0, i)
          const sy = at(py, 0, i)
          if (k < entranceIdx) {
            inRing.push({ i, st: 2, wx: sx, wy: sy, intro: 'set' })
            continue
          }
          const wp = Math.min(1, (introT - INTRO_OPEN - k * INTRO_PER) / (INTRO_PER * 0.8))
          const e = wp * wp * (3 - 2 * wp)
          const wx = 500 + (sx - 500) * e
          const wy = 30 + (sy - 30) * e
          inRing.push({ i, st: 2, wx, wy, intro: wp < 1 ? 'walk' : 'set' })
        }
      } else if (run.elapsed >= 0) {
        for (let i = 0; i < n; i++) {
          const st = at(state, t0, i)
          if (st === 0) continue // backstage, waiting on the buzzer
          const wx = at(px, t0, i) * (1 - a) + at(px, t1, i) * a
          const wy = at(py, t0, i) * (1 - a) + at(py, t1, i) * a
          ;(st === 2 ? inRing : outside).push({ i, st, wx, wy })
        }
        // Anyone whose buzzer just hit sprints the aisle to the ring apron.
        if (!inReplay)
        for (const en of entries) {
          if (t0 >= en.t - APPROACH && t0 < en.t) {
            const wp = (t0 + a - (en.t - APPROACH)) / APPROACH
            const e = wp * wp * (3 - 2 * wp)
            const tx = at(px, en.t, en.id)
            const ty = at(py, en.t, en.id)
            inRing.push({
              i: en.id,
              st: 2,
              wx: 500 + (tx - 500) * e,
              wy: 30 + (ty - 30) * e,
              intro: 'walk',
            })
          }
        }
      }
      // Before the entrances begin, the ring stands empty under the lights.
      inRing.sort((p, q) => p.wy - q.wy)
      outside.sort((p, q) => p.wy - q.wy)

      // Entrance stings + booth intro lines, once per wrestler.
      if (inIntro && entranceIdx >= 0 && entranceIdx < 2 && entranceIdx !== run.introIdx) {
        run.introIdx = entranceIdx
        const who = entOrder[entranceIdx]
        const f = fighters[who]
        say(
          f.champ
            ? `And finally — defending Pick 1 — ${f.name}, ${f.callsign}!`
            : `Here comes ${f.name} — ${f.callsign}!`,
        )
        if (soundRef.current) sfxEntrance(entranceIdx + (f.champ ? 5 : 0))
      }

      const drawOne = ({ i, st, wx, wy, intro }) => {
        const f = fighters[i]
        const [X, Y, d] = proj(wx, wy)
        const u = 3.5 * d

        if (intro) {
          // Walking the aisle, hopping the ropes at the rope line.
          const hopZ = intro === 'walk' ? Math.max(0, 30 - Math.abs(wy - RING_MIN)) * 1.1 * d : 0
          if (intro === 'walk') {
            // Tunnel spotlight tracks the walker.
            ctx.beginPath()
            ctx.moveTo(500 - 30, -20)
            ctx.lineTo(500 + 30, -20)
            ctx.lineTo(X + 55 * d, Y + 24 * d)
            ctx.lineTo(X - 55 * d, Y + 24 * d)
            ctx.closePath()
            ctx.fillStyle = 'rgba(255,225,160,0.14)'
            ctx.fill()
          }
          ctx.save()
          ctx.translate(X, Y + 20 * d)
          drawShadow(ctx, 17 * d, 5.5 * d)
          ctx.restore()
          ctx.save()
          ctx.translate(X, Y + 20 * d - hopZ)
          drawWrestler(ctx, f.pal, intro === 'walk' ? 'walk' : 'idle', animFrame + i, 1, u)
          ctx.restore()
          outlined(f.short, X, Y + 32 * d, 14, 'rgba(226,233,240,0.92)')
          return
        }

        if (st === 3 || st === 1) {
          // Flying over the ropes, then flat at ringside.
          const p = st === 1 ? Math.min(1, (tf - koTick[i]) / 26) : 1
          const z = st === 1 ? Math.sin(p * Math.PI) * 120 * d : 0
          ctx.save()
          ctx.translate(X, Y + 18 * d)
          drawShadow(ctx, 20 * d, 6 * d, st === 1 ? 0.25 : 0.42)
          ctx.restore()
          ctx.save()
          ctx.translate(X, Y + 18 * d - z)
          if (st === 1) ctx.rotate(p * Math.PI * 2.5 * (i % 2 ? 1 : -1))
          ctx.globalAlpha = st === 3 ? 0.88 : 1
          drawWrestler(ctx, f.pal, 'ko', 0, run.facing[i], u)
          ctx.globalAlpha = 1
          ctx.restore()
          if (st === 3) {
            // The pick this knockout settled, resting on the body. Identity
            // lives on the draft board; down here the number is the story.
            outlined(`#${pickOf[i]}`, X, Y - 15 * d, 15, '#ff9d2e')
          }
          return
        }

        // Alive. Choose pose from the recent event record.
        const isWinner = finished && i === winner
        let pose = 'idle'
        if (isWinner) pose = 'win'
        else if (t0 - run.lastDef[i] < 7) pose = 'hurt'
        else if (t0 - run.lastAtk[i] < 6) pose = 'punch'
        else {
          const mdx = at(px, t1, i) - at(px, t0, i)
          const mdy = at(py, t1, i) - at(py, t0, i)
          if (mdx * mdx + mdy * mdy > 0.5) pose = 'walk'
          if (Math.abs(mdx) > 0.3) run.facing[i] = mdx > 0 ? 1 : -1
        }
        if (pose === 'punch' || pose === 'hurt')
          run.facing[i] = run.faceX[i] >= wx ? 1 : -1

        if (isWinner) {
          // Spotlight narrows onto the champion.
          ctx.beginPath()
          ctx.moveTo(X - 26, -20)
          ctx.lineTo(X + 26, -20)
          ctx.lineTo(X + 60 * d, Y + 22 * d)
          ctx.lineTo(X - 60 * d, Y + 22 * d)
          ctx.closePath()
          ctx.fillStyle = 'rgba(255,225,160,0.13)'
          ctx.fill()
        }

        ctx.save()
        ctx.translate(X, Y + 20 * d)
        drawShadow(ctx, 17 * d, 5.5 * d)
        drawWrestler(
          ctx,
          isWinner ? { ...f.pal, belt: true } : f.pal,
          pose,
          animFrame + i,
          run.facing[i],
          u,
        )
        ctx.restore()

        if (isWinner && lastElim) {
          // The referee makes it official.
          const refP = Math.min(1, Math.max(0, (run.elapsed - (lastElim.t / TICK_HZ) * 1000 - 900) / 1500))
          if (refP > 0) {
            const e = refP * refP * (3 - 2 * refP)
            const rx = 840 + (wx + 34 - 840) * e
            const ry = 880 + (wy + 6 - 880) * e
            const [RX, RY, RD] = proj(rx, ry)
            ctx.save()
            ctx.translate(RX, RY + 20 * RD)
            drawShadow(ctx, 13 * RD, 4.5 * RD)
            drawRef(ctx, refP >= 1 ? 'raise' : 'walk', animFrame, wx + 34 >= rx ? 1 : -1, 3.1 * RD)
            ctx.restore()
          }
        }

        // Hit flash on whoever just took one.
        if (t0 - run.lastDef[i] < 3 && !reduced) {
          ctx.save()
          ctx.globalAlpha = 0.35
          ctx.translate(X, Y + 20 * d)
          drawWrestler(
            ctx,
            { ...f.pal, skin: '#fff', trunks: '#fff', hair: '#fff', boots: '#fff', band: '#fff', shade: '#fff' },
            pose,
            animFrame + i,
            run.facing[i],
            u,
          )
          ctx.restore()
        }

        if (run.onFire[i] && st === 2 && !finished) {
          // Riding a streak: a lick of flame over the head.
          const fl = animFrame + i
          ctx.fillStyle = fl % 2 ? '#ff9d2e' : '#ffd88a'
          ctx.fillRect(X - 4 * d, Y - (74 + (fl % 3)) * d, 8 * d, 9 * d)
          ctx.fillStyle = '#ff5a4d'
          ctx.fillRect(X - 2 * d, Y - (68 + (fl % 2)) * d, 4 * d, 5 * d)
        }

        if (!finished && run.elapsed >= 0) {
          // Health bar over the head.
          const health = at(hp, t0, i)
          const bw = 36 * d
          ctx.fillStyle = 'rgba(5,8,12,0.75)'
          ctx.fillRect(X - bw / 2 - 1, Y - 62 * d - 1, bw + 2, 6)
          ctx.fillStyle = health > 0.35 ? f.color : '#ff5a4d'
          ctx.fillRect(X - bw / 2, Y - 62 * d, bw * Math.max(health, 0.02), 4)
        }
        outlined(f.short, X, Y + 32 * d, 14, isWinner ? '#ffd88a' : 'rgba(226,233,240,0.92)')
      }

      // The chair on the mat (or sliding in), under the fighters' feet.
      if (run.chair.mode === 'sliding' || run.chair.mode === 'mat') {
        const ch = run.chair
        let cx_ = ch.x
        let cy_ = ch.y
        if (ch.mode === 'sliding') {
          const sp = Math.min(1, (tf - ch.t0) / 16)
          if (sp >= 1) ch.mode = 'mat'
          const e = 1 - (1 - sp) * (1 - sp)
          cx_ = ch.fx + (ch.x - ch.fx) * e
          cy_ = ch.fy + (ch.y - ch.fy) * e
        }
        const [X, Y, d] = proj(cx_, cy_)
        ctx.save()
        ctx.translate(X, Y + 14 * d)
        drawShadow(ctx, 10 * d, 3.5 * d, 0.35)
        if (!reduced) {
          // A glint so nobody misses it.
          ctx.beginPath()
          ctx.arc(0, -8 * d, (12 + ((now / 90) % 8)) * d, 0, TAU)
          ctx.strokeStyle = `rgba(226,233,240,${0.35 - ((now / 90) % 8) * 0.04})`
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
        drawChair(ctx, 3.2 * d)
        ctx.restore()
      }

      for (const fgt of inRing) drawOne(fgt)

      // The chair in somebody's hands, raised when they swing.
      if (run.chair.mode === 'held' && run.chair.by >= 0) {
        const hb = run.chair.by
        if (at(state, t0, hb) === 2) {
          const hx = at(px, t0, hb) * (1 - a) + at(px, t1, hb) * a
          const hy = at(py, t0, hb) * (1 - a) + at(py, t1, hb) * a
          const [X, Y, d] = proj(hx, hy)
          const swinging = t0 - run.lastAtk[hb] < 6
          ctx.save()
          ctx.translate(
            X + (swinging ? 14 * d * run.facing[hb] : 11 * d * run.facing[hb]),
            Y + (swinging ? -46 * d : -20 * d),
          )
          ctx.scale(run.facing[hb], 1)
          drawChair(ctx, 3 * d, true)
          ctx.restore()
        }
      }

      // Front rope + front posts over the in-ring action.
      for (const { h, c } of ROPES) rope(CORNERS[3], CORNERS[2], h, c, c === '#ff9d2e')
      post(...CORNERS[2])
      post(...CORNERS[3])

      // Bodies at ringside land in front of everything.
      for (const fgt of outside) drawOne(fgt)

      // FINAL TWO: house lights down, spotlights up on the survivors.
      if (run.zoom > 0.25) {
        ctx.fillStyle = `rgba(2,4,8,${0.32 * run.zoom})`
        ctx.fillRect(-80, -80, 1160, VIEW_H + 160)
        for (const fgt of inRing) {
          const [X, Y, d] = proj(fgt.wx, fgt.wy)
          ctx.beginPath()
          ctx.moveTo(X - 24, -20)
          ctx.lineTo(X + 24, -20)
          ctx.lineTo(X + 55 * d, Y + 22 * d)
          ctx.lineTo(X - 55 * d, Y + 22 * d)
          ctx.closePath()
          ctx.fillStyle = `rgba(255,225,160,${0.12 * run.zoom})`
          ctx.fill()
          drawOne(fgt)
        }
      }

      // ---- FX ----
      for (let i = run.sparks.length - 1; i >= 0; i--) {
        const sp = run.sparks[i]
        sp.life += dt / 360
        if (sp.life >= 1) {
          run.sparks.splice(i, 1)
          continue
        }
        const [X, Y, d] = proj(sp.x, sp.y)
        ctx.beginPath()
        ctx.arc(X, Y - 20 * d, (6 + sp.life * 40 * sp.p) * d, 0, TAU)
        ctx.lineWidth = 4 * (1 - sp.life)
        ctx.strokeStyle = `rgba(255,220,150,${(1 - sp.life) * 0.85})`
        ctx.stroke()
      }
      for (let i = run.pows.length - 1; i >= 0; i--) {
        const p = run.pows[i]
        p.life += dt / 520
        if (p.life >= 1) {
          run.pows.splice(i, 1)
          continue
        }
        const [X, Y, d] = proj(p.x, p.y)
        ctx.save()
        ctx.translate(X, Y - (34 + p.life * 30) * d)
        ctx.rotate(p.rot)
        ctx.globalAlpha = p.life > 0.6 ? (1 - p.life) * 2.5 : 1
        outlined(
          p.txt,
          0,
          0,
          26 * d,
          p.silver ? '#dbe4ee' : p.life % 0.2 > 0.1 ? '#ffd88a' : '#ff9d2e',
        )
        ctx.restore()
        ctx.globalAlpha = 1
      }

      ctx.restore() // end FINAL TWO camera

      // Confetti for the champion.
      if ((finished || pastEnd > 0) && !reduced) {
        if (run.confetti.length < 130)
          for (let k = 0; k < 3; k++)
            run.confetti.push({
              x: Math.random() * 1000,
              y: -14,
              vx: (Math.random() - 0.5) * 1.1,
              vy: 1.6 + Math.random() * 2.2,
              c: ['#ff9d2e', '#4fd6ea', '#e264d8', '#48e08a', '#e2e9f0'][k % 5],
              r: Math.random() * TAU,
            })
        for (let i = run.confetti.length - 1; i >= 0; i--) {
          const c = run.confetti[i]
          c.x += c.vx + Math.sin(c.y / 40 + c.r) * 0.8
          c.y += c.vy * (dt / 16.7)
          c.r += 0.08
          if (c.y > VIEW_H + 20) {
            run.confetti.splice(i, 1)
            continue
          }
          ctx.save()
          ctx.translate(c.x, c.y)
          ctx.rotate(c.r)
          ctx.fillStyle = c.c
          ctx.fillRect(-4, -2.5, 8, 5)
          ctx.restore()
        }
      }

      // Signature-move call-out, splashed across the screen.
      if (run.special && now - run.special.at < 1500) {
        const k = (now - run.special.at) / 1500
        const scale = k < 0.12 ? 0.6 + (k / 0.12) * 0.5 : 1.1 - k * 0.12
        ctx.save()
        ctx.translate(500, 250)
        ctx.scale(scale, scale)
        ctx.globalAlpha = k > 0.72 ? (1 - k) * 3.5 : 1
        ctx.font = mono(40)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineWidth = 9
        ctx.lineJoin = 'round'
        ctx.strokeStyle = 'rgba(5,8,12,0.95)'
        ctx.strokeText(run.special.text, 0, 0)
        ctx.fillStyle = run.special.color
        ctx.fillText(run.special.text, 0, 0)
        ctx.restore()
        ctx.globalAlpha = 1
      }

      // FINAL TWO title card.
      if (run.final2At && now - run.final2At < 2600 && !finished) {
        const k = (now - run.final2At) / 2600
        ctx.globalAlpha = k > 0.8 ? (1 - k) * 5 : 1
        outlined('FINAL TWO', 500, 300, 74, '#ff9d2e')
        outlined('WINNER TAKES PICK 1', 500, 360, 24, '#e2e9f0')
        ctx.globalAlpha = 1
      }

      // Elimination call-out.
      if (run.banner && now - run.banner.at < BANNER_MS && !finished && !(run.entryCard && now - run.entryCard.at < 2400)) {
        const k = (now - run.banner.at) / BANNER_MS
        const f = fighters[run.banner.e.id]
        ctx.globalAlpha = k > 0.78 ? (1 - k) * 4.5 : 1
        ctx.fillStyle = 'rgba(5,8,12,0.88)'
        ctx.fillRect(0, VIEW_H - 108, 1000, 86)
        ctx.fillStyle = f.color
        ctx.fillRect(0, VIEW_H - 108, 1000, 4)
        ctx.font = mono(30)
        ctx.textAlign = 'center'
        ctx.fillStyle = '#e2e9f0'
        const by = run.banner.e.by >= 0 ? fighters[run.banner.e.by] : null
        ctx.fillText(
          by
            ? `${by.name.toUpperCase()} ELIMINATES ${f.name.toUpperCase()}`
            : `${f.name.toUpperCase()} IS OVER THE TOP ROPE`,
          500,
          VIEW_H - 76,
        )
        ctx.font = mono(22)
        ctx.fillStyle = '#ff9d2e'
        ctx.fillText(`PICK ${run.banner.e.pick}`, 500, VIEW_H - 44)
        ctx.globalAlpha = 1
      }

      // Slow-motion dressing for the deciding blow.
      if (inReplay) {
        ctx.fillStyle = 'rgba(2,3,6,0.92)'
        ctx.fillRect(0, 0, 1000, 64)
        ctx.fillRect(0, VIEW_H - 64, 1000, 64)
        const blink = Math.floor(now / 450) % 2 === 0
        if (blink) {
          ctx.beginPath()
          ctx.arc(870, 32, 7, 0, TAU)
          ctx.fillStyle = '#ff5a4d'
          ctx.fill()
        }
        ctx.font = mono(22)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#e2e9f0'
        ctx.fillText('REPLAY', 890, 33)
        ctx.textAlign = 'center'
        outlined('THE DECIDING BLOW', 500, VIEW_H - 32, 22, '#8ea0b4')
        const flashK = (pastEnd - REPLAY_HOLD) / 260
        if (flashK < 1) {
          ctx.fillStyle = `rgba(226,233,240,${(1 - flashK) * 0.7})`
          ctx.fillRect(0, 0, 1000, VIEW_H)
        }
      }

      // The rumble entry card, splashed across the lower third.
      if (run.entryCard && now - run.entryCard.at < 2400 && !inReplay && run.elapsed >= 0) {
        const k = (now - run.entryCard.at) / 2400
        const f = fighters[run.entryCard.en.id]
        ctx.globalAlpha = k > 0.78 ? (1 - k) * 4.5 : 1
        ctx.fillStyle = 'rgba(5,8,12,0.88)'
        ctx.fillRect(0, VIEW_H - 118, 1000, 96)
        ctx.fillStyle = f.champ ? '#e8c35a' : f.color
        ctx.fillRect(0, VIEW_H - 118, 1000, 4)
        outlined(
          `ENTRY #${run.entryCard.en.num} — ${f.callsign}`,
          500,
          VIEW_H - 84,
          30,
          f.champ ? '#e8c35a' : f.color,
        )
        outlined(
          `${f.name.toUpperCase()} · #${f.number}${f.champ ? ' · DEFENDING PICK 1' : ''}`,
          500,
          VIEW_H - 52,
          18,
          '#e2e9f0',
        )
        outlined(`SIGNATURE: ${f.move}`, 500, VIEW_H - 28, 14, '#8ea0b4')
        ctx.globalAlpha = 1
      }

      // Who's next? The clock knows; the name stays a surprise.
      if (nextEntry && !inReplay && run.elapsed >= 0 && t0 < nextEntry.t - APPROACH) {
        const secLeft = Math.ceil((nextEntry.t - APPROACH - tf) / TICK_HZ)
        ctx.fillStyle = 'rgba(5,8,12,0.8)'
        ctx.fillRect(12, 12, 252, 46)
        ctx.fillStyle = secLeft <= 5 ? '#ff9d2e' : '#2c3d51'
        ctx.fillRect(12, 12, 252, 3)
        ctx.font = mono(20)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = secLeft <= 5 ? '#ff9d2e' : '#8ea0b4'
        ctx.fillText(
          `NEXT ENTRANT  0:${String(Math.max(0, secLeft)).padStart(2, '0')}`,
          26,
          37,
        )
        ctx.textAlign = 'center'
      }

      // Champion banner.
      if (finished && pastEnd > 0 && !inReplay) {
        const f = fighters[winner]
        ctx.fillStyle = 'rgba(5,8,12,0.88)'
        ctx.fillRect(0, VIEW_H - 96, 1000, 74)
        ctx.fillStyle = '#ff9d2e'
        ctx.fillRect(0, VIEW_H - 96, 1000, 4)
        const pulse = reduced ? 1 : 0.75 + 0.25 * Math.sin(now / 220)
        ctx.globalAlpha = pulse
        ctx.font = mono(30)
        ctx.textAlign = 'center'
        ctx.fillStyle = '#ffd88a'
        ctx.fillText(
          f.champ ? `${f.name.toUpperCase()} RETAINS PICK 1` : `${f.name.toUpperCase()} TAKES PICK 1`,
          500,
          VIEW_H - 58,
        )
        ctx.globalAlpha = 1
      }

      // Pre-show overlays: countdown → tonight card → entrance cards → bell.
      if (run.elapsed < -introMs) {
        // Waiting for the show to begin.
        ctx.fillStyle = 'rgba(4,6,10,0.55)'
        ctx.fillRect(0, 0, 1000, VIEW_H)
        const secLeft = Math.ceil((-run.elapsed - introMs) / 1000)
        if (secLeft <= 9) {
          outlined(String(secLeft), 500, 330, 96, secLeft <= 3 ? '#ff9d2e' : '#e2e9f0')
          outlined('THE SHOW IS ABOUT TO BEGIN', 500, 410, 22, '#8ea0b4')
        } else {
          outlined('READY…', 500, 340, 56, '#8ea0b4')
        }
      } else if (inIntro && introT < INTRO_OPEN) {
        // Tonight's card.
        const k = introT / INTRO_OPEN
        ctx.fillStyle = 'rgba(4,6,10,0.6)'
        ctx.fillRect(0, 0, 1000, VIEW_H)
        ctx.globalAlpha = k > 0.85 ? (1 - k) * 6.7 : Math.min(1, k * 5)
        outlined('TONIGHT', 500, 250, 22, '#8ea0b4')
        outlined((league || 'DRAFT FIGHT').toUpperCase(), 500, 320, 52, '#ff9d2e')
        outlined(`${n} MANAGERS · ONE RING · ONE PICK 1`, 500, 388, 22, '#e2e9f0')
        ctx.globalAlpha = 1
      } else if (inIntro && entranceIdx >= 0 && entranceIdx < 2) {
        // The walker's lower-third.
        const f = fighters[entOrder[entranceIdx]]
        ctx.fillStyle = 'rgba(5,8,12,0.85)'
        ctx.fillRect(0, VIEW_H - 122, 1000, 100)
        ctx.fillStyle = f.champ ? '#e8c35a' : f.color
        ctx.fillRect(0, VIEW_H - 122, 1000, 4)
        outlined(f.callsign, 500, VIEW_H - 88, 34, f.champ ? '#e8c35a' : f.color)
        outlined(
          `${f.name.toUpperCase()} · #${f.number}${f.champ ? ' · DEFENDING PICK 1' : ''}`,
          500,
          VIEW_H - 54,
          18,
          '#e2e9f0',
        )
        outlined(`SIGNATURE: ${f.move}`, 500, VIEW_H - 30, 14, '#8ea0b4')
      } else if (run.elapsed >= 0 && run.elapsed < 700) {
        outlined('FIGHT!', 500, 340, 84, '#ff9d2e')
      }

      // The tunnel: a lit gap in the crowd wall while the entrances run.
      if (inIntro) {
        const g = ctx.createRadialGradient(500, 26, 4, 500, 26, 90)
        g.addColorStop(0, 'rgba(255,235,190,0.5)')
        g.addColorStop(1, 'rgba(255,235,190,0)')
        ctx.fillStyle = g
        ctx.fillRect(392, -20, 216, 150)
      }

      // Screen dressing, in device pixels so the lines stay crisp.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const H = size * (VIEW_H / 1000)
      if (!reduced) {
        ctx.fillStyle = 'rgba(0,0,0,0.15)'
        for (let yy = 0; yy < H; yy += 3) ctx.fillRect(0, yy, size, 1)
      }
      const vig = ctx.createRadialGradient(
        size / 2, H / 2, size * 0.34,
        size / 2, H / 2, size * 0.74,
      )
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(1, 'rgba(0,0,0,0.5)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, size, H)

      raf = requestAnimationFrame(draw)
    }

    let raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      if (ctlRef) ctlRef.current = null
    }
  }, [fight, fighters, runKey])

  return (
    <div ref={wrapRef} className="flex w-full justify-center">
      <canvas
        ref={canvasRef}
        className="rounded-xs border border-hairline"
        role="img"
        aria-label="Draft fight ring"
      />
    </div>
  )
}
