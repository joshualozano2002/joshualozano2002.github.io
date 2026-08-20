import Seo from '../components/Seo'
import MissionCard from '../components/MissionCard'
import { Label, Reveal } from '../components/ui'
import { missions } from '../data/missions'

export default function Missions() {
  return (
    <>
      <Seo
        title="Missions"
        description="Project records: a bilingual React Native church guide built solo for a non-profit, a YOLOv8 wildfire detection pipeline, a C-like language interpreter built from scratch, an HTML tag validator, a Kruskal maze solver, and this statically prerendered site."
        path="/missions"
      />

      <section className="relative border-b border-hairline pt-14">
        <div aria-hidden="true" className="absolute inset-0 grid-bg mask-fade opacity-40" />
        <div className="relative mx-auto max-w-6xl px-5 py-16 lg:px-8">
          <Label className="mb-4 text-amber">Mission log</Label>
          <h1 className="font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Missions
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-dim text-pretty">
            Six records. Each one is a system I built end to end, with the parts that were actually
            hard written down rather than skipped.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 lg:px-8">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {missions.map((m, i) => (
            <Reveal key={m.slug} delay={i * 0.06}>
              <MissionCard m={m} />
            </Reveal>
          ))}
        </div>
      </section>
    </>
  )
}
