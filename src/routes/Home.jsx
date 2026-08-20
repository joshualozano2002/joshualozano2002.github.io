import { Link } from 'react-router-dom'
import Seo, { personSchema } from '../components/Seo'
import PFD from '../components/PFD'
import MissionCard from '../components/MissionCard'
import { Label, Lamp, Reveal, SectionHead } from '../components/ui'
import { profile } from '../data/profile'
import { missions } from '../data/missions'
import { campaign } from '../data/campaign'
import { withBase } from '../site'

export default function Home() {
  const featured = missions.slice(0, 3)

  return (
    <>
      <Seo
        title={`${profile.name} — Backend, Machine Learning & Technical Operations`}
        description={`${profile.name} — ${profile.current.title} at ${profile.current.org}. Former NASA SARP research intern. Computer vision, a C-like language interpreter built from scratch, and the systems work underneath.`}
        path="/"
        jsonLd={personSchema()}
      />

      {/* ------------------------------------------------------------ HERO */}
      <section className="relative overflow-hidden pt-14">
        <div aria-hidden="true" className="absolute inset-0 grid-bg mask-fade opacity-60" />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-[0.10] mask-b"
          style={{ backgroundImage: `url(${withBase('media/flight-deck.webp')})` }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-void to-transparent"
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:py-24">
          <div>
            <div className="mb-6 flex items-center gap-2.5">
              <Lamp color="amber" />
              <Label className="text-amber">Deck · Standing by</Label>
            </div>

            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {profile.name}
            </h1>

            <p className="mt-3 readout text-xs tracking-[0.2em] text-dim">
              {profile.current.title.toUpperCase()}
              <span className="text-amber"> · {profile.current.org.toUpperCase()}</span>
            </p>
            <p className="mt-1.5 readout text-[11px] tracking-[0.15em] text-mute">
              {profile.education.toUpperCase()}
            </p>

            <p className="mt-7 max-w-xl text-base leading-relaxed text-dim text-pretty sm:text-lg">
              {profile.tagline}
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                to="/missions"
                className="rounded-xs bg-amber px-5 py-2.5 text-sm font-semibold text-void transition-opacity hover:opacity-90"
              >
                View missions
              </Link>
              <Link
                to="/campaign"
                className="rounded-xs border border-hairline-hot px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-amber hover:text-amber"
              >
                NASA campaign
              </Link>
            </div>
          </div>

          <div className="relative">
            <PFD className="drop-shadow-[0_0_40px_rgba(79,214,234,0.06)]" />
            <p className="mt-3 text-center text-[10px] text-mute readout tracking-[0.15em]">
              LIVE · ALT READS SCROLL · ATT READS POINTER
            </p>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- SYSTEMS */}
      <section className="border-y border-hairline bg-panel/30">
        <div className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
          <Label className="mb-5">Systems</Label>
          <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {profile.systems.map((s) => (
              <li key={s.label} className="flex items-start gap-3">
                <Lamp on={s.state === 'on'} className="mt-1.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{s.label}</p>
                  <p className="readout mt-0.5 text-[11px] leading-relaxed text-mute">{s.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------- MISSIONS */}
      <section className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
        <Reveal>
          <SectionHead
            index="Selected"
            title="Missions"
            kicker="Detection pipelines, a language built from the character stream up, and the algorithms underneath."
          />
        </Reveal>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((m, i) => (
            <Reveal key={m.slug} delay={i * 0.07}>
              <MissionCard m={m} />
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <div className="mt-8">
            <Link
              to="/missions"
              className="readout text-xs tracking-[0.2em] text-amber underline-offset-4 hover:underline"
            >
              ALL {missions.length} MISSIONS →
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ------------------------------------------------------- CAMPAIGN */}
      <section className="border-t border-hairline bg-panel/30">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8">
          <Reveal>
            <figure className="panel overflow-hidden">
              <img
                src={withBase('media/ramp-n426na.webp')}
                width={1800}
                height={1350}
                loading="lazy"
                decoding="async"
                alt={campaign.media[1].alt}
                className="w-full object-cover"
              />
              <figcaption className="border-t border-hairline px-4 py-2.5">
                <span className="readout text-[10px] tracking-[0.18em] text-mute">
                  {campaign.media[1].caption}
                </span>
              </figcaption>
            </figure>
          </Reveal>

          <Reveal delay={0.08}>
            <Label className="mb-3 text-amber">Campaign</Label>
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl text-balance">
              {campaign.short}
            </h2>
            <p className="readout mt-2 text-[11px] tracking-[0.15em] text-mute">
              {campaign.start.toUpperCase()} — {campaign.end.toUpperCase()} · {campaign.base.toUpperCase()}
            </p>
            <p className="mt-5 text-base leading-relaxed text-dim text-pretty">{campaign.summary}</p>
            <p className="mt-4 text-sm leading-relaxed text-mute text-pretty">
              Independent study:{' '}
              <span className="text-dim">{campaign.title}</span>
            </p>
            <Link
              to="/campaign"
              className="readout mt-7 inline-block text-xs tracking-[0.2em] text-amber underline-offset-4 hover:underline"
            >
              OPEN CAMPAIGN RECORD →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ CTA */}
      <section className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
        <Reveal>
          <div className="panel relative overflow-hidden px-6 py-12 text-center sm:px-12">
            <div aria-hidden="true" className="absolute inset-0 grid-bg mask-fade opacity-40" />
            <div className="relative">
              <Label className="mb-4">Comms</Label>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                Open to backend, ML, and data engineering work.
              </h2>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <a
                  href={`mailto:${profile.email}`}
                  className="rounded-xs bg-amber px-5 py-2.5 text-sm font-semibold text-void transition-opacity hover:opacity-90"
                >
                  Email me
                </a>
                <Link
                  to="/dossier"
                  className="rounded-xs border border-hairline-hot px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-amber hover:text-amber"
                >
                  Read the dossier
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
