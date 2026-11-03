import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  addPlayer, binarySnapshotSize, createBulletFromShip, createSimulation, integrateShip,
  decodeInputBinary, decodeSnapshotBinary, encodeInputBinary, encodeSnapshotBinary,
} from '../index.ts';
import { entityId, inputSeq, stepNumber, type InputMessage, type SnapshotMessage } from '../types.ts';
import { ClientMessageSchema } from '../schemas.ts';

function makeSnapshot(seed = 77): SnapshotMessage {
  const simulation = createSimulation({ seed, asteroidCount: 4, pickupCount: 3, enemyCount: 2 });
  const ship = addPlayer(simulation, entityId(1));
  const bullet = createBulletFromShip(ship, 20, ship.id, true);
  return {
    type: 'snapshot', version: 3, tick: stepNumber(12), ackSeq: inputSeq(8), serverTimeMs: 987654,
    width: simulation.width, height: simulation.height,
    players: simulation.ships.map((item) => ({ ...item, kind: 'ship' as const })),
    enemies: simulation.enemies.map((item) => ({ ...item, kind: 'enemy' as const })),
    bullets: [{ ...bullet, kind: 'bullet' as const }],
    asteroids: simulation.asteroids.map((item) => ({ ...item, kind: 'asteroid' as const })),
    pickups: simulation.pickups.map((item) => ({ kind: 'pickup' as const, id: item.id, x: item.x, y: item.y, radius: item.radius, active: item.active })),
  };
}

describe('binary protocol properties (fast-check)', () => {
  it('round-trips input after expected int8 quantization', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 0xffff_ffff }),
      fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
      fc.boolean(),
      (seq, throttle, turn, fire) => {
        const input: InputMessage = { type: 'input', seq: inputSeq(seq), throttle, turn, fire };
        const decoded = decodeInputBinary(encodeInputBinary(input));
        expect(Number(decoded.seq)).toBe(seq);
        expect(decoded.throttle).toBeCloseTo(Math.round(throttle * 127) / 127, 6);
        expect(decoded.turn).toBeCloseTo(Math.round(turn * 127) / 127, 6);
        expect(decoded.fire).toBe(fire);
      },
    ), { numRuns: 150 });
  });

  it('matches the encoded frame length to the documented binary size', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 15 }),
      fc.integer({ min: 0, max: 15 }),
      (asteroidCount, pickupCount) => {
        const base = makeSnapshot(9);
        const snapshot: SnapshotMessage = {
          ...base,
          asteroids: base.asteroids.slice(0, asteroidCount),
          pickups: base.pickups.slice(0, pickupCount),
        };
        expect(encodeSnapshotBinary(snapshot).byteLength).toBe(binarySnapshotSize(snapshot));
      },
    ), { numRuns: 100 });
  });

  it('rejects every truncated snapshot buffer instead of reading out of bounds', () => {
    fc.assert(fc.property(fc.uint8Array({ minLength: 0, maxLength: 22 }), (bytes) => {
      expect(() => decodeSnapshotBinary(bytes)).toThrow();
    }), { numRuns: 100 });
  });

  it('keeps integrated ships inside every generated arena', () => {
    fc.assert(fc.property(
      fc.double({ min: -1_000_000, max: 1_000_000, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: -1_000_000, max: 1_000_000, noNaN: true, noDefaultInfinity: true }),
      fc.integer({ min: 320, max: 4096 }),
      fc.integer({ min: 240, max: 2160 }),
      fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
      (x, y, width, height, throttle) => {
        const simulation = createSimulation({ width, height, asteroidCount: 0, pickupCount: 0, enemyCount: 0 });
        const ship = addPlayer(simulation, entityId(1));
        ship.x = ((x % width) + width) % width;
        ship.y = ((y % height) + height) % height;
        const integrated = integrateShip(ship, { throttle }, 1 / 30, { width, height }).state;
        expect(integrated.x).toBeGreaterThanOrEqual(0);
        expect(integrated.x).toBeLessThan(width);
        expect(integrated.y).toBeGreaterThanOrEqual(0);
        expect(integrated.y).toBeLessThan(height);
      },
    ), { numRuns: 150 });
  });

  it('accepts valid client messages and rejects damaged variants', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 0xffff_ffff }),
      fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }),
      fc.boolean(),
      (seq, throttle, turn, fire) => {
        const valid = { type: 'input', seq, throttle, turn, fire };
        expect(ClientMessageSchema.safeParse(valid).success).toBe(true);
        expect(ClientMessageSchema.safeParse({ ...valid, throttle: 2 }).success).toBe(false);
        expect(ClientMessageSchema.safeParse({ ...valid, type: 'unknown' }).success).toBe(false);
      },
    ), { numRuns: 100 });
  });

  it('round-trips generated snapshot angles within Int16 quantization error', () => {
    fc.assert(fc.property(
      fc.double({ min: -Math.PI, max: Math.PI, noNaN: true, noDefaultInfinity: true }),
      (angle) => {
        const base = makeSnapshot();
        const first = base.players[0];
        if (!first) throw new Error('fixture must contain a player');
        const snapshot: SnapshotMessage = { ...base, players: [{ ...first, angle }, ...base.players.slice(1)] };
        const decoded = decodeSnapshotBinary(encodeSnapshotBinary(snapshot));
        let normalized = angle;
        while (normalized > Math.PI) normalized -= Math.PI * 2;
        while (normalized < -Math.PI) normalized += Math.PI * 2;
        const expected = Math.round((normalized / Math.PI) * 32767) / 32767 * Math.PI;
        expect(decoded.players[0]?.angle).toBeCloseTo(expected, 10);
      },
    ), { numRuns: 150 });
  });

  it('round-trips snapshot entity lists and scalar coordinates', () => {
    const snapshot = makeSnapshot();
    const decoded = decodeSnapshotBinary(encodeSnapshotBinary(snapshot));
    expect(decoded.players[0]?.x).toBeCloseTo(snapshot.players[0]!.x, 4);
    expect(decoded.asteroids).toHaveLength(snapshot.asteroids.length);
    expect(decoded.pickups).toHaveLength(snapshot.pickups.length);
    expect(decoded.enemies).toHaveLength(snapshot.enemies.length);
  });
});

