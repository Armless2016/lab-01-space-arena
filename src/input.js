export function createInput(target = window) {
  const pressedKeys = new Set();
  const pressListeners = new Map();
  const controlledKeys = new Set([
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Space',
  ]);

  function onKeyDown(event) {
    if (!controlledKeys.has(event.code)) return;

    event.preventDefault();
    const wasPressed = pressedKeys.has(event.code);
    pressedKeys.add(event.code);

    if (!wasPressed) {
      for (const listener of pressListeners.get(event.code) ?? []) {
        listener(event);
      }
    }
  }

  function onKeyUp(event) {
    pressedKeys.delete(event.code);
  }

  function onBlur() {
    pressedKeys.clear();
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  return {
    snapshot() {
      return {
        up: pressedKeys.has('KeyW') || pressedKeys.has('ArrowUp'),
        down: pressedKeys.has('KeyS') || pressedKeys.has('ArrowDown'),
        left: pressedKeys.has('KeyA') || pressedKeys.has('ArrowLeft'),
        right: pressedKeys.has('KeyD') || pressedKeys.has('ArrowRight'),
      };
    },
    onPress(code, listener) {
      if (!pressListeners.has(code)) {
        pressListeners.set(code, new Set());
      }
      pressListeners.get(code).add(listener);
      return () => pressListeners.get(code)?.delete(listener);
    },
    destroy() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
    },
  };
}
