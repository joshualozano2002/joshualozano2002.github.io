import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Seo from '../components/Seo'
import { Label, Lamp } from '../components/ui'
import Arena, { introDurationMs } from '../draftfight/Arena'
import { drawWrestler } from '../draftfight/sprite'
import { POSTER_H, POSTER_W, renderPoster } from '../draftfight/poster'
import { MAX_MANAGERS, MIN_MANAGERS, fightHash, readHash } from '../draftfight/codec'
import { buildFighters } from '../draftfight/roster'
import { simulate } from '../draftfight/sim'
import { newSeed } from '../draftfight/rng'
import { sharedNow, syncClock } from '../draftfight/clock'
import { PARTY_EMOJI, useParty } from '../draftfight/useParty'
import { primeAudio } from '../draftfight/sound'

const SIZES = Array.from({ length: MAX_MANAGERS - MIN_MANAGERS + 1 }, (_, i) => MIN_MANAGERS + i)
const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const pad2 = (n) => String(n).padStart(2, '0')

/** hh:mm:ss (or mm:ss) until the bell. */
const countdownText = (ms) => {
  const t = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const sec = t % 60
  return h > 0 ? `${h}:${pad2(m)}:${pad2(sec)}` : `${pad2(m)}:${pad2(sec)}`
}

/** The bell time in the viewer's own words: "7:30 PM", "Sat 7:30 PM"… */
const bellText = (startAt) => {
  const d = new Date(startAt)
  const sameDay = new Date().toDateString() === d.toDateString()
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return sameDay ? `today at ${time}` : `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at ${time}`
}

/** datetime-local value for a sensible default bell: ~15 min out, on a :05. */
const defaultBellValue = () => {
  const d = new Date(sharedNow() + 15 * 60000)
  d.setSeconds(0, 0)
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** Copy that works without the async clipboard API (older Safari, http hosts). */
function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  return new Promise((resolve, reject) => {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    ok ? resolve() : reject(new Error('copy failed'))
  })
}

function CopyButton({ value, label = 'Copy', className = '' }) {
  const [state, setState] = useState('idle')
  return (
    <button
      type="button"
      onClick={() =>
        copyText(value).then(
          () => {
            setState('done')
            setTimeout(() => setState('idle'), 1800)
          },
          () => setState('fail'),
        )
      }
      className={`readout rounded-xs border border-hairline-hot px-3 py-2 text-[11px] tracking-[0.16em] text-ink transition-colors hover:border-amber hover:text-amber ${className}`}
    >
      {state === 'done' ? 'COPIED ✓' : state === 'fail' ? 'COPY FAILED' : label.toUpperCase()}
    </button>
  )
}

/** A fighter rendered as their in-ring sprite, for cards and the winner panel. */
function SpriteAvatar({ fighter, pose = 'idle', size = 56 }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = size * dpr
    c.height = size * dpr
    const ctx = c.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.imageSmoothingEnabled = false
    ctx.translate(size / 2, size * 0.94)
    drawWrestler(ctx, fighter.pal, pose, 0, 1, size / 20)
  }, [fighter, pose, size])
  return <canvas ref={ref} aria-hidden="true" style={{ width: size, height: size }} />
}

/* ------------------------------------------------------------------ setup */

