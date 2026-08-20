/**
 * Renders the resume PDF from the same data the website uses.
 *
 * The previous PDF drifted out of sync with the site because it was authored
 * separately. This reads src/data/*.js directly, so `npm run resume` always
 * produces a document that agrees with /dossier.
 *
 * Print is a tighter medium than the web page: the site can be exhaustive,
 * a resume should stay on one page. BULLET_CAPS trims each role to its most
 * important points, which is why bullets are ordered by importance in the data.
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { profile } from '../src/data/profile.js'
import { dossier } from '../src/data/dossier.js'
import { missions } from '../src/data/missions.js'

const run = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// Per-organisation bullet caps, keyed by org name.
const BULLET_CAPS = { 'PA-AI': 4, 'Modern Faith Works': 3, NASA: 3 }

// Projects worth print space, in order.
const PROJECT_SLUGS = ['modern-faith-works', 'wildfire-classifier', 'bnf-interpreter']

// Phone is intentionally absent: this PDF is served from a public URL, so it
// is exactly as scrapeable as the HTML page. Add it for direct applications.
const CONTACT = [
  { text: profile.email, href: `mailto:${profile.email}` },
  { text: 'joshualozano2002.github.io', href: 'https://joshualozano2002.github.io' },
  { text: 'github.com/joshualozano2002', href: profile.github },
  { text: 'linkedin.com/in/joshua-lozano7', href: profile.linkedin },
]

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(profile.name)} — Resume</title>
<style>

  @page { size: Letter; margin: 0.4in 0.5in; }

  :root {
    --ink: #14181d;
    --muted: #4a545f;
    --faint: #6b7783;
    --rule: #c8d0d8;
    --accent: #9a5b12;   /* print-safe counterpart to the site's amber */
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    /* A locally installed family, deliberately. Chrome rasterises @font-face
       web fonts into Type3 glyph programs when printing, which some resume
       parsers cannot read; system fonts embed as real TrueType instead. */
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: var(--ink);
    font-size: 8.9pt;
    line-height: 1.25;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  a { color: inherit; text-decoration: none; }

  header { margin-bottom: 9pt; }

  h1 {
    font-size: 19.5pt;
    font-weight: 700;
    letter-spacing: -0.015em;
    line-height: 1.05;
  }

  .role {
    margin-top: 2.5pt;
    font-size: 9.6pt;
    font-weight: 600;
    color: var(--accent);
  }

  .contact {
    margin-top: 4.5pt;
    font-size: 8.5pt;
    color: var(--muted);
  }
  .contact span + span::before { content: '  ·  '; color: var(--rule); }

  h2 {
    font-size: 8.3pt;
    font-weight: 700;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: var(--accent);
    border-bottom: 0.7pt solid var(--rule);
    padding-bottom: 2.5pt;
    margin: 8pt 0 4.5pt;
  }

  .entry { margin-bottom: 6pt; break-inside: avoid; }
  .entry:last-child { margin-bottom: 0; }

  .line {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12pt;
  }

  .org { font-size: 10.2pt; font-weight: 700; }
  .where { font-size: 8.4pt; color: var(--faint); white-space: nowrap; }
  .title { font-size: 9.2pt; font-weight: 500; color: var(--muted); font-style: italic; }
  .when { font-size: 8.4pt; color: var(--faint); white-space: nowrap; }

  .blurb { margin-top: 2.5pt; font-size: 8.6pt; color: var(--faint); }

  ul { margin: 3.5pt 0 0; padding-left: 10.5pt; list-style: none; }
  li { position: relative; margin-bottom: 1.8pt; }
  li::before {
    content: '';
    position: absolute;
    left: -8.5pt;
    top: 4.4pt;
    width: 2.6pt;
    height: 2.6pt;
    background: var(--accent);
    border-radius: 50%;
  }

  .proj { margin-bottom: 3.4pt; break-inside: avoid; }
  .proj-name { font-weight: 700; }
  .proj-stack { color: var(--faint); font-size: 8.4pt; }
  .proj-desc { color: var(--muted); }

  .skills { display: grid; grid-template-columns: 1fr 1fr; gap: 2.6pt 16pt; }
  .skill { font-size: 8.8pt; color: var(--muted); break-inside: avoid; }
  .skill b { color: var(--ink); font-weight: 700; }

  .course { margin-top: 3pt; font-size: 8.5pt; color: var(--muted); }
  .course b { color: var(--ink); font-weight: 700; }
</style>
</head>
<body>

<header>
  <h1>${esc(profile.name)}</h1>
  <div class="role">${esc(profile.current.title)} · ${esc(profile.current.org)}  ·  ${esc(
    profile.affiliation.role,
  )}, ${esc(profile.affiliation.org)}</div>
  <div class="contact">${CONTACT.map(
    (c) => `<span><a href="${c.href}">${esc(c.text)}</a></span>`,
  ).join('')}</div>
</header>

<h2>Experience</h2>
${dossier.experience
  .map((e) => {
    const cap = BULLET_CAPS[e.org] ?? e.bullets.length
    return `<div class="entry">
  <div class="line"><span class="org">${esc(e.org)}</span><span class="where">${esc(
      e.place,
    )}</span></div>
  <div class="line"><span class="title">${esc(e.role)}</span><span class="when">${esc(
      e.period,
    )}</span></div>
  ${e.summary && e.org !== 'NASA' ? `<div class="blurb">${esc(e.summary)}</div>` : ''}
  <ul>${e.bullets
    .slice(0, cap)
    .map((b) => `<li>${esc(b)}</li>`)
    .join('')}</ul>
</div>`
  })
  .join('')}

<h2>Selected Projects</h2>
${PROJECT_SLUGS.map((slug) => {
  const m = missions.find((x) => x.slug === slug)
  if (!m) return ''
  return `<div class="proj"><span class="proj-name">${esc(m.title)}</span><span class="proj-stack"> · ${esc(
    m.stack.slice(0, 4).join(', '),
  )}</span> <span class="proj-desc">— ${esc(m.summary)}</span></div>`
}).join('')}

<h2>Education</h2>
${dossier.education
  .map(
    (ed) => `<div class="entry">
  <div class="line"><span class="org">${esc(ed.school)}</span><span class="where">${esc(
      ed.place,
    )}</span></div>
  <div class="line"><span class="title">${esc(ed.degree)} · ${esc(
      ed.detail,
    )}</span><span class="when">${esc(ed.period)}</span></div>
  ${ed.notes.map((n) => `<div class="blurb">${esc(n)}</div>`).join('')}
  <div class="course"><b>Relevant coursework:</b> ${esc(ed.coursework.slice(0, 6).join(', '))}.</div>
</div>`,
  )
  .join('')}

<h2>Skills</h2>
<div class="skills">
${dossier.skills
  .map((g) => `<div class="skill"><b>${esc(g.group)}:</b> ${esc(g.items.join(', '))}</div>`)
  .join('\n')}
</div>

</body>
</html>
`

const outDir = join(root, 'public', 'media')
const tmpHtml = join(root, '.resume.tmp.html')
const pdf = join(outDir, 'Joshua-Lozano-Resume.pdf')

await mkdir(outDir, { recursive: true })
await writeFile(tmpHtml, html)

await run(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--no-pdf-header-footer',
  '--virtual-time-budget=8000',
  `--print-to-pdf=${pdf}`,
  `file://${tmpHtml}`,
])

console.log(`[resume] wrote ${pdf}`)
