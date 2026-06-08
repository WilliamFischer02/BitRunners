// Tiny adapter for HTMLDialogElement that plays the ASCII dissolve at
// open + close. Used by AdminConsole, Samm, UsernameEditor, AdminDialogue,
// MissionDialogue in Phase 5 so all modal surfaces share the same
// transition vocabulary as the boot→game seam (Phase 4).
//
// Usage:
//   const dialog = dialogRef.current;
//   if (!dialog) return;
//   openWithDissolve(dialog);
//   // ... later, when the user closes:
//   closeWithDissolve(dialog, () => setOpen(false));
//
// Honors prefers-reduced-motion via the underlying playDissolve.

import { playDissolve } from './dissolve.js';

const SHORT = 240;

/** Show the dialog and overlay a brief dissolve. */
export function openWithDissolve(dialog: HTMLDialogElement): void {
  if (typeof dialog.showModal === 'function' && !dialog.open) {
    dialog.showModal();
  }
  // playDissolve reads bounding rect, so wait one frame so the dialog has
  // its real layout (showModal centers on the next paint).
  requestAnimationFrame(() => {
    playDissolve(dialog, 'in', { durationMs: SHORT, cell: 10 });
  });
}

/** Run the close dissolve, then invoke the supplied callback (which should
 *  flip the React state that owns the modal mount). */
export function closeWithDissolve(dialog: HTMLDialogElement, onClose: () => void): void {
  playDissolve(dialog, 'out', { durationMs: SHORT, cell: 10 }, onClose);
}
