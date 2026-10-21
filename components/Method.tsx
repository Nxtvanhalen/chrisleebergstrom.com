import DetailRow from './DetailRow';
import Reveal from './Reveal';
import SectionHeading from './SectionHeading';

const PHASES = [
  {
    code: '01',
    label: 'Ideate',
    sub: 'I orchestrate',
    detail:
      'Brainstorm, Socratic dialogue, multi-model research (Gemini for breadth, Grok for speed, Claude for depth), decision gate. Open questions get explored by multiple models; I evaluate the options and choose the approach.',
  },
  {
    code: '02',
    label: 'Build',
    sub: 'Claude Code as primary agent',
    detail:
      'Full context loaded — CLAUDE.md, design docs, memories. Three to four parallel branches at once. The agent writes code, runs the dev loop, commits, catches Biome/CI errors and auto-fixes without human intervention.',
  },
  {
    code: '03',
    label: 'Verify',
    sub: 'Adversarial gauntlet',
    detail:
      "Biome, type checks and automated tests in CI as the quality floor. Codex reviews the same repo with instructions to be brutal — signs every report. Critique gets fed back to Claude: 'what do you think of this?' A third model breaks the echo chamber when needed.",
  },
  {
    code: '04',
    label: 'Deploy',
    sub: 'I approve the diff',
    detail:
      'My eyes on the delta before merge. The agent triggers Render deploys via MCP — services, cron jobs, workers. Sentry monitors live; runtime errors loop back to the build agent for patches.',
  },
  {
    code: '05',
    label: 'Maintain',
    sub: 'Living docs, self-maintaining',
    detail:
      'Agents update their own CLAUDE.md. Periodic drift checks against architecture specs. Every failure becomes a better instruction. Memory plus git plus persistent context equals seamless continuity across machines and sessions.',
  },
];

const MODEL_ROLES = [
  ['Claude', 'builds'],
  ['Codex', 'adversary'],
  ['Gemini · Grok', 'research'],
  ['Deepseek', 'cost'],
  ['Local', 'privacy'],
];

export default function Method() {
  return (
    <section
      id="method"
      aria-labelledby="method-heading"
      className="relative px-6 py-12 md:py-16 lg:py-20"
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeading id="method-heading">Method</SectionHeading>

        <div className="mt-8 border-t border-white/10">
          {PHASES.map((phase, i) => (
            <DetailRow key={phase.code} {...phase} delay={i * 0.05} />
          ))}
        </div>

        <Reveal
          margin="-60px"
          delay={0.3}
          className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] tracking-[0.25em] uppercase"
        >
          <span className="text-mauve">Model roles ·</span>
          {MODEL_ROLES.map(([model, role]) => (
            <span key={model} className="text-white/70">
              <span className="text-mauve">{model}</span> {role}
            </span>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
