import { describe, expect, it } from 'vitest';
import { fmtCompact } from './economy.js';

// Counters must stay legible to a trillion and beyond (devlog 0143).
describe('fmtCompact', () => {
  it('covers every tier up through trillions', () => {
    expect(fmtCompact(0)).toBe('0');
    expect(fmtCompact(999)).toBe('999');
    expect(fmtCompact(1_000)).toBe('1.0k');
    expect(fmtCompact(250_000)).toBe('250k');
    expect(fmtCompact(1_500_000)).toBe('1.5M');
    expect(fmtCompact(2_000_000_000)).toBe('2.0B');
    expect(fmtCompact(1_000_000_000_000)).toBe('1.00T');
    expect(fmtCompact(1_230_000_000_000)).toBe('1.23T');
  });
  it('is safe on garbage input', () => {
    expect(fmtCompact(Number.NaN)).toBe('0');
    expect(fmtCompact(-5)).toBe('0');
  });
});
