// Absolute origin + path the site is served from. Used for canonical URLs,
// Open Graph tags, sitemap, and JSON-LD — all of which need absolute URLs.
// Set VITE_SITE_ORIGIN in the deploy workflow when moving to a custom domain.
export const SITE_ORIGIN =
  import.meta.env.VITE_SITE_ORIGIN ?? 'https://joshualozano2002.github.io'
export const BASE = import.meta.env.BASE_URL // '/react-website-portfolio/' or '/'

/** Join the base path onto a relative asset/route path. */
export const withBase = (p = '') => `${BASE}${String(p).replace(/^\//, '')}`

/**
 * Absolute URL for a route path like '/missions'.
 *
 * Always ends in a slash: static hosts serve `/missions/index.html` at
 * `/missions/` and 301 the slashless form to it, so the canonical must be the
 * slashed version or it points at a redirect.
 */
export const absUrl = (routePath = '/') => {
  const path = withBase(String(routePath).replace(/^\//, ''))
  return `${SITE_ORIGIN}${path.endsWith('/') ? path : `${path}/`}`
}
