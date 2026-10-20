import assert from 'node:assert/strict';
import {
  SIM_DT,
  addPlayer,
  createSimulation,
  integrateShip,
  stepSimulation,
} from '../../shared/simulation.js';
import {
  decodeInputBinary,
  decodeSnapshotBinary,
  encodeInputBinary,
  encodeSnapshotBinary,
} from '../../shared/protocol.js';

const simulation = createSimulation({ width: 960, height: 540, seed: 12345, asteroidCount: 5 });
const first = addPlayer(simulation, 1);
addPlayer(simulation, 2);
const movement = { seq: 1, throttle: 1, turn: 0.25, fire: true };
const integrated = integrateShip(first, movement, SIM_DT, simulation);
assert.ok(Number.isFinite(integrated.state.x));
assert.equal(integrated.fired, true);
stepSimulation(simulation, new Map([[1, movement], [2, { seq: 1, throttle: 0, turn: 0, fire: false }]]), SIM_DT);
assert.equal(simulation.tick, 1);
assert.equal(simulation.ships.length, 2);


const deterministicA = createSimulation({ width: 960, height: 540, seed: 991, asteroidCount: 4 });
const deterministicB = createSimulation({ width: 960, height: 540, seed: 991, asteroidCount: 4 });
addPlayer(deterministicA, 1);
addPlayer(deterministicB, 1);
const sharedInput = new Map([[1, { seq: 1, throttle: 1, turn: -1, fire: true }]]);
for (let index = 0; index < 25; index += 1) {
  stepSimulation(deterministicA, sharedInput, SIM_DT);
  stepSimulation(deterministicB, sharedInput, SIM_DT);
}
assert.deepEqual(deterministicA.ships, deterministicB.ships);
assert.deepEqual(deterministicA.bullets, deterministicB.bullets);
assert.deepEqual(deterministicA.asteroids, deterministicB.asteroids);

const inputBytes = encodeInputBinary(movement);
assert.equal(inputBytes.byteLength, 9);
assert.deepEqual(decodeInputBinary(inputBytes), {
  type: 'input', seq: 1, throttle: 1, turn: Math.round(0.25 * 127) / 127, fire: true,
});
const snapshot = {
  type: 'snapshot', version: 1, tick: simulation.tick, ackSeq: 1, serverTimeMs: 123456,
  width: simulation.width, height: simulation.height,
  players: simulation.ships, bullets: simulation.bullets, asteroids: simulation.asteroids,
};
const encoded = encodeSnapshotBinary(snapshot);
const decoded = decodeSnapshotBinary(encoded);
assert.equal(decoded.tick, snapshot.tick);
assert.equal(decoded.serverTimeMs, snapshot.serverTimeMs);
assert.equal(decoded.players.length, 2);
assert.equal(decoded.bullets.length, snapshot.bullets.length);
assert.equal(decoded.asteroids.length, 5);
assert.ok(Math.abs(decoded.asteroids[0].vx - snapshot.asteroids[0].vx) < 0.001);
assert.ok(Math.abs(decoded.asteroids[0].angularVelocity - snapshot.asteroids[0].angularVelocity) < 0.001);
assert.ok(Math.abs(decoded.bullets[0]?.vx - snapshot.bullets[0]?.vx) < 0.001);
console.log(JSON.stringify({ ok: true, inputBytes: inputBytes.byteLength, binarySnapshotBytes: encoded.byteLength, tick: simulation.tick }, null, 2));
