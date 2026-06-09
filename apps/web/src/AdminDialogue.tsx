import { useCallback, useEffect, useRef, useState } from 'react';
import { EMOTE_GLYPHS, type EmoteId } from './EmoteWheel.js';
import { getLines } from './dialogue.js';
import { playDissolve } from './transitions/dissolve.js';

interface AdminDialogueProps {
  onClose(): void;
}

const TYPE_MS = 38;
const POST_TYPE_HOLD_MS = 320;

type Phase = 'opening' | 'prompt' | 'response' | 'closing';

export function AdminDialogue({ onClose }: AdminDialogueProps): JSX.Element {
  const [phase, setPhase] = useState<Phase>('opening');
  const [lineIdx, setLineIdx] = useState(0);
  const [shownText, setShownText] = useState('');
  const [typing, setTyping] = useState(true);
  const [chosen, setChosen] = useState<EmoteId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Phase 5: ASCII pixel-crush dissolve at mount, matching the boot→game
  // and menu-modal vocabulary. The typewriter line reveal stays — this is
  // the entrance animation for the *frame*, not the text inside.
  useEffect(() => {
    if (rootRef.current) {
      requestAnimationFrame(() => {
        if (rootRef.current) {
          playDissolve(rootRef.current, 'in', { durationMs: 260, cell: 12 });
        }
      });
    }
  }, []);

  // The line to currently reveal, computed from phase + lineIdx + chosen.
  const targetLine = (() => {
    if (phase === 'opening') return getLines('admin.opening')[lineIdx] ?? '';
    if (phase === 'response' && chosen) return getLines(`admin.${chosen}`)[lineIdx] ?? '';
    return '';
  })();

  // Typing animation.
  useEffect(() => {
    if (!targetLine) {
      setShownText('');
      setTyping(false);
      return;
    }
    let cancelled = false;
    let idx = 0;
    setShownText('');
    setTyping(true);
    const step = (): void => {
      if (cancelled) return;
      idx++;
      setShownText(targetLine.slice(0, idx));
      if (idx >= targetLine.length) {
        setTyping(false);
        return;
      }
      setTimeout(step, TYPE_MS);
    };
    const startTimer = setTimeout(step, 220);
    return () => {
      cancelled = true;
      clearTimeout(startTimer);
    };
  }, [targetLine]);

  // Auto-advance to next line after the user clicks (or after a hold timer when
  // there's no further content for that phase).
  const advance = useCallback((): void => {
    if (typing) {
      // Skip typing to end.
      setShownText(targetLine);
      setTyping(false);
      return;
    }
    if (phase === 'opening') {
      if (lineIdx < getLines('admin.opening').length - 1) {
        setLineIdx((i) => i + 1);
      } else {
        setPhase('prompt');
      }
      return;
    }
    if (phase === 'response') {
      const lines = chosen ? getLines(`admin.${chosen}`) : [];
      if (lineIdx < lines.length - 1) {
        setLineIdx((i) => i + 1);
      } else {
        setPhase('closing');
      }
      return;
    }
    if (phase === 'closing') {
      onClose();
    }
  }, [typing, targetLine, phase, lineIdx, chosen, onClose]);

  // Auto-close on closing phase after a brief hold.
  useEffect(() => {
    if (phase !== 'closing') return;
    const t = setTimeout(onClose, POST_TYPE_HOLD_MS + 240);
    return () => clearTimeout(t);
  }, [phase, onClose]);

  // Click anywhere on the dialogue advances.
  const onPanelClick = (): void => {
    if (phase === 'prompt') return; // wait for emote choice
    advance();
  };

  const pickEmote = (id: EmoteId): void => {
    setChosen(id);
    setLineIdx(0);
    setPhase('response');
  };

  return (
    <div className="dialogue-root" ref={rootRef}>
      <div className="dialogue-veil" aria-hidden="true" />
      <button type="button" className="dialogue-frame" onClick={onPanelClick}>
        <div className="dialogue-head">
          <span className="dialogue-name">▒▓ THE ADMIN ▓▒</span>
          <span className="dialogue-sub">{'// hostile read-access'}</span>
        </div>
        {phase === 'prompt' ? (
          <div className="dialogue-body">
            <div className="dialogue-prompt">USER&gt; respond with an emoticron</div>
            <div className="dialogue-emote-grid">
              {(['happy', 'tired', 'okay', 'help'] as EmoteId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  className="dialogue-emote-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    pickEmote(id);
                  }}
                >
                  <span className="dialogue-emote-glyph">{EMOTE_GLYPHS[id]}</span>
                  <span className="dialogue-emote-label">{id}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="dialogue-body">
            <div className="dialogue-line">
              {shownText}
              {typing && <span className="dialogue-caret">▌</span>}
              {!typing && phase !== 'closing' && <span className="dialogue-cont">▾</span>}
            </div>
            {chosen && (
              <div className="dialogue-echo">
                you sent: <span>{EMOTE_GLYPHS[chosen]}</span>
              </div>
            )}
          </div>
        )}
      </button>
    </div>
  );
}
