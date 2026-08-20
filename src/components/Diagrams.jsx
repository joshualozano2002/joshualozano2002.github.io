/**
 * Mission diagrams.
 *
 * Each mission gets a drawn technical figure rather than a photograph. They are
 * inline SVG so they stay sharp at any resolution, cost almost nothing to load,
 * and inherit the palette.
 */

const S = {
  line: 'var(--color-hairline-hot)',
  dim: 'var(--color-mute)',
  text: 'var(--color-dim)',
  mono: 'var(--font-mono)',
}

function Frame({ children, label, viewBox = '0 0 320 200', aria }) {
  return (
    <svg viewBox={viewBox} role="img" aria-label={aria} className="h-auto w-full">
      {children}
      {label ? (
        <text x="8" y="12" fill={S.dim} fontSize="7" fontFamily={S.mono} letterSpacing="1.4">
          {label}
        </text>
      ) : null}
    </svg>
  )
}

/* ---------------------------------------------------------------- EMBER */
function Detection() {
  const boxes = [
    { x: 34, y: 92, w: 78, h: 62, label: 'FIRE', conf: '0.91', c: 'var(--color-amber)' },
    { x: 96, y: 44, w: 104, h: 78, label: 'SMOKE', conf: '0.78', c: 'var(--color-cyan)' },
  ]
  return (
    <Frame
      label="DETECTION OVERLAY"
      aria="A camera frame with labelled bounding boxes around a fire region and a smoke plume, each with a confidence score."
    >
      <rect x="8" y="18" width="304" height="174" fill="#070c12" stroke={S.line} />
      {/* ridge line */}
      <path
        d="M8 150 L58 122 L96 138 L140 104 L188 130 L232 112 L280 140 L312 128 L312 192 L8 192 Z"
        fill="#0d151d"
        stroke={S.line}
        strokeWidth="1"
      />
      {/* smoke plume */}
      <path
        d="M126 132 C118 108 138 96 132 74 C128 58 148 52 146 38"
        fill="none"
        stroke="var(--color-cyan)"
        strokeOpacity="0.28"
        strokeWidth="16"
        strokeLinecap="round"
      />
      {/* fire glow */}
      <ellipse cx="72" cy="146" rx="22" ry="9" fill="var(--color-amber)" opacity="0.32" />

      {boxes.map((b) => (
        <g key={b.label}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="none" stroke={b.c} strokeWidth="1.4" />
          {/* reticle corners */}
          {[
            [b.x, b.y, 1, 1],
            [b.x + b.w, b.y, -1, 1],
            [b.x, b.y + b.h, 1, -1],
            [b.x + b.w, b.y + b.h, -1, -1],
          ].map(([cx, cy, sx, sy]) => (
            <path
              key={`${cx}-${cy}`}
              d={`M${cx} ${cy + sy * 8} L${cx} ${cy} L${cx + sx * 8} ${cy}`}
              stroke={b.c}
              strokeWidth="2.5"
              fill="none"
            />
          ))}
          <rect x={b.x} y={b.y - 11} width={b.label.length * 5.6 + 30} height="11" fill={b.c} />
          <text x={b.x + 3} y={b.y - 3} fill="#05080c" fontSize="7.5" fontFamily={S.mono} fontWeight="700">
            {b.label} {b.conf}
          </text>
        </g>
      ))}
    </Frame>
  )
}

