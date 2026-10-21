import { createRenderer, type RenderEntity, type RenderKind } from './render.ts';
import { emitGameEvent } from './event-bus.ts';
import type { LoadedAssets } from './asset-loader.ts';
import type { LobbyRoom } from './lobby.ts';
import type { ReconnectingSocket } from './socket-client.ts';
import {
  SIM_DT,
  cloneShip,
  createBulletFromShip,
  integrateShip,
  inputSeq,
  type EntityId,
  type InputMessage,
  type ShipState,
  type SnapshotMessage,
  type SnapshotShip,
  type SnapshotBullet,
  type SnapshotAsteroid,
  type SnapshotPickup,
  type BulletState,
} from '@space-arena/shared';
import type { ParsedServerMessage } from '@space-arena/shared/schemas';

const INTERPOLATION_DELAY_MS = 100;
const CORRECTION_TIME_MS = 100;
const MAX_FRAME_DELTA = 0.25;

interface NetworkSettings {
  readonly prediction: boolean;
  readonly injectNondeterminism: boolean;
  readonly latency: number;
  readonly jitter: number;
  readonly loss: number;
}
interface NetworkStats {
  readonly rttMs: number;
  readonly snapshotAgeMs: number;
  readonly bytesPerSecond: number;
  readonly inputQueue: number;
  readonly correctionPx: number;
  readonly droppedPackets: number;
  readonly protocol: 'json' | 'binary';
  readonly tick: number;
  readonly hp: number;
  readonly score: number;
  readonly players: number;
  readonly enemies: number;
  readonly pickups: number;
  readonly entities: number;
  readonly stepsPerSecond: number;
  readonly framesPerSecond: number;
  readonly frameTimeMs: number;
}
interface NetworkGameOptions {
  readonly canvas: HTMLCanvasElement;
  readonly assets: LoadedAssets;
  readonly room: LobbyRoom;
  readonly playerId: EntityId;
  readonly seed?: number;
  readonly initialSnapshot: SnapshotMessage;
  readonly socketClient: ReconnectingSocket;
  readonly protocol?: 'json' | 'binary';
  readonly playerNames?: readonly { readonly playerId: EntityId; readonly name: string }[];
  readonly getNetworkSettings?: () => NetworkSettings;
  readonly onStats?: (stats: NetworkStats) => void;
  readonly onLeave?: () => void;
}
interface TrafficSample { readonly at: number; readonly direction: 'in' | 'out'; readonly size: number }
interface TimedSnapshot { readonly snapshot: SnapshotMessage; readonly at: number }
interface LocalEffect { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string }
interface RendererSource {
  readonly id?: number;
  readonly angle?: number;
  readonly radius?: number;
  readonly hp?: number;
  readonly maxHp?: number;
  readonly homing?: boolean;
  readonly shotsFired?: number;
  readonly score?: number;
}
interface Interpolatable { readonly id: EntityId; readonly x: number; readonly y: number; readonly vx?: number; readonly vy?: number; readonly angle?: number }
interface InterpolationResult { readonly snapshot: SnapshotMessage; readonly next: SnapshotMessage; readonly alpha: number }
type InputControls = Pick<InputMessage, 'throttle' | 'turn' | 'fire'>;

