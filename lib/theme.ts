// Brand colour for the few places CSS can't reach. The token itself lives in
// styles/global.css (`--color-mauve`); in JSX prefer the Tailwind utilities —
// text-mauve, border-mauve/50, bg-mauve, text-cream/82 — and import from here only
// when the value is consumed outside the cascade:
//   - canvas drawing (IndexClient's circuit network)
//   - motion animation targets, and the base colour of anything motion animates.
//     motion reads the start value from computed style, and Tailwind's `/opacity`
//     modifiers compute to `oklab(…)`, which motion cannot parse, so an animated
//     border has to start from an rgba() value set inline.

export const MAUVE = '#9370db';

/** The brand violet as `rgba()` at the given alpha (0–1). */
export const mauve = (alpha = 1) => `rgba(147, 112, 219, ${alpha})`;
