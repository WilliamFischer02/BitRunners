import { CanvasTexture, NearestFilter, type Texture } from 'three';

export interface GlyphAtlas {
  texture: Texture;
  glyphCount: number;
  cellSize: number;
}

export interface GlyphAtlasOptions {
  /** Glyphs in order from least dense (darkest) to most dense (brightest). */
  ramp?: string;
  /** Pixel size of each square cell. Default 8. */
  cellSize?: number;
  /** Font family for letterform glyphs (block / half-block glyphs are drawn procedurally). */
  fontFamily?: string;
  /** Font size in px (≤ cellSize) for letterform glyphs. Defaults to cellSize. */
  fontSize?: number;
  /** Foreground glyph color (hex string). Default white. */
  color?: string;
}

const DEFAULT_RAMP = ' .·:-=+*░#▒▓█';

const SHADE_FILLS: Record<string, number> = {
  ' ': 0,
  '░': 0.25,
  '▒': 0.5,
  '▓': 0.75,
  '█': 1.0,
};

const HALF_BLOCKS: Record<string, [number, number, number, number]> = {
  '▀': [0, 0, 1, 0.5],
  '▄': [0, 0.5, 1, 0.5],
  '▌': [0, 0, 0.5, 1],
  '▐': [0.5, 0, 0.5, 1],
  '▘': [0, 0, 0.5, 0.5],
  '▝': [0.5, 0, 0.5, 0.5],
  '▖': [0, 0.5, 0.5, 0.5],
  '▗': [0.5, 0.5, 0.5, 0.5],
};

export function buildGlyphAtlas(options: GlyphAtlasOptions = {}): GlyphAtlas {
  const ramp = options.ramp ?? DEFAULT_RAMP;
  const cellSize = options.cellSize ?? 8;
  const fontFamily = options.fontFamily ?? 'monospace';
  const fontSize = options.fontSize ?? cellSize;
  const color = options.color ?? '#ffffff';

  const canvas = document.createElement('canvas');
  canvas.width = cellSize * ramp.length;
  canvas.height = cellSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  for (let i = 0; i < ramp.length; i++) {
    const ch = ramp[i];
    if (!ch || ch === ' ') continue;
    const x = i * cellSize;

    const shade = SHADE_FILLS[ch];
    if (shade !== undefined) {
      if (shade <= 0) continue;
      ctx.globalAlpha = shade;
      ctx.fillStyle = color;
      ctx.fillRect(x, 0, cellSize, cellSize);
      ctx.globalAlpha = 1;
      continue;
    }

    const half = HALF_BLOCKS[ch];
    if (half) {
      const [dx, dy, w, h] = half;
      ctx.fillStyle = color;
      ctx.fillRect(x + dx * cellSize, dy * cellSize, w * cellSize, h * cellSize);
      continue;
    }

    ctx.fillStyle = color;
    ctx.fillText(ch, x + cellSize / 2, cellSize / 2);
  }

  const texture = new CanvasTexture(canvas);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return { texture, glyphCount: ramp.length, cellSize };
}
