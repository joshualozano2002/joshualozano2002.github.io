import { useCallback, useEffect, useState } from 'react'
import Seo from '../components/Seo'
import { Label, Lamp, Reveal, accentVar } from '../components/ui'
import { allItems, christmas, groupTotals, totals } from '../data/wishlist'
import { profile } from '../data/profile'
import { withBase } from '../site'
import SnowGlobe from '../christmas/SnowGlobe'
import {
  SESSION_KEY,
  clearClaim,
  configured,
  fetchClaims,
  setClaim,
  unlock,
} from '../christmas/gifts'

const usd = (n) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

/** A range prints as a range; a fixed figure prints once. */
const money = (low, high) => (low === high ? usd(low) : `${usd(low)} – ${usd(high)}`)

/** Whole days from now until local midnight on the 25th. */
function daysUntil({ y, m, d }) {
  const now = new Date()
  const target = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target - today) / 86400000)
}

/**
 * Where the sleigh is headed. From the pole the great circle runs straight
 * down a meridian, so the distance is simply the latitude difference, at the
 * nautical mile's own definition of one minute of arc.
 */
const DESTINATION = { name: 'Oxnard, CA', lat: 34.1975 }
const DISTANCE_NM = Math.round((90 - DESTINATION.lat) * 60)

/** 34.1975 -> 34°12′N. Derived, so the printed position cannot drift. */
const dms = (lat) =>
  `${Math.floor(lat)}°${String(Math.round((lat % 1) * 60)).padStart(2, '0')}′N`

const byId = Object.fromEntries(allItems.map((i) => [i.id, i]))

/** Reverse of `needs`: who is waiting on this item. */
const neededBy = allItems.reduce((map, item) => {
  for (const id of item.needs ?? []) (map[id] ??= []).push(item.id)
  return map
}, {})

/**
 * Both directions of the dependency, as one list of lines.
 *
 * A pair that declares the link from both sides — the NAS and its drives are
 * useless without each other — would otherwise print the same fact twice, so
 * the reverse direction drops anything the item already states itself.
 */
const dependencies = (item) => [
  ...(item.needs ?? []).map((id) => ({ key: `n${id}`, verb: 'Needs', id })),
  ...(neededBy[item.id] ?? [])
    .filter((id) => !(item.needs ?? []).includes(id))
    .map((id) => ({ key: `b${id}`, verb: 'Needed by', id })),
]

/* ------------------------------------------------------------------ *
 * Shopping mode
 * ------------------------------------------------------------------ */

/**
 * Holds the unlocked key and the decrypted claims.
 *
 * Locked is the default and the whole point: with no passphrase the page
 * makes no requests at all, so the person whose list it is sees a wishlist
 * and nothing else.
 */
function useShopping() {
  const [crew, setCrew] = useState(null) // { listId, key, name }
  const [claims, setClaims] = useState(new Map())
  const [status, setStatus] = useState('locked') // locked | opening | open | error
  const [error, setError] = useState('')

  const open = useCallback(async (passphrase, name, { remember = true } = {}) => {
    setStatus('opening')
    setError('')
    try {
      const derived = await unlock(passphrase)
      const found = await fetchClaims(derived)
      setCrew({ ...derived, name: name.trim() })
      setClaims(found)
      setStatus('open')
      if (remember) {
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({ passphrase, name }))
        } catch {
          /* private mode — shopping still works, it just will not persist */
        }
      }
      return true
    } catch (e) {
      setStatus('error')
      setError(e.message || 'could not open shopping mode')
      return false
    }
  }, [])

  const close = useCallback(() => {
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* nothing to clear */
    }
    setCrew(null)
    setClaims(new Map())
    setStatus('locked')
    setError('')
  }, [])

  // Restore within the tab, so moving around does not mean re-entering the code.
  useEffect(() => {
    let saved
    try {
      saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
    } catch {
      saved = null
    }
    if (saved?.passphrase) open(saved.passphrase, saved.name ?? '', { remember: false })
  }, [open])

  const toggle = useCallback(
    async (item, taken) => {
      if (!crew) return
      // Optimistic: the request is one small round trip and a stuck checkbox
      // is worse than a rare rollback.
      const previous = new Map(claims)
      const next = new Map(claims)
      if (taken) next.set(item, { name: crew.name, at: Date.now() })
      else next.delete(item)
      setClaims(next)
      try {
        if (taken) await setClaim(crew, item, crew.name)
        else await clearClaim(crew, item)
      } catch (e) {
        setClaims(previous)
        setError(e.message || 'that did not save')
      }
    },
    [claims, crew],
  )

  return { crew, claims, status, error, open, close, toggle }
}

