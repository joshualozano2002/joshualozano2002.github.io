import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { nav, profile } from '../data/profile'
import { Lamp } from './ui'

/**
 * Top annunciator panel. Each route is a labelled switch with an indicator
 * lamp; the active route is lit.
 */
export default function Nav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
        scrolled || open
          ? 'border-hairline bg-void/85 backdrop-blur-md'
          : 'border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5 lg:px-8">
        <NavLink to="/" className="group flex items-baseline gap-2.5" aria-label="Home">
          <span className="font-display text-sm font-semibold tracking-wider text-ink">
            {profile.callsign}
          </span>
          <span className="readout hidden text-[10px] tracking-[0.2em] text-mute sm:inline">
            N426NA
          </span>
        </NavLink>

        {/* Desktop switch row */}
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {nav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-xs px-3 py-2 text-xs font-medium tracking-wide transition-colors ${
                      isActive ? 'text-ink' : 'text-dim hover:text-ink'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Lamp on={isActive} color={isActive ? 'amber' : 'annunciator'} />
                      <span className="uppercase">{item.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="flex items-center gap-2 rounded-xs border border-hairline px-3 py-1.5 md:hidden"
        >
          <Lamp on={open} color="amber" />
          <span className="label text-ink">{open ? 'Close' : 'Menu'}</span>
        </button>
      </div>

      {/* Mobile panel */}
      <nav
        id="mobile-nav"
        aria-label="Primary"
        hidden={!open}
        className="border-t border-hairline bg-void/95 md:hidden"
      >
        <ul className="mx-auto max-w-6xl px-5 py-2">
          {nav.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center justify-between border-b border-hairline/60 py-3.5 text-sm ${
                    isActive ? 'text-amber' : 'text-dim'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="flex items-center gap-3">
                      <Lamp on={isActive} color="amber" />
                      <span className="uppercase tracking-wide">{item.label}</span>
                    </span>
                    <span className="readout text-[10px] tracking-[0.2em] text-mute">
                      {item.code}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
