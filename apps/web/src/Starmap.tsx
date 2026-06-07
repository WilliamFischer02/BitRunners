import { useEffect, useRef } from 'react';
import { MINIMAP_ANCHORS, getMinimapTick, onMinimapTick } from './minimap-state.js';
import { getActiveCheckpointAnchor, subscribeMissionChanges } from './missions.js';

// Floating top-right HUD minimap — starmap-projection style.
// Renders a 2D canvas at `pxSize` square with:
//   • player dot (centered, with facing arrow)
//   • anchor markers for SAMM + The Admin obelisk (Sub-Phase F v1)
// The world wraps at PLATFORM_HALF (= 19); we render anchors at their wrapped
// position relative to the local player so they always read as the nearest
// periodic image. The minimap shows roughly ±MAP_RANGE world units around the
// player.

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

export function Starmap(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dirtyRef = useRef(true);

  // Mark dirty whenever the scene publishes a tick; the rAF loop below picks
  // it up next frame. Decoupling tick from paint keeps the listener cheap.
  useEffect(
    () =>
      onMinimapTick(() => {
        dirtyRef.current = true;
      }),
    [],
  );

  // Mission state changes redraw the active-checkpoint pin.
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

    // Match canvas size to the CSS box so responsive @media rules can shrink
    // the minimap on mobile without scaling the canvas (which would blur).
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
    const paint = (): void => {
      raf = requestAnimationFrame(paint);
      if (!dirtyRef.current) return;
      dirtyRef.current = false;

      const tick = getMinimapTick();
      const cx = pxSize / 2;
      const cy = pxSize / 2;
      const px = pxSize / (MAP_RANGE * 2); // px per world unit

      // backdrop — dark with faint border
      ctx.clearRect(0, 0, pxSize, pxSize);
      ctx.fillStyle = 'rgba(8, 12, 14, 0.6)';
      ctx.fillRect(0, 0, pxSize, pxSize);

      // crosshair grid — two faint axes through center
      ctx.strokeStyle = 'rgba(140, 200, 170, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(pxSize, cy);
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, pxSize);
      ctx.stroke();

      // anchors — drawn at their wrapped delta from the player.
      // Each gets a 2-letter abbreviation drawn below the marker dot.
      ctx.font = '7px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (const a of ANCHORS) {
        const dx = wrapDelta(a.x - tick.playerX);
        const dz = wrapDelta(a.z - tick.playerZ);
        // Off-map → draw clamped to edge with reduced opacity so the runner
        // still knows which way to walk.
        let mx = cx + dx * px;
        let my = cy + dz * px;
        let onScreen = true;
        const pad = 6;
        if (mx < pad || mx > pxSize - pad || my < pad || my > pxSize - pad) {
          onScreen = false;
          const ang = Math.atan2(dz, dx);
          const r = pxSize / 2 - pad;
          mx = cx + Math.cos(ang) * r;
          my = cy + Math.sin(ang) * r;
        }
        ctx.fillStyle = a.tint;
        ctx.globalAlpha = onScreen ? 1 : 0.55;
        ctx.fillRect(mx - 2, my - 2, 4, 4);
        ctx.globalAlpha = onScreen ? 0.85 : 0.5;
        ctx.fillText(a.label, mx, my + 4);
        ctx.globalAlpha = 1;
      }

      // Active mission checkpoint pin (cyan diamond, slightly larger than
      // the static anchors). Drawn after SAMM/Admin so it's never occluded.
      const checkpoint = getActiveCheckpointAnchor();
      if (checkpoint) {
        const dx = wrapDelta(checkpoint.x - tick.playerX);
        const dz = wrapDelta(checkpoint.z - tick.playerZ);
        let mx = cx + dx * px;
        let my = cy + dz * px;
        let onScreen = true;
        const pad = 8;
        if (mx < pad || mx > pxSize - pad || my < pad || my > pxSize - pad) {
          onScreen = false;
          const ang = Math.atan2(dz, dx);
          const r = pxSize / 2 - pad;
          mx = cx + Math.cos(ang) * r;
          my = cy + Math.sin(ang) * r;
        }
        ctx.fillStyle = '#6cf0ff';
        ctx.globalAlpha = onScreen ? 1 : 0.6;
        ctx.beginPath();
        ctx.moveTo(mx, my - 4);
        ctx.lineTo(mx + 4, my);
        ctx.lineTo(mx, my + 4);
        ctx.lineTo(mx - 4, my);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = onScreen ? 0.85 : 0.5;
        ctx.fillText('OBJ', mx, my + 5);
        ctx.globalAlpha = 1;
      }

      // player — center dot with facing arrow.
      // facing is rig.facing radians; scene.ts uses atan2(input.x, input.z),
      // so 0 = +Z (south on the map). Negate to make north = -Z.
      ctx.fillStyle = '#c0ffd6';
      ctx.fillRect(cx - 2, cy - 2, 4, 4);
      const ang = tick.facing;
      const tipX = cx + Math.sin(ang) * 8;
      const tipY = cy + Math.cos(ang) * 8;
      ctx.strokeStyle = '#c0ffd6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
    };
    raf = requestAnimationFrame(paint);
    // Force one paint so the canvas isn't blank before the first scene tick.
    dirtyRef.current = true;

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="starmap" aria-label="sphere minimap" role="img">
      <canvas ref={canvasRef} className="starmap-canvas" />
    </div>
  );
}
