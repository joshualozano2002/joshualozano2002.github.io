/**
 * The full script of a fight, before it's ever played.
 *
 * The simulation is deterministic, so every line the booth will say is
 * computable in advance. This mirrors the arena's live calls string-for-string
 * — the pre-generated announcer audio is looked up by exact text, so any line
 * built here that drifts from the booth's phrasing simply never plays.
 */
const INTRO_LINES = true

export function buildLines({ fight, fighters, n }) {
  const lines = new Set()
  const name = (i) => fighters[i].name

  lines.add('The announcer is live.')
  lines.add(`The bell rings — ${n} managers, one ring, and only one Pick 1.`)

  // Entrances (champ walks last, mirroring the arena's order).
  for (const f of fighters) {
    lines.add(
      f.champ
        ? `And finally — defending Pick 1 — ${f.name}, ${f.callsign}!`
        : `Here comes ${f.name} — ${f.callsign}!`,
    )
  }

  // Weapons, the table, high spots, and comebacks — from the object feed.
  const WLABEL = { chair: 'STEEL CHAIR', kendo: 'KENDO STICK', can: 'TRASH CAN' }
  for (const o of fight.objects) {
    if (o.k === 'spawn') lines.add(`A ${WLABEL[o.w]} just slid into the ring!`)
    else if (o.k === 'pick') lines.add(`${name(o.by)} has the ${WLABEL[o.w]}!`)
    else if (o.k === 'break') {
      if (o.w === 'chair') lines.add(`${name(o.by)} breaks the chair over ${name(o.on)}!`)
      else if (o.w === 'kendo')
        lines.add(`${name(o.by)} snaps the kendo stick across ${name(o.on)}'s back!`)
      else lines.add(`${name(o.by)} flattens the trash can over ${name(o.on)}'s head!`)
    } else if (o.k === 'drop') lines.add(`The ${WLABEL[o.w].toLowerCase()} is loose again!`)
    else if (o.k === 'tspawn')
      lines.add('A TABLE has been set up in the ring. This will end badly for someone.')
    else if (o.k === 'tslam') lines.add(`${name(o.by)} puts ${name(o.on)} THROUGH THE TABLE!!`)
    else if (o.k === 'dive') lines.add(`${name(o.by)} FROM THE TOP ROPE!!`)
    else if (o.k === 'rage') lines.add(`${name(o.by)} is FEELING IT — the comeback is on!`)
  }

  // Hang-ons and the feud.
  for (const sv of fight.saves)
    lines.add(`${name(sv.id)} was GONE — and somehow hangs on by the fingertips!`)
  if (fight.feudEvent)
    lines.add(
      `${name(fight.feudEvent.a)} and ${name(fight.feudEvent.b)} just cannot leave each other alone. That's a feud.`,
    )

  // ON FIRE — replay the hit stream exactly as the arena does.
  {
    const streak = new Array(n).fill(0)
    const onFire = new Array(n).fill(false)
    for (const h of fight.hits) {
      streak[h.a]++
      streak[h.d] = 0
      if (onFire[h.d]) onFire[h.d] = false
      if (streak[h.a] === 5 && !onFire[h.a]) {
        onFire[h.a] = true
        lines.add(`${name(h.a)} is ON FIRE!`)
      }
    }
  }

  // Hanging by a thread — same scan the renderer runs.
  {
    const { ticks, hp, state } = fight
    const called = new Array(n).fill(false)
    for (let t = 0; t < ticks; t += 8) {
      for (let i = 0; i < n; i++) {
        if (!called[i] && state[t * n + i] === 2 && hp[t * n + i] < 0.14) {
          called[i] = true
          lines.add(`${name(i)} is hanging on by a thread!`)
        }
      }
    }
  }

  // Eliminations, rampages, the champ falling, and the field milestones.
  {
    const half = Math.ceil(n / 2)
    let koBy = -1
    let koAt = -9999
    let koStreak = 0
    let halfSaid = false
    fight.elims.forEach((e, idx) => {
      const loser = name(e.id)
      if (fighters[e.id].champ) lines.add(`THE CHAMP IS GONE — ${loser} loses Pick 1!`)
      if (e.by >= 0) {
        if (e.by === koBy && e.t - koAt < 30 * 20) koStreak++
        else koStreak = 1
        koBy = e.by
        koAt = e.t
        lines.add(
          koStreak >= 2
            ? `${name(e.by)} throws out ${loser} — that's ${koStreak} eliminations. RAMPAGE!`
            : `${name(e.by)} launches ${loser} over the top rope. Pick ${e.pick} is settled.`,
        )
      } else {
        lines.add(`${loser} is gone — pick ${e.pick} is settled.`)
      }
      const count = idx + 1
      if (!halfSaid && count >= half) {
        halfSaid = true
        lines.add(`Half the picks are settled — ${n - count} managers still standing.`)
      }
      const alive = n - count
      if (alive === 3) lines.add(`THREE LEFT. It is anyone's draft.`)
      if (alive === 2) {
        const out = new Set(fight.elims.slice(0, count).map((x) => x.id))
        const pair = []
        for (let i = 0; i < n; i++) if (!out.has(i)) pair.push(fighters[i].short)
        lines.add(
          `FINAL TWO — ${pair[0]} and ${pair[1]} both find a second wind. Winner takes Pick 1.`,
        )
      }
    })
  }

  return [...lines]
}
