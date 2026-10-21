import { entityId, inputSeq, stepNumber, type InputMessage, type SnapshotMessage, type SnapshotShip, type SnapshotEnemy } from './types.ts';
import type { AsteroidState, BulletState, PickupState } from './types.ts';

/** Binary wire protocol v3. Every multi-byte scalar is little-endian. */
export const PROTOCOL_VERSION = 3;
export const FRAME_INPUT = 1;
export const FRAME_SNAPSHOT = 2;
const HEADER_BYTES = 23;
const SHIP_BYTES = 30;
const BULLET_BYTES = 27;
const ASTEROID_BYTES = 30;
const PICKUP_BYTES = 15;

function asDataView(source: ArrayBuffer | ArrayBufferView): DataView {
  if (source instanceof DataView) return source;
  if (source instanceof ArrayBuffer) return new DataView(source);
  if (ArrayBuffer.isView(source)) return new DataView(source.buffer, source.byteOffset, source.byteLength);
  throw new TypeError('Expected an ArrayBuffer or ArrayBuffer view');
}

function normalizedAngleToInt16(angle: number): number {
  let normalized = Number.isFinite(angle) ? angle : 0;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return Math.round((normalized / Math.PI) * 32767);
}

function int16ToAngle(value: number): number {
  return (value / 32767) * Math.PI;
}

function safeByte(value: number, fallback: number): number {
  return Math.max(0, Math.min(255, Math.round(Number.isFinite(value) ? value : fallback)));
}

function safeUint16(value: number): number {
  return Math.max(0, Math.min(65535, Math.round(Number.isFinite(value) ? value : 0)));
}

export function encodeInputBinary(input: InputMessage): ArrayBuffer {
  const buffer = new ArrayBuffer(9);
  const view = new DataView(buffer);
  view.setUint8(0, PROTOCOL_VERSION);
  view.setUint8(1, FRAME_INPUT);
  view.setUint32(2, input.seq, true);
  view.setInt8(6, Math.round(Math.max(-1, Math.min(1, input.throttle)) * 127));
  view.setInt8(7, Math.round(Math.max(-1, Math.min(1, input.turn)) * 127));
  view.setUint8(8, input.fire ? 1 : 0);
  return buffer;
}

export function decodeInputBinary(source: ArrayBuffer | ArrayBufferView): InputMessage {
  const view = asDataView(source);
  if (view.byteLength !== 9) throw Object.assign(new Error('invalid binary input length'), { code: 1008 });
  if (view.getUint8(0) !== PROTOCOL_VERSION || view.getUint8(1) !== FRAME_INPUT) {
    throw Object.assign(new Error('unsupported binary input version/type'), { code: 1008 });
  }
  const flags = view.getUint8(8);
  if (view.getUint32(2, true) === 0) throw Object.assign(new Error('input sequence must be positive'), { code: 1008 });
  if (flags & 0xfe) throw Object.assign(new Error('unknown input flags'), { code: 1008 });
  const throttle = view.getInt8(6) / 127;
  const turn = view.getInt8(7) / 127;
  if (Math.abs(throttle) > 1 || Math.abs(turn) > 1) {
    throw Object.assign(new Error('input controls out of range'), { code: 1008 });
  }
  return {
    type: 'input',
    seq: inputSeq(view.getUint32(2, true)),
    throttle,
    turn,
    fire: Boolean(flags & 1),
  };
}

function writeShip(view: DataView, offset: number, ship: SnapshotShip | SnapshotEnemy): number {
  view.setUint16(offset, ship.id, true); offset += 2;
  view.setFloat32(offset, ship.x, true); offset += 4;
  view.setFloat32(offset, ship.y, true); offset += 4;
  view.setFloat32(offset, ship.vx, true); offset += 4;
  view.setFloat32(offset, ship.vy, true); offset += 4;
  view.setInt16(offset, normalizedAngleToInt16(ship.angle), true); offset += 2;
  view.setUint8(offset, safeByte(ship.hp, 100)); offset += 1;
  view.setUint8(offset, safeByte(ship.maxHp, 100)); offset += 1;
  view.setUint16(offset, safeUint16(ship.score), true); offset += 2;
  view.setFloat32(offset, Math.max(0, ship.fireCooldown), true); offset += 4;
  view.setUint16(offset, safeUint16(ship.shotsFired), true); offset += 2;
  return offset;
}

