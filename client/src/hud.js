export function createHud(elements) {
  return {
    show() {
      elements.root.hidden = false;
    },
    hide() {
      elements.root.hidden = true;
    },
    setPlayer(name) {
      elements.playerName.textContent = name;
    },
    setRoom(name) {
      elements.roomName.textContent = name;
    },
    setAudioState(state) {
      elements.audioState.textContent = state;
    },
    update(world, stats) {
      const player = world.playerShip;
      elements.hp.textContent = player ? String(player.hp) : '0';
      elements.score.textContent = String(world.score);
      elements.entities.textContent = String(world.size);
      elements.steps.textContent = String(stats.stepsPerSecond);
      elements.frames.textContent = String(stats.framesPerSecond);
      elements.frameTime.textContent = stats.frameTimeMs.toFixed(2);
    },
  };
}
