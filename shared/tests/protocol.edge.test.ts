import { describe, expect, it } from 'vitest';
import {
  addPlayer,
  createBulletFromShip,
  createSimulation,
  decodeInputBinary,
  decodeSnapshotBinary,
  encodeInputBinary,
  encodeSnapshotBinary,
} from '../index.ts';
import { entityId, inputSeq, stepNumber, type SnapshotMessage } from '../types.ts';

function makeTinySnapshot(): SnapshotMessage {
  const simulation = createSimulation({ width: 640, height: 480, asteroidCount: 0, pickupCount: 0, enemyCount: 0 });
  const ship = addPlayer(simulation, entityId(1));
  const bullet = createBulletFromShip(ship, 2, ship.id);
  return {
    type: 'snapshot', version: 3, tick: stepNumber(1), ackSeq: inputSeq(1), serverTimeMs: 10,
    width: 640, height: 480,
    players: [{ ...ship, kind: 'ship' }], enemies: [],
    bullets: [{ ...bullet, kind: 'bullet' }], asteroids: [], pickups: [],
  };
}

describe('binary protocol defensive decoding', () => {
  it('accepts a DataView for binary input', () => {
    const encoded = encodeInputBinary({ type: 'input', seq: inputSeq(7), throttle: 0.5, turn: -0.5, fire: true });
    expect(decodeInputBinary(new DataView(encoded)).seq).toBe(7);
  });

  it('accepts a byte view with a non-zero offset', () => {
    const encoded = encodeInputBinary({ type: 'input', seq: inputSeq(8), throttle: 0, turn: 0, fire: false });
    const wrapped = new Uint8Array(encoded.byteLength + 4);
    wrapped.set(new Uint8Array(encoded), 2);
    expect(decodeInputBinary(wrapped.subarray(2, 2 + encoded.byteLength)).seq).toBe(8);
  });

  it('rejects wrong input length', () => expect(() => decodeInputBinary(new ArrayBuffer(8))).toThrow(/length/));

  it('rejects unsupported input version and frame type', () => {
    const encoded = new Uint8Array(encodeInputBinary({ type: 'input', seq: inputSeq(1), throttle: 0, turn: 0, fire: false }));
    encoded[0] = 99;
    expect(() => decodeInputBinary(encoded)).toThrow(/version/);
    encoded[0] = 3;
    encoded[1] = 99;
    expect(() => decodeInputBinary(encoded)).toThrow(/version/);
  });

  it('rejects zero input sequence and unknown flags', () => {
    const encoded = new Uint8Array(encodeInputBinary({ type: 'input', seq: inputSeq(1), throttle: 0, turn: 0, fire: false }));
    new DataView(encoded.buffer).setUint32(2, 0, true);
    expect(() => decodeInputBinary(encoded)).toThrow(/sequence/);
    new DataView(encoded.buffer).setUint32(2, 1, true);
    encoded[8] = 2;
    expect(() => decodeInputBinary(encoded)).toThrow(/flags/);
  });

  it('rejects controls outside the signed normalized range', () => {
    const encoded = new Uint8Array(encodeInputBinary({ type: 'input', seq: inputSeq(1), throttle: 0, turn: 0, fire: false }));
    encoded[6] = 128;
    expect(() => decodeInputBinary(encoded)).toThrow(/range/);
  });

  it('accepts a DataView for snapshot decoding', () => {
    const snapshot = makeTinySnapshot();
    const decoded = decodeSnapshotBinary(new DataView(encodeSnapshotBinary(snapshot)));
    expect(decoded.players).toHaveLength(1);
    expect(decoded.bullets).toHaveLength(1);
  });

  it('rejects short, wrong-version and wrong-type snapshot headers', () => {
    expect(() => decodeSnapshotBinary(new ArrayBuffer(22))).toThrow(/short/);
    const encoded = new Uint8Array(encodeSnapshotBinary(makeTinySnapshot()));
    encoded[0] = 99;
    expect(() => decodeSnapshotBinary(encoded)).toThrow(/version/);
    encoded[0] = 3;
    encoded[1] = 99;
    expect(() => decodeSnapshotBinary(encoded)).toThrow(/version/);
  });

  it('rejects a snapshot whose actual length differs from header counts', () => {
    const encoded = encodeSnapshotBinary(makeTinySnapshot());
    expect(() => decodeSnapshotBinary(encoded.slice(0, encoded.byteLength - 1))).toThrow(/length/);
  });

  it('rejects invalid bullet flags', () => {
    const encoded = new Uint8Array(encodeSnapshotBinary(makeTinySnapshot()));
    // Header (23) + one 30-byte player + the bullet flag offset (26).
    encoded[23 + 30 + 26] = 2;
    expect(() => decodeSnapshotBinary(encoded)).toThrow(/bullet flags/);
  });

  it('rejects non-finite and out-of-arena snapshot values', () => {
    const encoded = new Uint8Array(encodeSnapshotBinary(makeTinySnapshot()));
    const view = new DataView(encoded.buffer);
    // The first player x coordinate starts after the 23-byte header and 2-byte id.
    view.setFloat32(25, Number.NaN, true);
    expect(() => decodeSnapshotBinary(encoded)).toThrow(/ship.x/);
    const wrongBounds = new Uint8Array(encodeSnapshotBinary(makeTinySnapshot()));
    new DataView(wrongBounds.buffer).setUint16(10, 100, true);
    expect(() => decodeSnapshotBinary(wrongBounds)).toThrow(/width/);
  });

  it('encodes an empty entity list as a valid header-only snapshot', () => {
    const snapshot: SnapshotMessage = {
      type: 'snapshot', version: 3, tick: stepNumber(0), ackSeq: inputSeq(0), serverTimeMs: 0,
      width: 640, height: 480, players: [], enemies: [], bullets: [], asteroids: [], pickups: [],
    };
    const encoded = encodeSnapshotBinary(snapshot);
    expect(encoded.byteLength).toBe(23);
    expect(decodeSnapshotBinary(encoded)).toMatchObject({ players: [], enemies: [], bullets: [], asteroids: [], pickups: [] });
  });
});