function ShoppingPanel({ shopping }) {
  const [showForm, setShowForm] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const { status, error, claims, crew } = shopping

  if (!configured) return null

  if (status === 'open') {
    return (
      <div className="panel panel-lights mt-10 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Lamp color="green" />
            <Label className="text-annunciator">
              Shopping mode · {claims.size} of {totals.items} claimed
              {crew.name ? ` · you are ${crew.name}` : ''}
            </Label>
          </div>
          <button
            type="button"
            onClick={shopping.close}
            className="readout inline-flex min-h-11 items-center text-xs tracking-[0.2em] text-dim underline-offset-4 hover:text-amber hover:underline sm:min-h-0 sm:text-[11px]"
          >
            LEAVE ↗
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-dim text-pretty">
          Tick anything you are buying so nobody doubles up. Joshua cannot see any of this —
          it is encrypted with the family code before it leaves your browser.
        </p>
        {error ? <p className="readout mt-3 text-[11px] text-beacon">{error.toUpperCase()}</p> : null}
      </div>
    )
  }

  return (
    <div className="mt-10 border-y border-hairline py-5">
      {!showForm ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-dim">
            <span className="text-ink">Shopping for Joshua?</span> Enter the family code to see
            what is already taken.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="readout inline-flex min-h-11 shrink-0 items-center rounded-xs border border-hairline px-4 text-xs tracking-[0.2em] text-dim transition-colors hover:border-hairline-hot hover:text-ink sm:min-h-0 sm:py-2 sm:text-[11px]"
          >
            SHOPPING MODE
          </button>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const ok = await shopping.open(code, name)
            if (ok) {
              setShowForm(false)
              setCode('')
            }
          }}
        >
          <p className="text-sm leading-relaxed text-dim text-pretty">
            <span className="text-beacon">Joshua — this one is not for you.</span> Everyone else:
            the code is whatever the family agreed on. It both finds the list and decrypts it, so
            a wrong code simply shows an empty one.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Family code"
              autoComplete="off"
              required
              className="readout min-h-12 min-w-0 flex-1 rounded-xs border border-hairline bg-panel px-3 text-base text-ink placeholder:text-mute sm:min-h-0 sm:py-2.5 sm:text-sm"
            />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="off"
              required
              className="readout min-h-12 min-w-0 flex-1 rounded-xs border border-hairline bg-panel px-3 text-base text-ink placeholder:text-mute sm:max-w-44 sm:min-h-0 sm:py-2.5 sm:text-sm"
            />
            <button
              type="submit"
              disabled={status === 'opening'}
              className="readout min-h-12 shrink-0 rounded-xs border border-amber/60 px-4 text-xs tracking-[0.2em] text-amber transition-colors hover:bg-amber/10 disabled:opacity-50 sm:min-h-0 sm:py-2.5 sm:text-[11px]"
            >
              {status === 'opening' ? 'OPENING…' : 'ENTER'}
            </button>
          </div>
          {error ? (
            <p className="readout mt-3 text-[11px] text-beacon">{error.toUpperCase()}</p>
          ) : null}
        </form>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Sky
 * ------------------------------------------------------------------ */

/**
 * One reindeer in a flying gallop.
 *
 * The silhouette is a single path so the shoulder and neck join cleanly:
 * back line, rising neck, small wedge head, then the throat and belly back
 * to the rump. Antlers and legs are strokes, so they keep an even weight at
 * any scale. `lead` lights the nose, because the one at the front is Rudolph.
 */
const Reindeer = ({ x, lead = false }) => (
  <g transform={`translate(${x} 0)`}>
    <path
      d="M47 10C46 5.4 43.5 2.8 40 1.2M44.6 8.2C42.6 6.4 40.6 5.4 38 5M45.8 10.4C43.4 9.6 41.2 9.4 39 9.8M50 9.6C51 5 53.4 2.4 57 1M51.6 8C53.6 6 55.6 5 58.2 4.6M50.6 10.2C53 9.4 55.2 9.2 57.4 9.6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M6 22C8 17 16 15.5 26 17C30 17.5 33 16 36 13.5C39 11 42 9.5 45.5 9C49 8.6 52 10 54.5 12.5C56.5 14.4 56 16.2 53.6 16.2L47.5 15.6C44 17.5 41 19.5 38.5 21.5C36 23.5 33 25.5 29 27C22 29.4 13 29 8.5 26.5Z"
      fill="currentColor"
    />
    <path d="M6 22C3 20 1.5 17 2.5 14.5C4.5 16.5 6 19 7 21.5Z" fill="currentColor" />
    <path
      d="M33 22C37 26 41 30 44 34M30 24C31 28 30 31 28 34M14 26.5C13 30 14 33 16.5 36M9 24C5 27 1.5 30 -2 32"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    {lead ? (
      <>
        <circle cx="54.6" cy="14.6" r="4.6" fill="var(--color-beacon)" opacity="0.28" />
        <circle cx="54.6" cy="14.6" r="2.3" fill="var(--color-beacon)" />
      </>
    ) : null}
  </g>
)

/**
 * The sleigh and its driver.
 *
 * Santa is the one thing here that cannot work as a silhouette — at this
 * size a grey shape is just a grey shape. What makes him read is colour
 * blocking: red coat, white beard and hat trim, dark belt, gold buckle.
 *
 * The proportions matter more than the detail. The brim sits above the
 * eyeline and the beard starts below the mouth, so there is a clear band
 * of face between them; without that gap he is a hat on top of a beard.
 */
const Sleigh = () => (
  <g>
    {/* runner, with its scroll at the front */}
    <path
      d="M1 35h32c7 0 11-3.5 12.5-8.5c0.8-2.7-2-3.7-3-1.5c-0.8 1.8 0.8 3 2.2 2.2"
      stroke="var(--color-amber)"
      strokeWidth="1.9"
      strokeLinecap="round"
      fill="none"
    />
    <path d="M10 35v-4M29 35v-4" stroke="var(--color-amber)" strokeWidth="1.7" />

    {/* body */}
    <path d="M3 32C1 23.5 4 19 11 19h27c-1 6-5 11-10 13Z" fill="var(--color-beacon)" />
    <path d="M3.8 28.4H34" stroke="var(--color-amber)" strokeWidth="1.1" opacity="0.85" />

    {/* sack of presents, riding behind him */}
    <path d="M4 19C3 11 6.5 6.5 11 6.5S19 11 17 19Z" fill="currentColor" opacity="0.7" />
    <path d="M8 7.2c1.6-1.5 3.6-1.5 5.2 0" stroke="var(--color-amber)" strokeWidth="1.2" fill="none" />

    {/* coat, belt, buckle */}
    <path d="M21.4 23C20.8 17 23 13.6 27.2 13.6S33.6 17 33 23Z" fill="var(--color-beacon)" />
    <path d="M21 18.6h12.2v2H21Z" fill="#160d06" />
    <path d="M26.2 18.3h2.1v2.6h-2.1Z" fill="var(--color-amber)" />

    {/* arm on the reins, with a fur cuff */}
    <path
      d="M32.4 16c2.6 0.4 5 1.2 7 2.4"
      stroke="var(--color-beacon)"
      strokeWidth="2.8"
      strokeLinecap="round"
      fill="none"
    />
    <circle cx="39.6" cy="18.6" r="1.5" fill="var(--color-ink)" />

    {/* face, then beard below the mouth, then brim above the eyes */}
    <circle cx="27.2" cy="8.4" r="3.5" fill="#f0cfae" />
    <circle cx="29.8" cy="8.4" r="0.95" fill="#dca882" />
    <path
      d="M23.6 8.2C22.8 14.4 25.4 17.4 28.2 16.8C31.2 16.2 32 11.6 31 8C29 10.6 25.6 10.6 23.6 8.2Z"
      fill="var(--color-ink)"
    />
    <path d="M31.4 6.4C30.8 2.2 27.2 0.2 23.6 1.4C21.4 2.2 20 3.4 19.2 4.6L22.6 6.2Z" fill="var(--color-beacon)" />
    <rect x="22.4" y="4.6" width="9.4" height="2.3" rx="1.15" fill="var(--color-ink)" />
    <circle cx="18.8" cy="4.6" r="1.7" fill="var(--color-ink)" />
  </g>
)

/**
 * The sleigh crossing the hero sky.
 *
 * Decorative, so it is aria-hidden and sits behind the content. Under
 * prefers-reduced-motion it parks mid-flight rather than disappearing.
 */
function SleighSky() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-64 overflow-hidden"
    >
      <div className="sleigh-run absolute top-8 left-0 w-[23rem] text-ink/80 sm:w-[34rem]">
        <svg viewBox="0 0 288 38" fill="none" className="w-full">
          <path
            d="M41 18C58 15 66 13 84 13M133 13h11M197 13h11"
            stroke="currentColor"
            strokeWidth="1.1"
            opacity="0.55"
          />
          <Sleigh />
          <Reindeer x={80} />
          <Reindeer x={144} />
          <Reindeer x={208} lead />
        </svg>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Rows
 * ------------------------------------------------------------------ */

/**
 * Product shot where there is one, stencilled plate where there is not.
 *
 * The filename is the item id by convention rather than a field in the data,
 * so dropping `28.webp` into public/media/wishlist is the whole job. A photo
 * that is missing falls back instead of leaving a broken image.
 */
function Thumb({ item, className = '' }) {
  const [failed, setFailed] = useState(false)

  if (!failed) {
    return (
      <img
        src={withBase(`media/wishlist/${item.id}.webp`)}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={`size-16 shrink-0 rounded-xs border border-hairline bg-ink/95 object-contain p-1 sm:size-20 ${className}`}
      />
    )
  }
  return (
    <div
      aria-hidden="true"
      className={`grid size-16 shrink-0 place-items-center rounded-xs border border-hairline bg-raised sm:size-20 ${className}`}
    >
      <span className="readout text-[11px] tracking-[0.2em] text-mute">{item.id}</span>
    </div>
  )
}

function Row({ item, lit, tone, shopping, rank }) {
  const deps = dependencies(item)
  const claim = shopping.status === 'open' ? shopping.claims.get(item.id) : null
  const taken = Boolean(claim)
  const mine = taken && claim.name === shopping.crew?.name

  /* Its own column on a wide screen, tucked above the title on a phone. */
  const idTag = (
    <>
      {/* Offset per row so the lamps breathe out of step, like a string. */}
      <span className="twinkle flex" style={{ animationDelay: `${(Number(item.id) % 7) * 0.45}s` }}>
        <Lamp color={tone} on={lit} />
      </span>
      <span className="readout text-[11px] tracking-[0.2em] text-mute sm:text-[10px]">
        {rank ? `#${rank}` : item.id}
      </span>
    </>
  )

  return (
    <li className={taken ? 'opacity-60 transition-opacity' : undefined}>
      <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-start sm:gap-5 sm:py-7">
        <div className="hidden w-16 shrink-0 items-center gap-2 pt-1.5 sm:flex">{idTag}</div>

        <div className="min-w-0 flex-1">
          {/*
            Floated rather than a flex column, so on a phone the title and
            everything under it wrap alongside the picture instead of the
            picture claiming a whole row to itself.
          */}
          <Thumb item={item} className="float-left mr-4 mb-2" />
          <div className="mb-1 flex items-center gap-2 sm:hidden">{idTag}</div>
          <h3
            className={`font-display text-base font-medium sm:text-lg ${
              taken ? 'text-dim line-through decoration-hairline-hot' : 'text-ink'
            }`}
          >
            {item.name}
          </h3>
          <p className="readout mt-1.5 text-xs tracking-wide text-mute sm:text-[11px]">{item.spec}</p>

          {deps.length ? (
            <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
              {deps.map((d) => (
                <li key={d.key} className="label flex items-center gap-1.5 text-[11px] text-amber sm:text-[10px]">
                  <Lamp color="amber" />
                  {d.verb} {d.id} · {byId[d.id].name}
                </li>
              ))}
            </ul>
          ) : null}

          {item.note ? (
            <p className="mt-2.5 max-w-prose text-sm leading-relaxed text-dim text-pretty">
              {item.note}
            </p>
          ) : null}

          {item.options ? (
            <dl className="mt-3 space-y-1.5">
              {item.options.map((opt) => (
                <div key={opt.label} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <dt className="label shrink-0 text-[11px] sm:text-[10px]">{opt.label}</dt>
                  <dd className="text-sm text-dim">{opt.items.join(' · ')}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {item.href ? (
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="readout mt-1 -mb-2 inline-flex min-h-11 items-center text-xs tracking-[0.2em] text-dim underline-offset-4 hover:text-amber hover:underline sm:mt-3 sm:mb-0 sm:min-h-0 sm:text-[11px]"
            >
              {item.source.toUpperCase()} ↗
            </a>
          ) : null}

          <div className="clear-both" />
        </div>

        <div className="flex shrink-0 items-baseline justify-between gap-4 sm:w-44 sm:flex-col sm:items-end sm:gap-1.5">
          <span
            className="readout text-base sm:text-lg"
            style={{ color: accentVar(item.tone) }}
          >
            {item.display}
          </span>
          <Label className="text-[11px] sm:text-[10px]">{item.status}</Label>

          {/*
            Someone else's claim is a label, not a button. It used to be
            clickable, which meant a relative could wipe another relative's
            claim just by prodding at it to see what it did.
          */}
          {shopping.status === 'open' && taken && !mine ? (
            <span className="readout mt-1 flex min-h-11 w-full items-center justify-center rounded-xs border border-hairline px-3 text-center text-[11px] tracking-[0.18em] text-mute sm:min-h-0 sm:w-auto sm:py-1.5 sm:text-[10px]">
              TAKEN{claim.name ? ` · ${claim.name.toUpperCase()}` : ''}
            </span>
          ) : null}

          {shopping.status === 'open' && !(taken && !mine) ? (
            <button
              type="button"
              onClick={() => shopping.toggle(item.id, !taken)}
              className={`readout mt-1 min-h-11 w-full rounded-xs border px-3 text-[11px] tracking-[0.18em] transition-colors sm:min-h-0 sm:w-auto sm:py-1.5 sm:text-[10px] ${
                mine
                  ? 'border-annunciator/50 text-annunciator hover:bg-annunciator/10'
                  : 'border-hairline text-dim hover:border-hairline-hot hover:text-ink'
              }`}
            >
              {mine ? 'YOURS · UNDO' : 'I AM BUYING THIS'}
            </button>
          ) : null}
        </div>
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export default function Christmas() {
  // Rendered as the plain date at prerender time and replaced on mount:
  // a countdown baked into static HTML is wrong the moment it is served.
  const [days, setDays] = useState(null)
  useEffect(() => setDays(daysUntil(christmas.day)), [])

  const shopping = useShopping()

  const countdown =
    days == null
      ? 'Dec 25'
      : days > 1
        ? `T−${days} DAYS`
        : days === 1
          ? 'T−1 DAY'
          : days === 0
            ? 'TODAY'
            : 'DELIVERED'

  const readouts = [
    { k: 'Manifest', v: `${totals.items} items` },
    { k: 'Priced', v: `${totals.priced} of ${totals.items}` },
    { k: 'Est. payload', v: money(totals.low, totals.high) },
    { k: 'Delivery', v: countdown },
  ]

  const barTotal = christmas.groups.reduce((t, g) => t + groupTotals[g.id].mid, 0)

  // The lamps run down the manifest like a string of lights: alternating red
  // and green, unlit where there is no price yet.
  const toneAt = (i) => (i % 2 === 0 ? 'red' : 'green')

  return (
    <>
      <Seo
        title={`Christmas ${christmas.year}`}
        description={`${profile.name}'s Christmas list for ${christmas.year}, written up as a cargo manifest.`}
        path="/christmas"
        robots="noindex, nofollow"
      />

      <div aria-hidden="true" className="snowfall" />
      <div aria-hidden="true" className="snowfall-deep" />

      <section className="relative min-h-dvh pt-14">
        <div aria-hidden="true" className="absolute inset-0 grid-bg mask-fade opacity-40" />
        <SleighSky />

        <div className="relative z-10 mx-auto w-full max-w-4xl px-5 py-20 lg:px-8">
          <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
            <div className="min-w-0 flex-1">
              <div className="mb-5 flex items-center gap-2.5">
                <Lamp color="beacon" />
                <Label className="text-beacon">Resupply · Christmas {christmas.year}</Label>
              </div>

              <h1 className="font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
                Christmas list
              </h1>

              <div aria-hidden="true" className="lights-rule mt-6 max-w-sm" />

              <p className="mt-6 max-w-xl text-base leading-relaxed text-dim text-pretty sm:text-lg">
                {totals.items} items across five holds, with the prices I saw when I wrote them
                down. Some are worth waiting for a sale on and a few are still open — the
                manifest says which is which.
              </p>
            </div>

            <SnowGlobe className="mx-auto lg:mx-0" />
          </div>

          <ShoppingPanel shopping={shopping} />

          {/* Sleigh flight plan: the countdown, as an instrument would give it. */}
          <Reveal>
            <div className="panel panel-lights snow-cap mt-10">
              <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
                <div className="min-w-0">
                  <div className="mb-3 flex items-center gap-2">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="star-pulse size-3.5 text-amber"
                      fill="currentColor"
                    >
                      <path d="M12 0l2.6 8.2L23 10.8l-7 5 2.6 8.2-6.6-5.1L5.4 24 8 15.8l-7-5 8.4-2.6z" />
                    </svg>
                    <Label className="text-amber">Sleigh flight plan</Label>
                  </div>
                  <dl className="space-y-2">
                    {[
                      ['Origin', "North Pole · 90°00′N"],
                      ['Destination', `${DESTINATION.name} · ${dms(DESTINATION.lat)}`],
                      ['Great circle', `${DISTANCE_NM.toLocaleString('en-US')} NM`],
                    ].map(([k, v]) => (
                      <div key={k} className="flex flex-wrap items-baseline gap-x-3">
                        <dt className="label w-24 shrink-0">{k}</dt>
                        <dd className="readout text-xs text-dim">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="shrink-0 border-t border-hairline pt-5 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-7">
                  <Label className="mb-1.5">Touchdown</Label>
                  <div className="readout text-3xl leading-none font-medium text-beacon sm:text-4xl">
                    {countdown}
                  </div>
                  <div className="readout mt-2 text-[11px] tracking-[0.2em] text-mute sm:text-[10px]">
                    25 DEC {christmas.year} · 00:00 LOCAL
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Manifest summary. */}
          <Reveal>
            <div className="panel panel-lights snow-cap mt-10 p-5 sm:p-7">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
                {readouts.map((r) => (
                  <div key={r.k} className="flex flex-col gap-1 border-l border-hairline pl-3">
                    <dt className="label">{r.k}</dt>
                    <dd className="readout text-sm text-ink">{r.v}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-7">
                <Label className="mb-2.5">Payload by hold</Label>
                <div className="flex h-2 w-full gap-px overflow-hidden rounded-xs bg-hairline/60">
                  {christmas.groups.map((g, i) => (
                    <div
                      key={g.id}
                      title={`${g.title} · ${money(groupTotals[g.id].low, groupTotals[g.id].high)}`}
                      style={{
                        width: `${(groupTotals[g.id].mid / barTotal) * 100}%`,
                        background: accentVar(i % 2 === 0 ? 'red' : 'green'),
                        opacity: 0.85,
                      }}
                    />
                  ))}
                </div>
                <p className="readout mt-2.5 text-[11px] tracking-[0.18em] text-mute sm:text-[10px]">
                  PRICED ITEMS ONLY
                  {totals.open > 0 ? ` · ${totals.open} STILL OPEN` : ''}
                </p>
              </div>
            </div>
          </Reveal>

          {/* The holds. */}
          {christmas.groups.map((group, gi) => {
            const t = groupTotals[group.id]
            return (
              <section key={group.id} className="mt-16" aria-labelledby={`hold-${group.id}`}>
                <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                  <div className="min-w-0">
                    <Label className="mb-2 text-amber">{group.hold}</Label>
                    <h2
                      id={`hold-${group.id}`}
                      className="font-display text-2xl font-semibold tracking-tight text-ink"
                    >
                      {group.title}
                    </h2>
                  </div>
                  <p className="readout text-xs text-dim">
                    {t.count} items · {t.priced < t.count ? `${t.priced} priced · ` : ''}
                    {money(t.low, t.high)}
                  </p>
                </header>

                <div
                  aria-hidden="true"
                  className={`lights-rule mt-4 ${gi % 2 ? 'lights-rule-alt' : ''}`}
                />

                {group.note ? (
                  <p className="mt-4 max-w-prose text-sm leading-relaxed text-dim text-pretty">
                    {group.note}
                  </p>
                ) : null}

                <Reveal>
                  <ul className="mt-4 divide-y divide-hairline">
                    {group.items.map((item, ii) => (
                      <Row
                        key={item.id}
                        rank={group.ranked ? ii + 1 : null}
                        item={item}
                        lit={item.low != null}
                        tone={toneAt(allItems.indexOf(item))}
                        shopping={shopping}
                      />
                    ))}
                  </ul>
                </Reveal>
              </section>
            )
          })}

          <div aria-hidden="true" className="lights-rule mt-16" />

          <p className="readout mt-6 text-xs leading-relaxed tracking-wide text-mute sm:text-[11px]">
            Prices are what the listings said when this was written, not quotes. Promotional and
            target figures move, and anything marked open has no price yet.
          </p>
        </div>
      </section>
    </>
  )
}