function readShip(view: DataView, offset: number, defaultRadius: number, kind: 'ship'): { ship: SnapshotShip; offset: number };
function readShip(view: DataView, offset: number, defaultRadius: number, kind: 'enemy'): { ship: SnapshotEnemy; offset: number };
function readShip(view: DataView, offset: number, defaultRadius: number, kind: 'ship' | 'enemy'): { ship: SnapshotShip | SnapshotEnemy; offset: number } {
  const id = entityId(view.getUint16(offset, true)); offset += 2;
  const x = view.getFloat32(offset, true); offset += 4;
  const y = view.getFloat32(offset, true); offset += 4;
  const vx = view.getFloat32(offset, true); offset += 4;
  const vy = view.getFloat32(offset, true); offset += 4;
  const angle = int16ToAngle(view.getInt16(offset, true)); offset += 2;
  const hp = view.getUint8(offset); offset += 1;
  const maxHp = view.getUint8(offset); offset += 1;
  const score = view.getUint16(offset, true); offset += 2;
  const fireCooldown = view.getFloat32(offset, true); offset += 4;
  const shotsFired = view.getUint16(offset, true); offset += 2;
  const fields = { id, x, y, vx, vy, angle, radius: defaultRadius, hp, maxHp, score, fireCooldown, shotsFired };
  if (kind === 'ship') return { ship: { ...fields, kind: 'ship' }, offset };
  return { ship: { ...fields, kind: 'enemy' }, offset };
}

function assertRange(value: number, minimum: number, maximum: number, field: string): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`invalid binary snapshot ${field}`);
  }
}

function validateSnapshotRanges(snapshot: SnapshotMessage): void {
  assertRange(snapshot.width, 320, 65_535, 'width');
  assertRange(snapshot.height, 240, 65_535, 'height');
  const validateShip = (ship: SnapshotShip | SnapshotEnemy): void => {
    assertRange(ship.x, 0, snapshot.width, 'ship.x');
    assertRange(ship.y, 0, snapshot.height, 'ship.y');
    assertRange(ship.vx, -10_000, 10_000, 'ship.vx');
    assertRange(ship.vy, -10_000, 10_000, 'ship.vy');
    assertRange(ship.hp, 0, ship.maxHp, 'ship.hp');
    assertRange(ship.maxHp, 1, 255, 'ship.maxHp');
    assertRange(ship.radius, 1, 256, 'ship.radius');
    assertRange(ship.fireCooldown, 0, 60, 'ship.fireCooldown');
  };
  for (const ship of snapshot.players) validateShip(ship);
  for (const enemy of snapshot.enemies) validateShip(enemy);
  for (const bullet of snapshot.bullets) {
    assertRange(bullet.x, 0, snapshot.width, 'bullet.x');
    assertRange(bullet.y, 0, snapshot.height, 'bullet.y');
    assertRange(bullet.vx, -10_000, 10_000, 'bullet.vx');
    assertRange(bullet.vy, -10_000, 10_000, 'bullet.vy');
    assertRange(bullet.ttl, 0, 120, 'bullet.ttl');
    assertRange(bullet.radius, 1, 128, 'bullet.radius');
  }
  for (const asteroid of snapshot.asteroids) {
    assertRange(asteroid.x, 0, snapshot.width, 'asteroid.x');
    assertRange(asteroid.y, 0, snapshot.height, 'asteroid.y');
    assertRange(asteroid.vx, -10_000, 10_000, 'asteroid.vx');
    assertRange(asteroid.vy, -10_000, 10_000, 'asteroid.vy');
    assertRange(asteroid.angularVelocity, -100, 100, 'asteroid.angularVelocity');
    assertRange(asteroid.radius, 1, 512, 'asteroid.radius');
    assertRange(asteroid.hp, 0, asteroid.maxHp, 'asteroid.hp');
    assertRange(asteroid.maxHp, 1, 255, 'asteroid.maxHp');
  }
  for (const pickup of snapshot.pickups) {
    assertRange(pickup.x, 0, snapshot.width, 'pickup.x');
    assertRange(pickup.y, 0, snapshot.height, 'pickup.y');
    assertRange(pickup.radius, 1, 256, 'pickup.radius');
  }
}

