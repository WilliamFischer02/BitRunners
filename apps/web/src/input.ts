export interface MoveIntent {
  x: number;
  y: number;
}

export interface InputController {
  intent(): MoveIntent;
  dispose(): void;
}

type Dir = 'up' | 'down' | 'left' | 'right';

export function createInput(host: HTMLElement): InputController {
  const keys = new Set<string>();
  const touches = new Set<Dir>();

  const onKeyDown = (e: KeyboardEvent): void => {
    keys.add(e.key.toLowerCase());
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    keys.delete(e.key.toLowerCase());
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const dpad = document.createElement('div');
  dpad.className = 'dpad';
  const labels: Record<Dir, string> = { up: '▲', down: '▼', left: '◀', right: '▶' };
  const dirs: Dir[] = ['up', 'down', 'left', 'right'];
  for (const dir of dirs) {
    const b = document.createElement('button');
    b.className = `dpad-btn dpad-${dir}`;
    b.type = 'button';
    b.textContent = labels[dir];
    b.setAttribute('aria-label', dir);
    const start = (e: Event): void => {
      e.preventDefault();
      touches.add(dir);
      b.classList.add('is-down');
    };
    const end = (e: Event): void => {
      e.preventDefault();
      touches.delete(dir);
      b.classList.remove('is-down');
    };
    b.addEventListener('touchstart', start, { passive: false });
    b.addEventListener('touchend', end, { passive: false });
    b.addEventListener('touchcancel', end, { passive: false });
    b.addEventListener('mousedown', start);
    b.addEventListener('mouseup', end);
    b.addEventListener('mouseleave', end);
    dpad.appendChild(b);
  }
  host.appendChild(dpad);

  function intent(): MoveIntent {
    let x = 0;
    let y = 0;
    if (keys.has('arrowup') || keys.has('w') || touches.has('up')) y -= 1;
    if (keys.has('arrowdown') || keys.has('s') || touches.has('down')) y += 1;
    if (keys.has('arrowleft') || keys.has('a') || touches.has('left')) x -= 1;
    if (keys.has('arrowright') || keys.has('d') || touches.has('right')) x += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  function dispose(): void {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    if (dpad.parentNode === host) host.removeChild(dpad);
  }

  return { intent, dispose };
}
