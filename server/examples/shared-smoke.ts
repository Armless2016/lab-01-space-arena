import assert from 'node:assert/strict';
import {
  SIM_DT,
  addPlayer,
  createBulletFromShip,
  createSimulation,
  integrateShip,
  stepSimulation,
} from '../../shared/simulation.ts';
import {
  decodeInputBinary,
  decodeSnapshotBinary,
  encodeInputBinary,
  encodeSnapshotBinary,
  binarySnapshotSize,
} from '../../shared/protocol.ts';

function withKind<T, K extends 'ship' | 'enemy' | 'bullet' | 'asteroid' | 'pickup'>(items: readonly T[], kind: K): Array<T & { readonly kind: K }> {
  return items.map((item) => ({ ...item, kind }));
}

const simulation = createSimulation({
  width: 960, height: 540, seed: 12345, asteroidCount: 5, pickupCount: 3, enemyCount: 2,
});
const first = addPlayer(simulation, 1);
addPlayer(simulation, 2);
const movement = { seq: 1, throttle: 1, turn: 0.25, fire: true };
const integrated = integrateShip(first, movement, SIM_DT, simulation);
assert.ok(Number.isFinite(integrated.state.x));
assert.equal(integrated.fired, true);
stepSimulation(simulation, new Map([[1, movement], [2, { seq: 1, throttle: 0, turn: 0, fire: false }]]), SIM_DT);
assert.equal(simulation.tick, 1);
assert.equal(simulation.ships.length, 2);
assert.equal(simulation.enemies.length, 2);
assert.equal(simulation.pickups.length, 3);

const deterministicA = createSimulation({ width: 960, height: 540, seed: 991, asteroidCount: 4, pickupCount: 3, enemyCount: 2 });
const deterministicB = createSimulation({ width: 960, height: 540, seed: 991, asteroidCount: 4, pickupCount: 3, enemyCount: 2 });
addPlayer(deterministicA, 1);
addPlayer(deterministicB, 1);
const sharedInput = new Map([[1, { seq: 1, throttle: 1, turn: -1, fire: true }]]);
for (let index = 0; index < 25; index += 1) {
  stepSimulation(deterministicA, sharedInput, SIM_DT);
  stepSimulation(deterministicB, sharedInput, SIM_DT);
}
assert.deepEqual(deterministicA.ships, deterministicB.ships);
assert.deepEqual(deterministicA.enemies, deterministicB.enemies);
assert.deepEqual(deterministicA.bullets, deterministicB.bullets);
assert.deepEqual(deterministicA.asteroids, deterministicB.asteroids);
assert.deepEqual(deterministicA.pickups, deterministicB.pickups);

// Pickup collision must work even if the player is at full HP.
const pickupSimulation = createSimulation({ width: 960, height: 540, seed: 7, asteroidCount: 0, pickupCount: 1, enemyCount: 0 });
const collector = addPlayer(pickupSimulation, 1);
collector.x = pickupSimulation.pickups[0].x - (pickupSimulation.pickups[0].radius + collector.radius - 1);
collector.y = pickupSimulation.pickups[0].y;
collector.hp = 100;
stepSimulation(pickupSimulation, new Map([[1, { seq: 1, throttle: 0, turn: 0, fire: false }]]), SIM_DT);
assert.equal(pickupSimulation.pickups[0].active, false, 'full-health players still collect pickups');
assert.equal(pickupSimulation.ships[0].score, 5, 'full-health pickup grants score');
const healingSimulation = createSimulation({ width: 960, height: 540, seed: 71, asteroidCount: 0, pickupCount: 1, enemyCount: 0 });
const healingShip = addPlayer(healingSimulation, 1);
healingShip.x = healingSimulation.pickups[0].x - (healingSimulation.pickups[0].radius + healingShip.radius - 1);
healingShip.y = healingSimulation.pickups[0].y;
healingShip.hp = 55;
stepSimulation(healingSimulation, new Map([[1, { seq: 1, throttle: 0, turn: 0, fire: false }]]), SIM_DT);
assert.equal(healingSimulation.ships[0].hp, 90, 'repair pickup restores 35 HP');
assert.equal(healingSimulation.pickups[0].active, false);

