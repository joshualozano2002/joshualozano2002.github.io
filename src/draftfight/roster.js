/**
 * Fighter identities. Which manager draws which callsign is part of the fight's
 * randomness, so the assignment runs off the same seeded stream as the combat.
 */
import { makeRng, randInt, shuffle } from './rng.js'

const CALLSIGNS = [
  'VIPER', 'HAMMER', 'GHOST', 'RAZOR', 'TALON', 'BANDIT', 'REAPER', 'JACKAL',
  'COBRA', 'SLEDGE', 'WIDOW', 'HAVOC', 'BRUISER', 'OUTLAW', 'ANVIL', 'RIPTIDE',
  'MAULER', 'SABER', 'GRINDER', 'THUNDER', 'BLITZ', 'NOMAD', 'WRECKER', 'FANG',
  'IRONSIDE', 'STINGER', 'BULLDOG', 'CYCLONE', 'DAGGER', 'MAVERICK', 'SHRAPNEL', 'TITAN',
]

// Hues spaced around the wheel so sixteen fighters stay distinguishable at a
// glance. Plain hsl(), because these strings are handed straight to a canvas
// fillStyle and hsl() is the widest-supported colour syntax there.
const HUES = [
  28, 196, 145, 320, 62, 258, 8, 172, 100, 288, 44, 218, 128, 340, 80, 240,
]

// Everybody in the ring is a person, so the crowd of sprites should look like
// one. Tones and hair are drawn per-fighter from the seeded stream.
const SKINS = ['#f2c9a0', '#e6b184', '#cf9060', '#a96b40', '#7d4d2b', '#5d3a20']
const HAIRS = ['#15151d', '#2f2318', '#5c3016', '#8a6a2f', '#c7cdd6', '#7a2020']

/** Deterministic per-fighter identity: callsign, colour, and a jersey number. */
export function buildFighters(seed, managers) {
  const rng = makeRng(`${seed}:roster`)
  const calls = shuffle(rng, CALLSIGNS.slice())
  // The hue list is ordered so neighbours contrast; rotating it rather than
  // shuffling keeps that guarantee while still varying fight to fight.
  const spin = randInt(rng, HUES.length)

  return managers.map((name, i) => {
    const hue = HUES[(i + spin) % HUES.length]
    // Yellows read brighter than blues at the same lightness, so nudge each
    // band toward matching weight on the dark arena floor.
    const light = hue > 40 && hue < 150 ? 58 : hue > 200 && hue < 290 ? 68 : 63
    const skin = SKINS[randInt(rng, SKINS.length)]
    const color = `hsl(${hue} 82% ${light}%)`
    return {
      id: i,
      name,
      // What fits under a blip without colliding with the neighbours.
      short: name.split(/\s+/)[0].slice(0, 9).toUpperCase(),
      callsign: calls[i % calls.length],
      number: 1 + Math.floor(rng() * 98),
      hue,
      color,
      dim: `hsl(${hue} 40% ${Math.round(light * 0.42)}%)`,
      glow: `hsla(${hue}, 90%, ${light}%, 0.5)`,
      // Everything drawWrestler needs to put this manager in the ring.
      pal: {
        skin,
        shade: `hsl(${hue} 45% 26%)`,
        hair: HAIRS[randInt(rng, HAIRS.length)],
        hairStyle: randInt(rng, 5), // 0 bald · 1 short · 2 mohawk · 3 long · 4 headband
        trunks: color,
        boots: `hsl(${hue} 62% ${Math.round(light * 0.62)}%)`,
        band: `hsl(${hue} 90% 78%)`,
        gear: rng() < 0.35, // some wear a singlet instead of bare chest
      },
    }
  })
}
