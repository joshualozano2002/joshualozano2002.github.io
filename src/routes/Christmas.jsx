import { useEffect, useState } from 'react'
import Seo from '../components/Seo'
import { Label, Lamp, Reveal, accentVar } from '../components/ui'
import { christmas, pricedItems, totals } from '../data/wishlist'
import { profile } from '../data/profile'

const usd = (n, cents = false) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })

/** Midpoint of a range, so a $400–900 item carries its fair share of the bar. */
const mid = (item) => (item.low + item.high) / 2

const barTotal = pricedItems.reduce((sum, i) => sum + mid(i), 0)

/** Whole days from now until local midnight on the 25th. */
function daysUntil({ y, m, d }) {
  const now = new Date()
  const target = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target - today) / 86400000)
}

export default function Christmas() {
  // Rendered blank at prerender time and filled in on mount: a countdown
  // baked into static HTML is wrong the moment it is served.
  const [days, setDays] = useState(null)
  useEffect(() => setDays(daysUntil(christmas.day)), [])

  const countdown =
    days == null
      ? 'Dec 25' // static fallback, so the no-JS page still says something true
      : days > 1
        ? `T−${days} DAYS`
        : days === 1
          ? 'T−1 DAY'
          : days === 0
            ? 'TODAY'
            : 'DELIVERED'

  const readouts = [
    { k: 'Manifest', v: `${christmas.items.length} items` },
    { k: 'Priced', v: `${pricedItems.length} of ${christmas.items.length}` },
    { k: 'Est. payload', v: `${usd(totals.low)} – ${usd(totals.high)}` },
    { k: 'Delivery', v: countdown },
  ]

  return (
    <>
      <Seo
        title={`Christmas ${christmas.year}`}
        description={`${profile.name}'s Christmas list for ${christmas.year}, written up as a cargo manifest.`}
        path="/christmas"
        robots="noindex, nofollow"
      />

      <section className="relative min-h-dvh pt-14">
        <div aria-hidden="true" className="absolute inset-0 grid-bg mask-fade opacity-40" />

        <div className="relative mx-auto w-full max-w-4xl px-5 py-20 lg:px-8">
          <div className="mb-5 flex items-center gap-2.5">
            <Lamp color="beacon" />
            <Label className="text-beacon">Resupply · Christmas {christmas.year}</Label>
          </div>

          <h1 className="font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Christmas list
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-dim text-pretty sm:text-lg">
            Five items, in no particular order, with the prices I saw when I wrote them down. Two
            of them are worth waiting for a sale on, and one I have not settled on yet — the
            manifest says which is which.
          </p>

          {/* Manifest summary. The bezel's lit edge is a string of lights here. */}
          <Reveal>
            <div className="panel panel-lights mt-12 p-5 sm:p-7">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
                {readouts.map((r) => (
                  <div key={r.k} className="flex flex-col gap-1 border-l border-hairline pl-3">
                    <dt className="label">{r.k}</dt>
                    <dd className="readout text-sm text-ink">{r.v}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-7">
                <Label className="mb-2.5">Payload distribution</Label>
                <div className="flex h-2 w-full gap-px overflow-hidden rounded-xs bg-hairline/60">
                  {pricedItems.map((item) => (
                    <div
                      key={item.id}
                      title={`${item.name} · ${item.display}`}
                      style={{
                        width: `${(mid(item) / barTotal) * 100}%`,
                        background: accentVar(item.tone),
                        opacity: 0.85,
                      }}
                    />
                  ))}
                </div>
                <p className="readout mt-2.5 text-[10px] tracking-[0.18em] text-mute">
                  PRICED ITEMS ONLY
                  {totals.open > 0
                    ? ` · ${totals.open} ITEM${totals.open > 1 ? 'S' : ''} NOT YET PRICED`
                    : ''}
                </p>
              </div>
            </div>
          </Reveal>

          {/* The manifest itself. */}
          <Reveal delay={0.1}>
            <ul className="mt-14 divide-y divide-hairline border-y border-hairline">
              {christmas.items.map((item) => (
                <li key={item.id}>
                  <div className="flex flex-col gap-4 py-7 sm:flex-row sm:items-start sm:gap-6">
                    <div className="flex shrink-0 items-center gap-2.5 sm:w-20 sm:pt-1.5">
                      <Lamp color={item.tone} on={item.tone !== 'mute'} />
                      <span className="readout text-[10px] tracking-[0.2em] text-mute">
                        {item.id}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h2 className="font-display text-base font-medium text-ink sm:text-lg">
                        {item.name}
                      </h2>
                      <p className="readout mt-1.5 text-[11px] tracking-wide text-mute">
                        {item.spec}
                      </p>
                      <p className="mt-3 max-w-prose text-sm leading-relaxed text-dim text-pretty">
                        {item.note}
                      </p>
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
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>

          <p className="readout mt-8 text-[11px] leading-relaxed tracking-wide text-mute">
            Prices are what the listings said when this was written, not quotes. The promotional
            and target figures move.
          </p>
        </div>
      </section>
    </>
  )
}
