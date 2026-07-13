import { useCallback, useEffect, useRef, useState } from 'react';
import { type BlockEntry, getBlocks, removeBlock, subscribeBlocks } from './block-list.js';
import { getIdentity, subscribeIdentity } from './profile.js';
import {
  TETHER_MAX_CHARS,
  type TetherMessage,
  type TetherPeer,
  type TetherStatus,
  acceptIncomingTether,
  acceptTetherTos,
  blockCurrentPeer,
  declineIncomingTether,
  getTetherState,
  hasAcceptedTetherTos,
  leaveTether,
  requestTether,
  subscribeTether,
  tetherSend,
} from './tether-chat.js';

// React surface for tether chat (PR 83; tap-to-tether rework devlog 0156).
//
// Sub-components, all driven by tether-chat.ts state:
//   1. TetherChat — root, mounts the tap driver + panel + chat overlay.
//   2. TetherHub — listens for the scene's avatar-tap event. Gated taps
//      (guest / unapproved handle / ToS missing) open the status panel;
//      gated-in taps fire the request directly and show its progress.
//   3. TosGate — first-time acceptance: verified-account + age confirm.
//   4. ChatOverlay — sticky chat bubble shown while status === 'tethered'.
//
// The scene's remote-avatar click handler dispatches TAP_EVENT for every
// un-blocked avatar tap while no tether is live — no cartridge, no
// targeting arm step.

const TAP_EVENT = 'bitrunners:tether-tap';

export function TetherChat(): JSX.Element {
  return (
    <>
      <TetherHub />
      <ChatOverlay />
      <IncomingRequestModal />
      <BlockedListPanel />
    </>
  );
}

function TetherHub(): JSX.Element | null {
  const [open, setOpen] = useState(false);
  // The runner tapped while a gate (sign-in / approval / ToS) was still
  // closed — held so accepting the ToS can fire their request immediately.
  const [pendingPeer, setPendingPeer] = useState<TetherPeer | null>(null);
  const [tether, setTether] = useState(getTetherState());
  const [id, setId] = useState(getIdentity());

  useEffect(() => subscribeTether(setTether), []);
  useEffect(() => subscribeIdentity(setId), []);

  useEffect(() => {
    const onTap = (e: Event): void => {
      const peer = (e as CustomEvent<{ peer?: TetherPeer }>).detail?.peer;
      if (!peer?.id) return;
      const status = getTetherState().status;
      if (status === 'pending' || status === 'tethered') return; // one pair at a time
      const ident = getIdentity();
      if (!ident.signedIn || !ident.approved || !hasAcceptedTetherTos()) {
        // Gate first: the panel explains sign-in/approval or shows the ToS.
        setPendingPeer(peer);
        setOpen(true);
        return;
      }
      requestTether(peer);
      setOpen(true); // show the pending state (with cancel) right away
    };
    window.addEventListener(TAP_EVENT, onTap);
    return () => window.removeEventListener(TAP_EVENT, onTap);
  }, []);

  if (!open) return null;
  return (
    <TetherPanel
      onClose={() => {
        setOpen(false);
        setPendingPeer(null);
      }}
      tetherStatus={tether.status}
      peer={tether.peer}
      pendingPeer={pendingPeer}
      onPendingPeerConsumed={() => setPendingPeer(null)}
      signedIn={id.signedIn}
      approved={id.approved}
    />
  );
}

