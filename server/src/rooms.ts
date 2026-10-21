import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { randomBytes } from 'node:crypto';
import type { WebSocket } from 'ws';
import { z } from 'zod';
import {
  SIM_DT,
  SIM_HZ,
  addPlayer,
  createSimulation,
  removePlayer,
  stepSimulation,
  inputSeq,
  entityId,
  type ControlInput,
  type InputSeq,
  type EntityId,
  type SimulationState,
  type SnapshotMessage,
  type SnapshotShip,
  type SnapshotEnemy,
  type SnapshotBullet,
  type SnapshotAsteroid,
  type SnapshotPickup,
} from '@space-arena/shared';

const STEP_MS = 1000 / SIM_HZ;
const roomConfigSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[-_a-zA-Z0-9]+$/),
  name: z.string().trim().min(1).max(40),
  maxPlayers: z.number().int().min(1).max(32).default(8),
  width: z.number().int().min(320).max(65535).default(960),
  height: z.number().int().min(240).max(65535).default(540),
  asteroids: z.number().int().min(0).max(100).default(8),
  enemies: z.number().int().min(0).max(16).default(2),
  enemyHp: z.number().int().min(20).max(255).default(60),
  seed: z.number().int().min(0).max(0xffff_ffff).optional(),
});
const roomCreateInputSchema = z.object({
  id: z.string().trim().min(1).max(64).regex(/^[-_a-zA-Z0-9]+$/).optional(),
  name: z.string().trim().min(1).max(40).optional(),
  maxPlayers: z.coerce.number().int().min(1).max(32).optional(),
  width: z.coerce.number().int().min(320).max(65535).optional(),
  height: z.coerce.number().int().min(240).max(65535).optional(),
  asteroids: z.coerce.number().int().min(0).max(100).optional(),
  enemies: z.coerce.number().int().min(0).max(16).optional(),
  enemyHp: z.coerce.number().int().min(20).max(255).optional(),
  seed: z.coerce.number().int().min(0).max(0xffff_ffff).optional(),
}).strict();

type RoomSpec = z.infer<typeof roomConfigSchema>;
export interface RoomSummary {
  readonly id: string;
  readonly name: string;
  readonly players: number;
  readonly maxPlayers: number;
  readonly width: number;
  readonly height: number;
  readonly asteroids: number;
  readonly enemies: number;
}
export interface MatchLog {
  append(event: Record<string, unknown>): boolean;
  close(): Promise<void>;
  replayStream?(): NodeJS.ReadableStream;
}
interface PlayerInput extends ControlInput {
  seq: InputSeq;
  throttle: number;
  turn: number;
  fire: boolean;
}
export interface RoomPlayer {
  readonly name: string;
  readonly playerId: EntityId;
  readonly protocol: 'json' | 'binary';
  readonly joinedAt: number;
  currentInput: PlayerInput;
  lastReceivedSeq: InputSeq;
  appliedSeq: InputSeq;
}
interface RoomEvents {
  error: [error: unknown];
  joined: [event: { roomId: string; playerName: string; players: number }];
  left: [event: { roomId: string; playerName: string; players: number }];
  chat: [event: { roomId: string; playerName: string; message: string }];
  input: [event: { roomId: string; playerId: EntityId; seq: InputSeq }];
  closed: [event: { roomId: string }];
}
interface RoomManagerEvents {
  error: [error: unknown];
  created: [summary: RoomSummary];
  removed: [roomId: string];
}
type RoomTickCallback = (room: Room) => void;
type LoggerFactory = (roomId: string) => Promise<MatchLog>;

