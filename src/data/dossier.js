/**
 * Dossier — the resume as structured, crawlable content.
 *
 * Phone number is intentionally omitted: this page is public and gets scraped.
 * Keep it on the PDF only.
 */
export const dossier = {
  updated: '2026',

  education: [
    {
      school: 'Sonoma State University',
      place: 'Rohnert Park, CA',
      degree: 'BS Computer Science',
      detail: 'GPA 3.5',
      period: '2020 — 2025',
      notes: ["Dean's List, 2022 — 2025"],
      coursework: [
        'Algorithms Analysis',
        'Data Structures',
        'Software Design and Development',
        'Programming Languages',
        'Operating Systems',
        'Theory of Computation',
        'Database Management Systems Design',
        'Computer Vision',
        'Quantum Computing',
        'Differential and Integral Calculus II',
      ],
    },
  ],

  experience: [
    {
      org: 'Eydora',
      place: 'Remote',
      role: 'Operations & Technical Program Coordinator',
      period: '2026 — Present',
      current: true,
      url: 'https://www.eydora.ai',
      summary:
        'A cognitive assistant that predicts product adoption, built on Ravi Sawhney\u2019s Psycho-Aesthetics\u00ae methodology across seven business disciplines. Rebranded from PA-AI in 2026.',
      bullets: [
        'Own release quality for the staging platform: run structured QA passes, file and track defects to resolution, verify engineering fix claims against spec, and publish written summaries to engineering and leadership.',
        'Designed the Eydora marketing site end to end for the PA-AI rebrand \u2014 every page, layout and interaction my own \u2014 and moved it off Wix onto a fragment-based CMS.',
        'Authored a 19-requirement specification with working reference implementations to remediate slide-deck export defects, and ran 15 graded audit rounds on generator output quality across briefs, reports, and HTML decks.',
        'Led a 642-issue backlog remediation in Linear alongside the product lead — triage, status normalization, ownership labeling, and a three-contract reconciliation workbook.',
        'Built the customer support infrastructure end to end: 29 help articles, an AI support agent trained on internal product material, a redesigned Help Center, and the canonical product vocabulary the content is written against.',
        'Stood up billing in Stripe across 12 products spanning subscription plans, student tiers, and one-time report packages, and built the pricing models and margin analysis behind them.',
        'Prototype product surfaces in single-file HTML for design and stakeholder review, including an evaluator view with a scoring radar chart, benchmark library, and export flow.',
        'Built out the CRM with a tag taxonomy and contact enrichment for 160+ contacts.',
      ],
    },
    {
      org: 'Modern Faith Works',
      place: 'California',
      role: 'Founder & Full-Stack Engineer',
      period: '2026 \u2014 Present',
      current: true,
      url: 'https://modernfaithworks.org',
      summary:
        'A registered 501(c)(3) non-profit documenting the history, art, and spirituality of Catholic churches, and shipping the app that does it.',
      bullets: [
        'Built and shipped a cross-platform Catholic church guide and prayer app: one React Native and Expo codebase serving iOS, Android, and web on a Node, Express, and MongoDB backend, bilingual with CI-enforced locale parity.',
        'Designed an autonomous nightly release train that promotes staging to production only through green CI, then verifies its own deploys by commit hash, bundle rotation, and over-the-air runtime assertions.',
        'Gated 1,200+ automated tests in GitHub Actions behind branch protection, with custom pull-request checks for accessibility, structured data, locale parity, and 3D tour geometry.',
        'Built programmatic SEO at scale: build-time prerendering of 17,000+ church pages with JSON-LD, city hub pages, and readable no-JS content, cutting the nearest-neighbor linking pass from 118s to 3.9s with a grid index.',
        'Shipped Stripe donations with idempotent webhook ingestion and an AI-assisted moderation queue for the public donor wall, alongside server-side moderation and report flows, per-admin accounts, and a durable audit log.',
        'Instrumented Sentry across web and native with environment separation, release health, and sourcemap uploads, wired to an alert relay that posts to chat and auto-files tickets.',
        'Founded the organization, serve as its Vice President, and am its sole engineer \u2014 every line of the platform, in production since June 2025.',
      ],
    },
    {
      org: 'NASA',
      place: 'UC Irvine, CA',
      role: 'Research Intern — Student Airborne Research Program',
      period: 'June 2024 — August 2024',
      summary:
        'Eight-week airborne science campaign analyzing atmospheric composition data collected aboard a NASA research aircraft.',
      bullets: [
        'Processed and analyzed large atmospheric datasets with Python, Matplotlib, Pandas, and NumPy, generating the visualizations that supported the research findings.',
        'Designed and executed an independent research project on VOC composition and ozone formation potential, automating the statistical comparison of VOC levels and OH reactivity between 2014 and 2022.',
        'Used QGIS for geospatial analysis, mapping VOC concentrations over Long Beach and integrating environmental data for trend analysis.',
        'Collaborated with interdisciplinary teams of students, scientists, and NASA personnel to interpret and present data-driven results, and presented at a professional symposium.',
        'Operated atmospheric instrumentation and supported field deployments measuring air composition and other environmental variables.',
      ],
    },
  ],

  skills: [
    {
      group: 'Languages',
      items: ['Python', 'TypeScript', 'JavaScript', 'C', 'C++', 'SQL', 'x86 Assembly'],
    },
    { group: 'Machine Learning', items: ['PyTorch', 'TensorFlow', 'Keras', 'scikit-learn', 'YOLOv8', 'OpenCV'] },
    { group: 'Data', items: ['Pandas', 'NumPy', 'Matplotlib', 'Jupyter', 'QGIS'] },
    {
      group: 'Web & Mobile',
      items: ['React', 'React Native', 'Expo', 'Node.js', 'Express', 'MongoDB', 'Redis'],
    },
    {
      group: 'Systems & Tools',
      items: ['Unix', 'Git', 'GitHub Actions', 'CI/CD', 'Sentry', 'Unreal Engine'],
    },
    {
      group: 'Product Operations',
      items: ['Linear', 'Intercom', 'Stripe', 'PostHog', 'Freshsales', 'Vercel'],
    },
  ],
}