function TetherPanel({
  onClose,
  tetherStatus,
  peer,
  pendingPeer,
  onPendingPeerConsumed,
  signedIn,
  approved,
}: {
  onClose(): void;
  tetherStatus: TetherStatus;
  peer: TetherPeer | null;
  /** Runner tapped before the gates were cleared — ToS accept requests them. */
  pendingPeer: TetherPeer | null;
  onPendingPeerConsumed(): void;
  signedIn: boolean;
  approved: boolean;
}): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const tosAccepted = hasAcceptedTetherTos();
  const eligible = signedIn && approved;

  // A gated tap from an eligible runner goes straight to the ToS.
  const [showTos, setShowTos] = useState(() => eligible && !tosAccepted);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const onCancel = (e: Event): void => {
      e.preventDefault();
      onCloseRef.current();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      trigger?.focus();
    };
  }, []);

  const onTosAccepted = useCallback((): void => {
    acceptTetherTos();
    setShowTos(false);
    if (pendingPeer) {
      // Fire the request the original tap asked for; the panel stays open
      // showing the pending state.
      requestTether(pendingPeer);
      onPendingPeerConsumed();
    }
  }, [pendingPeer, onPendingPeerConsumed]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop close is pointer-only; keyboard close routes through the native cancel event
    <dialog
      ref={dialogRef}
      className="panel"
      aria-modal="true"
      aria-labelledby="tether-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="panel-header">
        <span className="panel-title" id="tether-dialog-title">
          {'// tether_chat'}
        </span>
        <button type="button" className="panel-close" onClick={onClose}>
          ✕
        </button>
      </header>

      {showTos ? (
        <TosGate onAccepted={onTosAccepted} onDecline={() => setShowTos(false)} />
      ) : (
        <section className="panel-section">
          <div className="panel-section-title">$ status</div>
          {!signedIn && (
            <div className="panel-stub">
              ─── sign in + verify your handle to open a tether. chat is account-only.
            </div>
          )}
          {signedIn && !approved && (
            <div className="panel-stub">
              ─── your handle is still pending review. tether opens once it's approved.
            </div>
          )}
          {eligible && tetherStatus === 'idle' && (
            <>
              <div className="panel-stub">
                ─── tap a runner out in the world to offer a tether. {TETHER_MAX_CHARS}-char replies
                + emote bubbles. profanity policy + audit log apply.
              </div>
              {!tosAccepted && (
                <div className="panel-row">
                  <span className="panel-key">accept terms to begin</span>
                  <button
                    type="button"
                    className="panel-toggle is-on"
                    onClick={() => setShowTos(true)}
                  >
                    [ review terms ]
                  </button>
                </div>
              )}
            </>
          )}
          {eligible && tetherStatus === 'pending' && peer && (
            <>
              <div className="panel-stub">
                ─── request sent to {peer.name}. waiting on accept / decline.
              </div>
              <div className="panel-row">
                <span className="panel-key">pending</span>
                <button
                  type="button"
                  className="panel-toggle"
                  onClick={() => {
                    leaveTether();
                  }}
                >
                  [ cancel ]
                </button>
              </div>
            </>
          )}
          {eligible && tetherStatus === 'tethered' && peer && (
            <>
              <div className="panel-stub">─── tethered with {peer.name}. chat panel docked.</div>
              <div className="panel-row">
                <span className="panel-key">tethered</span>
                <button
                  type="button"
                  className="panel-toggle"
                  onClick={() => {
                    leaveTether();
                  }}
                >
                  [ end ]
                </button>
              </div>
              <div className="panel-row">
                <span className="panel-key">visit their data_base plot</span>
                <button
                  type="button"
                  className="panel-toggle"
                  onClick={() => {
                    // Scene forwards this to the server's guest-capped
                    // 'visit' message (P7C); read-only walk of their build.
                    try {
                      window.dispatchEvent(
                        new CustomEvent('bitrunners:plot-visit', { detail: { target: peer.id } }),
                      );
                    } catch {
                      // non-DOM env — ignore
                    }
                  }}
                >
                  [ visit ]
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {eligible && !showTos && (
        <section className="panel-section">
          <div className="panel-section-title">$ block list</div>
          <div className="panel-row">
            <span className="panel-key">manage blocked runners</span>
            <button
              type="button"
              className="panel-toggle"
              onClick={() => {
                window.dispatchEvent(new CustomEvent(BLOCK_LIST_OPEN_EVENT));
                onClose();
              }}
            >
              [ open ]
            </button>
          </div>
        </section>
      )}

      <footer className="panel-footer">
        25-char limit · emote bubbles · per-pair block list · audit log
      </footer>
    </dialog>
  );
}

const BLOCK_LIST_OPEN_EVENT = 'bitrunners:open-block-list';

function BlockedListPanel(): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ReadonlyArray<BlockEntry>>(getBlocks());

  useEffect(() => subscribeBlocks(setEntries), []);

  useEffect(() => {
    const onOpen = (): void => setOpen(true);
    window.addEventListener(BLOCK_LIST_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(BLOCK_LIST_OPEN_EVENT, onOpen);
  }, []);

  if (!open) return null;

  return (
    <div className="panel-backdrop" onMouseDown={() => setOpen(false)}>
      <dialog
        open
        className="panel"
        aria-modal="true"
        aria-labelledby="block-list-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="panel-header">
          <span className="panel-title" id="block-list-title">
            {'// block list'}
          </span>
          <button type="button" className="panel-close" onClick={() => setOpen(false)}>
            ✕
          </button>
        </header>
        <section className="panel-section">
          <div className="panel-section-title">$ blocked runners</div>
          {entries.length === 0 && <div className="panel-stub">─── nobody blocked yet.</div>}
          {entries.map((e) => (
            <div key={e.id} className="panel-row">
              <span className="panel-key">{e.name}</span>
              <button type="button" className="panel-toggle" onClick={() => removeBlock(e.id)}>
                [ unblock ]
              </button>
            </div>
          ))}
          <div className="panel-stub">
            ─── block list is local for now. session ids change per join, so a blocked runner can
            return under a new id until the server-side user-uuid block ships.
          </div>
        </section>
        <footer className="panel-footer">click outside or press [esc] to close</footer>
      </dialog>
    </div>
  );
}

function TosGate({
  onAccepted,
  onDecline,
}: {
  onAccepted(): void;
  onDecline(): void;
}): JSX.Element {
  const [age, setAge] = useState(false);
  const [rules, setRules] = useState(false);

  const canAccept = age && rules;

  return (
    <section className="panel-section">
      <div className="panel-section-title">$ terms · age + rules</div>
      <div className="panel-stub">
        ─── tether_chat permits one-pair free-text up to 25 chars per message. server-side filter +
        per-pair block list + 30 msg/min rate limit apply. content is logged for moderation.
      </div>
      <label className="tether-tos-row">
        <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} />
        <span>I am 13 years or older.</span>
      </label>
      <label className="tether-tos-row">
        <input type="checkbox" checked={rules} onChange={(e) => setRules(e.target.checked)} />
        <span>I will not harass other runners. I will use the block list if needed.</span>
      </label>
      <div className="panel-row">
        <button type="button" className="panel-toggle" onClick={onDecline}>
          [ cancel ]
        </button>
        <button
          type="button"
          className={canAccept ? 'panel-toggle is-on' : 'panel-toggle'}
          disabled={!canAccept}
          onClick={onAccepted}
        >
          [ accept + open ]
        </button>
      </div>
    </section>
  );
}

function ChatOverlay(): JSX.Element | null {
  const [tether, setTether] = useState(getTetherState());
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeTether(setTether), []);

  // Auto-scroll on new message.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  if (tether.status !== 'tethered' || !tether.peer) return null;

  const onSend = (): void => {
    const body = draft.slice(0, TETHER_MAX_CHARS).trim();
    if (!body) return;
    tetherSend(body);
    setDraft('');
    inputRef.current?.focus();
  };

  return (
    <output className="tether-overlay" aria-live="polite">
      <header className="tether-overlay-head">
        <span className="tether-overlay-peer">{tether.peer.name}</span>
        <button
          type="button"
          className="tether-overlay-block"
          onClick={() => {
            blockCurrentPeer();
          }}
          aria-label="block runner"
          title="block + end"
        >
          ⊘
        </button>
        <button
          type="button"
          className="tether-overlay-end"
          onClick={() => {
            leaveTether();
          }}
          aria-label="end tether"
        >
          ✕
        </button>
      </header>
      <div className="tether-overlay-list" ref={listRef}>
        {tether.messages.map((m: TetherMessage) => (
          <div
            key={m.id}
            className={`tether-msg tether-msg--${m.from}${m.isEmote ? ' tether-msg--emote' : ''}`}
          >
            {m.body}
          </div>
        ))}
      </div>
      <form
        className="tether-overlay-input"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          maxLength={TETHER_MAX_CHARS}
          placeholder="≤ 25 chars"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, TETHER_MAX_CHARS))}
          aria-label="tether chat message"
        />
        <button type="submit" className="tether-overlay-send" disabled={draft.trim().length === 0}>
          send
        </button>
      </form>
    </output>
  );
}

