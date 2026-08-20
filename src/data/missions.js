/**
 * Missions — the project record.
 *
 * `readouts` are instrument-panel facts: only things that are verifiably true
 * about the build. Add measured numbers (mAP, dataset size, throughput) as you
 * collect them rather than estimating.
 */
export const missions = [
  {
    slug: 'wildfire-classifier',
    index: '01',
    callsign: 'EMBER',
    title: 'Wildfire Classifier',
    domain: 'Computer Vision',
    year: '2025',
    course: 'CS470 — Computer Vision (Capstone)',
    accent: 'amber',
    diagram: 'detection',
    summary:
      'A YOLOv8 detection pipeline that finds fire and smoke in mountain camera footage and classifies the threat it is looking at.',
    brief: [
      'Wildfire cameras produce far more footage than anyone can watch. The useful signal — a smoke column forming on a ridge — shows up as a handful of frames buried in hours of empty landscape, and it shows up before there is any visible flame. The problem is a detection problem before it is a classification one.',
      'This capstone adapts YOLOv8 into a multi-class detector trained on California mountain video, separating fire from smoke rather than collapsing both into a single "wildfire" label. That distinction matters operationally: smoke without fire is an early warning, and the two classes look nothing alike to a detector — one is bright and high-contrast, the other is diffuse, low-contrast, and easily confused with fog or haze.',
      'The engineering weight sits in the data, not the model. Wildfire datasets are heavily imbalanced — negatives vastly outnumber positives — and the positive frames vary wildly with weather and time of day. Getting inference to run efficiently over continuous video, rather than on a folder of curated stills, was a separate problem again.',
    ],
    stack: ['Python', 'YOLOv8', 'PyTorch', 'OpenCV'],
    systems: [
      'Real-time detection of fire and smoke in continuous video',
      'Multi-class classification across varying weather conditions',
      'Integration with California mountain camera footage',
    ],
    hazards: [
      'Adapting YOLOv8 from single-class to multi-class fire and smoke detection',
      'Training against a limited and heavily imbalanced dataset',
      'Running inference efficiently over video rather than curated stills',
    ],
    readouts: [
      { k: 'Model', v: 'YOLOv8' },
      { k: 'Classes', v: 'Fire · Smoke' },
      { k: 'Input', v: 'Video' },
      { k: 'Framework', v: 'PyTorch' },
    ],
  },
  {
    slug: 'bnf-interpreter',
    index: '02',
    callsign: 'BABEL',
    title: 'C-like Language Interpreter',
    domain: 'Languages & Compilers',
    year: '2024',
    course: 'CS460 — Programming Languages',
    accent: 'cyan',
    diagram: 'ast',
    summary:
      'A complete interpreter for a C-like language defined in Backus-Naur Form, built from the raw character stream up to a running program.',
    brief: [
      'Most people who say they understand how a language works have used a parser generator. This one was built by hand, in five phases, with nothing between the source text and the running program that was not written from scratch.',
      'It starts with a deterministic finite state automaton that walks the character stream, strips C and C++ style comments, and emits tokens. A recursive descent parser turns those tokens into a Concrete Syntax Tree, enforcing the BNF grammar as it goes. The CST is then reduced to an Abstract Syntax Tree stored as a Left-Child, Right-Sibling binary tree — a representation that makes an n-ary tree walkable with two pointers per node.',
      'A linked-list symbol table tracks variables, functions, and scope so identifiers resolve correctly across nested blocks. Finally a recursive execution engine traverses the AST, evaluates arithmetic and Boolean expressions in postfix form, and executes statements. Each phase had to be correct before the next one could exist, which is the actual lesson of building a compiler front-to-back.',
    ],
    stack: ['C++', 'DFA', 'Recursive Descent', 'LCRS Trees'],
    systems: [
      'Lexical analysis and comment removal via a hand-built DFA tokenizer',
      'Recursive descent parser producing a grammar-checked Concrete Syntax Tree',
      'CST reduced to an AST in Left-Child, Right-Sibling representation',
      'Linked-list symbol table for variable, function, and scope resolution',
      'Recursive execution engine with postfix expression evaluation',
    ],
    hazards: [
      'Designing a DFA that handles comments, strings, and operators without backtracking',
      'Keeping recursive descent unambiguous against the BNF grammar',
      'Correct scope resolution across nested blocks in a flat symbol table',
      'Evaluating mixed arithmetic and Boolean expressions in the right order',
    ],
    readouts: [
      { k: 'Phases', v: '5' },
      { k: 'Lexer', v: 'DFA' },
      { k: 'Parser', v: 'Recursive descent' },
      { k: 'Tree', v: 'LCRS' },
    ],
  },
  {
    slug: 'html-tag-parser',
    index: '03',
    callsign: 'NEST',
    title: 'HTML Tag Parser & Validator',
    domain: 'Data Structures',
    year: '2024',
    course: 'CS315 — Data Structures',
    accent: 'magenta',
    diagram: 'stack',
    summary:
      'A C++ parser that validates HTML tag nesting with a traversable stack and reports exactly where and why a document is malformed.',
    brief: [
      'Tag matching is the canonical stack problem, but the interesting part is not detecting that a document is broken — it is telling the user something useful about how. A validator that says "invalid" is worthless; one that says "line 47 closes </div> but the innermost open tag is <span> from line 44" is a tool.',
      'A custom tokenizer breaks the input into open tags, close tags, and standalone tags. A TagParser pushes opens onto a TraversableStack and matches closes against the top, using a mapping of valid tag pairs to distinguish a genuine mismatch from a self-closing tag that never needed a partner.',
      'The stack is traversable rather than opaque precisely so the error reporter can walk the open-tag context at the moment a mismatch is found, which is what makes the line-numbered diagnostics possible.',
    ],
    stack: ['C++', 'Stacks', 'Tokenization'],
    systems: [
      'Tokenizer splitting input into open, close, and standalone tags',
      'TagParser enforcing correct nesting via a TraversableStack',
      'Tag-pair mapping to handle self-closing and void elements',
      'Line-numbered error reporting with expected-tag context',
    ],
    hazards: [
      'Distinguishing genuine mismatches from legitimately self-closing tags',
      'Preserving enough stack context to report a useful error',
      'Keeping parsing efficient on large documents',
    ],
    readouts: [
      { k: 'Structure', v: 'TraversableStack' },
      { k: 'Language', v: 'C++' },
      { k: 'Output', v: 'Line-numbered errors' },
    ],
  },
  {
    slug: 'maze-solver',
    index: '04',
    callsign: 'KRUSKAL',
    title: 'The Maze Project',
    domain: 'Algorithms',
    year: '2024',
    course: 'CS315 — Data Structures',
    accent: 'annunciator',
    diagram: 'maze',
    summary:
      'A C++ maze generator and solver built on Kruskal\u2019s algorithm and Union-Find, with dynamic weighting and a console visualization.',
    brief: [
      'A perfect maze — one where every cell is reachable and exactly one path connects any two points — is a spanning tree in disguise. Treat each cell as a vertex and each wall as a candidate edge, weight the edges randomly, and the minimum spanning tree is the maze.',
      'This build represents the grid as an adjacency list and runs Kruskal\u2019s algorithm over it, using a Union-Find structure to decide whether an edge joins two disconnected regions or would close a cycle. Cycle detection is the whole game: accept every edge and you get an open field, reject too many and the maze disconnects.',
      'Varying the weight assignment changes the character of the output — long winding corridors versus dense braided junctions — so the generator exposes multiple patterns rather than one fixed style. A console-based renderer draws the result and the solved path, which turned out to be the fastest way to actually debug the generation logic.',
    ],
    stack: ['C++', 'Kruskal\u2019s Algorithm', 'Union-Find', 'MST'],
    systems: [
      'Graph representation of the maze grid via adjacency lists',
      'Kruskal\u2019s algorithm building a minimum spanning tree for generation',
      'Union-Find for efficient cycle detection during edge selection',
      'Multiple generation patterns driven by dynamic weight assignment',
      'Console-based visualization of the maze and solved path',
    ],
    hazards: [
      'Getting Union-Find cycle detection right so the maze is connected but acyclic',
      'Tuning weight assignment to produce genuinely different maze characters',
      'Rendering a graph structure legibly in a terminal',
    ],
    readouts: [
      { k: 'Algorithm', v: 'Kruskal MST' },
      { k: 'Structure', v: 'Union-Find' },
      { k: 'Graph', v: 'Adjacency list' },
    ],
  },
  {
    slug: 'flight-deck',
    index: '05',
    callsign: 'DECK',
    title: 'This Site',
    domain: 'Web',
    year: '2026',
    course: 'Independent',
    accent: 'sky',
    diagram: 'route',
    summary:
      'A statically prerendered React site built as an instrument panel, shipped from a GitHub Action at zero hosting cost.',
    brief: [
      'A portfolio that takes four seconds to show its first pixel is worse than no portfolio. The previous version of this site held a full-screen loader for 3.7 seconds before rendering anything, then ran another 1.3-second transition on every navigation. It also used hash routing, which meant search engines saw a single empty shell.',
      'This rebuild prerenders every route to real HTML at build time, so a crawler — or a visitor on a bad connection — receives complete, readable content with no JavaScript required. React hydrates on top for the interactive instrumentation. Each route carries its own title, description, canonical URL, and structured data.',
      'The visual system is drawn rather than photographed: the attitude indicator, altitude tape, and mission diagrams are all inline SVG, which keeps them sharp at any resolution and costs a fraction of what an image would. The whole thing deploys from a GitHub Action to GitHub Pages, and every part of the stack is free.',
    ],
    stack: ['React 19', 'Vite', 'Tailwind v4', 'Static prerendering'],
    systems: [
      'Every route prerendered to crawlable static HTML',
      'Per-route metadata, canonical URLs, sitemap, and JSON-LD',
      'Instrumentation drawn as inline SVG, not images',
      'Zero-cost deploy via GitHub Actions to GitHub Pages',
    ],
    hazards: [
      'Making a React SPA fully crawlable without a paid rendering service',
      'Keeping the instrument aesthetic legible and accessible, not just decorative',
      'Cutting first-paint from several seconds to near-instant',
    ],
    readouts: [
      { k: 'Rendering', v: 'Static prerender' },
      { k: 'Hosting cost', v: '$0' },
      { k: 'Routes', v: 'All crawlable' },
    ],
  },
]

export const missionBySlug = (slug) => missions.find((m) => m.slug === slug)
