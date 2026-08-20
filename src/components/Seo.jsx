import { Head } from 'vite-react-ssg'
import { absUrl, withBase } from '../site'
import { profile } from '../data/profile'

/**
 * Per-route document head. Every prerendered page gets its own title,
 * description, canonical URL, and social card so crawlers see real metadata
 * instead of one shared shell.
 */
export default function Seo({ title, description, path = '/', image, type = 'website', jsonLd }) {
  const fullTitle = path === '/' ? title : `${title} · ${profile.name}`
  const url = absUrl(path)
  const img = `${absUrl('/')}/${(image ?? 'media/flight-deck.webp').replace(/^\//, '')}`.replace(
    /([^:]\/)\/+/g,
    '$1',
  )

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={`${profile.name} — Portfolio`} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={img} />

      <meta name="author" content={profile.name} />
      <meta name="robots" content="index, follow" />

      {jsonLd ? (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      ) : null}
    </Head>
  )
}

/** Person schema — helps search engines connect the name to the profiles. */
export const personSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: profile.name,
  url: absUrl('/'),
  image: `${absUrl('/')}/${'media/flight-deck.webp'}`.replace(/([^:]\/)\/+/g, '$1'),
  email: `mailto:${profile.email}`,
  jobTitle: profile.current.title,
  worksFor: { '@type': 'Organization', name: profile.current.org, url: 'https://pa-ai.ai' },
  description: profile.tagline,
  alumniOf: {
    '@type': 'CollegeOrUniversity',
    name: 'Sonoma State University',
  },
  knowsAbout: [
    'Backend development',
    'Machine learning',
    'Technical program management',
    'Product operations and QA',
    'Computer vision',
    'Compilers and interpreters',
    'Atmospheric data analysis',
  ],
  sameAs: [profile.github, profile.linkedin],
})
