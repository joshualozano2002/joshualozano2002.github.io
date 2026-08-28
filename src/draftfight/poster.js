/**
 * The results poster — a 1080x1350 card built for the group chat.
 *
 * Rendered on demand into an offscreen canvas from the same fight data the
 * arena uses, so the poster can never disagree with the fight.
 */
import { drawWrestler } from './sprite.js'

const MONO = '"JetBrains Mono", ui-monospace, monospace'
export const POSTER_W = 1080
export const POSTER_H = 1350

export function renderPoster(ctx, { spec, fight, fighters, awards }) {
  const W = POSTER_W
  const H = POSTER_H
  const n = fight.n

  ctx.fillStyle = '#05080c'
  ctx.fillRect(0, 0, W, H)

  // Faint engineering grid, like the site.
  ctx.strokeStyle = 'rgba(30,42,56,0.5)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let v = 0; v <= W; v += 54) {
    ctx.moveTo(v, 0)
    ctx.lineTo(v, H)
  }
  for (let v = 0; v <= H; v += 54) {
    ctx.moveTo(0, v)
    ctx.lineTo(W, v)
  }
  ctx.stroke()

  // House light on the champion.
  const glow = ctx.createRadialGradient(W / 2, 400, 40, W / 2, 400, 420)
  glow.addColorStop(0, 'rgba(255,215,140,0.16)')
  glow.addColorStop(1, 'rgba(255,215,140,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, 760)

  const text = (t, x, y, px, color, align = 'center', weight = 700, spacing = 0) => {
    ctx.font = `${weight} ${px}px ${MONO}`
    ctx.textAlign = align
    ctx.textBaseline = 'middle'
    ctx.fillStyle = color
    if (spacing) {
      // Manual letterspacing for the label rows.
      const chars = [...t]
      const widths = chars.map((c) => ctx.measureText(c).width)
      const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1)
      let cx = x - (align === 'center' ? total / 2 : 0)
      ctx.textAlign = 'left'
      for (let i = 0; i < chars.length; i++) {
        ctx.fillText(chars[i], cx, y)
        cx += widths[i] + spacing
      }
      ctx.textAlign = align
    } else {
      ctx.fillText(t, x, y)
    }
  }

  text('D R A F T   F I G H T   ·   O F F I C I A L   R E S U L T', W / 2, 76, 22, '#5a6b80')
  text(spec.league.toUpperCase(), W / 2, 140, 54, '#ff9d2e')
  const when = spec.startAt
    ? new Date(spec.startAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  text(`${n} MANAGERS · ${when}`, W / 2, 188, 22, '#8ea0b4')

  // The champion, huge, with the belt.
  const champ = fighters[fight.winner]
  ctx.save()
  ctx.translate(W / 2, 520)
  ctx.imageSmoothingEnabled = false
  drawWrestler(ctx, { ...champ.pal, belt: true }, 'win', 0, 1, 16)
  ctx.restore()
  text('PICK 1', W / 2, 580, 30, '#ff9d2e')
  text(champ.name.toUpperCase(), W / 2, 638, 64, '#e2e9f0')
  text(`${champ.callsign} · #${champ.number}${champ.champ ? ' · RETAINED' : ''}`, W / 2, 692, 24, champ.color)

  // The board, two columns below the fold.
  ctx.strokeStyle = 'rgba(44,61,81,0.9)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(90, 745)
  ctx.lineTo(W - 90, 745)
  ctx.stroke()

  const rows = fight.order.length - 1
  const perCol = Math.ceil(rows / 2)
  const rowH = Math.min(52, 380 / perCol)
  for (let k = 1; k < fight.order.length; k++) {
    const id = fight.order[k]
    const f = fighters[id]
    const col = Math.floor((k - 1) / perCol)
    const row = (k - 1) % perCol
    const x = col === 0 ? 120 : W / 2 + 40
    const y = 800 + row * rowH
    text(String(k).padStart(2, '0'), x, y, 24, '#5a6b80', 'left')
    ctx.fillStyle = f.color
    ctx.beginPath()
    ctx.arc(x + 62, y, 7, 0, Math.PI * 2)
    ctx.fill()
    text(f.name, x + 88, y, 26, '#e2e9f0', 'left', 500)
    text(f.callsign, x + 430, y, 17, '#5a6b80', 'right')
  }

  // Awards strip.
  const ay = 800 + perCol * rowH + 46
  ctx.beginPath()
  ctx.moveTo(90, ay - 34)
  ctx.lineTo(W - 90, ay - 34)
  ctx.stroke()
  const shown = awards.slice(0, 4)
  const aw = (W - 180) / shown.length
  shown.forEach((a, i) => {
    const x = 90 + aw * i + aw / 2
    text(a.title, x, ay + 4, 17, '#e8c35a')
    text(fighters[a.id].name, x, ay + 34, 22, '#e2e9f0')
    text(a.detail, x, ay + 62, 15, '#5a6b80')
  })

  text('SETTLE IT IN THE RING · DRAFT FIGHT', W / 2, H - 44, 18, '#5a6b80')

  // Frame + scanlines.
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1)
  ctx.strokeStyle = '#2c3d51'
  ctx.lineWidth = 3
  ctx.strokeRect(6, 6, W - 12, H - 12)
  ctx.strokeStyle = 'rgba(255,157,46,0.6)'
  ctx.strokeRect(12, 12, W - 24, H - 24)
}