function Setup({ onStart }) {
  const [league, setLeague] = useState('')
  const [size, setSize] = useState(12)
  const [names, setNames] = useState(() => Array(12).fill(''))
  const [champ, setChamp] = useState(-1)
  const [mode, setMode] = useState('live')
  const [bell, setBell] = useState(defaultBellValue)
  const [error, setError] = useState('')

  const resize = (next) => {
    setSize(next)
    setNames((prev) =>
      next <= prev.length ? prev.slice(0, next) : [...prev, ...Array(next - prev.length).fill('')],
    )
  }

  const submit = (e) => {
    e.preventDefault()
    const managers = names.map((n) => n.trim())
    const missing = managers.findIndex((n) => !n)
    if (missing >= 0) {
      setError(`Manager ${missing + 1} still needs a name — every seat has to be filled.`)
      return
    }
    let startAt = 0
    if (mode === 'live') {
      startAt = new Date(bell).getTime()
      if (!Number.isFinite(startAt)) {
        setError('Pick a time for the bell.')
        return
      }
      if (startAt - sharedNow() < 60_000) {
        setError('The bell needs to be at least a minute out, so the league has time to tune in.')
        return
      }
    }
    setError('')
    onStart({
      league: league.trim() || 'The League',
      managers,
      seed: newSeed(),
      startAt,
      champ: champ >= 0 && champ < managers.length ? champ : -1,
    })
  }

  return (
    <form onSubmit={submit} className="panel mt-10 p-6 sm:p-8">
      <div className="mb-2 flex items-center gap-2.5">
        <Lamp color="amber" />
        <Label className="text-amber">Step 01 · League</Label>
      </div>
      <label htmlFor="df-league" className="mt-4 block label text-dim">
        League name
      </label>
      <input
        id="df-league"
        value={league}
        onChange={(e) => setLeague(e.target.value)}
        maxLength={40}
        placeholder="Sunday Money League"
        className="mt-2 w-full rounded-xs border border-hairline bg-void px-3 py-2.5 text-sm text-ink outline-none placeholder:text-mute focus:border-amber"
      />

      <div className="mt-8 mb-2 flex items-center gap-2.5">
        <Lamp color="cyan" />
        <Label className="text-cyan">Step 02 · Field size</Label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {SIZES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => resize(s)}
            aria-pressed={s === size}
            className={`readout w-11 rounded-xs border py-2 text-xs transition-colors ${
              s === size
                ? 'border-amber bg-amber/10 text-amber'
                : 'border-hairline text-dim hover:border-hairline-hot hover:text-ink'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-mute">
        Six to sixteen managers. Everyone gets a fighter; the last one standing takes pick one.
      </p>

      <div className="mt-8 mb-2 flex items-center gap-2.5">
        <Lamp color="magenta" />
        <Label className="text-magenta">Step 03 · Managers</Label>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {names.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="readout w-6 shrink-0 text-[10px] text-mute">
              {String(i + 1).padStart(2, '0')}
            </span>
            <input
              value={v}
              onChange={(e) =>
                setNames((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))
              }
              maxLength={18}
              placeholder={`Manager ${i + 1}`}
              aria-label={`Manager ${i + 1} name`}
              className="w-full rounded-xs border border-hairline bg-void px-3 py-2 text-sm text-ink outline-none placeholder:text-mute focus:border-amber"
            />
          </div>
        ))}
      </div>

      <div className="mt-8 mb-2 flex items-center gap-2.5">
        <Lamp color="cyan" />
        <Label className="text-cyan">Step 04 · Defending Pick 1</Label>
      </div>
      <p className="mt-1 text-xs text-mute">
        Optional: whoever held Pick 1 last season enters last, in the gold. It's a target on their
        back, not an edge — the fight stays dead even.
      </p>
      <select
        value={champ}
        onChange={(e) => setChamp(Number(e.target.value))}
        aria-label="Defending champion"
        className="mt-3 rounded-xs border border-hairline bg-void px-3 py-2 text-sm text-ink outline-none [color-scheme:dark] focus:border-amber"
      >
        <option value={-1}>Nobody — first season</option>
        {names.map((v, i) =>
          v.trim() ? (
            <option key={i} value={i}>
              {v.trim()}
            </option>
          ) : null,
        )}
      </select>

      <div className="mt-8 mb-2 flex items-center gap-2.5">
        <Lamp color="annunciator" />
        <Label style={{ color: 'var(--color-annunciator)' }}>Step 05 · Bell time</Label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          ['live', 'LIVE EVENT'],
          ['demand', 'ON DEMAND'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            aria-pressed={mode === key}
            className={`readout rounded-xs border px-4 py-2.5 text-[11px] tracking-[0.16em] transition-colors ${
              mode === key
                ? 'border-amber bg-amber/10 text-amber'
                : 'border-hairline text-dim hover:border-hairline-hot hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
        {mode === 'live' ? (
          <input
            type="datetime-local"
            value={bell}
            onChange={(e) => setBell(e.target.value)}
            aria-label="Bell time"
            className="readout rounded-xs border border-hairline bg-void px-3 py-2 text-xs text-ink outline-none [color-scheme:dark] focus:border-amber"
          />
        ) : null}
      </div>
      <p className="mt-3 text-xs text-mute">
        {mode === 'live'
          ? 'The bell rings for the whole league at once. Anyone opening the link early gets a countdown, nobody can watch ahead — you included — and anyone tuning in late joins the fight already in progress.'
          : 'No schedule — each person watches the same fight whenever they open the link.'}
      </p>

      {error ? (
        <p role="alert" className="mt-5 text-sm text-[#ff8a7a]">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        className="mt-8 w-full rounded-xs bg-amber px-5 py-3.5 font-display text-sm font-bold tracking-[0.18em] text-void uppercase transition-opacity hover:opacity-90"
      >
        {mode === 'live' ? 'Schedule the fight' : 'Build the fight'}
      </button>
    </form>
  )
}

/* ------------------------------------------------------------- draft board */

function Board({ n, fighters, revealed, compact = false }) {
  return (
    <ol className="divide-y divide-hairline border border-hairline">
      {Array.from({ length: n }, (_, i) => {
        const pick = i + 1
        const id = revealed[pick]
        const f = id === undefined ? null : fighters[id]
        return (
          <li
            key={pick}
            className={`flex items-center gap-3 px-3 ${compact ? 'py-1.5' : 'py-2.5'} ${
              f ? '' : 'opacity-45'
            }`}
          >
            <span
              className="readout w-8 shrink-0 text-[11px]"
              style={{ color: pick === 1 && f ? 'var(--color-amber)' : 'var(--color-mute)' }}
            >
              {String(pick).padStart(2, '0')}
            </span>
            {f ? (
              <>
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: f.color, boxShadow: `0 0 8px ${f.glow}` }}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{f.name}</span>
                <span className="readout hidden shrink-0 text-[10px] text-mute sm:inline">
                  {f.callsign}
                </span>
              </>
            ) : (
              <>
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-hairline-hot" />
                <span className="readout flex-1 text-xs text-mute">— — — —</span>
              </>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/* ------------------------------------------------------------------- page */

export default function DraftFight() {
  const [spec, setSpec] = useState(null)
  const [phase, setPhase] = useState('setup') // setup · lobby · live · done
  const [revealed, setRevealed] = useState({})
  const [hud, setHud] = useState({ secs: 0, alive: 0 })
  const [speed, setSpeed] = useState(1)
  const [sound, setSound] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [runKey, setRunKey] = useState(0)
  const [href, setHref] = useState('')
  const [replay, setReplay] = useState(false) // aired live fight, watched again
  const [, setTick] = useState(0) // re-render pulse for the countdown
  const [feed, setFeed] = useState([]) // broadcast-booth lines, newest first
  const feedId = useRef(0)
  const [myCall, setMyCall] = useState(null) // this viewer's winner prediction

  // One shared clock for everyone watching a scheduled fight.
  useEffect(() => {
    syncClock()
  }, [])

  // An invite link carries the whole fight in its fragment.
  useEffect(() => {
    const load = () => {
      const parsed = readHash(window.location.hash)
      if (parsed) {
        setSpec(parsed)
        setPhase('lobby')
        setRevealed({})
        setReplay(false)
        setFeed([])
        setHud({ secs: 0, alive: parsed.managers.length })
        setHref(window.location.href)
      } else {
        setSpec(null)
        setPhase('setup')
      }
    }
    load()
    window.addEventListener('hashchange', load)
    return () => window.removeEventListener('hashchange', load)
  }, [])

  const fighters = useMemo(
    () => (spec ? buildFighters(spec.seed, spec.managers, spec.champ ?? -1) : null),
    [spec],
  )
  const fight = useMemo(
    () => (spec ? simulate(spec.seed, spec.managers.length) : null),
    [spec],
  )

  const isLive = Boolean(spec?.startAt) && !replay

  const publish = useCallback((next) => {
    const hash = fightHash(next)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
    setHref(window.location.href)
    setSpec(next)
    setRevealed({})
    setReplay(false)
    setFeed([])
    setPhase('lobby')
    setPlaying(false)
    setSpeed(1)
    setRunKey((k) => k + 1)
  }, [])

  const arenaCtl = useRef(null)
  const party = useParty(spec?.seed)

  const start = () => {
    primeAudio()
    if (spec.startAt) setReplay(true) // the event aired; this showing is a replay
    setRevealed({})
    setFeed([])
    setHud({ secs: 0, alive: spec.managers.length })
    setRunKey((k) => k + 1)
    setPhase('live')
    setPlaying(true)
  }

  const onElim = useCallback((e) => {
    setRevealed((r) => ({ ...r, [e.pick]: e.id }))
  }, [])

  const onEnd = useCallback(() => {
    setRevealed((r) => ({ ...r, 1: fight.winner }))
    setPlaying(false)
    setPhase('done')
  }, [fight])

  const onClock = useCallback((secs, alive) => setHud({ secs, alive }), [])

  const onTicker = useCallback((text) => {
    setFeed((f) => [{ id: feedId.current++, text }, ...f].slice(0, 3))
  }, [])

  // Call your shot: this viewer's private prediction, kept on this device only.
  const callKey = spec ? `df-call-${spec.seed}` : null
  useEffect(() => {
    if (!callKey) return
    try {
      const v = localStorage.getItem(callKey)
      setMyCall(v === null ? null : Number(v))
    } catch {
      setMyCall(null)
    }
  }, [callKey])
  const callShot = (id) => {
    setMyCall(id)
    party.sendCall(id)
    try {
      localStorage.setItem(callKey, String(id))
    } catch {
      /* private mode: the pick just won't survive a reload */
    }
  }

  /** Broadcast position: ms since the bell, on the skew-corrected clock. */
  const liveClock = useCallback(() => sharedNow() - spec.startAt, [spec])

  // Opening a scheduled link: jump to wherever the broadcast is right now —
  // countdown lobby, mid-fight, or straight to the result if it already aired.
  useEffect(() => {
    if (!spec?.startAt || !fight || replay) return
    const sinceBell = sharedNow() - spec.startAt
    const preShow = introDurationMs(spec.managers.length) + 2000
    if (sinceBell > fight.durationMs + 2000) {
      const all = {}
      fight.order.forEach((id, i) => {
        all[i + 1] = id
      })
      setRevealed(all)
      setPlaying(false)
      setPhase('done')
    } else if (sinceBell > -preShow) {
      setPhase('live')
    }
  }, [spec, fight, replay])

  // Countdown ticker; flips the lobby into the arena eight seconds out.
  useEffect(() => {
    if (!spec?.startAt || replay || phase === 'done') return
    const id = setInterval(() => {
      setTick((t) => t + 1)
      if (spec.startAt - sharedNow() <= introDurationMs(spec.managers.length) + 2000) {
        setPhase((p) => (p === 'lobby' ? 'live' : p))
      }
    }, 250)
    return () => clearInterval(id)
  }, [spec, replay, phase])


  // Each stage is a different page, but the router only scrolls on a real
  // route change — without this you submit the roster and land halfway down
  // the tale of the tape.
  useEffect(() => {
    if (phase !== 'setup') window.scrollTo({ top: 0, behavior: 'instant' })
  }, [phase])

  const skip = () => {
    if (!fight) return
    const all = {}
    fight.order.forEach((id, i) => {
      all[i + 1] = id
    })
    setRevealed(all)
    setPlaying(false)
    setPhase('done')
  }

  /** Post-fight hardware, straight from the stat sheet. */
  const awards = useMemo(() => {
    if (!fight?.stats) return []
    const st = fight.stats
    const top = (key, tie = 'dmg') =>
      st.reduce((b, x, i) => {
        const bv = st[b]
        return x[key] > bv[key] || (x[key] === bv[key] && x[tie] > bv[tie]) ? i : b
      }, 0)
    const out = [
      { title: 'MOST VIOLENT', id: top('dmg'), detail: `${st[top('dmg')].dmg} damage dealt` },
      { title: 'IRON CHIN', id: top('taken'), detail: `${st[top('taken')].taken} damage eaten` },
      { title: 'GLASS JAW', id: fight.order[fight.order.length - 1], detail: 'first one out' },
    ]
    const hc = top('chair')
    if (st[hc].chair > 0)
      out.push({
        title: 'HARDCORE',
        id: hc,
        detail: `${st[hc].chair} chair damage`,
      })
    if (fight.feud && fight.feud.dmg > 45 && fighters)
      out.push({
        title: 'BLOOD FEUD',
        id: fight.feud.a,
        detail: `vs ${fighters[fight.feud.b].name} · ${fight.feud.dmg} dmg traded`,
      })
    const ex = top('kos')
    if (fight.stats[ex].kos > 0)
      out.splice(1, 0, {
        title: 'THE EXECUTIONER',
        id: ex,
        detail: `${st[ex].kos} elimination${st[ex].kos > 1 ? 's' : ''}`,
      })
    return out
  }, [fight])

  /** Build the group-chat poster and hand it over as a PNG download. */
  const downloadPoster = useCallback(() => {
    if (!spec || !fight || !fighters) return
    const c = document.createElement('canvas')
    c.width = POSTER_W
    c.height = POSTER_H
    renderPoster(c.getContext('2d'), { spec, fight, fighters, awards })
    c.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${spec.league.replace(/[^\w]+/g, '-').toLowerCase()}-draft-order.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    })
  }, [spec, fight, fighters, awards])

  const resultText = useMemo(() => {
    if (!spec || !fight || !fighters) return ''
    const lines = fight.order.map((id, i) => `${i + 1}. ${fighters[id].name}`)
    return `${spec.league} — draft order\n\n${lines.join('\n')}\n\nWatch the fight: ${href}`
  }, [spec, fight, fighters, href])

  const n = spec?.managers.length ?? 0
  const winner = fight && fighters ? fighters[fight.winner] : null

  return (
    <>
      <Seo
        title="Draft Fight"
        description="Settle the fantasy draft order with a battle royale. Every manager gets a fighter, the last one standing takes pick one, and one link replays the exact same fight for the whole league."
        path="/draft-fight"
        image="media/draft-fight-og.jpg"
        robots="noindex, nofollow"
      />

      <section className="relative min-h-dvh pt-14">
        <div aria-hidden="true" className="absolute inset-0 grid-bg mask-fade opacity-40" />

        <div className="relative mx-auto w-full max-w-5xl px-5 py-16 lg:px-8">
          <div className="mb-5 flex items-center gap-2.5">
            <Lamp color="amber" />
            <Label className="text-amber">
              {phase === 'setup' ? 'Draft Fight · Standby' : `${spec?.league} · ${n} managers`}
            </Label>
          </div>

          {phase === 'setup' ? (
            <>
              <h1 className="font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
                Draft Fight
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-dim text-pretty sm:text-lg">
                Nobody trusts the randomize button. Put every manager in the ring instead — full
                entrances, one bell, everyone fighting at once — and take the draft order off the
                floor: first one out picks last, last one standing picks first. One link, and the
                whole league watches the same fight, hit for hit.
              </p>
              <Setup onStart={publish} />
            </>
          ) : null}

          {spec && fight && fighters ? (
            <div className="mt-2">
              {phase === 'lobby' ? (
                <>
                  <h1 className="font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
                    {spec.league}
                  </h1>
                  <p className="mt-5 max-w-2xl text-base leading-relaxed text-dim text-pretty">
                    {isLive
                      ? `${n} managers, one ring, one broadcast. Send the link below now — everyone who opens it gets this countdown, and the fight starts for the whole league at the same moment.`
                      : `${n} managers, one ring, ${n} draft slots. Send the link below to the league — every person who opens it sees this exact fight, so nobody has to take your word for the result.`}
                  </p>

                  <div className="panel mt-8 p-5">
                    <Label className="text-cyan">Invite link</Label>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <code className="readout min-w-0 flex-1 truncate rounded-xs border border-hairline bg-void px-3 py-2.5 text-[11px] text-dim">
                        {href}
                      </code>
                      <div className="flex shrink-0 gap-2">
                        <CopyButton value={href} label="Copy link" />
                        {typeof navigator !== 'undefined' && navigator.share ? (
                          <button
                            type="button"
                            onClick={() =>
                              navigator
                                .share({ title: `${spec.league} draft fight`, url: href })
                                .catch(() => {})
                            }
                            className="readout rounded-xs border border-hairline-hot px-3 py-2 text-[11px] tracking-[0.16em] text-ink hover:border-amber hover:text-amber"
                          >
                            SHARE
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-10">
                    <Label className="mb-3 text-dim">Tale of the tape</Label>
                    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {fighters.map((f) => (
                        <li
                          key={f.id}
                          className="flex items-center gap-3 rounded-xs border border-hairline bg-panel/60 px-3 py-2"
                          style={{ borderBottomColor: f.color }}
                        >
                          <SpriteAvatar fighter={f} size={52} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">
                              {f.name}
                              {f.champ ? (
                                <span className="readout ml-2 text-[9px] tracking-[0.14em] text-[#e8c35a]">
                                  DEFENDING PICK 1
                                </span>
                              ) : null}
                            </span>
                            <span className="readout block text-[10px]" style={{ color: f.color }}>
                              {f.callsign} · #{f.number}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="panel mt-8 p-5">
                    <div className="flex items-baseline justify-between gap-3">
                      <Label className="text-amber">Call your shot</Label>
                      <span className="readout text-[10px] text-mute">
                        private · stays on this device
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-mute">
                      Who takes Pick 1? Lock it in before the bell and see how your read holds up.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {fighters.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => callShot(f.id)}
                          aria-pressed={myCall === f.id}
                          className={`readout rounded-xs border px-2.5 py-1.5 text-[11px] transition-colors ${
                            myCall === f.id
                              ? 'border-amber bg-amber/10 text-amber'
                              : 'border-hairline text-dim hover:border-hairline-hot hover:text-ink'
                          }`}
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>
                    {myCall !== null && fighters[myCall] ? (
                      <p className="readout mt-3 text-[11px] text-dim">
                        You're riding with{' '}
                        <span style={{ color: fighters[myCall].color }}>
                          {fighters[myCall].name} · {fighters[myCall].callsign}
                        </span>
                      </p>
                    ) : null}
                    {party.enabled && Object.keys(party.tally).length > 0 ? (
                      <p className="readout mt-2 text-[11px] text-mute">
                        The room's money:{' '}
                        {Object.entries(party.tally)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 3)
                          .map(([who, count]) => `${fighters[+who]?.name ?? '?'} ×${count}`)
                          .join(' · ')}
                      </p>
                    ) : null}
                  </div>

                  {isLive ? (
                    <div className="panel mt-8 p-6 text-center">
                      <div className="mb-3 flex items-center justify-center gap-2.5">
                        <Lamp color="magenta" />
                        <Label className="text-magenta">Live event · Bell {bellText(spec.startAt)}</Label>
                      </div>
                      <p className="readout text-5xl font-bold tracking-tight text-amber sm:text-6xl">
                        {countdownText(spec.startAt - sharedNow())}
                      </p>
                      <p className="mx-auto mt-4 max-w-md text-xs leading-relaxed text-mute">
                        Wrestler entrances begin about{' '}
                        {Math.round(introDurationMs(n) / 1000)} seconds before the bell, right here,
                        by themselves, for everyone at once. Nobody can watch early — you included.
                        Tune in late and you join the fight already in progress.
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    {!isLive ? (
                      <button
                        type="button"
                        onClick={start}
                        className="rounded-xs bg-amber px-6 py-3.5 font-display text-sm font-bold tracking-[0.18em] text-void uppercase transition-opacity hover:opacity-90"
                      >
                        Ring the bell
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        primeAudio()
                        setSound((s) => !s)
                      }}
                      className="readout rounded-xs border border-hairline px-4 py-3 text-[11px] tracking-[0.16em] text-dim hover:border-amber hover:text-amber"
                    >
                      SOUND {sound ? 'ON' : 'OFF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => publish({ ...spec, seed: newSeed() })}
                      className="readout rounded-xs border border-hairline px-4 py-3 text-[11px] tracking-[0.16em] text-dim hover:border-amber hover:text-amber"
                    >
                      RE-ROLL FIGHT
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-mute">
                    Re-rolling makes a different fight and a different link. Do it before you send
                    the invite, not after.
                  </p>
                </>
              ) : null}

              {phase === 'live' || phase === 'done' ? (
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-5">
                        <span className="readout text-sm text-amber">
                          {clock(Math.max(0, hud.secs))}
                        </span>
                        <span className="label">
                          {phase === 'done'
                            ? 'Fight over'
                            : hud.secs < 0
                              ? 'Entrances'
                              : `${hud.alive} standing`}
                        </span>
                      </div>
                      {phase === 'live' && isLive ? (
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-2 rounded-xs border border-[#ff5a4d]/60 px-3 py-1.5">
                            <Lamp color="magenta" className="animate-pulse" />
                            <span className="readout text-[10px] tracking-[0.2em] text-[#ff8a7a]">
                              LIVE
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              primeAudio()
                              setSound((v) => !v)
                            }}
                            className="readout rounded-xs border border-hairline px-3 py-1.5 text-[10px] tracking-[0.16em] text-dim hover:border-amber hover:text-amber"
                          >
                            {sound ? 'SOUND ON' : 'SOUND OFF'}
                          </button>
                        </div>
                      ) : null}
                      {phase === 'live' && !isLive ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPlaying((p) => !p)}
                            className="readout rounded-xs border border-hairline px-3 py-1.5 text-[10px] tracking-[0.16em] text-dim hover:border-amber hover:text-amber"
                          >
                            {playing ? 'PAUSE' : 'RESUME'}
                          </button>
                          {[1, 2, 4].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setSpeed(s)}
                              aria-pressed={speed === s}
                              className={`readout rounded-xs border px-2.5 py-1.5 text-[10px] tracking-[0.16em] ${
                                speed === s
                                  ? 'border-amber text-amber'
                                  : 'border-hairline text-dim hover:text-ink'
                              }`}
                            >
                              {s}×
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setSound((v) => !v)}
                            className="readout rounded-xs border border-hairline px-3 py-1.5 text-[10px] tracking-[0.16em] text-dim hover:border-amber hover:text-amber"
                          >
                            {sound ? 'SOUND ON' : 'SOUND OFF'}
                          </button>
                          {hud.secs < -2 ? (
                            <button
                              type="button"
                              onClick={() => arenaCtl.current?.skipIntro()}
                              className="readout rounded-xs border border-hairline px-3 py-1.5 text-[10px] tracking-[0.16em] text-dim hover:border-amber hover:text-amber"
                            >
                              SKIP ENTRANCES
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={skip}
                            className="readout rounded-xs border border-hairline px-3 py-1.5 text-[10px] tracking-[0.16em] text-dim hover:border-amber hover:text-amber"
                          >
                            SKIP
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {phase === 'live' ? (
                      <div className="relative">
                        {party.enabled && party.watching > 1 ? (
                          <div className="absolute right-2 top-2 z-10 flex items-center gap-2 rounded-xs border border-hairline bg-void/80 px-2.5 py-1">
                            <Lamp color="annunciator" />
                            <span className="readout text-[10px] text-dim">
                              {party.watching} WATCHING
                            </span>
                          </div>
                        ) : null}
                        {party.reactions.map((r) => (
                          <span
                            key={r.id}
                            aria-hidden="true"
                            className="df-float pointer-events-none absolute bottom-6 z-10 text-2xl"
                            style={{ left: `${r.x}%` }}
                          >
                            {r.e}
                          </span>
                        ))}
                        <Arena
                        fight={fight}
                        fighters={fighters}
                        playing={playing}
                        speed={speed}
                        sound={sound}
                        runKey={runKey}
                        clock={isLive ? liveClock : undefined}
                        league={spec.league}
                        champ={spec.champ ?? -1}
                        ctlRef={arenaCtl}
                        onElim={onElim}
                        onTicker={onTicker}
                        onClock={onClock}
                        onEnd={onEnd}
                      />
                        {party.enabled ? (
                          <div className="mt-2 flex justify-center gap-1.5">
                            {PARTY_EMOJI.map((e) => (
                              <button
                                key={e}
                                type="button"
                                onClick={() => party.sendReact(e)}
                                className="rounded-xs border border-hairline px-2.5 py-1 text-base transition-colors hover:border-amber"
                                aria-label={`React ${e}`}
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {phase === 'live' && feed.length > 0 ? (
                      <div className="mt-3 rounded-xs border border-hairline bg-panel/80 px-4 py-2.5">
                        <div className="flex items-baseline gap-3">
                          <span className="readout shrink-0 text-[9px] tracking-[0.2em] text-amber">
                            BOOTH
                          </span>
                          <div className="min-w-0">
                            {feed.map((l, i) => (
                              <p
                                key={l.id}
                                className={`readout truncate text-[11px] leading-5 ${
                                  i === 0 ? 'text-ink' : 'text-mute'
                                }`}
                              >
                                {l.text}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {phase === 'done' ? (
                      <div className="panel p-6 sm:p-8">
                        <div className="flex items-end gap-5">
                          {winner ? <SpriteAvatar fighter={winner} pose="win" size={104} /> : null}
                          <div>
                            <Label className="text-amber">
                              {winner?.champ ? 'Pick 01 · Retained' : 'Pick 01'}
                            </Label>
                            <p className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                              {winner?.name}
                            </p>
                            <p className="readout mt-2 text-xs text-mute">
                              {winner?.callsign} · #{winner?.number} · last one standing
                            </p>
                          </div>
                        </div>
                        <div className="rule my-6" />
                        <div className="flex flex-wrap gap-2">
                          <CopyButton value={resultText} label="Copy results" />
                          <CopyButton value={href} label="Copy link" />
                          <button
                            type="button"
                            onClick={downloadPoster}
                            className="readout rounded-xs border border-hairline-hot px-3 py-2 text-[11px] tracking-[0.16em] text-ink hover:border-amber hover:text-amber"
                          >
                            DOWNLOAD POSTER
                          </button>
                          <button
                            type="button"
                            onClick={start}
                            className="readout rounded-xs border border-hairline-hot px-3 py-2 text-[11px] tracking-[0.16em] text-ink hover:border-amber hover:text-amber"
                          >
                            {spec.startAt ? 'WATCH THE REPLAY' : 'WATCH AGAIN'}
                          </button>
                        </div>
                        <p className="mt-5 text-xs text-mute">
                          {spec.startAt
                            ? `This one aired live ${bellText(spec.startAt)} — the whole league saw the same ${n - 1} knockouts at the same moment, and the link replays it for anyone who missed the broadcast.`
                            : `This link always replays this fight. Anyone who thinks you fixed it can open it themselves and watch the same ${n - 1} knockouts land in the same order.`}
                        </p>

                        {myCall !== null && fighters[myCall] ? (
                          <div
                            className="mt-6 rounded-xs border px-4 py-3"
                            style={{
                              borderColor:
                                myCall === fight.winner
                                  ? 'var(--color-annunciator)'
                                  : 'var(--color-hairline-hot)',
                            }}
                          >
                            <Label
                              style={{
                                color:
                                  myCall === fight.winner
                                    ? 'var(--color-annunciator)'
                                    : 'var(--color-mute)',
                              }}
                            >
                              {myCall === fight.winner ? 'You called it' : 'Your call'}
                            </Label>
                            <p className="mt-1.5 text-sm text-ink">
                              {myCall === fight.winner
                                ? `You had ${fighters[myCall].name} taking Pick 1. Respect.`
                                : fight.pickOf[myCall] <= 3
                                  ? `You had ${fighters[myCall].name} — they fell at Pick ${fight.pickOf[myCall]}. Agonizingly close.`
                                  : `You had ${fighters[myCall].name} — they went out at Pick ${fight.pickOf[myCall]}. Not even close.`}
                            </p>
                          </div>
                        ) : null}

                        <div className="rule my-6" />
                        <Label className="mb-3 text-dim">Fight awards</Label>
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {awards.map((a) => (
                            <li
                              key={a.title}
                              className="flex items-center gap-3 rounded-xs border border-hairline px-3 py-2"
                            >
                              <SpriteAvatar fighter={fighters[a.id]} size={40} />
                              <span className="min-w-0">
                                <span
                                  className="readout block text-[10px] tracking-[0.16em]"
                                  style={{ color: fighters[a.id].color }}
                                >
                                  {a.title}
                                </span>
                                <span className="block truncate text-sm text-ink">
                                  {fighters[a.id].name}
                                  <span className="text-mute"> · {a.detail}</span>
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>

                        <div className="mt-6 overflow-x-auto">
                          <table className="w-full min-w-105 text-left">
                            <thead>
                              <tr className="border-b border-hairline">
                                {['PICK', 'MANAGER', 'DMG', 'TAKEN', 'KOS', 'LASTED'].map((h) => (
                                  <th key={h} className="label py-2 pr-4 font-medium">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {fight.order.map((id, i) => (
                                <tr key={id} className="border-b border-hairline/50">
                                  <td className="readout py-1.5 pr-4 text-xs text-amber">
                                    {String(i + 1).padStart(2, '0')}
                                  </td>
                                  <td className="py-1.5 pr-4 text-sm text-ink">
                                    {fighters[id].name}
                                  </td>
                                  <td className="readout py-1.5 pr-4 text-xs text-dim">
                                    {fight.stats[id].dmg}
                                  </td>
                                  <td className="readout py-1.5 pr-4 text-xs text-dim">
                                    {fight.stats[id].taken}
                                  </td>
                                  <td className="readout py-1.5 pr-4 text-xs text-dim">
                                    {fight.stats[id].kos}
                                  </td>
                                  <td className="readout py-1.5 pr-4 text-xs text-dim">
                                    {clock(fight.stats[id].survived / 30)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <aside>
                    <Label className="mb-3 text-dim">Draft board</Label>
                    <Board n={n} fighters={fighters} revealed={revealed} />
                    <p className="mt-3 text-xs text-mute">
                      First one knocked out picks last, so the board fills from the bottom up.
                    </p>
                  </aside>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </>
  )
}
