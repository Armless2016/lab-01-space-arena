/** Compile-time brands prevent mixing unrelated numeric identifiers. */
declare const entityIdBrand: unique symbol;
declare const stepNumberBrand: unique symbol;
declare const inputSeqBrand: unique symbol;

export type Brand<Value extends number, Name extends string> = Value & { readonly __brand: Name };
export type EntityId = Brand<number, 'EntityId'>;
export type StepNumber = Brand<number, 'StepNumber'>;
export type InputSeq = Brand<number, 'InputSeq'>;

// These constructors are the only intentional brand assertions in the codebase.
export function entityId(value: number): EntityId {
  return value as EntityId; // A validated integer is represented as an EntityId at compile time.
}

export function stepNumber(value: number): StepNumber {
  return value as StepNumber; // The simulation increments ticks only by whole steps.
}

export function inputSeq(value: number): InputSeq {
  return value as InputSeq; // Range validation occurs at the protocol boundary.
}

export interface VectorLike {
  readonly x: number;
  readonly y: number;
}

export interface ControlInput {
  readonly seq?: InputSeq;
  readonly throttle?: number;
  readonly turn?: number;
  readonly fire?: boolean;
}

export interface ShipState {
  id: EntityId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  hp: number;
  maxHp: number;
  score: number;
  fireCooldown: number;
  shotsFired: number;
  collisionCooldown: number;
  respawnTick: number;
}

export interface BulletState {
  id: EntityId;
  ownerId: EntityId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  ttl: number;
  radius: number;
  homing: boolean;
}

export interface AsteroidState {
  id: EntityId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  radius: number;
  hp: number;
  maxHp: number;
}

export interface PickupState {
  id: EntityId;
  x: number;
  y: number;
  radius: number;
  active: boolean;
  respawnTick: number;
}

export interface SimulationState {
  version: 3;
  width: number;
  height: number;
  seed: number;
  randomState: number;
  tick: StepNumber;
  ships: ShipState[];
  enemies: ShipState[];
  bullets: BulletState[];
  asteroids: AsteroidState[];
  pickups: PickupState[];
  nextBulletId: number;
  nextAsteroidId: number;
  enemyHp: number;
}

export type EntityKind = 'ship' | 'enemy' | 'bullet' | 'asteroid' | 'pickup' | 'particle';

export interface SnapshotShip extends Omit<ShipState, 'collisionCooldown' | 'respawnTick'> { readonly kind: 'ship' }
export interface SnapshotEnemy extends Omit<ShipState, 'collisionCooldown' | 'respawnTick'> { readonly kind: 'enemy' }
export interface SnapshotBullet extends BulletState { readonly kind: 'bullet' }
export interface SnapshotAsteroid extends AsteroidState { readonly kind: 'asteroid' }
export interface SnapshotPickup extends Omit<PickupState, 'respawnTick'> { readonly kind: 'pickup' }

/** A single discriminated wire entity, useful for generic snapshot processing. */
export type SnapshotEntity = SnapshotShip | SnapshotEnemy | SnapshotBullet | SnapshotAsteroid | SnapshotPickup;

export interface SnapshotMessage {
  type: 'snapshot';
  version: 3;
  tick: StepNumber;
  ackSeq: InputSeq;
  serverTimeMs: number;
  width: number;
  height: number;
  players: SnapshotShip[];
  enemies: SnapshotEnemy[];
  bullets: SnapshotBullet[];
  asteroids: SnapshotAsteroid[];
  pickups: SnapshotPickup[];
}

export interface InputMessage extends ControlInput {
  type: 'input';
  seq: InputSeq;
  throttle: number;
  turn: number;
  fire: boolean;
}

export function assertNever(value: never, message = 'Unhandled discriminated union member'): never {
  throw new Error(`${message}: ${String(value)}`);
}
