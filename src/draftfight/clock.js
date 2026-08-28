/**
 * A shared clock for live fights.
 *
 * "Live" here means every viewer's playback is anchored to the same epoch
 * moment. Device clocks are usually NTP-true to well under a second, but one
 * badly skewed phone would watch a different minute of the fight, so on load
 * we ask our own host what time it is: a HEAD request to the current page and
 * the response's Date header. Same-origin, no API, works on GitHub Pages.
 *
 * The Date header is truncated to the second, so we centre the error with
 * +500ms and split the round trip. Good to roughly ±1s — tighter sync between
 * two living rooms than actual live television manages.
 */
let offset = 0

export async function syncClock() {
  try {
    const t0 = Date.now()
    const res = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' })
    const t1 = Date.now()
    const server = Date.parse(res.headers.get('date'))
    if (!Number.isNaN(server)) offset = server + 500 + (t1 - t0) / 2 - t1
  } catch {
    // Offline or blocked: fall back to the device clock.
  }
}

/** Skew-corrected wall clock, epoch ms. */
export const sharedNow = () => Date.now() + offset
