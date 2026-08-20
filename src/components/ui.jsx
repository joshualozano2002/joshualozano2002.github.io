import { useEffect, useRef, useState } from 'react'

const ACCENT = {
  amber: 'var(--color-amber)',
  cyan: 'var(--color-cyan)',
  sky: 'var(--color-sky)',
  magenta: 'var(--color-magenta)',
  annunciator: 'var(--color-annunciator)',
}
export const accentVar = (name) => ACCENT[name] ?? ACCENT.cyan

/** Stencilled micro-label, as silkscreened onto an instrument face. */
export function Label({ children, className = '', as: Tag = 'div', ...rest }) {
  return (
    <Tag className={`label ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

/** Row of readouts, wrapping on narrow screens. */
export function ReadoutRow({ items, accent = 'cyan', className = '' }) {
  return (
    <dl className={`grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4 ${className}`}>
      {items.map((it) => (
        <div key={it.k} className="flex flex-col gap-1 border-l border-hairline pl-3">
          <dt className="label">{it.k}</dt>
          <dd className="readout text-sm" style={{ color: accentVar(accent) }}>
            {it.v}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Annunciator lamp — a small lit indicator. */
export function Lamp({ on = true, color = 'annunciator', className = '' }) {
  const c = accentVar(color)
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-1.5 shrink-0 rounded-full ${className}`}
      style={{
        background: on ? c : 'var(--color-hairline-hot)',
        boxShadow: on ? `0 0 6px ${c}, 0 0 12px color-mix(in oklab, ${c} 45%, transparent)` : 'none',
      }}
    />
  )
}

/** Section heading with an index number and a trailing rule. */
export function SectionHead({ index, title, kicker, id }) {
  return (
    <header className="mb-8 flex items-end gap-4" id={id}>
      <div className="min-w-0">
        {index ? <Label className="mb-2 text-amber">{index}</Label> : null}
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {title}
        </h2>
        {kicker ? <p className="mt-2 max-w-prose text-sm text-dim text-pretty">{kicker}</p> : null}
      </div>
      <div className="mb-2 hidden h-px flex-1 bg-linear-to-r from-hairline to-transparent sm:block" />
    </header>
  )
}

/**
 * Scroll-triggered reveal, built as progressive enhancement.
 *
 * The element renders VISIBLE by default, so the prerendered HTML is readable
 * with no JavaScript at all. A bootstrap script in the document head adds a
 * `js` class, and only then does CSS hide the element so it can animate in.
 * If the observer never fires, the content is still on screen.
 */
export function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      data-reveal={shown ? 'in' : 'out'}
      style={delay ? { '--reveal-delay': `${Math.round(delay * 1000)}ms` } : undefined}
      className={className}
    >
      {children}
    </div>
  )
}
