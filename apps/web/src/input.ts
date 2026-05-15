export interface MoveIntent {
  x: number;
  y: number;
}

export interface InputController {
  intent(): MoveIntent;
  dispose(): void;
}

const DEAD_ZONE = 0.08;

function joystickEnabled(): boolean {
  try {
    const v = localStorage.getItem('bitrunners.settings.joystick');
    return v === null || v === 'true';
  } catch {
    return true;
  }
}

export function createInput(host: HTMLElement): InputController {
  const keys = new Set<string>();

  const onKeyDown = (e: KeyboardEvent): void => {
    keys.add(e.key.toLowerCase());
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    keys.delete(e.key.toLowerCase());
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const stick = document.createElement('div');
  stick.className = joystickEnabled() ? 'stick' : 'stick is-hidden';

  const onSettingsChanged = (): void => {
    stick.className = joystickEnabled() ? 'stick' : 'stick is-hidden';
  };
  window.addEventListener('bitrunners:settings-changed', onSettingsChanged);
  const thumb = document.createElement('div');
  thumb.className = 'stick-thumb';
  stick.appendChild(thumb);
  host.appendChild(stick);

  let activeTouchId: number | null = null;
  let activeMouse = false;
  let baseCx = 0;
  let baseCy = 0;
  let radius = 0;
  let dx = 0;
  let dy = 0;

  function updateGeometry(): void {
    const rect = stick.getBoundingClientRect();
    baseCx = rect.left + rect.width / 2;
    baseCy = rect.top + rect.height / 2;
    radius = rect.width / 2 - 8;
  }

  function setThumb(x: number, y: number, springing: boolean): void {
    thumb.style.transition = springing ? 'transform 110ms ease-out' : 'none';
    thumb.style.transform = `translate(${x}px, ${y}px)`;
  }

  function applyPoint(clientX: number, clientY: number): void {
    if (radius <= 0) updateGeometry();
    const rawX = clientX - baseCx;
    const rawY = clientY - baseCy;
    const len = Math.sqrt(rawX * rawX + rawY * rawY);
    if (len > radius) {
      dx = (rawX / len) * radius;
      dy = (rawY / len) * radius;
    } else {
      dx = rawX;
      dy = rawY;
    }
    setThumb(dx, dy, false);
  }

  function release(): void {
    activeTouchId = null;
    activeMouse = false;
    dx = 0;
    dy = 0;
    setThumb(0, 0, true);
  }

  const onTouchStart = (e: TouchEvent): void => {
    if (activeTouchId !== null) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    if (!t) return;
    activeTouchId = t.identifier;
    updateGeometry();
    applyPoint(t.clientX, t.clientY);
  };
  const onTouchMove = (e: TouchEvent): void => {
    if (activeTouchId === null) return;
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (!t || t.identifier !== activeTouchId) continue;
      applyPoint(t.clientX, t.clientY);
    }
  };
  const onTouchEnd = (e: TouchEvent): void => {
    if (activeTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (!t || t.identifier !== activeTouchId) continue;
      e.preventDefault();
      release();
    }
  };
  const onMouseDown = (e: MouseEvent): void => {
    e.preventDefault();
    activeMouse = true;
    updateGeometry();
    applyPoint(e.clientX, e.clientY);
  };
  const onMouseMove = (e: MouseEvent): void => {
    if (!activeMouse) return;
    applyPoint(e.clientX, e.clientY);
  };
  const onMouseUp = (): void => {
    if (!activeMouse) return;
    release();
  };

  stick.addEventListener('touchstart', onTouchStart, { passive: false });
  stick.addEventListener('touchmove', onTouchMove, { passive: false });
  stick.addEventListener('touchend', onTouchEnd, { passive: false });
  stick.addEventListener('touchcancel', onTouchEnd, { passive: false });
  stick.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  const ro = new ResizeObserver(updateGeometry);
  ro.observe(stick);

  function intent(): MoveIntent {
    let kx = 0;
    let ky = 0;
    if (keys.has('arrowup') || keys.has('w')) ky -= 1;
    if (keys.has('arrowdown') || keys.has('s')) ky += 1;
    if (keys.has('arrowleft') || keys.has('a')) kx -= 1;
    if (keys.has('arrowright') || keys.has('d')) kx += 1;

    const jx = radius > 0 ? dx / radius : 0;
    const jy = radius > 0 ? dy / radius : 0;
    const jLen = Math.sqrt(jx * jx + jy * jy);

    if (jLen > DEAD_ZONE) {
      return { x: jx, y: jy };
    }

    if (kx !== 0 && ky !== 0) {
      const inv = 1 / Math.SQRT2;
      return { x: kx * inv, y: ky * inv };
    }
    return { x: kx, y: ky };
  }

  function dispose(): void {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('bitrunners:settings-changed', onSettingsChanged);
    ro.disconnect();
    if (stick.parentNode === host) host.removeChild(stick);
  }

  return { intent, dispose };
}