export function encodeSnapshotBinary(snapshot: SnapshotMessage): ArrayBuffer {
  const players = snapshot.players.slice(0, 255);
  const bullets = snapshot.bullets.slice(0, 255);
  const asteroids = snapshot.asteroids.slice(0, 255);
  const pickups = snapshot.pickups.slice(0, 255);
  const enemies = snapshot.enemies.slice(0, 255);
  const totalBytes = HEADER_BYTES
    + (players.length + enemies.length) * SHIP_BYTES
    + bullets.length * BULLET_BYTES
    + asteroids.length * ASTEROID_BYTES
    + pickups.length * PICKUP_BYTES;
  const buffer = new ArrayBuffer(totalBytes);
  const view = new DataView(buffer);
  view.setUint8(0, PROTOCOL_VERSION);
  view.setUint8(1, FRAME_SNAPSHOT);
  view.setUint32(2, snapshot.tick, true);
  view.setUint32(6, snapshot.ackSeq, true);
  view.setUint16(10, snapshot.width, true);
  view.setUint16(12, snapshot.height, true);
  view.setUint32(14, snapshot.serverTimeMs >>> 0, true);
  view.setUint8(18, players.length);
  view.setUint8(19, bullets.length);
  view.setUint8(20, asteroids.length);
  view.setUint8(21, pickups.length);
  view.setUint8(22, enemies.length);

  let offset = HEADER_BYTES;
  for (const ship of players) offset = writeShip(view, offset, ship);
  for (const bullet of bullets) {
    view.setUint16(offset, bullet.id, true); offset += 2;
    view.setUint16(offset, bullet.ownerId, true); offset += 2;
    view.setFloat32(offset, bullet.x, true); offset += 4;
    view.setFloat32(offset, bullet.y, true); offset += 4;
    view.setFloat32(offset, bullet.vx, true); offset += 4;
    view.setFloat32(offset, bullet.vy, true); offset += 4;
    view.setInt16(offset, normalizedAngleToInt16(bullet.angle), true); offset += 2;
    view.setFloat32(offset, Math.max(0, bullet.ttl), true); offset += 4;
    view.setUint8(offset, bullet.homing ? 1 : 0); offset += 1;
  }
  for (const asteroid of asteroids) {
    view.setUint16(offset, asteroid.id, true); offset += 2;
    view.setFloat32(offset, asteroid.x, true); offset += 4;
    view.setFloat32(offset, asteroid.y, true); offset += 4;
    view.setFloat32(offset, asteroid.vx, true); offset += 4;
    view.setFloat32(offset, asteroid.vy, true); offset += 4;
    view.setInt16(offset, normalizedAngleToInt16(asteroid.angle), true); offset += 2;
    view.setFloat32(offset, asteroid.angularVelocity, true); offset += 4;
    view.setFloat32(offset, Math.max(1, asteroid.radius), true); offset += 4;
    view.setUint8(offset, safeByte(asteroid.hp, 40)); offset += 1;
    view.setUint8(offset, safeByte(asteroid.maxHp, 40)); offset += 1;
  }
  for (const pickup of pickups) {
    view.setUint16(offset, pickup.id, true); offset += 2;
    view.setFloat32(offset, pickup.x, true); offset += 4;
    view.setFloat32(offset, pickup.y, true); offset += 4;
    view.setFloat32(offset, Math.max(1, pickup.radius), true); offset += 4;
    view.setUint8(offset, pickup.active ? 1 : 0); offset += 1;
  }
  for (const enemy of enemies) offset = writeShip(view, offset, enemy);
  return buffer;
}

