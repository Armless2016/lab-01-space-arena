import { createSimulation, addPlayer, stepSimulation, SIM_DT } from '../../shared/simulation.js';
import { encodeSnapshotBinary } from '../../shared/protocol.js';

const simulation = createSimulation({
  width: 1100,
  height: 620,
  seed: 4242,
  asteroidCount: 12,
  pickupCount: 3,
  enemyCount: 2,
});
addPlayer(simulation, 1);
addPlayer(simulation, 2);
const controls = new Map([
  [1, { seq: 41, throttle: 1, turn: 0.5, fire: true }],
  [2, { seq: 17, throttle: 0.2, turn: -1, fire: false }],
]);
for (let index = 0; index < 8; index += 1) stepSimulation(simulation, controls, SIM_DT);
const snapshot = {
  type: 'snapshot',
  version: simulation.version,
  tick: simulation.tick,
  ackSeq: 41,
  serverTimeMs: 987654,
  width: simulation.width,
  height: simulation.height,
  players: simulation.ships.map(({ id, x, y, vx, vy, angle, radius, hp, maxHp, score, fireCooldown, shotsFired }) => ({ id, x, y, vx, vy, angle, radius, hp, maxHp, score, fireCooldown, shotsFired })),
  enemies: simulation.enemies.map(({ id, x, y, vx, vy, angle, radius, hp, maxHp, score, fireCooldown, shotsFired }) => ({ id, x, y, vx, vy, angle, radius, hp, maxHp, score, fireCooldown, shotsFired })),
  bullets: simulation.bullets.map(({ id, ownerId, x, y, vx, vy, angle, ttl, radius, homing }) => ({ id, ownerId, x, y, vx, vy, angle, ttl, radius, homing })),
  asteroids: simulation.asteroids.map(({ id, x, y, vx, vy, angle, angularVelocity, radius, hp, maxHp }) => ({ id, x, y, vx, vy, angle, angularVelocity, radius, hp, maxHp })),
  pickups: simulation.pickups.map(({ id, x, y, radius, active }) => ({ id, x, y, radius, active })),
};
const jsonBytes = Buffer.byteLength(JSON.stringify(snapshot));
const binaryBytes = encodeSnapshotBinary(snapshot).byteLength;
const jsonInputBytes = Buffer.byteLength(JSON.stringify({ type: 'input', seq: 1234, throttle: 1, turn: -1, fire: true }));
const binaryInputBytes = 9;
console.log(JSON.stringify({
  protocolVersion: snapshot.version,
  players: snapshot.players.length,
  enemies: snapshot.enemies.length,
  bullets: snapshot.bullets.length,
  asteroids: snapshot.asteroids.length,
  pickups: snapshot.pickups.length,
  jsonBytes,
  binaryBytes,
  reductionPercent: Number(((1 - binaryBytes / jsonBytes) * 100).toFixed(1)),
  inputJsonBytes: jsonInputBytes,
  inputBinaryBytes: binaryInputBytes,
  inputReductionPercent: Number(((1 - binaryInputBytes / jsonInputBytes) * 100).toFixed(1)),
}, null, 2));