// Two hits destroy a parent asteroid and create deterministic fragments.
const asteroidSimulation = createSimulation({ width: 960, height: 540, seed: 8, asteroidCount: 1, pickupCount: 0, enemyCount: 0 });
addPlayer(asteroidSimulation, 1);
const parent = asteroidSimulation.asteroids[0];
parent.vx = 0;
parent.vy = 0;
asteroidSimulation.bullets.push(
  { ...createBulletFromShip(asteroidSimulation.ships[0], 1, 1), x: parent.x, y: parent.y, vx: 0, vy: 0, ttl: 1, homing: false },
  { ...createBulletFromShip(asteroidSimulation.ships[0], 2, 1), x: parent.x, y: parent.y, vx: 0, vy: 0, ttl: 1, homing: false },
);
stepSimulation(asteroidSimulation, new Map([[1, { seq: 1, throttle: 0, turn: 0, fire: false }]]), SIM_DT);
assert.equal(asteroidSimulation.asteroids.length, 2, 'destroyed large asteroid splits into 2 fragments');
assert.ok(asteroidSimulation.asteroids.every((asteroid) => asteroid.radius < parent.radius));

// Rocks have no lifetime timer and ship contact does not destroy them.
const stableField = createSimulation({ width: 960, height: 540, seed: 333, asteroidCount: 3, pickupCount: 0, enemyCount: 0 });
for (const asteroid of stableField.asteroids) { asteroid.vx = 0; asteroid.vy = 0; asteroid.angularVelocity = 0; }
for (let index = 0; index < 900; index += 1) stepSimulation(stableField, new Map(), SIM_DT);
assert.equal(stableField.asteroids.length, 3, 'undamaged asteroids do not expire');
const contactSimulation = createSimulation({ width: 960, height: 540, seed: 334, asteroidCount: 1, pickupCount: 0, enemyCount: 0 });
const contactShip = addPlayer(contactSimulation, 1);
contactShip.x = contactSimulation.asteroids[0].x;
contactShip.y = contactSimulation.asteroids[0].y;
stepSimulation(contactSimulation, new Map([[1, { seq: 1, throttle: 0, turn: 0, fire: false }]]), SIM_DT);
assert.equal(contactSimulation.asteroids.length, 1, 'ship collision cannot silently destroy an asteroid');
assert.equal(contactSimulation.asteroids[0].hp, 40, 'ship contact does not reduce asteroid HP');
const enemyShotSimulation = createSimulation({ width: 960, height: 540, seed: 335, asteroidCount: 1, pickupCount: 0, enemyCount: 0 });
const targetRock = enemyShotSimulation.asteroids[0];
enemyShotSimulation.bullets.push({ id: 1, ownerId: 60001, x: targetRock.x, y: targetRock.y, vx: 0, vy: 0, angle: 0, ttl: 1, radius: 4, homing: false });
stepSimulation(enemyShotSimulation, new Map(), SIM_DT);
assert.equal(enemyShotSimulation.asteroids[0].hp, 40, 'enemy bullets do not make asteroids disappear without player action');

// Enemy AI moves/aims deterministically and can shoot at a player.
const enemySimulation = createSimulation({ width: 960, height: 540, seed: 4242, asteroidCount: 0, pickupCount: 0, enemyCount: 2 });
addPlayer(enemySimulation, 1);
const initialEnemyX = enemySimulation.enemies[0].x;
for (let index = 0; index < 180; index += 1) {
  stepSimulation(enemySimulation, new Map([[1, { seq: index + 1, throttle: 0, turn: 0, fire: false }]]), SIM_DT);
}
assert.notEqual(enemySimulation.enemies[0].x, initialEnemyX, 'enemy AI moves');
assert.ok(enemySimulation.enemies.some((enemy) => enemy.shotsFired > 0), 'enemy AI fires');

