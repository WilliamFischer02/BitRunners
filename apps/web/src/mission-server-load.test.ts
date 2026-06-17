import { describe, expect, it } from 'vitest';
import { type ReconciledProgress, reconcileServerProgress } from './mission-server-load.js';
import type { MissionProgress } from './supabase.js';

// Smoke coverage for the objective-persistence fix (task 4.1). The reconcile
// function is the heart of "a returning player loads exactly the state they
// left, and completed objectives stay complete forever". A second load is
// simulated by feeding the same server rows again and asserting the derived
// state is identical and never regresses.

const CHAIN = ['m1', 'm2', 'm3'] as const;

function row(
  state: MissionProgress['state'],
  lastCheckpoint: number,
  faction: MissionProgress['factionChoice'] = null,
): MissionProgress {
  return { state, lastCheckpoint, factionChoice: faction, updatedAt: '2026-06-16T00:00:00Z' };
}

describe('reconcileServerProgress', () => {
  it('fresh user (no server rows) → first mission active at checkpoint 0', () => {
    const out = reconcileServerProgress(CHAIN, { m1: null, m2: null, m3: null });
    expect(out).toEqual<ReconciledProgress>({
      completed: [],
      factions: {},
      active: 'm1',
      nextIdx: 0,
      activeState: 'active',
    });
  });

  it('mid-mission → resumes exact checkpoint on reload', () => {
    const rows = { m1: row('active', 2), m2: null, m3: null };
    const first = reconcileServerProgress(CHAIN, rows);
    expect(first.active).toBe('m1');
    expect(first.nextIdx).toBe(2);
    expect(first.activeState).toBe('active');
    // Second load must be identical — no reset to checkpoint 0.
    const second = reconcileServerProgress(CHAIN, rows);
    expect(second).toEqual(first);
  });

  it('completed objectives stay complete and the next one becomes active', () => {
    const rows = {
      m1: row('complete', 3, 'bitrunner'),
      m2: row('active', 1),
      m3: null,
    };
    const out = reconcileServerProgress(CHAIN, rows);
    expect(out.completed).toEqual(['m1']);
    expect(out.factions).toEqual({ m1: 'bitrunner' });
    expect(out.active).toBe('m2');
    expect(out.nextIdx).toBe(1);
  });

  it('completed objective is never re-locked when a new one starts', () => {
    // Simulate: m1 done, then start m2. m1 must remain in completed across
    // both loads — this is the exact greying-out / re-lock bug.
    const afterM1 = { m1: row('complete', 3, 'corporate'), m2: null, m3: null };
    const load1 = reconcileServerProgress(CHAIN, afterM1);
    expect(load1.completed).toContain('m1');
    expect(load1.active).toBe('m2');

    const afterM2Started = { m1: row('complete', 3, 'corporate'), m2: row('active', 0), m3: null };
    const load2 = reconcileServerProgress(CHAIN, afterM2Started);
    expect(load2.completed).toContain('m1'); // still complete
    expect(load2.active).toBe('m2');
  });

  it('final state (last checkpoint reached, not chosen) is preserved', () => {
    const rows = { m1: row('final', 3), m2: null, m3: null };
    const out = reconcileServerProgress(CHAIN, rows);
    expect(out.active).toBe('m1');
    expect(out.activeState).toBe('final');
    expect(out.nextIdx).toBe(3);
  });

  it('chain cleared → nothing active', () => {
    const rows = {
      m1: row('complete', 3, 'bitrunner'),
      m2: row('complete', 3, 'corporate'),
      m3: row('complete', 3, 'bitrunner'),
    };
    const out = reconcileServerProgress(CHAIN, rows);
    expect(out.completed).toEqual(['m1', 'm2', 'm3']);
    expect(out.active).toBeNull();
    expect(out.activeState).toBe('inactive');
  });
});
