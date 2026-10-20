/**
 * Deterministic simulation shared by browser and Node.js.
 * Keep this module free of DOM APIs, Node imports, Date.now(), and Math.random().
 */
export const SIM_HZ = 30;
export const SIM_DT = 1 / SIM_HZ;
export const PROTOCOL_VERSION = 1;

const TURN_RATE = 3.5;
const THRUST = 340;
const MAX_SPEED = 250;
const DRAG = 0.992;
const FIRE_COOLDOWN = 0.22;
const BULLET_SPEED = 520;
const BULLET_TTL = 1.6;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(angle) {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

export function hashSeed(value) {
  const text = String(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

function nextRandom(simulation) {
  let state = simulation.randomState >>> 0;
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  simulation.randomState = state;
  return state / 0x100000000;
}

export function wrap(value, size) {
  if (size <= 0) return 0;
  return ((value % size) + size) % size;
}

export function createSimulation({ width = 960, height = 540, seed = 1, asteroidCount = 8 } = {}) {
  const normalizedSeed = Number(seed) >>> 0 || 1;
  const simulation = {
    version: PROTOCOL_VERSION,
    width: Math.max(320, Math.trunc(width)),
    height: Math.max(240, Math.trunc(height)),
    seed: normalizedSeed,
    randomState: normalizedSeed,
    tick: 0,
    ships: [],
    bullets: [],
    asteroids: [],
    nextBulletId: 1,
  };

  for (let index = 0; index < Math.max(0, Math.min(100, Math.trunc(asteroidCount))); index += 1) {
    const radius = 19 + nextRandom(simulation) * 13;
    const angle = nextRandom(simulation) * Math.PI * 2;
    const speed = 14 + nextRandom(simulation) * 38;
    simulation.asteroids.push({
      id: index + 1,
      x: 40 + nextRandom(simulation) * (simulation.width - 80),
      y: 40 + nextRandom(simulation) * (simulation.height - 80),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle: nextRandom(simulation) * Math.PI * 2,
      angularVelocity: (nextRandom(simulation) - 0.5) * 0.7,
      radius,
      hp: 40,
    });
  }
  return simulation;
}

export function createPlayerShip(id, width, height, slot = 0) {
  const angle = slot % 2 === 0 ? 0 : Math.PI;
  const x = slot % 2 === 0 ? width * 0.25 : width * 0.75;
  const lane = Math.floor(slot / 2);
  const y = height * (0.35 + (lane % 3) * 0.15);
  return {
    id: Number(id),
    x: wrap(x, width),
    y: wrap(y, height),
    vx: 0,
    vy: 0,
    angle,
    radius: 16,
    hp: 100,
    score: 0,
    fireCooldown: 0,
  };
}

export function addPlayer(simulation, id) {
  const existing = simulation.ships.find((ship) => ship.id === Number(id));
  if (existing) return existing;
  const slot = Math.max(0, Number(id) - 1);
  const ship = createPlayerShip(id, simulation.width, simulation.height, slot);
  simulation.ships.push(ship);
  simulation.ships.sort((a, b) => a.id - b.id);
  return ship;
}

export function removePlayer(simulation, id) {
  simulation.ships = simulation.ships.filter((ship) => ship.id !== Number(id));
  simulation.bullets = simulation.bullets.filter((bullet) => bullet.ownerId !== Number(id));
}

/** Pure state integration: returns a new state and whether this step fired. */
export function integrateShip(ship, input = {}, dt = SIM_DT, bounds = {}) {
  const width = Math.max(1, Number(bounds.width || 960));
  const height = Math.max(1, Number(bounds.height || 540));
  const throttle = clamp(Number(input.throttle) || 0, -1, 1);
  const turn = clamp(Number(input.turn) || 0, -1, 1);
  const angle = normalizeAngle(ship.angle + turn * TURN_RATE * dt);
  let vx = (ship.vx + Math.cos(angle) * throttle * THRUST * dt) * Math.pow(DRAG, dt * 60);
  let vy = (ship.vy + Math.sin(angle) * throttle * THRUST * dt) * Math.pow(DRAG, dt * 60);
  const speed = Math.hypot(vx, vy);
  if (speed > MAX_SPEED) {
    vx = (vx / speed) * MAX_SPEED;
    vy = (vy / speed) * MAX_SPEED;
  }

  const cooldownAfterStep = Math.max(0, Number(ship.fireCooldown || 0) - dt);
  const fired = Boolean(input.fire) && cooldownAfterStep <= 0;
  const next = {
    ...ship,
    x: wrap(ship.x + vx * dt, width),
    y: wrap(ship.y + vy * dt, height),
    vx,
    vy,
    angle,
    fireCooldown: fired ? FIRE_COOLDOWN : cooldownAfterStep,
  };
  return { state: next, fired };
}

export function createBulletFromShip(ship, id, ownerId = ship.id) {
  const noseOffset = ship.radius + 7;
  const dx = Math.cos(ship.angle);
  const dy = Math.sin(ship.angle);
  return {
    id: Number(id),
    ownerId: Number(ownerId),
    x: ship.x + dx * noseOffset,
    y: ship.y + dy * noseOffset,
    vx: ship.vx + dx * BULLET_SPEED,
    vy: ship.vy + dy * BULLET_SPEED,
    angle: ship.angle,
    ttl: BULLET_TTL,
  };
}

function squaredDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function stepSimulation(simulation, inputsByPlayerId, dt = SIM_DT) {
  const bounds = { width: simulation.width, height: simulation.height };
  const nextShips = [];
  for (const ship of simulation.ships) {
    const input = inputsByPlayerId instanceof Map
      ? inputsByPlayerId.get(ship.id) || {}
      : inputsByPlayerId?.[ship.id] || {};
    const result = integrateShip(ship, input, dt, bounds);
    nextShips.push(result.state);
    if (result.fired) {
      simulation.bullets.push(createBulletFromShip(result.state, simulation.nextBulletId, ship.id));
      simulation.nextBulletId = simulation.nextBulletId >= 65535 ? 1 : simulation.nextBulletId + 1;
    }
  }
  simulation.ships = nextShips;

  for (const asteroid of simulation.asteroids) {
    asteroid.x = wrap(asteroid.x + asteroid.vx * dt, simulation.width);
    asteroid.y = wrap(asteroid.y + asteroid.vy * dt, simulation.height);
    asteroid.angle = normalizeAngle(asteroid.angle + asteroid.angularVelocity * dt);
  }

  for (let index = simulation.bullets.length - 1; index >= 0; index -= 1) {
    const bullet = simulation.bullets[index];
    bullet.x = wrap(bullet.x + bullet.vx * dt, simulation.width);
    bullet.y = wrap(bullet.y + bullet.vy * dt, simulation.height);
    bullet.ttl -= dt;
    if (bullet.ttl <= 0) {
      simulation.bullets.splice(index, 1);
      continue;
    }

    let hit = false;
    for (let asteroidIndex = simulation.asteroids.length - 1; asteroidIndex >= 0; asteroidIndex -= 1) {
      const asteroid = simulation.asteroids[asteroidIndex];
      const radius = asteroid.radius + 4;
      if (squaredDistance(bullet, asteroid) < radius * radius) {
        asteroid.hp -= 20;
        hit = true;
        if (asteroid.hp <= 0) {
          simulation.asteroids.splice(asteroidIndex, 1);
          const owner = simulation.ships.find((ship) => ship.id === bullet.ownerId);
          if (owner) owner.score += 10;
        }
        break;
      }
    }
    if (!hit) {
      for (const ship of simulation.ships) {
        if (ship.id === bullet.ownerId) continue;
        const radius = ship.radius + 4;
        if (squaredDistance(bullet, ship) < radius * radius) {
          ship.hp -= 20;
          hit = true;
          if (ship.hp <= 0) {
            ship.score = Math.max(0, ship.score);
            ship.hp = 100;
            ship.x = simulation.width * (ship.id % 2 === 0 ? 0.75 : 0.25);
            ship.y = simulation.height * (0.35 + (ship.id % 3) * 0.1);
            ship.vx = 0;
            ship.vy = 0;
            const owner = simulation.ships.find((item) => item.id === bullet.ownerId);
            if (owner) owner.score += 100;
          }
          break;
        }
      }
    }
    if (hit) simulation.bullets.splice(index, 1);
  }

  simulation.tick += 1;
  return simulation;
}

export function cloneShip(ship) {
  return { ...ship };
}
