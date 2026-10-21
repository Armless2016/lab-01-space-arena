import { entityId, stepNumber, type AsteroidState, type BulletState, type ControlInput, type EntityId, type PickupState, type ShipState, type SimulationState, type StepNumber } from './types.ts';

/**
 * Deterministic simulation shared by browser and Node.js.
 * No DOM, Node imports, Date.now(), or Math.random() in this module.
 */
export const SIM_HZ = 30;
export const SIM_DT = 1 / SIM_HZ;
export const PROTOCOL_VERSION = 3;

const TURN_RATE = 3.5;
const THRUST = 340;
const MAX_SPEED = 250;
const DRAG = 0.992;
const FIRE_COOLDOWN = 0.22;
const BULLET_SPEED = 520;
const BULLET_TTL = 1.6;
const ENEMY_ID_BASE = 60000;
const PLAYER_RESPAWN_TICKS = SIM_HZ * 2;
const ENEMY_RESPAWN_TICKS = SIM_HZ * 3;
const PICKUP_RESPAWN_TICKS = SIM_HZ * 5;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(angle: number): number {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

export function hashSeed(value: string | number): number {
  const text = String(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

function nextRandom(simulation: SimulationState): number {
  let state = simulation.randomState >>> 0;
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  simulation.randomState = state;
  return state / 0x100000000;
}

export function wrap(value: number, size: number): number {
  if (size <= 0) return 0;
  return ((value % size) + size) % size;
}

function wrappedDelta(a: number, b: number, size: number): number {
  let delta = a - b;
  if (delta > size / 2) delta -= size;
  if (delta < -size / 2) delta += size;
  return delta;
}

function squaredDistance(a: { x: number; y: number }, b: { x: number; y: number }, simulation: SimulationState): number {
  const dx = wrappedDelta(a.x, b.x, simulation.width);
  const dy = wrappedDelta(a.y, b.y, simulation.height);
  return dx * dx + dy * dy;
}

function nextBulletId(simulation: SimulationState): EntityId {
  const id = simulation.nextBulletId;
  simulation.nextBulletId = simulation.nextBulletId >= 65535 ? 1 : simulation.nextBulletId + 1;
  return entityId(id);
}

function nextAsteroidId(simulation: SimulationState): EntityId {
  const id = simulation.nextAsteroidId;
  simulation.nextAsteroidId = simulation.nextAsteroidId >= 59999 ? 101 : simulation.nextAsteroidId + 1;
  return entityId(id);
}

function createEnemy(simulation: SimulationState, index: number, total: number, hp: number): ShipState {
  const angle = (Math.PI * 2 * index) / Math.max(1, total);
  const orbit = Math.min(simulation.width, simulation.height) * 0.32;
  const id = entityId(ENEMY_ID_BASE + index + 1);
  const spawnX = simulation.width / 2 + Math.cos(angle) * orbit;
  const spawnY = simulation.height / 2 + Math.sin(angle) * orbit;
  return {
    id,
    x: wrap(spawnX, simulation.width),
    y: wrap(spawnY, simulation.height),
    vx: 0,
    vy: 0,
    angle: normalizeAngle(angle + Math.PI),
    radius: 18,
    hp,
    maxHp: hp,
    score: 0,
    shotsFired: 0,
    collisionCooldown: 0,
    fireCooldown: 0.3 + index * 0.11,
    respawnTick: 0,
  };
}

export interface SimulationOptions {
  width?: number;
  height?: number;
  seed?: number;
  asteroidCount?: number;
  pickupCount?: number;
  enemyCount?: number;
  enemyHp?: number;
}

export function createSimulation({
  width = 960,
  height = 540,
  seed = 1,
  asteroidCount = 8,
  pickupCount = 3,
  enemyCount = 2,
  enemyHp = 60,
}: SimulationOptions = {}): SimulationState {
  const normalizedSeed = Number(seed) >>> 0 || 1;
  const simulation: SimulationState = {
    version: PROTOCOL_VERSION,
    width: Math.max(320, Math.trunc(width)),
    height: Math.max(240, Math.trunc(height)),
    seed: normalizedSeed,
    randomState: normalizedSeed,
    tick: stepNumber(0),
    ships: [],
    enemies: [],
    bullets: [],
    asteroids: [],
    pickups: [],
    nextBulletId: 1,
    nextAsteroidId: Math.max(101, Math.trunc(asteroidCount) + 1),
    enemyHp: clamp(Math.trunc(enemyHp) || 60, 20, 255),
  };

  const asteroidTotal = Math.max(0, Math.min(100, Math.trunc(asteroidCount)));
  for (let index = 0; index < asteroidTotal; index += 1) {
    const radius = 26 + nextRandom(simulation) * 8;
    const angle = nextRandom(simulation) * Math.PI * 2;
    const speed = 14 + nextRandom(simulation) * 38;
    simulation.asteroids.push({
      id: entityId(index + 1),
      x: 40 + nextRandom(simulation) * (simulation.width - 80),
      y: 40 + nextRandom(simulation) * (simulation.height - 80),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle: nextRandom(simulation) * Math.PI * 2,
      angularVelocity: (nextRandom(simulation) - 0.5) * 0.7,
      radius,
      hp: 40,
      maxHp: 40,
    });
  }

  const pickupTotal = Math.max(0, Math.min(20, Math.trunc(pickupCount)));
  const presetPickupPositions: ReadonlyArray<readonly [number, number]> = [
    [0.36, 0.35],
    [0.68, 0.64],
    [0.50, 0.50],
  ];
  for (let index = 0; index < pickupTotal; index += 1) {
    const preset = presetPickupPositions[index];
    const x = preset
      ? simulation.width * preset[0]
      : 48 + nextRandom(simulation) * (simulation.width - 96);
    const y = preset
      ? simulation.height * preset[1]
      : 48 + nextRandom(simulation) * (simulation.height - 96);
    simulation.pickups.push({
      id: entityId(index + 1),
      x,
      y,
      radius: 22,
      active: true,
      respawnTick: 0,
    });
  }

  const enemyTotal = Math.max(0, Math.min(16, Math.trunc(enemyCount)));
  for (let index = 0; index < enemyTotal; index += 1) {
    simulation.enemies.push(createEnemy(simulation, index, enemyTotal, simulation.enemyHp));
  }

  return simulation;
}

export function createPlayerShip(id: number | EntityId, width: number, height: number, slot = 0): ShipState {
  const angle = slot % 2 === 0 ? 0 : Math.PI;
  const x = slot % 2 === 0 ? width * 0.25 : width * 0.75;
  const lane = Math.floor(slot / 2);
  const y = height * (0.35 + (lane % 3) * 0.15);
  return {
    id: entityId(Number(id)),
    x: wrap(x, width),
    y: wrap(y, height),
    vx: 0,
    vy: 0,
    angle,
    radius: 16,
    hp: 100,
    maxHp: 100,
    score: 0,
    fireCooldown: 0,
    shotsFired: 0,
    collisionCooldown: 0,
    respawnTick: 0,
  };
}

export function addPlayer(simulation: SimulationState, id: number | EntityId): ShipState {
  const safeId = entityId(Number(id));
  const existing = simulation.ships.find((ship) => ship.id === safeId);
  if (existing) return existing;
  const slot = Math.max(0, Number(safeId) - 1);
  const ship = createPlayerShip(id, simulation.width, simulation.height, slot);
  simulation.ships.push(ship);
  simulation.ships.sort((a, b) => a.id - b.id);
  return ship;
}

export function removePlayer(simulation: SimulationState, id: number | EntityId): void {
  const safeId = entityId(Number(id));
  simulation.ships = simulation.ships.filter((ship) => ship.id !== safeId);
  simulation.bullets = simulation.bullets.filter((bullet) => bullet.ownerId !== safeId);
}

/** Pure fixed-step integration: returns a new state and whether this step fired. */
export function integrateShip(ship: ShipState, input: ControlInput = {}, dt = SIM_DT, bounds: { width?: number; height?: number } = {}): { state: ShipState; fired: boolean } {
  if (ship.hp <= 0) return { state: { ...ship, vx: 0, vy: 0 }, fired: false };
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
  return {
    state: {
      ...ship,
      x: wrap(ship.x + vx * dt, width),
      y: wrap(ship.y + vy * dt, height),
      vx,
      vy,
      angle,
      fireCooldown: fired ? FIRE_COOLDOWN : cooldownAfterStep,
      shotsFired: (Number(ship.shotsFired) || 0) + (fired ? 1 : 0),
      collisionCooldown: Math.max(0, Number(ship.collisionCooldown || 0) - dt),
    },
    fired,
  };
}

export function createBulletFromShip(ship: ShipState, id: number | EntityId, ownerId: number | EntityId = ship.id, homing = false): BulletState {
  const noseOffset = ship.radius + 7;
  const dx = Math.cos(ship.angle);
  const dy = Math.sin(ship.angle);
  return {
    id: entityId(Number(id)),
    ownerId: entityId(Number(ownerId)),
    x: ship.x + dx * noseOffset,
    y: ship.y + dy * noseOffset,
    vx: ship.vx + dx * BULLET_SPEED,
    vy: ship.vy + dy * BULLET_SPEED,
    angle: ship.angle,
    ttl: BULLET_TTL,
    radius: 4,
    homing: Boolean(homing),
  };
}

function steerHomingBullet(bullet: BulletState, simulation: SimulationState, dt: number): void {
  if (!bullet.homing) return;
  const isEnemyBullet = bullet.ownerId >= ENEMY_ID_BASE;
  const targets = isEnemyBullet
    ? simulation.ships.filter((ship) => ship.hp > 0)
    : [
        ...simulation.enemies.filter((enemy) => enemy.hp > 0),
        ...simulation.asteroids,
      ];
  let target = null;
  let bestDistance = Infinity;
  for (const candidate of targets) {
    const distance = squaredDistance(bullet, candidate, simulation);
    if (distance < bestDistance) {
      bestDistance = distance;
      target = candidate;
    }
  }
  if (!target) return;
  const dx = wrappedDelta(target.x, bullet.x, simulation.width);
  const dy = wrappedDelta(target.y, bullet.y, simulation.height);
  const desiredAngle = Math.atan2(dy, dx);
  const difference = normalizeAngle(desiredAngle - bullet.angle);
  const maxTurn = 4.2 * dt;
  bullet.angle = normalizeAngle(bullet.angle + clamp(difference, -maxTurn, maxTurn));
  const speed = Math.max(1, Math.hypot(bullet.vx, bullet.vy));
  bullet.vx = Math.cos(bullet.angle) * speed;
  bullet.vy = Math.sin(bullet.angle) * speed;
}

function respawnShip(ship: ShipState, simulation: SimulationState): void {
  const slot = Math.max(0, Number(ship.id) - 1);
  const score = ship.score;
  const shotsFired = ship.shotsFired;
  const spawn = createPlayerShip(ship.id, simulation.width, simulation.height, slot);
  Object.assign(ship, spawn);
  ship.score = score;
  ship.shotsFired = shotsFired;
  ship.respawnTick = 0;
}

function respawnEnemy(enemy: ShipState, simulation: SimulationState): void {
  const index = enemy.id - ENEMY_ID_BASE - 1;
  const total = Math.max(1, simulation.enemies.length);
  const spawn = createEnemy(simulation, index, total, enemy.maxHp || simulation.enemyHp);
  Object.assign(enemy, spawn);
}

function nearestLivePlayer(enemy: ShipState, players: ShipState[]): ShipState | null {
  let nearest = null;
  let best = Infinity;
  for (const ship of players) {
    if (ship.hp <= 0) continue;
    const dx = ship.x - enemy.x;
    const dy = ship.y - enemy.y;
    const distance = dx * dx + dy * dy;
    if (distance < best) {
      nearest = ship;
      best = distance;
    }
  }
  return nearest;
}

function addAsteroidFragments(simulation: SimulationState, asteroid: AsteroidState): void {
  // Large rocks split into two smaller rocks. Small fragments are removed on the next hit.
  if (asteroid.radius < 25) return;
  const fragmentRadius = Math.max(11, asteroid.radius * 0.54);
  const baseAngle = Math.atan2(asteroid.vy, asteroid.vx) + 0.72;
  for (let index = 0; index < 2; index += 1) {
    const angle = baseAngle + index * Math.PI;
    simulation.asteroids.push({
      id: nextAsteroidId(simulation),
      x: wrap(asteroid.x + Math.cos(angle) * fragmentRadius * 0.65, simulation.width),
      y: wrap(asteroid.y + Math.sin(angle) * fragmentRadius * 0.65, simulation.height),
      vx: asteroid.vx + Math.cos(angle) * 36,
      vy: asteroid.vy + Math.sin(angle) * 36,
      angle: asteroid.angle + (index ? -0.3 : 0.3),
      angularVelocity: index ? -0.5 : 0.5,
      radius: fragmentRadius,
      hp: 20,
      maxHp: 20,
    });
  }
}

function awardScore(simulation: SimulationState, ownerId: EntityId, points: number): void {
  const owner = simulation.ships.find((ship) => ship.id === ownerId);
  if (owner) owner.score += points;
}

function hitShipByAsteroid(ship: ShipState, simulation: SimulationState): void {
  ship.hp = Math.max(0, ship.hp - 10);
  ship.collisionCooldown = 0.6;
  if (ship.hp <= 0) {
    ship.vx = 0;
    ship.vy = 0;
    ship.respawnTick = simulation.tick + (ship.id >= ENEMY_ID_BASE ? ENEMY_RESPAWN_TICKS : PLAYER_RESPAWN_TICKS);
  }
}

function processShipAsteroidCollisions(simulation: SimulationState): void {
  // Ships take collision damage, but merely brushing a rock must not destroy it.
  // Asteroid HP is reduced by player projectiles below, making the destruction
  // mechanic intentional and visible instead of letting the field disappear over time.
  const allShips = [
    ...simulation.ships.filter((ship) => ship.hp > 0),
    ...simulation.enemies.filter((enemy) => enemy.hp > 0),
  ];
  for (const ship of allShips) {
    if (ship.collisionCooldown > 0) continue;
    for (const asteroid of simulation.asteroids) {
      const radius = ship.radius + asteroid.radius;
      if (squaredDistance(ship, asteroid, simulation) >= radius * radius) continue;
      hitShipByAsteroid(ship, simulation);
      break;
    }
  }
}

function fireEnemyBullets(simulation: SimulationState, dt: number): void {
  const bounds = { width: simulation.width, height: simulation.height };
  for (let index = 0; index < simulation.enemies.length; index += 1) {
    const enemy = simulation.enemies[index];
    if (!enemy) continue;
    if (enemy.hp <= 0) {
      if (simulation.tick >= enemy.respawnTick) respawnEnemy(enemy, simulation);
      else continue;
    }
    const target = nearestLivePlayer(enemy, simulation.ships);
    if (!target) {
      enemy.fireCooldown = Math.max(0, enemy.fireCooldown - dt);
      continue;
    }
    const dx = wrappedDelta(target.x, enemy.x, simulation.width);
    const dy = wrappedDelta(target.y, enemy.y, simulation.height);
    const targetAngle = Math.atan2(dy, dx);
    const turnError = normalizeAngle(targetAngle - enemy.angle);
    const distance = Math.hypot(dx, dy);
    const controls = {
      turn: clamp(turnError / (TURN_RATE * dt), -1, 1),
      throttle: distance > 220 ? 0.8 : distance < 120 ? -0.18 : 0.12,
      fire: distance < 520 && Math.abs(turnError) < 0.22,
    };
    const result = integrateShip(enemy, controls, dt, bounds);
    Object.assign(enemy, result.state);
    enemy.maxHp = enemy.maxHp || simulation.enemyHp;
    if (result.fired) simulation.bullets.push(createBulletFromShip(enemy, nextBulletId(simulation), enemy.id, enemy.shotsFired % 5 === 0));
  }
}

export function stepSimulation(simulation: SimulationState, inputsByPlayerId: ReadonlyMap<EntityId, ControlInput> = new Map<EntityId, ControlInput>(), dt = SIM_DT): SimulationState {
  const bounds = { width: simulation.width, height: simulation.height };
  const nextShips = [];
  for (const ship of simulation.ships) {
    if (ship.hp <= 0) {
      if (simulation.tick >= ship.respawnTick) respawnShip(ship, simulation);
      else {
        nextShips.push(ship);
        continue;
      }
    }
    const input = inputsByPlayerId.get(ship.id) ?? {};
    const result = integrateShip(ship, input, dt, bounds);
    nextShips.push(result.state);
    if (result.fired) simulation.bullets.push(createBulletFromShip(result.state, nextBulletId(simulation), ship.id, result.state.shotsFired % 5 === 0));
  }
  simulation.ships = nextShips;

  for (const asteroid of simulation.asteroids) {
    asteroid.x = wrap(asteroid.x + asteroid.vx * dt, simulation.width);
    asteroid.y = wrap(asteroid.y + asteroid.vy * dt, simulation.height);
    asteroid.angle = normalizeAngle(asteroid.angle + asteroid.angularVelocity * dt);
  }

  // Collecting is server-authoritative. A full-health player can still collect the pickup;
  // it awards a small score bonus rather than appearing to pass through it.
  for (const pickup of simulation.pickups) {
    if (!pickup.active && simulation.tick >= pickup.respawnTick) pickup.active = true;
    if (!pickup.active) continue;
    for (const ship of simulation.ships) {
      if (ship.hp <= 0) continue;
      const radius = pickup.radius + ship.radius;
      if (squaredDistance(ship, pickup, simulation) < radius * radius) {
        const oldHp = ship.hp;
        ship.hp = Math.min(100, ship.hp + 35);
        if (oldHp === ship.hp) ship.score += 5;
        pickup.active = false;
        pickup.respawnTick = simulation.tick + PICKUP_RESPAWN_TICKS;
        break;
      }
    }
  }

  fireEnemyBullets(simulation, dt);
  processShipAsteroidCollisions(simulation);

  for (let index = simulation.bullets.length - 1; index >= 0; index -= 1) {
    const bullet = simulation.bullets[index];
    if (!bullet) continue;
    steerHomingBullet(bullet, simulation, dt);
    bullet.x = wrap(bullet.x + bullet.vx * dt, simulation.width);
    bullet.y = wrap(bullet.y + bullet.vy * dt, simulation.height);
    bullet.ttl -= dt;
    if (bullet.ttl <= 0) {
      simulation.bullets.splice(index, 1);
      continue;
    }

    let hit = false;
    // Player projectiles damage asteroids. Enemy projectiles pass through rocks so the
    // asteroid field cannot seem to decay by itself while the player is not shooting.
    if (bullet.ownerId < ENEMY_ID_BASE) {
      for (let asteroidIndex = simulation.asteroids.length - 1; asteroidIndex >= 0; asteroidIndex -= 1) {
        const asteroid = simulation.asteroids[asteroidIndex];
        if (!asteroid) continue;
        const radius = asteroid.radius + (bullet.radius || 4);
        if (squaredDistance(bullet, asteroid, simulation) < radius * radius) {
          asteroid.hp -= 20;
          hit = true;
          if (asteroid.hp <= 0) {
            addAsteroidFragments(simulation, asteroid);
            simulation.asteroids.splice(asteroidIndex, 1);
            awardScore(simulation, bullet.ownerId, 10);
          }
          break;
        }
      }
    }

    if (!hit) {
      const isEnemyBullet = bullet.ownerId >= ENEMY_ID_BASE;
      for (const ship of simulation.ships) {
        if (ship.hp <= 0 || ship.id === bullet.ownerId) continue;
        const radius = ship.radius + (bullet.radius || 4);
        if (squaredDistance(bullet, ship, simulation) < radius * radius) {
          ship.hp -= 20;
          hit = true;
          if (ship.hp <= 0) {
            ship.hp = 0;
            ship.vx = 0;
            ship.vy = 0;
            ship.respawnTick = simulation.tick + PLAYER_RESPAWN_TICKS;
            if (!isEnemyBullet) awardScore(simulation, bullet.ownerId, 100);
          }
          break;
        }
      }
    }

    if (!hit && bullet.ownerId < ENEMY_ID_BASE) {
      for (const enemy of simulation.enemies) {
        if (enemy.hp <= 0) continue;
        const radius = enemy.radius + (bullet.radius || 4);
        if (squaredDistance(bullet, enemy, simulation) < radius * radius) {
          enemy.hp -= 20;
          hit = true;
          if (enemy.hp <= 0) {
            enemy.hp = 0;
            enemy.vx = 0;
            enemy.vy = 0;
            enemy.respawnTick = simulation.tick + ENEMY_RESPAWN_TICKS;
            awardScore(simulation, bullet.ownerId, 100);
          }
          break;
        }
      }
    }

    if (hit) simulation.bullets.splice(index, 1);
  }

  simulation.tick = stepNumber(simulation.tick + 1);
  return simulation;
}

export function cloneShip(ship: ShipState): ShipState {
  return { ...ship };
}
