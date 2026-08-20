import { Link, useParams } from 'react-router-dom'
import Seo from '../components/Seo'
import Diagram from '../components/Diagrams'
import NotFound from './NotFound'
import { Label, Lamp, ReadoutRow, Reveal, SectionHead, accentVar } from '../components/ui'
import { missions, missionBySlug } from '../data/missions'
import { absUrl } from '../site'

export default function Mission() {
  const { slug } = useParams()
  const m = missionBySlug(slug)
  if (!m) return <NotFound />

  const c = accentVar(m.accent)
  const i = missions.findIndex((x) => x.slug === m.slug)
  const prev = missions[i - 1]
  const next = missions[i + 1]

  return (
    <>
      <Seo
        title={m.title}
        description={m.summary}
        path={`/missions/${m.slug}`}
        type="article"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          name: m.title,
          abstract: m.summary,
          url: absUrl(`/missions/${m.slug}`),
          dateCreated: m.year,
          keywords: m.stack.join(', '),
          author: { '@type': 'Person', name: 'Joshua Lozano' },
        }}
      />

      {/* ---------------------------------------------------------- HEADER */}
      <section className="relative border-b border-hairline pt-14">
        <div aria-hidden="true" className="absolute inset-0 grid-bg mask-fade opacity-40" />
        <div className="relative mx-auto max-w-4xl px-5 py-14 lg:px-8">
          <Link
            to="/missions"
            className="readout text-[10px] tracking-[0.2em] text-mute underline-offset-4 hover:text-ink hover:underline"
          >
            ← MISSION LOG
          </Link>

          <div className="mt-6 flex items-center gap-2.5">
            <Lamp color={m.accent} />
            <span className="readout text-[10px] tracking-[0.2em]" style={{ color: c }}>
              {m.index} · {m.callsign}
            </span>
            <span className="readout text-[10px] tracking-[0.2em] text-mute">· {m.domain}</span>
          </div>

          <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-balance sm:text-4xl">
            {m.title}
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-dim text-pretty">{m.summary}</p>

          <p className="readout mt-6 text-[11px] tracking-[0.15em] text-mute">
            {m.course.toUpperCase()} · {m.year}
          </p>

          {m.links?.length ? (
            <div className="mt-7 flex flex-wrap gap-3">
              {m.links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target={l.external ? '_blank' : undefined}
                  rel={l.external ? 'noopener noreferrer' : undefined}
                  className="rounded-xs px-5 py-2.5 text-sm font-semibold text-void transition-opacity hover:opacity-90"
                  style={{ background: c }}
                >
                  {l.label} ↗
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 lg:px-8">
        {/* ------------------------------------------------------- READOUTS */}
        <section className="border-b border-hairline py-10">
          <ReadoutRow items={m.readouts} accent={m.accent} />
        </section>

        {/* -------------------------------------------------------- DIAGRAM */}
        <section className="py-12">
          <Reveal>
            <div className="panel overflow-hidden">
              <div className="bg-void/60 px-4 py-6 sm:px-8 sm:py-8">
                <Diagram kind={m.diagram} />
              </div>
            </div>
          </Reveal>
        </section>

        {/* ---------------------------------------------------------- BRIEF */}
        <section className="pb-14">
          <Reveal>
            <SectionHead title="Brief" />
            <div className="space-y-5">
              {m.brief.map((p, idx) => (
                <p key={idx} className="text-base leading-relaxed text-dim text-pretty">
                  {p}
                </p>
              ))}
            </div>
          </Reveal>
        </section>

        {/* -------------------------------------------------- SYSTEMS/HAZARDS */}
        <section className="grid gap-10 border-t border-hairline py-14 sm:grid-cols-2 sm:gap-14">
          <Reveal>
            <Label className="mb-5" style={{ color: c }}>
              Systems
            </Label>
            <ul className="space-y-3.5">
              {m.systems.map((s) => (
                <li key={s} className="flex gap-3">
                  <Lamp color={m.accent} className="mt-1.5" />
                  <span className="text-sm leading-relaxed text-dim text-pretty">{s}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.08}>
            <Label className="mb-5 text-amber">Hazards</Label>
            <ul className="space-y-3.5">
              {m.hazards.map((h) => (
                <li key={h} className="flex gap-3">
                  <Lamp color="amber" className="mt-1.5" />
                  <span className="text-sm leading-relaxed text-dim text-pretty">{h}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        {/* ---------------------------------------------------------- STACK */}
        <section className="border-t border-hairline py-10">
          <Label className="mb-4">Stack</Label>
          <ul className="flex flex-wrap gap-2">
            {m.stack.map((t) => (
              <li
                key={t}
                className="readout rounded-xs border border-hairline px-2.5 py-1 text-[11px] text-dim"
              >
                {t}
              </li>
            ))}
          </ul>
        </section>

        {m.note ? (
          <section className="border-t border-hairline py-10">
            <Label className="mb-3">Record notes</Label>
            <p className="max-w-2xl text-sm leading-relaxed text-mute text-pretty">{m.note}</p>
          </section>
        ) : null}

        {/* ------------------------------------------------------ PREV/NEXT */}
        <nav
          aria-label="Mission navigation"
          className="grid gap-4 border-t border-hairline py-12 sm:grid-cols-2"
        >
          {prev ? (
            <Link to={`/missions/${prev.slug}`} className="panel px-4 py-4 hover:border-hairline-hot">
              <Label className="mb-1.5">← Previous</Label>
              <p className="text-sm font-medium text-ink">{prev.title}</p>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              to={`/missions/${next.slug}`}
              className="panel px-4 py-4 text-right hover:border-hairline-hot"
            >
              <Label className="mb-1.5">Next →</Label>
              <p className="text-sm font-medium text-ink">{next.title}</p>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </div>
    </>
  )
}
