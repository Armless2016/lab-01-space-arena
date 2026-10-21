import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { randomBytes } from 'node:crypto';
import {
  SIM_DT,
  SIM_HZ,
  addPlayer,
  createSimulation,
  removePlayer,
  stepSimulation,
} from '@space-arena/shared/simulation.js';

const STEP_MS = 1000 / SIM_HZ;

function makeRoomSummary(room) {
  return {
    id: room.id,
    name: room.name,
    players: room.players.size,
    maxPlayers: room.maxPlayers,
    width: room.width,
    height: room.height,
    asteroids: room.asteroids,
    enemies: room.enemies,
  };
}

// JSON mode intentionally sends the same public simulation fields as binary mode.
// Internal timers (respawnTick/collisionCooldown) remain server-owned.
function shipWireState(ship) {
  return {
    id: ship.id,
    x: ship.x,
    y: ship.y,
    vx: ship.vx,
    vy: ship.vy,
    angle: ship.angle,
    radius: ship.radius,
    hp: ship.hp,
    maxHp: ship.maxHp,
    score: ship.score,
    fireCooldown: ship.fireCooldown,
    shotsFired: ship.shotsFired,
  };
}

function bulletWireState(bullet) {
  return {
    id: bullet.id,
    ownerId: bullet.ownerId,
    x: bullet.x,
    y: bullet.y,
    vx: bullet.vx,
    vy: bullet.vy,
    angle: bullet.angle,
    ttl: bullet.ttl,
    radius: bullet.radius || 4,
    homing: Boolean(bullet.homing),
  };
}

function asteroidWireState(asteroid) {
  return {
    id: asteroid.id,
    x: asteroid.x,
    y: asteroid.y,
    vx: asteroid.vx,
    vy: asteroid.vy,
    angle: asteroid.angle,
    angularVelocity: asteroid.angularVelocity,
    radius: asteroid.radius,
    hp: asteroid.hp,
    maxHp: asteroid.maxHp,
  };
}

function pickupWireState(pickup) {
  return {
    id: pickup.id,
    x: pickup.x,
    y: pickup.y,
    radius: pickup.radius,
    active: Boolean(pickup.active),
  };
}

export class Room extends EventEmitter {
  #tickTimer = null;
  #nextTickAt = 0;
  #tickCallback = null;
  #running = false;
  #nextPlayerId = 1;

  constructor(config) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.maxPlayers = config.maxPlayers;
    this.width = config.width;
    this.height = config.height;
    this.asteroids = config.asteroids;
    this.enemies = Math.max(0, Number(config.enemies ?? 2));
    this.enemyHp = Math.max(20, Math.min(255, Number(config.enemyHp ?? 60)));
    this.log = config.log;
    this.persistent = Boolean(config.persistent);
    this.players = new Map();
    this.simulation = createSimulation({
      width: this.width,
      height: this.height,
      seed: config.seed ?? (randomBytes(4).readUInt32LE(0) || 1),
      asteroidCount: this.asteroids,
      enemyCount: this.enemies,
      enemyHp: this.enemyHp,
    });

