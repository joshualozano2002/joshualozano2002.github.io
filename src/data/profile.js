export const profile = {
  name: 'Joshua Lozano',
  callsign: 'J. LOZANO',
  role: 'Operations & Technical Program Coordinator',
  focus: 'Backend systems, machine learning, and scientific data',
  location: 'California',

  // Current position, surfaced in the hero and the dossier header.
  current: {
    title: 'Operations & Technical Program Coordinator',
    org: 'PA-AI',
    since: '2025',
  },
  education: 'BS Computer Science, Sonoma State University',
  email: 'joshualozano2002@gmail.com',
  github: 'https://github.com/joshualozano2002',
  linkedin: 'https://www.linkedin.com/in/joshua-lozano7/',

  // One-line positioning, used in the hero and as the meta description base.
  tagline:
    'I build the layer underneath — interpreters, detection pipelines, and the data plumbing that turns raw measurement into something you can read.',

  // Annunciator strip on the home page. Each is a capability, lit or standby.
  systems: [
    { label: 'Backend', detail: 'Python · C++ · APIs', state: 'on' },
    { label: 'Machine Learning', detail: 'PyTorch · YOLOv8 · OpenCV', state: 'on' },
    { label: 'Languages & Compilers', detail: 'DFA · Recursive descent · AST', state: 'on' },
    { label: 'Scientific Data', detail: 'Pandas · NumPy · QGIS', state: 'on' },
    { label: 'Product Operations', detail: 'QA · Linear · Stripe · Intercom', state: 'on' },
  ],
}

export const nav = [
  { to: '/', label: 'Deck', code: 'DCK' },
  { to: '/missions', label: 'Missions', code: 'MSN' },
  { to: '/campaign', label: 'Campaign', code: 'CMP' },
  { to: '/dossier', label: 'Dossier', code: 'DSR' },
  { to: '/contact', label: 'Comms', code: 'COM' },
]
