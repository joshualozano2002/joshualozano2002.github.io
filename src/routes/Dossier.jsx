import Seo from '../components/Seo'
import { Label, Lamp, Reveal, SectionHead } from '../components/ui'
import { dossier } from '../data/dossier'
import { profile } from '../data/profile'
import { withBase } from '../site'

/**
 * The resume as real, indexable HTML. The PDF is offered alongside it rather
 * than instead of it — an iframed PDF is unreadable on a phone and invisible
 * to search engines.
 */
export default function Dossier() {
  return (
    <>
      <Seo
        title="Dossier"
        description={`Resume for ${profile.name} — ${profile.current.title} at ${profile.current.org}, Vice President of Modern Faith Works, former NASA SARP research intern, BS Computer Science from Sonoma State University. React Native, Node, Python, C/C++, PyTorch.`}
        path="/dossier"
      />

      <section className="relative border-b border-hairline pt-14">
        <div aria-hidden="true" className="absolute inset-0 grid-bg mask-fade opacity-40" />
        <div className="relative mx-auto max-w-4xl px-5 py-16 lg:px-8">
          <Label className="mb-4 text-amber">Dossier</Label>
          <h1 className="font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            {profile.name}
          </h1>
          <p className="readout mt-4 text-[11px] tracking-[0.15em] text-dim">
            {profile.current.title.toUpperCase()}
            <span className="text-amber"> · {profile.current.org.toUpperCase()}</span>
          </p>
          <p className="readout mt-1.5 text-[11px] tracking-[0.15em] text-mute">
            {profile.education.toUpperCase()} · {profile.location.toUpperCase()}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={withBase('media/Joshua-Lozano-Resume.pdf')}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xs bg-amber px-5 py-2.5 text-sm font-semibold text-void transition-opacity hover:opacity-90"
            >
              Download PDF ↓
            </a>
            <a
              href={`mailto:${profile.email}`}
              className="rounded-xs border border-hairline-hot px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-amber hover:text-amber"
            >
              {profile.email}
            </a>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 lg:px-8">
        {/* ----------------------------------------------------- EXPERIENCE */}
        <section className="border-b border-hairline py-14">
          <Reveal>
            <SectionHead title="Experience" />
            <div className="space-y-12">
              {dossier.experience.map((e) => (
                <article key={e.org}>
                  <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="font-display text-lg font-semibold text-ink">
                      {e.url ? (
                        <a
                          href={e.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber underline-offset-4 hover:underline"
                        >
                          {e.org} ↗
                        </a>
                      ) : (
                        e.org
                      )}
                    </h3>
                    <span className="readout text-[11px] tracking-[0.15em] text-mute">
                      {e.place.toUpperCase()}
                    </span>
                  </header>
                  <p className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-sm italic text-dim">{e.role}</span>
                    <span className="readout flex items-center gap-2 text-[11px] tracking-[0.15em] text-mute">
                      {e.current ? <Lamp color="annunciator" /> : null}
                      {e.period}
                    </span>
                  </p>
                  {e.summary ? (
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mute text-pretty">
                      {e.summary}
                    </p>
                  ) : null}
                  <ul className="mt-5 space-y-3">
                    {e.bullets.map((b) => (
                      <li key={b} className="flex gap-3">
                        <Lamp color="amber" className="mt-1.5" />
                        <span className="text-sm leading-relaxed text-dim text-pretty">{b}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ------------------------------------------------------ EDUCATION */}
        <section className="border-b border-hairline py-14">
          <Reveal>
            <SectionHead title="Education" />
            {dossier.education.map((ed) => (
              <article key={ed.school}>
                <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="font-display text-lg font-semibold text-ink">{ed.school}</h3>
                  <span className="readout text-[11px] tracking-[0.15em] text-mute">
                    {ed.place.toUpperCase()}
                  </span>
                </header>
                <p className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-sm italic text-dim">
                    {ed.degree} · {ed.detail}
                  </span>
                  <span className="readout text-[11px] tracking-[0.15em] text-mute">
                    {ed.period}
                  </span>
                </p>
                <ul className="mt-4 space-y-2">
                  {ed.notes.map((nt) => (
                    <li key={nt} className="flex gap-3">
                      <Lamp color="cyan" className="mt-1.5" />
                      <span className="text-sm text-dim">{nt}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <Label className="mb-3">Relevant coursework</Label>
                  <ul className="flex flex-wrap gap-2">
                    {ed.coursework.map((cw) => (
                      <li
                        key={cw}
                        className="readout rounded-xs border border-hairline px-2.5 py-1 text-[11px] text-dim"
                      >
                        {cw}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </Reveal>
        </section>

        {/* --------------------------------------------------------- SKILLS */}
        <section className="py-14">
          <Reveal>
            <SectionHead title="Skills" />
            <dl className="grid gap-8 sm:grid-cols-2">
              {dossier.skills.map((g) => (
                <div key={g.group}>
                  <dt>
                    <Label className="mb-3 text-amber">{g.group}</Label>
                  </dt>
                  <dd>
                    <ul className="flex flex-wrap gap-2">
                      {g.items.map((s) => (
                        <li
                          key={s}
                          className="readout rounded-xs border border-hairline px-2.5 py-1 text-[11px] text-dim"
                        >
                          {s}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </section>
      </div>
    </>
  )
}