/* ---------------------------------------------------------------- BABEL */
function Ast() {
  // A tiny AST for `x = a + 1;` in Left-Child / Right-Sibling form.
  const n = [
    { id: 'assign', x: 60, y: 44, t: '=' },
    { id: 'x', x: 60, y: 96, t: 'x' },
    { id: 'plus', x: 140, y: 96, t: '+' },
    { id: 'a', x: 140, y: 150, t: 'a' },
    { id: 'one', x: 220, y: 150, t: '1' },
  ]
  const byId = Object.fromEntries(n.map((v) => [v.id, v]))
  // solid = left child, dashed = right sibling
  const child = [['assign', 'x'], ['plus', 'a']]
  const sib = [['x', 'plus'], ['a', 'one']]

  const edge = ([from, to]) => {
    const f = byId[from]
    const t = byId[to]
    return `M${f.x} ${f.y + 12} L${f.x} ${t.y} L${t.x - 14} ${t.y}`
  }

  return (
    <Frame
      label="AST · LEFT-CHILD RIGHT-SIBLING"
      aria="An abstract syntax tree for an assignment statement, drawn in left-child right-sibling form with solid child links and dashed sibling links."
    >
      <rect x="8" y="18" width="304" height="174" fill="#070c12" stroke={S.line} />
      {child.map((e) => (
        <path key={`c${e.join()}`} d={edge(e)} fill="none" stroke="var(--color-cyan)" strokeWidth="1.3" />
      ))}
      {sib.map((e) => (
        <path
          key={`s${e.join()}`}
          d={`M${byId[e[0]].x + 14} ${byId[e[0]].y} L${byId[e[1]].x - 14} ${byId[e[1]].y}`}
          fill="none"
          stroke="var(--color-magenta)"
          strokeWidth="1.3"
          strokeDasharray="3 3"
        />
      ))}
      {n.map((v) => (
        <g key={v.id}>
          <circle cx={v.x} cy={v.y} r="13" fill="#0d151d" stroke="var(--color-cyan)" strokeWidth="1.3" />
          <text
            x={v.x}
            y={v.y + 4}
            textAnchor="middle"
            fill="var(--color-ink)"
            fontSize="11"
            fontFamily={S.mono}
          >
            {v.t}
          </text>
        </g>
      ))}
      <g fontFamily={S.mono} fontSize="7" letterSpacing="1">
        <line x1="228" y1="52" x2="246" y2="52" stroke="var(--color-cyan)" strokeWidth="1.3" />
        <text x="252" y="55" fill={S.text}>child</text>
        <line x1="228" y1="68" x2="246" y2="68" stroke="var(--color-magenta)" strokeWidth="1.3" strokeDasharray="3 3" />
        <text x="252" y="71" fill={S.text}>sibling</text>
      </g>
    </Frame>
  )
}

/* ----------------------------------------------------------------- NEST */
function TagStack() {
  const frames = [
    { t: '<span>', line: 44, ok: true },
    { t: '<p>', line: 41, ok: true },
    { t: '<div>', line: 12, ok: true },
    { t: '<body>', line: 3, ok: true },
  ]
  return (
    <Frame
      label="TRAVERSABLE STACK"
      aria="A stack of open HTML tags with line numbers, and an incoming closing div tag flagged as a mismatch against the span on top of the stack."
    >
      <rect x="8" y="18" width="304" height="174" fill="#070c12" stroke={S.line} />
      <text x="20" y="42" fill={S.dim} fontSize="7" fontFamily={S.mono} letterSpacing="1.2">
        TOP
      </text>
      {frames.map((f, i) => (
        <g key={f.t}>
          <rect
            x="20"
            y={48 + i * 30}
            width="150"
            height="24"
            fill="#0d151d"
            stroke={i === 0 ? 'var(--color-magenta)' : S.line}
            strokeWidth={i === 0 ? 1.6 : 1}
          />
          <text x="30" y={64 + i * 30} fill="var(--color-ink)" fontSize="10" fontFamily={S.mono}>
            {f.t}
          </text>
          <text x="160" y={64 + i * 30} textAnchor="end" fill={S.dim} fontSize="8" fontFamily={S.mono}>
            L{f.line}
          </text>
        </g>
      ))}
      {/* incoming token */}
      <g>
        <rect x="204" y="48" width="92" height="24" fill="#1a0f16" stroke="var(--color-magenta)" strokeWidth="1.4" />
        <text x="214" y="64" fill="var(--color-magenta)" fontSize="10" fontFamily={S.mono}>
          {'</div>'}
        </text>
        <path d="M200 60 L176 60" stroke="var(--color-magenta)" strokeWidth="1.3" markerEnd="" />
        <path d="M182 55 L176 60 L182 65" fill="none" stroke="var(--color-magenta)" strokeWidth="1.3" />
      </g>
      <text x="204" y="92" fill="var(--color-magenta)" fontSize="7.5" fontFamily={S.mono} letterSpacing="0.8">
        MISMATCH
      </text>
      <text x="204" y="104" fill={S.text} fontSize="7" fontFamily={S.mono}>
        expected
      </text>
      <text x="204" y="115" fill={S.text} fontSize="7" fontFamily={S.mono}>
        {'</span>'} · L44
      </text>
    </Frame>
  )
}

