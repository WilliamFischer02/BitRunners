import { useEffect, useState } from 'react';
import { ACCOUNT_NUDGE_EVENT, type AccountNudgeDetail, type NudgeReason } from './account-nudge.js';

// Account-needed nudge modal (mega-batch 2 · 4.3). Guest-only; shown when
// `nudgeAccount(reason)` fires for a fresh reason. Terminal aesthetic, reuses
// the `.panel` shell. Never blocks input — ESC, the backdrop, and both buttons
// dismiss it; nothing is captured behind a hard modal.

const REASON_LINE: Record<NudgeReason, string> = {
  minigame: 'you just earned credits.',
  shop: 'you just spent credits in the shop.',
  mission: 'you just completed an objective.',
  badge: 'you just earned a badge.',
  emote: 'you just changed your emote loadout.',
  plot: 'you just built on your data_base plot.',
};

export function AccountNudge(): JSX.Element | null {
  const [reason, setReason] = useState<NudgeReason | null>(null);

  useEffect(() => {
    const onNudge = (e: Event): void => {
      const detail = (e as CustomEvent<AccountNudgeDetail>).detail;
      if (!detail) return;
      // Don't stack — if one is already showing, keep it and ignore the new one.
      setReason((cur) => cur ?? detail.reason);
    };
    window.addEventListener(ACCOUNT_NUDGE_EVENT, onNudge);
    return () => window.removeEventListener(ACCOUNT_NUDGE_EVENT, onNudge);
  }, []);

  useEffect(() => {
    if (!reason) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setReason(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reason]);

  if (!reason) return null;

  const dismiss = (): void => setReason(null);
  const makeAccount = (): void => {
    try {
      window.dispatchEvent(new CustomEvent('bitrunners:open-profile'));
    } catch {
      // non-DOM env — ignore
    }
    setReason(null);
  };

  return (
    <div className="panel-backdrop account-nudge-back" onMouseDown={dismiss}>
      <dialog
        open
        className="panel account-nudge"
        aria-modal="true"
        aria-labelledby="account-nudge-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="panel-header">
          <span className="panel-title" id="account-nudge-title">
            {'// save your progress'}
          </span>
          <button type="button" className="panel-close" onClick={dismiss} aria-label="dismiss">
            ✕
          </button>
        </header>
        <section className="panel-section">
          <div className="account-nudge-lead">{REASON_LINE[reason]}</div>
          <div className="account-nudge-body">
            you're playing as a guest — this progress lives only on this device. make an account and
            it follows you to any browser or phone.
          </div>
          <div className="account-nudge-row">
            <button
              type="button"
              className="panel-action account-nudge-primary"
              onClick={makeAccount}
            >
              [ make account ]
            </button>
            <button type="button" className="panel-action account-nudge-later" onClick={dismiss}>
              [ later ]
            </button>
          </div>
        </section>
        <footer className="panel-footer">press [esc] or tap outside to dismiss</footer>
      </dialog>
    </div>
  );
}
