/** Binary wire protocol v3. All multi-byte values are little-endian. */
export const PROTOCOL_VERSION = 3;
export const FRAME_INPUT = 1;
export const FRAME_SNAPSHOT = 2;

const HEADER_BYTES = 23;
const SHIP_BYTES = 30;
const BULLET_BYTES = 27;
const ASTEROID_BYTES = 30;
const PICKUP_BYTES = 15;

function asDataView(source) {
  if (source instanceof DataView) return source;
  if (source instanceof ArrayBuffer) return new DataView(source);
  if (ArrayBuffer.isView(source)) return new DataView(source.buffer, source.byteOffset, source.byteLength);
  throw new TypeError('Expected an ArrayBuffer or ArrayBuffer view');
}

function normalizedAngleToInt16(angle) {
  let normalized = Number(angle);
  if (!Number.isFinite(normalized)) normalized = 0;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return Math.max(-32767, Math.min(32767, Math.round((normalized / Math.PI) * 32767)));
}

function int16ToAngle(value) {
  return (value / 32767) * Math.PI;
}

function safeByte(value, fallback = 0) {
  const number = Number(value);
  return Math.max(0, Math.min(255, Math.round(Number.isFinite(number) ? number : fallback)));
}

export function encodeInputBinary(input) {
  const buffer = new ArrayBuffer(9);
  const view = new DataView(buffer);
  view.setUint8(0, PROTOCOL_VERSION);
  view.setUint8(1, FRAME_INPUT);
  view.setUint32(2, Number(input.seq) >>> 0, true);
  view.setInt8(6, Math.round(Math.max(-1, Math.min(1, Number(input.throttle) || 0)) * 127));
  view.setInt8(7, Math.round(Math.max(-1, Math.min(1, Number(input.turn) || 0)) * 127));
  view.setUint8(8, input.fire ? 1 : 0);
  return buffer;
}

export function decodeInputBinary(source) {
  const view = asDataView(source);
  if (view.byteLength !== 9) throw Object.assign(new Error('invalid binary input length'), { code: 1008 });
  if (view.getUint8(0) !== PROTOCOL_VERSION || view.getUint8(1) !== FRAME_INPUT) {
    throw Object.assign(new Error('unsupported binary input version/type'), { code: 1008 });
  }
  const flags = view.getUint8(8);
  if (flags & 0xfe) throw Object.assign(new Error('unknown input flags'), { code: 1008 });
  return {
    type: 'input',
    seq: view.getUint32(2, true),
    throttle: view.getInt8(6) / 127,
    turn: view.getInt8(7) / 127,
    fire: Boolean(flags & 1),
  };
}

function writeShip(view, offset, ship) {
  view.setUint16(offset, Number(ship.id) & 0xffff, true); offset += 2;
  view.setFloat32(offset, Number(ship.x) || 0, true); offset += 4;
  view.setFloat32(offset, Number(ship.y) || 0, true); offset += 4;
  view.setFloat32(offset, Number(ship.vx) || 0, true); offset += 4;
  view.setFloat32(offset, Number(ship.vy) || 0, true); offset += 4;
  view.setInt16(offset, normalizedAngleToInt16(ship.angle), true); offset += 2;
  view.setUint8(offset, safeByte(ship.hp, 100)); offset += 1;
  view.setUint8(offset, safeByte(ship.maxHp, 100)); offset += 1;
  view.setUint16(offset, Math.max(0, Math.min(65535, Math.round(ship.score || 0))), true); offset += 2;
  view.setFloat32(offset, Math.max(0, Number(ship.fireCooldown) || 0), true); offset += 4;
  view.setUint16(offset, Math.max(0, Math.min(65535, Math.round(ship.shotsFired || 0))), true); offset += 2;
  return offset;
}