/* ----------------------------------------------------------------- NAVE */
/**
 * The bilingual narration pipeline. Artifact text is machine-translated
 * before synthesis; the fixed rosary prayers bypass translation entirely
 * because canonical liturgical wording cannot be generated.
 */
function Narration() {
  const box = (x, y, w, label, color) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={w} height="26" fill="#0d151d" stroke={color} strokeWidth="1.2" />
      <text
        x={x + w / 2}
        y={y + 16.5}
        textAnchor="middle"
        fill="var(--color-ink)"
        fontSize="8"
        fontFamily={S.mono}
      >
        {label}
      </text>
    </g>
  )
  const amber = 'var(--color-amber)'
  const cyan = 'var(--color-cyan)'

  return (
    <Frame
      viewBox="0 0 344 200"
      label="NARRATION PIPELINE"
      aria="Two input paths feed one speech synthesis step: artifact text in English is machine-translated to Spanish first, while the fixed rosary prayers skip translation because their wording is canonical. Both then go to synthesis and the CDN."
    >
      <rect x="8" y="18" width="328" height="174" fill="#070c12" stroke={S.line} />

      {box(18, 44, 74, 'artifact EN', cyan)}
      {box(106, 44, 74, 'translate ES', cyan)}
      {box(18, 130, 74, 'rosary ES', amber)}
      {box(196, 87, 62, 'TTS', cyan)}
      {box(272, 87, 52, 'CDN', cyan)}

      <g fill="none" strokeWidth="1.2">
        <path d="M92 57 L106 57" stroke={cyan} />
        <path d="M100 52 L106 57 L100 62" stroke={cyan} />

        <path d="M180 57 L188 57 Q196 57 196 66 L196 87" stroke={cyan} />
        <path d="M191 81 L196 87 L201 81" stroke={cyan} />

        <path d="M92 143 L188 143 Q196 143 196 134 L196 113" stroke={amber} />
        <path d="M191 119 L196 113 L201 119" stroke={amber} />

        <path d="M258 100 L272 100" stroke={cyan} />
        <path d="M266 95 L272 100 L266 105" stroke={cyan} />
      </g>

      <text x="18" y="164" fill={S.dim} fontSize="6.8" fontFamily={S.mono} letterSpacing="0.6">
        FIXED PRAYERS SKIP TRANSLATION
      </text>
      <text x="18" y="176" fill={S.dim} fontSize="6.8" fontFamily={S.mono} letterSpacing="0.6">
        CANONICAL WORDING, NOT GENERATED
      </text>
    </Frame>
  )
}

/* -------------------------------------------------------------- KRUSKAL */
/**
 * Generated, not drawn: a seeded Kruskal run over a grid graph with Union-Find
 * cycle detection produces the spanning tree, then a BFS finds the solution
 * path. Deterministic so server and client render identically.
 */
const MAZE = (() => {
  const W = 11
  const H = 7
  const CELLS = W * H
  let seed = 20260820
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)

  const edges = []
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const i = r * W + c
      if (c + 1 < W) edges.push({ a: i, b: i + 1, w: rnd() })
      if (r + 1 < H) edges.push({ a: i, b: i + W, w: rnd() })
    }
  }
  edges.sort((x, y) => x.w - y.w)

  const parent = Array.from({ length: CELLS }, (_, i) => i)
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }

  const carved = new Set()
  const adj = Array.from({ length: CELLS }, () => [])
  for (const e of edges) {
    const ra = find(e.a)
    const rb = find(e.b)
    if (ra === rb) continue // would close a cycle
    parent[ra] = rb
    carved.add(`${e.a}-${e.b}`)
    adj[e.a].push(e.b)
    adj[e.b].push(e.a)
  }

  // BFS for the unique path through the spanning tree.
  const prev = new Array(CELLS).fill(-1)
  const seen = new Array(CELLS).fill(false)
  const q = [0]
  seen[0] = true
  while (q.length) {
    const cur = q.shift()
    for (const nx of adj[cur]) {
      if (seen[nx]) continue
      seen[nx] = true
      prev[nx] = cur
      q.push(nx)
    }
  }
  const path = []
  for (let cur = CELLS - 1; cur !== -1; cur = prev[cur]) path.push(cur)
  path.reverse()

  return { W, H, carved, path }
})()