    this.on('error', (error) => console.error(`[room:${this.id}]`, error));
    this.on('joined', ({ roomId, playerName, players }) => this.record({ type: 'join', roomId, playerName, players }));
    this.on('left', ({ roomId, playerName, players }) => this.record({ type: 'leave', roomId, playerName, players }));
    this.on('chat', ({ roomId, playerName, message }) => this.record({ type: 'chat', roomId, playerName, message }));
    this.on('input', ({ roomId, playerId, seq }) => this.record({ type: 'input', roomId, playerId, seq }));
  }

  get summary() {
    return makeRoomSummary(this);
  }

  get seed() {
    return this.simulation.seed;
  }

  get playerList() {
    return [...this.players.values()].map((player) => ({ playerId: player.playerId, name: player.name }));
  }

  join(client, playerName, protocol = 'binary') {
    if (this.players.size >= this.maxPlayers) return null;
    if (this.players.has(client)) return this.players.get(client);
    const safeName = String(playerName || 'Pilot').trim().slice(0, 18) || 'Pilot';
    const playerId = this.#nextPlayerId;
    this.#nextPlayerId = this.#nextPlayerId >= 65535 ? 1 : this.#nextPlayerId + 1;
    const player = {
      name: safeName,
      playerId,
      protocol: protocol === 'json' ? 'json' : 'binary',
      joinedAt: performance.now(),
      currentInput: { seq: 0, throttle: 0, turn: 0, fire: false },
      lastReceivedSeq: 0,
      appliedSeq: 0,
    };
    this.players.set(client, player);
    addPlayer(this.simulation, playerId);
    this.emit('joined', { roomId: this.id, playerName: safeName, players: this.players.size });
    return player;
  }

  leave(client) {
    const player = this.players.get(client);
    if (!player) return null;
    this.players.delete(client);
    removePlayer(this.simulation, player.playerId);
    this.emit('left', { roomId: this.id, playerName: player.name, players: this.players.size });
    if (this.players.size === 0) this.stopSimulation();
    return player;
  }

  acceptInput(client, input) {
    const player = this.players.get(client);
    if (!player || !input || !Number.isInteger(input.seq) || input.seq < 0 || input.seq > 0xffffffff) return false;
    if (input.seq <= player.lastReceivedSeq) return false;
    if (!Number.isFinite(input.throttle) || input.throttle < -1 || input.throttle > 1) return false;
    if (!Number.isFinite(input.turn) || input.turn < -1 || input.turn > 1) return false;
    if (typeof input.fire !== 'boolean') return false;
    player.lastReceivedSeq = input.seq;
    player.currentInput = {
      seq: input.seq >>> 0,
      throttle: input.throttle,
      turn: input.turn,
      fire: input.fire,
    };
    return true;
  }

  snapshotFor(player = null) {
    return {
      type: 'snapshot',
      version: this.simulation.version,
      tick: this.simulation.tick,
      serverTimeMs: Date.now() >>> 0,
      ackSeq: player?.appliedSeq ?? 0,
      width: this.simulation.width,
      height: this.simulation.height,
      players: this.simulation.ships.map(shipWireState),
      bullets: this.simulation.bullets.map(bulletWireState),
      asteroids: this.simulation.asteroids.map(asteroidWireState),
      pickups: this.simulation.pickups.map(pickupWireState),
      enemies: this.simulation.enemies.map(shipWireState),
    };
  }

  startSimulation(onTick) {
    this.#tickCallback = onTick;
    if (this.#running || this.players.size === 0) return;
    this.#running = true;
    this.#nextTickAt = performance.now() + STEP_MS;
    const runTick = () => {
      if (!this.#running) return;
      let now = performance.now();
      let steps = 0;
      while (now >= this.#nextTickAt && steps < 5) {
        const inputs = new Map();
        for (const player of this.players.values()) {
          player.appliedSeq = player.currentInput.seq;
          inputs.set(player.playerId, player.currentInput);
        }
        stepSimulation(this.simulation, inputs, SIM_DT);
        this.#nextTickAt += STEP_MS;
        steps += 1;
        now = performance.now();
      }
      if (steps > 0) this.#tickCallback?.(this);
      // Do not run an unbounded catch-up spiral after a long CPU pause.
      if (now - this.#nextTickAt > STEP_MS * 5) this.#nextTickAt = now + STEP_MS;
      this.#tickTimer = setTimeout(runTick, Math.max(0, this.#nextTickAt - performance.now()));
      this.#tickTimer.unref?.();
    };
    this.#tickTimer = setTimeout(runTick, Math.max(0, this.#nextTickAt - performance.now()));
    this.#tickTimer.unref?.();
  }

  stopSimulation() {
    this.#running = false;
    if (this.#tickTimer) clearTimeout(this.#tickTimer);
    this.#tickTimer = null;
    this.#tickCallback = null;
  }

  chat(client, message) {
    const player = this.players.get(client);
    if (!player) return false;
    const text = String(message || '').trim().slice(0, 500);
    if (!text) return false;
    this.emit('chat', { roomId: this.id, playerName: player.name, message: text });
    return true;
  }

  broadcast(payload, send) {
    for (const client of this.players.keys()) send(client, payload);
  }

  record(event) {
    this.log.append({ timestamp: new Date().toISOString(), tick: this.simulation.tick, ...event });
  }

  async close() {
    this.stopSimulation();
    this.emit('closed', { roomId: this.id });
    await this.log.close();
    this.removeAllListeners();
  }
}

export class RoomManager extends EventEmitter {
  #rooms = new Map();
  #loggerFactory;

  constructor(loggerFactory) {
    super();
    this.#loggerFactory = loggerFactory;
    this.on('error', (error) => console.error('[rooms]', error));
  }

  async loadSeed() {
    const file = new URL('../data/rooms.json', import.meta.url);
    const seed = JSON.parse(await readFile(file, 'utf8'));
    for (const config of seed) {
      const log = await this.#loggerFactory(config.id);
      this.#rooms.set(config.id, new Room({ ...config, log, persistent: true }));
    }
  }

  list() {
    return [...this.#rooms.values()].map((room) => room.summary);
  }

  get(id) {
    return this.#rooms.get(id);
  }

  async create(config) {
    const id = String(config.id || `room-${Date.now()}`).trim();
    if (!/^[-_a-zA-Z0-9]+$/.test(id) || this.#rooms.has(id)) throw new Error('Invalid or duplicate room id');
    const values = {
      id,
      name: String(config.name || id).slice(0, 40),
      maxPlayers: Number(config.maxPlayers ?? 8),
      width: Number(config.width ?? 960),
      height: Number(config.height ?? 540),
      asteroids: Number(config.asteroids ?? 8),
      enemies: Number(config.enemies ?? 2),
      enemyHp: Number(config.enemyHp ?? 60),
    };
    if (!Number.isInteger(values.maxPlayers) || values.maxPlayers < 1 || values.maxPlayers > 32
      || !Number.isInteger(values.width) || values.width < 320 || values.width > 65535
      || !Number.isInteger(values.height) || values.height < 240 || values.height > 65535
      || !Number.isInteger(values.asteroids) || values.asteroids < 0 || values.asteroids > 100
      || !Number.isInteger(values.enemies) || values.enemies < 0 || values.enemies > 16
      || !Number.isInteger(values.enemyHp) || values.enemyHp < 20 || values.enemyHp > 255) {
      throw new Error('Room numeric configuration is out of range');
    }
    const log = await this.#loggerFactory(id);
    const room = new Room({ ...values, log });
    this.#rooms.set(id, room);
    this.emit('created', room.summary);
    return room.summary;
  }

  async removeIfEmpty(room) {
    if (room.players.size !== 0 || !this.#rooms.has(room.id)) return;
    room.stopSimulation();
    if (room.persistent) return;
    this.#rooms.delete(room.id);
    await room.close();
    this.emit('removed', room.id);
  }

  async closeAll() {
    const rooms = [...this.#rooms.values()];
    this.#rooms.clear();
    await Promise.all(rooms.map((room) => room.close()));
  }
}
