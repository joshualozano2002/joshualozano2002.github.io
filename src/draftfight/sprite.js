/**
 * The wrestlers. Drawn procedurally as chunky pixel figures — no sprite sheets
 * to ship, and every fighter's look (skin, hair, gear, colours) comes off the
 * same seeded stream as the rest of the roster, so a fighter looks the same to
 * everyone who opens the link.
 *
 * All drawing happens in "pixel units" with the origin at the centre of the
 * feet and y pointing up the body (negative). The caller sets the scale by
 * passing u = world-units per pixel-unit, and flips `facing` to mirror.
 */

/** Soft dark puddle under a fighter; sells the depth more than anything else. */
export function drawShadow(ctx, rx, ry, alpha = 0.4) {
  ctx.beginPath()
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(0,0,0,${alpha})`
  ctx.fill()
}

/** A folding steel chair, ringside's favourite equalizer. */
export function drawChair(ctx, u = 3, held = false) {
  ctx.save()
  const r = (x, y, w, h, c) => {
    ctx.fillStyle = c
    ctx.fillRect(x * u, y * u, w * u, h * u)
  }
  if (held) {
    // Raised overhead, seen edge-on.
    r(-3.2, -1.2, 6.4, 1.3, '#aeb9c6')
    r(-3.2, -2.6, 1.1, 1.5, '#8792a1')
    r(2.1, -2.6, 1.1, 1.5, '#8792a1')
  } else {
    r(-2.6, -6.2, 5.2, 3.4, '#aeb9c6') // backrest
    r(-2.6, -3, 5.2, 1.1, '#8792a1') // seat
    r(-2.4, -1.9, 0.9, 1.9, '#6b7684') // legs
    r(1.5, -1.9, 0.9, 1.9, '#6b7684')
  }
  ctx.restore()
}

/**
 * @param pose 'idle' | 'walk' | 'punch' | 'hurt' | 'win' | 'ko'
 * @param frame integer animation clock; only its parity matters
 * @param facing 1 faces right, -1 faces left
 */
export function drawWrestler(ctx, pal, pose = 'idle', frame = 0, facing = 1, u = 3) {
  ctx.save()
  ctx.scale(facing, 1)
  const r = (x, y, w, h, c) => {
    ctx.fillStyle = c
    ctx.fillRect(x * u, y * u, w * u, h * u)
  }

  if (pose === 'ko') {
    // Flat on the floor, head to the left, done for the day.
    r(-8.2, -3.4, 1.2, 3.2, pal.hair)
    r(-7.6, -3.1, 3, 3.1, pal.skin)
    r(-4.6, -3.4, 4.6, 3.4, pal.gear ? pal.trunks : pal.skin)
    r(0, -3.4, 2.6, 3.4, pal.trunks)
    r(2.6, -2.7, 3.6, 1.6, pal.skin)
    r(6.2, -3, 1.9, 1.9, pal.boots)
    ctx.restore()
    return
  }

  const hop = pose === 'win' ? (frame % 2) * -1.2 : 0
  const bob = pose === 'idle' ? (frame % 2) * 0.3 : 0
  ctx.translate(0, (hop + bob) * u)
  const lean = pose === 'hurt' ? -0.9 : 0

  // Legs and boots. Walking swaps the stagger each frame.
  const sw = pose === 'walk' ? (frame % 2 ? 0.55 : -0.55) : 0
  r(-2 + sw, -4.8, 1.7, 3.2, pal.skin)
  r(0.3 - sw, -4.8, 1.7, 3.2, pal.skin)
  r(-2.1 + sw, -1.7, 1.9, 1.7, pal.boots)
  r(0.2 - sw, -1.7, 1.9, 1.7, pal.boots)

  // Trunks, torso (bare or singlet), waist shading.
  r(-2.5 + lean * 0.3, -7.5, 5, 2.8, pal.trunks)
  r(-2.6 + lean, -12.2, 5.2, 4.9, pal.gear ? pal.trunks : pal.skin)
  if (pal.gear) {
    // Singlet leaves the shoulders bare.
    r(-2.6 + lean, -12.2, 1, 1.2, pal.skin)
    r(1.6 + lean, -12.2, 1, 1.2, pal.skin)
  }
  r(-2.6 + lean, -8.7, 5.2, 1.2, pal.shade)

  // Arms, by pose. Wristbands carry the fighter's colour onto bare skin.
  if (pose === 'punch') {
    r(2.2 + lean, -11.6, 4.4, 1.5, pal.skin)
    r(5.6 + lean, -11.8, 0.9, 1.9, pal.band)
    r(6.5 + lean, -12, 1.7, 2.1, pal.skin)
    r(-3.6 + lean, -11.6, 1.3, 3.6, pal.skin)
    r(-3.7 + lean, -8.2, 1.5, 1.1, pal.band)
  } else if (pose === 'hurt') {
    r(-4 + lean, -14.5, 1.3, 4, pal.skin)
    r(2.7 + lean, -14.5, 1.3, 4, pal.skin)
    r(-4.1 + lean, -15, 1.5, 1, pal.band)
    r(2.6 + lean, -15, 1.5, 1, pal.band)
  } else if (pose === 'win') {
    r(-4.2, -16.6, 1.4, 5.2, pal.skin)
    r(2.8, -16.6, 1.4, 5.2, pal.skin)
    r(-4.3, -17.3, 1.6, 1.1, pal.band)
    r(2.7, -17.3, 1.6, 1.1, pal.band)
  } else {
    r(-3.7 + lean, -11.8, 1.3, 4.4, pal.skin)
    r(2.4 + lean, -11.8, 1.3, 4.4, pal.skin)
    r(-3.8 + lean, -7.9, 1.5, 1.1, pal.band)
    r(2.3 + lean, -7.9, 1.5, 1.1, pal.band)
  }

  // Head, hair, eyes. Eyes sit toward the facing side.
  r(-1.9 + lean, -16, 3.8, 3.9, pal.skin)
  const hx = lean
  if (pal.hairStyle === 1) {
    r(-1.9 + hx, -16.6, 3.8, 1.2, pal.hair)
  } else if (pal.hairStyle === 2) {
    r(-1.9 + hx, -16.5, 3.8, 1, pal.hair)
    r(-0.5 + hx, -18.3, 1, 2.4, pal.hair)
  } else if (pal.hairStyle === 3) {
    r(-1.9 + hx, -16.6, 3.8, 1.2, pal.hair)
    r(-2.3 + hx, -16, 0.9, 3, pal.hair)
    r(1.4 + hx, -16, 0.9, 3, pal.hair)
  } else if (pal.hairStyle === 4) {
    r(-1.9 + hx, -16.6, 3.8, 1.1, pal.hair)
    r(-1.9 + hx, -15.6, 3.8, 0.8, pal.band)
  }
  r(0.2 + hx, -15, 0.7, 0.7, '#10151c')
  r(1.1 + hx, -15, 0.7, 0.7, '#10151c')

  ctx.restore()
}
