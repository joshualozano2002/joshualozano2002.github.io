import { useEffect, useRef } from 'react'
import { RING_MAX, RING_MIN, TICK_HZ } from './sim.js'
import { drawRef, drawShadow, drawTable, drawThrowable, drawWeapon, drawWrestler } from './sprite.js'
import { sfxBell, sfxChair, sfxChant, sfxCrash, sfxElim, sfxEntrance, sfxHit, sfxRoar, sfxSpecial, sfxWin } from './sound.js'

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
const INTRO_OPEN = 2600 // the tonight-card before the first entrance
const INTRO_PER = 1800 // one wrestler's walk

/**
 * How long the entrances run before the bell. Exported so the page can open
 * the broadcast early enough for a live audience to catch the whole pre-show.
 */
export const introDurationMs = (n) => INTRO_OPEN + n * INTRO_PER
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
const WLABEL = { chair: 'STEEL CHAIR', kendo: 'KENDO STICK', can: 'TRASH CAN' }
const WPOW = { chair: 'CLANG!', kendo: 'THWACK!', can: 'DONK!' }
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
  throwFeedRef, // crowd throwables from the watch party, cosmetic only
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
      saves, feudEvent,
    } = fight
    const introMs = introDurationMs(n)
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
      save: 0, // pointer into the hang-on feed
      thrown: [], // crowd objects in flight
      splats: [], // what they leave on the mat
      feudSaid: false,
      streak: new Array(n).fill(0), // consecutive hits landed without taking one
      onFire: new Array(n).fill(false),
      obj: 0, // pointer into the chair event feed
      chair: { mode: 'none', kind: 'chair', x: 0, y: 0, fx: 0, fy: 0, t0: 0, by: -1 },
      table: null, // {x, y, brokenAt}
      cam: { x: 500, y: 415, s: 1 }, // the hard cam, drifting with the story
      camPunch: null, // {x, y, s, until} — a cut to the moment
      flash: 0, // white impact frame until (ms)
      pyro: [], // celebration + debris particles
      showOffs: new Array(n).fill(0), // he's-got-the-weapon beat until (ms)
      takeover: null, // {i, until, label, color} — lights out, one spotlight
      prevSt: new Array(n).fill(2), // to catch the instant someone launches
      stars: new Array(n).fill(0), // seeing-stars until (ms clock)
      rageGlow: new Array(n).fill(0),
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

    const drawFrame = (now) => {
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
                txt: WPOW[run.chair.kind] ?? 'CLANG!',
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
          const recent = t0 - o.t <= 45
          if (o.k === 'spawn') {
            Object.assign(ch, {
              mode: 'sliding', kind: o.w, x: o.x, y: o.y, fx: o.fx, fy: o.fy, t0: o.t,
            })
            if (recent) say(`A ${WLABEL[o.w]} just slid into the ring!`)
          } else if (o.k === 'pick') {
            ch.mode = 'held'
            ch.by = o.by
            if (recent) {
              say(`${fighters[o.by].name} has the ${WLABEL[o.w]}!`)
              run.showOffs[o.by] = now + 560
              const [PX, PY] = proj(
                at(px, Math.min(o.t, ticks - 1), o.by),
                at(py, Math.min(o.t, ticks - 1), o.by),
              )
              run.camPunch = { x: PX, y: PY, s: 1.3, until: now + 900 }
              run.takeover = {
                i: o.by,
                until: now + 950,
                label: `${fighters[o.by].short} HAS THE ${WLABEL[o.w]}`,
                color: fighters[o.by].color,
              }
            }
          } else if (o.k === 'break') {
            ch.mode = 'none'
            ch.by = -1
            if (recent) {
              if (o.w === 'chair')
                say(`${fighters[o.by].name} breaks the chair over ${fighters[o.on].name}!`)
              else if (o.w === 'kendo')
                say(`${fighters[o.by].name} snaps the kendo stick across ${fighters[o.on].name}'s back!`)
              else say(`${fighters[o.by].name} flattens the trash can over ${fighters[o.on].name}'s head!`)
              if (o.w === 'can') run.stars[o.on] = now + 1400
              if (soundRef.current) sfxChair(true)
            }
          } else if (o.k === 'drop') {
            Object.assign(ch, { mode: 'mat', x: o.x, y: o.y, by: -1 })
            if (recent) say(`The ${WLABEL[o.w].toLowerCase()} is loose again!`)
          } else if (o.k === 'tspawn') {
            run.table = { x: o.x, y: o.y, brokenAt: 0 }
            if (recent) say('A TABLE has been set up in the ring. This will end badly for someone.')
          } else if (o.k === 'tslam') {
            if (run.table) run.table.brokenAt = now
            if (recent) {
              say(`${fighters[o.by].name} puts ${fighters[o.on].name} THROUGH THE TABLE!!`)
              run.special = { at: now, text: 'THROUGH THE TABLE!', color: '#ffd88a' }
              run.shake = 22
              run.flash = now + 160
              if (run.table) {
                const [PX, PY] = proj(run.table.x, run.table.y)
                run.camPunch = { x: PX, y: PY, s: 1.26, until: now + 900 }
                for (let k = 0; k < 16; k++)
                  run.pyro.push({
                    x: run.table.x, y: run.table.y, vx: (Math.random() - 0.5) * 7,
                    vy: -3 - Math.random() * 5, c: k % 2 ? '#b08a50' : '#7a5a32', life: 0,
                  })
              }
              if (soundRef.current) sfxCrash()
            }
          } else if (o.k === 'dive') {
            if (recent) {
              say(`${fighters[o.by].name} FROM THE TOP ROPE!!`)
              run.sparks.push({ x: o.x, y: o.y, life: 0, p: 2.4 })
              run.pows.push({ x: o.x, y: o.y, life: 0, txt: 'SPLASH!', rot: 0 })
              run.shake = 20
              run.flash = now + 140
              const [PX, PY] = proj(o.x, o.y)
              run.camPunch = { x: PX, y: PY, s: 1.24, until: now + 800 }
              if (soundRef.current) sfxSpecial()
            }
          } else if (o.k === 'rage') {
            run.rageGlow[o.by] = now + 5000
            if (recent) say(`${fighters[o.by].name} is FEELING IT — the comeback is on!`)
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
            run.flash = now + 120
            const [PX, PY] = proj(e.x, e.y)
            run.camPunch = { x: PX, y: PY, s: 1.2, until: now + 700 }
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

      // The instant somebody leaves the top rope, the building goes dark for
      // them alone.
      if (run.elapsed >= 0 && !inReplay) {
        for (let i = 0; i < n; i++) {
          const st = at(state, t0, i)
          if (st === 5 && run.prevSt[i] !== 5) {
            const [PX, PY] = proj(at(px, t0, i), at(py, t0, i))
            run.camPunch = { x: PX, y: PY, s: 1.32, until: now + 900 }
            run.takeover = {
              i,
              until: now + 900,
              label: `${fighters[i].short} GOES UP TOP!`,
              color: fighters[i].color,
            }
          }
          run.prevSt[i] = st
        }
      }
      // During the epilogue the HUD keeps reporting the settled fight.
      const aliveHud = run.elapsed > durMs && !inReplay ? (n > 1 ? 1 : n) : aliveNow

      // Booth calls on the shape of the fight.
      if (run.elapsed >= 0) {
        if (!run.milestones.has('bell')) {
          run.milestones.add('bell')
          say(`The bell rings — ${n} managers, one ring, and only one Pick 1.`)
          if (soundRef.current && run.elapsed < 1500 && !run.belled) {
            run.belled = true
            sfxBell()
          }
        }
        const half = Math.ceil(n / 2)
        if (run.elim >= half && !run.milestones.has('half')) {
          run.milestones.add('half')
          say(`Half the picks are settled — ${n - run.elim} managers still standing.`)
        }
        if (aliveNow === 3 && !run.milestones.has('three')) {
          run.milestones.add('three')
          say(`THREE LEFT. It is anyone's draft.`)
        }
        if (aliveNow === 2 && run.prevAlive > 2) {
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
      const inIntroPre = run.elapsed < 0 && run.elapsed >= -introMs

      // The camera. A hard cam that leans with the story: drifting toward the
      // action, punching in on the big moments, tight on the final two, and
      // following whoever is airborne. Cosmetic only — it reads the timeline,
      // it never touches it.
      {
        let tx = 500
        let ty = 400
        let ts = 1
        let cnt = 0
        let diver = -1
        for (let i = 0; i < n; i++) {
          const st = at(state, t0, i)
          if (st === 5) diver = i
          if (st !== 2) continue
          const [X, Y] = proj(at(px, t0, i), at(py, t0, i))
          tx = cnt === 0 ? X : tx + X
          ty = cnt === 0 ? Y : ty + Y
          cnt++
        }
        if (cnt > 0) {
          tx /= cnt
          ty /= cnt
          ts = 1.05
        }
        if (aliveNow === 2 && !finished && run.elapsed >= 0) ts = 1.16
        if (diver >= 0) {
          const [DX, DY] = proj(at(px, t0, diver), at(py, t0, diver))
          tx = DX
          ty = DY
          ts = 1.2
        }
        if (run.camPunch && now < run.camPunch.until) {
          tx = run.camPunch.x
          ty = run.camPunch.y
          ts = run.camPunch.s
        }
        if (run.elapsed < 0 && !inIntroPre) {
          ts = 1
          tx = 500
          ty = 400
        }
        const k = run.camPunch && now < run.camPunch.until ? Math.min(1, dt / 150) : Math.min(1, dt / 650)
        run.cam.x += (tx - run.cam.x) * k
        run.cam.y += (ty - run.cam.y) * k
        run.cam.s += (ts - run.cam.s) * k
        // Never let the lens wander past the frame.
        const off = 500 * (1 - 1 / run.cam.s) + 30
        run.cam.x = Math.min(500 + off, Math.max(500 - off, run.cam.x))
        run.cam.y = Math.min(400 + off, Math.max(400 - off, run.cam.y))
      }
      ctx.save()
      if (run.cam.s > 1.005) {
        ctx.translate(run.cam.x, run.cam.y)
        ctx.scale(run.cam.s, run.cam.s)
        ctx.translate(-run.cam.x, -run.cam.y)
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
      const entranceIdx = inIntro ? Math.floor((introT - INTRO_OPEN) / INTRO_PER) : n
      // The defending champ walks last, as is right and proper.
      const entOrder = []
      for (let i = 0; i < n; i++) if (i !== champ) entOrder.push(i)
      if (champ >= 0 && champ < n) entOrder.push(champ)

      // Split: in the ring (drawn between rope layers) vs out/flying (in front).
      const inRing = []
      const outside = []
      if (inIntro) {
        // Pre-show cast: everyone who has entered stands on their mark; the
        // current wrestler walks the aisle from the tunnel to their spot.
        for (let k = 0; k <= entranceIdx && k < n; k++) {
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
          ;(st === 2 || st === 4 || st === 5 ? inRing : outside).push({ i, st, wx, wy })
        }
      }
      // Before the entrances begin, the ring stands empty under the lights.
      inRing.sort((p, q) => p.wy - q.wy)
      outside.sort((p, q) => p.wy - q.wy)

      // Entrance stings + booth intro lines, once per wrestler.
      if (inIntro && entranceIdx >= 0 && entranceIdx < n && entranceIdx !== run.introIdx) {
        run.introIdx = entranceIdx
        const who = entOrder[entranceIdx]
        const f = fighters[who]
        say(
          f.champ
            ? `And finally — defending Pick 1 — ${f.name}, ${f.callsign}!`
            : `Here comes ${f.name} — ${f.callsign}!`,
        )
        if (!reduced)
          for (let k = 0; k < 14; k++)
            run.pyro.push({
              x: 500 + (Math.random() - 0.5) * 40, y: 44, vx: (Math.random() - 0.5) * 5,
              vy: -2 - Math.random() * 4.5, c: k % 3 ? '#ffd88a' : '#ff9d2e', life: 0,
            })
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

        // On the ropes or in the air: the high-spot states.
        if (st === 4 || st === 5) {
          let z = 0
          let pose = 'walk'
          if (st === 4) {
            // Climbing: rise as the corner gets close, then perch up top.
            let cd = Infinity
            for (const [cx2, cy2] of [
              [RING_MIN + 6, RING_MIN + 6],
              [RING_MAX - 6, RING_MIN + 6],
              [RING_MAX - 6, RING_MAX - 6],
              [RING_MIN + 6, RING_MAX - 6],
            ]) {
              const ddx = wx - cx2
              const ddy = wy - cy2
              cd = Math.min(cd, Math.sqrt(ddx * ddx + ddy * ddy))
            }
            z = Math.max(0, 46 - cd) * 1.6
            pose = cd < 10 ? 'win' : 'walk'
          } else {
            z = 52
            pose = 'punch'
          }
          const mdx = at(px, t1, i) - at(px, t0, i)
          if (Math.abs(mdx) > 0.3) run.facing[i] = mdx > 0 ? 1 : -1
          ctx.save()
          ctx.translate(X, Y + 20 * d)
          drawShadow(ctx, 15 * d, 5 * d, 0.3)
          ctx.restore()
          ctx.save()
          ctx.translate(X, Y + 20 * d - z * d)
          drawWrestler(ctx, f.pal, pose, animFrame + i, run.facing[i], u)
          ctx.restore()
          outlined(f.short, X, Y + 32 * d, 14, 'rgba(226,233,240,0.92)')
          return
        }

        // Alive. Choose pose from the recent event record.
        const isWinner = finished && i === winner
        let pose = 'idle'
        if (isWinner) pose = 'win'
        else if (run.showOffs[i] > now) pose = 'win' // presenting the hardware
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

        // Running hot: the comeback glow.
        if (run.rageGlow[i] > now && !reduced) {
          ctx.save()
          ctx.globalAlpha = 0.3 + 0.2 * Math.sin(now / 90)
          ctx.translate(X, Y + 20 * d)
          drawWrestler(
            ctx,
            { ...f.pal, skin: '#ffd88a', trunks: '#ff9d2e', hair: '#ffd88a', boots: '#ff9d2e', band: '#fff', shade: '#ff9d2e' },
            pose,
            animFrame + i,
            run.facing[i],
            u,
          )
          ctx.restore()
          ctx.globalAlpha = 1
        }

        // Seeing stars after a trash-can shot.
        if (run.stars[i] > now) {
          for (let k = 0; k < 3; k++) {
            const ang = now / 260 + (k * TAU) / 3
            outlined(
              '★',
              X + Math.cos(ang) * 16 * d,
              Y - 66 * d + Math.sin(ang) * 5 * d,
              13,
              '#ffd88a',
            )
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

      // The table, standing or in pieces, under everything.
      if (run.table) {
        const [X, Y, d] = proj(run.table.x, run.table.y)
        const broken = run.table.brokenAt > 0
        if (!broken || now - run.table.brokenAt < 6000) {
          ctx.save()
          ctx.translate(X, Y + 10 * d)
          drawShadow(ctx, 22 * d, 6 * d, 0.3)
          drawTable(ctx, 3.4 * d, broken)
          ctx.restore()
        }
      }

      // The weapon on the mat (or sliding in), under the fighters' feet.
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
        drawWeapon(ctx, run.chair.kind, 3.2 * d)
        ctx.restore()
      }

      for (const fgt of inRing) drawOne(fgt)

      // The weapon in somebody's hands: held high for the crowd the moment
      // it's picked up, then raised only when they swing.
      if (run.chair.mode === 'held' && run.chair.by >= 0) {
        const hb = run.chair.by
        if (at(state, t0, hb) === 2) {
          const hx = at(px, t0, hb) * (1 - a) + at(px, t1, hb) * a
          const hy = at(py, t0, hb) * (1 - a) + at(py, t1, hb) * a
          const [X, Y, d] = proj(hx, hy)
          if (run.showOffs[hb] > now) {
            ctx.save()
            ctx.translate(X, Y - 72 * d)
            if (!reduced) {
              ctx.beginPath()
              ctx.arc(0, 0, (16 + ((now / 70) % 10)) * d, 0, TAU)
              ctx.strokeStyle = `rgba(255,216,138,${0.5 - ((now / 70) % 10) * 0.04})`
              ctx.lineWidth = 2
              ctx.stroke()
            }
            drawWeapon(ctx, run.chair.kind, 3.2 * d)
            ctx.restore()
          } else {
            const swinging = t0 - run.lastAtk[hb] < 6
            ctx.save()
            ctx.translate(
              X + (swinging ? 14 * d * run.facing[hb] : 11 * d * run.facing[hb]),
              Y + (swinging ? -46 * d : -20 * d),
            )
            ctx.scale(run.facing[hb], 1)
            drawWeapon(ctx, run.chair.kind, 3 * d, true)
            ctx.restore()
          }
        }
      }

      // Front rope + front posts over the in-ring action.
      for (const { h, c } of ROPES) rope(CORNERS[3], CORNERS[2], h, c, c === '#ff9d2e')
      post(...CORNERS[2])
      post(...CORNERS[3])

      // Bodies at ringside land in front of everything.
      for (const fgt of outside) drawOne(fgt)

      // FINAL TWO: house lights down, spotlights up on the survivors.
      const duel = aliveNow === 2 && !finished && run.elapsed >= 0 ? 1 : 0
      run.duelK = (run.duelK ?? 0) + (duel - (run.duelK ?? 0)) * Math.min(1, dt / 500)
      if (run.duelK > 0.25) {
        ctx.fillStyle = `rgba(2,4,8,${0.32 * run.duelK})`
        ctx.fillRect(-80, -80, 1160, VIEW_H + 160)
        for (const fgt of inRing) {
          const [X, Y, d] = proj(fgt.wx, fgt.wy)
          ctx.beginPath()
          ctx.moveTo(X - 24, -20)
          ctx.lineTo(X + 24, -20)
          ctx.lineTo(X + 55 * d, Y + 22 * d)
          ctx.lineTo(X - 55 * d, Y + 22 * d)
          ctx.closePath()
          ctx.fillStyle = `rgba(255,225,160,${0.12 * run.duelK})`
          ctx.fill()
          drawOne(fgt)
        }
      }

      // The crowd lets fly: drain the watch-party feed into arcs at the ring.
      if (throwFeedRef?.current?.length) {
        for (const kind of throwFeedRef.current.splice(0, 6)) {
          run.thrown.push({
            kind,
            x0: 60 + Math.random() * 880,
            y0: 30,
            tx: 260 + Math.random() * 480,
            ty: 300 + Math.random() * 380,
            p: 0,
            spin: (Math.random() - 0.5) * 10,
          })
        }
      }
      for (let i = run.thrown.length - 1; i >= 0; i--) {
        const th = run.thrown[i]
        th.p += dt / 950
        if (th.p >= 1) {
          run.splats.push({ kind: th.kind, x: th.tx, y: th.ty, life: 0 })
          run.thrown.splice(i, 1)
          continue
        }
        const wx = th.x0 + (th.tx - th.x0) * th.p
        const wy = th.y0 + (th.ty - th.y0) * th.p
        const [X, Y, d] = proj(wx, wy)
        const z = Math.sin(th.p * Math.PI) * 150
        ctx.save()
        ctx.translate(X, Y - z * d)
        ctx.rotate(th.p * th.spin)
        drawThrowable(ctx, th.kind, 3.2 * d)
        ctx.restore()
      }
      for (let i = run.splats.length - 1; i >= 0; i--) {
        const sp = run.splats[i]
        sp.life += dt / 5000
        if (sp.life >= 1) {
          run.splats.splice(i, 1)
          continue
        }
        const [X, Y, d] = proj(sp.x, sp.y)
        ctx.save()
        ctx.globalAlpha = Math.min(1, (1 - sp.life) * 1.6)
        if (sp.kind === 'tomato') {
          ctx.beginPath()
          ctx.ellipse(X, Y, 13 * d, 6 * d, 0, 0, TAU)
          ctx.fillStyle = '#b23a2c'
          ctx.fill()
        } else {
          ctx.translate(X, Y)
          drawThrowable(ctx, sp.kind, 3 * d)
        }
        ctx.restore()
        ctx.globalAlpha = 1
      }

      // SPOTLIGHT TAKEOVER: the arena disappears; one fighter owns the frame.
      if (run.takeover && now < run.takeover.until && run.elapsed >= 0 && !inReplay) {
        const tk = run.takeover
        const age = 1 - (tk.until - now) / 950
        const k = Math.min(1, age * 5) * Math.min(1, (1 - age) * 4)
        const st = at(state, t0, tk.i)
        if (st === 2 || st === 4 || st === 5) {
          const wx = at(px, t0, tk.i) * (1 - a) + at(px, t1, tk.i) * a
          const wy = at(py, t0, tk.i) * (1 - a) + at(py, t1, tk.i) * a
          const [X, Y, d] = proj(wx, wy)
          ctx.fillStyle = `rgba(1,2,5,${0.72 * k})`
          ctx.fillRect(-120, -120, 1240, VIEW_H + 240)
          // The one beam in the building.
          ctx.beginPath()
          ctx.moveTo(X - 30, -30)
          ctx.lineTo(X + 30, -30)
          ctx.lineTo(X + 78 * d, Y + 26 * d)
          ctx.lineTo(X - 78 * d, Y + 26 * d)
          ctx.closePath()
          ctx.fillStyle = `rgba(255,232,180,${0.22 * k})`
          ctx.fill()
          ctx.beginPath()
          ctx.ellipse(X, Y + 22 * d, 66 * d, 20 * d, 0, 0, TAU)
          ctx.fillStyle = `rgba(255,232,180,${0.16 * k})`
          ctx.fill()
          drawOne({ i: tk.i, st, wx, wy })
          if (run.chair.mode === 'held' && run.chair.by === tk.i && run.showOffs[tk.i] > now) {
            ctx.save()
            ctx.translate(X, Y - 72 * d)
            ctx.beginPath()
            ctx.arc(0, 0, (16 + ((now / 70) % 10)) * d, 0, TAU)
            ctx.strokeStyle = `rgba(255,216,138,${0.5 - ((now / 70) % 10) * 0.04})`
            ctx.lineWidth = 2
            ctx.stroke()
            drawWeapon(ctx, run.chair.kind, 3.2 * d)
            ctx.restore()
          }
        }
      }

      // Pyro and debris.
      for (let i = run.pyro.length - 1; i >= 0; i--) {
        const p = run.pyro[i]
        p.life += dt / 950
        if (p.life >= 1) {
          run.pyro.splice(i, 1)
          continue
        }
        p.x += p.vx * (dt / 16.7)
        p.y += p.vy * (dt / 16.7)
        p.vy += 0.28 * (dt / 16.7)
        const [X, Y, d] = proj(p.x, p.y)
        ctx.globalAlpha = 1 - p.life
        ctx.fillStyle = p.c
        ctx.fillRect(X - 2.4 * d, Y - 2.4 * d, 4.8 * d, 4.8 * d)
        ctx.globalAlpha = 1
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
      if (run.banner && now - run.banner.at < BANNER_MS && !finished) {
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
      } else if (inIntro && entranceIdx >= 0 && entranceIdx < n) {
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
      // Impact frame: a heartbeat of white on the biggest hits.
      if (run.flash > now && !reduced) {
        ctx.fillStyle = `rgba(240,246,255,${Math.min(0.3, Math.max(0, ((run.flash - now) / 160) * 0.3))})`
        ctx.fillRect(0, 0, size, H)
      }
      // Cinema bars whenever the lens is working: entrances and tight shots.
      const wantBars = inIntro || run.cam.s > 1.1 ? 1 : 0
      run.barsK = (run.barsK ?? 0) + (wantBars - (run.barsK ?? 0)) * Math.min(1, dt / 400)
      if (run.barsK > 0.02) {
        const bh = 26 * run.barsK
        ctx.fillStyle = 'rgba(2,3,6,0.92)'
        ctx.fillRect(0, 0, size, bh)
        ctx.fillRect(0, H - bh, size, bh)
      }
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

    }

    // One bad frame must never freeze the broadcast: log it, skip it, and
    // keep the loop alive. The next frame re-derives everything from the
    // timeline anyway.
    const draw = (now) => {
      try {
        drawFrame(now)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('draft-fight frame skipped:', err)
      }
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
