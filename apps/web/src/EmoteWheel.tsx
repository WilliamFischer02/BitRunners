import { EMOTE_GLYPHS, type EmoteId } from '@bitrunners/shared';

export { EMOTE_GLYPHS };
export type { EmoteId };

interface EmoteWheelProps {
  onEmote(id: EmoteId): void;
  onInventory?(): void;
}

interface SlotDef {
  id: EmoteId;
  glyph: string;
  label: string;
  pos: string;
}

const SLOTS: SlotDef[] = [
  { id: 'wave', glyph: '\\o/', label: 'wave', pos: 'emote-nw' },
  { id: 'happy', glyph: '^_^', label: 'happy', pos: 'emote-n' },
  { id: 'think', glyph: '(?)', label: 'think', pos: 'emote-ne' },
  { id: 'tired', glyph: 'zz', label: 'tired', pos: 'emote-w' },
  // center slot (inventory) rendered between W and E
  { id: 'okay', glyph: '[ok]', label: 'okay', pos: 'emote-e' },
  { id: 'good', glyph: '[+]', label: 'good', pos: 'emote-sw' },
  { id: 'help', glyph: '!?', label: 'help', pos: 'emote-s' },
  { id: 'bad', glyph: '[x]', label: 'bad', pos: 'emote-se' },
];

export function EmoteWheel({ onEmote, onInventory }: EmoteWheelProps): JSX.Element {
  return (
    <div className="emote">
      {SLOTS.slice(0, 4).map((s) => (
        <button
          key={s.id}
          type="button"
          className={`emote-btn ${s.pos}`}
          onMouseDown={(e) => {
            e.preventDefault();
            onEmote(s.id);
          }}
          title={s.label}
        >
          <span className="emote-glyph">{s.glyph}</span>
          <span className="emote-label">{s.label}</span>
        </button>
      ))}
      {onInventory ? (
        <button
          type="button"
          className="emote-btn emote-center"
          onMouseDown={(e) => {
            e.preventDefault();
            onInventory();
          }}
          title="inventory"
        >
          <span className="emote-glyph">▦</span>
          <span className="emote-label">inv</span>
        </button>
      ) : (
        <div className="emote-center-gap" />
      )}
      {SLOTS.slice(4).map((s) => (
        <button
          key={s.id}
          type="button"
          className={`emote-btn ${s.pos}`}
          onMouseDown={(e) => {
            e.preventDefault();
            onEmote(s.id);
          }}
          title={s.label}
        >
          <span className="emote-glyph">{s.glyph}</span>
          <span className="emote-label">{s.label}</span>
        </button>
      ))}
    </div>
  );
}
