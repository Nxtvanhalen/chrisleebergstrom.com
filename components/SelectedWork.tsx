import Link from 'next/link';
import { cardCode, FEATURED_PROJECTS } from '@/lib/projects';
import ProjectCard from './ProjectCard';
import Reveal from './Reveal';
import SectionHeading from './SectionHeading';

export default function SelectedWork() {
  return (
    <section
      id="work"
      aria-labelledby="work-heading"
      className="relative px-6 py-12 md:py-16 lg:py-20"
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeading id="work-heading">Selected Work</SectionHeading>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
          {FEATURED_PROJECTS.map((project, i) => (
            <ProjectCard
              key={project.title}
              code={cardCode(i)}
              project={project}
              variant="featured"
            />
          ))}
        </div>

        <Reveal margin="-60px" delay={0.3} className="mt-10 flex justify-center md:justify-end">
          <Link
            href="/projects"
            className="group inline-flex items-center gap-2 font-mono text-[10px] md:text-xs tracking-[0.3em] uppercase text-white/70 transition-colors hover:text-white"
          >
            <span>See the full workshop</span>
            <span
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-1 text-mauve"
            >
              →
            </span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
