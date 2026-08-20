import { Link } from 'react-router-dom'
import Seo from '../components/Seo'
import { Label, Lamp } from '../components/ui'

export default function NotFound() {
  return (
    <>
      <Seo
        title="Off course"
        description="That route does not exist on this site."
        path="/404"
      />
      <section className="relative flex min-h-dvh items-center pt-14">
        <div aria-hidden="true" className="absolute inset-0 grid-bg mask-fade opacity-40" />
        <div className="relative mx-auto max-w-2xl px-5 py-20 text-center lg:px-8">
          <div className="mb-5 flex items-center justify-center gap-2.5">
            <Lamp color="amber" />
            <Label className="text-amber">Deviation · 404</Label>
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Off course
          </h1>
          <p className="mt-5 text-base leading-relaxed text-dim text-pretty">
            There is no station at this heading. Return to the deck and pick one up from there.
          </p>
          <Link
            to="/"
            className="mt-9 inline-block rounded-xs bg-amber px-5 py-2.5 text-sm font-semibold text-void transition-opacity hover:opacity-90"
          >
            Return to deck
          </Link>
        </div>
      </section>
    </>
  )
}
