// Keyboard and mouse input: WASD/arrows to move, Shift to sneak, click to throw
// a pebble, Enter/Space to confirm, P or Escape to pause, R to restart, M to mute.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;

const MOVE_KEYS = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  /** The last click in canvas CSS pixels, or null. */
  let click = null;

  function onKeyDown(event) {
    if (event.repeat) return;
    if (MOVE_KEYS[event.code] || event.code === 'Space') event.preventDefault();
    keys.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyR') actions |= ACTION_RESTART;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseDown(event) {
    const rect = canvas.getBoundingClientRect();
    click = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function onBlur() {
    keys.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);

  /** The current move direction, normalised, from the held keys. */
  function direction() {
    let x = 0;
    let y = 0;
    for (const code of keys) {
      const move = MOVE_KEYS[code];
      if (move) {
        x += move[0];
        y += move[1];
      }
    }
    if (x === 0 && y === 0) return { x: 0, y: 0 };
    const length = Math.hypot(x, y);
    return { x: x / length, y: y / length };
  }

  function sneaking() {
    return keys.has('ShiftLeft') || keys.has('ShiftRight');
  }

  /** Take and clear the queued one-shot actions. */
  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  /** Take and clear the last click, if any. */
  function takeClick() {
    const taken = click;
    click = null;
    return taken;
  }

  return { direction, sneaking, takeActions, takeClick };
}
