// The live, public projects — rendered by components/ProjectCard on the home
// page ("Selected Work") and on /projects ("Live"). One record per project so
// the two pages can't drift apart.

export type Project = {
  title: string;
  kind: string;
  href: string;
  stat: string;
  blurb: string;
  image: {
    src: string;
    alt: string;
    /** `cover` fills the frame; `contain` letterboxes logos and brand sheets. */
    fit: 'cover' | 'contain';
    /** Sit the (transparent) artwork on a soft violet radial glow. */
    glow?: boolean;
  };
};

const PROJECTS = {
  underground: {
    title: 'The Underground',
    kind: 'Venue-management sim',
    href: 'https://underground-venue-manager.onrender.com',
    stat: 'Live · Browser game',
    blurb:
      'Run a small underground music venue — book bands, keep the crew right, dodge incidents, balance the books. A PNW dive-bar sim in cyberpunk-noir. Twenty years of running venues, turned into a game.',
    image: {
      src: '/images/COVER.jpg',
      alt: 'The Underground — cyberpunk-noir illustration of a neon-lit dive bar with crowd queued under rain, branded marquee, and venue facade',
      fit: 'cover',
    },
  },
  byte: {
    title: 'Byte',
    kind: 'AI assistant over email',
    href: 'https://firstlyte.co',
    stat: 'Live · firstlyte.co',
    blurb:
      'An AI assistant that lives in your inbox. Email byte@firstlyte.co, get a thoughtful reply in under 30 seconds — no app, no login, no account. Handles attachments, remembers threads, routes to the right model.',
    image: {
      src: '/images/ByteEdit.jpeg',
      alt: 'Byte — AI assistant over email; brand sheet showing the BYTE wordmark, the B logo, and the prioritize / understand / remember / act process flow',
      fit: 'contain',
    },
  },
  chester: {
    title: 'Chester',
    kind: 'AI chess study',
    href: 'https://chesterchess.com',
    stat: 'Live · chesterchess.com',
    blurb:
      'An AI chess game built in public to explore decision-making architecture and game theory. Powered by Deepseek so the consumer version stays free.',
    image: {
      src: '/images/CHESTER.png',
      alt: 'Chester — chibi robot king with chess pieces, AI Chess Coach wordmark',
      fit: 'contain',
      glow: true,
    },
  },
  fuelEstimator: {
    title: 'Fuel Estimator',
    kind: 'Tour-bus fuel calculator',
    href: 'https://fuel-estimator.onrender.com',
    stat: 'Live · fuel-estimator.onrender.com',
    blurb:
      'A tour-bus fuel cost calculator for the road. Estimate fuel spend across routes, miles, and price-per-gallon so budgets hold up before the wheels roll. The arithmetic every tour manager does on a napkin — turned into a clean, shareable tool.',
    image: {
      src: '/images/projects/fuel-estimator.png',
      alt: 'Fuel Estimator — tour-bus fuel cost calculator logo with a fuel pump, gauge, and mountain road',
      fit: 'contain',
      glow: true,
    },
  },
  beacons: {
    title: 'Beacons',
    kind: 'SPL & acoustic monitoring',
    href: 'https://beaconsio.com',
    stat: 'Live · beaconsio.com',
    blurb:
      'iPhone-based SPL and acoustic monitoring for live events. Cloud-based logging, real-time analysis, and predictive insight. Protects patrons and staff; keeps neighbors and regulators happy. Operated by Christopher Lee Bergstrom (CLB Consulting).',
    image: {
      src: '/images/projects/beacons.png',
      alt: 'Beacons — iPhone-based SPL and acoustic monitoring dashboard for live events',
      fit: 'cover',
    },
  },
} satisfies Record<string, Project>;

/** Home page "Selected Work" — the spine. */
export const FEATURED_PROJECTS: Project[] = [
  PROJECTS.underground,
  PROJECTS.byte,
  PROJECTS.beacons,
  PROJECTS.fuelEstimator,
];

/** /projects "Live" — everything shipped and public. */
export const LIVE_PROJECTS: Project[] = [
  PROJECTS.underground,
  PROJECTS.byte,
  PROJECTS.chester,
  PROJECTS.fuelEstimator,
  PROJECTS.beacons,
];

/** Two-digit index for card eyebrows: 0 → "01". */
export const cardCode = (index: number) => String(index + 1).padStart(2, '0');
