import { writeFile, copyFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { missions } from '../src/data/missions.js'

const ORIGIN = 'https://joshualozano2002.github.io'

/**
 * Emitted after prerendering: a sitemap so crawlers can find every route,
 * a robots.txt pointing at it, a 404 fallback for GitHub Pages, and .nojekyll
 * so Pages serves the build verbatim instead of running it through Jekyll.
 */
export async function postbuild(dir, base = '/react-website-portfolio/') {
  const paths = [
    { p: '', priority: '1.0' },
    { p: 'missions', priority: '0.9' },
    ...missions.map((m) => ({ p: `missions/${m.slug}`, priority: '0.8' })),
    { p: 'campaign', priority: '0.9' },
    { p: 'dossier', priority: '0.7' },
    { p: 'contact', priority: '0.6' },
  ]

  const today = new Date().toISOString().slice(0, 10)
  const url = (p) => `${ORIGIN}${base}${p}${p ? '/' : ''}`

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths
  .map(
    ({ p, priority }) =>
      `  <url>\n    <loc>${url(p)}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${priority}</priority>\n  </url>`,
  )
  .join('\n')}
</urlset>
`

  const robots = `User-agent: *
Allow: /

Sitemap: ${ORIGIN}${base}sitemap.xml
`

  await writeFile(join(dir, 'sitemap.xml'), sitemap)
  await writeFile(join(dir, 'robots.txt'), robots)
  await writeFile(join(dir, '.nojekyll'), '')

  // GitHub Pages serves 404.html for anything it cannot resolve.
  const entries = await readdir(dir)
  if (entries.includes('index.html')) {
    await copyFile(join(dir, 'index.html'), join(dir, '404.html'))
  }

  console.log(`[postbuild] sitemap (${paths.length} urls), robots.txt, 404.html, .nojekyll`)
}
