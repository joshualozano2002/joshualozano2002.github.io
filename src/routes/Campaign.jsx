import Seo from '../components/Seo'
import { Label, Lamp, ReadoutRow, Reveal, SectionHead } from '../components/ui'
import { campaign } from '../data/campaign'
import { absUrl, withBase } from '../site'

export default function Campaign() {
  const [deck, ramp, field] = campaign.media

  return (
    <>
      <Seo
        title="NASA SARP Campaign"
        description={`NASA Student Airborne Research Program, June–August 2024 at UC Irvine. Independent research on ${campaign.title}.`}
        path="/campaign"
        image="media/ramp-n426na.webp"
        type="article"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'ResearchProject',
          name: campaign.title,
          url: absUrl('/campaign'),
          startDate: '2024-06',
          endDate: '2024-08',
          member: { '@type': 'Person', name: 'Joshua Lozano' },
          parentOrganization: { '@type': 'Organization', name: 'NASA' },
        }}
      />

      {/* ------------------------------------------------------------ HERO */}
      <section className="relative overflow-hidden border-b border-hairline pt-14">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-[0.14] mask-b"
          style={{ backgroundImage: `url(${withBase(deck.src)})` }}
        />
        <div aria-hidden="true" className="absolute inset-0 grid-bg mask-fade opacity-40" />
        <div className="relative mx-auto max-w-4xl px-5 py-16 lg:px-8">
          <div className="mb-5 flex items-center gap-2.5">
            <Lamp color="amber" />
            <Label className="text-amber">{campaign.short}</Label>
          </div>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-balance sm:text-4xl lg:text-5xl">
            {campaign.program}
          </h1>
          <p className="readout mt-5 text-[11px] tracking-[0.15em] text-mute">
            {campaign.role.toUpperCase()} · {campaign.start.toUpperCase()} — {campaign.end.toUpperCase()} ·{' '}
            {campaign.base.toUpperCase()}
          </p>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-dim text-pretty">
            {campaign.summary}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 lg:px-8">
        <section className="border-b border-hairline py-10">
          <ReadoutRow items={campaign.readouts} accent="amber" />
        </section>

        {/* -------------------------------------------------- FLIGHT DECK */}
        <section className="py-12">
          <Reveal>
            <figure className="panel overflow-hidden">
              <img
                src={withBase(deck.src)}
                width={deck.w}
                height={deck.h}
                alt={deck.alt}
                loading="lazy"
                decoding="async"
                className="w-full"
              />
              <figcaption className="border-t border-hairline px-4 py-3">
                <span className="readout text-[10px] tracking-[0.18em] text-mute">
                  {deck.caption}
                </span>
              </figcaption>
            </figure>
          </Reveal>
        </section>

        {/* ------------------------------------------------------ RESEARCH */}
        <section className="pb-14">
          <Reveal>
            <SectionHead index="Independent study" title={campaign.title} />
            <div className="space-y-5">
              {campaign.brief.map((p, i) => (
                <p key={i} className="text-base leading-relaxed text-dim text-pretty">
                  {p}
                </p>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ------------------------------------------------- CONTRIBUTIONS */}
        <section className="border-t border-hairline py-14">
          <Reveal>
            <Label className="mb-6 text-amber">Contributions</Label>
            <ul className="space-y-4">
              {campaign.contributions.map((c) => (
                <li key={c} className="flex gap-3">
                  <Lamp color="amber" className="mt-1.5" />
                  <span className="text-sm leading-relaxed text-dim text-pretty">{c}</span>
                </li>
              ))}
            </ul>
            <ul className="mt-8 flex flex-wrap gap-2">
              {campaign.stack.map((t) => (
                <li
                  key={t}
                  className="readout rounded-xs border border-hairline px-2.5 py-1 text-[11px] text-dim"
                >
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        {/* --------------------------------------------------------- MEDIA */}
        <section className="border-t border-hairline py-14">
          <Reveal>
            <SectionHead title="From the campaign" />
            <div className="grid gap-5 sm:grid-cols-2">
              <figure className="panel overflow-hidden">
                <img
                  src={withBase(ramp.src)}
                  width={ramp.w}
                  height={ramp.h}
                  alt={ramp.alt}
                  loading="lazy"
                  decoding="async"
                  className="w-full object-cover"
                />
                <figcaption className="border-t border-hairline px-4 py-2.5">
                  <span className="readout text-[10px] tracking-[0.18em] text-mute">
                    {ramp.caption}
                  </span>
                </figcaption>
              </figure>

              <figure className="panel overflow-hidden">
                <img
                  src={withBase(field.src)}
                  width={field.w}
                  height={field.h}
                  alt={field.alt}
                  loading="lazy"
                  decoding="async"
                  className="w-full object-cover"
                />
                <figcaption className="border-t border-hairline px-4 py-2.5">
                  <span className="readout text-[10px] tracking-[0.18em] text-mute">
                    {field.caption}
                  </span>
                </figcaption>
              </figure>
            </div>

            <figure className="panel mt-5 overflow-hidden">
              <video
                className="w-full"
                controls
                preload="none"
                playsInline
                muted
                poster={withBase(campaign.video.poster)}
              >
                <source src={withBase(campaign.video.src)} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
              <figcaption className="border-t border-hairline px-4 py-2.5">
                <span className="readout text-[10px] tracking-[0.18em] text-mute">
                  {campaign.video.caption}
                </span>
              </figcaption>
            </figure>
          </Reveal>
        </section>

        {/* --------------------------------------------------------- LINKS */}
        <section className="border-t border-hairline py-14">
          <Label className="mb-6">Record</Label>
          <div className="flex flex-wrap gap-3">
            {campaign.links.map((l) => (
              <a
                key={l.href}
                href={l.external ? l.href : withBase(l.href)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xs border border-hairline-hot px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-amber hover:text-amber"
              >
                {l.label} ↗
              </a>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
