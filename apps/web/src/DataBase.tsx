import { useCallback, useEffect, useRef, useState } from 'react';
import { PLOT_H, VOXEL_BLOCKS } from './voxel-core.js';

// data_base — slim HUD over the scene's plot mode (P7 Stage A).
//
// The scene owns the mode (voxel arena, orbit camera, picking, collision —
// see the plot block in scene.ts); this overlay is a thin driver exactly
// like CoreRun.tsx is for the maze: mount → 'bitrunners:data-base-enter';
// the toolbar fires plot-tab / plot-tool / plot-height events; the scene's
// 'bitrunners:plot-exit' notification closes the overlay (whether the exit
// came from our button or from the scene itself, e.g. launching core_run).
//
// Two tabs: RegEdit (creative editor — palette + eraser up top, camera
// height slider on the left rail; the on-screen stick pans the viewport and
// taps place/erase straight off the raycast — devlog 0156 removed the
// depth slider + ghost cursor) and Corporeal (walk your build with the
// normal rig + stick).

/** Default RegEdit camera altitude — keep in sync with scene.ts plotFocusY. */
const DEFAULT_CAM_HEIGHT = 3;

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

type PlotTab = 'regedit' | 'corporeal';

export function DataBase({ onClose, visit = false }: DataBaseProps): JSX.Element {
  const [tab, setTab] = useState<PlotTab>(visit ? 'corporeal' : 'regedit');
  // Active tool: a block id from the launch palette, or the eraser.
  const [tool, setTool] = useState<number | 'eraser'>(1);
  const [camHeight, setCamHeight] = useState(DEFAULT_CAM_HEIGHT);
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
  const changeHeight = (v: number): void => {
    setCamHeight(v);
    fire('bitrunners:plot-height', { height: v });
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
          </div>
        )}
        <div className="plot-hint">
          {visit
            ? 'walking their build · read-only'
            : tab === 'regedit'
              ? 'drag orbit · stick pans · left rail = height · tap to place / erase'
              : 'walk your build · stick / wasd'}
        </div>
      </div>
      {!visit && tab === 'regedit' && (
        <div className="plot-height-rail">
          <span className="plot-height-label" aria-hidden="true">
            alt
          </span>
          <span className="plot-height-box">
            <input
              type="range"
              className="plot-height-slider"
              min={0}
              max={PLOT_H}
              step={0.5}
              value={camHeight}
              onChange={(e) => changeHeight(Number(e.target.value))}
              aria-label="camera height"
              aria-orientation="vertical"
            />
          </span>
          <span className="plot-height-value">{camHeight}</span>
        </div>
      )}
    </div>
  );
}

export default DataBase;
