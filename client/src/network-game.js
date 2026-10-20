import { createRenderer } from './render.js';
import {
  SIM_DT,
  cloneShip,
  createBulletFromShip,
  integrateShip,
} from '@space-arena/shared/simulation.js';

const INTERPOLATION_DELAY_MS = 100;
const CORRECTION_TIME_MS = 33;
const MAX_FRAME_DELTA = 0.25;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, alpha) {
  return a + (b - a) * alpha;
}

function lerpAngle(a, b, alpha) {
  let delta = b - a;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * alpha;
}

function seededRandom(seed) {
  let state = (Number(seed) >>> 0) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function copySnapshot(snapshot) {
  return {
    ...snapshot,
    players: (snapshot.players || []).map((item) => ({ ...item })),
    bullets: (snapshot.bullets || []).map((item) => ({ ...item })),
    asteroids: (snapshot.asteroids || []).map((item) => ({ ...item })),
  };
}

function entityForRenderer(kind, source, x, y, scale, isPlayer = false) {
  const position = { x, y };
  return {
    ...source,
    kind,
    position,
    previousPosition: position,
    dead: false,
    angle: Number(source.angle) || 0,
    radius: (Number(source.radius) || (kind === 'ship' ? 16 : 4)) * scale,
    isPlayer,
    isHoming: false,
    spriteFrame: Number(source.id || 0) % 4,
    pulse: 0,
    alpha: 1,
    size: 2,
  };
}

export function createNetworkGame({
  canvas,
  assets,
  room,
  playerId,
  seed = 1,
  initialSnapshot,
  socketClient,
  protocol = 'binary',
  playerNames = [],
  getNetworkSettings = () => ({ prediction: true, latency: 100, jitter: 20, loss: 0 }),
  onStats = () => {},
  onLeave = () => {},
}) {
  const renderer = createRenderer(canvas);
  renderer.setAssets(assets);
  const keys = new Set();
  // Seed simulated network jitter/drop behavior from the server-provided room seed.
  const random = seededRandom((Number(seed) ^ (Number(playerId) * 7237) ^ 101) >>> 0);
  const history = [];
  const sentAtBySeq = new Map();
  const snapshots = [];
  const traffic = [];
  const scheduledTimers = new Set();
  const names = new Map(playerNames.map((item) => [item.playerId, item.name]));
  const localBullets = [];
  let authoritative = null;
  let prediction = null;
  let correction = { x: 0, y: 0 };
  let correctionMagnitude = 0;
  let sequence = 1;
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

  const firstSnapshot = copySnapshot(initialSnapshot);
  const firstShip = firstSnapshot.players.find((ship) => ship.id === playerId);
  if (!firstShip) throw new Error('Initial server snapshot does not contain this player');
  authoritative = cloneShip(firstShip);
  prediction = cloneShip(firstShip);
  snapshots.push({ snapshot: firstSnapshot, at: performance.now() });

  function recordTraffic(direction, size) {
    traffic.push({ at: performance.now(), direction, size: Math.max(0, size || 0) });
    const cutoff = performance.now() - 1000;
    while (traffic.length && traffic[0].at < cutoff) traffic.shift();
  }

  function trafficBytesPerSecond() {
    const cutoff = performance.now() - 1000;
    return traffic.reduce((total, item) => total + (item.at >= cutoff ? item.size : 0), 0);
  }

  function networkDelay() {
    const settings = getNetworkSettings();
    const oneWay = Math.max(0, Number(settings.latency) || 0) / 2;
    const jitter = Math.max(0, Number(settings.jitter) || 0);
    return Math.max(0, oneWay + (random() * 2 - 1) * jitter / 2);
  }

  function maybeDropPacket() {
    const loss = clamp(Number(getNetworkSettings().loss) || 0, 0, 100) / 100;
    if (random() < loss) {
      droppedPackets += 1;
      return true;
    }
    return false;
  }

  function schedule(callback, delay) {
    const timer = setTimeout(() => {
      scheduledTimers.delete(timer);
      if (running) callback();
    }, delay);
    scheduledTimers.add(timer);
  }

  function sendInput(input) {
    if (maybeDropPacket()) return;
    const delay = networkDelay();
    schedule(() => {
      const bytes = socketClient.send(input);
      if (bytes > 0) recordTraffic('out', bytes);
    }, delay);
  }

  function handleSnapshot(snapshot, bytes = 0) {
    recordTraffic('in', bytes);
    if (maybeDropPacket()) return;
    schedule(() => applySnapshot(snapshot), networkDelay());
  }

  function applySnapshot(rawSnapshot) {
    if (!running) return;
    const snapshot = copySnapshot(rawSnapshot);
    const latestTick = snapshots.at(-1)?.snapshot.tick ?? -1;
    if (snapshot.tick <= latestTick) return;
    const now = performance.now();
    lastSnapshotAppliedAt = now;
    lastSnapshotServerAgeMs = snapshot.serverTimeMs === undefined ? 0 : Math.max(0, ((Date.now() >>> 0) - (Number(snapshot.serverTimeMs) >>> 0)) >>> 0);
    snapshots.push({ snapshot, at: now });
    while (snapshots.length > 8) snapshots.shift();

    const ack = Number(snapshot.ackSeq) >>> 0;
    const acknowledgedSendTime = sentAtBySeq.get(ack);
    if (acknowledgedSendTime !== undefined) rttMs = Math.max(0, now - acknowledgedSendTime);
    for (const key of sentAtBySeq.keys()) {
      if (key <= ack) sentAtBySeq.delete(key);
    }

    const localServerShip = snapshot.players.find((ship) => ship.id === playerId);
    if (localServerShip) {
      const wasVisible = {
        x: prediction.x + correction.x,
        y: prediction.y + correction.y,
      };
      authoritative = cloneShip(localServerShip);
      const pending = history.filter((input) => input.seq > ack);
      history.splice(0, history.length, ...pending);
      if (getNetworkSettings().prediction) {
        prediction = cloneShip(authoritative);
        for (const item of pending) {
          prediction = integrateShip(prediction, item, SIM_DT, room).state;
        }
        correction = {
          x: shortestWrappedDelta(wasVisible.x, prediction.x, room.width),
          y: shortestWrappedDelta(wasVisible.y, prediction.y, room.height),
        };
        correctionMagnitude = Math.hypot(correction.x, correction.y);
      } else {
        prediction = cloneShip(authoritative);
        correction = { x: 0, y: 0 };
        correctionMagnitude = 0;
      }
    }
    publishStats();
  }

  function handleServerMessage(message, bytes = message?.__transportBytes || 0) {
    if (message.type === 'snapshot') handleSnapshot(message, bytes);
    if (message.type === 'players') {
      names.clear();
      for (const player of message.players || []) names.set(player.playerId, player.name);
    }
  }

  function currentInput() {
    const up = keys.has('KeyW') || keys.has('ArrowUp');
    const down = keys.has('KeyS') || keys.has('ArrowDown');
    const left = keys.has('KeyA') || keys.has('ArrowLeft');
    const right = keys.has('KeyD') || keys.has('ArrowRight');
    return {
      throttle: (up ? 1 : 0) - (down ? 0.45 : 0),
      turn: (right ? 1 : 0) - (left ? 1 : 0),
      fire: keys.has('Space'),
    };
  }

  function stepPrediction() {
    const rawInput = currentInput();
    const input = protocol === 'binary'
      ? {
          throttle: Math.round(clamp(rawInput.throttle, -1, 1) * 127) / 127,
          turn: Math.round(clamp(rawInput.turn, -1, 1) * 127) / 127,
          fire: rawInput.fire,
        }
      : rawInput;
    const item = { type: 'input', seq: sequence, ...input };
    sentAtBySeq.set(item.seq, performance.now());
    sequence = (sequence + 1) >>> 0;
    history.push(item);
    if (history.length > 240) history.shift();
    sendInput(item);

    const predictionEnabled = Boolean(getNetworkSettings().prediction);
    if (predictionEnabled) {
      const result = integrateShip(prediction, item, SIM_DT, room);
      prediction = result.state;
      // Lab 05 fault injection: deliberately contaminate only the client estimate.
      // The shared authoritative simulation remains deterministic; turn this off after the demo.
      if (getNetworkSettings().injectNondeterminism) {
        prediction.x = ((prediction.x + (Math.random() - 0.5) * 4) % room.width + room.width) % room.width;
        prediction.y = ((prediction.y + (Math.random() - 0.5) * 4) % room.height + room.height) % room.height;
      }
      if (result.fired) {
        localBullets.push(createBulletFromShip(prediction, localBulletId, playerId));
        localBulletId -= 1;
      }
    } else if (input.fire && localFireCooldown <= 0) {
      localBullets.push(createBulletFromShip(authoritative, localBulletId, playerId));
      localBulletId -= 1;
      localFireCooldown = 0.22;
    }
    localFireCooldown = Math.max(0, localFireCooldown - SIM_DT);
    for (const bullet of localBullets) {
      bullet.x = ((bullet.x + bullet.vx * SIM_DT) % room.width + room.width) % room.width;
      bullet.y = ((bullet.y + bullet.vy * SIM_DT) % room.height + room.height) % room.height;
      bullet.ttl -= SIM_DT;
    }
    for (let index = localBullets.length - 1; index >= 0; index -= 1) {
      if (localBullets[index].ttl <= 0) localBullets.splice(index, 1);
    }
  }

  function findInterpolatedSnapshot(renderTime) {
    if (snapshots.length < 2) return { snapshot: snapshots.at(-1).snapshot, alpha: 1, next: snapshots.at(-1).snapshot };
    for (let index = 0; index < snapshots.length - 1; index += 1) {
      const a = snapshots[index];
      const b = snapshots[index + 1];
      if (renderTime >= a.at && renderTime <= b.at) {
        const duration = Math.max(1, b.at - a.at);
        return { snapshot: a.snapshot, next: b.snapshot, alpha: clamp((renderTime - a.at) / duration, 0, 1) };
      }
    }
    if (renderTime < snapshots[0].at) return { snapshot: snapshots[0].snapshot, next: snapshots[0].snapshot, alpha: 0 };
    const latest = snapshots.at(-1).snapshot;
    return { snapshot: latest, next: latest, alpha: 1 };
  }

  function interpolateWrapped(a, b, alpha, size) {
    let delta = b - a;
    if (size > 0 && delta > size / 2) delta -= size;
    if (size > 0 && delta < -size / 2) delta += size;
    const value = a + delta * alpha;
    return size > 0 ? ((value % size) + size) % size : value;
  }

  function shortestWrappedDelta(a, b, size) {
    let delta = a - b;
    if (size > 0 && delta > size / 2) delta -= size;
    if (size > 0 && delta < -size / 2) delta += size;
    return delta;
  }

  function interpolateEntity(a, b, alpha, width, height) {
    if (!a) return b;
    if (!b) return a;
    return {
      ...b,
      x: interpolateWrapped(a.x, b.x, alpha, width),
      y: interpolateWrapped(a.y, b.y, alpha, height),
      vx: lerp(a.vx || 0, b.vx || 0, alpha),
      vy: lerp(a.vy || 0, b.vy || 0, alpha),
      angle: lerpAngle(a.angle || 0, b.angle || 0, alpha),
    };
  }

  function interpolateList(aItems, bItems, alpha, keyFn, width = room.width, height = room.height) {
    const aMap = new Map((aItems || []).map((item) => [keyFn(item), item]));
    const bMap = new Map((bItems || []).map((item) => [keyFn(item), item]));
    const keysToRender = new Set([...aMap.keys(), ...bMap.keys()]);
    return [...keysToRender].map((key) => interpolateEntity(aMap.get(key), bMap.get(key), alpha, width, height));
  }

  function render(now) {
    const view = renderer.getSize();
    const sx = view.width / room.width;
    const sy = view.height / room.height;
    const scale = Math.min(sx, sy);
    const predictionEnabled = Boolean(getNetworkSettings().prediction);
    const timed = findInterpolatedSnapshot(now - INTERPOLATION_DELAY_MS);
    const remotePlayers = interpolateList(timed.snapshot.players, timed.next.players, timed.alpha, (item) => item.id)
      .filter((ship) => ship.id !== playerId);
    const serverBullets = interpolateList(timed.snapshot.bullets, timed.next.bullets, timed.alpha, (item) => item.id)
      .filter((bullet) => bullet.ownerId !== playerId);
    const asteroids = interpolateList(timed.snapshot.asteroids, timed.next.asteroids, timed.alpha, (item) => item.id);
    // Prediction-off is intentionally a baseline: render the latest server-owned state,
    // not the remote-entity interpolation buffer. This makes the input delay visible
    // without adding the separate 100 ms interpolation delay used for other players.
    const localState = predictionEnabled ? prediction : authoritative;
    const localDrawShip = {
      ...localState,
      x: ((localState.x + (predictionEnabled ? correction.x : 0)) % room.width + room.width) % room.width,
      y: ((localState.y + (predictionEnabled ? correction.y : 0)) % room.height + room.height) % room.height,
    };
    const entities = [];
    if (localDrawShip) entities.push(entityForRenderer('ship', localDrawShip, localDrawShip.x * sx, localDrawShip.y * sy, scale, true));
    for (const ship of remotePlayers) {
      entities.push(entityForRenderer('ship', ship, ship.x * sx, ship.y * sy, scale, false));
    }
    for (const bullet of serverBullets) {
      entities.push(entityForRenderer('bullet', bullet, bullet.x * sx, bullet.y * sy, scale, false));
    }
    for (const bullet of localBullets) {
      entities.push(entityForRenderer('bullet', bullet, bullet.x * sx, bullet.y * sy, scale, true));
    }
    for (const asteroid of asteroids) {
      entities.push(entityForRenderer('asteroid', asteroid, asteroid.x * sx, asteroid.y * sy, scale, false));
    }
    renderer.render(entities, 0);
    if (predictionEnabled) {
      const decay = Math.exp(-Math.max(0, frameTimeMs) / CORRECTION_TIME_MS);
      correction.x *= decay;
      correction.y *= decay;
      correctionMagnitude = Math.hypot(correction.x, correction.y);
    }
  }

  function publishStats() {
    const now = performance.now();
    onStats({
      rttMs,
      snapshotAgeMs: Math.max(0, lastSnapshotServerAgeMs + now - lastSnapshotAppliedAt),
      bytesPerSecond: trafficBytesPerSecond(),
      inputQueue: history.length,
      correctionPx: correctionMagnitude,
      droppedPackets,
      protocol,
      tick: snapshots.at(-1)?.snapshot.tick || 0,
      hp: authoritative?.hp ?? 0,
      score: authoritative?.score ?? 0,
      players: snapshots.at(-1)?.snapshot.players.length || 0,
      entities: (snapshots.at(-1)?.snapshot.players.length || 0) + (snapshots.at(-1)?.snapshot.bullets.length || 0) + (snapshots.at(-1)?.snapshot.asteroids.length || 0),
      stepsPerSecond,
      framesPerSecond,
      frameTimeMs,
    });
  }

  function frame(now) {
    if (!running) return;
    const rawDelta = previousFrame === 0 ? 0 : Math.max(0, (now - previousFrame) / 1000);
    const delta = Math.min(MAX_FRAME_DELTA, rawDelta);
    frameTimeMs = delta * 1000;
    previousFrame = now;
    accumulator += delta;
    frames += 1;
    let stepsThisFrame = 0;
    while (accumulator >= SIM_DT && stepsThisFrame < 5) {
      stepPrediction();
      accumulator -= SIM_DT;
      renderedSteps += 1;
      stepsThisFrame += 1;
    }
    render(now);
    if (now - statsWindowStart >= 1000) {
      stepsPerSecond = renderedSteps;
      framesPerSecond = frames;
      frames = 0;
      renderedSteps = 0;
      statsWindowStart = now;
    }
    publishStats();
    frameHandle = requestAnimationFrame(frame);
  }

  function onKeyDown(event) {
    if (event.target?.closest?.('input, textarea, select, button')) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (event.code === 'Escape') {
      event.preventDefault();
      onLeave();
      return;
    }
    keys.add(event.code);
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onBlur() {
    keys.clear();
  }

  function start() {
    if (running) return;
    running = true;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    frameHandle = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frameHandle);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    for (const timer of scheduledTimers) clearTimeout(timer);
    scheduledTimers.clear();
    keys.clear();
    renderer.destroy();
  }

  return {
    start,
    stop,
    handleServerMessage,
    handleSnapshot,
    get playerId() { return playerId; },
  };
}
