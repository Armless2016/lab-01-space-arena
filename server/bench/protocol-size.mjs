import { createSimulation, addPlayer, stepSimulation, SIM_DT } from '../../shared/simulation.js';
import { encodeSnapshotBinary } from '../../shared/protocol.js';

const simulation = createSimulation({ width: 1100, height: 620, seed: 4242, asteroidCount: 12 });
addPlayer(simulation, 1);
addPlayer(simulation, 2);
const controls = new Map([[1, { seq: 41, throttle: 1, turn: 0.5, fire: true }], [2, { seq: 17, throttle: 0.2, turn: -1, fire: false }]]);
for (let index = 0; index < 8; index += 1) stepSimulation(simulation, controls, SIM_DT);
const snapshot = {
  type: 'snapshot', version: 1, tick: simulation.tick, ackSeq: 41, serverTimeMs: 987654,
  width: simulation.width, height: simulation.height,
  players: simulation.ships, bullets: simulation.bullets, asteroids: simulation.asteroids,
};
const jsonBytes = Buffer.byteLength(JSON.stringify(snapshot));
const binaryBytes = encodeSnapshotBinary(snapshot).byteLength;
console.log(JSON.stringify({
  players: snapshot.players.length,
  bullets: snapshot.bullets.length,
  asteroids: snapshot.asteroids.length,
  jsonBytes,
  binaryBytes,
  reductionPercent: Number(((1 - binaryBytes / jsonBytes) * 100).toFixed(1)),
  inputJsonBytes: Buffer.byteLength(JSON.stringify({ type: 'input', seq: 1234, throttle: 1, turn: -1, fire: true })),
  inputBinaryBytes: 9,
}, null, 2));
