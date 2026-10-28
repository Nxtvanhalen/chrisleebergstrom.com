import { describe, expect, test } from 'bun:test';
import {
  BRIEF_TRUNCATED_NOTE,
  composeSystemPrompt,
  EVE_PERSONA,
  formatToday,
  MAX_BRIEF_CHARS,
  sanitizeBrief,
} from '../../lib/eve-prompt';

// 2026-10-28T03:30:00Z is still the evening of the 27th in Portland.
const LATE_EVENING_PACIFIC = new Date('2026-10-28T03:30:00Z');

describe('formatToday', () => {
  test('renders the date in Pacific time, weekday and month spelled out', () => {
    expect(formatToday(LATE_EVENING_PACIFIC)).toBe('Tuesday, October 27, 2026');
    expect(formatToday(new Date('2026-10-28T17:00:00Z'))).toBe('Wednesday, October 28, 2026');
  });

  test('honours an explicit time zone', () => {
    expect(formatToday(LATE_EVENING_PACIFIC, 'UTC')).toBe('Wednesday, October 28, 2026');
  });
});

describe('sanitizeBrief', () => {
  test('normalises line endings, strips NUL bytes and trims', () => {
    expect(sanitizeBrief('  # Brief\r\n\r\nline\rtwo\u0000  \n')).toBe('# Brief\n\nline\ntwo');
  });

  test('leaves a brief under the cap untouched', () => {
    const text = 'x'.repeat(MAX_BRIEF_CHARS);
    expect(sanitizeBrief(text)).toBe(text);
  });

  test('caps an oversize brief and says so at the end', () => {
    const text = 'y'.repeat(MAX_BRIEF_CHARS + 5000);
    const result = sanitizeBrief(text);
    expect(result.length).toBe(MAX_BRIEF_CHARS);
    expect(result.endsWith(BRIEF_TRUNCATED_NOTE)).toBe(true);
  });
});

describe('composeSystemPrompt', () => {
  const today = new Date('2026-10-28T17:00:00Z');

  test('orders persona, date, brief, context; each block once', () => {
    const prompt = composeSystemPrompt({
      brief: '# EVE Brief\n\nLast updated: 2026-10-28\n\n- Beacons is the main build.',
      today,
      context: 'Projects',
    });
    const at = (needle: string) => {
      const index = prompt.indexOf(needle);
      expect(index).toBeGreaterThanOrEqual(0);
      return index;
    };
    expect(prompt.startsWith('You are EVE')).toBe(true);
    expect(at('[TODAY]\nToday is Wednesday, October 28, 2026 (Pacific time).')).toBeGreaterThan(
      at('You are EVE'),
    );
    expect(at('[CURRENT BRIEF]\n# EVE Brief')).toBeGreaterThan(at('[TODAY]'));
    expect(at('[END BRIEF]')).toBeGreaterThan(at('Beacons is the main build.'));
    expect(at('[CURRENT CONTEXT]\nThe visitor is on the "Projects" page')).toBeGreaterThan(
      at('[END BRIEF]'),
    );
    for (const marker of ['[TODAY]', '[CURRENT BRIEF]', '[END BRIEF]', '[CURRENT CONTEXT]']) {
      expect(prompt.split(marker)).toHaveLength(2);
    }
  });

  test('omits the context block when the client sent none', () => {
    const prompt = composeSystemPrompt({ brief: 'b', today, context: null });
    expect(prompt).not.toContain('[CURRENT CONTEXT]');
    expect(prompt.endsWith('[END BRIEF]')).toBe(true);
  });

  test('sanitises the brief it is given', () => {
    const prompt = composeSystemPrompt({ brief: '  line\r\n\u0000two  ', today, context: null });
    expect(prompt).toContain('[CURRENT BRIEF]\nline\ntwo\n[END BRIEF]');
  });

  test('the persona carries the rules the brief depends on', () => {
    expect(EVE_PERSONA).toContain('NO GUESSING');
    expect(EVE_PERSONA).toContain('WHAT YOU NEVER DISCUSS');
    expect(EVE_PERSONA).toContain('chrisleebergstrom@gmail.com');
    expect(EVE_PERSONA).toContain('Never claim a Grammy nomination');
    // Project facts belong in the brief, not here, so the two can't drift.
    expect(EVE_PERSONA).not.toContain('beaconsio.com');
    expect(EVE_PERSONA).not.toContain('firstlyte.co');
    // No project names either: which project leads is the brief's call.
    expect(EVE_PERSONA).not.toMatch(/Beacons|Byte|Underground|Fuel Estimator|Chester/);
    expect(EVE_PERSONA).not.toContain('`');
  });
});
