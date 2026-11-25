import { useCallback, useEffect, useState } from 'react'
import Seo from '../components/Seo'
import { Label, Lamp, Reveal, accentVar } from '../components/ui'
import { allItems, christmas, groupTotals, totals } from '../data/wishlist'
import { profile } from '../data/profile'
import { withBase } from '../site'
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
            className="readout text-[11px] tracking-[0.2em] text-dim underline-offset-4 hover:text-amber hover:underline"
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
            className="readout shrink-0 rounded-xs border border-hairline px-3.5 py-2 text-[11px] tracking-[0.2em] text-dim transition-colors hover:border-hairline-hot hover:text-ink"
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
              className="readout min-w-0 flex-1 rounded-xs border border-hairline bg-panel px-3 py-2.5 text-sm text-ink placeholder:text-mute"
            />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="off"
              required
              className="readout min-w-0 flex-1 rounded-xs border border-hairline bg-panel px-3 py-2.5 text-sm text-ink placeholder:text-mute sm:max-w-44"
            />
            <button
              type="submit"
              disabled={status === 'opening'}
              className="readout shrink-0 rounded-xs border border-amber/60 px-4 py-2.5 text-[11px] tracking-[0.2em] text-amber transition-colors hover:bg-amber/10 disabled:opacity-50"
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
 * Rows
 * ------------------------------------------------------------------ */

/**
 * Product shot where there is one, stencilled plate where there is not.
 *
 * The filename is the item id by convention rather than a field in the data,
 * so dropping `28.webp` into public/media/wishlist is the whole job. A photo
 * that is missing falls back instead of leaving a broken image.
 */
function Thumb({ item }) {
  const [failed, setFailed] = useState(false)

  if (!failed) {
    return (
      <img
        src={withBase(`media/wishlist/${item.id}.webp`)}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="size-16 shrink-0 rounded-xs border border-hairline bg-ink/95 object-contain p-1 sm:size-20"
      />
    )
  }
  return (
    <div
      aria-hidden="true"
      className="grid size-16 shrink-0 place-items-center rounded-xs border border-hairline bg-raised sm:size-20"
    >
      <span className="readout text-[11px] tracking-[0.2em] text-mute">{item.id}</span>
    </div>
  )
}

function Row({ item, lit, tone, shopping }) {
  const deps = dependencies(item)
  const claim = shopping.status === 'open' ? shopping.claims.get(item.id) : null
  const taken = Boolean(claim)
  const mine = taken && claim.name === shopping.crew?.name

  return (
    <li className={taken ? 'opacity-60 transition-opacity' : undefined}>
      <div className="flex flex-col gap-4 py-7 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex shrink-0 items-start gap-4">
          <div className="flex w-14 shrink-0 items-center gap-2 pt-1.5 sm:w-16">
            <Lamp color={tone} on={lit} />
            <span className="readout text-[10px] tracking-[0.2em] text-mute">{item.id}</span>
          </div>
          <Thumb item={item} />
        </div>

        <div className="min-w-0 flex-1">
          <h3
            className={`font-display text-base font-medium sm:text-lg ${
              taken ? 'text-dim line-through decoration-hairline-hot' : 'text-ink'
            }`}
          >
            {item.name}
          </h3>
          <p className="readout mt-1.5 text-[11px] tracking-wide text-mute">{item.spec}</p>

          {deps.length ? (
            <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
              {deps.map((d) => (
                <li key={d.key} className="label flex items-center gap-1.5 text-amber">
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
                  <dt className="label shrink-0">{opt.label}</dt>
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
              className="readout mt-3 inline-block text-[11px] tracking-[0.2em] text-dim underline-offset-4 hover:text-amber hover:underline"
            >
              {item.source.toUpperCase()} ↗
            </a>
          ) : null}
        </div>

        <div className="flex shrink-0 items-baseline justify-between gap-4 sm:w-44 sm:flex-col sm:items-end sm:gap-1.5">
          <span
            className="readout text-base sm:text-lg"
            style={{ color: accentVar(item.tone) }}
          >
            {item.display}
          </span>
          <Label>{item.status}</Label>

          {/*
            Someone else's claim is a label, not a button. It used to be
            clickable, which meant a relative could wipe another relative's
            claim just by prodding at it to see what it did.
          */}
          {shopping.status === 'open' && taken && !mine ? (
            <span className="readout mt-1 block w-full rounded-xs border border-hairline px-2.5 py-1.5 text-center text-[10px] tracking-[0.18em] text-mute sm:w-auto">
              TAKEN{claim.name ? ` · ${claim.name.toUpperCase()}` : ''}
            </span>
          ) : null}

          {shopping.status === 'open' && !(taken && !mine) ? (
            <button
              type="button"
              onClick={() => shopping.toggle(item.id, !taken)}
              className={`readout mt-1 w-full rounded-xs border px-2.5 py-1.5 text-[10px] tracking-[0.18em] transition-colors sm:w-auto ${
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

      <section className="relative min-h-dvh pt-14">
        <div aria-hidden="true" className="absolute inset-0 grid-bg mask-fade opacity-40" />

        <div className="relative z-10 mx-auto w-full max-w-4xl px-5 py-20 lg:px-8">
          <div className="mb-5 flex items-center gap-2.5">
            <Lamp color="beacon" />
            <Label className="text-beacon">Resupply · Christmas {christmas.year}</Label>
          </div>

          <h1 className="font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Christmas list
          </h1>

          <div aria-hidden="true" className="lights-rule mt-6 max-w-sm" />

          <p className="mt-6 max-w-xl text-base leading-relaxed text-dim text-pretty sm:text-lg">
            {totals.items} items across five holds, with the prices I saw when I wrote them down.
            Some are worth waiting for a sale on and a few are still open — the manifest says
            which is which.
          </p>

          <ShoppingPanel shopping={shopping} />

          {/* Manifest summary. */}
          <Reveal>
            <div className="panel panel-lights mt-10 p-5 sm:p-7">
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
                <p className="readout mt-2.5 text-[10px] tracking-[0.18em] text-mute">
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
                    {group.items.map((item) => (
                      <Row
                        key={item.id}
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

          <p className="readout mt-6 text-[11px] leading-relaxed tracking-wide text-mute">
            Prices are what the listings said when this was written, not quotes. Promotional and
            target figures move, and anything marked open has no price yet.
          </p>
        </div>
      </section>
    </>
  )
}