const inputBytes = encodeInputBinary(movement);
assert.equal(inputBytes.byteLength, 9);
assert.deepEqual(decodeInputBinary(inputBytes), {
  type: 'input', seq: 1, throttle: 1, turn: Math.round(0.25 * 127) / 127, fire: true,
});
const snapshot = {
  type: 'snapshot', version: 3, tick: simulation.tick, ackSeq: 1, serverTimeMs: 123456,
  width: simulation.width, height: simulation.height,
  players: withKind(simulation.ships, 'ship'), enemies: withKind(simulation.enemies, 'enemy'),
  bullets: [
    ...withKind(simulation.bullets, 'bullet'),
    { ...createBulletFromShip(simulation.ships[0], 555, 1, true), homing: true, kind: 'bullet' },
  ],
  asteroids: withKind(simulation.asteroids, 'asteroid'), pickups: withKind(simulation.pickups, 'pickup'),
};
const encoded = encodeSnapshotBinary(snapshot);
const decoded = decodeSnapshotBinary(encoded);
assert.equal(binarySnapshotSize(snapshot), encoded.byteLength, 'binary size helper matches encoder');
assert.equal(decoded.version, 3);
assert.equal(decoded.tick, snapshot.tick);
assert.equal(decoded.serverTimeMs, snapshot.serverTimeMs);
assert.equal(decoded.players.length, 2);
assert.equal(decoded.players[0]?.kind, 'ship', 'JSON/binary snapshots identify player records by kind');
assert.equal(decoded.enemies.length, 2);
assert.equal(decoded.enemies[0]?.kind, 'enemy', 'decoded enemy records preserve the discriminant');
assert.equal(decoded.bullets.length, snapshot.bullets.length);
assert.ok(decoded.bullets.some((bullet) => bullet.homing), 'binary bullet record preserves the homing flag');
assert.equal(decoded.asteroids.length, snapshot.asteroids.length);
assert.equal(decoded.pickups.length, 3);
assert.equal(decoded.pickups[0]?.kind, 'pickup');
const wrongVersion = encoded.slice(0);
new DataView(wrongVersion).setUint8(0, 99);
assert.throws(() => decodeSnapshotBinary(wrongVersion), /version/i, 'unknown binary protocol version is rejected');
assert.throws(() => decodeSnapshotBinary(encoded.slice(0, encoded.byteLength - 1)), /length/i, 'truncated snapshot is rejected');
const invalidCoordinate = encoded.slice(0);
new DataView(invalidCoordinate).setFloat32(25, Number.POSITIVE_INFINITY, true);
assert.throws(() => decodeSnapshotBinary(invalidCoordinate), /ship.x/i, 'non-finite coordinates are rejected');
assert.throws(() => decodeInputBinary(inputBytes.slice(0, 8)), /length/i, 'truncated input frame is rejected');
assert.ok(Math.abs(decoded.asteroids[0].vx - snapshot.asteroids[0].vx) < 0.001);
assert.ok(Math.abs(decoded.asteroids[0].angularVelocity - snapshot.asteroids[0].angularVelocity) < 0.001);
assert.equal(decoded.asteroids[0].maxHp, snapshot.asteroids[0].maxHp);
assert.equal(decoded.enemies[0].shotsFired, snapshot.enemies[0].shotsFired);
console.log(JSON.stringify({
  ok: true,
  protocolVersion: decoded.version,
  inputBytes: inputBytes.byteLength,
  binarySnapshotBytes: encoded.byteLength,
  players: decoded.players.length,
  enemies: decoded.enemies.length,
  asteroids: decoded.asteroids.length,
  pickups: decoded.pickups.length,
  tick: simulation.tick,
}, null, 2));
