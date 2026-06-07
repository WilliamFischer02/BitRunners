// Theme catalog + ASCII-pass hot-swap helper.
// Sub-Phase E: see docs/lore/013-themes-catalog.md for canon.
//
// terminal_green tint values match the scene's current hardcoded defaults so
// equipping the default theme produces no visible change. All other values are
// first-pass drafts pending owner review (lore 013 note).

import type { Uniform, Vector3 } from 'three';
import type { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export interface ThemeEntry {
  key: string;
  name: string;
  price: number;
  currency: 'credits' | 'tokens';
  tint: readonly [number, number, number];
  tintTop: readonly [number, number, number];
  background: readonly [number, number, number];
  blurb: string;
  /** If set, the buyer must have at least `factionMin` Samaritan in this
   *  faction. Verified server-side by purchase_theme RPC. */
  factionGate?: 'corporate' | 'bitrunner';
  factionMin?: number;
}

export const DEFAULT_THEME_KEY = 'terminal_green';

// ─── catalog ────────────────────────────────────────────────────────────────

export const THEME_CATALOG: readonly ThemeEntry[] = [
  {
    key: 'terminal_green',
    name: 'terminal_green',
    price: 0,
    currency: 'credits',
    // Exact values from the scene's hardcoded tint so no visual delta on equip.
    tint: [0.86, 0.93, 0.88],
    tintTop: [0.72, 0.5, 0.95],
    background: [0.025, 0.04, 0.035],
    blurb: 'The default phosphor look. Free for every runner.',
  },
  {
    key: 'amber_crt',
    name: 'amber_crt',
    price: 800,
    currency: 'credits',
    tint: [1.0, 0.753, 0.439],
    tintTop: [0.627, 0.439, 0.188],
    background: [0.039, 0.031, 0.02],
    blurb: '1970s VT220 / Apple ][ vibe. Soft amber.',
  },
  {
    key: 'paper_white',
    name: 'paper_white',
    price: 800,
    currency: 'credits',
    tint: [0.91, 0.902, 0.863],
    tintTop: [0.604, 0.596, 0.561],
    background: [0.11, 0.106, 0.094],
    blurb: 'Newsroom monochrome. Calm, restrained.',
  },
  {
    key: 'void_purple',
    name: 'void_purple',
    price: 1200,
    currency: 'credits',
    tint: [0.69, 0.486, 1.0],
    tintTop: [0.376, 0.251, 0.627],
    background: [0.031, 0.024, 0.055],
    blurb: 'BitRunner faction tribute. Requires +30 BitRunner Samaritan.',
    factionGate: 'bitrunner',
    factionMin: 30,
  },
  {
    key: 'corp_orange',
    name: 'corp_orange',
    price: 1200,
    currency: 'credits',
    tint: [1.0, 0.58, 0.314],
    tintTop: [0.627, 0.314, 0.11],
    background: [0.047, 0.031, 0.02],
    blurb: 'Company faction tribute. Requires +30 Corporate Samaritan.',
    factionGate: 'corporate',
    factionMin: 30,
  },
  {
    key: 'null_blue',
    name: 'null_blue',
    price: 1500,
    currency: 'credits',
    tint: [0.486, 0.753, 1.0],
    tintTop: [0.188, 0.376, 0.627],
    background: [0.024, 0.035, 0.055],
    blurb: 'server_speaker palette. Cool and remote.',
  },
  {
    key: 'signal_red',
    name: 'signal_red',
    price: 2,
    currency: 'tokens',
    tint: [1.0, 0.439, 0.376],
    tintTop: [0.627, 0.157, 0.188],
    background: [0.047, 0.024, 0.024],
    blurb: 'Aggressive. Feels like an active alarm. Token-gated.',
  },
  {
    key: 'aether_drift',
    name: 'aether_drift',
    price: 5,
    currency: 'tokens',
    tint: [0.816, 0.847, 1.0],
    tintTop: [0.439, 0.502, 0.753],
    background: [0.016, 0.02, 0.039],
    blurb: 'Drifting cold-light. Top-tier. Matches the aether badge tier.',
  },
];

export function getTheme(key: string): ThemeEntry {
  return THEME_CATALOG.find((t) => t.key === key) ?? (THEME_CATALOG[0] as ThemeEntry);
}

// ─── pass hot-swap ───────────────────────────────────────────────────────────

function setUniform(pass: ShaderPass, name: string, r: number, g: number, b: number): void {
  const u = pass.uniforms[name] as Uniform<Vector3> | undefined;
  if (u) u.value.set(r, g, b);
}

/**
 * Hot-swaps the three tint uniforms on an existing AsciiPass.
 * No-ops if key is empty (keeps whatever the scene hardcoded).
 * Safe to call every frame — only mutates the uniform values, no
 * material/pass re-creation.
 */
export function applyThemeToPass(pass: ShaderPass, key: string): void {
  if (!key) return;
  const t = getTheme(key);
  setUniform(pass, 'uTint', ...t.tint);
  setUniform(pass, 'uTintTop', ...t.tintTop);
  setUniform(pass, 'uBackground', ...t.background);
}
