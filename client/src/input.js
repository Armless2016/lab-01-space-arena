export function createInput(target = window) {
  const pressedKeys = new Set();
  const pressListeners = new Map();
  const controlledKeys = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'Escape', 'KeyP',
  ]);

  function onKeyDown(event) {
    if (controlledKeys.has(event.code)) event.preventDefault();
    pressedKeys.add(event.code);

    const listeners = pressListeners.get(event.code);
    if (!event.repeat && listeners) {
      for (const listener of listeners) listener();
    }
  }

  function onKeyUp(event) {
    pressedKeys.delete(event.code);
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);

  return {
    snapshot() {
      return {
        up: pressedKeys.has('ArrowUp') || pressedKeys.has('KeyW'),
        down: pressedKeys.has('ArrowDown') || pressedKeys.has('KeyS'),
        left: pressedKeys.has('ArrowLeft') || pressedKeys.has('KeyA'),
        right: pressedKeys.has('ArrowRight') || pressedKeys.has('KeyD'),
      };
    },
    onPress(code, listener) {
      if (!pressListeners.has(code)) pressListeners.set(code, new Set());
      pressListeners.get(code).add(listener);
    },
    offPress(code, listener) {
      pressListeners.get(code)?.delete(listener);
    },
    destroy() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      pressedKeys.clear();
      pressListeners.clear();
    },
  };
}
