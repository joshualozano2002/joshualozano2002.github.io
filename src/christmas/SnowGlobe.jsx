import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A snow globe you can shake.
 *
 * Canvas rather than DOM because a hundred flakes as elements is a hundred
 * things for the browser to lay out sixty times a second. The flakes settle
 * on the mound and stay there until the next shake, which is the whole
 * appeal of the object — a globe that never settles is just a screensaver.
 *
 * Colours are read from the stylesheet so the globe follows the deck's
 * palette instead of carrying its own copy of it.
 */

const FLAKES = 110
const GRAVITY = 0.03
const DRAG = 0.986

const rand = (min, max) => min + Math.random() * (max - min)

export default function SnowGlobe({ className = '' }) {
  const canvasRef = useRef(null)
  const flakesRef = useRef([])
  const shakeRef = useRef(0)
  const [shaken, setShaken] = useState(false)

  /** Kick every flake loose with an upward, outward impulse. */
  const shake = useCallback(() => {
    shakeRef.current = 1
    setShaken(true)
    for (const f of flakesRef.current) {
      f.settled = false
      f.vx = rand(-1.7, 1.7)
      f.vy = rand(-2.6, 0.4)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const css = getComputedStyle(document.documentElement)
    const tok = (name, fallback) => css.getPropertyValue(name).trim() || fallback
    const INK = tok('--color-ink', '#e2e9f0')
    const PANEL = tok('--color-panel', '#0a1017')
    const RAISED = tok('--color-raised', '#121b26')
    const HAIR = tok('--color-hairline-hot', '#2c3d51')
    const AMBER = tok('--color-amber', '#ff9d2e')
    const GREEN = tok('--color-annunciator', '#48e08a')
    const RED = tok('--color-beacon', '#ff4f45')

    const W = 240
    const H = 280
    const CX = W / 2
    const CY = 118
    const R = 94
    const moundY = (x) => CY + R - 26 - 16 * Math.cos(((x - CX) / R) * 1.3)
    /**
     * Where snow comes to rest.
     *
     * Near the edges the mound curve sits below the glass, so a flake over
     * there would hit the wall, bounce, and never reach the ground. Clamping
     * the rest line to the inside of the sphere is what lets it land.
     */
    const restY = (x) =>
      Math.min(moundY(x), CY + Math.sqrt(Math.max(0, (R - 5) ** 2 - (x - CX) ** 2)) - 1)

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`
    ctx.scale(dpr, dpr)

    flakesRef.current = Array.from({ length: FLAKES }, () => {
      const a = rand(0, Math.PI * 2)
      const d = Math.sqrt(Math.random()) * (R - 10)
      return {
        x: CX + Math.cos(a) * d,
        y: CY + Math.sin(a) * d,
        vx: rand(-0.3, 0.3),
        vy: rand(0.1, 0.5),
        r: rand(0.9, 2.4),
        settled: false,
      }
    })

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function tree(x, baseY, h, w) {
      ctx.fillStyle = '#16301f'
      ctx.beginPath()
      ctx.moveTo(x, baseY - h)
      ctx.lineTo(x + w / 2, baseY)
      ctx.lineTo(x - w / 2, baseY)
      ctx.closePath()
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(x, baseY - h * 1.26)
      ctx.lineTo(x + w * 0.36, baseY - h * 0.5)
      ctx.lineTo(x - w * 0.36, baseY - h * 0.5)
      ctx.closePath()
      ctx.fill()
      // trunk
      ctx.fillStyle = '#2a1d14'
      ctx.fillRect(x - 1.6, baseY - 2, 3.2, 6)
    }

    function drawScene() {
      // glass
      const glass = ctx.createRadialGradient(CX - 30, CY - 40, 10, CX, CY, R)
      glass.addColorStop(0, 'rgba(120,160,200,0.20)')
      glass.addColorStop(0.65, 'rgba(20,40,60,0.12)')
      glass.addColorStop(1, 'rgba(0,0,0,0.42)')
      ctx.beginPath()
      ctx.arc(CX, CY, R, 0, Math.PI * 2)
      ctx.fillStyle = PANEL
      ctx.fill()
      ctx.fillStyle = glass
      ctx.fill()

      ctx.save()
      ctx.beginPath()
      ctx.arc(CX, CY, R - 1, 0, Math.PI * 2)
      ctx.clip()

      // a hill of snow, with the trees standing on it
      ctx.fillStyle = '#dae6f2'
      ctx.beginPath()
      ctx.moveTo(CX - R, CY + R)
      for (let x = CX - R; x <= CX + R; x += 4) ctx.lineTo(x, moundY(x) + 4)
      ctx.lineTo(CX + R, CY + R)
      ctx.closePath()
      ctx.fill()

      tree(CX - 34, moundY(CX - 34) + 5, 40, 30)
      tree(CX + 24, moundY(CX + 24) + 5, 28, 22)

      // the star on the big tree
      ctx.fillStyle = AMBER
      ctx.beginPath()
      ctx.arc(CX - 34, moundY(CX - 34) + 5 - 52, 2.6, 0, Math.PI * 2)
      ctx.fill()

      // a string of lights across the trees
      ctx.strokeStyle = 'rgba(226,233,240,0.25)'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(CX - 52, CY + 18)
      ctx.quadraticCurveTo(CX - 6, CY + 34, CX + 42, CY + 12)
      ctx.stroke()
      for (let i = 0; i <= 6; i++) {
        const t = i / 6
        const x = (1 - t) ** 2 * (CX - 52) + 2 * (1 - t) * t * (CX - 6) + t ** 2 * (CX + 42)
        const y = (1 - t) ** 2 * (CY + 18) + 2 * (1 - t) * t * (CY + 34) + t ** 2 * (CY + 12)
        ctx.fillStyle = i % 2 ? GREEN : RED
        ctx.beginPath()
        ctx.arc(x, y + 1.5, 1.7, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    function drawFlakes() {
      ctx.fillStyle = INK
      for (const f of flakesRef.current) {
        ctx.globalAlpha = f.settled ? 0.85 : 0.95
        ctx.beginPath()
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    function drawGlare() {
      // specular highlight, then the rim
      const g = ctx.createLinearGradient(CX - R, CY - R, CX, CY)
      g.addColorStop(0, 'rgba(255,255,255,0.16)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(CX, CY, R - 1, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      ctx.strokeStyle = HAIR
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(CX, CY, R, 0, Math.PI * 2)
      ctx.stroke()
    }

    function drawBase() {
      const top = CY + R - 14
      ctx.fillStyle = RAISED
      ctx.beginPath()
      ctx.moveTo(CX - 54, top)
      ctx.lineTo(CX + 54, top)
      ctx.lineTo(CX + 68, H - 12)
      ctx.quadraticCurveTo(CX + 68, H - 4, CX + 60, H - 4)
      ctx.lineTo(CX - 60, H - 4)
      ctx.quadraticCurveTo(CX - 68, H - 4, CX - 68, H - 12)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = HAIR
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.fillStyle = 'rgba(226,233,240,0.55)'
      ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.textAlign = 'center'
      ctx.letterSpacing = '2px'
      ctx.fillText('SHAKE ME', CX, H - 16)
    }

    let raf
    let last = performance.now()
    let running = true

    /**
     * A canvas painting sixty times a second off the bottom of a phone
     * screen is pure battery. Run only while it is both on screen and in a
     * foreground tab, and reset the clock on resume so the step clamp is
     * not handed a delta measured in minutes.
     */
    let onScreen = true
    const sync = () => {
      const next = onScreen && !document.hidden
      if (next === running) return
      running = next
      if (running) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      } else {
        cancelAnimationFrame(raf)
      }
    }
    const io = new IntersectionObserver(
      ([e]) => {
        onScreen = e.isIntersecting
        sync()
      },
      { rootMargin: '120px' },
    )
    io.observe(canvas)
    document.addEventListener('visibilitychange', sync)

    function frame(now = performance.now()) {
      // Step in 60fps-equivalents rather than frames, so the snow falls at
      // the same rate on a 120Hz phone as on a 60Hz laptop, and a throttled
      // background tab resumes instead of teleporting everything.
      const step = Math.min((now - last) / 16.667, 3)
      last = now

      ctx.clearRect(0, 0, W, H)
      drawScene()

      if (!reduced) {
        shakeRef.current *= 0.97 ** step
        const swirl = shakeRef.current
        const damp = DRAG ** step
        for (const f of flakesRef.current) {
          if (f.settled) continue
          f.vy += GRAVITY * step
          f.vx += Math.sin((f.y + now / 900) * 0.05) * 0.012 * (1 + swirl * 6) * step
          f.vx *= damp
          f.vy *= damp
          f.x += f.vx * step
          f.y += f.vy * step

          // keep them inside the glass
          const dx = f.x - CX
          const dy = f.y - CY
          const d = Math.hypot(dx, dy)
          if (d > R - 5) {
            const n = (R - 5) / d
            f.x = CX + dx * n
            f.y = CY + dy * n
            f.vx *= -0.35
            f.vy *= -0.35
          }

          // Threshold sits above terminal velocity, or nothing would ever rest.
          const rest = restY(f.x)
          if (f.y >= rest && Math.abs(f.vy) < 4) {
            f.y = rest + rand(-2, 2)
            f.settled = true
          }
        }
      }

      drawFlakes()
      drawGlare()
      drawBase()
      if (running) raf = requestAnimationFrame(frame)
    }
    frame()
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  return (
    <button
      type="button"
      onClick={shake}
      onPointerDown={shake}
      aria-label="Shake the snow globe"
      className={`group relative shrink-0 cursor-pointer rounded-full outline-offset-4 ${className}`}
    >
      <canvas ref={canvasRef} className="block" />
      {!shaken ? (
        <span className="label absolute inset-x-0 -bottom-5 text-center text-mute transition-opacity group-hover:text-dim">
          Go on
        </span>
      ) : null}
    </button>
  )
}
