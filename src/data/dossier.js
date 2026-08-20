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
      org: 'PA-AI',
      place: 'Remote',
      role: 'Operations & Technical Program Coordinator',
      period: '2025 — Present',
      current: true,
      summary:
        'Strategic intelligence platform built on the Psycho-Aesthetics® methodology, positioned as a human intelligence layer for AI.',
      bullets: [
        'Own release quality for the staging platform: run structured QA passes, file and track defects to resolution, verify engineering fix claims against spec, and publish written summaries to engineering and leadership.',
        'Authored a 19-requirement specification with working reference implementations to remediate slide-deck export defects, and ran 15 graded audit rounds on generator output quality across briefs, reports, and HTML decks.',
        'Led a 642-issue backlog remediation in Linear alongside the product lead — triage, status normalization, ownership labeling, and a three-contract reconciliation workbook.',
        'Built the customer support infrastructure end to end: 29 help articles, an AI support agent trained on internal product material, a redesigned Help Center, and the canonical product vocabulary the content is written against.',
        'Stood up billing in Stripe across 12 products spanning subscription plans, student tiers, and one-time report packages, and built the pricing models and margin analysis behind them.',
        'Prototype product surfaces in single-file HTML for design and stakeholder review, including an evaluator view with a scoring radar chart, benchmark library, and export flow.',
        'Migrated the company website off Wix onto a fragment-based CMS, rebuilding the platform, case studies, media, and pricing pages; built out the CRM with a tag taxonomy and enrichment for 160+ contacts.',
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
    {
      org: 'Cattlemens Steakhouse',
      place: 'Petaluma, CA',
      role: 'Food Server',
      period: 'September 2022 — December 2024',
      bullets: [
        'Managed multiple concurrent tables in a fast-paced, high-pressure service environment, prioritizing by urgency.',
        'Coordinated with a large floor and kitchen team where clear, fast communication was the difference between a good and a bad service.',
      ],
    },
  ],

  skills: [
    { group: 'Languages', items: ['C', 'C++', 'Python', 'SQL', 'x86 Assembly', 'ARM Assembly'] },
    { group: 'Machine Learning', items: ['PyTorch', 'TensorFlow', 'Keras', 'scikit-learn', 'YOLOv8', 'OpenCV'] },
    { group: 'Data', items: ['Pandas', 'NumPy', 'Matplotlib', 'Jupyter', 'QGIS'] },
    { group: 'Systems & Tools', items: ['Unix', 'Git', 'Threads', 'CLion', 'Unreal Engine', 'Curses'] },
    {
      group: 'Product Operations',
      items: ['Linear', 'Intercom', 'Stripe', 'PostHog', 'Freshsales', 'Vercel'],
    },
  ],
}
