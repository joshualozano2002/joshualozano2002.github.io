/**
 * Christmas list, carried as a cargo manifest.
 *
 * `low` and `high` are the numbers the payload totals are computed from, so
 * a range stays a range instead of collapsing to a guess. An item with no
 * price is carried as unknown mass and excluded from the bar entirely —
 * inventing a figure for it would make the total look more certain than it is.
 *
 * `display` is what the row prints, because a promotional price and a target
 * sale price are not the same claim even when they are both one number.
 */
export const christmas = {
  year: 2026,
  // Local midnight on the 25th. Parsed as parts, not a string, so the
  // countdown lands on Christmas in the reader's timezone rather than UTC.
  day: { y: 2026, m: 12, d: 25 },

  items: [
    {
      id: 'CL-01',
      name: 'Anker Nano 100W 7-in-1 Charging Station',
      spec: 'Black · 100W shared · 7 ports',
      note: 'One brick on the desk instead of five. Enough headroom to run a laptop and still have ports left over.',
      display: '$79.99',
      status: 'Listed',
      tone: 'green',
      low: 79.99,
      high: 79.99,
      href: 'https://a.co/d/000M3TFG',
      source: 'Amazon',
    },
    {
      id: 'CL-02',
      name: 'Premium ceramic Tesla window tint',
      spec: 'Ceramic film · full vehicle',
      note: 'Ceramic rather than dyed — the kind that actually keeps the heat out instead of just going dark. Price moves with coverage and which shop does it.',
      display: '$400 – $900',
      status: 'Range',
      tone: 'amber',
      low: 400,
      high: 900,
    },
    {
      id: 'CL-03',
      name: 'Alienware AW3225QF 32" QD-OLED',
      spec: 'Curved 4K · 240Hz · QD-OLED',
      note: 'Promotional price, so the window matters more than the date. Worth checking before buying at list.',
      display: '$699.99',
      status: 'Promo price',
      tone: 'red',
      low: 699.99,
      high: 699.99,
      href: 'https://www.dell.com/en-us/shop/Monitors/apd/Alienware-32-4K-QD-OLED-Gaming-Monitor---AW3225QF/aw3225qf_monitor/-?tfcid=33163968',
      source: 'Dell',
    },
    {
      id: 'CL-04',
      name: 'PowerSpec G457 Gaming PC',
      spec: 'RTX 5070 Ti · Core Ultra 7 265KF · 32GB DDR5 · 2TB SSD',
      note: 'The figure here is the sale price to wait for, not the sticker. Micro Center runs it down periodically.',
      display: '$1,899.99',
      status: 'Target sale',
      tone: 'amber',
      low: 1899.99,
      high: 1899.99,
      href: 'https://www.microcenter.com/product/698930/powerspec-g457-gaming-pc',
      source: 'Micro Center',
    },
    {
      id: 'CL-05',
      name: 'Dolby Atmos TV surround system',
      spec: 'Height channels · model open',
      note: 'Proper height channels rather than a soundbar doing an impression of them. Still deciding on the configuration, so nothing to price yet.',
      display: 'TBD',
      status: 'Unpriced',
      tone: 'mute',
      low: null,
      high: null,
    },
  ],
}

/** Priced items only — the ones that can legitimately carry a total. */
export const pricedItems = christmas.items.filter((i) => i.low != null)

export const totals = {
  low: pricedItems.reduce((sum, i) => sum + i.low, 0),
  high: pricedItems.reduce((sum, i) => sum + i.high, 0),
  open: christmas.items.length - pricedItems.length,
}
