import { useCallback, useEffect, useState } from 'react';
import { EMOTE_GLYPHS, type EmoteId } from './EmoteWheel.js';

interface AdminDialogueProps {
  onClose(): void;
}

const ADMIN_OPENING = ['I...', 'see you...'];

const ADMIN_RESPONSES: Record<EmoteId, string[]> = {
  happy: ['a flicker.', 'warmth. saved.'],
  tired: ['rest is fiction.', 'the void hums.'],
  okay: ['more is coming.', 'not for long.'],
  help: ['I am here.', 'you cannot leave.'],
};

const TYPE_MS = 38;
const POST_TYPE_HOLD_MS = 320;

type Phase = 'opening' | 'prompt' | 'response' | 'closing';

export function AdminDialogue({ onClose }: AdminDialogueProps): JSX.Element {
  const [phase, setPhase] = useState<Phase>('opening');
  const [lineIdx, setLineIdx] = useState(0);
  const [shownText, setShownText] = useState('');
  const [typing, setTyping] = useState(true);
  const [chosen, setChosen] = useState<EmoteId | null>(null);

  // The line to currently reveal, computed from phase + lineIdx + chosen.
  const targetLine = (() => {
    if (phase === 'opening') return ADMIN_OPENING[lineIdx] ?? '';
    if (phase === 'response' && chosen) return ADMIN_RESPONSES[chosen][lineIdx] ?? '';
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
      if (lineIdx < ADMIN_OPENING.length - 1) {
        setLineIdx((i) => i + 1);
      } else {
        setPhase('prompt');
      }
      return;
    }
    if (phase === 'response') {
      const lines = chosen ? ADMIN_RESPONSES[chosen] : [];
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
    <div className="dialogue-root">
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
