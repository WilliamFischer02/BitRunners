import { useEffect, useMemo } from 'react';

interface TransitionRainProps {
  onDone(): void;
  durationMs?: number;
}

const COLUMN_COUNT = 48;
const RAIN_CHARS = '01░▒▓█·:-=+*#%▌▐▀▄';

function makeColumn(): { glyphs: string; delay: number; duration: number; offset: number } {
  let g = '';
  for (let i = 0; i < 40; i++) {
    g += RAIN_CHARS.charAt(Math.floor(Math.random() * RAIN_CHARS.length));
  }
  return {
    glyphs: g,
    delay: Math.random() * 350,
    duration: 800 + Math.random() * 700,
    offset: Math.random() * -100,
  };
}

export function TransitionRain({ onDone, durationMs = 1300 }: TransitionRainProps): JSX.Element {
  const columns = useMemo(() => Array.from({ length: COLUMN_COUNT }, makeColumn), []);
  useEffect(() => {
    const id = setTimeout(onDone, durationMs);
    return () => clearTimeout(id);
  }, [onDone, durationMs]);

  return (
    <div className="rain" aria-hidden="true">
      <div className="rain-columns">
        {columns.map((c, i) => (
          <div
            key={`col-${c.glyphs}-${c.delay}-${i}`}
            className="rain-col"
            style={{
              left: `${(i / COLUMN_COUNT) * 100}%`,
              animationDelay: `${c.delay}ms`,
              animationDuration: `${c.duration}ms`,
              transform: `translateY(${c.offset}%)`,
            }}
          >
            {c.glyphs.split('').map((ch, j) => (
              <span key={`g-${c.glyphs}-${j}-${ch}`} className="rain-glyph">
                {ch}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="rain-fade" />
    </div>
  );
}
