import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../server/package.json', import.meta.url));
const { WebSocket } = require('ws');

const image = process.env.DOCKER_IMAGE ?? 'space-arena:local';
const name = `space-arena-stop-check-${process.pid}`;
const run = (args, options = {}) => spawnSync('docker', args, { encoding: 'utf8', ...options });

function assertDocker(result, step) {
  if (result.error || result.status !== 0) {
    throw new Error(`${step} failed: ${result.stderr || result.error?.message || result.stdout}`);
  }
}

function runDockerStop(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: 'pipe' });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr || `docker ${args.join(' ')} exited ${code}`)));
  });
}

const size = run(['image', 'inspect', '--format={{.Size}}', image]);
assertDocker(size, 'docker image inspect');
const imageBytes = Number(size.stdout.trim());
const imageMb = imageBytes / (1024 * 1024);
console.log(`Image size: ${imageMb.toFixed(1)} MB`);
if (imageBytes >= 200 * 1024 * 1024) throw new Error('Final Docker image must be smaller than 200 MB');

const started = run(['run', '-d', '--name', name, '-p', '127.0.0.1::3000', '-e', 'NODE_ENV=production', '-e', 'ALLOWED_ORIGINS=https://arena.example.invalid', '-e', 'ALLOW_MISSING_ORIGIN=false', '-e', 'BUILD_SHA=docker-stop-test', image]);
assertDocker(started, 'docker run');
let hostPort = '';
let healthy = false;
for (let attempt = 0; attempt < 60; attempt += 1) {
  const port = run(['port', name, '3000/tcp']);
  if (port.status === 0 && port.stdout.trim()) {
    hostPort = port.stdout.trim().split(':').at(-1) ?? '';
    try {
      const response = await fetch(`http://127.0.0.1:${hostPort}/health`);
      if (response.ok) { healthy = true; break; }
    } catch { /* container is still starting */ }
  }
  await delay(250);
}
if (!hostPort || !healthy) throw new Error('Container did not become healthy');
const readyResponse = await fetch(`http://127.0.0.1:${hostPort}/ready`);
if (!readyResponse.ok) throw new Error(`/ready returned ${readyResponse.status}`);

const ws = new WebSocket(`ws://127.0.0.1:${hostPort}/ws`, { origin: 'https://arena.example.invalid' });
let shutdownMessage = false;
let closeCode = null;
let joinedResolve;
const joined = new Promise((resolve) => { joinedResolve = resolve; });
const wsClosed = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('WebSocket did not close during docker stop')), 9000);
  ws.once('open', () => ws.send(JSON.stringify({ type: 'join', roomId: 'rookie-orbit', playerName: 'Docker Stop Check', protocol: 'json' })));
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.type === 'joined') joinedResolve();
      if (message.type === 'shutdown') shutdownMessage = true;
    } catch { /* non-JSON frame is not part of this check */ }
  });
  ws.once('close', (code) => {
    closeCode = code;
    clearTimeout(timer);
    resolve();
  });
  ws.once('error', (error) => {
    clearTimeout(timer);
    reject(error);
  });
});
for (let attempt = 0; attempt < 40 && ws.readyState !== WebSocket.OPEN; attempt += 1) await delay(50);
if (ws.readyState !== WebSocket.OPEN) throw new Error('WebSocket did not open');
await Promise.race([joined, delay(3000).then(() => { throw new Error('WebSocket did not join the seeded room'); })]);
await delay(100);

const stopStarted = performance.now();
const stopping = runDockerStop(['stop', '--time', '10', name]);
await wsClosed;
await stopping;
const stopMs = performance.now() - stopStarted;
const exit = run(['inspect', '--format={{.State.ExitCode}}', name]);
assertDocker(exit, 'docker inspect exit code');
const logs = run(['logs', name]);
if (!shutdownMessage) throw new Error('Client did not receive the shutdown message');
if (closeCode !== 1001) throw new Error(`Expected WebSocket close code 1001, received ${closeCode}`);
if (exit.stdout.trim() !== '0') throw new Error(`Container exit code was ${exit.stdout.trim()}, expected 0`);
if (stopMs >= 10_000) throw new Error(`docker stop took ${(stopMs / 1000).toFixed(2)}s, expected <10s`);
if (!logs.stdout.includes('server_shutdown_complete')) throw new Error('Structured shutdown-complete log was not emitted');
console.log(JSON.stringify({ image, imageMb: Number(imageMb.toFixed(2)), dockerStopMs: Number(stopMs.toFixed(1)), exitCode: 0, websocketShutdownMessage: true, websocketCloseCode: closeCode, shutdownLog: 'present' }, null, 2));
run(['rm', '-f', name]);
