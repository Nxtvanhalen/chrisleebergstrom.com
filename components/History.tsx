import DetailRow from './DetailRow';
import Reveal from './Reveal';
import SectionHeading from './SectionHeading';

const CREDITS = [
  {
    code: 'FOH',
    label: 'Front of House',
    detail:
      'The Dandy Warhols. Black Rebel Motorcycle Club. Macklemore. Arenas, festivals, and civic halls.',
  },
  {
    code: 'TM',
    label: 'Tour Management',
    detail:
      'International touring. Routing, advancing, settling. The work that decides whether the show even reaches the stage.',
  },
  {
    code: 'TD',
    label: 'Technical Direction',
    detail:
      'Venue operations and production direction. Two decades of front-of-house and studio work — some of it credited, some of it not.',
  },
  {
    code: '20Y+',
    label: 'Span',
    detail: 'Twenty-plus years building live shows. Now building the software that runs them.',
  },
];

export default function History() {
  return (
    <section
      id="history"
      aria-labelledby="history-heading"
      className="relative px-6 py-12 md:py-16 lg:py-20"
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeading id="history-heading">History</SectionHeading>

        <Reveal
          as="p"
          duration={0.7}
          delay={0.2}
          className="font-body text-lg md:text-xl max-w-3xl mt-8 leading-relaxed text-white"
        >
          The road came first. Front of house, tour management, technical direction — the credits
          are the reason the software is any good.
        </Reveal>

        <div className="mt-12 border-t border-white/10">
          {CREDITS.map((credit, i) => (
            <DetailRow key={credit.code} {...credit} delay={i * 0.05} />
          ))}
        </div>
      </div>
    </section>
  );
}
