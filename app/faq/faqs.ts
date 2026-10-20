// Single source of truth for the FAQ. FaqClient renders this list and
// app/faq/page.tsx derives the FAQPage JSON-LD from it, so the visible
// questions and the structured data can't drift apart again.
export interface FAQItem {
  question: string;
  answer: string;
  category?: string;
}

export const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'What do you actually do?',
    answer:
      "I'm an AI developer with 20 years in live entertainment. I build agentic software for venues, tours, and live events — front-of-house engineer turned full-stack developer, using AI agents as the build team.\n\nI still consult on venue operations, AI training, and web security when it is the right fit. But the center of gravity is the work: shipped products, working demos, and the software that runs live shows.\n\nDeeply human, deeply technical, allergic to performative innovation. The work speaks first.",
    category: 'About',
  },
  {
    question: 'How does the AI-native build process actually work?',
    answer:
      'Five phases, one orchestrator. I ideate and decide; agents type. Three to four parallel branches at a time. Claude Code is the primary build agent — runs the dev loop, commits, auto-fixes lint and CI failures. Codex reviews the work brutally with a signed report; that critique gets fed back to Claude. A third model breaks the echo chamber when needed.\n\nDeploys go through my approval gate. Sentry monitors live and loops runtime errors back to the build agent. Documentation is self-maintaining — CLAUDE.md and memories update themselves so the next session inherits accumulated knowledge.',
    category: 'Method',
  },
  {
    question: 'What does your operational consulting cover?',
    answer:
      "I analyze your entire operation from load-in to load-out — not just the stage, but everything that makes the show possible.\n\nThis includes staffing and labor optimization, safety and compliance audits, F&B and concessions flow, logistics and vendor coordination, marketing and booking strategies, and emergency preparedness. I've never cost a client more than I've saved them.\n\nIndustry standards recommend 10-20% contingency buffers. I help you keep that buffer as profit, not watch it disappear into preventable inefficiencies.",
    category: 'Operations',
  },
  {
    question: 'What AI education and training do you offer?',
    answer:
      'Practical AI training that cuts through the hype, drawn from years of agentic AI development in production. Ethics-first implementation, hands-on tool mastery, and AI workflows that actually serve your mission.\n\nTraining covers everything from foundational AI literacy for teams to advanced agentic and multi-modal integrations. AI that empowers the visionary, never replaces the artist.',
    category: 'AI Training',
  },
  {
    question: 'What security services do you offer?',
    answer:
      "Comprehensive web and app security including vulnerability assessments, penetration testing, security audits, and compliance guidance.\n\nProactive protection — identifying weaknesses before they become breaches. Whether you're launching a new platform or hardening existing infrastructure, the same precision that goes into live event safety applies here. Digital security is just another form of protecting your operation.",
    category: 'Security',
  },
  {
    question: "What's your approach to leadership and team building?",
    answer:
      "I treat culture as infrastructure. Leadership coaching isn't motivational speeches, and team building isn't pizza parties — it's designing systems where people feel seen, safe, and intellectually alive.\n\nMy approach includes 1:1 executive coaching, team development, and organizational culture design. Interdisciplinary by design — artists working with engineers, philosophers with coders. The goal: leaders who navigate pressure with clarity and teams that thrive on cross-pollination.",
    category: 'Leadership',
  },
  {
    question: 'What industries do you work with?',
    answer:
      'Core expertise spans entertainment, logistics, audio and acoustical analysis, and live events. But the systems-thinking approach translates across industries — anyone who values operational elegance over rigidity, and who understands that infrastructure is culture.',
    category: 'Industries',
  },
  {
    question: 'Do you work with small venues or only large productions?',
    answer:
      "I work across the full spectrum — from intimate 200-seat theaters to major festival productions. The principles of operational excellence scale in both directions.\n\nSmaller venues often benefit most from systematic thinking because they're running lean and can't afford waste. Larger productions need it because complexity compounds fast. Either way, the approach gets tailored to your scale, budget, and goals.",
    category: 'Scope',
  },
  {
    question: 'How do you handle project timelines and deliverables?',
    answer:
      'The precision of live event production — where there are no second chances. Frameworks built for velocity without sacrificing quality. Every project includes clear milestones, real-time communication, and adaptive strategies that evolve with your needs.',
    category: 'Process',
  },
  {
    question: "What's your background in entertainment and audio engineering?",
    answer:
      'Two decades of global live and studio experience. From backstage production to strategic operations — high-pressure environments with influential talent inform every strategic decision. Two decades of front-of-house and studio work, some of it credited, some of it not. Real named credits: The Dandy Warhols, Black Rebel Motorcycle Club, Macklemore.',
    category: 'Experience',
  },
  {
    question: 'How do you ensure cost efficiency for clients?',
    answer:
      "Holistic analysis no matter where the client starts. Honest, empathetic discovery of goals and dreams, then building from there. It's not just about cost saving — it's about thriving into the future.",
    category: 'ROI',
  },
  {
    question: 'Do you offer ongoing support after implementation?',
    answer:
      "Absolutely. I don't build systems and walk away — I make sure they thrive. Training, optimization, continuous improvement. Teams get empowered to maintain and evolve systems themselves.",
    category: 'Support',
  },
];
