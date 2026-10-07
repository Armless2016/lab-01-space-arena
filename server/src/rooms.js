import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';

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

export class Room extends EventEmitter {
  constructor(config) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.maxPlayers = config.maxPlayers;
    this.width = config.width;
    this.height = config.height;
    this.asteroids = config.asteroids;
    this.enemies = config.enemies;
    this.enemyHp = config.enemyHp ?? 60;
    this.players = new Map();
    this.log = config.log;
    this.on('error', (error) => console.error(`[room:${this.id}]`, error));
    this.on('joined', ({ roomId, playerName, players }) => this.record({ type: 'join', roomId, playerName, players }));
    this.on('left', ({ roomId, playerName, players }) => this.record({ type: 'leave', roomId, playerName, players }));
    this.on('chat', ({ roomId, playerName, message }) => this.record({ type: 'chat', roomId, playerName, message }));
  }

  get summary() {
    return makeRoomSummary(this);
  }

  join(client, playerName) {
    if (this.players.size >= this.maxPlayers) return false;
    if (this.players.has(client)) return true;
    const safeName = String(playerName || 'Pilot').trim().slice(0, 18) || 'Pilot';
    this.players.set(client, { name: safeName, joinedAt: Date.now() });
    this.emit('joined', { roomId: this.id, playerName: safeName, players: this.players.size });
    return true;
  }

  leave(client) {
    const player = this.players.get(client);
    if (!player) return;
    this.players.delete(client);
    this.emit('left', { roomId: this.id, playerName: player.name, players: this.players.size });
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
    this.log.append({ timestamp: new Date().toISOString(), ...event });
  }

  async close() {
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
      this.#rooms.set(config.id, new Room({ ...config, log }));
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
      maxPlayers: Number(config.maxPlayers || 8),
      width: Number(config.width || 960),
      height: Number(config.height || 540),
      asteroids: Number(config.asteroids || 8),
      enemies: Number(config.enemies || 2),
      enemyHp: Number(config.enemyHp || 60),
    };
    if (!Object.values(values).slice(2).every(Number.isFinite)) throw new Error('Room numeric configuration is invalid');
    const log = await this.#loggerFactory(id);
    const room = new Room({ ...values, log });
    this.#rooms.set(id, room);
    this.emit('created', room.summary);
    return room.summary;
  }

  async removeIfEmpty(room) {
    if (room.players.size !== 0 || !this.#rooms.has(room.id)) return;
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
