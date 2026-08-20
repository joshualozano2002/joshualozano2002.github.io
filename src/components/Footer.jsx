import { Link } from 'react-router-dom'
import { nav, profile } from '../data/profile'
import { Label } from './ui'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-24 border-t border-hairline bg-panel/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="sm:col-span-2">
          <Label className="mb-3">Comms</Label>
          <p className="max-w-sm text-sm leading-relaxed text-dim text-pretty">
            Open to backend, machine learning, and data engineering work. The fastest way to reach
            me is email.
          </p>
          <a
            href={`mailto:${profile.email}`}
            className="readout mt-4 inline-block text-sm text-amber underline-offset-4 hover:underline"
          >
            {profile.email}
          </a>
        </div>

        <div>
          <Label className="mb-3">Stations</Label>
          <ul className="space-y-2">
            {nav.map((n) => (
              <li key={n.to}>
                <Link to={n.to} className="text-sm text-dim transition-colors hover:text-ink">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <Label className="mb-3">Elsewhere</Label>
          <ul className="space-y-2">
            <li>
              <a
                href={profile.github}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-dim transition-colors hover:text-ink"
              >
                GitHub
              </a>
            </li>
            <li>
              <a
                href={profile.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-dim transition-colors hover:text-ink"
              >
                LinkedIn
              </a>
            </li>
            <li>
              <a
                href={profile.affiliation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-dim transition-colors hover:text-ink"
              >
                {profile.affiliation.org}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p className="readout text-[10px] tracking-[0.2em] text-mute">
            © {year} {profile.name.toUpperCase()}
          </p>
          <p className="readout text-[10px] tracking-[0.2em] text-mute">
            END OF TRANSMISSION · N426NA
          </p>
        </div>
      </div>
    </footer>
  )
}
