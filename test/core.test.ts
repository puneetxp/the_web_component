// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { localDate, when } from '../src/core/the-element';
import { THEME_CSS } from '../src/core/theme';

describe('core helpers', () => {
  it('when() formats a date and is empty for missing or bad input', () => {
    expect(when('2026-11-23T10:07:00Z')).toMatch(/23/);
    expect(when(null)).toBe('');
    expect(when('not a date')).toBe('');
  });

  it('localDate() uses the local calendar day, not the UTC one', () => {
    // 00:30 local on 24 Nov is still 23 Nov in UTC for any zone east of UTC.
    expect(localDate(new Date(2026, 10, 24, 0, 30))).toBe('2026-11-24');
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('components can shrink to a narrow parent and stay readable in dark mode', () => {
    expect(THEME_CSS).toContain('min-width: 0');
    expect(THEME_CSS).toContain('--the-link-dark');
    expect(THEME_CSS).toContain('--the-good-dark');
  });
});
