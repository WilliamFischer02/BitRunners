import { useEffect, useRef, useState } from 'react';
import {
  MINIMAP_ANCHORS,
  getMinimapRemotes,
  getMinimapTick,
  onMinimapTick,
} from './minimap-state.js';
import { getActiveCheckpointAnchor, subscribeMissionChanges } from './missions.js';

// Floating top-right HUD minimap — starmap-projection style.
// PR 85: phone legibility pass.
//   • Larger marker shapes that still read at 96–132 px.
//   • Per-anchor full-name labels instead of 2-letter abbreviations.
//   • Compass N/E/S/W glyphs around the edge so orientation never feels lost.
//   • Live x,z coordinate readout in the bottom-left corner.
//   • Tap-to-expand: opens a 2x larger overlay where details + labels are
//     comfortably readable on a phone screen.

const MAP_RANGE = 22; // world units of half-extent the minimap covers
const PLATFORM_HALF = 19;
const PLATFORM_SIZE = PLATFORM_HALF * 2;

// Wrap delta into (-PLATFORM_HALF, +PLATFORM_HALF] — same logic as scene.ts.
function wrapDelta(v: number): number {
  if (v > PLATFORM_HALF) return v - PLATFORM_SIZE;
  if (v < -PLATFORM_HALF) return v + PLATFORM_SIZE;
  return v;
}

interface AnchorRender {
  x: number;
  z: number;
  label: string;
  tint: string;
}

const ANCHORS: AnchorRender[] = [{ ...MINIMAP_ANCHORS.samm }, { ...MINIMAP_ANCHORS.admin }];

interface PainterOpts {
  big: boolean;
}