function readShip(view, offset, defaultRadius) {
  const ship = { id: view.getUint16(offset, true) }; offset += 2;
  ship.x = view.getFloat32(offset, true); offset += 4;
  ship.y = view.getFloat32(offset, true); offset += 4;
  ship.vx = view.getFloat32(offset, true); offset += 4;
  ship.vy = view.getFloat32(offset, true); offset += 4;
  ship.angle = int16ToAngle(view.getInt16(offset, true)); offset += 2;
  ship.hp = view.getUint8(offset); offset += 1;
  ship.maxHp = view.getUint8(offset); offset += 1;
  ship.score = view.getUint16(offset, true); offset += 2;
  ship.fireCooldown = view.getFloat32(offset, true); offset += 4;
  ship.shotsFired = view.getUint16(offset, true); offset += 2;
  ship.radius = defaultRadius;
  return { ship, offset };
}

export function encodeSnapshotBinary(snapshot) {
  const players = (snapshot.players || []).slice(0, 255);
  const bullets = (snapshot.bullets || []).slice(0, 255);
  const asteroids = (snapshot.asteroids || []).slice(0, 255);
  const pickups = (snapshot.pickups || []).slice(0, 255);
  const enemies = (snapshot.enemies || []).slice(0, 255);
  const totalBytes = HEADER_BYTES
    + (players.length + enemies.length) * SHIP_BYTES
    + bullets.length * BULLET_BYTES
    + asteroids.length * ASTEROID_BYTES
    + pickups.length * PICKUP_BYTES;
  const buffer = new ArrayBuffer(totalBytes);
  const view = new DataView(buffer);
  view.setUint8(0, PROTOCOL_VERSION);
  view.setUint8(1, FRAME_SNAPSHOT);
  view.setUint32(2, Number(snapshot.tick) >>> 0, true);
  view.setUint32(6, Number(snapshot.ackSeq) >>> 0, true);
  view.setUint16(10, Number(snapshot.width) || 960, true);
  view.setUint16(12, Number(snapshot.height) || 540, true);
  view.setUint32(14, Number(snapshot.serverTimeMs) >>> 0, true);
  view.setUint8(18, players.length);
  view.setUint8(19, bullets.length);
  view.setUint8(20, asteroids.length);
  view.setUint8(21, pickups.length);
  view.setUint8(22, enemies.length);

  let offset = HEADER_BYTES;
  for (const ship of players) offset = writeShip(view, offset, ship);
  for (const bullet of bullets) {
    view.setUint16(offset, Number(bullet.id) & 0xffff, true); offset += 2;
    view.setUint16(offset, Number(bullet.ownerId) & 0xffff, true); offset += 2;
    view.setFloat32(offset, Number(bullet.x) || 0, true); offset += 4;
    view.setFloat32(offset, Number(bullet.y) || 0, true); offset += 4;
    view.setFloat32(offset, Number(bullet.vx) || 0, true); offset += 4;
    view.setFloat32(offset, Number(bullet.vy) || 0, true); offset += 4;
    view.setInt16(offset, normalizedAngleToInt16(bullet.angle), true); offset += 2;
    view.setFloat32(offset, Math.max(0, Number(bullet.ttl) || 0), true); offset += 4;
    view.setUint8(offset, bullet.homing ? 1 : 0); offset += 1;
  }
  for (const asteroid of asteroids) {
    view.setUint16(offset, Number(asteroid.id) & 0xffff, true); offset += 2;
    view.setFloat32(offset, Number(asteroid.x) || 0, true); offset += 4;
    view.setFloat32(offset, Number(asteroid.y) || 0, true); offset += 4;
    view.setFloat32(offset, Number(asteroid.vx) || 0, true); offset += 4;
    view.setFloat32(offset, Number(asteroid.vy) || 0, true); offset += 4;
    view.setInt16(offset, normalizedAngleToInt16(asteroid.angle), true); offset += 2;
    view.setFloat32(offset, Number(asteroid.angularVelocity) || 0, true); offset += 4;
    view.setFloat32(offset, Math.max(1, Number(asteroid.radius) || 20), true); offset += 4;
    view.setUint8(offset, safeByte(asteroid.hp, 40)); offset += 1;
    view.setUint8(offset, safeByte(asteroid.maxHp, 40)); offset += 1;
  }
  for (const pickup of pickups) {
    view.setUint16(offset, Number(pickup.id) & 0xffff, true); offset += 2;
    view.setFloat32(offset, Number(pickup.x) || 0, true); offset += 4;
    view.setFloat32(offset, Number(pickup.y) || 0, true); offset += 4;
    view.setFloat32(offset, Math.max(1, Number(pickup.radius) || 17), true); offset += 4;
    view.setUint8(offset, pickup.active ? 1 : 0); offset += 1;
  }
  for (const enemy of enemies) offset = writeShip(view, offset, enemy);
  return buffer;
}

