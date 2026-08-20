import { useEffect, useState } from 'react'

/**
 * A slim altitude tape pinned to the viewport edge. Scroll depth reads as
 * altitude, which is the site's core navigation metaphor. Purely ambient —
 * hidden from assistive tech and from small screens.
 */
export default function AltitudeRail() {
  const [p, setP] = useState(0)

  useEffect(() => {
    let raf = 0
    const read = () => {
      raf = 0
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      setP(Math.min(1, Math.max(0, window.scrollY / max)))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }
    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  const ft = Math.round(p * 24000)

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed right-0 top-0 z-30 hidden h-dvh w-14 select-none lg:block"
    >
      <div className="absolute inset-y-0 right-6 w-px bg-hairline" />
      {Array.from({ length: 25 }, (_, i) => i).map((i) => (
        <div
          key={i}
          className="absolute right-6 h-px bg-hairline"
          style={{ top: `${(i / 24) * 100}%`, width: i % 4 === 0 ? 10 : 5 }}
        />
      ))}
      <div
        className="absolute right-2 flex items-center gap-1.5 transition-transform duration-100 ease-out"
        style={{ top: `${p * 100}%`, transform: 'translateY(-50%)' }}
      >
        <span className="readout text-[9px] tracking-widest text-amber">
          {String(ft).padStart(5, '0')}
        </span>
        <span className="block h-px w-3 bg-amber" />
      </div>
    </div>
  )
}
