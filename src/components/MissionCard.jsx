import { Link } from 'react-router-dom'
import Diagram from './Diagrams'
import { Label, Lamp, accentVar } from './ui'

export default function MissionCard({ m }) {
  const c = accentVar(m.accent)
  return (
    <Link
      to={`/missions/${m.slug}`}
      className="panel group flex flex-col overflow-hidden transition-colors duration-300 hover:border-hairline-hot"
    >
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
        <span className="flex items-center gap-2.5">
          <Lamp color={m.accent} />
          <span className="readout text-[10px] tracking-[0.2em]" style={{ color: c }}>
            {m.index} · {m.callsign}
          </span>
        </span>
        <Label>{m.domain}</Label>
      </div>

      <div className="bg-void/60 px-4 py-4">
        <Diagram kind={m.diagram} />
      </div>

      <div className="flex flex-1 flex-col gap-3 border-t border-hairline px-4 py-4">
        <h3 className="font-display text-lg font-semibold leading-snug tracking-tight text-ink">
          {m.title}
        </h3>
        <p className="flex-1 text-sm leading-relaxed text-dim text-pretty">{m.summary}</p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {m.stack.slice(0, 4).map((t) => (
            <span
              key={t}
              className="readout rounded-xs border border-hairline px-2 py-0.5 text-[10px] text-mute"
            >
              {t}
            </span>
          ))}
        </div>
        <span
          className="readout mt-1 text-[10px] tracking-[0.2em] transition-colors"
          style={{ color: c }}
        >
          OPEN RECORD →
        </span>
      </div>
    </Link>
  )
}
