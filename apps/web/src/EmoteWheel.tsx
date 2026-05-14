export type EmoteId = 'happy' | 'tired' | 'okay' | 'help';

export const EMOTE_GLYPHS: Record<EmoteId, string> = {
  happy: '^_^',
  tired: 'z z z',
  okay: '[ok]',
  help: '!? !?',
};

interface EmoteWheelProps {
  onEmote(id: EmoteId): void;
}

export function EmoteWheel({ onEmote }: EmoteWheelProps): JSX.Element {
  return (
    <div className="emote">
      <button
        type="button"
        className="emote-btn emote-up"
        onMouseDown={(e) => {
          e.preventDefault();
          onEmote('happy');
        }}
        title="happy"
      >
        <span className="emote-glyph">^_^</span>
        <span className="emote-label">happy</span>
      </button>
      <button
        type="button"
        className="emote-btn emote-left"
        onMouseDown={(e) => {
          e.preventDefault();
          onEmote('tired');
        }}
        title="tired"
      >
        <span className="emote-glyph">zz</span>
        <span className="emote-label">tired</span>
      </button>
      <button
        type="button"
        className="emote-btn emote-right"
        onMouseDown={(e) => {
          e.preventDefault();
          onEmote('okay');
        }}
        title="okay"
      >
        <span className="emote-glyph">[ok]</span>
        <span className="emote-label">okay</span>
      </button>
      <button
        type="button"
        className="emote-btn emote-down"
        onMouseDown={(e) => {
          e.preventDefault();
          onEmote('help');
        }}
        title="help"
      >
        <span className="emote-glyph">!?</span>
        <span className="emote-label">help</span>
      </button>
    </div>
  );
}
