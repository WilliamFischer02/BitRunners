// The Admin's "transmission" face — hand-authored ASCII frames in the style
// of docs/references/01-ascii-glitch-face.* (dissolving pointillist face,
// hard black/white). Right side of the face is solid; the left dissolves
// into scatter + tiny hex/error fragments.
//
// 5 frames, 44 cols x 24 rows. Only the mouth region (3 rows) varies:
//   F0 rest (closed, calm) . F1 parted . F2 half . F3 open . F4 wide
// Rendered into a <pre> via textContent (see TransmissionFace.tsx) — these
// strings must stay monospace-safe (single-cell glyphs only).

const HEAD = `  ·:    0xC4      ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
 ░  ·  :  +  ▄▄▓████████████████████▄▄
:  ERR3F ░ ▄▓████████████████████████▓▄
 ·  ░ ·░ ▄▓████████████████████████████▄
  ░· ▒ ░▒████████████████████████████████
 ·  ░▒░▒▓███████████████████████████████▓
: 0x1B ░▒███████▓▓▓▓████████████▓▓▓▓█████
 · ░ ▒░▓██████▓░  ╳ ▒██████████░ ╳  ▓████
  ·  ░ ▒▓█████▓▄▄▄▄▓██████████▓▄▄▄▄██████
 ░:  · ░▒███████████████████████████████▓
·  *▒░ ░▓██████████████▓▓▓████████████▓██
 ·░  ▒ ░▒█████████████▓ ▒▒ ▓█████████████
:  · ░▒ ▒▓████████████▓▄▄▄▄▓████████████▓
 0xF3 ░ ░▒██████████████████████████████▓`;

const TAIL = ` ·  ░ ▒░▒▓█████████████████████████████▓
  :· ░ ░▒▓████████████████████████████▓
 · +  ▒░ ░▒▓█████████████████████████▓░
░ ·:  ░  ░▒▓▓████████████████████▓▓░
 · ERR  ·  ░░▒▓▓████████████▓▓▒░░
  ░  ·  :  *  ·░░▒▒▒▒▒▒▒▒░░·
 ·    ░    ·      ····`;

const MOUTHS: string[] = [
  // F0 — rest: mouth closed, calm
  `: ·  ░ ░▒████████████▀▀▀▀▀▀▀▀████████████
 ░ · ▒ ░▓████████████████████████████████
 ·  ░ ░▒▓███████████████████████████████▓`,
  // F1 — parted
  `: ·  ░ ░▒████████████▀▀▀▀▀▀▀▀████████████
 ░ · ▒ ░▓███████████▓▄▄▄▄▄▄▄▄▓███████████
 ·  ░ ░▒▓███████████████████████████████▓`,
  // F2 — half open
  `: ·  ░ ░▒███████████▓░      ░▓███████████
 ░ · ▒ ░▓███████████▓▄▄▄▄▄▄▄▄▓███████████
 ·  ░ ░▒▓███████████████████████████████▓`,
  // F3 — open
  `: ·  ░ ░▒███████████▓        ▓███████████
 ░ · ▒ ░▓███████████▒  ░░░░  ▒███████████
 ·  ░ ░▒▓███████████▓▄▄▄▄▄▄▄▄▓██████████▓`,
  // F4 — wide
  `: ·  ░ ░▒██████████▓░        ░▓██████████
 ░ · ▒ ░▓██████████░  ░▒▒▒▒░  ░██████████
 ·  ░ ░▒▓██████████▓▄▄▄▄▄▄▄▄▄▄▓█████████▓`,
];

export const FACE_FRAMES: string[] = MOUTHS.map((mouth) => `${HEAD}\n${mouth}\n${TAIL}`);

/** Mouth rove while The Admin is "speaking": F0→1→2→3→4→3→1→… */
export const FACE_ROVE: number[] = [0, 1, 2, 3, 4, 3, 1];

/** ms per rove step — deliberately low-framerate, like a bad uplink. */
export const FACE_FRAME_MS = 170;

/** ms between single-row glitch displacements while speaking. */
export const FACE_GLITCH_MS = 1200;

/**
 * Return `frame` with one row horizontally displaced (rotated by a few
 * cells) — the "signal tears for a moment" effect. Pure; no allocation
 * beyond the returned string (called at most ~1/s).
 */
export function glitchFrame(frame: string, row: number, shift: number): string {
  const rows = frame.split('\n');
  const r = rows[row % rows.length];
  if (r === undefined || r.length < 4) return frame;
  const s = ((shift % r.length) + r.length) % r.length;
  rows[row % rows.length] = r.slice(s) + r.slice(0, s);
  return rows.join('\n');
}
