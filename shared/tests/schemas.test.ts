import { describe, expect, it } from 'vitest';
import {
  ChatMessageSchema,
  ChatServerMessageSchema,
  ClientMessageSchema,
  ErrorMessageSchema,
  InputMessageSchema,
  JoinMessageSchema,
  JoinedMessageSchema,
  LeaveMessageSchema,
  PlayersMessageSchema,
  ServerMessageSchema,
  SnapshotMessageSchema,
  SystemMessageSchema,
} from '../schemas.ts';
import { addPlayer, createSimulation, createBulletFromShip } from '../simulation.ts';
import { entityId, inputSeq, stepNumber } from '../types.ts';

function validSnapshot() {
  const simulation = createSimulation({ seed: 51, asteroidCount: 1, pickupCount: 1, enemyCount: 1 });
  const player = addPlayer(simulation, entityId(1));
  const bullet = createBulletFromShip(player, 2, player.id, true);
  return {
    type: 'snapshot' as const,
    version: 3 as const,
    tick: stepNumber(2),
    ackSeq: inputSeq(1),
    serverTimeMs: 123,
    width: simulation.width,
    height: simulation.height,
    players: simulation.ships.map((ship) => ({
      kind: 'ship' as const, id: ship.id, x: ship.x, y: ship.y, vx: ship.vx, vy: ship.vy,
      angle: ship.angle, radius: ship.radius, hp: ship.hp, maxHp: ship.maxHp, score: ship.score,
      fireCooldown: ship.fireCooldown, shotsFired: ship.shotsFired,
    })),
    enemies: simulation.enemies.map((enemy) => ({
      kind: 'enemy' as const, id: enemy.id, x: enemy.x, y: enemy.y, vx: enemy.vx, vy: enemy.vy,
      angle: enemy.angle, radius: enemy.radius, hp: enemy.hp, maxHp: enemy.maxHp, score: enemy.score,
      fireCooldown: enemy.fireCooldown, shotsFired: enemy.shotsFired,
    })),
    bullets: [{ kind: 'bullet' as const, ...bullet }],
    asteroids: simulation.asteroids.map((asteroid) => ({ kind: 'asteroid' as const, ...asteroid })),
    pickups: simulation.pickups.map((pickup) => ({
      kind: 'pickup' as const, id: pickup.id, x: pickup.x, y: pickup.y, radius: pickup.radius, active: pickup.active,
    })),
  };
}

describe('runtime Zod contracts', () => {
  it('accepts a valid join message', () => expect(JoinMessageSchema.safeParse({ type: 'join', roomId: 'rookie-orbit', playerName: 'Pilot', protocol: 'binary' }).success).toBe(true));
  it('rejects an invalid room identifier', () => expect(JoinMessageSchema.safeParse({ type: 'join', roomId: '../secret', playerName: 'Pilot' }).success).toBe(false));
  it('rejects an empty player name', () => expect(JoinMessageSchema.safeParse({ type: 'join', roomId: 'room', playerName: ' ' }).success).toBe(false));
  it('accepts leave messages', () => expect(LeaveMessageSchema.safeParse({ type: 'leave' }).success).toBe(true));
  it('rejects unexpected fields in leave messages', () => expect(LeaveMessageSchema.safeParse({ type: 'leave', room: 'x' }).success).toBe(false));
  it('accepts valid chat', () => expect(ChatMessageSchema.safeParse({ type: 'chat', message: 'hello' }).success).toBe(true));
  it('rejects empty chat', () => expect(ChatMessageSchema.safeParse({ type: 'chat', message: '  ' }).success).toBe(false));
  it('rejects oversized chat', () => expect(ChatMessageSchema.safeParse({ type: 'chat', message: 'x'.repeat(501) }).success).toBe(false));
  it('accepts valid normalized controls', () => expect(InputMessageSchema.safeParse({ type: 'input', seq: 1, throttle: 1, turn: -1, fire: false }).success).toBe(true));
  it('rejects controls outside the normalized range', () => expect(InputMessageSchema.safeParse({ type: 'input', seq: 1, throttle: 1.1, turn: 0, fire: false }).success).toBe(false));
  it('rejects zero input sequence', () => expect(InputMessageSchema.safeParse({ type: 'input', seq: 0, throttle: 0, turn: 0, fire: false }).success).toBe(false));
  it('rejects unknown client message discriminants', () => expect(ClientMessageSchema.safeParse({ type: 'teleport', x: 4, y: 5 }).success).toBe(false));
  it('rejects non-finite controls', () => expect(InputMessageSchema.safeParse({ type: 'input', seq: 1, throttle: Number.NaN, turn: 0, fire: false }).success).toBe(false));
  it('rejects additional input fields such as client coordinates', () => expect(InputMessageSchema.safeParse({ type: 'input', seq: 1, throttle: 0, turn: 0, fire: false, x: 100 }).success).toBe(false));
  it('accepts a complete typed snapshot', () => expect(SnapshotMessageSchema.safeParse(validSnapshot()).success).toBe(true));
  it('rejects an unsupported snapshot version', () => expect(SnapshotMessageSchema.safeParse({ ...validSnapshot(), version: 2 }).success).toBe(false));
  it('rejects snapshots with invalid arena dimensions', () => expect(SnapshotMessageSchema.safeParse({ ...validSnapshot(), width: 100 }).success).toBe(false));
  it('rejects a snapshot entity with an unknown kind', () => {
    const snapshot = validSnapshot();
    const damaged = { ...snapshot, players: snapshot.players.map((player, index) => index === 0 ? { ...player, kind: 'unknown' } : player) };
    expect(SnapshotMessageSchema.safeParse(damaged).success).toBe(false);
  });
  it('rejects snapshot arrays over the wire count limit', () => {
    const snapshot = validSnapshot();
    expect(SnapshotMessageSchema.safeParse({ ...snapshot, players: Array.from({ length: 256 }, () => snapshot.players[0]) }).success).toBe(false);
  });
  it('accepts players update and rejects overlong names', () => {
    const valid = { type: 'players', players: [{ playerId: 1, name: 'Pilot' }] };
    expect(PlayersMessageSchema.safeParse(valid).success).toBe(true);
    expect(PlayersMessageSchema.safeParse({ type: 'players', players: [{ playerId: 1, name: 'x'.repeat(19) }] }).success).toBe(false);
  });
  it('accepts joined, error, chat and system server messages', () => {
    const snapshot = validSnapshot();
    const joined = {
      type: 'joined', room: { id: 'room', name: 'Room', players: 1, maxPlayers: 8, width: 960, height: 540, asteroids: 8, enemies: 2 },
      playerId: 1, protocol: 'json', seed: 1, players: [{ playerId: 1, name: 'Pilot' }], snapshot,
    };
    expect(JoinedMessageSchema.safeParse(joined).success).toBe(true);
    expect(ErrorMessageSchema.safeParse({ type: 'error', code: 'room_not_found' }).success).toBe(true);
    expect(ChatServerMessageSchema.safeParse({ type: 'chat', playerName: 'Pilot', message: 'Hi' }).success).toBe(true);
    expect(SystemMessageSchema.safeParse({ type: 'system', text: 'Pilot joined' }).success).toBe(true);
    expect(ServerMessageSchema.safeParse(joined).success).toBe(true);
  });
  it('rejects malformed joined message and unknown server message types', () => {
    expect(JoinedMessageSchema.safeParse({ type: 'joined', room: {}, playerId: 1, protocol: 'json', seed: 1, players: [], snapshot: {} }).success).toBe(false);
    expect(ServerMessageSchema.safeParse({ type: 'teleport', x: 4 }).success).toBe(false);
  });
});