function paint(ctx: CanvasRenderingContext2D, pxSize: number, opts: PainterOpts): void {
  const tick = getMinimapTick();
  const cx = pxSize / 2;
  const cy = pxSize / 2;
  const px = pxSize / (MAP_RANGE * 2);
  const scale = opts.big ? 1.4 : 1.0;
  const fontPx = opts.big ? 12 : 9;
  const markerSize = opts.big ? 5 : 3;

  // backdrop
  ctx.clearRect(0, 0, pxSize, pxSize);
  ctx.fillStyle = 'rgba(8, 12, 14, 0.6)';
  ctx.fillRect(0, 0, pxSize, pxSize);

  // crosshair grid with mid-ring + corner ticks for better orientation cues
  ctx.strokeStyle = 'rgba(140, 200, 170, 0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(pxSize, cy);
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, pxSize);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(140, 200, 170, 0.12)';
  ctx.beginPath();
  ctx.arc(cx, cy, pxSize * 0.32, 0, Math.PI * 2);
  ctx.stroke();

  // compass labels — N is -Z, E is +X (matches scene world frame)
  ctx.fillStyle = 'rgba(132, 216, 164, 0.55)';
  ctx.font = `bold ${fontPx}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const compassR = pxSize / 2 - fontPx - 2;
  ctx.fillText('N', cx, cy - compassR);
  ctx.fillText('S', cx, cy + compassR);
  ctx.fillText('E', cx + compassR, cy);
  ctx.fillText('W', cx - compassR, cy);

  // anchors — drawn at their wrapped delta from the player.
  ctx.font = `${fontPx - 1}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const a of ANCHORS) {
    const dx = wrapDelta(a.x - tick.playerX);
    const dz = wrapDelta(a.z - tick.playerZ);
    let mx = cx + dx * px;
    let my = cy + dz * px;
    let onScreen = true;
    const pad = 8 * scale;
    if (mx < pad || mx > pxSize - pad || my < pad || my > pxSize - pad) {
      onScreen = false;
      const ang = Math.atan2(dz, dx);
      const r = pxSize / 2 - pad;
      mx = cx + Math.cos(ang) * r;
      my = cy + Math.sin(ang) * r;
    }
    // marker with halo
    ctx.fillStyle = a.tint;
    ctx.globalAlpha = onScreen ? 0.25 : 0.18;
    ctx.beginPath();
    ctx.arc(mx, my, markerSize + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = onScreen ? 1 : 0.55;
    ctx.beginPath();
    ctx.arc(mx, my, markerSize, 0, Math.PI * 2);
    ctx.fill();
    // text shadow + label
    ctx.fillStyle = 'rgba(8, 12, 14, 0.8)';
    ctx.fillText(a.label, mx + 1, my + markerSize + 1);
    ctx.fillStyle = a.tint;
    ctx.globalAlpha = onScreen ? 1 : 0.55;
    ctx.fillText(a.label, mx, my + markerSize);
    ctx.globalAlpha = 1;
  }

  // active mission checkpoint pin
  const checkpoint = getActiveCheckpointAnchor();
  if (checkpoint) {
    const dx = wrapDelta(checkpoint.x - tick.playerX);
    const dz = wrapDelta(checkpoint.z - tick.playerZ);
    let mx = cx + dx * px;
    let my = cy + dz * px;
    let onScreen = true;
    const pad = 10 * scale;
    if (mx < pad || mx > pxSize - pad || my < pad || my > pxSize - pad) {
      onScreen = false;
      const ang = Math.atan2(dz, dx);
      const r = pxSize / 2 - pad;
      mx = cx + Math.cos(ang) * r;
      my = cy + Math.sin(ang) * r;
    }
    const objSize = markerSize + 2;
    ctx.fillStyle = '#6cf0ff';
    ctx.globalAlpha = onScreen ? 1 : 0.6;
    ctx.beginPath();
    ctx.moveTo(mx, my - objSize);
    ctx.lineTo(mx + objSize, my);
    ctx.lineTo(mx, my + objSize);
    ctx.lineTo(mx - objSize, my);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(8, 12, 14, 0.8)';
    ctx.fillText('OBJ', mx + 1, my + objSize + 1);
    ctx.fillStyle = '#6cf0ff';
    ctx.globalAlpha = onScreen ? 1 : 0.6;
    ctx.fillText('OBJ', mx, my + objSize);
    ctx.globalAlpha = 1;
  }

  // remote runners — small dots, drawn underneath the local player so
  // the centre marker reads as "you". Offscreen runners get clamped to
  // the disc's edge so they're still discoverable.
  const remoteDotSize = opts.big ? 2.6 : 1.8;
  for (const rem of getMinimapRemotes()) {
    const dx = wrapDelta(rem.x - tick.playerX);
    const dz = wrapDelta(rem.z - tick.playerZ);
    let mx = cx + dx * px;
    let my = cy + dz * px;
    let onScreen = true;
    const pad = 6 * scale;
    if (mx < pad || mx > pxSize - pad || my < pad || my > pxSize - pad) {
      onScreen = false;
      const ang = Math.atan2(dz, dx);
      const r = pxSize / 2 - pad;
      mx = cx + Math.cos(ang) * r;
      my = cy + Math.sin(ang) * r;
    }
    ctx.fillStyle = 'rgba(176, 124, 255, 0.95)';
    ctx.globalAlpha = onScreen ? 1 : 0.5;
    // halo
    ctx.beginPath();
    ctx.arc(mx, my, remoteDotSize + 1.4, 0, Math.PI * 2);
    ctx.globalAlpha = onScreen ? 0.25 : 0.15;
    ctx.fill();
    // core
    ctx.globalAlpha = onScreen ? 1 : 0.55;
    ctx.beginPath();
    ctx.arc(mx, my, remoteDotSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // player — center dot with facing arrow (heavier in big mode)
  ctx.fillStyle = '#c0ffd6';
  ctx.beginPath();
  ctx.arc(cx, cy, markerSize - 0.5, 0, Math.PI * 2);
  ctx.fill();
  const ang = tick.facing;
  const tipLen = opts.big ? 14 : 9;
  const tipX = cx + Math.sin(ang) * tipLen;
  const tipY = cy + Math.cos(ang) * tipLen;
  ctx.strokeStyle = '#c0ffd6';
  ctx.lineWidth = opts.big ? 2.5 : 1.8;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  // coordinate readout — bottom-left, small monospace
  ctx.font = `${fontPx - 2}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(140, 200, 170, 0.7)';
  const xs = tick.playerX.toFixed(0).padStart(3, ' ');
  const zs = tick.playerZ.toFixed(0).padStart(3, ' ');
  ctx.fillText(`x ${xs}  z ${zs}`, 4, pxSize - 3);
}

export function Starmap(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dirtyRef = useRef(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(
    () =>
      onMinimapTick(() => {
        dirtyRef.current = true;
      }),
    [],
  );

  useEffect(
    () =>
      subscribeMissionChanges(() => {
        dirtyRef.current = true;
      }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let pxSize = canvas.clientWidth || 132;
    const sizeCanvas = (): void => {
      pxSize = canvas.clientWidth || pxSize;
      canvas.width = pxSize * dpr;
      canvas.height = pxSize * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      dirtyRef.current = true;
    };
    sizeCanvas();
    const ro = new ResizeObserver(sizeCanvas);
    ro.observe(canvas);

    let raf = 0;
    const loop = (): void => {
      raf = requestAnimationFrame(loop);
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      paint(ctx, pxSize, { big: false });
    };
    raf = requestAnimationFrame(loop);
    dirtyRef.current = true;

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <>
      <button
        type="button"
        className="starmap"
        aria-label="spectrum navigator — tap to expand"
        onClick={() => setExpanded(true)}
      >
        <canvas ref={canvasRef} className="starmap-canvas" />
      </button>
      {expanded && <StarmapExpanded onClose={() => setExpanded(false)} />}
    </>
  );
}

function StarmapExpanded({ onClose }: { onClose(): void }): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dirtyRef = useRef(true);

  useEffect(
    () =>
      onMinimapTick(() => {
        dirtyRef.current = true;
      }),
    [],
  );

  useEffect(
    () =>
      subscribeMissionChanges(() => {
        dirtyRef.current = true;
      }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let pxSize = canvas.clientWidth || 280;
    const sizeCanvas = (): void => {
      pxSize = canvas.clientWidth || pxSize;
      canvas.width = pxSize * dpr;
      canvas.height = pxSize * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      dirtyRef.current = true;
    };
    sizeCanvas();
    const ro = new ResizeObserver(sizeCanvas);
    ro.observe(canvas);

    let raf = 0;
    const loop = (): void => {
      raf = requestAnimationFrame(loop);
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      paint(ctx, pxSize, { big: true });
    };
    raf = requestAnimationFrame(loop);
    dirtyRef.current = true;

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // Close on ESC.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop close is pointer-only; ESC handled by useEffect listener
    <div className="starmap-expanded-back" onClick={onClose}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation is event-routing only; no user-facing action */}
      <div className="starmap-expanded" onClick={(e) => e.stopPropagation()}>
        <canvas ref={canvasRef} className="starmap-expanded-canvas" />
      </div>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation is event-routing only; no user-facing action */}
      <header className="starmap-expanded-head" onClick={(e) => e.stopPropagation()}>
        <span className="starmap-expanded-title">{'// spectrum_navigator'}</span>
        <button
          type="button"
          className="starmap-expanded-close"
          onClick={onClose}
          aria-label="close spectrum navigator"
        >
          ✕
        </button>
      </header>
    </div>
  );
}
