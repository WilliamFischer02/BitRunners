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
  /** Font family. Default 'monospace'. */
  fontFamily?: string;
  /** Font size in px (≤ cellSize). Defaults to cellSize. */
  fontSize?: number;
  /** Foreground glyph color. Default white. */
  color?: string;
}

const DEFAULT_RAMP = ' .,:;i1tfLCG08@';

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
  ctx.fillStyle = color;

  for (let i = 0; i < ramp.length; i++) {
    const ch = ramp[i];
    if (!ch) continue;
    ctx.fillText(ch, i * cellSize + cellSize / 2, cellSize / 2);
  }

  const texture = new CanvasTexture(canvas);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return { texture, glyphCount: ramp.length, cellSize };
}