interface IncomingRequest {
  peer: TetherPeer;
}

function IncomingRequestModal(): JSX.Element | null {
  // The network layer (or a follow-up PR) will dispatch this event with a
  // peer payload when a remote runner sends us a tether request. For now,
  // the cartridge itself triggers it for self-test.
  const [req, setReq] = useState<IncomingRequest | null>(null);

  useEffect(() => {
    const onIncoming = (e: Event): void => {
      const d = (e as CustomEvent<{ peer?: TetherPeer }>).detail;
      if (!d?.peer) return;
      setReq({ peer: d.peer });
    };
    window.addEventListener('bitrunners:tether-incoming', onIncoming);
    return () => window.removeEventListener('bitrunners:tether-incoming', onIncoming);
  }, []);

  if (!req) return null;

  const accept = (): void => {
    acceptIncomingTether(req.peer);
    setReq(null);
  };
  const decline = (): void => {
    declineIncomingTether(req.peer);
    setReq(null);
  };

  return (
    <div className="panel-backdrop" onMouseDown={decline}>
      <dialog
        open
        className="panel tether-incoming"
        aria-modal="true"
        aria-labelledby="tether-incoming-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="panel-header">
          <span className="panel-title" id="tether-incoming-title">
            {'// tether request'}
          </span>
        </header>
        <section className="panel-section">
          <div className="panel-section-title">$ from</div>
          <div className="panel-row">
            <span className="panel-key">handle</span>
            <span className="panel-value">{req.peer.name}</span>
          </div>
          <div className="panel-stub">
            ─── accepting opens a 25-char chat. either side can end at any time.
          </div>
          <div className="panel-row">
            <button type="button" className="panel-toggle" onClick={decline}>
              [ decline ]
            </button>
            <button type="button" className="panel-toggle is-on" onClick={accept}>
              [ accept ]
            </button>
          </div>
        </section>
      </dialog>
    </div>
  );
}
