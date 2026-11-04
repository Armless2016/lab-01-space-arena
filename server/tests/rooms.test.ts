import { describe, expect, it, vi } from 'vitest';
import type { WebSocket } from 'ws';
import { inputSeq } from '@space-arena/shared/types';
import { RoomManager } from '../src/rooms.ts';

function fakeSocket(): WebSocket {
  return Object.create(null) as WebSocket; // Room only uses socket identity as a Map key in these unit tests.
}

function makeLogger() {
  return { append: vi.fn(() => true), close: vi.fn(async () => {}), replayStream: undefined };
}

async function makeRoomManager() {
  const log = makeLogger();
  const manager = new RoomManager(async () => log);
  await manager.create({ id: 'vitest-room', name: 'Vitest Room', maxPlayers: 2, asteroids: 0, enemies: 0, seed: 1 });
  return { manager, room: manager.get('vitest-room')!, log };
}

describe('Room and RoomManager', () => {
  it('creates and lists rooms', async () => {
    const { manager } = await makeRoomManager();
    expect(manager.list().some((room) => room.id === 'vitest-room')).toBe(true);
    await manager.closeAll();
  });
  it('joins a room and assigns a player id', async () => {
    const { manager, room } = await makeRoomManager();
    const socket = fakeSocket();
    const player = room.join(socket, '  Pilot  ', 'json');
    expect(player?.name).toBe('Pilot');
    expect(room.players.size).toBe(1);
    await manager.closeAll();
  });
  it('rejects joins after room capacity is reached', async () => {
    const { manager, room } = await makeRoomManager();
    expect(room.join(fakeSocket(), 'A')).not.toBeNull();
    expect(room.join(fakeSocket(), 'B')).not.toBeNull();
    expect(room.join(fakeSocket(), 'C')).toBeNull();
    await manager.closeAll();
  });
  it('does not duplicate the same socket in one room', async () => {
    const { manager, room } = await makeRoomManager();
    const socket = fakeSocket();
    const first = room.join(socket, 'Pilot');
    const second = room.join(socket, 'Other');
    expect(second).toBe(first);
    expect(room.players.size).toBe(1);
    await manager.closeAll();
  });
  it('accepts a fresh input sequence', async () => {
    const { manager, room } = await makeRoomManager();
    const socket = fakeSocket(); room.join(socket, 'Pilot');
    expect(room.acceptInput(socket, { seq: inputSeq(1), throttle: 1, turn: 0, fire: false })).toBe(true);
    await manager.closeAll();
  });
  it('rejects stale input sequence numbers', async () => {
    const { manager, room } = await makeRoomManager();
    const socket = fakeSocket(); room.join(socket, 'Pilot');
    room.acceptInput(socket, { seq: inputSeq(2), throttle: 1, turn: 0, fire: false });
    expect(room.acceptInput(socket, { seq: inputSeq(1), throttle: 0, turn: 0, fire: false })).toBe(false);
    await manager.closeAll();
  });
  it('emits chat only for joined players', async () => {
    const { manager, room } = await makeRoomManager();
    const socket = fakeSocket(); room.join(socket, 'Pilot');
    const chat = vi.fn(); room.on('chat', chat);
    expect(room.chat(socket, ' hello ')).toBe(true);
    expect(chat).toHaveBeenCalledWith({ roomId: 'vitest-room', playerId: 1, playerName: 'Pilot', message: 'hello' });
    await manager.closeAll();
  });
  it('rejects chat from sockets outside a room', async () => {
    const { manager, room } = await makeRoomManager();
    expect(room.chat(fakeSocket(), 'hello')).toBe(false);
    await manager.closeAll();
  });
  it('removes a player and stops room simulation when empty', async () => {
    const { manager, room } = await makeRoomManager();
    const socket = fakeSocket(); room.join(socket, 'Pilot');
    expect(room.leave(socket)?.name).toBe('Pilot');
    expect(room.players.size).toBe(0);
    await manager.closeAll();
  });
  it('removes non-persistent empty rooms', async () => {
    const { manager, room } = await makeRoomManager();
    await manager.removeIfEmpty(room);
    expect(manager.get('vitest-room')).toBeUndefined();
    await manager.closeAll();
  });
  it('reports room performance metrics', async () => {
    const { manager } = await makeRoomManager();
    const metrics = manager.performanceMetrics();
    expect(metrics[0]?.step.samples).toBe(0);
    expect(metrics[0]?.step.p99Ms).toBe(0);
    await manager.closeAll();
  });
});
