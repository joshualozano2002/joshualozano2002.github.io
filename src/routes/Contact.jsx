import Seo from '../components/Seo'
import { Label, Lamp, Reveal } from '../components/ui'
import { profile } from '../data/profile'
import { withBase } from '../site'

const channels = [
  { label: 'Email', value: 'joshualozano2002@gmail.com', href: `mailto:${profile.email}`, code: 'PRI' },
  { label: 'GitHub', value: 'joshualozano2002', href: profile.github, code: 'SEC', ext: true },
  { label: 'LinkedIn', value: 'joshua-lozano7', href: profile.linkedin, code: 'SEC', ext: true },
]

export default function Contact() {
  return (
    <>
      <Seo
        title="Comms"
        description={`Get in touch with ${profile.name} about backend, machine learning, and data engineering work.`}
        path="/contact"
      />

      <section className="relative flex min-h-dvh flex-col justify-center pt-14">
        <div aria-hidden="true" className="absolute inset-0 grid-bg mask-fade opacity-40" />

        <div className="relative mx-auto w-full max-w-4xl px-5 py-20 lg:px-8">
          <div className="mb-5 flex items-center gap-2.5">
            <Lamp color="amber" />
            <Label className="text-amber">Comms · Open</Label>
          </div>

          <h1 className="font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Get in touch
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-dim text-pretty sm:text-lg">
            I am open to backend, machine learning, and data engineering roles, and happy to talk
            about any of the work on this site. Email reaches me fastest.
          </p>

          <Reveal>
            <ul className="mt-12 divide-y divide-hairline border-y border-hairline">
              {channels.map((ch) => (
                <li key={ch.label}>
                  <a
                    href={ch.href}
                    {...(ch.ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="group flex items-center justify-between gap-4 py-5 transition-colors"
                  >
                    <span className="flex min-w-0 items-center gap-4">
                      <span className="readout w-9 shrink-0 text-[10px] tracking-[0.2em] text-mute">
                        {ch.code}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">{ch.label}</span>
                        <span className="readout block truncate text-[11px] text-mute">
                          {ch.value}
                        </span>
                      </span>
                    </span>
                    <span className="readout shrink-0 text-xs text-amber opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      →
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Reveal>

          <div className="mt-10">
            <a
              href={withBase('media/Joshua-Lozano-Resume.pdf')}
              target="_blank"
              rel="noopener noreferrer"
              className="readout text-xs tracking-[0.2em] text-dim underline-offset-4 hover:text-amber hover:underline"
            >
              DOWNLOAD RESUME ↓
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
