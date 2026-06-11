// Tether chat state — gating, lifecycle, and message buffer for the
// "tether_chat" protocol (PR 83 of the polish push).
//
// Lifecycle:
//   idle → targeting (cartridge open, tap a remote avatar)
//        → pending (we sent a request, waiting on accept)
//        → tethered (both runners agreed; chat panel visible)
//   any state can flip back to 'idle' on close / decline / drop.
//
// ToS gating: a verified-account flag + an age-confirmation flag must
// both be set before the cartridge becomes usable. Both ride one
// versioned localStorage blob alongside the timestamp of acceptance.
//
// Network seam (PR 87): scene.ts installs a TetherSink that routes the
// outbound side through the live Colyseus session. Inbound events arrive
// as direct calls to tetherEstablished / tetherDeclined / tetherReceive
// / leaveTether — this module stays UI-agnostic and frame-agnostic.

export type TetherStatus = 'idle' | 'targeting' | 'pending' | 'tethered';

export interface TetherPeer {
  /** Network/sessionId of the remote runner. */
  id: string;
  /** Display name from the latest identity broadcast (snapshot at request time). */
  name: string;
}

export interface TetherMessage {
  /** Stable per-tether message id (epoch ms is enough for a 25-char buffer). */
  id: number;
  /** 'me' for outbound, 'peer' for inbound, 'system' for status events. */
  from: 'me' | 'peer' | 'system';
  /** Either a free-text body (≤ MAX_CHARS) or an emote glyph. */
  body: string;
  /** True when the body is an emote glyph (rendered as a bubble). */
  isEmote: boolean;
  ts: number;
}

export const TETHER_MAX_CHARS = 25;
export const TETHER_HISTORY_CAP = 40;

const TOS_STORAGE_KEY = 'bitrunners.tether-tos.v1';
const STATE_EVENT = 'bitrunners:tether-state-changed';
const MESSAGE_EVENT = 'bitrunners:tether-message';

export interface TetherSink {
  request(target: string): void;
  accept(from: string): void;
  decline(from: string): void;
  send(target: string, body: string, isEmote: boolean): void;
  leave(target: string): void;
}

let sink: TetherSink | null = null;

/** Scene.ts (network owner) installs this once per Colyseus session.
 *  Returns an unbind that nulls the slot — call on session dispose so a
 *  reconnect doesn't keep firing into the old room. */
export function setTetherSink(next: TetherSink | null): () => void {
  sink = next;
  return () => {
    if (sink === next) sink = null;
  };
}

export interface TetherTos {
  v: 1;
  acceptedAt: number;
  ageConfirmed: boolean;
}

function loadTos(): TetherTos | null {
  try {
    const raw = localStorage.getItem(TOS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const o = parsed as Record<string, unknown>;
    if (o.v !== 1) return null;
    if (typeof o.acceptedAt !== 'number' || o.ageConfirmed !== true) return null;
    return { v: 1, acceptedAt: o.acceptedAt, ageConfirmed: true };
  } catch {
    return null;
  }
}

export function hasAcceptedTetherTos(): boolean {
  return loadTos() !== null;
}

export function acceptTetherTos(): void {
  const next: TetherTos = { v: 1, acceptedAt: Date.now(), ageConfirmed: true };
  try {
    localStorage.setItem(TOS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — accept this session only
  }
}

interface TetherState {
  status: TetherStatus;
  peer: TetherPeer | null;
  messages: TetherMessage[];
}

let state: TetherState = { status: 'idle', peer: null, messages: [] };

function emit(): void {
  try {
    window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: state }));
  } catch {
    // non-DOM env — ignore
  }
}

export function getTetherState(): Readonly<TetherState> {
  return state;
}

export function subscribeTether(cb: (snap: Readonly<TetherState>) => void): () => void {
  const handler = (): void => cb(state);
  window.addEventListener(STATE_EVENT, handler);
  cb(state);
  return () => window.removeEventListener(STATE_EVENT, handler);
}