export function decodeSnapshotBinary(source: ArrayBuffer | ArrayBufferView): SnapshotMessage {
  const view = asDataView(source);
  if (view.byteLength < HEADER_BYTES) throw new Error('binary snapshot is too short');
  if (view.getUint8(0) !== PROTOCOL_VERSION || view.getUint8(1) !== FRAME_SNAPSHOT) {
    throw new Error('unsupported binary snapshot version/type');
  }
  const playerCount = view.getUint8(18);
  const bulletCount = view.getUint8(19);
  const asteroidCount = view.getUint8(20);
  const pickupCount = view.getUint8(21);
  const enemyCount = view.getUint8(22);
  const expected = HEADER_BYTES + (playerCount + enemyCount) * SHIP_BYTES
    + bulletCount * BULLET_BYTES + asteroidCount * ASTEROID_BYTES + pickupCount * PICKUP_BYTES;
  if (view.byteLength !== expected) throw new Error('binary snapshot length does not match its header');

  const snapshot: SnapshotMessage = {
    type: 'snapshot', version: PROTOCOL_VERSION,
    tick: stepNumber(view.getUint32(2, true)), ackSeq: inputSeq(view.getUint32(6, true)),
    serverTimeMs: view.getUint32(14, true), width: view.getUint16(10, true), height: view.getUint16(12, true),
    players: [], bullets: [], asteroids: [], pickups: [], enemies: [],
  };
  let offset = HEADER_BYTES;
  for (let index = 0; index < playerCount; index += 1) {
    const record = readShip(view, offset, 16, 'ship');
    snapshot.players.push(record.ship);
    offset = record.offset;
  }
  for (let index = 0; index < bulletCount; index += 1) {
    const id = entityId(view.getUint16(offset, true)); offset += 2;
    const ownerId = entityId(view.getUint16(offset, true)); offset += 2;
    const x = view.getFloat32(offset, true); offset += 4;
    const y = view.getFloat32(offset, true); offset += 4;
    const vx = view.getFloat32(offset, true); offset += 4;
    const vy = view.getFloat32(offset, true); offset += 4;
    const angle = int16ToAngle(view.getInt16(offset, true)); offset += 2;
    const ttl = view.getFloat32(offset, true); offset += 4;
    const homingFlag = view.getUint8(offset); offset += 1;
    if (homingFlag > 1) throw new Error('invalid bullet flags');
    const bullet: BulletState & { kind: 'bullet' } = { kind: 'bullet', id, ownerId, x, y, vx, vy, angle, ttl, homing: homingFlag === 1, radius: 4 };
    snapshot.bullets.push(bullet);
  }
  for (let index = 0; index < asteroidCount; index += 1) {
    const id = entityId(view.getUint16(offset, true)); offset += 2;
    const x = view.getFloat32(offset, true); offset += 4;
    const y = view.getFloat32(offset, true); offset += 4;
    const vx = view.getFloat32(offset, true); offset += 4;
    const vy = view.getFloat32(offset, true); offset += 4;
    const angle = int16ToAngle(view.getInt16(offset, true)); offset += 2;
    const angularVelocity = view.getFloat32(offset, true); offset += 4;
    const radius = view.getFloat32(offset, true); offset += 4;
    const hp = view.getUint8(offset); offset += 1;
    const maxHp = view.getUint8(offset); offset += 1;
    const asteroid: AsteroidState & { kind: 'asteroid' } = { kind: 'asteroid', id, x, y, vx, vy, angle, angularVelocity, radius, hp, maxHp };
    snapshot.asteroids.push(asteroid);
  }
  for (let index = 0; index < pickupCount; index += 1) {
    const id = entityId(view.getUint16(offset, true)); offset += 2;
    const x = view.getFloat32(offset, true); offset += 4;
    const y = view.getFloat32(offset, true); offset += 4;
    const radius = view.getFloat32(offset, true); offset += 4;
    const activeFlag = view.getUint8(offset); offset += 1;
    if (activeFlag > 1) throw new Error('invalid pickup flags');
    const pickup: PickupState & { kind: 'pickup' } = { kind: 'pickup', id, x, y, radius, active: activeFlag === 1, respawnTick: 0 };
    snapshot.pickups.push(pickup);
  }
  for (let index = 0; index < enemyCount; index += 1) {
    const record = readShip(view, offset, 18, 'enemy');
    snapshot.enemies.push(record.ship);
    offset = record.offset;
  }
  validateSnapshotRanges(snapshot);
  return snapshot;
}

export function binarySnapshotSize(snapshot: SnapshotMessage): number {
  return HEADER_BYTES
    + (Math.min(255, snapshot.players.length) + Math.min(255, snapshot.enemies.length)) * SHIP_BYTES
    + Math.min(255, snapshot.bullets.length) * BULLET_BYTES
    + Math.min(255, snapshot.asteroids.length) * ASTEROID_BYTES
    + Math.min(255, snapshot.pickups.length) * PICKUP_BYTES;
}
