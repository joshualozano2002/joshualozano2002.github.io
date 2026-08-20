/**
 * Campaign — the NASA SARP record.
 *
 * Aircraft identification is read directly off the tail in the ramp photo
 * (N426NA). Verify the airframe designation before quoting it anywhere formal.
 */
export const campaign = {
  program: 'NASA Student Airborne Research Program',
  short: 'NASA SARP',
  role: 'Research Intern',
  base: 'University of California, Irvine',
  aircraft: 'N426NA',
  start: 'June 2024',
  end: 'August 2024',

  title: 'VOC Composition and Ozone Formation Potential Observed Over Long Beach, California',

  summary:
    'Eight weeks flying, sampling, and analyzing atmospheric data with NASA scientists — culminating in an independent study of volatile organic compound composition and ozone formation potential over Long Beach.',

  brief: [
    'SARP puts undergraduates on a NASA research aircraft and then makes them do something real with what comes off it. The flights collect air composition data across Southern California; the ground work is field sampling at sites chosen for what they emit. Everything that follows is the unglamorous part — reconciling instrument output, deciding what is signal, and building a case you can defend to people who do this professionally.',
    'My independent project examined volatile organic compound composition and ozone formation potential over Long Beach. Ozone is not emitted directly — it forms when VOCs and nitrogen oxides react in sunlight, so the question is which compounds are present and how reactive they are. I automated the data handling and statistical work to compare VOC levels and OH reactivity between 2014 and 2022, then used QGIS to map concentrations geospatially across Long Beach and integrate them with other environmental data.',

    'Working with Pandas and NumPy on real instrument data is a different exercise from working with a clean CSV: the gaps, the calibration drift, and the units are the job. An eight-year comparison compounds that, because the two datasets were not collected to be compared with each other.',
    'The results were presented to interdisciplinary teams of students, scientists, and NASA personnel. Communicating a finding to someone who will immediately question your methodology sharpens the analysis more than any amount of solo iteration.',
  ],

  contributions: [
    'Processed and analyzed large atmospheric datasets in Python, producing the graphs and visualizations that supported the research findings',
    'Automated data handling and statistical calculations comparing VOC levels and OH reactivity between 2014 and 2022',
    'Mapped VOC concentrations over Long Beach in QGIS, integrating environmental data for trend analysis',
    'Presented results in a professional symposium',
    'Collaborated with interdisciplinary teams of students, scientists, and NASA personnel to interpret and present data-driven results',
    'Operated atmospheric instrumentation and supported field deployments measuring air composition and environmental variables',
  ],

  stack: ['Python', 'Pandas', 'NumPy', 'Matplotlib', 'QGIS'],

  readouts: [
    { k: 'Program', v: 'NASA SARP' },
    { k: 'Base', v: 'UC Irvine' },
    { k: 'Aircraft', v: 'N426NA' },
    { k: 'Duration', v: '8 weeks' },
    { k: 'Study area', v: 'Long Beach, CA' },
    { k: 'Comparison', v: '2014 vs 2022' },
  ],

  media: [
    {
      src: 'media/flight-deck.webp',
      w: 1800,
      h: 1350,
      caption: 'On the flight deck of N426NA, primary flight display and nav track live.',
      alt:
        'Joshua Lozano seated in the cockpit of a NASA research aircraft, with the primary flight display and a navigation tablet showing the flight track.',
    },
    {
      src: 'media/ramp-n426na.webp',
      w: 1800,
      h: 1350,
      caption: 'The SARP cohort on the ramp, N426NA behind.',
      alt:
        'The NASA SARP student cohort in safety vests standing on the tarmac in front of a NASA research aircraft, tail number N426NA.',
    },
    {
      src: 'media/field-sampling.webp',
      w: 1200,
      h: 1600,
      caption: 'Whole air sampling in the field, canister in hand.',
      alt:
        'Joshua Lozano holding a whole air sampling canister at a field site with mud formations under a clear sky.',
    },
  ],

  video: {
    src: 'media/flight-window.mp4',
    poster: 'media/flight-window-poster.webp',
    caption: 'Out the window, mid-campaign.',
  },

  links: [
    {
      label: 'Read the full report',
      href: 'media/NASA_Report.pdf',
      kind: 'doc',
      external: false,
    },
    {
      label: 'Watch the presentation',
      href: 'https://youtu.be/r7goASgymgY',
      kind: 'video',
      external: true,
    },
  ],
}
