// Absolute origin + path the site is served from. Used for canonical URLs,
// Open Graph tags, sitemap, and JSON-LD — all of which need absolute URLs.
export const SITE_ORIGIN = 'https://joshualozano2002.github.io'
export const BASE = import.meta.env.BASE_URL // '/react-website-portfolio/' or '/'

/** Join the base path onto a relative asset/route path. */
export const withBase = (p = '') => `${BASE}${String(p).replace(/^\//, '')}`

/** Absolute URL for a route path like '/missions'. */
export const absUrl = (routePath = '/') => {
  const clean = String(routePath).replace(/^\//, '')
  return `${SITE_ORIGIN}${withBase(clean)}`.replace(/\/$/, '') || SITE_ORIGIN
}
