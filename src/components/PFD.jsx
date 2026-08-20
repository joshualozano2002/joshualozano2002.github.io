import { useEffect, useRef, useState } from 'react'

/**
 * Primary Flight Display.
 *
 * Modelled on the PFD visible in the N426NA flight-deck photograph. The
 * instrument is live rather than decorative: altitude reads the visitor's
 * scroll depth, airspeed reads scroll velocity, and bank/pitch follow the
 * pointer. It renders at rest during prerender so the static HTML is valid,
 * then comes alive on hydration.
 */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export default function PFD({ className = '' }) {
  // At-rest values — these are what the server renders.
  const [s, setS] = useState({ bank: 0, pitch: 0, alt: 0, spd: 0, hdg: 360 })
  const raf = useRef(0)
  const target = useRef({ bank: 0, pitch: 0, alt: 0, spd: 0, hdg: 360 })
  const lastScroll = useRef(0)
  const lastT = useRef(0)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    const onPointer = (e) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1 // -1..1
      const ny = (e.clientY / window.innerHeight) * 2 - 1
      target.current.bank = clamp(-nx * 16, -30, 30)
      target.current.pitch = clamp(-ny * 10, -18, 18)
      target.current.hdg = 360 - clamp(nx * 40, -180, 180)
    }

    const onScroll = () => {
      const y = window.scrollY
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      const now = performance.now()
      const dt = Math.max(16, now - lastT.current)
      const dy = Math.abs(y - lastScroll.current)
      lastScroll.current = y
      lastT.current = now
      // Scroll depth reads as altitude, scroll rate as airspeed.
      target.current.alt = Math.round((y / max) * 24000)
      target.current.spd = clamp((dy / dt) * 900, 0, 340)
    }

    // Ease toward the target so the instrument settles instead of snapping.
    const tick = () => {
      setS((prev) => {
        const t = target.current
        const k = 0.09
        const next = {
          bank: prev.bank + (t.bank - prev.bank) * k,
          pitch: prev.pitch + (t.pitch - prev.pitch) * k,
          alt: prev.alt + (t.alt - prev.alt) * k,
          spd: prev.spd + (t.spd - prev.spd) * (k * 0.6),
          hdg: prev.hdg + (t.hdg - prev.hdg) * k,
        }
        // Airspeed bleeds off when scrolling stops.
        target.current.spd *= 0.94
        return next
      })
      raf.current = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    raf.current = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf.current)
    }
  }, [])

  const { bank, pitch, alt, spd, hdg } = s
  const pitchPx = pitch * 5.2 // degrees -> pixels on the ladder

  // Vertical tape tick sets, centred on the current value.
  const altTicks = []
  for (let i = -3; i <= 3; i++) {
    const v = Math.round((alt + i * 500) / 100) * 100
    if (v >= 0) altTicks.push({ v, y: 168 - i * 34 })
  }
  const spdTicks = []
  for (let i = -3; i <= 3; i++) {
    const v = Math.round((spd + i * 40) / 10) * 10
    if (v >= 0) spdTicks.push({ v, y: 168 - i * 34 })
  }
  const hdgTicks = []
  for (let i = -3; i <= 3; i++) {
    const raw = Math.round((hdg + i * 15) / 5) * 5
    const v = ((raw % 360) + 360) % 360
    hdgTicks.push({ v: v === 0 ? 360 : v, x: 212 + i * 40 })
  }

  return (
    <svg
      viewBox="0 0 424 360"
      className={className}
      role="img"
      aria-label="Primary flight display: an artificial horizon flanked by airspeed and altitude tapes, driven by scroll position and pointer movement."
      style={{ width: '100%', height: 'auto' }}
    >
      <defs>
        <clipPath id="pfd-ball">
          <rect x="96" y="34" width="232" height="234" rx="3" />
        </clipPath>
        <clipPath id="pfd-alt">
          <rect x="332" y="34" width="72" height="234" />
        </clipPath>
        <clipPath id="pfd-spd">
          <rect x="20" y="34" width="72" height="234" />
        </clipPath>
        <clipPath id="pfd-hdg">
          <rect x="96" y="286" width="232" height="46" />
        </clipPath>
        <linearGradient id="pfd-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d5fa8" />
          <stop offset="100%" stopColor="#4a8fd4" />
        </linearGradient>
        <linearGradient id="pfd-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6b4a24" />
          <stop offset="100%" stopColor="#3b2814" />
        </linearGradient>
      </defs>

      {/* ---- Attitude indicator ---- */}
      <g clipPath="url(#pfd-ball)">
        <g transform={`rotate(${bank} 212 151)`}>
          <g transform={`translate(0 ${pitchPx})`}>
            <rect x="-200" y="-260" width="824" height="411" fill="url(#pfd-sky)" />
            <rect x="-200" y="151" width="824" height="411" fill="url(#pfd-ground)" />
            <line x1="-200" y1="151" x2="624" y2="151" stroke="#ffffff" strokeWidth="1.5" />
            {/* Pitch ladder */}
            {[-20, -15, -10, -5, 5, 10, 15, 20].map((d) => {
              const y = 151 - d * 5.2
              const w = d % 10 === 0 ? 44 : 24
              return (
                <g key={d}>
                  <line
                    x1={212 - w}
                    y1={y}
                    x2={212 + w}
                    y2={y}
                    stroke="#ffffff"
                    strokeWidth="1"
                    opacity="0.85"
                  />
                  {d % 10 === 0 ? (
                    <>
                      <text
                        x={212 - w - 6}
                        y={y + 3.5}
                        textAnchor="end"
                        fill="#fff"
                        fontSize="9"
                        fontFamily="var(--font-mono)"
                      >
                        {Math.abs(d)}
                      </text>
                      <text
                        x={212 + w + 6}
                        y={y + 3.5}
                        fill="#fff"
                        fontSize="9"
                        fontFamily="var(--font-mono)"
                      >
                        {Math.abs(d)}
                      </text>
                    </>
                  ) : null}
                </g>
              )
            })}
          </g>
        </g>
      </g>

      {/* Bank scale + pointer */}
      <g>
        {[-30, -20, -10, 0, 10, 20, 30].map((d) => {
          const a = ((d - 90) * Math.PI) / 180
          const r1 = 104
          const r2 = d === 0 ? 94 : 98
          return (
            <line
              key={d}
              x1={212 + Math.cos(a) * r1}
              y1={151 + Math.sin(a) * r1}
              x2={212 + Math.cos(a) * r2}
              y2={151 + Math.sin(a) * r2}
              stroke="var(--color-dim)"
              strokeWidth="1.2"
            />
          )
        })}
        <polygon
          points="212,50 206,60 218,60"
          fill="var(--color-amber)"
          transform={`rotate(${bank} 212 151)`}
        />
      </g>

      {/* Aircraft reference symbol */}
      <g stroke="var(--color-amber)" strokeWidth="2.5" fill="none">
        <path d="M168 151 h26 l8 9" />
        <path d="M256 151 h-26 l-8 9" />
      </g>
      <rect x="208" y="147" width="8" height="8" fill="none" stroke="var(--color-amber)" strokeWidth="2" />

      <rect x="96" y="34" width="232" height="234" rx="3" fill="none" stroke="var(--color-hairline-hot)" />

      {/* ---- Airspeed tape (left) ---- */}
      <rect x="20" y="34" width="72" height="234" fill="#070c12" stroke="var(--color-hairline)" />
      <g clipPath="url(#pfd-spd)">
        {spdTicks.map((t) => (
          <g key={`s${t.v}-${Math.round(t.y)}`}>
            <line x1="78" y1={t.y} x2="92" y2={t.y} stroke="var(--color-mute)" strokeWidth="1" />
            <text
              x="72"
              y={t.y + 4}
              textAnchor="end"
              fill="var(--color-dim)"
              fontSize="11"
              fontFamily="var(--font-mono)"
            >
              {t.v}
            </text>
          </g>
        ))}
      </g>
      <polygon points="20,159 84,159 92,168 84,177 20,177" fill="var(--color-panel)" stroke="var(--color-cyan)" />
      <text x="78" y="172" textAnchor="end" fill="var(--color-cyan)" fontSize="14" fontFamily="var(--font-mono)" fontWeight="700">
        {String(Math.round(spd)).padStart(3, '0')}
      </text>
      <text x="56" y="26" textAnchor="middle" className="label" fill="var(--color-mute)" fontSize="9" fontFamily="var(--font-mono)" letterSpacing="1.6">
        KIAS
      </text>

      {/* ---- Altitude tape (right) ---- */}
      <rect x="332" y="34" width="72" height="234" fill="#070c12" stroke="var(--color-hairline)" />
      <g clipPath="url(#pfd-alt)">
        {altTicks.map((t) => (
          <g key={`a${t.v}-${Math.round(t.y)}`}>
            <line x1="332" y1={t.y} x2="346" y2={t.y} stroke="var(--color-mute)" strokeWidth="1" />
            <text x="352" y={t.y + 4} fill="var(--color-dim)" fontSize="11" fontFamily="var(--font-mono)">
              {t.v}
            </text>
          </g>
        ))}
      </g>
      <polygon points="404,159 340,159 332,168 340,177 404,177" fill="var(--color-panel)" stroke="var(--color-cyan)" />
      <text x="346" y="172" fill="var(--color-cyan)" fontSize="14" fontFamily="var(--font-mono)" fontWeight="700">
        {String(Math.round(alt)).padStart(5, '0')}
      </text>
      <text x="368" y="26" textAnchor="middle" fill="var(--color-mute)" fontSize="9" fontFamily="var(--font-mono)" letterSpacing="1.6">
        ALT FT
      </text>

      {/* ---- Heading strip ---- */}
      <rect x="96" y="286" width="232" height="46" fill="#070c12" stroke="var(--color-hairline)" />
      <g clipPath="url(#pfd-hdg)">
        {hdgTicks.map((t) => (
          <g key={`h${t.v}-${Math.round(t.x)}`}>
            <line x1={t.x} y1="286" x2={t.x} y2="296" stroke="var(--color-mute)" strokeWidth="1" />
            <text
              x={t.x}
              y="312"
              textAnchor="middle"
              fill="var(--color-dim)"
              fontSize="11"
              fontFamily="var(--font-mono)"
            >
              {String(t.v).padStart(3, '0')}
            </text>
          </g>
        ))}
      </g>
      <polygon points="212,286 205,296 219,296" fill="var(--color-amber)" />
      <text x="212" y="328" textAnchor="middle" fill="var(--color-mute)" fontSize="9" fontFamily="var(--font-mono)" letterSpacing="1.6">
        HDG
      </text>

      {/* Frame */}
      <rect x="12" y="18" width="400" height="326" rx="4" fill="none" stroke="var(--color-hairline)" />
      <text x="20" y="354" fill="var(--color-mute)" fontSize="9" fontFamily="var(--font-mono)" letterSpacing="1.6">
        PFD · N426NA
      </text>
    </svg>
  )
}