function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
function lerp(a: number, b: number, alpha: number): number { return a + (b - a) * alpha; }
function lerpAngle(a: number, b: number, alpha: number): number {
  let delta = b - a;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * alpha;
}
function seededRandom(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x100000000; };
}
function copySnapshot(snapshot: SnapshotMessage): SnapshotMessage {
  return {
    ...snapshot,
    players: snapshot.players.map((item) => ({ ...item })),
    enemies: snapshot.enemies.map((item) => ({ ...item })),
    bullets: snapshot.bullets.map((item) => ({ ...item })),
    asteroids: snapshot.asteroids.map((item) => ({ ...item })),
    pickups: snapshot.pickups.map((item) => ({ ...item })),
  };
}
function shipStateFromSnapshot(ship: SnapshotShip): ShipState {
  return { ...ship, collisionCooldown: 0, respawnTick: 0 };
}
function entityForRenderer(kind: RenderKind, source: RendererSource, x: number, y: number, scale: number, isPlayer = false): RenderEntity {
  const position = { x, y };
  return {
    ...source,
    kind,
    position,
    previousPosition: position,
    dead: false,
    angle: source.angle ?? 0,
    radius: (source.radius ?? (kind === 'ship' ? 16 : kind === 'enemy' ? 18 : kind === 'pickup' ? 17 : 4)) * scale,
    isPlayer,
    isHoming: Boolean(source.homing),
    spriteFrame: (source.id ?? 0) % 4,
    pulse: kind === 'pickup' ? performance.now() / 250 : 0,
    alpha: 1,
    size: 2,
  };
}
function shortestWrappedDelta(a: number, b: number, size: number): number {
  let delta = a - b;
  if (size > 0 && delta > size / 2) delta -= size;
  if (size > 0 && delta < -size / 2) delta += size;
  return delta;
}
function interpolateWrapped(a: number, b: number, alpha: number, size: number): number {
  let delta = b - a;
  if (size > 0 && delta > size / 2) delta -= size;
  if (size > 0 && delta < -size / 2) delta += size;
  const value = a + delta * alpha;
  return size > 0 ? ((value % size) + size) % size : value;
}
function interpolateEntity<T extends Interpolatable>(a: T | undefined, b: T | undefined, alpha: number, width: number, height: number): T {
  if (a === undefined && b === undefined) throw new Error('Cannot interpolate two missing entities');
  const from = a ?? b;
  const to = b ?? a;
  if (from === undefined || to === undefined) throw new Error('Missing interpolation endpoint');
  return {
    ...to,
    x: interpolateWrapped(from.x, to.x, alpha, width),
    y: interpolateWrapped(from.y, to.y, alpha, height),
    vx: lerp(from.vx ?? 0, to.vx ?? 0, alpha),
    vy: lerp(from.vy ?? 0, to.vy ?? 0, alpha),
    angle: lerpAngle(from.angle ?? 0, to.angle ?? 0, alpha),
  };
}
function interpolateList<T extends Interpolatable>(aItems: readonly T[], bItems: readonly T[], alpha: number, keyFn: (item: T) => string | number, width: number, height: number): T[] {
  const aMap = new Map(aItems.map((item) => [keyFn(item), item]));
  const bMap = new Map(bItems.map((item) => [keyFn(item), item]));
  const keysToRender = new Set([...aMap.keys(), ...bMap.keys()]);
  return [...keysToRender].map((key) => interpolateEntity(aMap.get(key), bMap.get(key), alpha, width, height));
}

