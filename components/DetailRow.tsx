import Reveal from './Reveal';

// One ledger-style row — code | label | detail — used by the Method, Skills and
// History sections. Rows stack under a `border-t border-white/10` container.

type DetailRowProps = {
  code: string;
  label: string;
  /** Mono sub-label under the label (Method uses it for who drives each phase). */
  sub?: string;
  detail: string;
  delay?: number;
};

const LABEL = 'font-heading text-base md:text-lg uppercase tracking-tight text-white';

export default function DetailRow({ code, label, sub, detail, delay = 0 }: DetailRowProps) {
  return (
    <Reveal
      className="grid grid-cols-12 gap-4 py-6 border-b border-white/10"
      x={-10}
      margin="-60px"
      duration={0.55}
      delay={delay}
    >
      <p className="col-span-2 md:col-span-1 font-mono text-xs tracking-[0.3em] uppercase pt-1 text-mauve">
        {code}
      </p>
      {sub ? (
        <div className="col-span-10 md:col-span-3">
          <p className={LABEL}>{label}</p>
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/50 mt-1">
            {sub}
          </p>
        </div>
      ) : (
        <p className={`col-span-10 md:col-span-3 ${LABEL}`}>{label}</p>
      )}
      <p className="col-span-12 md:col-span-8 font-body text-base leading-relaxed text-cream/78">
        {detail}
      </p>
    </Reveal>
  );
}
