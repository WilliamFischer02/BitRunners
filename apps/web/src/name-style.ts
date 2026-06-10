// Account-only name styling (PR 79 of the polish push).
//
// Signed-in runners can pick a weight + tint preset that paints their
// floating name tag. Guests are locked to the default look (regular
// weight, plain text). Same versioned-blob localStorage pattern as
// economy / mission-progress-local so the choice persists across
// reloads. Style is broadcast via a CustomEvent so scene.ts can repaint
// the in-world player tag without reading from this module each frame.
//
// Tint presets — string keys, not arbitrary colors — so the visual
// vocabulary stays curated. The owner can extend the table without a
// schema change.

export type NameWeight = 'regular' | 'bold';
export type NameTint = 'none' | 'solid_mint' | 'solid_ember' | 'solid_iris' | 'gradient' | 'glow';

export interface NameStyle {
  v: 1;
  weight: NameWeight;
  tint: NameTint;
}

const STORAGE_KEY = 'bitrunners.name-style.v1';
const EVENT = 'bitrunners:name-style-changed';

function defaults(): NameStyle {
  return { v: 1, weight: 'regular', tint: 'none' };
}

function isStyle(x: unknown): x is NameStyle {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return o.v === 1 && typeof o.weight === 'string' && typeof o.tint === 'string';
}

function load(): NameStyle {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const parsed: unknown = JSON.parse(raw);
    if (!isStyle(parsed)) return defaults();
    return {
      v: 1,
      weight: parsed.weight === 'bold' ? 'bold' : 'regular',
      tint: TINTS.includes(parsed.tint as NameTint) ? parsed.tint : 'none',
    };
  } catch {
    return defaults();
  }
}

const TINTS: readonly NameTint[] = [
  'none',
  'solid_mint',
  'solid_ember',
  'solid_iris',
  'gradient',
  'glow',
];

let state: NameStyle = load();

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable — keep in-memory only
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: state }));
  } catch {
    // non-DOM env — ignore
  }
}

export function getNameStyle(): Readonly<NameStyle> {
  return state;
}

/** Public setter — caller is responsible for gating on signed-in state. */
export function setNameStyle(next: Partial<Omit<NameStyle, 'v'>>): void {
  state = {
    v: 1,
    weight: next.weight ?? state.weight,
    tint: next.tint ?? state.tint,
  };
  persist();
}

export function subscribeNameStyle(cb: (snap: Readonly<NameStyle>) => void): () => void {
  const handler = (): void => cb(state);
  window.addEventListener(EVENT, handler);
  cb(state);
  return () => window.removeEventListener(EVENT, handler);
}

/** Returns the class names to apply to the name span. Empty string when the
 *  caller is a guest (style should be regular regardless of stored state). */
export function nameStyleClass(style: Readonly<NameStyle>, signedIn: boolean): string {
  if (!signedIn) return '';
  const parts: string[] = [];
  if (style.weight === 'bold') parts.push('name--bold');
  if (style.tint !== 'none') parts.push(`name--${style.tint}`);
  return parts.join(' ');
}

export const NAME_TINT_OPTIONS: { value: NameTint; label: string }[] = [
  { value: 'none', label: 'plain' },
  { value: 'solid_mint', label: 'mint' },
  { value: 'solid_ember', label: 'ember' },
  { value: 'solid_iris', label: 'iris' },
  { value: 'gradient', label: 'gradient' },
  { value: 'glow', label: 'glow' },
];