export function createNetworkGame({
  canvas, assets, room, playerId, seed = 1, initialSnapshot, socketClient,
  protocol = 'binary', playerNames = [],
  getNetworkSettings = () => ({ prediction: true, injectNondeterminism: false, latency: 100, jitter: 20, loss: 0 }),
  onStats = () => {}, onLeave = () => {},
}: NetworkGameOptions) {
  const renderer = createRenderer(canvas);
  renderer.setAssets(assets);
  const keys = new Set<string>();
  const random = seededRandom(((seed >>> 0) ^ (Number(playerId) * 7237) ^ 101) >>> 0);
  const history: InputMessage[] = [];
  const sentAtBySeq = new Map<number, number>();
  const snapshots: TimedSnapshot[] = [];
  const traffic: TrafficSample[] = [];
  const scheduledTimers = new Set<ReturnType<typeof setTimeout>>();
  const names = new Map(playerNames.map((item) => [item.playerId, item.name]));
  const localBullets: BulletState[] = [];
  const effects: LocalEffect[] = [];
  const firstSnapshot = copySnapshot(initialSnapshot);
  const firstShip = firstSnapshot.players.find((ship) => ship.id === playerId);
  if (!firstShip) throw new Error('Initial server snapshot does not contain this player');
  let authoritative: ShipState = shipStateFromSnapshot(firstShip);
  let prediction: ShipState = cloneShip(authoritative);
  let correction = { x: 0, y: 0 };
  let correctionMagnitude = 0;
  let sequence = inputSeq(1);
  let localBulletId = -1;
  let running = false;
  let frameHandle = 0;
  let previousFrame = 0;
  let accumulator = 0;
  let renderedSteps = 0;
  let frames = 0;
  let statsWindowStart = performance.now();
  let stepsPerSecond = 0;
  let framesPerSecond = 0;
  let frameTimeMs = 0;
  let lastSnapshotAppliedAt = performance.now();
  let lastSnapshotServerAgeMs = 0;
  let rttMs = 0;
  let droppedPackets = 0;
  let localFireCooldown = 0;
  let localShotsFired = firstShip.shotsFired;
  snapshots.push({ snapshot: firstSnapshot, at: performance.now() });

  function recordTraffic(direction: 'in' | 'out', size: number): void {
    traffic.push({ at: performance.now(), direction, size: Math.max(0, size) });
    const cutoff = performance.now() - 1000;
    while (traffic.length > 0 && (traffic[0]?.at ?? Infinity) < cutoff) traffic.shift();
  }
  function trafficBytesPerSecond(): number {
    const cutoff = performance.now() - 1000;
    return traffic.reduce((total, item) => total + (item.at >= cutoff ? item.size : 0), 0);
  }
  function networkDelay(): number {
    const settings = getNetworkSettings();
    const oneWay = Math.max(0, settings.latency) / 2;
    return Math.max(0, oneWay + (random() * 2 - 1) * Math.max(0, settings.jitter) / 2);
  }
  function maybeDropPacket(): boolean {
    if (random() < clamp(getNetworkSettings().loss, 0, 100) / 100) { droppedPackets += 1; return true; }
    return false;
  }
  function schedule(callback: () => void, delay: number): void {
    const timer = setTimeout(() => { scheduledTimers.delete(timer); if (running) callback(); }, delay);
    scheduledTimers.add(timer);
  }
  function sendInput(input: InputMessage): void {
    if (maybeDropPacket()) return;
    schedule(() => { const bytes = socketClient.send(input); if (bytes > 0) recordTraffic('out', bytes); }, networkDelay());
  }
  function handleSnapshot(snapshot: SnapshotMessage, bytes = 0): void {
    recordTraffic('in', bytes);
    if (maybeDropPacket()) return;
    schedule(() => applySnapshot(snapshot), networkDelay());
  }
  function spawnExplosion(x: number, y: number, count = 18, color = '#ffd477'): void {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 45 + Math.random() * 170;
      const life = 0.28 + Math.random() * 0.55;
      effects.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, size: 1.4 + Math.random() * 2.8, color });
    }
  }
  function updateEffects(dt: number): void {
    for (const effect of effects) {
      effect.x = ((effect.x + effect.vx * dt) % room.width + room.width) % room.width;
      effect.y = ((effect.y + effect.vy * dt) % room.height + room.height) % room.height;
      effect.life -= dt;
    }
    for (let index = effects.length - 1; index >= 0; index -= 1) if ((effects[index]?.life ?? 0) <= 0) effects.splice(index, 1);
  }
  function emitSnapshotAudioEvents(previousSnapshot: SnapshotMessage, snapshot: SnapshotMessage): void {
    const previousBulletKeys = new Set(previousSnapshot.bullets.map((bullet) => `${bullet.ownerId}:${bullet.id}`));
    for (const bullet of snapshot.bullets) if (!previousBulletKeys.has(`${bullet.ownerId}:${bullet.id}`) && bullet.ownerId !== playerId) emitGameEvent('fired', { ownerId: bullet.ownerId, remote: true });
    const previousPickupMap = new Map(previousSnapshot.pickups.map((pickup) => [pickup.id, pickup]));
    let collectedPickup = false;
    for (const pickup of snapshot.pickups) {
      const previous = previousPickupMap.get(pickup.id);
      if (previous?.active && !pickup.active) { collectedPickup = true; spawnExplosion(pickup.x, pickup.y, 8, '#76f0a6'); emitGameEvent('pickup', { pickupId: pickup.id }); }
    }
    const previousShips = new Map([...previousSnapshot.players, ...previousSnapshot.enemies].map((ship) => [ship.id, ship]));
    for (const ship of [...snapshot.players, ...snapshot.enemies]) {
      const previous = previousShips.get(ship.id);
      if (!previous) continue;
      const healthDelta = ship.hp - previous.hp;
      const dx = shortestWrappedDelta(previous.x, ship.x, room.width);
      const dy = shortestWrappedDelta(previous.y, ship.y, room.height);
      const teleported = Math.hypot(dx, dy) > 100;
      if (healthDelta < 0) emitGameEvent('hit', { playerId: ship.id, damage: -healthDelta });
      if (previous.hp > 0 && ship.hp <= 0) { spawnExplosion(ship.x, ship.y, 26, Number(ship.id) >= 60000 ? '#ff7189' : '#ffd477'); emitGameEvent('exploded', { playerId: ship.id }); }
      if (healthDelta > 0 && !teleported && !collectedPickup) emitGameEvent('hit', { playerId: ship.id, damage: -healthDelta });
      if (teleported && ship.hp >= previous.hp) emitGameEvent('respawned', { playerId: ship.id });
    }
    const nextAsteroidIds = new Set(snapshot.asteroids.map((asteroid) => asteroid.id));
    for (const asteroid of previousSnapshot.asteroids) if (!nextAsteroidIds.has(asteroid.id)) { spawnExplosion(asteroid.x, asteroid.y, 20, '#c7d3e7'); emitGameEvent('exploded', { asteroidId: asteroid.id }); }
  }
  function latestTimedSnapshot(): TimedSnapshot {
    const latest = snapshots[snapshots.length - 1];
    if (!latest) throw new Error('Snapshot buffer is empty');
    return latest;
  }
  function applySnapshot(rawSnapshot: SnapshotMessage): void {
    if (!running) return;
    const snapshot = copySnapshot(rawSnapshot);
    if (Number(snapshot.tick) <= Number(latestTimedSnapshot().snapshot.tick)) return;
    const previousSnapshot = latestTimedSnapshot().snapshot;
    emitSnapshotAudioEvents(previousSnapshot, snapshot);
    const now = performance.now();
    lastSnapshotAppliedAt = now;
    lastSnapshotServerAgeMs = Math.max(0, ((Date.now() >>> 0) - (snapshot.serverTimeMs >>> 0)) >>> 0);
    snapshots.push({ snapshot, at: now });
    while (snapshots.length > 8) snapshots.shift();
    const ack = snapshot.ackSeq;
    const acknowledgedSendTime = sentAtBySeq.get(Number(ack));
    if (acknowledgedSendTime !== undefined) rttMs = Math.max(0, now - acknowledgedSendTime);
    for (const key of sentAtBySeq.keys()) if (key <= Number(ack)) sentAtBySeq.delete(key);
    const localServerShip = snapshot.players.find((ship) => ship.id === playerId);
    if (localServerShip) {
      const wasVisible = { x: prediction.x + correction.x, y: prediction.y + correction.y };
      authoritative = shipStateFromSnapshot(localServerShip);
      localShotsFired = Math.max(localShotsFired, localServerShip.shotsFired);
      const pending = history.filter((input) => Number(input.seq) > Number(ack));
      history.splice(0, history.length, ...pending);
      if (getNetworkSettings().prediction) {
        prediction = cloneShip(authoritative);
        for (const item of pending) prediction = integrateShip(prediction, item, SIM_DT, room).state;
        correction = { x: shortestWrappedDelta(wasVisible.x, prediction.x, room.width), y: shortestWrappedDelta(wasVisible.y, prediction.y, room.height) };
        correctionMagnitude = Math.hypot(correction.x, correction.y);
      } else { prediction = cloneShip(authoritative); correction = { x: 0, y: 0 }; correctionMagnitude = 0; }
    }
    publishStats();
  }
  function handleServerMessage(message: ParsedServerMessage, bytes = 0): void {
    switch (message.type) {
      case 'snapshot': handleSnapshot(message, bytes); return;
      case 'players': names.clear(); for (const player of message.players) names.set(player.playerId, player.name); return;
      case 'joined': case 'chat': case 'system': case 'error': return;
      default: { const exhaustive: never = message; throw new Error(`Unhandled server message: ${String(exhaustive)}`); }
    }
  }
  function currentInput(): InputControls {
    const up = keys.has('KeyW') || keys.has('ArrowUp'); const down = keys.has('KeyS') || keys.has('ArrowDown');
    const left = keys.has('KeyA') || keys.has('ArrowLeft'); const right = keys.has('KeyD') || keys.has('ArrowRight');
    return { throttle: (up ? 1 : 0) - (down ? 0.45 : 0), turn: (right ? 1 : 0) - (left ? 1 : 0), fire: keys.has('Space') };
  }
  function steerLocalBullet(bullet: BulletState): void {
    if (!bullet.homing) return;
    const snapshot = latestTimedSnapshot().snapshot;
    const targets: Array<{ x: number; y: number }> = [
      ...snapshot.players.filter((ship) => ship.id !== playerId && ship.hp > 0),
      ...snapshot.enemies.filter((enemy) => enemy.hp > 0),
      ...snapshot.asteroids,
    ];
    let target: { dx: number; dy: number } | null = null; let best = Infinity;
    for (const candidate of targets) {
      let dx = candidate.x - bullet.x; let dy = candidate.y - bullet.y;
      if (dx > room.width / 2) dx -= room.width; if (dx < -room.width / 2) dx += room.width;
      if (dy > room.height / 2) dy -= room.height; if (dy < -room.height / 2) dy += room.height;
      const distance = dx * dx + dy * dy;
      if (distance < best) { best = distance; target = { dx, dy }; }
    }
    if (!target) return;
    const desired = Math.atan2(target.dy, target.dx); let difference = desired - bullet.angle;
    while (difference > Math.PI) difference -= Math.PI * 2; while (difference < -Math.PI) difference += Math.PI * 2;
    bullet.angle += clamp(difference, -4.2 * SIM_DT, 4.2 * SIM_DT);
    const speed = Math.max(1, Math.hypot(bullet.vx, bullet.vy)); bullet.vx = Math.cos(bullet.angle) * speed; bullet.vy = Math.sin(bullet.angle) * speed;
  }
  function stepPrediction(): void {
    const rawInput = currentInput();
    const input: InputMessage = {
      type: 'input', seq: sequence,
      throttle: protocol === 'binary' ? Math.round(clamp(rawInput.throttle, -1, 1) * 127) / 127 : rawInput.throttle,
      turn: protocol === 'binary' ? Math.round(clamp(rawInput.turn, -1, 1) * 127) / 127 : rawInput.turn,
      fire: rawInput.fire,
    };
    sentAtBySeq.set(Number(input.seq), performance.now());
    sequence = inputSeq((Number(sequence) + 1) >>> 0);
    history.push(input); if (history.length > 240) history.shift(); sendInput(input);
    const settings = getNetworkSettings();
    if (settings.prediction) {
      const result = integrateShip(prediction, input, SIM_DT, room); prediction = result.state;
      if (settings.injectNondeterminism) {
        prediction.x = ((prediction.x + (Math.random() - 0.5) * 4) % room.width + room.width) % room.width;
        prediction.y = ((prediction.y + (Math.random() - 0.5) * 4) % room.height + room.height) % room.height;
      }
      if (result.fired) {
        localShotsFired = prediction.shotsFired || localShotsFired + 1;
        localBullets.push(createBulletFromShip(prediction, localBulletId, playerId, localShotsFired % 5 === 0)); localBulletId -= 1;
        emitGameEvent('fired', { ownerId: playerId, predicted: true });
      }
    } else if (input.fire && localFireCooldown <= 0) {
      localShotsFired += 1;
      localBullets.push(createBulletFromShip({ ...authoritative, shotsFired: localShotsFired }, localBulletId, playerId, localShotsFired % 5 === 0));
      localBulletId -= 1; localFireCooldown = 0.22; emitGameEvent('fired', { ownerId: playerId, predicted: false });
    }
    localFireCooldown = Math.max(0, localFireCooldown - SIM_DT);
    for (const bullet of localBullets) { steerLocalBullet(bullet); bullet.x = ((bullet.x + bullet.vx * SIM_DT) % room.width + room.width) % room.width; bullet.y = ((bullet.y + bullet.vy * SIM_DT) % room.height + room.height) % room.height; bullet.ttl -= SIM_DT; }
    for (let index = localBullets.length - 1; index >= 0; index -= 1) if ((localBullets[index]?.ttl ?? 0) <= 0) localBullets.splice(index, 1);
  }
  function findInterpolatedSnapshot(renderTime: number): InterpolationResult {
    const current = latestTimedSnapshot();
    if (snapshots.length < 2) return { snapshot: current.snapshot, next: current.snapshot, alpha: 1 };
    const first = snapshots[0];
    if (!first) return { snapshot: current.snapshot, next: current.snapshot, alpha: 1 };
    for (let index = 0; index < snapshots.length - 1; index += 1) {
      const a = snapshots[index]; const b = snapshots[index + 1];
      if (!a || !b) continue;
      if (renderTime >= a.at && renderTime <= b.at) return { snapshot: a.snapshot, next: b.snapshot, alpha: clamp((renderTime - a.at) / Math.max(1, b.at - a.at), 0, 1) };
    }
    if (renderTime < first.at) return { snapshot: first.snapshot, next: first.snapshot, alpha: 0 };
    return { snapshot: current.snapshot, next: current.snapshot, alpha: 1 };
  }
  function render(now: number): void {
    const view = renderer.getSize(); const sx = view.width / room.width; const sy = view.height / room.height; const scale = Math.min(sx, sy);
    const predictionEnabled = getNetworkSettings().prediction;
    const timed = findInterpolatedSnapshot(now - INTERPOLATION_DELAY_MS);
    const remotePlayers = interpolateList(timed.snapshot.players, timed.next.players, timed.alpha, (item) => item.id, room.width, room.height).filter((ship) => ship.id !== playerId && ship.hp > 0);
    const enemies = interpolateList(timed.snapshot.enemies, timed.next.enemies, timed.alpha, (item) => item.id, room.width, room.height).filter((enemy) => enemy.hp > 0);
    const serverBullets = interpolateList(timed.snapshot.bullets, timed.next.bullets, timed.alpha, (item) => `${item.ownerId}:${item.id}`, room.width, room.height).filter((bullet) => bullet.ownerId !== playerId);
    const asteroids = interpolateList(timed.snapshot.asteroids, timed.next.asteroids, timed.alpha, (item) => item.id, room.width, room.height);
    const pickups = interpolateList(timed.snapshot.pickups, timed.next.pickups, timed.alpha, (item) => item.id, room.width, room.height).filter((pickup) => pickup.active);
    const localState = predictionEnabled ? prediction : authoritative;
    const localDrawShip = { ...localState, x: ((localState.x + (predictionEnabled ? correction.x : 0)) % room.width + room.width) % room.width, y: ((localState.y + (predictionEnabled ? correction.y : 0)) % room.height + room.height) % room.height };
    const entities: RenderEntity[] = [];
    if (localDrawShip.hp > 0) entities.push(entityForRenderer('ship', localDrawShip, localDrawShip.x * sx, localDrawShip.y * sy, scale, true));
    for (const ship of remotePlayers) entities.push(entityForRenderer('ship', ship, ship.x * sx, ship.y * sy, scale));
    for (const enemy of enemies) entities.push(entityForRenderer('enemy', enemy, enemy.x * sx, enemy.y * sy, scale));
    for (const bullet of serverBullets) entities.push(entityForRenderer('bullet', bullet, bullet.x * sx, bullet.y * sy, scale));
    for (const bullet of localBullets) entities.push(entityForRenderer('bullet', bullet, bullet.x * sx, bullet.y * sy, scale, true));
    for (const asteroid of asteroids) entities.push(entityForRenderer('asteroid', asteroid, asteroid.x * sx, asteroid.y * sy, scale));
    for (const pickup of pickups) entities.push(entityForRenderer('pickup', pickup, pickup.x * sx, pickup.y * sy, scale));
    for (const effect of effects) entities.push({ ...entityForRenderer('particle', { id: 0, angle: 0, radius: 1 }, effect.x * sx, effect.y * sy, scale), alpha: clamp(effect.life / effect.maxLife, 0, 1), size: effect.size * scale, color: effect.color });
    renderer.render(entities, 0);
    if (predictionEnabled) { const decay = Math.exp(-Math.max(0, frameTimeMs) / CORRECTION_TIME_MS); correction.x *= decay; correction.y *= decay; correctionMagnitude = Math.hypot(correction.x, correction.y); }
  }
  function publishStats(): void {
    const now = performance.now(); const snapshot = latestTimedSnapshot().snapshot;
    onStats({
      rttMs, snapshotAgeMs: Math.max(0, lastSnapshotServerAgeMs + now - lastSnapshotAppliedAt), bytesPerSecond: trafficBytesPerSecond(),
      inputQueue: history.length, correctionPx: correctionMagnitude, droppedPackets, protocol, tick: Number(snapshot.tick),
      hp: authoritative.hp, score: authoritative.score, players: snapshot.players.length, enemies: snapshot.enemies.length,
      pickups: snapshot.pickups.filter((pickup) => pickup.active).length,
      entities: snapshot.players.length + snapshot.enemies.length + snapshot.bullets.length + snapshot.asteroids.length + snapshot.pickups.length,
      stepsPerSecond, framesPerSecond, frameTimeMs,
    });
  }
  function frame(now: number): void {
    if (!running) return;
    const rawDelta = previousFrame === 0 ? 0 : Math.max(0, (now - previousFrame) / 1000);
    const delta = Math.min(MAX_FRAME_DELTA, rawDelta); frameTimeMs = delta * 1000; previousFrame = now; accumulator += delta; frames += 1;
    let stepsThisFrame = 0;
    while (accumulator >= SIM_DT && stepsThisFrame < 5) { stepPrediction(); updateEffects(SIM_DT); accumulator -= SIM_DT; renderedSteps += 1; stepsThisFrame += 1; }
    render(now);
    if (now - statsWindowStart >= 1000) { stepsPerSecond = renderedSteps; framesPerSecond = frames; frames = 0; renderedSteps = 0; statsWindowStart = now; }
    publishStats(); frameHandle = requestAnimationFrame(frame);
  }
  function onKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof Element && event.target.closest('input, textarea, select, button')) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (event.code === 'Escape') { event.preventDefault(); onLeave(); return; }
    keys.add(event.code);
  }
  function onKeyUp(event: KeyboardEvent): void { keys.delete(event.code); }
  function onBlur(): void { keys.clear(); }
  function start(): void {
    if (running) return; running = true; window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); window.addEventListener('blur', onBlur); frameHandle = requestAnimationFrame(frame);
  }
  function stop(): void {
    running = false; cancelAnimationFrame(frameHandle); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur);
    for (const timer of scheduledTimers) clearTimeout(timer); scheduledTimers.clear(); keys.clear(); renderer.destroy();
  }
  return { start, stop, handleServerMessage, handleSnapshot, get playerId() { return playerId; } };
}
