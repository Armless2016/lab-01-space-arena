import { describe, expect, it } from 'vitest';
import {
  SIM_DT, addPlayer, createBulletFromShip, createPlayerShip, createSimulation, hashSeed, integrateShip,
  removePlayer, stepSimulation, wrap,
} from '../simulation.ts';
import { entityId, stepNumber, type ControlInput } from '../types.ts';

function onePlayerSimulation(seed = 19) {
  const simulation = createSimulation({ seed, asteroidCount: 0, pickupCount: 0, enemyCount: 0 });
  const ship = addPlayer(simulation, entityId(1));
  return { simulation, ship };
}

describe('shared deterministic simulation', () => {
  it('integrates forward thrust', () => {
    const { ship } = onePlayerSimulation();
    const next = integrateShip(ship, { throttle: 1 }, SIM_DT, { width: 960, height: 540 }).state;
    expect(next.vx).toBeGreaterThan(0);
    expect(next.x).toBeGreaterThan(ship.x);
  });
  it('integrates reverse thrust', () => {
    const { ship } = onePlayerSimulation();
    const next = integrateShip(ship, { throttle: -1 }, SIM_DT, { width: 960, height: 540 }).state;
    expect(next.vx).toBeLessThan(0);
  });
  it('turns the ship using the input control', () => {
    const { ship } = onePlayerSimulation();
    const next = integrateShip(ship, { turn: 1 }, SIM_DT).state;
    expect(next.angle).toBeGreaterThan(ship.angle);
  });
  it('clamps the ship to maximum speed', () => {
    const { ship } = onePlayerSimulation();
    const fast = { ...ship, vx: 900, vy: 900 };
    const next = integrateShip(fast, {}, SIM_DT).state;
    expect(Math.hypot(next.vx, next.vy)).toBeLessThanOrEqual(250.001);
  });
  it('wraps positions inside arena bounds', () => {
    const { ship } = onePlayerSimulation();
    const nearEdge = { ...ship, x: 959, vx: 250 };
    const next = integrateShip(nearEdge, {}, 1, { width: 960, height: 540 }).state;
    expect(next.x).toBeGreaterThanOrEqual(0);
    expect(next.x).toBeLessThan(960);
  });
  it('does not move a destroyed ship before respawn', () => {
    const { ship } = onePlayerSimulation();
    const destroyed = { ...ship, hp: 0, vx: 120, vy: 80 };
    const next = integrateShip(destroyed, { throttle: 1 }, SIM_DT).state;
    expect(next.vx).toBe(0);
    expect(next.vy).toBe(0);
  });
  it('fires only after the cooldown is ready', () => {
    const { ship } = onePlayerSimulation();
    expect(integrateShip(ship, { fire: true }, SIM_DT).fired).toBe(true);
    const after = integrateShip(ship, { fire: true }, SIM_DT).state;
    expect(integrateShip(after, { fire: true }, SIM_DT).fired).toBe(false);
  });
  it('does not mutate the input ship object', () => {
    const { ship } = onePlayerSimulation();
    const before = { ...ship };
    integrateShip(ship, { throttle: 1, turn: 1 }, SIM_DT);
    expect(ship).toEqual(before);
  });
  it('increments simulation tick once per step', () => {
    const { simulation } = onePlayerSimulation();
    stepSimulation(simulation);
    expect(Number(simulation.tick)).toBe(1);
  });
  it('produces identical states for equal seeds and inputs', () => {
    const first = createSimulation({ seed: 123, asteroidCount: 8, pickupCount: 3, enemyCount: 2 });
    const second = createSimulation({ seed: 123, asteroidCount: 8, pickupCount: 3, enemyCount: 2 });
    addPlayer(first, entityId(1)); addPlayer(second, entityId(1));
    for (let tick = 0; tick < 180; tick += 1) {
      const controls: ControlInput = { throttle: tick % 40 < 30 ? 1 : -0.3, turn: tick % 60 < 30 ? 0.4 : -0.4, fire: tick % 9 === 0 };
      const mapA = new Map([[entityId(1), controls]]);
      const mapB = new Map([[entityId(1), controls]]);
      stepSimulation(first, mapA); stepSimulation(second, mapB);
    }
    expect(first).toEqual(second);
  });
  it('creates the same random asteroid field for an equal seed', () => {
    expect(createSimulation({ seed: 42 }).asteroids).toEqual(createSimulation({ seed: 42 }).asteroids);
  });
  it('creates a different asteroid field for a different seed', () => {
    expect(createSimulation({ seed: 42 }).asteroids).not.toEqual(createSimulation({ seed: 43 }).asteroids);
  });
  it('does not add a duplicate player id', () => {
    const { simulation, ship } = onePlayerSimulation();
    expect(addPlayer(simulation, entityId(1))).toBe(ship);
    expect(simulation.ships).toHaveLength(1);
  });
  it('removes a player and recycles its bullets', () => {
    const { simulation, ship } = onePlayerSimulation();
    const bullet = createBulletFromShip(ship, 44, ship.id);
    simulation.bullets.push(bullet);
    removePlayer(simulation, ship.id);
    expect(simulation.ships).toHaveLength(0);
    expect(simulation.bullets).toHaveLength(0);
    expect(simulation.bulletPool).toContain(bullet);
  });
  it('collects an active pickup and restores health', () => {
    const simulation = createSimulation({ seed: 2, asteroidCount: 0, pickupCount: 1, enemyCount: 0 });
    const ship = addPlayer(simulation, entityId(1));
    ship.hp = 40;
    const pickup = simulation.pickups[0]!;
    pickup.x = ship.x; pickup.y = ship.y;
    stepSimulation(simulation);
    expect(ship.hp).toBe(75);
    expect(pickup.active).toBe(false);
  });
  it('awards score for collecting a pickup at full health', () => {
    const simulation = createSimulation({ seed: 2, asteroidCount: 0, pickupCount: 1, enemyCount: 0 });
    const ship = addPlayer(simulation, entityId(1));
    const pickup = simulation.pickups[0]!;
    pickup.x = ship.x; pickup.y = ship.y;
    stepSimulation(simulation);
    expect(ship.score).toBe(5);
    expect(pickup.active).toBe(false);
  });
  it('damages and splits an asteroid when hit by a player bullet', () => {
    const simulation = createSimulation({ seed: 2, asteroidCount: 1, pickupCount: 0, enemyCount: 0 });
    const ship = addPlayer(simulation, entityId(1));
    const asteroid = simulation.asteroids[0]!;
    asteroid.hp = 20;
    const bullet = createBulletFromShip(ship, 99, ship.id);
    bullet.x = asteroid.x; bullet.y = asteroid.y; bullet.vx = 0; bullet.vy = 0;
    simulation.bullets.push(bullet);
    stepSimulation(simulation);
    expect(simulation.asteroids.length).toBe(2);
    expect(simulation.asteroids.every((item) => item.radius < asteroid.radius)).toBe(true);
  });
  it('recycles a bullet when its lifetime expires', () => {
    const { simulation, ship } = onePlayerSimulation();
    ship.fireCooldown = 0;
    const inputs = new Map([[ship.id, { fire: true }]]);
    stepSimulation(simulation, inputs);
    const bullet = simulation.bullets[0]!;
    bullet.ttl = 0.001;
    stepSimulation(simulation);
    expect(simulation.bullets).toHaveLength(0);
    expect(simulation.bulletPool).toContain(bullet);
  });
  it('reuses a pooled bullet object for a later shot', () => {
    const { simulation, ship } = onePlayerSimulation();
    ship.fireCooldown = 0;
    stepSimulation(simulation, new Map([[ship.id, { fire: true }]]));
    const firstBullet = simulation.bullets[0]!;
    firstBullet.ttl = 0.001;
    stepSimulation(simulation);
    ship.fireCooldown = 0;
    stepSimulation(simulation, new Map([[ship.id, { fire: true }]]));
    expect(simulation.bullets[0]).toBe(firstBullet);
  });
  it('respawns a player whose respawn tick has arrived', () => {
    const { simulation, ship } = onePlayerSimulation();
    ship.hp = 0; ship.respawnTick = simulation.tick;
    stepSimulation(simulation);
    expect(simulation.ships[0]?.hp).toBe(100);
  });
  it('caps asteroid and pickup counts to safe configured ranges', () => {
    const simulation = createSimulation({ asteroidCount: 500, pickupCount: 500, enemyCount: 0 });
    expect(simulation.asteroids.length).toBe(100);
    expect(simulation.pickups.length).toBe(20);
  });

  it('moves enemies and lets them fire at a nearby player', () => {
    const simulation = createSimulation({ seed: 11, asteroidCount: 0, pickupCount: 0, enemyCount: 1 });
    const ship = addPlayer(simulation, entityId(1));
    const enemy = simulation.enemies[0]!;
    enemy.x = ship.x + 300; enemy.y = ship.y; enemy.angle = Math.PI; enemy.fireCooldown = 0;
    stepSimulation(simulation);
    expect(simulation.bullets.some((bullet) => bullet.ownerId === enemy.id)).toBe(true);
  });

  it('decreases enemy cooldown when there is no live player target', () => {
    const simulation = createSimulation({ seed: 12, asteroidCount: 0, pickupCount: 0, enemyCount: 1 });
    const enemy = simulation.enemies[0]!;
    enemy.fireCooldown = 1;
    stepSimulation(simulation);
    expect(enemy.fireCooldown).toBeLessThan(1);
    expect(simulation.bullets).toHaveLength(0);
  });

  it('respawns an enemy when its respawn tick arrives', () => {
    const simulation = createSimulation({ seed: 13, asteroidCount: 0, pickupCount: 0, enemyCount: 1 });
    const enemy = simulation.enemies[0]!;
    enemy.hp = 0; enemy.respawnTick = simulation.tick;
    stepSimulation(simulation);
    expect(enemy.hp).toBe(60);
  });

  it('damages a player with an enemy-owned bullet', () => {
    const simulation = createSimulation({ seed: 14, asteroidCount: 0, pickupCount: 0, enemyCount: 1 });
    const ship = addPlayer(simulation, entityId(1));
    const enemy = simulation.enemies[0]!;
    const bullet = createBulletFromShip({ ...enemy, x: ship.x, y: ship.y, angle: 0 }, 88, enemy.id);
    bullet.x = ship.x; bullet.y = ship.y; bullet.vx = 0; bullet.vy = 0;
    simulation.bullets.push(bullet);
    stepSimulation(simulation);
    expect(ship.hp).toBe(80);
  });

  it('damages an enemy with a player-owned bullet and awards score on defeat', () => {
    const simulation = createSimulation({ seed: 15, asteroidCount: 0, pickupCount: 0, enemyCount: 1 });
    const ship = addPlayer(simulation, entityId(1));
    const enemy = simulation.enemies[0]!;
    enemy.x = ship.x + 100; enemy.y = ship.y; enemy.hp = 20; enemy.fireCooldown = 100;
    const bullet = createBulletFromShip(ship, 99, ship.id);
    bullet.x = enemy.x; bullet.y = enemy.y; bullet.vx = 0; bullet.vy = 0;
    simulation.bullets.push(bullet);
    stepSimulation(simulation);
    expect(enemy.hp).toBe(0);
    expect(ship.score).toBe(100);
  });

  it('steers a homing player bullet toward the nearest asteroid', () => {
    const simulation = createSimulation({ seed: 16, asteroidCount: 1, pickupCount: 0, enemyCount: 0 });
    const ship = addPlayer(simulation, entityId(1));
    const asteroid = simulation.asteroids[0]!;
    asteroid.x = ship.x + 180; asteroid.y = ship.y;
    const bullet = createBulletFromShip(ship, 111, ship.id, true);
    bullet.x = ship.x + 40; bullet.y = ship.y + 80; bullet.angle = Math.PI / 2;
    bullet.vx = 0; bullet.vy = 120;
    simulation.bullets.push(bullet);
    stepSimulation(simulation);
    expect(bullet.angle).toBeLessThan(Math.PI / 2);
  });

  it('damages a ship on asteroid contact without destroying the asteroid', () => {
    const simulation = createSimulation({ seed: 17, asteroidCount: 1, pickupCount: 0, enemyCount: 0 });
    const ship = addPlayer(simulation, entityId(1));
    const asteroid = simulation.asteroids[0]!;
    asteroid.x = ship.x; asteroid.y = ship.y; asteroid.hp = 40;
    stepSimulation(simulation);
    expect(ship.hp).toBe(90);
    expect(simulation.asteroids).toHaveLength(1);
    expect(asteroid.hp).toBe(40);
  });

  it('reactivates a pickup after its respawn tick and allows collection again', () => {
    const simulation = createSimulation({ seed: 18, asteroidCount: 0, pickupCount: 1, enemyCount: 0 });
    const ship = addPlayer(simulation, entityId(1));
    const pickup = simulation.pickups[0]!;
    pickup.x = ship.x; pickup.y = ship.y; pickup.active = false; pickup.respawnTick = stepNumber(1);
    stepSimulation(simulation);
    expect(pickup.active).toBe(false);
    stepSimulation(simulation);
    expect(ship.hp).toBe(100);
    expect(pickup.active).toBe(false);
    expect(pickup.respawnTick).toBeGreaterThan(simulation.tick);
  });


  it('hashes numeric and string room seeds deterministically', () => {
    expect(hashSeed('rookie-orbit')).toBe(hashSeed('rookie-orbit'));
    expect(hashSeed(1)).toBeGreaterThan(0);
    expect(hashSeed('')).toBeGreaterThan(0);
  });

  it('normalizes invalid arena dimensions and clamps enemy health', () => {
    const simulation = createSimulation({ width: 10, height: 10, seed: 0, enemyHp: 999, asteroidCount: -5, pickupCount: -1, enemyCount: 1 });
    expect(simulation.width).toBe(320);
    expect(simulation.height).toBe(240);
    expect(simulation.seed).toBe(1);
    expect(simulation.enemyHp).toBe(255);
    expect(simulation.asteroids).toHaveLength(0);
    expect(simulation.pickups).toHaveLength(0);
  });

  it('creates players in alternating spawn slots and wraps non-positive sizes safely', () => {
    const second = createPlayerShip(2, 960, 540, 1);
    expect(second.angle).toBe(Math.PI);
    expect(second.x).toBe(720);
    expect(wrap(50, 0)).toBe(0);
  });

  it('clamps extreme input values and supports default arena bounds', () => {
    const { ship } = onePlayerSimulation();
    const next = integrateShip(ship, { throttle: 999, turn: -999 }, SIM_DT).state;
    expect(next.angle).toBeLessThanOrEqual(Math.PI);
    expect(Math.hypot(next.vx, next.vy)).toBeLessThanOrEqual(250);
  });

  it('can refill an existing bullet object rather than allocating a new one', () => {
    const { ship } = onePlayerSimulation();
    const reusable = createBulletFromShip(ship, 3, ship.id);
    reusable.ttl = -5;
    const result = createBulletFromShip({ ...ship, angle: Math.PI / 2 }, 4, ship.id, true, reusable);
    expect(result).toBe(reusable);
    expect(result.ttl).toBeGreaterThan(0);
    expect(result.homing).toBe(true);
  });

  it('does not damage a pickup-ignoring player after the player is dead', () => {
    const simulation = createSimulation({ seed: 21, asteroidCount: 0, pickupCount: 1, enemyCount: 0 });
    const ship = addPlayer(simulation, entityId(1));
    const pickup = simulation.pickups[0]!;
    ship.hp = 0; ship.respawnTick = stepNumber(10); pickup.x = ship.x; pickup.y = ship.y;
    stepSimulation(simulation);
    expect(pickup.active).toBe(true);
  });

  it('does not repeatedly damage a ship while asteroid collision cooldown is active', () => {
    const simulation = createSimulation({ seed: 22, asteroidCount: 1, pickupCount: 0, enemyCount: 0 });
    const ship = addPlayer(simulation, entityId(1));
    const asteroid = simulation.asteroids[0]!;
    asteroid.x = ship.x; asteroid.y = ship.y;
    stepSimulation(simulation);
    const hpAfterFirstHit = ship.hp;
    stepSimulation(simulation);
    expect(hpAfterFirstHit).toBe(90);
    expect(ship.hp).toBe(hpAfterFirstHit);
  });

  it('does not split a small asteroid when it is destroyed', () => {
    const simulation = createSimulation({ seed: 23, asteroidCount: 1, pickupCount: 0, enemyCount: 0 });
    const ship = addPlayer(simulation, entityId(1));
    const asteroid = simulation.asteroids[0]!;
    asteroid.radius = 20; asteroid.hp = 20;
    const bullet = createBulletFromShip(ship, 55, ship.id);
    bullet.x = asteroid.x; bullet.y = asteroid.y; bullet.vx = 0; bullet.vy = 0;
    simulation.bullets.push(bullet);
    stepSimulation(simulation);
    expect(simulation.asteroids).toHaveLength(0);
  });

  it('recycles a player bullet that hits a target', () => {
    const simulation = createSimulation({ seed: 24, asteroidCount: 1, pickupCount: 0, enemyCount: 0 });
    const ship = addPlayer(simulation, entityId(1));
    const asteroid = simulation.asteroids[0]!;
    const bullet = createBulletFromShip(ship, 56, ship.id);
    bullet.x = asteroid.x; bullet.y = asteroid.y; bullet.vx = 0; bullet.vy = 0;
    simulation.bullets.push(bullet);
    stepSimulation(simulation);
    expect(simulation.bullets).toHaveLength(0);
    expect(simulation.bulletPool).toContain(bullet);
  });

  it('does not damage asteroids with enemy-owned bullets', () => {
    const simulation = createSimulation({ seed: 25, asteroidCount: 1, pickupCount: 0, enemyCount: 1 });
    const enemy = simulation.enemies[0]!;
    const asteroid = simulation.asteroids[0]!;
    enemy.fireCooldown = 100;
    const bullet = createBulletFromShip(enemy, 57, enemy.id);
    bullet.x = asteroid.x; bullet.y = asteroid.y; bullet.vx = 0; bullet.vy = 0;
    simulation.bullets.push(bullet);
    stepSimulation(simulation);
    expect(asteroid.hp).toBe(40);
  });

  it('does not move or collide with players whose respawn timer is still active', () => {
    const { simulation, ship } = onePlayerSimulation();
    ship.hp = 0; ship.vx = 100; ship.vy = 100; ship.respawnTick = stepNumber(100);
    const before = { x: ship.x, y: ship.y };
    stepSimulation(simulation);
    expect(ship.x).toBe(before.x);
    expect(ship.y).toBe(before.y);
  });

  it('wraps bullet identifiers after the uint16 limit', () => {
    const { simulation, ship } = onePlayerSimulation();
    simulation.nextBulletId = 65535;
    ship.fireCooldown = 0;
    stepSimulation(simulation, new Map([[ship.id, { fire: true }]]));
    expect(simulation.bullets[0]?.id).toBe(65535);
    expect(simulation.nextBulletId).toBe(1);
  });

  it('wrap helper handles negative coordinates', () => expect(wrap(-1, 10)).toBe(9));
});
