import { z } from 'zod';
import { entityId, inputSeq, stepNumber } from './types.ts';

const uint16 = z.number().int().min(0).max(65_535);
const uint32 = z.number().int().min(0).max(0xffff_ffff);
const positiveSeq = z.number().int().min(1).max(0xffff_ffff).transform(inputSeq);
const finite = z.number().finite();
const unitInput = finite.min(-1).max(1);

export const JoinMessageSchema = z.object({
  type: z.literal('join'),
  roomId: z.string().min(1).max(64).regex(/^[-_a-zA-Z0-9]+$/),
  playerName: z.string().trim().min(1).max(18),
  protocol: z.union([z.literal('json'), z.literal('binary')]).optional(),
}).strict();

export const LeaveMessageSchema = z.object({ type: z.literal('leave') }).strict();
export const ChatMessageSchema = z.object({
  type: z.literal('chat'),
  message: z.string().trim().min(1).max(500),
}).strict();

export const InputMessageSchema = z.object({
  type: z.literal('input'),
  seq: positiveSeq,
  throttle: unitInput,
  turn: unitInput,
  fire: z.boolean(),
}).strict();

export const ClientMessageSchema = z.discriminatedUnion('type', [
  JoinMessageSchema,
  LeaveMessageSchema,
  ChatMessageSchema,
  InputMessageSchema,
]);

const wireShipFields = {
  id: uint16.transform(entityId),
  x: finite.min(0).max(65_535),
  y: finite.min(0).max(65_535),
  vx: finite.min(-10_000).max(10_000),
  vy: finite.min(-10_000).max(10_000),
  angle: finite.min(-Math.PI).max(Math.PI),
  radius: finite.min(1).max(256),
  hp: finite.min(0).max(255),
  maxHp: finite.min(1).max(255),
  score: finite.min(0).max(65_535),
  fireCooldown: finite.min(0).max(60),
  shotsFired: finite.min(0).max(65_535),
};

const wireShipSchema = z.object({ kind: z.literal('ship'), ...wireShipFields }).strict();
const wireEnemySchema = z.object({ kind: z.literal('enemy'), ...wireShipFields }).strict();

const wireBulletSchema = z.object({
  kind: z.literal('bullet'),
  id: uint16.transform(entityId),
  ownerId: uint16.transform(entityId),
  x: finite.min(0).max(65_535),
  y: finite.min(0).max(65_535),
  vx: finite.min(-10_000).max(10_000),
  vy: finite.min(-10_000).max(10_000),
  angle: finite.min(-Math.PI).max(Math.PI),
  ttl: finite.min(0).max(120),
  radius: finite.min(1).max(128),
  homing: z.boolean(),
}).strict();

const wireAsteroidSchema = z.object({
  kind: z.literal('asteroid'),
  id: uint16.transform(entityId),
  x: finite.min(0).max(65_535),
  y: finite.min(0).max(65_535),
  vx: finite.min(-10_000).max(10_000),
  vy: finite.min(-10_000).max(10_000),
  angle: finite.min(-Math.PI).max(Math.PI),
  angularVelocity: finite.min(-100).max(100),
  radius: finite.min(1).max(512),
  hp: finite.min(0).max(255),
  maxHp: finite.min(1).max(255),
}).strict();

const wirePickupSchema = z.object({
  kind: z.literal('pickup'),
  id: uint16.transform(entityId),
  x: finite.min(0).max(65_535),
  y: finite.min(0).max(65_535),
  radius: finite.min(1).max(256),
  active: z.boolean(),
}).strict();

export const SnapshotMessageSchema = z.object({
  type: z.literal('snapshot'),
  version: z.literal(3),
  tick: uint32.transform(stepNumber),
  ackSeq: uint32.transform(inputSeq),
  serverTimeMs: uint32,
  width: uint16.min(320),
  height: uint16.min(240),
  players: z.array(wireShipSchema).max(255),
  enemies: z.array(wireEnemySchema).max(255),
  bullets: z.array(wireBulletSchema).max(255),
  asteroids: z.array(wireAsteroidSchema).max(255),
  pickups: z.array(wirePickupSchema).max(255),
}).strict();

export const PlayersMessageSchema = z.object({
  type: z.literal('players'),
  players: z.array(z.object({ playerId: uint16.transform(entityId), name: z.string().max(18) }).strict()),
}).strict();

export const JoinedMessageSchema = z.object({
  type: z.literal('joined'),
  room: z.object({
    id: z.string(), name: z.string(), players: z.number().int().nonnegative(),
    maxPlayers: z.number().int().positive(), width: uint16, height: uint16,
    asteroids: z.number().int().nonnegative(), enemies: z.number().int().nonnegative(),
  }).passthrough(),
  playerId: uint16.transform(entityId),
  protocol: z.union([z.literal('json'), z.literal('binary')]),
  seed: uint32,
  players: z.array(z.object({ playerId: uint16.transform(entityId), name: z.string().max(18) }).strict()),
  snapshot: SnapshotMessageSchema,
}).passthrough();

export const ErrorMessageSchema = z.object({
  type: z.literal('error'), code: z.string(),
}).passthrough();
export const ChatServerMessageSchema = z.object({
  type: z.literal('chat'), playerName: z.string(), message: z.string(),
}).passthrough();
export const SystemMessageSchema = z.object({ type: z.literal('system'), text: z.string() }).passthrough();
export const ServerMessageSchema = z.discriminatedUnion('type', [
  SnapshotMessageSchema,
  PlayersMessageSchema,
  JoinedMessageSchema,
  ErrorMessageSchema,
  ChatServerMessageSchema,
  SystemMessageSchema,
]);

export type ParsedClientMessage = z.infer<typeof ClientMessageSchema>;
export type JoinMessage = z.infer<typeof JoinMessageSchema>;
export type ParsedInputMessage = z.infer<typeof InputMessageSchema>;
export type ParsedSnapshotMessage = z.infer<typeof SnapshotMessageSchema>;
export type ParsedServerMessage = z.infer<typeof ServerMessageSchema>;
