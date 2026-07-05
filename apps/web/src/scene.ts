import {
  buildGlyphAtlas,
  createAsciiPass,
  createCrtPass,
  setAsciiPassResolution,
} from '@bitrunners/ascii';
import { PLATFORM_HALF, PLATFORM_SIZE } from '@bitrunners/shared';
import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Line,
  LineBasicMaterial,
  type Mesh,
  Mesh as MeshClass,
  MeshNormalMaterial,
  MeshStandardMaterial,
  type MeshStandardMaterial as MeshStandardMaterialType,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Uniform,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import {
  type EquippedAppearance,
  type SlotAppearance,
  getEquippedAppearance,
  subscribeAppearance,
} from './appearance.js';
import { BADGES } from './badges.js';
import { isBlocked } from './block-list.js';
import { type SkinTarget, buildClassRig, isValidClass } from './class-rigs.js';
import { type BoxCollider, slideMoveInto } from './colliders.js';
import { buildDweller } from './dweller-rigs.js';
import { createInput } from './input.js';
import { getLevel, subscribeLevel } from './level.js';
import { type MazeGrid, generateMaze } from './maze-core.js';
import { MazeArena } from './maze-scene.js';
import { type MinimapRemote, publishMinimapRemotes, publishMinimapTick } from './minimap-state.js';
import { getProgress as getMissionProgressLocal } from './mission-progress-local.js';
import {
  MISSIONS,
  type MissionState,
  advanceActiveCheckpoint,
  getActiveCheckpointAnchor,
  getActiveMission,
  nextMissionKey,
  setActiveMission,
  subscribeMissionChanges,
} from './missions.js';
import { type NameStyle, getNameStyle, nameStyleClass, subscribeNameStyle } from './name-style.js';
import { type NetworkSession, getServerUrl, joinSphere } from './network.js';
import { applyPetBehaviour, petGeometryFor } from './pets.js';
import { type LocalIdentity, getIdentity, subscribeIdentity } from './profile.js';
import { type CircuitFloorUniforms, createCircuitFloorMaterial } from './shaders/circuit-floor.js';
import { getCurrentUserId, subscribeAuth } from './supabase.js';
import {
  type LockedTarget,
  applyLock,
  createTargetRaycaster,
  pickAvatar,
  releaseLock,
  tickLock,
} from './target-lock.js';
import {
  isTargeting,
  leaveTether,
  sendTetherRequest,
  setTetherSink,
  tetherDeclined,
  tetherEstablished,
  tetherReceive,
  tetherSystemNotice,
} from './tether-chat.js';
import { applyThemeToPass } from './themes.js';
import { STANDBY_ENTER_EVENT, STANDBY_EXIT_EVENT } from './visibility.js';

const WALK_SPEED = 3.2;
const RUN_SPEED = 5.6;

function readRunEnabled(): boolean {
  try {
    return localStorage.getItem('bitrunners.settings.run') === 'true';
  } catch {
    return false;
  }
}
// PLATFORM_HALF / PLATFORM_SIZE now live in @bitrunners/shared so the server
// can't drift from the client (Phase 3 doubled them to 19/38).

// Player collision radius (tuned to the bit_spekter torso footprint; reads as
// "your body" without being so fat that doorways feel pinched).
const PLAYER_RADIUS = 0.35;

// Tap-to-lock auto-release distance. Wrapped distance; 14 is just over a third
// of the doubled world's width — far enough that you can follow someone across
// the platform but tight enough that they don't drag the camera over the seam.
const LOCK_RELEASE_DISTANCE = 14;

// ── mega-batch 2 landmarks (devlog 0120) ────────────────────────────────
// Coords shared by the meshes (worldTile) + tick logic (proximity/sequence).
const GLITCH_SWITCH = { x: -22, z: 24 };
const VAULT = { x: 26, z: -18, half: 3.5 };
// Where the runner returns to after leaving the void — just south of the door.
const VAULT_RETURN = { x: 26, z: -13 };
// The four pressure plates, in the order they must be stepped (1→2→3→4).
const VAULT_PLATES: ReadonlyArray<{ x: number; z: number; pips: number }> = [
  { x: VAULT.x - 1.8, z: VAULT.z - 1.8, pips: 1 },
  { x: VAULT.x + 1.8, z: VAULT.z - 1.8, pips: 2 },
  { x: VAULT.x + 1.8, z: VAULT.z + 1.2, pips: 3 },
  { x: VAULT.x - 1.8, z: VAULT.z + 1.2, pips: 4 },
];
const PLATE_TRIGGER_DIST = 0.85;

// Solid colliders the local player slides against. AABBs in canonical world
// coords; collision is wrap-aware (colliders.ts uses wrapDelta). The four
// original decoration props get a footprint each, plus Phase 3 obstacles, the
// mega-batch-2 interior fill, and the two new landmarks (glitch switch + vault
// walls, door gap left open). Keep this list in sync with the meshes in
// `worldTile` below.
const COLLIDERS: readonly BoxCollider[] = [
  // existing decorations
  { x: -6.5, z: -6.5, hx: 0.8, hz: 0.3 }, // port
  { x: 6.0, z: -5.5, hx: 0.55, hz: 0.32 }, // vending (SAMM)
  { x: 5.5, z: 5.5, hx: 0.4, hz: 0.4 }, // monolith / obelisk
  { x: -5.5, z: 6.5, hx: 0.85, hz: 0.4 }, // terminal
  // Phase 3 obstacles (interior; placed away from the seam at +/- PLATFORM_HALF
  // so wrap-collision corner cases don't matter for these).
  { x: -12, z: 4, hx: 0.5, hz: 0.5 }, // rust pillar
  { x: 10, z: -10, hx: 0.9, hz: 0.7 }, // debris stack
  { x: 12, z: 12, hx: 0.35, hz: 0.35 }, // broken column
  { x: -10, z: -12, hx: 0.6, hz: 0.6 }, // crate cluster
  { x: 0, z: 14, hx: 1.6, hz: 0.3 }, // wall slab (long X)
  { x: 14, z: 0, hx: 0.3, hz: 1.2 }, // standing slab (long Z)
  // mega-batch 2 (devlog 0119): fill the doubled interior (PLATFORM_HALF 38).
  // All comfortably off the seam (|coord| <= 30 < 34) so wrap-collision corner
  // cases don't matter. Keep in sync with the obstacle meshes below.
  { x: -24, z: -20, hx: 0.6, hz: 0.6 }, // outer rust pillar
  { x: 22, z: 18, hx: 0.95, hz: 0.75 }, // outer debris
  { x: -28, z: 10, hx: 0.4, hz: 0.4 }, // far broken column
  { x: 26, z: -26, hx: 0.7, hz: 0.7 }, // far crate cluster
  { x: -6, z: -24, hx: 1.8, hz: 0.25 }, // long wall slab (X)
  { x: -30, z: -6, hx: 0.25, hz: 1.4 }, // standing slab (Z)
  { x: 20, z: 30, hx: 0.55, hz: 0.55 }, // pillar NE
  { x: 8, z: 30, hx: 1.0, hz: 0.6 }, // debris N
  // Landmark 1 — glitch switch wall (walk-up interactable; blocks passage).
  { x: GLITCH_SWITCH.x, z: GLITCH_SWITCH.z, hx: 1.4, hz: 0.2 },
  // Landmark 2 — vault walls (N, E, W solid; S split with a door gap at x=VAULT.x).
  { x: VAULT.x, z: VAULT.z - VAULT.half, hx: VAULT.half, hz: 0.2 }, // north
  { x: VAULT.x + VAULT.half, z: VAULT.z, hx: 0.2, hz: VAULT.half }, // east
  { x: VAULT.x - VAULT.half, z: VAULT.z, hx: 0.2, hz: VAULT.half }, // west
  { x: VAULT.x - 2.25, z: VAULT.z + VAULT.half, hx: 1.25, hz: 0.2 }, // south-left
  { x: VAULT.x + 2.25, z: VAULT.z + VAULT.half, hx: 1.25, hz: 0.2 }, // south-right
];

// Shortest signed delta on the wrapping board. The world renders as a 3x3 tile
// grid, so a remote player must be drawn at the periodic image nearest the
// local player or they vanish across the seam (devlog 0031).
function wrapDelta(d: number): number {
  return ((((d + PLATFORM_HALF) % PLATFORM_SIZE) + PLATFORM_SIZE) % PLATFORM_SIZE) - PLATFORM_HALF;
}

// Shown when a newer tab for the same account supersedes this connection.
// Persistent (no auto-dismiss) — the stale tab is intentionally dead so it
// stops haunting the sphere; the runner continues in the other tab.
/**
 * Format an unknown rejection from the Colyseus matchmaker into a string the
 * user can actually parse. The default `String(err)` returns
 * `[object XMLHttpRequest]` when the matchmaker XHR fails outright (Fly cold
 * start, blocked network), which is what the field bug report at devlog 0110
 * captured. Drop in here so every consumer benefits.
 */
function formatNetError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown> & {
      readyState?: number;
      status?: number;
      statusText?: string;
    };
    if (typeof e.message === 'string' && e.message) return e.message;
    // XHR rejection — typeof XMLHttpRequest checks both modern + jsdom.
    if (typeof XMLHttpRequest !== 'undefined' && err instanceof XMLHttpRequest) {
      const status = err.status;
      const text = err.statusText;
      if (status === 0) return 'server unreachable (cold start? network blocked?)';
      return `xhr ${status}${text ? ` ${text}` : ''}`;
    }
    if (typeof e.status === 'number') {
      return `status ${e.status}${e.statusText ? ` ${e.statusText}` : ''}`;
    }
  }
  return 'connection failed';
}

function showSupersededOverlay(host: HTMLElement): void {
  if (host.querySelector('.session-superseded')) return;
  const el = document.createElement('div');
  el.className = 'session-superseded';
  el.innerHTML =
    '<div class="session-superseded-box">' +
    '<div class="session-superseded-title">// session moved to another tab</div>' +
    '<div class="session-superseded-sub">this runner is now active in a newer tab or window.</div>' +
    '<button type="button" class="session-superseded-btn">reconnect here</button>' +
    '</div>';
  const btn = el.querySelector('.session-superseded-btn');
  btn?.addEventListener('click', () => window.location.reload());
  host.appendChild(el);
}
// Exponential-smoothing rate for remote avatars (frame-rate independent).
const REMOTE_LERP_K = 14;
const EMOTE_MS = 1400;

const TRAIL_ARM = 0.65;
const TRAIL_LEG = 0.45;
const LEAN_CHEST = 0.16;

const CHARACTER_LAYER = 1;

const NET_SEND_HZ = 15;
const NET_SEND_MS = 1000 / NET_SEND_HZ;

// Remote players use a simplified, non-animated shell — the 6 base meshes
// (head, visor, torso, belt, legs, boots) are kept for shape continuity, but
// the armour + accent palette swaps per class so each remote runner is
// recognisable at a glance. Phase 7 will add per-class accent props (halo,
// backpack, etc.) as a cheap follow-up; this PR only swaps the palette.
interface RemoteLook {
  armor: number;
  dark: number;
  emissive: number;
}
const REMOTE_LOOKS: Record<string, RemoteLook> = {
  bit_spekter: { armor: 0xa8acb4, dark: 0x404448, emissive: 0x141820 },
  server_speaker: { armor: 0xc8d8ee, dark: 0x2a3a52, emissive: 0x3a5878 },
  data_miner: { armor: 0x7b8a7e, dark: 0x303834, emissive: 0x141c14 },
  terminal_runner: { armor: 0x3a2a52, dark: 0x140828, emissive: 0x7eedc8 },
  hash_kicker: { armor: 0xb0b4b8, dark: 0x4a4e54, emissive: 0xff8844 },
  web_puller: { armor: 0x251a3a, dark: 0x18102a, emissive: 0x4a2880 },
};

function buildRemoteAvatar(className: string): Group {
  const look = REMOTE_LOOKS[className] ?? REMOTE_LOOKS.bit_spekter;
  if (!look) throw new Error('unreachable');
  const g = new Group();
  const armor = new MeshStandardMaterial({
    color: look.armor,
    roughness: 0.7,
    metalness: 0.2,
    emissive: look.emissive,
    emissiveIntensity: 0.45,
  });
  const dark = new MeshStandardMaterial({
    color: look.dark,
    roughness: 0.8,
    metalness: 0.1,
  });
  const head = new MeshClass(new SphereGeometry(0.34, 12, 8), armor);
  head.position.y = 1.58;
  head.scale.set(1.0, 1.05, 0.92);
  g.add(head);
  const visor = new MeshClass(new BoxGeometry(0.5, 0.18, 0.06), dark);
  visor.position.set(0, 1.58, 0.31);
  g.add(visor);
  const torso = new MeshClass(new BoxGeometry(0.78, 0.78, 0.46), armor);
  torso.position.y = 0.98;
  g.add(torso);
  const belt = new MeshClass(new BoxGeometry(0.8, 0.08, 0.48), dark);
  belt.position.y = 0.62;
  g.add(belt);
  const legs = new MeshClass(new BoxGeometry(0.68, 0.6, 0.32), armor);
  legs.position.y = 0.32;
  g.add(legs);
  const boots = new MeshClass(new BoxGeometry(0.74, 0.12, 0.36), dark);
  boots.position.set(0, 0.06, 0.04);
  g.add(boots);
  return g;
}

// SkinTarget + the per-class rigs live in `./class-rigs.ts` — the BitSpekter
// builder + scaffolding migrated out so the other five classes can share the
// same shape and limb geometries. Pet geometry + per-pet motion behaviour
// live in `./pets.ts` for the same reason.

export interface SceneControls {
  dispose(): void;
  triggerEmote(text: string): void;
}

