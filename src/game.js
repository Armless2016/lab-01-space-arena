import { createInput } from './input.js';
import { createLoop } from './loop.js';
import { createRenderer } from './render.js';
import { World } from './world.js';
import { Ship } from './ship.js';
import { Asteroid } from './asteroid.js';
import { Pickup } from './pickup.js';
import { Vector2 } from './vector2.js';
import { processCollisions } from './collisions.js';

function randomPosition(size) {
  return new Vector2(
    70 + Math.random() * Math.max(1, size.width - 140),
    70 + Math.random() * Math.max(1, size.height - 140),
  );
}

export function createGame({ canvas, assets, room, playerName, onStats, onLeave, initialScore = 0 }) {
  const renderer = createRenderer(canvas);
  renderer.setAssets(assets);
  const input = createInput();
  let size = renderer.getSize();

  const world = new World({
    width: room.width,
    height: room.height,
    playerFactory: () => createPlayer(),
  });
  world.collisionSystem = processCollisions;
  world.score = initialScore;

  function createPlayer() {
    return new Ship({
      position: new Vector2(room.width / 2, room.height / 2),
      player: true,
      hp: 100,
      maxHp: 100,
      name: playerName,
      angle: 0,
    });
  }

  function spawnInitialWorld() {
    world.spawn(createPlayer());

    const enemyCount = Math.max(1, room.enemies);
    for (let index = 0; index < enemyCount; index += 1) {
      const angle = Math.PI * 2 * (index / enemyCount);
      const position = new Vector2(
        room.width / 2 + Math.cos(angle) * room.width * 0.32,
        room.height / 2 + Math.sin(angle) * room.height * 0.32,
      );
      world.spawn(new Ship({ position, angle: angle + Math.PI, hp: room.enemyHp ?? 60 }));
    }

    for (let index = 0; index < room.asteroids; index += 1) {
      const velocityAngle = Math.random() * Math.PI * 2;
      world.spawn(new Asteroid({
        position: randomPosition(room),
        velocity: Vector2.fromAngle(velocityAngle, 20 + Math.random() * 45),
        radius: 20 + Math.random() * 12,
        hp: 50,
        homing: index === 0,
      }));
    }

    world.spawn(new Pickup({
      position: new Vector2(room.width * 0.25, room.height * 0.25),
      type: 'repair',
      amount: 35,
    }));
  }

  input.onPress('Space', () => {
    const currentPlayer = world.playerShip;
    if (currentPlayer) currentPlayer.fire(world);
  });

  input.onPress('Escape', () => {
    stop();
    onLeave?.();
  });

  spawnInitialWorld();

  const loop = createLoop({
    step: 1 / 60,
    update(dt) {
      size = renderer.getSize();
      world.arena.width = room.width;
      world.arena.height = room.height;
      world.step(dt, input.snapshot());
      void size;
    },
    render(alpha) {
      renderer.render(world, alpha);
    },
    onStats,
  });

  function start() {
    loop.start();
  }

  function stop() {
    loop.stop();
    input.destroy();
    renderer.destroy();
  }

  return { world, start, stop };
}
