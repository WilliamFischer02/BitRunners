import { useCallback, useEffect, useRef, useState } from 'react';
import { getLine, getLines } from './dialogue.js';
import {
  type ActiveMissionSnap,
  getActiveMission,
  markActiveComplete,
  subscribeMissionChanges,
} from './missions.js';
import { type MissionFaction, completeMissionRpc } from './supabase.js';
import { playDissolve } from './transitions/dissolve.js';

// Final-checkpoint dialogue. Listens for 'bitrunners:mission-final' and opens.
// Two-choice gameplay surface: pick BitRunner → Admin or Corporate → Company.
// Mirrors AdminDialogue's typing + advance pattern but swaps the emote-grid
// for two text buttons (curated lore lines, not free input).

const TYPE_MS = 32;

type Phase = 'opening' | 'prompt' | 'closing';

interface ToastDetail {
  faction: MissionFaction;
  reward: number;
  newBadges: string[];
}

export function MissionDialogue(): JSX.Element | null {
  const [snap, setSnap] = useState<ActiveMissionSnap | null>(getActiveMission());
  const [open, setOpen] = useState(false);

  useEffect(() => subscribeMissionChanges(setSnap), []);

  useEffect(() => {
    const onFinal = (): void => setOpen(true);
    window.addEventListener('bitrunners:mission-final', onFinal);
    return () => window.removeEventListener('bitrunners:mission-final', onFinal);
  }, []);

  // Mission can be cleared from underneath us (e.g. dispose). Snap a stable
  // local copy so the dialogue can finish its closing animation even after
  // the upstream snap goes back to null.
  const [local, setLocal] = useState<ActiveMissionSnap | null>(null);
  useEffect(() => {
    if (open && snap && !local) setLocal(snap);
    if (!open) setLocal(null);
  }, [open, snap, local]);

  if (!open || !local) return null;
  return <Panel snap={local} onClose={() => setOpen(false)} />;
}

function Panel({ snap, onClose }: { snap: ActiveMissionSnap; onClose(): void }): JSX.Element {
  const mission = snap.mission;
  const [phase, setPhase] = useState<Phase>('opening');
  const [lineIdx, setLineIdx] = useState(0);
  const [shown, setShown] = useState('');
  const [typing, setTyping] = useState(true);
  const [chosen, setChosen] = useState<MissionFaction | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Phase 5: ASCII pixel-crush dissolve on mount.
  useEffect(() => {
    if (rootRef.current) {
      requestAnimationFrame(() => {
        if (rootRef.current) {
          playDissolve(rootRef.current, 'in', { durationMs: 260, cell: 12 });
        }
      });
    }
  }, []);

  const targetLine = (() => {
    if (phase === 'opening') return getLines(mission.dialogue.opening)[lineIdx] ?? '';
    if (phase === 'closing') {
      const key =
        chosen === 'corporate'
          ? mission.dialogue.closingCorporate
          : mission.dialogue.closingBitrunner;
      return getLines(key)[lineIdx] ?? '';
    }
    return '';
  })();

  // Type-on animation. Identical pattern to AdminDialogue.
  useEffect(() => {
    if (!targetLine) {
      setShown('');
      setTyping(false);
      return;
    }
    let cancelled = false;
    let idx = 0;
    setShown('');
    setTyping(true);
    const step = (): void => {
      if (cancelled) return;
      idx++;
      setShown(targetLine.slice(0, idx));
      if (idx >= targetLine.length) {
        setTyping(false);
        return;
      }
      setTimeout(step, TYPE_MS);
    };
    const t = setTimeout(step, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [targetLine]);

  const advance = useCallback((): void => {
    if (typing) {
      setShown(targetLine);
      setTyping(false);
      return;
    }
    if (phase === 'opening') {
      const total = getLines(mission.dialogue.opening).length;
      if (lineIdx < total - 1) {
        setLineIdx((i) => i + 1);
      } else {
        setPhase('prompt');
      }
      return;
    }
    if (phase === 'closing') {
      const key =
        chosen === 'corporate'
          ? mission.dialogue.closingCorporate
          : mission.dialogue.closingBitrunner;
      const total = getLines(key).length;
      if (lineIdx < total - 1) {
        setLineIdx((i) => i + 1);
      } else {
        onClose();
      }
    }
  }, [typing, targetLine, phase, lineIdx, mission.dialogue, chosen, onClose]);

  const pick = async (faction: MissionFaction): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const res = await completeMissionRpc(mission.key, faction, mission.reward);
    if (res.error) {
      // Surface the failure but still allow the runner to retry, since the
      // server is the source of truth and the in-world state shouldn't lie.
      setErr(res.error);
      setBusy(false);
      return;
    }
    // Optimistically flip local state and reveal the closing line. The badge
    // toast (Sub-Phase C) and starmap will react via their own subscriptions.
    markActiveComplete(faction);
    setChosen(faction);
    setLineIdx(0);
    setPhase('closing');
    setBusy(false);
    try {
      const detail: ToastDetail = {
        faction,
        reward: res.data?.score ?? 0,
        newBadges: res.data?.newBadges ?? [],
      };
      window.dispatchEvent(new CustomEvent('bitrunners:mission-complete', { detail }));
    } catch {
      // non-DOM env — ignore
    }
  };

  const onPanelClick = (): void => {
    if (phase === 'prompt') return; // waiting on a choice
    advance();
  };

  return (
    <div className="dialogue-root mission-dialogue" ref={rootRef}>
      <div className="dialogue-veil" aria-hidden="true" />
      <button type="button" className="dialogue-frame" onClick={onPanelClick}>
        <div className="dialogue-head">
          <span className="dialogue-name">▒▓ {mission.title.toUpperCase()} ▓▒</span>
          <span className="dialogue-sub">{'// the aether speaks'}</span>
        </div>
        {phase === 'prompt' ? (
          <div className="dialogue-body">
            <div className="dialogue-prompt">USER&gt; route the scraps</div>
            <div className="mission-choice-grid">
              <button
                type="button"
                className="mission-choice-btn mission-choice-btn--br"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  void pick('bitrunner');
                }}
              >
                <span className="mission-choice-label">
                  {getLine(mission.dialogue.choiceBitrunner)}
                </span>
                <span className="mission-choice-meta">+{mission.reward} BitRunner Samaritan</span>
              </button>
              <button
                type="button"
                className="mission-choice-btn mission-choice-btn--corp"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  void pick('corporate');
                }}
              >
                <span className="mission-choice-label">
                  {getLine(mission.dialogue.choiceCorporate)}
                </span>
                <span className="mission-choice-meta">+{mission.reward} Corporate Samaritan</span>
              </button>
            </div>
            {err && <div className="dialogue-err">! {err}</div>}
          </div>
        ) : (
          <div className="dialogue-body">
            <div className="dialogue-line">
              {shown}
              {typing && <span className="dialogue-caret">▌</span>}
              {!typing && <span className="dialogue-cont">▾</span>}
            </div>
            {phase === 'closing' && chosen && (
              <div className="dialogue-echo">
                you chose: <span>{chosen === 'corporate' ? 'the Company' : 'the Admin'}</span>
              </div>
            )}
          </div>
        )}
      </button>
    </div>
  );
}