function Maze() {
  const { W, H, carved, path } = MAZE
  const cs = 24
  const ox = 24
  const oy = 30
  const cx = (i) => ox + (i % W) * cs + cs / 2
  const cy = (i) => oy + Math.floor(i / W) * cs + cs / 2

  const walls = []
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const i = r * W + c
      const x = ox + c * cs
      const y = oy + r * cs
      if (c + 1 < W && !carved.has(`${i}-${i + 1}`))
        walls.push(`M${x + cs} ${y} L${x + cs} ${y + cs}`)
      if (r + 1 < H && !carved.has(`${i}-${i + W}`))
        walls.push(`M${x} ${y + cs} L${x + cs} ${y + cs}`)
    }
  }

  return (
    <Frame
      viewBox="0 0 336 236"
      label="KRUSKAL MST · UNION-FIND"
      aria="A maze generated by running Kruskal's algorithm over a grid graph, with the solved path traced from the top-left to the bottom-right."
    >
      <rect x="8" y="18" width="320" height="210" fill="#070c12" stroke={S.line} />
      <rect x={ox} y={oy} width={W * cs} height={H * cs} fill="none" stroke="var(--color-annunciator)" strokeWidth="1.4" />
      <path d={walls.join(' ')} stroke="var(--color-annunciator)" strokeWidth="1.4" fill="none" strokeOpacity="0.72" />
      <path
        d={path.map((p, i) => `${i ? 'L' : 'M'}${cx(p)} ${cy(p)}`).join(' ')}
        fill="none"
        stroke="var(--color-amber)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.95"
      />
      <circle cx={cx(0)} cy={cy(0)} r="3.5" fill="var(--color-amber)" />
      <circle cx={cx(W * H - 1)} cy={cy(W * H - 1)} r="3.5" fill="var(--color-amber)" />
    </Frame>
  )
}

/* ----------------------------------------------------------------- DECK */
function RouteGraph() {
  const stages = [
    { t: 'source', x: 30 },
    { t: 'render', x: 118 },
    { t: 'html', x: 206 },
  ]
  const routes = ['/', '/missions', '/campaign', '/dossier', '/contact']
  return (
    <Frame
      label="BUILD · STATIC PRERENDER"
      aria="A build pipeline diagram: React source is rendered at build time into one static HTML file per route."
    >
      <rect x="8" y="18" width="304" height="174" fill="#070c12" stroke={S.line} />
      {stages.map((s, i) => (
        <g key={s.t}>
          <rect x={s.x} y="44" width="62" height="26" fill="#0d151d" stroke="var(--color-sky)" strokeWidth="1.2" />
          <text x={s.x + 31} y="61" textAnchor="middle" fill="var(--color-ink)" fontSize="9" fontFamily={S.mono}>
            {s.t}
          </text>
          {i < stages.length - 1 ? (
            <path
              d={`M${s.x + 62} 57 L${s.x + 82} 57`}
              stroke="var(--color-sky)"
              strokeWidth="1.2"
              markerEnd=""
            />
          ) : null}
        </g>
      ))}
      {routes.map((r, i) => (
        <g key={r}>
          <path
            d={`M268 70 L268 ${92 + i * 20} L286 ${92 + i * 20}`}
            fill="none"
            stroke="var(--color-sky)"
            strokeWidth="1"
            strokeOpacity="0.5"
          />
          <text x="118" y={96 + i * 20} fill={S.text} fontSize="8.5" fontFamily={S.mono}>
            {r}
          </text>
          <text x="240" y={96 + i * 20} textAnchor="end" fill="var(--color-annunciator)" fontSize="8" fontFamily={S.mono}>
            index.html
          </text>
        </g>
      ))}
      <text x="30" y="182" fill={S.dim} fontSize="7" fontFamily={S.mono} letterSpacing="1">
        NO JS REQUIRED TO READ
      </text>
    </Frame>
  )
}

const MAP = {
  narration: Narration,
  detection: Detection,
  ast: Ast,
  stack: TagStack,
  maze: Maze,
  route: RouteGraph,
}

export default function Diagram({ kind }) {
  const C = MAP[kind]
  return C ? <C /> : null
}
