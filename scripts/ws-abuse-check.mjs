import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(new URL('../server/package.json', import.meta.url));
const { WebSocket } = require('ws');
const httpBase = process.env.HTTP_URL ?? 'http://127.0.0.1:3000';
const wsBase = process.env.WS_URL ?? 'ws://127.0.0.1:3000/ws';
const origin = process.env.TEST_ORIGIN ?? 'http://localhost:5173';

function connect(roomId, playerName) {
  const socket = new WebSocket(wsBase, { origin });
  let lastTick = 0;
  let joined = false;
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out joining ${roomId}`)), 5000);
    socket.once('open', () => socket.send(JSON.stringify({ type: 'join', roomId, playerName, protocol: 'json' })));
    socket.on('message', (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.type === 'joined') { joined = true; clearTimeout(timer); resolve(); }
        if (message.type === 'snapshot') lastTick = message.tick;
      } catch { /* malformed frames are not expected on a healthy client */ }
    });
    socket.once('error', reject);
  });
  return { socket, ready, get joined() { return joined; }, get lastTick() { return lastTick; } };
}

const observer = connect('ace-belt', 'Healthy observer');
const attacker = connect('rookie-orbit', 'Malformed frame test');
await Promise.all([observer.ready, attacker.ready]);
await delay(150);
const tickBefore = observer.lastTick;
const metricsBeforeResponse = await fetch(`${httpBase}/api/metrics`);
if (!metricsBeforeResponse.ok) throw new Error(`/api/metrics returned ${metricsBeforeResponse.status} before flood`);
const observerMetrics = await metricsBeforeResponse.json();
const observerRoomBefore = observerMetrics.roomSteps.find((room) => room.roomId === 'ace-belt');

const closed = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Malformed-frame client was not disconnected')), 5000);
  attacker.socket.once('close', (code, reason) => {
    clearTimeout(timer);
    resolve({ code, reason: reason.toString() });
  });
});
const burstStarted = performance.now();
for (let index = 0; index < 1000 && attacker.socket.readyState === WebSocket.OPEN; index += 1) {
  attacker.socket.send(`{malformed-frame-${index}`);
}
const close = await closed;
const burstMs = performance.now() - burstStarted;
await delay(250);
const tickAfter = observer.lastTick;
const metricsResponse = await fetch(`${httpBase}/api/metrics`);
if (!metricsResponse.ok) throw new Error(`/api/metrics returned ${metricsResponse.status}`);
const metrics = await metricsResponse.json();
const observerRoom = metrics.roomSteps.find((room) => room.roomId === 'ace-belt');
const overBudgetDelta = (observerRoom?.step.overBudgetSteps ?? 0) - (observerRoomBefore?.step.overBudgetSteps ?? 0);
const observerWasOpen = observer.socket.readyState === WebSocket.OPEN;
observer.socket.close(1000, 'test complete');

if (![1008, 1009].includes(close.code)) throw new Error(`Expected policy/message-size close, received ${close.code}`);
if (!observerWasOpen) throw new Error('Healthy observer was unexpectedly disconnected');
if (tickAfter <= tickBefore) throw new Error('The unaffected room did not continue stepping');
if (overBudgetDelta > 0) throw new Error(`The unaffected room added ${overBudgetDelta} over-budget simulation step(s) during the malformed-frame burst`);
console.log(JSON.stringify({
  malformedFramesAttempted: 1000,
  floodDurationMs: Number(burstMs.toFixed(2)),
  abusiveSocketCloseCode: close.code,
  abusiveSocketReason: close.reason,
  unaffectedRoom: 'ace-belt',
  observerTickBefore: tickBefore,
  observerTickAfter: tickAfter,
  unaffectedRoomStepP99BeforeMs: observerRoomBefore?.step.p99Ms ?? null,
  unaffectedRoomStepP99AfterMs: observerRoom?.step.p99Ms ?? null,
  unaffectedRoomOverBudgetDelta: overBudgetDelta,
  result: 'abusive client disconnected; other room continued stepping',
}, null, 2));
