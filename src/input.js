export function createInput(target = window) {
  const pressedKeys = new Set();
  const controlledKeys = new Set([
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
  ]);

  function onKeyDown(event) {
    if (controlledKeys.has(event.code)) {
      event.preventDefault();
      pressedKeys.add(event.code);
    }
  }

  function onKeyUp(event) {
    pressedKeys.delete(event.code);
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', () => pressedKeys.clear());

  return {
    snapshot() {
      return {
        up: pressedKeys.has('KeyW') || pressedKeys.has('ArrowUp'),
        down: pressedKeys.has('KeyS') || pressedKeys.has('ArrowDown'),
        left: pressedKeys.has('KeyA') || pressedKeys.has('ArrowLeft'),
        right: pressedKeys.has('KeyD') || pressedKeys.has('ArrowRight'),
      };
    },
    destroy() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
    },
  };
}