export function decodeSnapshotBinary(source) {
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
  const expected = HEADER_BYTES
    + (playerCount + enemyCount) * SHIP_BYTES
    + bulletCount * BULLET_BYTES
    + asteroidCount * ASTEROID_BYTES
    + pickupCount * PICKUP_BYTES;
  if (view.byteLength !== expected) throw new Error('binary snapshot length does not match its header');

  const snapshot = {
    type: 'snapshot', version: PROTOCOL_VERSION,
    tick: view.getUint32(2, true), ackSeq: view.getUint32(6, true),
    serverTimeMs: view.getUint32(14, true),
    width: view.getUint16(10, true), height: view.getUint16(12, true),
    players: [], bullets: [], asteroids: [], pickups: [], enemies: [],
  };
  let offset = HEADER_BYTES;
  for (let index = 0; index < playerCount; index += 1) {
    const record = readShip(view, offset, 16);
    snapshot.players.push(record.ship);
    offset = record.offset;
  }
  for (let index = 0; index < bulletCount; index += 1) {
    const bullet = { id: view.getUint16(offset, true) }; offset += 2;
    bullet.ownerId = view.getUint16(offset, true); offset += 2;
    bullet.x = view.getFloat32(offset, true); offset += 4;
    bullet.y = view.getFloat32(offset, true); offset += 4;
    bullet.vx = view.getFloat32(offset, true); offset += 4;
    bullet.vy = view.getFloat32(offset, true); offset += 4;
    bullet.angle = int16ToAngle(view.getInt16(offset, true)); offset += 2;
    bullet.ttl = view.getFloat32(offset, true); offset += 4;
    bullet.homing = Boolean(view.getUint8(offset)); offset += 1;
    bullet.radius = 4;
    snapshot.bullets.push(bullet);
  }
  for (let index = 0; index < asteroidCount; index += 1) {
    const asteroid = { id: view.getUint16(offset, true) }; offset += 2;
    asteroid.x = view.getFloat32(offset, true); offset += 4;
    asteroid.y = view.getFloat32(offset, true); offset += 4;
    asteroid.vx = view.getFloat32(offset, true); offset += 4;
    asteroid.vy = view.getFloat32(offset, true); offset += 4;
    asteroid.angle = int16ToAngle(view.getInt16(offset, true)); offset += 2;
    asteroid.angularVelocity = view.getFloat32(offset, true); offset += 4;
    asteroid.radius = view.getFloat32(offset, true); offset += 4;
    asteroid.hp = view.getUint8(offset); offset += 1;
    asteroid.maxHp = view.getUint8(offset); offset += 1;
    snapshot.asteroids.push(asteroid);
  }
  for (let index = 0; index < pickupCount; index += 1) {
    const pickup = { id: view.getUint16(offset, true) }; offset += 2;
    pickup.x = view.getFloat32(offset, true); offset += 4;
    pickup.y = view.getFloat32(offset, true); offset += 4;
    pickup.radius = view.getFloat32(offset, true); offset += 4;
    pickup.active = Boolean(view.getUint8(offset)); offset += 1;
    snapshot.pickups.push(pickup);
  }
  for (let index = 0; index < enemyCount; index += 1) {
    const record = readShip(view, offset, 18);
    snapshot.enemies.push(record.ship);
    offset = record.offset;
  }
  return snapshot;
}

export function binarySnapshotSize(snapshot) {
  return HEADER_BYTES
    + (Math.min(255, snapshot.players?.length || 0) + Math.min(255, snapshot.enemies?.length || 0)) * SHIP_BYTES
    + Math.min(255, snapshot.bullets?.length || 0) * BULLET_BYTES
    + Math.min(255, snapshot.asteroids?.length || 0) * ASTEROID_BYTES
    + Math.min(255, snapshot.pickups?.length || 0) * PICKUP_BYTES;
}
