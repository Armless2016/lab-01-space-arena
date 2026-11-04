import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { randomBytes } from 'node:crypto';
import { logger } from "./logger.js";
import { z } from 'zod';
import { SIM_DT, SIM_HZ, addPlayer, createSimulation, removePlayer, stepSimulation, inputSeq, entityId, } from '@space-arena/shared';
const STEP_MS = 1000 / SIM_HZ;
const roomConfigSchema = z.object({
    id: z.string().min(1).max(64).regex(/^[-_a-zA-Z0-9]+$/),
    name: z.string().trim().min(1).max(40),
    maxPlayers: z.number().int().min(1).max(128).default(8),
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
    maxPlayers: z.coerce.number().int().min(1).max(128).optional(),
    width: z.coerce.number().int().min(320).max(65535).optional(),
    height: z.coerce.number().int().min(240).max(65535).optional(),
    asteroids: z.coerce.number().int().min(0).max(100).optional(),
    enemies: z.coerce.number().int().min(0).max(16).optional(),
    enemyHp: z.coerce.number().int().min(20).max(255).optional(),
    seed: z.coerce.number().int().min(0).max(0xffff_ffff).optional(),
}).strict();
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
function shipWireState(ship) {
    return {
        kind: 'ship',
        id: ship.id, x: ship.x, y: ship.y, vx: ship.vx, vy: ship.vy,
        angle: ship.angle, radius: ship.radius, hp: ship.hp, maxHp: ship.maxHp,
        score: ship.score, fireCooldown: ship.fireCooldown, shotsFired: ship.shotsFired,
    };
}
function enemyWireState(ship) {
    return {
        kind: 'enemy',
        id: ship.id, x: ship.x, y: ship.y, vx: ship.vx, vy: ship.vy,
        angle: ship.angle, radius: ship.radius, hp: ship.hp, maxHp: ship.maxHp,
        score: ship.score, fireCooldown: ship.fireCooldown, shotsFired: ship.shotsFired,
    };
}
function bulletWireState(bullet) {
    return {
        kind: 'bullet',
        id: bullet.id, ownerId: bullet.ownerId, x: bullet.x, y: bullet.y,
        vx: bullet.vx, vy: bullet.vy, angle: bullet.angle, ttl: bullet.ttl,
        radius: bullet.radius || 4, homing: bullet.homing,
    };
}
function asteroidWireState(asteroid) {
    return {
        kind: 'asteroid',
        id: asteroid.id, x: asteroid.x, y: asteroid.y, vx: asteroid.vx, vy: asteroid.vy,
        angle: asteroid.angle, angularVelocity: asteroid.angularVelocity, radius: asteroid.radius,
        hp: asteroid.hp, maxHp: asteroid.maxHp,
    };
}
function pickupWireState(pickup) {
    return { kind: 'pickup', id: pickup.id, x: pickup.x, y: pickup.y, radius: pickup.radius, active: pickup.active };
}
export class Room extends EventEmitter {
    #tickTimer = null;
    #nextTickAt = 0;
    #tickCallback = null;
    #running = false;
    #nextPlayerId = 1;
    #stepSamples = new Float64Array(512);
    #stepSampleCount = 0;
    #stepSampleIndex = 0;
    #lastStepMs = 0;
    #overBudgetSteps = 0;
    id;
    name;
    maxPlayers;
    width;
    height;
    asteroids;
    enemies;
    enemyHp;
    log;
    persistent;
    players = new Map();
    simulation;
    constructor(config) {
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
        const roomLogger = logger.child({ roomId: this.id });
        this.on('error', (error) => roomLogger.error({ err: error }, 'room_error'));
        this.on('joined', (event) => {
            this.record({ type: 'join', ...event });
            logger.child({ roomId: this.id, playerId: event.playerId }).info({ playerName: event.playerName, players: event.players }, 'room_player_joined');
        });
        this.on('left', (event) => {
            this.record({ type: 'leave', ...event });
            logger.child({ roomId: this.id, playerId: event.playerId }).info({ playerName: event.playerName, players: event.players }, 'room_player_left');
        });
        this.on('chat', (event) => {
            this.record({ type: 'chat', roomId: event.roomId, playerId: event.playerId, playerName: event.playerName, messageLength: event.message.length });
            logger.child({ roomId: this.id, playerId: event.playerId }).info({ playerName: event.playerName, messageLength: event.message.length }, 'room_chat');
        });
        this.on('input', (event) => this.record({ type: 'input', ...event }));
    }
    get summary() { return makeRoomSummary(this); }
    get seed() { return this.simulation.seed; }
    get stepMetrics() {
        const sorted = Array.from(this.#stepSamples.slice(0, this.#stepSampleCount)).sort((a, b) => a - b);
        const at = (ratio) => sorted.length === 0 ? 0 : (sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] ?? 0);
        return { samples: sorted.length, lastMs: this.#lastStepMs, p50Ms: at(0.5), p95Ms: at(0.95), p99Ms: at(0.99), overBudgetSteps: this.#overBudgetSteps };
    }
    get playerList() {
        return [...this.players.values()].map((player) => ({ playerId: player.playerId, name: player.name }));
    }
    join(client, playerName, protocol = 'binary') {
        if (this.players.size >= this.maxPlayers)
            return null;
        const existing = this.players.get(client);
        if (existing)
            return existing;
        const safeName = playerName.trim().slice(0, 18) || 'Pilot';
        const playerId = entityId(this.#nextPlayerId);
        this.#nextPlayerId = this.#nextPlayerId >= 65535 ? 1 : this.#nextPlayerId + 1;
        const initialSeq = inputSeq(0);
        const player = {
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
        this.emit('joined', { roomId: this.id, playerId, playerName: safeName, players: this.players.size });
        return player;
    }
    leave(client) {
        const player = this.players.get(client);
        if (!player)
            return null;
        this.players.delete(client);
        removePlayer(this.simulation, player.playerId);
        this.emit('left', { roomId: this.id, playerId: player.playerId, playerName: player.name, players: this.players.size });
        if (this.players.size === 0)
            this.stopSimulation();
        return player;
    }
    acceptInput(client, input) {
        const player = this.players.get(client);
        if (!player || input.seq <= player.lastReceivedSeq)
            return false;
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
    snapshotFor(player = null) {
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
    startSimulation(onTick) {
        this.#tickCallback = onTick;
        if (this.#running || this.players.size === 0)
            return;
        this.#running = true;
        this.#nextTickAt = performance.now() + STEP_MS;
        const runTick = () => {
            if (!this.#running)
                return;
            let now = performance.now();
            let steps = 0;
            while (now >= this.#nextTickAt && steps < 5) {
                const inputs = new Map();
                for (const player of this.players.values()) {
                    player.appliedSeq = player.currentInput.seq;
                    inputs.set(player.playerId, player.currentInput);
                }
                const stepStartedAt = performance.now();
                stepSimulation(this.simulation, inputs, SIM_DT);
                this.#lastStepMs = performance.now() - stepStartedAt;
                if (this.#lastStepMs > STEP_MS)
                    this.#overBudgetSteps += 1;
                this.#stepSamples[this.#stepSampleIndex] = this.#lastStepMs;
                this.#stepSampleIndex = (this.#stepSampleIndex + 1) % this.#stepSamples.length;
                this.#stepSampleCount = Math.min(this.#stepSampleCount + 1, this.#stepSamples.length);
                this.#nextTickAt += STEP_MS;
                steps += 1;
                now = performance.now();
            }
            if (steps > 0)
                this.#tickCallback?.(this);
            if (now - this.#nextTickAt > STEP_MS * 5)
                this.#nextTickAt = now + STEP_MS;
            this.#tickTimer = setTimeout(runTick, Math.max(0, this.#nextTickAt - performance.now()));
            this.#tickTimer.unref();
        };
        this.#tickTimer = setTimeout(runTick, Math.max(0, this.#nextTickAt - performance.now()));
        this.#tickTimer.unref();
    }
    stopSimulation() {
        this.#running = false;
        if (this.#tickTimer)
            clearTimeout(this.#tickTimer);
        this.#tickTimer = null;
        this.#tickCallback = null;
    }
    chat(client, message) {
        const player = this.players.get(client);
        if (!player)
            return false;
        const text = message.trim().slice(0, 500);
        if (!text)
            return false;
        this.emit('chat', { roomId: this.id, playerId: player.playerId, playerName: player.name, message: text });
        return true;
    }
    broadcast(payload, send) {
        for (const client of this.players.keys())
            send(client, payload);
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
    #limits;
    constructor(loggerFactory, limits = { maxRooms: 100, maxPlayersPerRoom: 16 }) {
        super();
        this.#loggerFactory = loggerFactory;
        this.#limits = limits;
        this.on('error', (error) => logger.error({ err: error }, 'room_manager_error'));
        this.on('created', (summary) => logger.info({ roomId: summary.id, maxPlayers: summary.maxPlayers }, 'room_created'));
        this.on('removed', (roomId) => logger.info({ roomId }, 'room_removed'));
    }
    async loadSeed() {
        const file = new URL('../data/rooms.json', import.meta.url);
        const parsed = JSON.parse(await readFile(file, 'utf8'));
        const seedRooms = z.array(roomConfigSchema).parse(parsed);
        if (seedRooms.length > this.#limits.maxRooms)
            throw new Error('Seed room count exceeds MAX_ROOMS');
        for (const config of seedRooms) {
            if (config.maxPlayers > this.#limits.maxPlayersPerRoom)
                throw new Error(`Seed room ${config.id} exceeds MAX_PLAYERS_PER_ROOM`);
            const log = await this.#loggerFactory(config.id);
            this.#rooms.set(config.id, new Room({ ...config, log, persistent: true }));
        }
    }
    list() { return [...this.#rooms.values()].map((room) => room.summary); }
    get(id) { return this.#rooms.get(id); }
    performanceMetrics() {
        return [...this.#rooms.values()].map((room) => ({ roomId: room.id, players: room.players.size, step: room.stepMetrics }));
    }
    async create(input) {
        const parsed = roomCreateInputSchema.parse(input);
        if (this.#rooms.size >= this.#limits.maxRooms)
            throw new Error('Maximum room limit reached');
        if ((parsed.maxPlayers ?? 8) > this.#limits.maxPlayersPerRoom)
            throw new Error('Room player limit exceeds MAX_PLAYERS_PER_ROOM');
        const id = (parsed.id ?? `room-${Date.now()}`).trim();
        if (this.#rooms.has(id))
            throw new Error('Invalid or duplicate room id');
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
    async removeIfEmpty(room) {
        if (room.players.size !== 0 || !this.#rooms.has(room.id))
            return;
        room.stopSimulation();
        if (room.persistent)
            return;
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
