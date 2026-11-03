import { describe, expect, it } from 'vitest';
import { addPlayer, createSimulation, integrateShip, reconcileShip, SIM_DT } from '../index.ts';
import { entityId, inputSeq, type InputMessage } from '../types.ts';

describe('prediction reconciliation', () => {
  it('replays only inputs not acknowledged by the server', () => {
    const simulation = createSimulation({ asteroidCount: 0, enemyCount: 0, pickupCount: 0 });
    const authoritative = addPlayer(simulation, entityId(1));
    const history: InputMessage[] = [
      { type: 'input', seq: inputSeq(1), throttle: 1, turn: 0, fire: false },
      { type: 'input', seq: inputSeq(2), throttle: 1, turn: 0, fire: false },
      { type: 'input', seq: inputSeq(3), throttle: 0, turn: 1, fire: false },
    ];
    const result = reconcileShip(authoritative, history, 1, SIM_DT, { width: 960, height: 540 });
    expect(result.pending.map((item) => Number(item.seq))).toEqual([2, 3]);
    expect(result.state).toEqual(integrateShip(integrateShip(authoritative, history[1]!, SIM_DT, { width: 960, height: 540 }).state, history[2]!, SIM_DT, { width: 960, height: 540 }).state);
  });
  it('keeps authoritative state if all inputs are acknowledged', () => {
    const simulation = createSimulation({ asteroidCount: 0, enemyCount: 0, pickupCount: 0 });
    const ship = addPlayer(simulation, entityId(7));
    const input: InputMessage = { type: 'input', seq: inputSeq(1), throttle: 1, turn: 0, fire: false };
    const result = reconcileShip(ship, [input], 1, SIM_DT, { width: 960, height: 540 });
    expect(result.pending).toHaveLength(0);
    expect(result.state).toEqual(ship);
  });
  it('does not mutate the authoritative ship', () => {
    const simulation = createSimulation({ asteroidCount: 0, enemyCount: 0, pickupCount: 0 });
    const ship = addPlayer(simulation, entityId(9));
    const before = { ...ship };
    reconcileShip(ship, [{ type: 'input', seq: inputSeq(1), throttle: 1, turn: 0.5, fire: false }], 0, SIM_DT, { width: 960, height: 540 });
    expect(ship).toEqual(before);
  });
  it('returns an empty pending list for empty history', () => {
    const simulation = createSimulation({ asteroidCount: 0, enemyCount: 0, pickupCount: 0 });
    const ship = addPlayer(simulation, entityId(3));
    expect(reconcileShip(ship, [], 0, SIM_DT, { width: 960, height: 540 }).pending).toEqual([]);
  });
});
