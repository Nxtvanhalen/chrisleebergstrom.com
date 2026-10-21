import DetailRow from './DetailRow';
import Reveal from './Reveal';
import SectionHeading from './SectionHeading';

const SKILLS = [
  {
    code: 'AI',
    label: 'AI & Data',
    detail:
      'LLM orchestration across Claude, Gemini, Grok, Deepseek, and local models. Model internals — tokenization, quantization, embeddings, inference tuning. Generative AI across image (Midjourney, Flux), voice (ElevenLabs, Whisper), music (Suno), and video (Runway). Custom Graph RAG, vector databases, persistent AI memory.',
  },
  {
    code: 'ENG',
    label: 'Engineering',
    detail:
      'Frontend (React, Next.js, TypeScript, Tailwind, Canvas/WebGL). Backend (Supabase + Postgres with RLS, Node/Bun, tRPC/REST/GraphQL, Python, Rust/Go). Edge performance (Cloudflare Workers, multi-region, offline-first). Security (OAuth, OWASP, bot defense). Infrastructure on Render and Cloudflare. CI/CD with Biome, type checks and automated tests.',
  },
  {
    code: 'LIVE',
    label: 'Industry Domain',
    detail:
      'Audio engineering and production tech — Pro Tools, Logic, Dante/AES67, SPL/RT60/FFT measurement, MIDI/OSC/DMX show control. Live entertainment operations — advancing, settlements, crew logistics, FOH engineering, stage management, ticketing, IATSE compliance, $10K–$1M+ productions, festivals at scale.',
  },
  {
    code: 'HUM',
    label: 'Business & Human',
    detail:
      "Product strategy and architecture trade-offs. Design and UX informed by Jakob's Law and iOS HIG. Contract negotiation, IP protection, revenue modeling. Technical and creative writing (including The Archivists). People leadership and live crisis management.",
  },
];

const EXPERT_DEPTH = [
  'LLM orchestration',
  'Model internals',
  'Generative AI',
  'Memory systems',
  'Audio production',
  'Live ops',
  'Product strategy',
];

export default function Skills() {
  return (
    <section
      id="skills"
      aria-labelledby="skills-heading"
      className="relative px-6 py-12 md:py-16 lg:py-20"
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeading id="skills-heading">Skills</SectionHeading>

        <Reveal
          as="p"
          duration={0.7}
          delay={0.2}
          className="font-body text-base md:text-lg max-w-3xl mt-6 leading-relaxed text-cream/78"
        >
          Twenty-five domains, seven at expert depth, fluent across the rest. Active in AI-native
          development since the GPT-2/3 era — four-plus years compounding through every model
          generation.
        </Reveal>

        <div className="mt-12 border-t border-white/10">
          {SKILLS.map((skill, i) => (
            <DetailRow key={skill.code} {...skill} delay={i * 0.05} />
          ))}
        </div>

        <Reveal
          margin="-60px"
          delay={0.25}
          className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] tracking-[0.25em] uppercase"
        >
          <span className="text-mauve">Expert depth ·</span>
          {EXPERT_DEPTH.map((item) => (
            <span key={item} className="text-white/70">
              {item}
            </span>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
