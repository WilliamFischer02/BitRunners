import { useCallback, useEffect, useRef, useState } from 'react';
import { getIdentity, subscribeIdentity } from './profile.js';
import {
  TETHER_MAX_CHARS,
  type TetherMessage,
  type TetherPeer,
  type TetherStatus,
  acceptIncomingTether,
  acceptTetherTos,
  declineIncomingTether,
  enterTargeting,
  getTetherState,
  hasAcceptedTetherTos,
  leaveTether,
  subscribeTether,
  tetherSend,
} from './tether-chat.js';

// React surface for the tether_chat protocol (PR 83).
//
// Three sub-components, all driven by tether-chat.ts state:
//   1. TetherChat — root, mounts the cartridge panel + chat overlay.
//   2. TosGate — first-time acceptance: verified-account + age confirm.
//   3. ChatOverlay — sticky chat bubble shown while status === 'tethered'.
//
// The scene's remote-avatar click handler (added in PR 83 scene edit) calls
// isTargeting() before firing a tether request, so this UI doesn't need
// any global listeners beyond subscribeTether.

const OPEN_EVENT = 'bitrunners:open-tether-chat';

export function TetherChat(): JSX.Element {
  return (
    <>
      <TetherCartridge />
      <ChatOverlay />
      <IncomingRequestModal />
    </>
  );
}

function TetherCartridge(): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [tether, setTether] = useState(getTetherState());
  const [id, setId] = useState(getIdentity());

  useEffect(() => subscribeTether(setTether), []);
  useEffect(() => subscribeIdentity(setId), []);

  useEffect(() => {
    const onOpen = (): void => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  if (!open) return null;
  return (
    <TetherPanel
      onClose={() => setOpen(false)}
      tetherStatus={tether.status}
      peer={tether.peer}
      signedIn={id.signedIn}
      approved={id.approved}
    />
  );
}

function TetherPanel({
  onClose,
  tetherStatus,
  peer,
  signedIn,
  approved,
}: {
  onClose(): void;
  tetherStatus: TetherStatus;
  peer: TetherPeer | null;
  signedIn: boolean;
  approved: boolean;
}): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [showTos, setShowTos] = useState(false);

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

  const tosAccepted = hasAcceptedTetherTos();
  const eligible = signedIn && approved;

  const onTether = useCallback((): void => {
    if (!eligible) return;
    if (!tosAccepted) {
      setShowTos(true);
      return;
    }
    enterTargeting();
    onClose();
  }, [eligible, tosAccepted, onClose]);

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
        <TosGate
          onAccepted={() => {
            acceptTetherTos();
            setShowTos(false);
            enterTargeting();
            onClose();
          }}
          onDecline={() => setShowTos(false)}
        />
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
                ─── tap a remote runner after launching to offer a tether. {TETHER_MAX_CHARS}-char
                replies + emote bubbles. profanity policy + audit log apply.
              </div>
              <div className="panel-row">
                <span className="panel-key">{tosAccepted ? 'ready' : 'accept terms to begin'}</span>
                <button type="button" className="panel-toggle is-on" onClick={onTether}>
                  [ {tosAccepted ? 'enter tether mode' : 'review terms'} ]
                </button>
              </div>
            </>
          )}
          {eligible && tetherStatus === 'targeting' && (
            <>
              <div className="panel-stub">
                ─── targeting mode: tap a remote runner to send a request. close to cancel.
              </div>
              <div className="panel-row">
                <span className="panel-key">in targeting…</span>
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
            </>
          )}
        </section>
      )}

      <footer className="panel-footer">
        25-char limit · emote bubbles · per-pair block list · audit log
      </footer>
    </dialog>
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