export function startScene(host: HTMLElement, classNameArg: string): SceneControls {
  // `?class=NAME` overrides the boot-selected class for visual QA of locked
  // classes (server_speaker etc. don't appear in the live class grid yet —
  // they unlock via tutorial completion or owner action). Falls back to the
  // boot-selected class on any unknown / missing value.
  const classOverride =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('class') : null;
  const className = classOverride && isValidClass(classOverride) ? classOverride : classNameArg;

  const renderer = new WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(1);
  renderer.toneMappingExposure = 1.15;
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color(0x070a09);
  // Depth cueing: distant ground + wrapped tiles fade toward a dark haze, which
  // also widens the luminance gradient the ASCII edge pass reads (crisper
  // silhouettes at depth). Near/far track the world constants so it stays tuned
  // if the platform size changes. Nulled during the character pass (below) so
  // the runner stays crisp regardless of camera distance.
  scene.fog = new Fog(0x0a1212, PLATFORM_HALF * 0.8, PLATFORM_SIZE * 2.0);

  const camera = new PerspectiveCamera(38, 1, 0.1, 200);
  const cameraOffset = new Vector3(4.5, 9.5, 4.5);
  camera.layers.enableAll();

  // Camera zoom — multiplies cameraOffset so direction (¾ iso angle) is
  // preserved while distance changes. Mouse wheel + pinch gesture drive it;
  // clamp to a sane range so the runner never disappears off-screen or
  // shrinks to a single ASCII cell.
  const ZOOM_MIN = 0.55;
  const ZOOM_MAX = 2.2;
  const ZOOM_KEY = 'bitrunners.settings.cameraZoom';
  let cameraZoom = (() => {
    try {
      const v = Number(localStorage.getItem(ZOOM_KEY));
      if (Number.isFinite(v) && v >= ZOOM_MIN && v <= ZOOM_MAX) return v;
    } catch {
      // storage unavailable — use default
    }
    return 1.0;
  })();
  function clampZoom(v: number): number {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v));
  }
  function setZoom(v: number): void {
    const next = clampZoom(v);
    if (Math.abs(next - cameraZoom) < 1e-3) return;
    cameraZoom = next;
    try {
      localStorage.setItem(ZOOM_KEY, String(cameraZoom));
    } catch {
      // ignore
    }
  }

  const hemi = new HemisphereLight(0xffffff, 0x303338, 1.05);
  hemi.layers.enableAll();
  scene.add(hemi);
  const sun = new DirectionalLight(0xffffff, 1.9);
  sun.position.set(6, 10, 4);
  sun.layers.enableAll();
  scene.add(sun);
  const fill = new DirectionalLight(0x9aaecc, 0.55);
  fill.position.set(-5, 4, -5);
  fill.layers.enableAll();
  scene.add(fill);
  // Cool back-rim to rake silhouette edges (separation the ASCII edge pass reads).
  const rim = new DirectionalLight(0xbcd4ff, 0.5);
  rim.position.set(-3, 3, -7);
  rim.layers.enableAll();
  scene.add(rim);

  const worldTile = new Group();

  // Circuit-board floor (Phase 4, devlog 0068). FBM-driven copper traces
  // animated by a current-pulse. Replaces the flat plane + grid strips.
  // The shader picks pattern coordinates from local position.xy so the
  // 3x3 wrap-tile cloning still tiles seamlessly. Stage A fallback flag
  // `?floor=plain` reverts to the old MeshStandardMaterial path for an
  // emergency rollback on low-end devices.
  const floorPlain =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('floor') === 'plain';
  const floorMaterial = floorPlain
    ? new MeshStandardMaterial({ color: 0x1a2a1c, roughness: 0.95, metalness: 0.05 })
    : createCircuitFloorMaterial();
  const platform = new MeshClass(
    new PlaneGeometry(PLATFORM_HALF * 2, PLATFORM_HALF * 2, 1, 1),
    floorMaterial,
  );
  platform.rotation.x = -Math.PI / 2;
  worldTile.add(platform);

  if (floorPlain) {
    const gridProto = new MeshClass(
      new BoxGeometry(PLATFORM_HALF * 2 - 0.4, 0.02, 0.06),
      new MeshStandardMaterial({ color: 0x4c5056, roughness: 1 }),
    );
    for (let i = -3; i <= 3; i++) {
      const a = gridProto.clone();
      a.position.set(0, 0.01, i * 2.4);
      worldTile.add(a);
      const b = gridProto.clone();
      b.rotation.y = Math.PI / 2;
      b.position.set(i * 2.4, 0.01, 0);
      worldTile.add(b);
    }
  }

  const port = new MeshClass(
    new BoxGeometry(1.4, 2.2, 0.4),
    new MeshStandardMaterial({ color: 0xc4c8d0, roughness: 0.4, metalness: 0.4 }),
  );
  port.position.set(-6.5, 1.1, -6.5);
  worldTile.add(port);
  const portInsideMaterial = new MeshStandardMaterial({
    color: 0x141820,
    emissive: 0x4477aa,
    emissiveIntensity: 0.6,
    roughness: 1,
  });
  const portInside = new MeshClass(new BoxGeometry(0.95, 1.55, 0.05), portInsideMaterial);
  portInside.position.set(-6.5, 1.1, -6.29);
  worldTile.add(portInside);

  const vending = new MeshClass(
    new BoxGeometry(1.0, 1.7, 0.55),
    new MeshStandardMaterial({ color: 0xb0b4ba, roughness: 0.55, metalness: 0.3 }),
  );
  vending.position.set(6.0, 0.85, -5.5);
  worldTile.add(vending);
  const vendingScreen = new MeshClass(
    new BoxGeometry(0.7, 0.45, 0.05),
    new MeshStandardMaterial({
      color: 0x0c1014,
      emissive: 0xff8844,
      emissiveIntensity: 0.7,
      roughness: 1,
    }),
  );
  vendingScreen.position.set(6.0, 1.25, -5.21);
  worldTile.add(vendingScreen);
  const vendingSlot = new MeshClass(
    new BoxGeometry(0.55, 0.12, 0.06),
    new MeshStandardMaterial({ color: 0x2a2e33, roughness: 1 }),
  );
  vendingSlot.position.set(6.0, 0.3, -5.2);
  worldTile.add(vendingSlot);

  const monolith = new MeshClass(
    new BoxGeometry(0.65, 3.6, 0.65),
    new MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.4, metalness: 0.6 }),
  );
  monolith.position.set(5.5, 1.8, 5.5);
  worldTile.add(monolith);
  const monolithGlow = new MeshClass(
    new BoxGeometry(0.06, 2.8, 0.06),
    new MeshStandardMaterial({
      color: 0x000000,
      emissive: 0xff8844,
      emissiveIntensity: 0.9,
      roughness: 1,
    }),
  );
  monolithGlow.position.set(5.5, 1.8, 5.83);
  worldTile.add(monolithGlow);

  const terminal = new MeshClass(
    new BoxGeometry(1.5, 0.9, 0.6),
    new MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.5, metalness: 0.35 }),
  );
  terminal.position.set(-5.5, 0.45, 6.5);
  worldTile.add(terminal);
  const terminalScreen = new MeshClass(
    new BoxGeometry(1.1, 0.55, 0.05),
    new MeshStandardMaterial({
      color: 0x0a0c10,
      emissive: 0xff8844,
      emissiveIntensity: 0.55,
      roughness: 1,
    }),
  );
  terminalScreen.position.set(-5.5, 0.55, 6.81);
  terminalScreen.rotation.x = -0.3;
  worldTile.add(terminalScreen);

  // ─── Phase 3 obstacles ───────────────────────────────────────────────
  // Solid props scattered through the doubled interior; the player slides
  // against them via COLLIDERS (above). Each mesh's footprint matches its
  // collider entry (so visual + collision read identically).
  const obstacleRustMat = new MeshStandardMaterial({
    color: 0x6a3a1a,
    emissive: 0xff6a20,
    emissiveIntensity: 0.45,
    metalness: 0.6,
    roughness: 0.55,
  });
  const obstacleStoneMat = new MeshStandardMaterial({
    color: 0x4a4e54,
    emissive: 0x141820,
    emissiveIntensity: 0.3,
    metalness: 0.3,
    roughness: 0.85,
  });
  const rustPillar = new MeshClass(new BoxGeometry(1.0, 2.6, 1.0), obstacleRustMat);
  rustPillar.position.set(-12, 1.3, 4);
  worldTile.add(rustPillar);
  const debrisStack = new MeshClass(new BoxGeometry(1.8, 1.0, 1.4), obstacleStoneMat);
  debrisStack.position.set(10, 0.5, -10);
  worldTile.add(debrisStack);
  const brokenColumn = new MeshClass(new BoxGeometry(0.7, 3.0, 0.7), obstacleStoneMat);
  brokenColumn.position.set(12, 1.5, 12);
  brokenColumn.rotation.z = 0.12;
  worldTile.add(brokenColumn);
  const crateA = new MeshClass(new BoxGeometry(0.8, 0.8, 0.8), obstacleRustMat);
  crateA.position.set(-10.3, 0.4, -12.2);
  worldTile.add(crateA);
  const crateB = new MeshClass(new BoxGeometry(0.7, 0.7, 0.7), obstacleRustMat);
  crateB.position.set(-9.7, 0.35, -11.7);
  worldTile.add(crateB);
  const crateC = new MeshClass(new BoxGeometry(0.6, 1.2, 0.6), obstacleRustMat);
  crateC.position.set(-10.1, 0.6, -11.4);
  worldTile.add(crateC);
  const wallSlab = new MeshClass(new BoxGeometry(3.2, 1.2, 0.5), obstacleStoneMat);
  wallSlab.position.set(0, 0.6, 14);
  worldTile.add(wallSlab);
  const standingSlab = new MeshClass(new BoxGeometry(0.5, 1.6, 2.4), obstacleStoneMat);
  standingSlab.position.set(14, 0.8, 0);
  worldTile.add(standingSlab);

  // mega-batch 2: extra obstacles filling the doubled interior (see COLLIDERS).
  const rustPillar2 = new MeshClass(new BoxGeometry(1.2, 2.8, 1.2), obstacleRustMat);
  rustPillar2.position.set(-24, 1.4, -20);
  worldTile.add(rustPillar2);
  const debrisStack2 = new MeshClass(new BoxGeometry(1.9, 1.1, 1.5), obstacleStoneMat);
  debrisStack2.position.set(22, 0.55, 18);
  worldTile.add(debrisStack2);
  const brokenColumn2 = new MeshClass(new BoxGeometry(0.8, 3.4, 0.8), obstacleStoneMat);
  brokenColumn2.position.set(-28, 1.7, 10);
  brokenColumn2.rotation.z = -0.1;
  worldTile.add(brokenColumn2);
  const crateCluster2 = new MeshClass(new BoxGeometry(1.4, 1.0, 1.4), obstacleRustMat);
  crateCluster2.position.set(26, 0.5, -26);
  worldTile.add(crateCluster2);
  const wallSlab2 = new MeshClass(new BoxGeometry(3.6, 1.3, 0.5), obstacleStoneMat);
  wallSlab2.position.set(-6, 0.65, -24);
  worldTile.add(wallSlab2);
  const standingSlab2 = new MeshClass(new BoxGeometry(0.5, 1.8, 2.8), obstacleStoneMat);
  standingSlab2.position.set(-30, 0.9, -6);
  worldTile.add(standingSlab2);
  const rustPillar3 = new MeshClass(new BoxGeometry(1.1, 2.4, 1.1), obstacleRustMat);
  rustPillar3.position.set(20, 1.2, 30);
  worldTile.add(rustPillar3);
  const debrisStack3 = new MeshClass(new BoxGeometry(2.0, 0.9, 1.2), obstacleStoneMat);
  debrisStack3.position.set(8, 0.45, 30);
  worldTile.add(debrisStack3);

  // ── Landmark 1: the glitch switch (walk-up interactable) ─────────────────
  const switchWallMat = new MeshStandardMaterial({
    color: 0x2a2440,
    emissive: 0x6a3aff,
    emissiveIntensity: 0.55,
    roughness: 0.7,
  });
  const switchWall = new MeshClass(new BoxGeometry(2.8, 1.8, 0.4), switchWallMat);
  switchWall.position.set(GLITCH_SWITCH.x, 0.9, GLITCH_SWITCH.z);
  worldTile.add(switchWall);
  // A bright glowing panel on the camera-facing (+Z) side so the switch reads
  // as interactable from the iso viewport (kept axis-aligned so its collider
  // footprint still matches).
  const switchPanelMat = new MeshStandardMaterial({
    color: 0x1a1030,
    emissive: 0xb07cff,
    emissiveIntensity: 1.5,
    roughness: 0.4,
  });
  const switchPanel = new MeshClass(new BoxGeometry(1.6, 1.1, 0.08), switchPanelMat);
  switchPanel.position.set(GLITCH_SWITCH.x, 1.0, GLITCH_SWITCH.z + 0.22);
  worldTile.add(switchPanel);
  const leverMat = new MeshStandardMaterial({
    color: 0x101018,
    emissive: 0xffd860,
    emissiveIntensity: 1.9,
    metalness: 0.6,
    roughness: 0.3,
  });
  const lever = new MeshClass(new BoxGeometry(0.2, 1.05, 0.2), leverMat);
  lever.position.set(GLITCH_SWITCH.x, 1.55, GLITCH_SWITCH.z + 0.32);
  lever.rotation.x = -0.6;
  worldTile.add(lever);

  // ── Landmark 2: the pressure-plate vault (roofless: 4 walls + door gap) ──
  const vaultWallMat = new MeshStandardMaterial({
    color: 0x3a4048,
    emissive: 0x141820,
    emissiveIntensity: 0.3,
    roughness: 0.85,
  });
  const VAULT_WALL_H = 1.6;
  const addVaultWall = (x: number, z: number, w: number, d: number): void => {
    const seg = new MeshClass(new BoxGeometry(w, VAULT_WALL_H, d), vaultWallMat);
    seg.position.set(x, VAULT_WALL_H / 2, z);
    worldTile.add(seg);
  };
  addVaultWall(VAULT.x, VAULT.z - VAULT.half, VAULT.half * 2, 0.4); // north
  addVaultWall(VAULT.x + VAULT.half, VAULT.z, 0.4, VAULT.half * 2); // east
  addVaultWall(VAULT.x - VAULT.half, VAULT.z, 0.4, VAULT.half * 2); // west
  addVaultWall(VAULT.x - 2.25, VAULT.z + VAULT.half, 2.5, 0.4); // south-left
  addVaultWall(VAULT.x + 2.25, VAULT.z + VAULT.half, 2.5, 0.4); // south-right
  // Plates: emissive floor tiles + 1..4 pip cubes. Materials kept so the tick
  // can brighten a plate as the sequence advances (clones share the material).
  const plateMats: MeshStandardMaterialType[] = [];
  const plateGeom = new BoxGeometry(1.2, 0.08, 1.2);
  const pipGeom = new BoxGeometry(0.16, 0.1, 0.16);
  const pipMat = new MeshStandardMaterial({
    color: 0x0a0a10,
    emissive: 0xffd860,
    emissiveIntensity: 1.0,
  });
  for (const plate of VAULT_PLATES) {
    const mat = new MeshStandardMaterial({
      color: 0x1a2230,
      emissive: 0x2a3a50,
      emissiveIntensity: 0.5,
      roughness: 0.6,
    });
    plateMats.push(mat);
    const tile = new MeshClass(plateGeom, mat);
    tile.position.set(plate.x, 0.04, plate.z);
    worldTile.add(tile);
    for (let p = 0; p < plate.pips; p++) {
      const pip = new MeshClass(pipGeom, pipMat);
      pip.position.set(
        plate.x - 0.2 + (p % 2) * 0.4,
        0.12,
        plate.z - 0.2 + Math.floor(p / 2) * 0.4,
      );
      worldTile.add(pip);
    }
  }

  // Hovering, glowing, downward-pointing beacon cones over the key landmarks
  // (SAMM, the obelisk, the glitch switch) so they're spottable across the
  // doubled map. Static hover (in worldTile → cloned across the 3x3 tiles).
  const beaconMat = new MeshStandardMaterial({
    color: 0x101828,
    emissive: 0x6cf0ff,
    emissiveIntensity: 1.7,
    roughness: 0.35,
    transparent: true,
    opacity: 0.9,
  });
  const addBeacon = (bx: number, bz: number): void => {
    const cone = new MeshClass(new ConeGeometry(0.36, 0.8, 10), beaconMat);
    cone.position.set(bx, 3.0, bz);
    cone.rotation.x = Math.PI; // tip points down at the landmark
    worldTile.add(cone);
  };
  addBeacon(6.0, -5.5); // SAMM
  addBeacon(5.5, 5.5); // obelisk / The Admin
  addBeacon(GLITCH_SWITCH.x, GLITCH_SWITCH.z); // glitch switch

  const tuftMaterial = new MeshStandardMaterial({
    color: 0x88c466,
    emissive: 0x2a4818,
    emissiveIntensity: 0.65,
    roughness: 0.9,
  });

  const traceMaterial = new MeshStandardMaterial({
    color: 0x6a3a1a,
    emissive: 0xff6a20,
    emissiveIntensity: 0.55,
    metalness: 0.7,
    roughness: 0.4,
  });
  const traceGeom = new BoxGeometry(1, 0.03, 0.08);
  let traceSeed = 0xa3c1;
  function traceRand(): number {
    traceSeed = (traceSeed * 1103515245 + 12345) & 0x7fffffff;
    return traceSeed / 0x7fffffff;
  }
  for (let i = 0; i < 14; i++) {
    const trace = new MeshClass(traceGeom, traceMaterial);
    trace.position.set(
      (traceRand() - 0.5) * (PLATFORM_SIZE - 1.5),
      0.025,
      (traceRand() - 0.5) * (PLATFORM_SIZE - 1.5),
    );
    if (traceRand() < 0.5) trace.rotation.y = Math.PI / 2;
    trace.scale.x = 0.6 + traceRand() * 2.4;
    worldTile.add(trace);
  }
  const tuftBladeGeom = new BoxGeometry(0.05, 0.32, 0.05);
  const tufts = new Group();
  let tuftSeed = 0x5a17;
  function tuftRand(): number {
    tuftSeed = (tuftSeed * 1103515245 + 12345) & 0x7fffffff;
    return tuftSeed / 0x7fffffff;
  }
  for (let i = 0; i < 36; i++) {
    const cx = (tuftRand() - 0.5) * (PLATFORM_SIZE - 1.5);
    const cz = (tuftRand() - 0.5) * (PLATFORM_SIZE - 1.5);
    const blades = 3 + Math.floor(tuftRand() * 4);
    const tuft = new Group();
    for (let b = 0; b < blades; b++) {
      const blade = new MeshClass(tuftBladeGeom, tuftMaterial);
      blade.position.set(
        (tuftRand() - 0.5) * 0.3,
        0.16 + tuftRand() * 0.08,
        (tuftRand() - 0.5) * 0.3,
      );
      blade.rotation.y = tuftRand() * Math.PI;
      blade.scale.y = 0.7 + tuftRand() * 0.6;
      tuft.add(blade);
    }
    tuft.position.set(cx, 0, cz);
    tufts.add(tuft);
  }
  worldTile.add(tufts);

  // Objects hidden while in core_run maze mode (4.5). The 3x3 world tiles +
  // mission markers + skybox are toggled off so only the maze arena renders.
  const worldToggle: { visible: boolean }[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dz === 0) {
        scene.add(worldTile);
        worldToggle.push(worldTile);
      } else {
        const tile = worldTile.clone();
        tile.position.set(dx * PLATFORM_SIZE, 0, dz * PLATFORM_SIZE);
        scene.add(tile);
        worldToggle.push(tile);
      }
    }
  }

  // ─── Mission checkpoint markers + route line (Sub-Phase G) ──────────────
  // Added AFTER the 3x3 wrap clones so they're not duplicated. Markers
  // re-spawn whenever the active mission changes; positions read from
  // missions.ts. Render is mobile-safe: plain emissive cylinders + a glow
  // Mesh halo, no DepthTexture / OutlinePass.
  const missionGroup = new Group();
  scene.add(missionGroup);
  worldToggle.push(missionGroup);

  interface CheckpointMarker {
    group: Group;
    coreMat: MeshStandardMaterialType;
    glowMat: MeshStandardMaterialType;
    /** Index of this checkpoint inside the active mission. */
    idx: number;
  }
  let checkpointMarkers: CheckpointMarker[] = [];
  let routeLine: Line | null = null;

  function clearMissionMarkers(): void {
    for (const m of checkpointMarkers) {
      missionGroup.remove(m.group);
      m.coreMat.dispose();
      m.glowMat.dispose();
      m.group.traverse((obj) => {
        if (obj instanceof MeshClass) obj.geometry.dispose();
      });
    }
    checkpointMarkers = [];
    if (routeLine) {
      missionGroup.remove(routeLine);
      routeLine.geometry.dispose();
      (routeLine.material as LineBasicMaterial).dispose();
      routeLine = null;
    }
  }

  function buildMissionMarkers(): void {
    clearMissionMarkers();
    const snap = getActiveMission();
    if (!snap || snap.state === 'complete') return;
    const cps = snap.mission.checkpoints;
    for (let i = 0; i < cps.length; i++) {
      const cp = cps[i];
      if (!cp) continue;
      const isNext = i === snap.nextIdx;
      const tint = isNext ? 0x6cf0ff : 0x355c66;
      const core = new MeshClass(
        new CylinderGeometry(0.3, 0.36, 1.6, 12),
        new MeshStandardMaterial({
          color: 0x0a1418,
          emissive: tint,
          emissiveIntensity: isNext ? 1.4 : 0.5,
          roughness: 0.8,
          metalness: 0.1,
        }),
      );
      core.position.set(cp.x, 0.8, cp.z);
      const halo = new MeshClass(
        new CylinderGeometry(0.7, 0.7, 0.08, 24),
        new MeshStandardMaterial({
          color: 0x000000,
          emissive: tint,
          emissiveIntensity: isNext ? 1.1 : 0.35,
          transparent: true,
          opacity: 0.45,
          roughness: 1,
        }),
      );
      halo.position.set(cp.x, 0.05, cp.z);
      const g = new Group();
      g.add(core);
      g.add(halo);
      missionGroup.add(g);
      checkpointMarkers.push({
        group: g,
        coreMat: core.material as MeshStandardMaterialType,
        glowMat: halo.material as MeshStandardMaterialType,
        idx: i,
      });
    }
    // Glowing route line connecting consecutive checkpoints. Vertex colors
    // taper from full bright at the NEXT checkpoint back to faint at the
    // previous one so the runner reads which direction to walk.
    if (cps.length >= 2) {
      const verts: number[] = [];
      const colors: number[] = [];
      for (let i = 0; i < cps.length - 1; i++) {
        const a = cps[i];
        const b = cps[i + 1];
        if (!a || !b) continue;
        verts.push(a.x, 0.06, a.z, b.x, 0.06, b.z);
        // segment closer to a yet-to-reach checkpoint glows brighter.
        const futureA = i >= snap.nextIdx ? 1 : 0.3;
        const futureB = i + 1 >= snap.nextIdx ? 1 : 0.3;
        colors.push(0.42 * futureA, 0.94 * futureA, 1.0 * futureA);
        colors.push(0.42 * futureB, 0.94 * futureB, 1.0 * futureB);
      }
      const geom = new BufferGeometry();
      geom.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
      geom.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
      routeLine = new Line(
        geom,
        new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }),
      );
      missionGroup.add(routeLine);
    }
  }
  buildMissionMarkers();
  const unsubscribeMission = subscribeMissionChanges(() => buildMissionMarkers());

  // Bootstrap the runner's mission state from the device-local progress
  // store (PR 81). On a fresh device this picks MISSIONS[0]; on a returning
  // runner it picks the first unfinished mission in the chain, keeping
  // their place across reloads. Without this, every page load reset to
  // MISSIONS[0] and re-handed out the reputation reward.
  // Guests see the markers without a server-side row — the
  // `start_mission` / `complete_mission` RPCs no-op without auth.
  if (!getActiveMission()) {
    const progress = getMissionProgressLocal();
    const targetKey = progress.active ?? nextMissionKey(progress.completed);
    if (targetKey) {
      const mission = MISSIONS.find((m) => m.key === targetKey);
      if (mission) {
        const state: MissionState = progress.active === targetKey ? progress.activeState : 'active';
        const nextIdx = progress.active === targetKey ? progress.nextIdx : 0;
        setActiveMission({
          mission,
          nextIdx,
          state,
          factionChoice: null,
        });
      }
    }
  }

  const skyboxMaterial = new ShaderMaterial({
    uniforms: { uTime: new Uniform(0) },
    vertexShader: /* glsl */ `
      varying vec2 vUvSky;
      void main() {
        vUvSky = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUvSky;

      float hash1(float x) { return fract(sin(x * 12.9898) * 43758.5453); }

      void main() {
        float colCount = 96.0;
        float col = floor(vUvSky.x * colCount);
        float colSeed = hash1(col + 7.13);
        float speed = 0.45 + colSeed * 0.7;
        float v = vUvSky.y * 12.0 - uTime * speed;
        float row = floor(v);
        float cellSeed = hash1(col * 17.31 + row * 31.7);
        float headFrac = fract(v);
        float onChar = step(0.55, cellSeed);
        float intensity = onChar * smoothstep(0.0, 0.4, headFrac) * smoothstep(1.0, 0.55, headFrac);
        float vFade = smoothstep(0.05, 0.35, vUvSky.y) * smoothstep(1.0, 0.6, vUvSky.y);
        intensity *= vFade;
        vec3 color = vec3(0.42, 0.28, 0.65) * intensity;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: BackSide,
    depthWrite: false,
    depthTest: true,
  });
  // Radius bumped 45 -> 90 with the mega-batch-2 map doubling so the backdrop
  // still encloses the visible near-field (it follows the player each frame).
  const skybox = new MeshClass(new CylinderGeometry(90, 90, 44, 48, 1, true), skyboxMaterial);
  skybox.position.y = 8;
  scene.add(skybox);
  worldToggle.push(skybox);

  const rig = buildClassRig(className);
  rig.root.traverse((obj) => {
    obj.layers.set(CHARACTER_LAYER);
  });
  // Scatter the local rig on a small ring so multiple tabs / runners don't
  // spawn-stack at (0,0). The server scatters too (sphere-room.ts onJoin), so
  // both ends pick a random off-origin coord on join; once the local rig
  // sends its first 'move', the two converge on the client's choice.
  {
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.5 + Math.random() * 2.5;
    rig.root.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  }
  scene.add(rig.root);

  // ─── Equipped-cosmetic appearance (Chunk B, devlog 0040) ─────────────
  // The ONLY crossing of the mini-game isolation boundary: scene reads the
  // appearance seam (resolved descriptors) — no economy/shop internals leak
  // in. With nothing equipped, applySkin(null) restores factory materials, so
  // the default rig is byte-identical to before (zero regression).
  const DEFAULT_HEX = 0xffffff;
  const PALETTE: Record<string, number> = {
    slate: 0x8893a3,
    viridian: 0x2ec4a0,
    aurora: 0x7ef0c8,
    ember: 0xff7a3c,
  };
  const paletteHex = (name: string): number => PALETTE[name] ?? DEFAULT_HEX;

  // Equipped cosmetics read flat/washed once the scene passes through the
  // grayscale ASCII post-process. Push the clothing/pet palette ~20% more
  // saturated at the material level so the hue survives the luminance ramp
  // and the per-theme tint (mega-batch 4.7). Tuned in HSL so lightness is
  // preserved — only chroma rises.
  const CLOTHING_SAT_BOOST = 1.2;
  const _satHsl = { h: 0, s: 0, l: 0 };
  const _satColor = new Color();
  const setSaturated = (c: Color, hex: number): void => {
    _satColor.setHex(hex);
    _satColor.getHSL(_satHsl);
    _satColor.setHSL(_satHsl.h, Math.min(1, _satHsl.s * CLOTHING_SAT_BOOST), _satHsl.l);
    c.copy(_satColor);
  };

  function applySkin(t: SkinTarget, slot: SlotAppearance | null): void {
    if (!slot) {
      t.mat.color.setHex(t.baseColor);
      t.mat.emissive.setHex(t.baseEmissive);
      t.mat.emissiveIntensity = t.baseEmissiveIntensity;
      return;
    }
    setSaturated(t.mat.color, paletteHex(slot.palette));
    // rarity escalates the glow: normal = recolour only; rare (effect) glows;
    // ultra (texture) glows hardest.
    if (slot.effect) {
      setSaturated(t.mat.emissive, paletteHex(slot.palette));
      t.mat.emissiveIntensity = slot.texture ? 1.9 : 1.1;
    } else {
      t.mat.emissive.setHex(t.baseEmissive);
      t.mat.emissiveIntensity = t.baseEmissiveIntensity;
    }
  }

  let petMesh: Mesh | null = null;
  let petGeom: BufferGeometry | null = null;
  let petMat: MeshStandardMaterialType | null = null;
  let petId: string | null = null;

  const disposePet = (): void => {
    if (petMesh) rig.petAnchor.remove(petMesh);
    petGeom?.dispose();
    petMat?.dispose();
    petMesh = null;
    petGeom = null;
    petMat = null;
    petId = null;
  };

  function applyAppearance(): void {
    const a: EquippedAppearance = getEquippedAppearance();
    applySkin(rig.skin.head, a.head);
    applySkin(rig.skin.chest, a.chest);
    applySkin(rig.skin.legs, a.legs);

    if (a.pet) {
      // Rebuild when the pet changes — each one has a distinct shape.
      if (!petMesh || petId !== a.pet.itemId) {
        disposePet();
        petGeom = petGeometryFor(a.pet.itemId);
        petMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.3 });
        petMesh = new MeshClass(petGeom, petMat);
        petMesh.position.set(0.5, 0, 0.1);
        petMesh.layers.set(CHARACTER_LAYER);
        rig.petAnchor.add(petMesh);
        petId = a.pet.itemId;
      }
      if (petMat) {
        setSaturated(petMat.color, paletteHex(a.pet.palette));
        setSaturated(petMat.emissive, paletteHex(a.pet.palette));
        petMat.emissiveIntensity = a.pet.texture ? 1.8 : 1.1;
      }
    } else if (petMesh) {
      disposePet();
    }
  }

  applyAppearance();
  const unsubscribeAppearance = subscribeAppearance(applyAppearance);

  // ─── Admin shadow figure (hidden until encounter) ────────────────────
  // Shadow/silhouette of a hunched man made of black/dark gray boxes,
  // appears beside the obelisk during the "admin hacks user" event (item 13).
  const adminShadow = new Group();
  const adminMat = new MeshStandardMaterial({
    color: 0x06060a,
    roughness: 1,
    metalness: 0,
    emissive: 0x0c0820,
    emissiveIntensity: 0.35,
  });
  const adminDark = new MeshStandardMaterial({
    color: 0x121420,
    roughness: 1,
    metalness: 0,
    emissive: 0x080414,
    emissiveIntensity: 0.25,
  });
  const adminTorso = new MeshClass(new BoxGeometry(0.5, 0.62, 0.36), adminMat);
  adminTorso.position.set(0, 0.95, 0.04);
  adminTorso.rotation.x = 0.32;
  adminShadow.add(adminTorso);
  const adminHead = new MeshClass(new SphereGeometry(0.18, 12, 8), adminMat);
  adminHead.position.set(0, 1.4, 0.18);
  adminShadow.add(adminHead);
  const adminHood = new MeshClass(new BoxGeometry(0.32, 0.26, 0.28), adminDark);
  adminHood.position.set(0, 1.46, 0.16);
  adminHood.rotation.x = 0.42;
  adminShadow.add(adminHood);
  const adminArmL = new MeshClass(new BoxGeometry(0.13, 0.7, 0.14), adminMat);
  adminArmL.position.set(-0.3, 0.78, 0.16);
  adminArmL.rotation.x = 0.18;
  adminShadow.add(adminArmL);
  const adminArmR = adminArmL.clone();
  adminArmR.position.x = 0.3;
  adminShadow.add(adminArmR);
  const adminLegL = new MeshClass(new BoxGeometry(0.16, 0.6, 0.2), adminMat);
  adminLegL.position.set(-0.12, 0.32, 0);
  adminShadow.add(adminLegL);
  const adminLegR = adminLegL.clone();
  adminLegR.position.x = 0.12;
  adminShadow.add(adminLegR);
  adminShadow.visible = false;
  scene.add(adminShadow);

  // ─── Tendril particle pool (item 3c) ────────────────────────────────
  // Thin dash/line marks that spawn on the ground directly under the
  // runner, stay where they spawn, and fade in place. Sparse — almost
  // invisible when idle, a light scatter while moving.
  const TENDRIL_POOL = 24;
  const tendrilGeom = new BoxGeometry(0.26, 0.014, 0.045);
  interface Tendril {
    mesh: Mesh;
    mat: MeshStandardMaterial;
    active: boolean;
    lifetime: number;
    age: number;
  }
  const tendrils: Tendril[] = [];
  for (let i = 0; i < TENDRIL_POOL; i++) {
    const mat = new MeshStandardMaterial({
      color: 0x6a4aa8,
      emissive: 0xb48bff,
      emissiveIntensity: 1.4,
      roughness: 0.6,
      metalness: 0.1,
      transparent: true,
      opacity: 1,
    });
    const mesh = new MeshClass(tendrilGeom, mat);
    mesh.visible = false;
    scene.add(mesh);
    tendrils.push({ mesh, mat, active: false, lifetime: 0, age: 0 });
  }
  let tendrilSpawnAcc = 0;

  function spawnTendril(): void {
    const slot = tendrils.find((t) => !t.active);
    if (!slot) return;
    // Confined to the surface area directly under the character.
    const radius = 0.12 + Math.random() * 0.42;
    const angle = Math.random() * Math.PI * 2;
    slot.mesh.position.set(
      rig.root.position.x + Math.cos(angle) * radius,
      0.045,
      rig.root.position.z + Math.sin(angle) * radius,
    );
    slot.mesh.rotation.set(0, Math.random() * Math.PI, 0);
    slot.mesh.scale.set(0.7 + Math.random() * 0.7, 1, 1);
    slot.mesh.visible = true;
    slot.mat.emissiveIntensity = 1.4;
    slot.mat.opacity = 1;
    slot.active = true;
    slot.lifetime = 1.4 + Math.random() * 1.1;
    slot.age = 0;
  }

  function updateTendrils(dt: number, isMoving: boolean): void {
    // Far fewer; near-zero when still.
    const targetRate = isMoving ? 4 : 0.35;
    tendrilSpawnAcc += dt * targetRate;
    while (tendrilSpawnAcc >= 1) {
      tendrilSpawnAcc -= 1;
      spawnTendril();
    }
    for (const t of tendrils) {
      if (!t.active) continue;
      t.age += dt;
      if (t.age >= t.lifetime) {
        t.active = false;
        t.mesh.visible = false;
        continue;
      }
      // Stay where spawned; fade emissive + opacity over the lifetime.
      const lifeT = t.age / t.lifetime;
      const fade = 1 - lifeT * lifeT;
      t.mat.emissiveIntensity = 1.4 * fade;
      t.mat.opacity = Math.max(0, fade);
    }
  }

  // ─── Obelisk approach event (item 13) ───────────────────────────────
  let adminEncountered = false;
  const OBELISK_X = 5.5;
  const OBELISK_Z = 5.5;
  const OBELISK_TRIGGER_DIST = 2.6;
  function checkObeliskApproach(): void {
    if (adminEncountered) return;
    const dx = rig.root.position.x - OBELISK_X;
    const dz = rig.root.position.z - OBELISK_Z;
    const wdx =
      ((((dx + PLATFORM_HALF) % PLATFORM_SIZE) + PLATFORM_SIZE) % PLATFORM_SIZE) - PLATFORM_HALF;
    const wdz =
      ((((dz + PLATFORM_HALF) % PLATFORM_SIZE) + PLATFORM_SIZE) % PLATFORM_SIZE) - PLATFORM_HALF;
    const dist = Math.sqrt(wdx * wdx + wdz * wdz);
    if (dist < OBELISK_TRIGGER_DIST) {
      adminEncountered = true;
      adminShadow.position.set(OBELISK_X - 1.6, 0, OBELISK_Z - 0.2);
      adminShadow.lookAt(rig.root.position.x, 0, rig.root.position.z);
      adminShadow.visible = true;
      window.dispatchEvent(new CustomEvent('bitrunners:admin-encounter'));
    }
  }

  // ─── Mission checkpoint proximity (Sub-Phase G) ─────────────────────
  // Wraps the player → next-checkpoint delta and advances the active mission
  // when the player crosses the trigger radius. The final checkpoint flips
  // the mission to 'final' and dispatches 'bitrunners:mission-final' which
  // the MissionDialogue listens for.
  function checkMissionApproach(): void {
    const snap = getActiveMission();
    if (!snap || snap.state === 'complete' || snap.state === 'final') return;
    const cp = snap.mission.checkpoints[snap.nextIdx];
    if (!cp) return;
    const dx = wrapDelta(rig.root.position.x - cp.x);
    const dz = wrapDelta(rig.root.position.z - cp.z);
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < snap.mission.triggerDist) {
      advanceActiveCheckpoint();
    }
  }

  // ─── SAMM proximity (the vending machine) → walk-up prompt ───────────
  // Fires a range enter/exit event; the React layer shows a "use SAMM" prompt
  // and opens the betting terminal. Coords match the `vending` prop above.
  const SAMM_X = 6.0;
  const SAMM_Z = -5.5;
  const SAMM_TRIGGER_DIST = 2.6;
  let sammInRange = false;
  function checkSammApproach(): void {
    const wdx = wrapDelta(rig.root.position.x - SAMM_X);
    const wdz = wrapDelta(rig.root.position.z - SAMM_Z);
    const near = wdx * wdx + wdz * wdz < SAMM_TRIGGER_DIST * SAMM_TRIGGER_DIST;
    if (near !== sammInRange) {
      sammInRange = near;
      window.dispatchEvent(new CustomEvent('bitrunners:samm-range', { detail: { inRange: near } }));
    }
  }

  const characterTarget = new WebGLRenderTarget(1, 1, { format: RGBAFormat });

  const worldAtlas = buildGlyphAtlas({
    ramp: ' .·-:;=+*░#▒▓█',
    cellSize: 4,
    fontSize: 6,
  });
  const characterAtlas = buildGlyphAtlas({
    ramp: " '.,:;-+=*#%&@",
    cellSize: 4,
    fontSize: 6,
  });
  const edgeAtlas = buildGlyphAtlas({
    ramp: ' ▀▄▌▐█',
    cellSize: 4,
    fontSize: 6,
  });

  const useNormals =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('normals') === 'on';
  let normalsTarget: WebGLRenderTarget | null = null;
  let normalsMaterial: MeshNormalMaterial | null = null;
  if (useNormals) {
    normalsTarget = new WebGLRenderTarget(1, 1, { format: RGBAFormat });
    normalsMaterial = new MeshNormalMaterial();
  }

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const asciiPass = createAsciiPass({
    atlas: worldAtlas,
    characterAtlas,
    edgeAtlas,
    resolution: { width: 1, height: 1 },
    tint: [0.86, 0.93, 0.88],
    tintTop: [0.72, 0.5, 0.95],
    background: [0.025, 0.04, 0.035],
    lumGain: 1.18,
    lumBias: 0.04,
    gamma: 1.0,
    dither: 0.55,
    orderedDither: true,
    edgeStrength: 1.0,
    edgeThreshold: 0.22,
    characterTexture: characterTarget.texture,
    backgroundDim: 0.55,
    characterGlow: 1.55,
    normalsTexture: normalsTarget?.texture,
  });
  composer.addPass(asciiPass);

  // CRT/diode finishing pass (scanlines + vignette + faint chromatic split).
  // On by default; ?crt=off disables it (perf escape hatch on weak devices).
  const crtEnabled =
    typeof window === 'undefined' ||
    new URLSearchParams(window.location.search).get('crt') !== 'off';
  const crtPass = crtEnabled
    ? createCrtPass({ scanline: 0.1, vignette: 0.26, aberration: 0.05 })
    : null;
  if (crtPass) composer.addPass(crtPass);

  composer.addPass(new OutputPass());

  const fpsEl = document.createElement('div');
  fpsEl.className = 'fps';
  fpsEl.textContent = '-- fps';
  host.appendChild(fpsEl);

  // Declared up-front so subscribeIdentity()'s synchronous initial callback can
  // safely reference it (otherwise the `let` would be in the TDZ at first
  // invocation and the scene init would throw a black-screen ReferenceError).
  let netSession: NetworkSession | null = null;

  // Local player's floating name tag. Reads the resolved displayName from
  // profile.ts (signed-in users see their approved handle; guests get a
  // deterministic `runner_xxxxxx` placeholder).
  //
  // Tap regions (PR 79):
  //   - badge slot  → opens the Badges modal
  //   - name + sub  → opens the runner-identity editor
  const playerTagEl = document.createElement('div');
  playerTagEl.className = 'player-tag player-tag--self';
  const playerTagBadgeBtn = document.createElement('button');
  playerTagBadgeBtn.type = 'button';
  playerTagBadgeBtn.className = 'player-tag-slot player-tag-slot--badge';
  playerTagBadgeBtn.setAttribute('aria-label', 'open badges');
  const playerTagBadge = document.createElement('span');
  playerTagBadge.className = 'player-tag-badge';
  playerTagBadgeBtn.appendChild(playerTagBadge);
  const playerTagNameBtn = document.createElement('button');
  playerTagNameBtn.type = 'button';
  playerTagNameBtn.className = 'player-tag-slot player-tag-slot--name';
  playerTagNameBtn.setAttribute('aria-label', 'edit runner identity');
  const playerTagName = document.createElement('span');
  playerTagName.className = 'player-tag-name';
  const playerTagAlert = document.createElement('span');
  playerTagAlert.className = 'player-tag-alert';
  playerTagAlert.textContent = '!';
  const playerTagSub = document.createElement('span');
  playerTagSub.className = 'player-tag-sub';
  playerTagSub.textContent = '// tap to edit';
  playerTagNameBtn.appendChild(playerTagName);
  playerTagNameBtn.appendChild(playerTagAlert);
  playerTagNameBtn.appendChild(playerTagSub);
  const playerTagLevel = document.createElement('span');
  playerTagLevel.className = 'player-tag-level';
  playerTagLevel.style.display = 'none';
  playerTagEl.appendChild(playerTagBadgeBtn);
  playerTagEl.appendChild(playerTagLevel);
  playerTagEl.appendChild(playerTagNameBtn);
  host.appendChild(playerTagEl);
  playerTagBadgeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    try {
      window.dispatchEvent(new CustomEvent('bitrunners:open-badges'));
    } catch {
      // non-DOM env — ignore
    }
  });
  playerTagNameBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    try {
      window.dispatchEvent(new CustomEvent('bitrunners:edit-identity'));
    } catch {
      // non-DOM env — ignore
    }
  });

  function applyTag(
    el: HTMLElement,
    nameSpan: HTMLElement,
    badgeSpan: HTMLElement,
    alertSpan: HTMLElement | null,
    displayName: string,
    badgeKey: string,
    unacknowledged: number,
    isSelf = false,
  ): void {
    nameSpan.textContent = displayName || 'runner';
    const meta = badgeKey ? BADGES[badgeKey] : null;
    if (meta) {
      badgeSpan.textContent = meta.glyph;
      badgeSpan.style.color = meta.tint;
      badgeSpan.classList.remove('player-tag-badge--empty');
      badgeSpan.style.display = '';
    } else if (isSelf) {
      // Local-only placeholder so the badge slot is discoverable even
      // before any badge is earned. Tapping opens the Badges modal so
      // the runner can see the full tier ladder.
      badgeSpan.textContent = '◇';
      badgeSpan.style.color = '';
      badgeSpan.classList.add('player-tag-badge--empty');
      badgeSpan.style.display = '';
    } else {
      badgeSpan.textContent = '';
      badgeSpan.classList.remove('player-tag-badge--empty');
      badgeSpan.style.display = 'none';
    }
    if (alertSpan) {
      alertSpan.style.display = unacknowledged > 0 ? '' : 'none';
    }
  }

  // Sets "Lv N" on a level span, or hides it when the runner has no badges
  // yet (level 0). Shared by the local + remote tags.
  function applyLevel(levelSpan: HTMLElement, level: number): void {
    if (level > 0) {
      levelSpan.textContent = `Lv ${level}`;
      levelSpan.style.display = '';
    } else {
      levelSpan.textContent = '';
      levelSpan.style.display = 'none';
    }
  }

  // Initial render + identity subscription.
  let localIdentity: LocalIdentity = getIdentity();
  let localNameStyle: NameStyle = { ...getNameStyle() };
  let localLevel = getLevel();
  function applyLocalNameStyle(): void {
    const cls = nameStyleClass(localNameStyle, localIdentity.signedIn);
    playerTagName.className = `player-tag-name${cls ? ` ${cls}` : ''}`;
  }
  applyTag(
    playerTagEl,
    playerTagName,
    playerTagBadge,
    playerTagAlert,
    localIdentity.displayName,
    localIdentity.equippedBadge,
    localIdentity.unacknowledged,
    true,
  );
  applyLocalNameStyle();
  applyLevel(playerTagLevel, localLevel);
  // Apply the stored theme immediately (no-ops for empty string / guest).
  applyThemeToPass(asciiPass, localIdentity.equippedTheme);

  const unsubscribeIdentity = subscribeIdentity((next) => {
    const wasName = localIdentity.displayName;
    const wasBadge = localIdentity.equippedBadge;
    const wasTheme = localIdentity.equippedTheme;
    const wasSignedIn = localIdentity.signedIn;
    localIdentity = next;
    applyTag(
      playerTagEl,
      playerTagName,
      playerTagBadge,
      playerTagAlert,
      next.displayName,
      next.equippedBadge,
      next.unacknowledged,
      true,
    );
    // The signed-in flip changes whether name styling applies.
    if (wasSignedIn !== next.signedIn) applyLocalNameStyle();
    // Hot-swap the ASCII tints whenever the equipped theme changes.
    if (wasTheme !== next.equippedTheme) {
      applyThemeToPass(asciiPass, next.equippedTheme);
    }
    // Sync any changed identity field to the room so other clients see it.
    if (
      netSession &&
      (wasName !== next.displayName ||
        wasBadge !== next.equippedBadge ||
        wasTheme !== next.equippedTheme)
    ) {
      netSession.sendIdentity({
        displayName: next.displayName,
        equippedBadge: next.equippedBadge,
        equippedTheme: next.equippedTheme,
      });
    }
  });
  const unsubscribeNameStyle = subscribeNameStyle((next) => {
    localNameStyle = { ...next };
    applyLocalNameStyle();
    // Broadcast styling so other clients render it (account-only).
    if (netSession && localIdentity.signedIn) {
      netSession.sendIdentity({ nameWeight: next.weight, nameTint: next.tint });
    }
  });
  const unsubscribeLevel = subscribeLevel((next) => {
    localLevel = next;
    applyLevel(playerTagLevel, next);
    if (netSession) netSession.sendIdentity({ level: next });
  });

  // Class string for a REMOTE runner's styled name from the wire values.
  // Remotes that send a non-default style are signed in by construction, so we
  // pass signedIn=true; guests transmit empty strings → no class.
  function remoteNameClass(weight: string, tint: string): string {
    const cls = nameStyleClass(
      {
        v: 1,
        weight: weight === 'bold' ? 'bold' : 'regular',
        tint: (tint || 'none') as NameStyle['tint'],
      },
      true,
    );
    return `player-tag-name${cls ? ` ${cls}` : ''}`;
  }

  function resize(): void {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    characterTarget.setSize(w, h);
    normalsTarget?.setSize(w, h);
    setAsciiPassResolution(asciiPass, w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  const ro = new ResizeObserver(resize);
  ro.observe(host);

  const input = createInput(host);

  let runEnabled = readRunEnabled();
  const onRunSettingChanged = (): void => {
    runEnabled = readRunEnabled();
  };
  window.addEventListener('bitrunners:settings-changed', onRunSettingChanged);

  interface RemoteAvatar {
    group: Group;
    tx: number;
    tz: number;
    trotY: number;
    tagEl: HTMLDivElement;
    tagName: HTMLSpanElement;
    tagBadge: HTMLSpanElement;
    tagLevel: HTMLSpanElement;
  }
  const remoteAvatars = new Map<string, RemoteAvatar>();
  // Reusable buffer published to minimap-state once per tick. Lifetime
  // matches the scene; cleared on dispose so the minimap doesn't keep
  // showing ghosts after the user leaves the room.
  const minimapRemotesScratch: MinimapRemote[] = [];

  function buildRemoteTag(): {
    el: HTMLDivElement;
    nameSpan: HTMLSpanElement;
    badgeSpan: HTMLSpanElement;
    levelSpan: HTMLSpanElement;
  } {
    const el = document.createElement('div');
    el.className = 'player-tag player-tag--remote';
    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'player-tag-badge';
    badgeSpan.style.display = 'none';
    const levelSpan = document.createElement('span');
    levelSpan.className = 'player-tag-level';
    levelSpan.style.display = 'none';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'player-tag-name';
    el.appendChild(badgeSpan);
    el.appendChild(levelSpan);
    el.appendChild(nameSpan);
    host.appendChild(el);
    return { el, nameSpan, badgeSpan, levelSpan };
  }

  // Tap-to-lock state. Click on a remote avatar or NPC dweller to lock the
  // camera onto them + apply a pulsing emissive halo. Click them again, they
  // disconnect, or they walk past LOCK_RELEASE_DISTANCE to release.
  const tapRaycaster = createTargetRaycaster();
  let lockedTarget: LockedTarget | null = null;
  const onCanvasClick = (ev: MouseEvent): void => {
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const ndcX = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    const hit = pickAvatar(tapRaycaster, camera, ndcX, ndcY, remoteAvatars);
    if (!hit) return; // tap on background — keep current lock as-is
    // In tether targeting mode a tap offers a tether to the tapped runner
    // (or dweller NPC) instead of locking the camera. The NPC bots
    // auto-accept and chatter (server-side) so this is testable solo.
    if (isTargeting()) {
      const tapped = remoteAvatars.get(hit.id);
      const name = tapped?.tagName.textContent || 'runner';
      sendTetherRequest({ id: hit.id, name });
      return;
    }
    if (lockedTarget?.id === hit.id) {
      releaseLock(lockedTarget);
      lockedTarget = null;
      return;
    }
    if (lockedTarget) releaseLock(lockedTarget);
    lockedTarget = applyLock(hit.id, hit.group);
  };
  renderer.domElement.addEventListener('click', onCanvasClick);

  // Mouse wheel → zoom. Multiplicative steps feel natural across zoom
  // levels. preventDefault stops the page from scrolling on desktop
  // browsers; passive=false is required for that to work.
  const onWheel = (ev: WheelEvent): void => {
    ev.preventDefault();
    const dir = ev.deltaY > 0 ? 1 : -1;
    const factor = dir > 0 ? 1.1 : 1 / 1.1;
    setZoom(cameraZoom * factor);
  };
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

  // Pinch gesture → zoom. Tracks the initial two-finger distance and rescales
  // cameraZoom proportionally. Single-finger touches fall through to the
  // joystick / input layer; only multi-touch enters this branch.
  let pinchStartDist = 0;
  let pinchStartZoom = cameraZoom;
  const touchDistance = (t: TouchList): number => {
    const a = t[0];
    const b = t[1];
    if (!a || !b) return 0;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  };
  const onTouchStart = (ev: TouchEvent): void => {
    if (ev.touches.length < 2) return;
    pinchStartDist = touchDistance(ev.touches);
    pinchStartZoom = cameraZoom;
  };
  const onTouchMove = (ev: TouchEvent): void => {
    if (ev.touches.length < 2 || pinchStartDist <= 0) return;
    ev.preventDefault();
    const d = touchDistance(ev.touches);
    if (d <= 0) return;
    // Pinch CLOSER (fingers spread) zooms IN — i.e. smaller cameraZoom.
    setZoom(pinchStartZoom * (pinchStartDist / d));
  };
  const onTouchEnd = (ev: TouchEvent): void => {
    if (ev.touches.length < 2) pinchStartDist = 0;
  };
  renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
  renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
  renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: true });
  renderer.domElement.addEventListener('touchcancel', onTouchEnd, { passive: true });

  interface TrackedEmote {
    anchor: HTMLDivElement;
    group: Group;
    until: number;
  }
  const trackedEmotes: TrackedEmote[] = [];

  const clearRemoteAvatars = (): void => {
    for (const ra of remoteAvatars.values()) {
      scene.remove(ra.group);
      if (ra.tagEl.parentNode === host) host.removeChild(ra.tagEl);
    }
    remoteAvatars.clear();
    for (const te of trackedEmotes) {
      if (te.anchor.parentNode === host) host.removeChild(te.anchor);
    }
    trackedEmotes.length = 0;
  };

  function spawnRemoteEmote(group: Group, text: string): void {
    const anchor = document.createElement('div');
    anchor.className = 'emote-anchor';
    const bubble = document.createElement('div');
    bubble.className = 'emote-float';
    bubble.textContent = text;
    anchor.appendChild(bubble);
    host.appendChild(anchor);
    requestAnimationFrame(() => {
      bubble.classList.add('emote-float--rise');
    });
    trackedEmotes.push({ anchor, group, until: performance.now() + EMOTE_MS });
  }

  let lastNetSend = 0;
  let lastMinimapEmit = 0;
  const serverUrl = getServerUrl();
  let sceneDisposed = false;
  let reconnectAttempt = 0;
  const standbyCleanups: Array<() => void> = [];
  const RECONNECT_DELAYS = [3_000, 6_000, 12_000];

  const netEl = document.createElement('div');
  netEl.className = 'net-status';
  host.appendChild(netEl);
  function setNet(text: string, kind: 'idle' | 'connecting' | 'ok' | 'error' = 'idle'): void {
    netEl.textContent = text;
    netEl.dataset.kind = kind;
  }

  // Auth status card — sits directly under the NET card so "am I saving?"
  // is answerable at a glance. Guests get a loud two-line warning; signed-in
  // users get a quiet one-line confirmation.
  const authEl = document.createElement('div');
  authEl.className = 'auth-status';
  host.appendChild(authEl);
  const unsubscribeAuthCard = subscribeAuth((snap) => {
    if (snap.status === 'authenticated') {
      authEl.dataset.kind = 'ok';
      authEl.innerHTML = '';
      const line = document.createElement('div');
      line.className = 'auth-status-line';
      line.textContent = 'logged in · progress saved';
      authEl.appendChild(line);
    } else {
      authEl.dataset.kind = 'warn';
      authEl.innerHTML = '';
      const head = document.createElement('div');
      head.className = 'auth-status-head';
      head.textContent = 'NOT LOGGED IN';
      const sub = document.createElement('div');
      sub.className = 'auth-status-sub';
      sub.textContent = 'PROGRESS NOT SAVED';
      authEl.append(head, sub);
    }
  });
  standbyCleanups.push(() => {
    unsubscribeAuthCard();
    authEl.remove();
  });

  console.info('[bitrunners] VITE_SERVER_URL =', serverUrl ?? '(unset)');
  if (!serverUrl) {
    setNet('net: offline · VITE_SERVER_URL unset', 'idle');
  } else {
    let roomCode = '';
    try {
      roomCode = (localStorage.getItem('bitrunners.settings.roomCode') ?? '').trim();
    } catch {
      // storage unavailable — use matchmaking
    }

    const connectSphere = async (): Promise<void> => {
      if (sceneDisposed) return;
      setNet(`net: connecting · ${serverUrl}`, 'connecting');
      // The auth uid lets the server enforce one live session per account, so
      // a second tab kicks the first instead of leaving an AFK ghost.
      const userId = (await getCurrentUserId()) ?? undefined;
      if (sceneDisposed) return;
      try {
        const session = await joinSphere(
          serverUrl,
          {
            className: 'bit_spekter',
            displayName: localIdentity.displayName,
            equippedBadge: localIdentity.equippedBadge,
            equippedTheme: localIdentity.equippedTheme,
            // Name styling is account-only — only broadcast when signed in.
            nameWeight: localIdentity.signedIn ? localNameStyle.weight : undefined,
            nameTint: localIdentity.signedIn ? localNameStyle.tint : undefined,
            level: localLevel,
            userId,
          },
          {
            onJoin(p) {
              if (remoteAvatars.has(p.id)) return;
              // Server NPCs (id "npc:*") get a dweller silhouette routed by
              // className (the server cycles dweller.robot|husk|spirit).
              // Human remotes get the per-class palette shell.
              const group = p.id.startsWith('npc:')
                ? buildDweller(p.className ?? 'dweller.robot')
                : buildRemoteAvatar(p.className ?? 'bit_spekter');
              const dx = wrapDelta(p.x - rig.root.position.x);
              const dz = wrapDelta(p.z - rig.root.position.z);
              group.position.set(rig.root.position.x + dx, 0, rig.root.position.z + dz);
              group.rotation.y = p.rotY;
              scene.add(group);
              const tag = buildRemoteTag();
              const ra: RemoteAvatar = {
                group,
                tx: p.x,
                tz: p.z,
                trotY: p.rotY,
                tagEl: tag.el,
                tagName: tag.nameSpan,
                tagBadge: tag.badgeSpan,
                tagLevel: tag.levelSpan,
              };
              applyTag(
                ra.tagEl,
                ra.tagName,
                ra.tagBadge,
                null,
                p.displayName || (p.id.startsWith('npc:') ? '' : 'runner'),
                p.equippedBadge,
                0,
              );
              if (!p.id.startsWith('npc:')) {
                ra.tagName.className = remoteNameClass(p.nameWeight, p.nameTint);
                applyLevel(ra.tagLevel, p.level);
              }
              // NPCs don't need a name tag — keep it but show the className.
              if (p.id.startsWith('npc:')) {
                ra.tagName.textContent = `${p.className.replace('dweller.', '')}`;
                ra.tagEl.classList.add('player-tag--npc');
              }
              remoteAvatars.set(p.id, ra);
              setNet(`net: connected · ${remoteAvatars.size} other(s)`, 'ok');
            },
            onLeave(id) {
              const ra = remoteAvatars.get(id);
              if (!ra) return;
              // Release tap-lock if the locked target just disconnected.
              if (lockedTarget?.id === id) {
                releaseLock(lockedTarget);
                lockedTarget = null;
              }
              scene.remove(ra.group);
              if (ra.tagEl.parentNode === host) host.removeChild(ra.tagEl);
              remoteAvatars.delete(id);
              for (let i = trackedEmotes.length - 1; i >= 0; i--) {
                const te = trackedEmotes[i];
                if (!te || te.group !== ra.group) continue;
                if (te.anchor.parentNode === host) host.removeChild(te.anchor);
                trackedEmotes.splice(i, 1);
              }
              setNet(`net: connected · ${remoteAvatars.size} other(s)`, 'ok');
            },
            onUpdate(p) {
              const ra = remoteAvatars.get(p.id);
              if (!ra) return;
              ra.tx = p.x;
              ra.tz = p.z;
              ra.trotY = p.rotY;
            },
            onIdentity(id, p) {
              const ra = remoteAvatars.get(id);
              if (!ra || id.startsWith('npc:')) return;
              applyTag(
                ra.tagEl,
                ra.tagName,
                ra.tagBadge,
                null,
                p.displayName || 'runner',
                p.equippedBadge,
                0,
              );
              ra.tagName.className = remoteNameClass(p.nameWeight, p.nameTint);
              applyLevel(ra.tagLevel, p.level);
            },
            onEmote(id, text) {
              console.info('[bitrunners] remote emote', id.slice(0, 6), text);
              const ra = remoteAvatars.get(id);
              if (ra) spawnRemoteEmote(ra.group, text);
            },
            onTetherIncoming(peer) {
              // Drop silently if the sender is on this runner's block list.
              if (isBlocked(peer.id)) return;
              try {
                window.dispatchEvent(
                  new CustomEvent('bitrunners:tether-incoming', { detail: { peer } }),
                );
              } catch {
                // non-DOM env — ignore
              }
            },
            onTetherAccepted(peer) {
              tetherEstablished(peer);
            },
            onTetherDeclined(_from) {
              tetherDeclined();
            },
            onTetherMessage(_from, body, isEmote) {
              tetherReceive(body, isEmote);
            },
            onTetherEnded(_from) {
              leaveTether();
            },
            onTetherRejected(_reason) {
              tetherSystemNotice('// channel rejected');
            },
            onDisconnect(_code) {
              if (sceneDisposed) return;
              netSession = null;
              setTetherSink(null);
              leaveTether();
              clearRemoteAvatars();
              if (reconnectAttempt < RECONNECT_DELAYS.length) {
                const delay = RECONNECT_DELAYS[reconnectAttempt] ?? 3_000;
                reconnectAttempt++;
                setNet(`net: reconnecting in ${delay / 1000}s…`, 'connecting');
                window.setTimeout(() => void connectSphere(), delay);
              } else {
                setNet('net: disconnected · reload', 'error');
              }
            },
            onSuperseded() {
              if (sceneDisposed) return;
              // A newer tab for this account took over. Do NOT reconnect —
              // that would ping-pong with the live tab. Tear down quietly and
              // show a persistent overlay instead.
              netSession = null;
              setTetherSink(null);
              leaveTether();
              clearRemoteAvatars();
              reconnectAttempt = RECONNECT_DELAYS.length;
              setNet('net: session moved to another tab', 'error');
              showSupersededOverlay(host);
            },
          },
          roomCode || undefined,
        );
        reconnectAttempt = 0;
        netSession = session;
        setTetherSink({
          request: (target) => session.sendTetherRequest(target),
          accept: (from) => session.sendTetherAccept(from),
          decline: (from) => session.sendTetherDecline(from),
          send: (target, body, isEmote) => session.sendTetherMessage(target, body, isEmote),
          leave: (target) => session.sendTetherLeave(target),
        });
        setNet(`net: ok · ${session.sessionId.slice(0, 6)}`, 'ok');
        try {
          window.dispatchEvent(
            new CustomEvent('bitrunners:room-joined', { detail: { roomId: session.roomId } }),
          );
        } catch {
          // non-DOM env — ignore
        }
        console.info('[bitrunners] joined sphere as', session.sessionId);
      } catch (err) {
        const msg = formatNetError(err);
        console.warn('[bitrunners] multiplayer disabled — connect failed:', err);
        setNet(`net: error · ${msg.slice(0, 80)}`, 'error');
      }
    };
    void connectSphere();
    const onStandbyReconnect = (): void => {
      if (sceneDisposed) return;
      if (!netSession) void connectSphere();
    };
    window.addEventListener('bitrunners:standby-reconnect', onStandbyReconnect);
    standbyCleanups.push(() =>
      window.removeEventListener('bitrunners:standby-reconnect', onStandbyReconnect),
    );
  }

  // ─── Page-Visibility standby (Phase 2) ──────────────────────────────
  // Disconnect when the tab is hidden/backgrounded so the avatar leaves
  // the server immediately (instead of waiting ~120s for the idle sweep).
  // Reconnect on visible. Always installed — the standby ribbon shows
  // even when running in offline / single-player mode.
  const onStandbyEnter = (): void => {
    if (sceneDisposed) return;
    if (netSession) {
      const s = netSession;
      netSession = null;
      setTetherSink(null);
      leaveTether();
      clearRemoteAvatars();
      // intentionalLeave inside dispose suppresses onDisconnect callback,
      // so the RECONNECT_DELAYS path does NOT fire — standby is not a
      // network drop.
      void s.dispose();
    }
    setNet('net: standby · tab hidden', 'idle');
    try {
      host.classList.add('is-standby');
    } catch {
      // non-DOM env — ignore
    }
  };
  const onStandbyExit = (): void => {
    if (sceneDisposed) return;
    try {
      host.classList.remove('is-standby');
    } catch {
      // non-DOM env — ignore
    }
    // Only reconnect if a session was established before standby
    // (serverUrl present) AND we don't currently have one.
    if (!netSession && getServerUrl()) {
      reconnectAttempt = 0;
      // connectSphere is a const inside the else-branch closure — re-fire
      // via the same event the disconnect path uses. We dispatch a tiny
      // internal "reconnect" by setting up a no-op timer that the scene
      // tick checks. Simpler: dispatch a custom event the network init
      // block listens for.
      try {
        window.dispatchEvent(new CustomEvent('bitrunners:standby-reconnect'));
      } catch {
        // non-DOM env — ignore
      }
    }
  };
  window.addEventListener(STANDBY_ENTER_EVENT, onStandbyEnter);
  window.addEventListener(STANDBY_EXIT_EVENT, onStandbyExit);
  standbyCleanups.push(() => {
    window.removeEventListener(STANDBY_ENTER_EVENT, onStandbyEnter);
    window.removeEventListener(STANDBY_EXIT_EVENT, onStandbyExit);
  });

  const tempFwd = new Vector3();
  const tempRight = new Vector3();
  const tempMove = new Vector3();
  const worldUp = new Vector3(0, 1, 0);
  const savedClear = new Color();

  let raf = 0;
  let last = performance.now();
  let facing = 0;
  let walkActive = 0;
  let elapsed = 0;
  let frameCount = 0;
  let frameWindowStart = last;
  let hoverY = 0;
  const HOVER_HEIGHT = 0.45;
  const FRAME_INTERVAL_MS = 1000 / 18;
  const tempTag = new Vector3();
  const tempEmote = new Vector3();

  // ── core_run maze mode (mega-batch 2 · 4.5) ──────────────────────────────
  // A self-contained arena rendered in the same scene: the world tiles hide,
  // a MazeArena group shows, and the rig teleports to the maze entrance. The
  // tick swaps in the maze colliders + a shrinking clamp while `mazeActive`,
  // and skips all world proximity / network / minimap work. Driven by window
  // events so the React overlay (CoreRun.tsx) stays decoupled from the scene.
  const MAZE_DURATION_S = 90;
  const MAZE_DISSOLVE_START_S = 30; // dissolve begins at 60 s remaining
  const MAZE_RING_INTERVAL_S = 8;
  const mazeGroup = new Group();
  mazeGroup.visible = false;
  scene.add(mazeGroup);
  let mazeActive = false;
  let mazeArena: MazeArena | null = null;
  let mazeGrid: MazeGrid | null = null;
  let mazeColliders: readonly BoxCollider[] = [];
  let mazeStartElapsed = 0;
  let dissolvedRings = 0;
  let mazeLastSecond = -1;
  let savedRigX = 0;
  let savedRigZ = 0;
  let savedFacing = 0;

  function fireMaze(name: string, detail?: unknown): void {
    try {
      window.dispatchEvent(
        detail === undefined ? new CustomEvent(name) : new CustomEvent(name, { detail }),
      );
    } catch {
      // non-DOM env — ignore
    }
  }

  function setWorldVisibleForMaze(visible: boolean): void {
    for (const o of worldToggle) o.visible = visible;
    for (const ra of remoteAvatars.values()) {
      ra.group.visible = visible;
      ra.tagEl.style.display = visible ? '' : 'none';
    }
  }

  function clampToMaze(pos: Vector3): void {
    if (!mazeArena) return;
    const b = mazeArena.playableBound(dissolvedRings);
    const lo = b.min + PLAYER_RADIUS;
    const hi = b.max - PLAYER_RADIUS;
    pos.x = Math.max(lo, Math.min(hi, pos.x));
    pos.z = Math.max(lo, Math.min(hi, pos.z));
  }

  function enterMaze(): void {
    if (mazeActive) return;
    const seed = Math.floor(Math.random() * 0xffffffff);
    mazeGrid = generateMaze(seed);
    mazeArena = new MazeArena(mazeGrid);
    mazeGroup.add(mazeArena.group);
    mazeColliders = mazeArena.colliders;
    savedRigX = rig.root.position.x;
    savedRigZ = rig.root.position.z;
    savedFacing = facing;
    if (lockedTarget) {
      releaseLock(lockedTarget);
      lockedTarget = null;
    }
    rig.root.position.x = mazeArena.entranceWorld.x;
    rig.root.position.z = mazeArena.entranceWorld.z;
    facing = 0;
    dissolvedRings = 0;
    mazeArena.dissolveTo(0);
    mazeStartElapsed = elapsed;
    mazeLastSecond = -1;
    setWorldVisibleForMaze(false);
    skybox.visible = false;
    mazeGroup.visible = true;
    mazeActive = true;
    fireMaze('bitrunners:maze-enter');
  }

  function exitMaze(): void {
    if (!mazeActive) return;
    mazeActive = false;
    mazeGroup.visible = false;
    if (mazeArena) {
      mazeGroup.remove(mazeArena.group);
      mazeArena.dispose();
      mazeArena = null;
    }
    mazeColliders = [];
    mazeGrid = null;
    setWorldVisibleForMaze(true);
    skybox.visible = true;
    rig.root.position.x = savedRigX;
    rig.root.position.z = savedRigZ;
    facing = savedFacing;
    fireMaze('bitrunners:maze-exit');
  }

  function updateMaze(): void {
    if (!mazeArena || !mazeGrid) return;
    const t = elapsed - mazeStartElapsed;
    const timeLeft = Math.max(0, MAZE_DURATION_S - t);
    // After the grace period, one outer ring dissolves per interval — but never
    // the innermost rings around the goal (else it'd be unreachable).
    let targetRings = 0;
    if (t >= MAZE_DISSOLVE_START_S) {
      targetRings = Math.floor((t - MAZE_DISSOLVE_START_S) / MAZE_RING_INTERVAL_S) + 1;
    }
    targetRings = Math.min(targetRings, (mazeGrid.size - 1) / 2 - 1);
    if (targetRings > dissolvedRings) {
      dissolvedRings = targetRings;
      mazeArena.dissolveTo(dissolvedRings);
      if (mazeArena.isInVoid(rig.root.position.x, rig.root.position.z, dissolvedRings)) {
        exitMaze();
        fireMaze('bitrunners:maze-fail');
        return;
      }
    }
    const cell = mazeArena.worldToCell(rig.root.position.x, rig.root.position.z);
    if (cell.cx === mazeGrid.center.x && cell.cy === mazeGrid.center.y) {
      const secondsLeft = Math.ceil(timeLeft);
      exitMaze();
      fireMaze('bitrunners:maze-win', { secondsLeft });
      return;
    }
    if (timeLeft <= 0) {
      exitMaze();
      fireMaze('bitrunners:maze-fail');
      return;
    }
    const sec = Math.ceil(timeLeft);
    if (sec !== mazeLastSecond) {
      mazeLastSecond = sec;
      // Seconds until the next ring dissolves (or until the storm begins), so
      // the HUD can show the closing-in countdown. -1 once fully closed.
      const maxRings = (mazeGrid.size - 1) / 2 - 1;
      let nextIn = -1;
      if (dissolvedRings < maxRings) {
        nextIn =
          t < MAZE_DISSOLVE_START_S
            ? Math.ceil(MAZE_DISSOLVE_START_S - t)
            : Math.ceil(
                MAZE_RING_INTERVAL_S - ((t - MAZE_DISSOLVE_START_S) % MAZE_RING_INTERVAL_S),
              );
      }
      fireMaze('bitrunners:maze-tick', { timeLeft: sec, rings: dissolvedRings, nextIn });
    }
  }

  const onCoreRunEnter = (): void => enterMaze();
  const onCoreRunAbort = (): void => {
    if (mazeActive) {
      exitMaze();
      fireMaze('bitrunners:maze-abort');
    }
  };
  window.addEventListener('bitrunners:core-run-enter', onCoreRunEnter);
  window.addEventListener('bitrunners:core-run-abort', onCoreRunAbort);

  // ── Landmarks: glitch switch + pressure-plate vault → void (4.6 part 2) ──
  const VOID_HALF = 14;
  const VOID_DOOR = { x: 0, z: 0 };
  const VOID_START = { x: 0, z: 6 };
  const voidGroup = new Group();
  voidGroup.visible = false;
  {
    const floorMat = new MeshStandardMaterial({ color: 0x040507, roughness: 1, metalness: 0 });
    const floor = new MeshClass(new PlaneGeometry(VOID_HALF * 2 + 6, VOID_HALF * 2 + 6), floorMat);
    floor.rotation.x = -Math.PI / 2;
    voidGroup.add(floor);
    const frameMat = new MeshStandardMaterial({
      color: 0x0a0a12,
      emissive: 0x6cf0ff,
      emissiveIntensity: 0.9,
      roughness: 0.4,
    });
    const postGeom = new BoxGeometry(0.2, 2.6, 0.2);
    const postL = new MeshClass(postGeom, frameMat);
    postL.position.set(VOID_DOOR.x - 0.9, 1.3, VOID_DOOR.z);
    const postR = new MeshClass(postGeom, frameMat);
    postR.position.set(VOID_DOOR.x + 0.9, 1.3, VOID_DOOR.z);
    const lintel = new MeshClass(new BoxGeometry(2.0, 0.2, 0.2), frameMat);
    lintel.position.set(VOID_DOOR.x, 2.5, VOID_DOOR.z);
    voidGroup.add(postL, postR, lintel);
  }
  scene.add(voidGroup);
  const voidColliders: BoxCollider[] = [];
  let voidActive = false;

  function clampToVoid(pos: Vector3): void {
    pos.x = Math.max(-VOID_HALF, Math.min(VOID_HALF, pos.x));
    pos.z = Math.max(-VOID_HALF, Math.min(VOID_HALF, pos.z));
  }

  let plateNext = 0;
  let plateOn = -1;
  function setPlateLit(i: number, lit: boolean): void {
    const mat = plateMats[i];
    if (mat) mat.emissiveIntensity = lit ? 1.7 : 0.5;
  }
  function resetPlateLights(): void {
    for (let i = 0; i < plateMats.length; i++) setPlateLit(i, false);
  }

  function enterVoid(): void {
    if (voidActive || mazeActive) return;
    savedRigX = rig.root.position.x;
    savedRigZ = rig.root.position.z;
    savedFacing = facing;
    if (lockedTarget) {
      releaseLock(lockedTarget);
      lockedTarget = null;
    }
    rig.root.position.x = VOID_START.x;
    rig.root.position.z = VOID_START.z;
    facing = Math.PI; // face the door (toward −z)
    setWorldVisibleForMaze(false);
    skybox.visible = false;
    voidGroup.visible = true;
    voidActive = true;
    fireMaze('bitrunners:void-enter');
  }
  function exitVoid(): void {
    if (!voidActive) return;
    voidActive = false;
    voidGroup.visible = false;
    setWorldVisibleForMaze(true);
    skybox.visible = true;
    rig.root.position.x = VAULT_RETURN.x;
    rig.root.position.z = VAULT_RETURN.z;
    facing = savedFacing;
    plateNext = 0;
    plateOn = -1;
    resetPlateLights();
    fireMaze('bitrunners:void-exit');
  }
  function updateVoid(): void {
    const dx = rig.root.position.x - VOID_DOOR.x;
    const dz = rig.root.position.z - VOID_DOOR.z;
    if (dx * dx + dz * dz < 1.4 * 1.4) exitVoid();
  }

  const GLITCH_TRIGGER = 2.4;
  let glitchInRange = false;
  function checkGlitchSwitch(): void {
    const dx = wrapDelta(rig.root.position.x - GLITCH_SWITCH.x);
    const dz = wrapDelta(rig.root.position.z - GLITCH_SWITCH.z);
    const near = dx * dx + dz * dz < GLITCH_TRIGGER * GLITCH_TRIGGER;
    if (near !== glitchInRange) {
      glitchInRange = near;
      fireMaze('bitrunners:glitch-switch-range', { inRange: near });
    }
  }

  function checkVaultPlates(): void {
    let on = -1;
    for (let i = 0; i < VAULT_PLATES.length; i++) {
      const plate = VAULT_PLATES[i];
      if (!plate) continue;
      const dx = wrapDelta(rig.root.position.x - plate.x);
      const dz = wrapDelta(rig.root.position.z - plate.z);
      if (dx * dx + dz * dz < PLATE_TRIGGER_DIST * PLATE_TRIGGER_DIST) {
        on = i;
        break;
      }
    }
    if (on === plateOn) return; // no transition — avoid re-triggering while standing
    plateOn = on;
    if (on < 0) return;
    if (on === plateNext) {
      setPlateLit(on, true);
      plateNext++;
      if (plateNext >= VAULT_PLATES.length) {
        plateNext = 0;
        resetPlateLights();
        enterVoid();
      }
    } else {
      // Wrong plate — reset the sequence and signal a brief screen flicker.
      plateNext = 0;
      resetPlateLights();
      fireMaze('bitrunners:vault-reset');
    }
  }

  // ── Player-feet landmark arrow (mega-batch 2 fixes) ──────────────────────
  // A glowing ground arrow at the runner's feet that points at the NEAREST
  // landmark (SAMM / obelisk / vault / glitch switch / active checkpoint) when
  // within range; inside the maze it points to the core. Re-aims every frame.
  const LANDMARK_ARROW_RANGE = 22;
  const feetArrow = new Group();
  {
    const aMat = new MeshStandardMaterial({
      color: 0x0a1a12,
      emissive: 0x7effc0,
      emissiveIntensity: 1.5,
      roughness: 0.4,
      transparent: true,
      opacity: 0.92,
    });
    const head = new MeshClass(new ConeGeometry(0.3, 0.7, 4), aMat);
    // Cone tip is +Y; +90° about X lays it flat with the TIP toward +Z (the
    // aim axis, rotation.y = atan2(dx,dz)). −90° would aim the tip at −Z, i.e.
    // back at the player — which was the bug.
    head.rotation.x = Math.PI / 2;
    head.position.z = 0.42;
    feetArrow.add(head);
    const shaft = new MeshClass(new BoxGeometry(0.16, 0.04, 0.55), aMat);
    shaft.position.z = -0.02;
    feetArrow.add(shaft);
  }
  feetArrow.visible = false;
  feetArrow.position.y = 0.08;
  scene.add(feetArrow);

  function activeCheckpointXZ(): { x: number; z: number } | null {
    const snap = getActiveMission();
    if (!snap || snap.state === 'complete' || snap.state === 'final') return null;
    const cp = snap.mission.checkpoints[snap.nextIdx];
    return cp ? { x: cp.x, z: cp.z } : null;
  }

  function updateFeetArrow(): void {
    let dx = 0;
    let dz = 0;
    let show = false;
    if (mazeActive && mazeArena) {
      dx = mazeArena.centerWorld.x - rig.root.position.x;
      dz = mazeArena.centerWorld.z - rig.root.position.z;
      show = true;
    } else if (!voidActive) {
      const targets: Array<{ x: number; z: number }> = [
        { x: SAMM_X, z: SAMM_Z },
        { x: OBELISK_X, z: OBELISK_Z },
        { x: VAULT.x, z: VAULT.z },
        { x: GLITCH_SWITCH.x, z: GLITCH_SWITCH.z },
      ];
      const cp = activeCheckpointXZ();
      if (cp) targets.push(cp);
      let best = LANDMARK_ARROW_RANGE;
      for (const t of targets) {
        const tdx = wrapDelta(t.x - rig.root.position.x);
        const tdz = wrapDelta(t.z - rig.root.position.z);
        const d = Math.hypot(tdx, tdz);
        if (d < best && d > 0.6) {
          best = d;
          dx = tdx;
          dz = tdz;
          show = true;
        }
      }
    }
    feetArrow.visible = show;
    if (!show) return;
    feetArrow.position.x = rig.root.position.x;
    feetArrow.position.z = rig.root.position.z;
    feetArrow.rotation.y = Math.atan2(dx, dz);
  }

  function tick(now: number): void {
    const sinceLast = now - last;
    if (sinceLast < FRAME_INTERVAL_MS - 1) {
      raf = requestAnimationFrame(tick);
      return;
    }
    const dt = Math.min(sinceLast / 1000, 1 / 12);
    last = now;
    elapsed += dt;

    const m = input.intent();
    const moving = m.x !== 0 || m.y !== 0;

    if (moving) {
      tempFwd.subVectors(rig.root.position, camera.position).setY(0).normalize();
      tempRight.crossVectors(tempFwd, worldUp).normalize();
      tempMove.set(0, 0, 0).addScaledVector(tempFwd, -m.y).addScaledVector(tempRight, m.x);
      if (tempMove.lengthSq() > 1) tempMove.normalize();
      // Obstacle collision: try the candidate XZ position; slide along walls.
      const speed = (runEnabled ? RUN_SPEED : WALK_SPEED) * dt;
      slideMoveInto(
        rig.root.position,
        rig.root.position.x + tempMove.x * speed,
        rig.root.position.z + tempMove.z * speed,
        PLAYER_RADIUS,
        mazeActive ? mazeColliders : voidActive ? voidColliders : COLLIDERS,
      );
      if (mazeActive) {
        // Maze arena is bounded (no torus wrap); clamp to the shrinking region.
        clampToMaze(rig.root.position);
      } else if (voidActive) {
        // Void room is a bounded dark area (no wrap); clamp to its extent.
        clampToVoid(rig.root.position);
      } else {
        if (rig.root.position.x > PLATFORM_HALF) rig.root.position.x -= PLATFORM_SIZE;
        else if (rig.root.position.x < -PLATFORM_HALF) rig.root.position.x += PLATFORM_SIZE;
        if (rig.root.position.z > PLATFORM_HALF) rig.root.position.z -= PLATFORM_SIZE;
        else if (rig.root.position.z < -PLATFORM_HALF) rig.root.position.z += PLATFORM_SIZE;
      }
      facing = Math.atan2(tempMove.x, tempMove.z);
    }
    rig.root.rotation.y = facing;

    const targetActive = moving ? 1 : 0;
    walkActive += (targetActive - walkActive) * Math.min(dt * 6, 1);
    const idleAmt = 1 - walkActive;

    // Levitate trail: arms/legs sweep backward, body leans forward while moving.
    rig.armPivotL.rotation.x = walkActive * TRAIL_ARM;
    rig.armPivotR.rotation.x = walkActive * TRAIL_ARM;
    rig.legPivotL.rotation.x = walkActive * TRAIL_LEG;
    rig.legPivotR.rotation.x = walkActive * TRAIL_LEG;
    rig.chest.rotation.x = walkActive * LEAN_CHEST;

    // Idle drift: subtle sway and arm flutter when still.
    rig.chest.rotation.y = Math.sin(elapsed * 0.9) * 0.035 * idleAmt;
    rig.hip.rotation.z = Math.sin(elapsed * 0.6) * 0.022 * idleAmt;
    const idleFlutter = Math.sin(elapsed * 1.4) * 0.04 * idleAmt;
    rig.armPivotL.rotation.z = idleFlutter;
    rig.armPivotR.rotation.z = -idleFlutter;
    rig.hip.rotation.y = 0;

    const targetHover = moving ? HOVER_HEIGHT : 0;
    hoverY += (targetHover - hoverY) * Math.min(dt * 5, 1);
    const idleBreathe = Math.sin(elapsed * 1.1) * 0.018 * idleAmt;
    rig.visual.position.y = hoverY + idleBreathe;

    // Equipped pet: per-pet movement (see pets.ts). Allocation-free.
    if (petMesh) applyPetBehaviour(petId, rig.petAnchor, petMesh, elapsed);

    updateTendrils(dt, moving || hoverY > 0.05);

    if (mazeActive) {
      updateMaze();
    } else if (voidActive) {
      updateVoid();
    } else {
      checkObeliskApproach();
      checkSammApproach();
      checkMissionApproach();
      checkGlitchSwitch();
      checkVaultPlates();
      // Pulse the active checkpoint's emissive intensity so the runner reads
      // the "next" target without staring. Cheap — one material mutation per
      // active checkpoint per frame.
      if (checkpointMarkers.length > 0) {
        const activeIdx = getActiveMission()?.nextIdx ?? -1;
        const t = elapsed;
        for (const m of checkpointMarkers) {
          if (m.idx === activeIdx) {
            const pulse = 1.1 + Math.sin(t * 3.6) * 0.35;
            m.coreMat.emissiveIntensity = pulse;
            m.glowMat.emissiveIntensity = pulse * 0.7;
          }
        }
      }

      // SAMM proximity glow: vending screen brightens + pulses as the player approaches.
      const sammDx = wrapDelta(rig.root.position.x - SAMM_X);
      const sammDz = wrapDelta(rig.root.position.z - SAMM_Z);
      const sammProx = Math.max(
        0,
        Math.min(1, 1 - Math.sqrt(sammDx * sammDx + sammDz * sammDz) / SAMM_TRIGGER_DIST),
      );
      (vendingScreen.material as MeshStandardMaterialType).emissiveIntensity =
        0.7 + sammProx * (0.85 + Math.sin(elapsed * 3.1) * 0.22);

      const portRelX = rig.root.position.x - port.position.x;
      const portRelZ = rig.root.position.z - port.position.z;
      const wrappedDx =
        ((((portRelX + PLATFORM_HALF) % PLATFORM_SIZE) + PLATFORM_SIZE) % PLATFORM_SIZE) -
        PLATFORM_HALF;
      const wrappedDz =
        ((((portRelZ + PLATFORM_HALF) % PLATFORM_SIZE) + PLATFORM_SIZE) % PLATFORM_SIZE) -
        PLATFORM_HALF;
      const portDist = Math.sqrt(wrappedDx * wrappedDx + wrappedDz * wrappedDz);
      const proximity = Math.max(0, Math.min(1, (5 - portDist) / 4));
      const pulse = 0.6 + Math.sin(elapsed * 2.4) * 0.12;
      (portInside.material as MeshStandardMaterialType).emissiveIntensity = pulse + proximity * 0.5;
    }

    updateFeetArrow();

    // Camera follow target: locked avatar if any (auto-release on distance),
    // otherwise the local rig. The remote avatar's group.position is already
    // wrapped near the local player in the remote-interpolation block below,
    // so following it is seamless across the seam.
    let followX = rig.root.position.x;
    let followY = rig.root.position.y;
    let followZ = rig.root.position.z;
    if (lockedTarget) {
      const ra = remoteAvatars.get(lockedTarget.id);
      if (!ra) {
        releaseLock(lockedTarget);
        lockedTarget = null;
      } else {
        const ldx = wrapDelta(ra.tx - rig.root.position.x);
        const ldz = wrapDelta(ra.tz - rig.root.position.z);
        if (Math.hypot(ldx, ldz) > LOCK_RELEASE_DISTANCE) {
          releaseLock(lockedTarget);
          lockedTarget = null;
        } else {
          tickLock(lockedTarget, elapsed);
          followX = ra.group.position.x;
          followY = 0;
          followZ = ra.group.position.z;
        }
      }
    }
    camera.position.set(
      followX + cameraOffset.x * cameraZoom,
      followY + cameraOffset.y * cameraZoom,
      followZ + cameraOffset.z * cameraZoom,
    );
    camera.lookAt(followX, followY + 0.9, followZ);

    // Remote avatars: draw at the periodic image nearest the local player,
    // then exponential-smooth toward it (server only sends ~15 Hz). A jump
    // bigger than half the board is a seam wrap by either player — snap, since
    // the 3x3 tiles are visually identical there anyway.
    if (!mazeActive && !voidActive && remoteAvatars.size > 0) {
      const lerpA = 1 - Math.exp(-REMOTE_LERP_K * dt);
      for (const ra of remoteAvatars.values()) {
        const desX = rig.root.position.x + wrapDelta(ra.tx - rig.root.position.x);
        const desZ = rig.root.position.z + wrapDelta(ra.tz - rig.root.position.z);
        const ddx = desX - ra.group.position.x;
        const ddz = desZ - ra.group.position.z;
        if (Math.abs(ddx) > PLATFORM_HALF || Math.abs(ddz) > PLATFORM_HALF) {
          ra.group.position.set(desX, 0, desZ);
        } else {
          ra.group.position.x += ddx * lerpA;
          ra.group.position.z += ddz * lerpA;
        }
        let dr = ra.trotY - ra.group.rotation.y;
        dr = Math.atan2(Math.sin(dr), Math.cos(dr));
        ra.group.rotation.y += dr * lerpA;
      }
    }

    // In maze mode we freeze outbound moves so the avatar stays parked in the
    // shared world (the rig is off in the maze arena's coordinate space).
    if (!mazeActive && !voidActive && netSession && now - lastNetSend >= NET_SEND_MS) {
      netSession.sendMove(rig.root.position.x, rig.root.position.z, facing);
      lastNetSend = now;
    }

    // Position tick for the starmap minimap. Emits at NET_SEND_HZ so the
    // HUD updates at the same cadence as outbound moves — once per ~67 ms.
    if (!mazeActive && !voidActive && now - lastMinimapEmit >= NET_SEND_MS) {
      publishMinimapTick(rig.root.position.x, rig.root.position.z, facing);
      // Push live remote positions for the minimap dots. Re-using one
      // scratch array — at a full sphere we publish at most 40 entries
      // per tick, but the array reference is kept stable to dodge GC.
      minimapRemotesScratch.length = 0;
      for (const [id, ra] of remoteAvatars) {
        minimapRemotesScratch.push({
          id,
          x: ra.group.position.x,
          z: ra.group.position.z,
        });
      }
      publishMinimapRemotes(minimapRemotesScratch);
      lastMinimapEmit = now;
    }

    skybox.position.x = rig.root.position.x;
    skybox.position.z = rig.root.position.z;
    const uTimeUniform = skyboxMaterial.uniforms.uTime as Uniform<number> | undefined;
    if (uTimeUniform) uTimeUniform.value = elapsed;
    // Drive the circuit-floor pulse (Phase 4).
    if (!floorPlain) {
      const u = (floorMaterial as { uniforms?: CircuitFloorUniforms }).uniforms;
      if (u?.uTime) u.uTime.value = elapsed;
    }

    renderer.getClearColor(savedClear);
    const savedAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    camera.layers.set(CHARACTER_LAYER);
    const sceneBg = scene.background;
    scene.background = null;
    const sceneFog = scene.fog;
    scene.fog = null;
    renderer.setRenderTarget(characterTarget);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    scene.background = sceneBg;
    scene.fog = sceneFog;
    camera.layers.enableAll();
    renderer.setClearColor(savedClear, savedAlpha);

    if (normalsTarget && normalsMaterial) {
      const prevOverride = scene.overrideMaterial;
      scene.overrideMaterial = normalsMaterial;
      const prevBg = scene.background;
      scene.background = null;
      const prevFog = scene.fog;
      scene.fog = null;
      renderer.setClearColor(0x808080, 1);
      renderer.setRenderTarget(normalsTarget);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      scene.overrideMaterial = prevOverride;
      scene.background = prevBg;
      scene.fog = prevFog;
      renderer.setClearColor(savedClear, savedAlpha);
    }

    composer.render();

    // Project the player code badge to screen space (above the head).
    tempTag.set(rig.root.position.x, rig.root.position.y + 2.55 + hoverY, rig.root.position.z);
    tempTag.project(camera);
    const tagX = (tempTag.x * 0.5 + 0.5) * (host.clientWidth || 1);
    const tagY = (-tempTag.y * 0.5 + 0.5) * (host.clientHeight || 1);
    const visible = tempTag.z > -1 && tempTag.z < 1;
    playerTagEl.style.opacity = visible ? '1' : '0';
    playerTagEl.style.transform = `translate(${tagX}px, ${tagY}px) translate(-50%, -100%)`;

    // Project each remote avatar's name tag above its head. NPCs included
    // (their tag was set to the className earlier and reads as a faint label).
    if (!mazeActive && !voidActive && remoteAvatars.size > 0) {
      const hw = host.clientWidth || 1;
      const hh = host.clientHeight || 1;
      for (const ra of remoteAvatars.values()) {
        tempTag.set(ra.group.position.x, 2.55, ra.group.position.z);
        tempTag.project(camera);
        const rx = (tempTag.x * 0.5 + 0.5) * hw;
        const ry = (-tempTag.y * 0.5 + 0.5) * hh;
        const onScreen = tempTag.z > -1 && tempTag.z < 1;
        ra.tagEl.style.opacity = onScreen ? '1' : '0';
        ra.tagEl.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -100%)`;
      }
    }

    // Anchor remote emote bubbles above their avatar's projected screen point.
    for (let i = trackedEmotes.length - 1; i >= 0; i--) {
      const te = trackedEmotes[i];
      if (!te) continue;
      if (now >= te.until) {
        if (te.anchor.parentNode === host) host.removeChild(te.anchor);
        trackedEmotes.splice(i, 1);
        continue;
      }
      tempEmote.set(te.group.position.x, 2.35, te.group.position.z);
      tempEmote.project(camera);
      const ex = (tempEmote.x * 0.5 + 0.5) * (host.clientWidth || 1);
      const ey = (-tempEmote.y * 0.5 + 0.5) * (host.clientHeight || 1);
      const onScreen = tempEmote.z > -1 && tempEmote.z < 1;
      te.anchor.style.opacity = onScreen ? '1' : '0';
      te.anchor.style.transform = `translate(${ex}px, ${ey}px)`;
    }

    frameCount++;
    if (now - frameWindowStart >= 500) {
      const fps = Math.round((frameCount * 1000) / (now - frameWindowStart));
      fpsEl.textContent = `${fps} fps`;
      frameCount = 0;
      frameWindowStart = now;
    }

    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  function triggerEmote(text: string): void {
    netSession?.sendEmote(text);
    const bubble = document.createElement('div');
    bubble.className = 'emote-float';
    bubble.textContent = text;
    host.appendChild(bubble);
    requestAnimationFrame(() => {
      bubble.classList.add('emote-float--rise');
    });
    setTimeout(() => {
      if (bubble.parentNode === host) host.removeChild(bubble);
    }, EMOTE_MS);
  }

  const dispose = (): void => {
    sceneDisposed = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    for (const fn of standbyCleanups) {
      try {
        fn();
      } catch {
        // ignore
      }
    }
    standbyCleanups.length = 0;
    window.removeEventListener('bitrunners:settings-changed', onRunSettingChanged);
    window.removeEventListener('bitrunners:core-run-enter', onCoreRunEnter);
    window.removeEventListener('bitrunners:core-run-abort', onCoreRunAbort);
    if (mazeArena) {
      mazeArena.dispose();
      mazeArena = null;
    }
    voidGroup.traverse((o) => {
      if (o instanceof MeshClass) {
        o.geometry.dispose();
        (o.material as MeshStandardMaterialType).dispose();
      }
    });
    unsubscribeAppearance();
    petGeom?.dispose();
    petMat?.dispose();
    input.dispose();
    renderer.domElement.removeEventListener('click', onCanvasClick);
    renderer.domElement.removeEventListener('wheel', onWheel);
    renderer.domElement.removeEventListener('touchstart', onTouchStart);
    renderer.domElement.removeEventListener('touchmove', onTouchMove);
    renderer.domElement.removeEventListener('touchend', onTouchEnd);
    renderer.domElement.removeEventListener('touchcancel', onTouchEnd);
    if (lockedTarget) {
      releaseLock(lockedTarget);
      lockedTarget = null;
    }
    if (netSession) {
      void netSession.dispose();
    }
    for (const ra of remoteAvatars.values()) {
      scene.remove(ra.group);
      if (ra.tagEl.parentNode === host) host.removeChild(ra.tagEl);
    }
    remoteAvatars.clear();
    // Clear the minimap dots — no more remote runners visible from this
    // scene instance.
    publishMinimapRemotes([]);
    unsubscribeIdentity();
    unsubscribeNameStyle();
    unsubscribeLevel();
    unsubscribeMission();
    clearMissionMarkers();
    for (const te of trackedEmotes) {
      if (te.anchor.parentNode === host) host.removeChild(te.anchor);
    }
    trackedEmotes.length = 0;
    crtPass?.material.dispose();
    composer.dispose();
    characterTarget.dispose();
    normalsTarget?.dispose();
    normalsMaterial?.dispose();
    skyboxMaterial.dispose();
    renderer.dispose();
    worldAtlas.texture.dispose();
    characterAtlas.texture.dispose();
    edgeAtlas.texture.dispose();
    tendrilGeom.dispose();
    for (const t of tendrils) t.mat.dispose();
    if (fpsEl.parentNode === host) host.removeChild(fpsEl);
    if (netEl.parentNode === host) host.removeChild(netEl);
    if (playerTagEl.parentNode === host) host.removeChild(playerTagEl);
    if (renderer.domElement.parentNode === host) {
      host.removeChild(renderer.domElement);
    }
  };

  return { dispose, triggerEmote };
}
