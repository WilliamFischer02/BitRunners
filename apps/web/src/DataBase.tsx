import { useCallback, useEffect, useRef, useState } from 'react';
import { VOXEL_BLOCKS } from './voxel-core.js';

// data_base — slim HUD over the scene's plot mode (P7 Stage A).
//
// The scene owns the mode (voxel arena, orbit camera, picking, collision —
// see the plot block in scene.ts); this overlay is a thin driver exactly
// like CoreRun.tsx is for the maze: mount → 'bitrunners:data-base-enter';
// the toolbar fires plot-tab / plot-tool / plot-depth events; the scene's
// 'bitrunners:plot-exit' notification closes the overlay (whether the exit
// came from our button or from the scene itself, e.g. launching core_run).
//
// Two tabs: RegEdit (creative editor — palette, eraser, selection-depth
// slider) and Corporeal (walk your build with the normal rig + stick).

type PlotTab = 'regedit' | 'corporeal';

const MAX_DEPTH = 7;

function fire(name: string, detail?: unknown): void {
  try {
    window.dispatchEvent(
      detail === undefined ? new CustomEvent(name) : new CustomEvent(name, { detail }),
    );
  } catch {
    // non-DOM env — ignore
  }
}

interface DataBaseProps {
  onClose(): void;
  /** Visiting someone ELSE's plot (P7C): read-only Corporeal walk — no
   *  editor toolbar, no tab switch, and the scene already entered. */
  visit?: boolean;
}

export function DataBase({ onClose, visit = false }: DataBaseProps): JSX.Element {
  const [tab, setTab] = useState<PlotTab>(visit ? 'corporeal' : 'regedit');
  // Active tool: a block id from the launch palette, or the eraser.
  const [tool, setTool] = useState<number | 'eraser'>(1);
  const [depth, setDepth] = useState(0);
  const [blockCount, setBlockCount] = useState(0);
  const closedRef = useRef(false);

  // Enter the plot on mount (visits are scene-initiated — it already
  // entered); if the overlay unmounts without the scene having exited
  // (route change, class switch), request the exit so the world is never
  // left hidden.
  useEffect(() => {
    if (!visit) fire('bitrunners:data-base-enter');
    return () => {
      if (!closedRef.current) fire('bitrunners:data-base-exit');
    };
  }, [visit]);

  useEffect(() => {
    const onExit = (): void => {
      closedRef.current = true;
      onClose();
    };
    const onEdited = (e: Event): void => {
      const n = (e as CustomEvent<{ blocks?: number }>).detail?.blocks;
      if (typeof n === 'number') setBlockCount(n);
    };
    window.addEventListener('bitrunners:plot-exit', onExit);
    window.addEventListener('bitrunners:plot-edited', onEdited);
    return () => {
      window.removeEventListener('bitrunners:plot-exit', onExit);
      window.removeEventListener('bitrunners:plot-edited', onEdited);
    };
  }, [onClose]);

  const exit = useCallback((): void => {
    fire('bitrunners:data-base-exit'); // scene answers with plot-exit → onClose
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') exit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exit]);

  const pickTab = (t: PlotTab): void => {
    setTab(t);
    fire('bitrunners:plot-tab', { tab: t });
  };
  const pickBlock = (id: number): void => {
    setTool(id);
    fire('bitrunners:plot-tool', { tool: 'block', blockId: id });
  };
  const pickEraser = (): void => {
    setTool('eraser');
    fire('bitrunners:plot-tool', { tool: 'eraser' });
  };
  const changeDepth = (v: number): void => {
    setDepth(v);
    fire('bitrunners:plot-depth', { depth: v });
  };

  return (
    <div className="plot-hud-wrap">
      <div className="plot-hud">
        <div className="plot-hud-top">
          <span className="plot-title">{visit ? '// data_base · visiting' : '// data_base'}</span>
          {!visit && (
            <div className="plot-tabs" role="tablist" aria-label="data_base mode">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'regedit'}
                className={tab === 'regedit' ? 'scrape-tabbtn is-on' : 'scrape-tabbtn'}
                onClick={() => pickTab('regedit')}
              >
                RegEdit
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'corporeal'}
                className={tab === 'corporeal' ? 'scrape-tabbtn is-on' : 'scrape-tabbtn'}
                onClick={() => pickTab('corporeal')}
              >
                Corporeal
              </button>
            </div>
          )}
          <span className="plot-count">{blockCount} blk</span>
          <button type="button" className="plot-exit" onClick={exit} aria-label="exit data_base">
            [ exit ]
          </button>
        </div>
        {!visit && tab === 'regedit' && (
          <div className="plot-toolbar">
            <fieldset className="plot-palette" aria-label="block palette">
              {VOXEL_BLOCKS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`plot-block${tool === b.id ? ' is-on' : ''}`}
                  onClick={() => pickBlock(b.id)}
                  title={b.label}
                  aria-label={`place ${b.label}`}
                  aria-pressed={tool === b.id}
                >
                  <span
                    className="plot-swatch"
                    style={{
                      background: `#${b.color.toString(16).padStart(6, '0')}`,
                      boxShadow:
                        b.emissive !== 0
                          ? `0 0 6px #${b.emissive.toString(16).padStart(6, '0')}`
                          : undefined,
                    }}
                  />
                  <span className="plot-block-label">{b.label}</span>
                </button>
              ))}
              <button
                type="button"
                className={`plot-block plot-eraser${tool === 'eraser' ? ' is-on' : ''}`}
                onClick={pickEraser}
                aria-label="eraser"
                aria-pressed={tool === 'eraser'}
              >
                <span className="plot-swatch plot-swatch-eraser">✕</span>
                <span className="plot-block-label">eraser</span>
              </button>
            </fieldset>
            <label className="plot-depth">
              <span className="plot-depth-label">depth {depth}</span>
              <input
                type="range"
                min={0}
                max={MAX_DEPTH}
                step={1}
                value={depth}
                onChange={(e) => changeDepth(Number(e.target.value))}
                aria-label="selection depth"
              />
            </label>
          </div>
        )}
        <div className="plot-hint">
          {visit
            ? 'walking their build · read-only'
            : tab === 'regedit'
              ? 'drag orbit · two-finger/shift-drag pan · pinch/wheel zoom · tap to place'
              : 'walk your build · stick / wasd'}
        </div>
      </div>
    </div>
  );
}

export default DataBase;