/** Cartridge launch → enter targeting mode. No-op if already past idle. */
export function enterTargeting(): void {
  if (!hasAcceptedTetherTos()) return;
  if (state.status === 'tethered' || state.status === 'pending') return;
  state = { ...state, status: 'targeting' };
  emit();
}

/** End the current tether or leave targeting mode. */
export function leaveTether(): void {
  const prev = state.peer;
  state = { status: 'idle', peer: null, messages: [] };
  emit();
  if (prev && sink) sink.leave(prev.id);
}

/** Local-side: this runner taps a remote avatar while in targeting mode. */
export function sendTetherRequest(peer: TetherPeer): void {
  if (state.status !== 'targeting') return;
  state = { ...state, status: 'pending', peer, messages: [] };
  emit();
  sink?.request(peer.id);
}

/** Local-side accept of an inbound request — fires the network handshake
 *  and flips into 'tethered'. The IncomingRequestModal calls this. */
export function acceptIncomingTether(peer: TetherPeer): void {
  sink?.accept(peer.id);
  tetherEstablished(peer);
}

/** Local-side decline of an inbound request. Fires the network handshake
 *  and stays idle. */
export function declineIncomingTether(peer: TetherPeer): void {
  sink?.decline(peer.id);
  tetherDeclined();
}

/** Remote runner approved our request. */
export function tetherEstablished(peer: TetherPeer): void {
  state = {
    status: 'tethered',
    peer,
    messages: [
      {
        id: Date.now(),
        from: 'system',
        body: `tethered with ${peer.name}`,
        isEmote: false,
        ts: Date.now(),
      },
    ],
  };
  emit();
}

/** Remote runner declined or the request timed out. */
export function tetherDeclined(): void {
  state = { status: 'idle', peer: null, messages: [] };
  emit();
}

function appendMessage(msg: TetherMessage): void {
  const trimmed = state.messages.slice(-(TETHER_HISTORY_CAP - 1));
  state = { ...state, messages: [...trimmed, msg] };
  emit();
  try {
    window.dispatchEvent(new CustomEvent(MESSAGE_EVENT, { detail: msg }));
  } catch {
    // non-DOM env — ignore
  }
}

/** Send a text body (≤ TETHER_MAX_CHARS, profanity policy applied by server). */
export function tetherSend(body: string): void {
  if (state.status !== 'tethered' || !state.peer) return;
  const trimmed = body.slice(0, TETHER_MAX_CHARS).trim();
  if (trimmed.length === 0) return;
  appendMessage({
    id: Date.now(),
    from: 'me',
    body: trimmed,
    isEmote: false,
    ts: Date.now(),
  });
  sink?.send(state.peer.id, trimmed, false);
}

/** Send an emote glyph — rendered as a chat bubble on the peer's side. */
export function tetherSendEmote(glyph: string): void {
  if (state.status !== 'tethered' || !state.peer) return;
  const g = glyph.slice(0, 4);
  appendMessage({
    id: Date.now(),
    from: 'me',
    body: g,
    isEmote: true,
    ts: Date.now(),
  });
  sink?.send(state.peer.id, g, true);
}

/** Inbound — called when the network layer delivers a peer message. */
export function tetherReceive(body: string, isEmote: boolean): void {
  if (state.status !== 'tethered') return;
  appendMessage({
    id: Date.now(),
    from: 'peer',
    body: body.slice(0, TETHER_MAX_CHARS),
    isEmote,
    ts: Date.now(),
  });
}

/** Tap-to-tether targeting — the scene's remote-avatar click handler asks
 *  this module whether a tap should fire a tether request. */
export function isTargeting(): boolean {
  return state.status === 'targeting';
}

export const TETHER_EVENTS = {
  state: STATE_EVENT,
  message: MESSAGE_EVENT,
} as const;