function makeRoomSummary(room: Room): RoomSummary {
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

function shipWireState(ship: SimulationState['ships'][number]): SnapshotShip {
  return {
    kind: 'ship',
    id: ship.id, x: ship.x, y: ship.y, vx: ship.vx, vy: ship.vy,
    angle: ship.angle, radius: ship.radius, hp: ship.hp, maxHp: ship.maxHp,
    score: ship.score, fireCooldown: ship.fireCooldown, shotsFired: ship.shotsFired,
  };
}

function enemyWireState(ship: SimulationState['enemies'][number]): SnapshotEnemy {
  return {
    kind: 'enemy',
    id: ship.id, x: ship.x, y: ship.y, vx: ship.vx, vy: ship.vy,
    angle: ship.angle, radius: ship.radius, hp: ship.hp, maxHp: ship.maxHp,
    score: ship.score, fireCooldown: ship.fireCooldown, shotsFired: ship.shotsFired,
  };
}

function bulletWireState(bullet: SimulationState['bullets'][number]): SnapshotBullet {
  return {
    kind: 'bullet',
    id: bullet.id, ownerId: bullet.ownerId, x: bullet.x, y: bullet.y,
    vx: bullet.vx, vy: bullet.vy, angle: bullet.angle, ttl: bullet.ttl,
    radius: bullet.radius || 4, homing: bullet.homing,
  };
}

function asteroidWireState(asteroid: SimulationState['asteroids'][number]): SnapshotAsteroid {
  return {
    kind: 'asteroid',
    id: asteroid.id, x: asteroid.x, y: asteroid.y, vx: asteroid.vx, vy: asteroid.vy,
    angle: asteroid.angle, angularVelocity: asteroid.angularVelocity, radius: asteroid.radius,
    hp: asteroid.hp, maxHp: asteroid.maxHp,
  };
}

function pickupWireState(pickup: SimulationState['pickups'][number]): SnapshotPickup {
  return { kind: 'pickup', id: pickup.id, x: pickup.x, y: pickup.y, radius: pickup.radius, active: pickup.active };
}

export class Room extends EventEmitter<RoomEvents> {
  #tickTimer: NodeJS.Timeout | null = null;
  #nextTickAt = 0;
  #tickCallback: RoomTickCallback | null = null;
  #running = false;
  #nextPlayerId = 1;
  public readonly id: string;
  public readonly name: string;
  public readonly maxPlayers: number;
  public readonly width: number;
  public readonly height: number;
  public readonly asteroids: number;
  public readonly enemies: number;
  public readonly enemyHp: number;
  public readonly log: MatchLog;
  public readonly persistent: boolean;
  public readonly players = new Map<WebSocket, RoomPlayer>();
  public readonly simulation: SimulationState;

  public constructor(config: RoomSpec & { log: MatchLog; persistent?: boolean }) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.maxPlayers = config.maxPlayers;
    this.width = config.width;
    this.height = config.height;
    this.asteroids = config.asteroids;
    this.enemies = config.enemies;
    this.enemyHp = config.enemyHp;
    this.log = config.log;
    this.persistent = config.persistent ?? false;
    this.simulation = createSimulation({
      width: this.width,
      height: this.height,
      seed: config.seed ?? (randomBytes(4).readUInt32LE(0) || 1),
      asteroidCount: this.asteroids,
      enemyCount: this.enemies,
      enemyHp: this.enemyHp,
    });

    this.on('error', (error: unknown) => console.error(`[room:${this.id}]`, error));
    this.on('joined', (event) => this.record({ type: 'join', ...event }));
    this.on('left', (event) => this.record({ type: 'leave', ...event }));
    this.on('chat', (event) => this.record({ type: 'chat', ...event }));
    this.on('input', (event) => this.record({ type: 'input', ...event }));
  }

  public get summary(): RoomSummary { return makeRoomSummary(this); }
  public get seed(): number { return this.simulation.seed; }
  public get playerList(): Array<{ playerId: EntityId; name: string }> {
    return [...this.players.values()].map((player) => ({ playerId: player.playerId, name: player.name }));
  }

  public join(client: WebSocket, playerName: string, protocol: 'json' | 'binary' = 'binary'): RoomPlayer | null {
    if (this.players.size >= this.maxPlayers) return null;
    const existing = this.players.get(client);
    if (existing) return existing;
    const safeName = playerName.trim().slice(0, 18) || 'Pilot';
    const playerId = entityId(this.#nextPlayerId);
    this.#nextPlayerId = this.#nextPlayerId >= 65535 ? 1 : this.#nextPlayerId + 1;
    const initialSeq = inputSeq(0);
    const player: RoomPlayer = {
      name: safeName,
      playerId,
      protocol,
      joinedAt: performance.now(),
      currentInput: { seq: initialSeq, throttle: 0, turn: 0, fire: false },
      lastReceivedSeq: initialSeq,
      appliedSeq: initialSeq,
    };
    this.players.set(client, player);
    addPlayer(this.simulation, playerId);
    this.emit('joined', { roomId: this.id, playerName: safeName, players: this.players.size });
    return player;
  }

  public leave(client: WebSocket): RoomPlayer | null {
    const player = this.players.get(client);
    if (!player) return null;
    this.players.delete(client);
    removePlayer(this.simulation, player.playerId);
    this.emit('left', { roomId: this.id, playerName: player.name, players: this.players.size });
    if (this.players.size === 0) this.stopSimulation();
    return player;
  }

  public acceptInput(client: WebSocket, input: PlayerInput): boolean {
    const player = this.players.get(client);
    if (!player || input.seq <= player.lastReceivedSeq) return false;
    player.lastReceivedSeq = input.seq;
    player.currentInput = {
      seq: input.seq,
      throttle: input.throttle,
      turn: input.turn,
      fire: input.fire,
    };
    this.emit('input', { roomId: this.id, playerId: player.playerId, seq: input.seq });
    return true;
  }

  public snapshotFor(player: RoomPlayer | null = null): SnapshotMessage {
    return {
      type: 'snapshot',
      version: this.simulation.version,
      tick: this.simulation.tick,
      serverTimeMs: Date.now() >>> 0,
      ackSeq: player?.appliedSeq ?? inputSeq(0),
      width: this.simulation.width,
      height: this.simulation.height,
      players: this.simulation.ships.map(shipWireState),
      bullets: this.simulation.bullets.map(bulletWireState),
      asteroids: this.simulation.asteroids.map(asteroidWireState),
      pickups: this.simulation.pickups.map(pickupWireState),
      enemies: this.simulation.enemies.map(enemyWireState),
    };
  }

  public startSimulation(onTick: RoomTickCallback): void {
    this.#tickCallback = onTick;
    if (this.#running || this.players.size === 0) return;
    this.#running = true;
    this.#nextTickAt = performance.now() + STEP_MS;
    const runTick = (): void => {
      if (!this.#running) return;
      let now = performance.now();
      let steps = 0;
      while (now >= this.#nextTickAt && steps < 5) {
        const inputs = new Map<EntityId, ControlInput>();
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
      if (now - this.#nextTickAt > STEP_MS * 5) this.#nextTickAt = now + STEP_MS;
      this.#tickTimer = setTimeout(runTick, Math.max(0, this.#nextTickAt - performance.now()));
      this.#tickTimer.unref();
    };
    this.#tickTimer = setTimeout(runTick, Math.max(0, this.#nextTickAt - performance.now()));
    this.#tickTimer.unref();
  }

  public stopSimulation(): void {
    this.#running = false;
    if (this.#tickTimer) clearTimeout(this.#tickTimer);
    this.#tickTimer = null;
    this.#tickCallback = null;
  }

  public chat(client: WebSocket, message: string): boolean {
    const player = this.players.get(client);
    if (!player) return false;
    const text = message.trim().slice(0, 500);
    if (!text) return false;
    this.emit('chat', { roomId: this.id, playerName: player.name, message: text });
    return true;
  }

  public broadcast(payload: unknown, send: (client: WebSocket, payload: unknown) => void): void {
    for (const client of this.players.keys()) send(client, payload);
  }

  public record(event: Record<string, unknown>): void {
    this.log.append({ timestamp: new Date().toISOString(), tick: this.simulation.tick, ...event });
  }

  public async close(): Promise<void> {
    this.stopSimulation();
    this.emit('closed', { roomId: this.id });
    await this.log.close();
    this.removeAllListeners();
  }
}

export class RoomManager extends EventEmitter<RoomManagerEvents> {
  #rooms = new Map<string, Room>();
  #loggerFactory: LoggerFactory;

  public constructor(loggerFactory: LoggerFactory) {
    super();
    this.#loggerFactory = loggerFactory;
    this.on('error', (error: unknown) => console.error('[rooms]', error));
  }

  public async loadSeed(): Promise<void> {
    const file = new URL('../data/rooms.json', import.meta.url);
    const parsed: unknown = JSON.parse(await readFile(file, 'utf8'));
    const seedRooms = z.array(roomConfigSchema).parse(parsed);
    for (const config of seedRooms) {
      const log = await this.#loggerFactory(config.id);
      this.#rooms.set(config.id, new Room({ ...config, log, persistent: true }));
    }
  }

  public list(): RoomSummary[] { return [...this.#rooms.values()].map((room) => room.summary); }
  public get(id: string): Room | undefined { return this.#rooms.get(id); }

  public async create(input: unknown): Promise<RoomSummary> {
    const parsed = roomCreateInputSchema.parse(input);
    const id = (parsed.id ?? `room-${Date.now()}`).trim();
    if (this.#rooms.has(id)) throw new Error('Invalid or duplicate room id');
    const config = roomConfigSchema.parse({
      id,
      name: parsed.name ?? id,
      maxPlayers: parsed.maxPlayers ?? 8,
      width: parsed.width ?? 960,
      height: parsed.height ?? 540,
      asteroids: parsed.asteroids ?? 8,
      enemies: parsed.enemies ?? 2,
      enemyHp: parsed.enemyHp ?? 60,
      ...(parsed.seed === undefined ? {} : { seed: parsed.seed }),
    });
    const log = await this.#loggerFactory(id);
    const room = new Room({ ...config, log });
    this.#rooms.set(id, room);
    this.emit('created', room.summary);
    return room.summary;
  }

  public async removeIfEmpty(room: Room): Promise<void> {
    if (room.players.size !== 0 || !this.#rooms.has(room.id)) return;
    room.stopSimulation();
    if (room.persistent) return;
    this.#rooms.delete(room.id);
    await room.close();
    this.emit('removed', room.id);
  }

  public async closeAll(): Promise<void> {
    const rooms = [...this.#rooms.values()];
    this.#rooms.clear();
    await Promise.all(rooms.map((room) => room.close()));
  }
}
