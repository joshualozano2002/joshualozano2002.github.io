# Flight Deck — joshualozano.dev

Portfolio for Joshua Lozano, built as an aircraft instrument panel. The metaphor
is not decoration: the design is drawn from photographs taken aboard NASA
research aircraft N426NA during the 2024 Student Airborne Research Program.

## Why it is built this way

**Every route is prerendered to static HTML.** The previous version was a
client-rendered SPA behind a 3.7 second loader, using hash routing — search
engines saw one empty shell and visitors saw a spinner. This version renders
each route to real HTML at build time, so crawlers and no-JS visitors get
complete, readable content. React hydrates on top for the live instrumentation.

**Nothing in the stack costs money.** Static files on GitHub Pages, built by
GitHub Actions, fonts from Google Fonts. No server, no database, no paid tier.

## Stack

| Concern    | Choice                                      |
| ---------- | ------------------------------------------- |
| Build      | Vite 7                                      |
| Prerender  | `vite-react-ssg` (one HTML file per route)  |
| UI         | React 19 + React Router 6                   |
| Styling    | Tailwind CSS v4 (CSS-first `@theme` tokens) |
| Animation  | CSS transitions + IntersectionObserver      |
| Deploy     | GitHub Actions → GitHub Pages               |

There is no animation library. Scroll reveals are progressive enhancement: the
markup renders **visible**, a bootstrap script in `<head>` adds a `js` class,
and only then may CSS hide a block so it can animate in. If JavaScript never
runs, everything is still on screen.

## Commands

```bash
npm install
npm run dev      # dev server
npm run build    # prerender to dist/
npm run preview  # serve the build locally
```

> `npm run preview` uses an SPA fallback and will serve the home page for every
> route. That is a quirk of the preview server, not the build — inspect
> `dist/<route>/index.html` to see what actually ships.

## Deploying

Pushing to `master` runs `.github/workflows/deploy.yml`, which builds and
publishes to GitHub Pages. Enable it once under **Settings → Pages → Source →
GitHub Actions**.

`BASE_PATH` controls the path the site is served from. The workflow sets it to
`/<repo-name>/` for a project page. If you move to a user page
(`joshualozano2002.github.io`) or a custom domain, set it to `/` and update
`SITE_ORIGIN` in `src/site.js`.

## Where the content lives

All copy is data, not markup — edit these rather than the components:

- `src/data/profile.js` — name, tagline, contact, capability strip
- `src/data/missions.js` — the five project records
- `src/data/campaign.js` — the NASA SARP record
- `src/data/dossier.js` — the resume, as structured content

## Adding a mission

Append a record to `src/data/missions.js`. The route, the card, the sitemap
entry, and the prerendered page are all generated from it. Set `diagram` to one
of the keys in `src/components/Diagrams.jsx`, or add a new figure there.

## Media

Source photographs are 2.5–7.6 MB straight off a phone. `public/media/` holds
WebP conversions roughly 20× smaller. Regenerate with:

```bash
cwebp -q 78 -resize 1800 0 input.jpeg -o public/media/output.webp
```

## Notes

- The phone number on the PDF resume is deliberately absent from the HTML
  version; this page is public and gets scraped.
- Aircraft registration `N426NA` is read directly off the tail in the ramp
  photograph. Verify the airframe designation before quoting it formally.
