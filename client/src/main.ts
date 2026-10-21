import './style.css';
import { loadJson, loadAll, parseAssetManifest, describeLoadError, type LoadedAssets } from './asset-loader.ts';
import { createLoadingRenderer } from './render.ts';
import { createAudioSystem } from './audio.ts';
import { gameEvents, listenDetail, type GameEventDetail } from './event-bus.ts';
import { createHud } from './hud.ts';
import { Lobby, type LobbyErrorDetail, type LobbyJoinDetail, type LobbyRoomsDetail } from './lobby.ts';
import { createLobbyView } from './lobby-view.ts';
import { createNetworkGame } from './network-game.ts';
import { runFailureGallery, runMicrotaskPuzzles, runPromiseCombinatorsDemo, measureAssetStrategies } from './diagnostics.ts';
import { ReconnectingSocket, type IncomingMessage, type SocketStateDetail } from './socket-client.ts';

function mustGet<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required page element not found: ${selector}`);
  return element;
}
function formatError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

const canvas = mustGet<HTMLCanvasElement>('#game');
const loadingRenderer = createLoadingRenderer(canvas);
const audio = createAudioSystem();
const bootPanel = mustGet<HTMLElement>('#bootPanel');
const bootText = mustGet<HTMLElement>('#bootText');
const bootError = mustGet<HTMLElement>('#bootError');
const loadGameButton = mustGet<HTMLButtonElement>('#loadGameBtn');
const cancelLoadButton = mustGet<HTMLButtonElement>('#cancelLoadBtn');
const retryButton = mustGet<HTMLButtonElement>('#retryBtn');
const lobbyPanel = mustGet<HTMLElement>('#lobbyPanel');
const lobbyElements = {
  panel: lobbyPanel,
  nameInput: mustGet<HTMLInputElement>('#playerNameInput'),
  roomSelect: mustGet<HTMLSelectElement>('#roomSelect'),
  roomList: mustGet<HTMLElement>('#roomList'),
  joinButton: mustGet<HTMLButtonElement>('#joinBtn'),
};
const leaveLobbyButton = mustGet<HTMLButtonElement>('#leaveLobbyBtn');
const diagnosticsPanel = mustGet<HTMLElement>('#diagnosticsPanel');
const diagnosticOutput = mustGet<HTMLElement>('#diagnosticOutput');
const microtaskButton = mustGet<HTMLButtonElement>('#microtaskBtn');
const timingButton = mustGet<HTMLButtonElement>('#timingBtn');
const controls = mustGet<HTMLElement>('#controls');
const canvasMessage = mustGet<HTMLElement>('#canvasMessage');
const chatPanel = mustGet<HTMLElement>('#chatPanel');
const chatMessages = mustGet<HTMLElement>('#chatMessages');
const chatInput = mustGet<HTMLInputElement>('#chatInput');
const chatSendBtn = mustGet<HTMLButtonElement>('#chatSendBtn');
const socketState = mustGet<HTMLElement>('#socketState');
const protocolSelect = mustGet<HTMLSelectElement>('#protocolSelect');
const networkPanel = mustGet<HTMLElement>('#networkPanel');
const predictionToggle = mustGet<HTMLInputElement>('#predictionToggle');
const nondeterminismToggle = mustGet<HTMLInputElement>('#nondeterminismToggle');
const latencyRange = mustGet<HTMLInputElement>('#latencyRange');
const jitterRange = mustGet<HTMLInputElement>('#jitterRange');
const lossRange = mustGet<HTMLInputElement>('#lossRange');
const latencyValue = mustGet<HTMLElement>('#latencyValue');
const jitterValue = mustGet<HTMLElement>('#jitterValue');
const lossValue = mustGet<HTMLElement>('#lossValue');
const leaveRoomButton = mustGet<HTMLButtonElement>('#leaveRoomBtn');
const netStats = {
  rtt: mustGet<HTMLElement>('#netRtt'), age: mustGet<HTMLElement>('#netAge'), bytes: mustGet<HTMLElement>('#netBytes'),
  queue: mustGet<HTMLElement>('#netQueue'), correction: mustGet<HTMLElement>('#netCorrection'), dropped: mustGet<HTMLElement>('#netDropped'),
  protocol: mustGet<HTMLElement>('#netProtocol'),
};
const hud = createHud({
  root: mustGet<HTMLElement>('#hud'), playerName: mustGet<HTMLElement>('#playerName'), roomName: mustGet<HTMLElement>('#roomName'),
  hp: mustGet<HTMLElement>('#hp'), score: mustGet<HTMLElement>('#score'), entities: mustGet<HTMLElement>('#entities'),
  steps: mustGet<HTMLElement>('#steps'), frames: mustGet<HTMLElement>('#frames'), frameTime: mustGet<HTMLElement>('#frameTime'),
  audioState: mustGet<HTMLElement>('#audioState'),
});

const lobbyView = createLobbyView(lobbyElements);
const lobby = new Lobby();
const socketClient = new ReconnectingSocket();
let game: ReturnType<typeof createNetworkGame> | null = null;
let assets: LoadedAssets | null = null;
let loadController: AbortController | null = null;

function setBootMessage(text: string, isError = false): void {
  bootText.textContent = text;
  canvasMessage.textContent = isError ? 'Asset loading failed' : '';
  canvasMessage.classList.toggle('error', isError);
}

async function bootAssets(): Promise<void> {
  const controller = new AbortController();
  loadController = controller;
  loadGameButton.hidden = true;
  retryButton.hidden = true;
  cancelLoadButton.hidden = false;
  bootError.hidden = true;
  loadingRenderer.draw({ progress: 0, label: 'Loading manifest...' });
  try {
    const manifest = parseAssetManifest(await loadJson('/assets/manifest.json', { signal: controller.signal, retries: 3 }));
    setBootMessage('Loading images, audio and room metadata...');
    const loaded = await loadAll(manifest, {
      signal: controller.signal,
      audioContext: await audio.unlock(),
      onProgress: ({ completed, total, current }) => {
        loadingRenderer.draw({ progress: total > 0 ? completed / total : 0, label: current ? `Loaded: ${current}` : 'Starting...' });
      },
    });
    assets = loaded;
    audio.setBuffer('fire', loaded.fire);
    audio.setBuffer('hit', loaded.hit);
    audio.setBuffer('explosion', loaded.explosion);
    audio.setBuffer('pickup', loaded.pickupSound);
    loadingRenderer.draw({ progress: 1, label: 'Assets ready' });
    bootPanel.hidden = true;
    diagnosticsPanel.hidden = false;
    lobbyPanel.hidden = false;
    lobbyView.show();
    await lobby.start();
    hud.setAudioState(audio.state);
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      setBootMessage('Loading cancelled. Press Retry to start again.');
    } else {
      setBootMessage('Loading failed. Press Retry to try again.', true);
      bootError.textContent = formatError(error);
      bootError.hidden = false;
    }
    loadingRenderer.draw({ progress: 0, label: describeLoadError(error), error: true });
    loadGameButton.hidden = true;
    cancelLoadButton.hidden = true;
    retryButton.hidden = false;
  } finally {
    if (loadController === controller) loadController = null;
  }
}

loadGameButton.addEventListener('click', () => { void bootAssets(); });
cancelLoadButton.addEventListener('click', () => { loadController?.abort(new DOMException('Loading cancelled by player', 'AbortError')); });
retryButton.addEventListener('click', () => { void bootAssets(); });

listenDetail<LobbyRoomsDetail>(lobby, 'rooms', (detail) => lobbyView.setRooms(detail.rooms));
listenDetail<LobbyErrorDetail>(lobby, 'error', ({ error }) => { diagnosticOutput.textContent = `Lobby error handled: ${formatError(error)}`; });
listenDetail<LobbyJoinDetail>(lobby, 'join', (detail) => startLocalGame(detail));
lobbyElements.joinButton.addEventListener('click', () => lobby.join(lobbyView.selectedRoomId, lobbyView.playerName));

function leaveRoom(): void {
  game?.stop(); game = null;
  controls.hidden = true; chatPanel.hidden = true; networkPanel.hidden = true; diagnosticsPanel.hidden = false;
  socketClient.close(); hud.hide(); lobbyPanel.hidden = false; void lobby.start();
}
leaveLobbyButton.addEventListener('click', leaveRoom);
leaveRoomButton.addEventListener('click', leaveRoom);

function addChatLine(text: string, className = ''): void {
  const line = document.createElement('div');
  line.className = `chat-line ${className}`.trim(); line.textContent = text;
  chatMessages.append(line); chatMessages.scrollTop = chatMessages.scrollHeight;
}

listenDetail<SocketStateDetail>(socketClient, 'state', ({ state, delay, reason }) => {
  socketState.textContent = state === 'reconnecting' ? `reconnecting in ${Math.round(delay ?? 0)} ms` : state;
  if (state === 'closed' && reason) addChatLine(`Socket closed: ${reason}`, 'system');
});

listenDetail<IncomingMessage>(socketClient, 'message', (message) => {
  if (message.type === 'joined') {
    game?.stop();
    hud.setPlayer(lobbyView.playerName); hud.setRoom(message.room.name || 'Room');
    networkPanel.hidden = false; diagnosticsPanel.hidden = true;
    const currentAssets = assets;
    if (!currentAssets) { addChatLine('Assets have not finished loading.', 'system'); return; }
    game = createNetworkGame({
      canvas, assets: currentAssets, room: message.room, playerId: message.playerId, seed: message.seed,
      initialSnapshot: message.snapshot, socketClient, protocol: message.protocol || protocolSelect.value,
      playerNames: message.players,
      getNetworkSettings: () => ({
        prediction: predictionToggle.checked, injectNondeterminism: nondeterminismToggle.checked,
        latency: Number(latencyRange.value), jitter: Number(jitterRange.value), loss: Number(lossRange.value),
      }),
      onStats: (stats) => {
        hud.updateNetwork(stats); hud.setAudioState(audio.state);
        netStats.rtt.textContent = `${stats.rttMs.toFixed(1)} ms`;
        netStats.age.textContent = `${stats.snapshotAgeMs.toFixed(1)} ms`;
        netStats.bytes.textContent = `${Math.round(stats.bytesPerSecond)} B/s`;
        netStats.queue.textContent = String(stats.inputQueue);
        netStats.correction.textContent = `${stats.correctionPx.toFixed(1)} px`;
        netStats.dropped.textContent = String(stats.droppedPackets);
        netStats.protocol.textContent = stats.protocol;
      },
      onLeave: () => leaveRoomButton.click(),
    });
    game.start(); addChatLine(`Joined ${message.room.name || 'room'} as player #${message.playerId}`, 'system');
  }
  if (game && (message.type === 'snapshot' || message.type === 'players')) game.handleServerMessage(message, message.__transportBytes ?? 0);
  if (message.type === 'chat') addChatLine(`${message.playerName}: ${message.message}`);
  if (message.type === 'system') addChatLine(message.text, 'system');
  if (message.type === 'error') addChatLine(`Server error: ${message.code}`, 'system');
});

chatSendBtn.addEventListener('click', () => {
  const message = chatInput.value.trim(); if (!message) return;
  socketClient.send({ type: 'chat', message }); chatInput.value = ''; chatInput.focus();
});
chatInput.addEventListener('keydown', (event: KeyboardEvent) => { if (event.key === 'Enter') chatSendBtn.click(); });

function startLocalGame({ room, playerName }: LobbyJoinDetail): void {
  lobby.stop(); lobbyPanel.hidden = true; hud.show(); controls.hidden = false; chatPanel.hidden = false; networkPanel.hidden = true;
  chatMessages.replaceChildren(); hud.setPlayer(playerName); hud.setRoom(room.name); socketClient.connect(); socketClient.join(room.id, playerName, protocolSelect.value);
}

listenDetail<GameEventDetail>(gameEvents, 'fired', () => audio.play('fire', { volume: 0.12, rate: 0.94 + Math.random() * 0.12 }));
listenDetail<GameEventDetail>(gameEvents, 'hit', (detail) => {
  const damage = typeof detail.damage === 'number' ? detail.damage : 1;
  audio.play(damage < 0 ? 'pickup' : 'hit', { volume: damage < 0 ? 0.18 : 0.1 });
});
listenDetail<GameEventDetail>(gameEvents, 'exploded', () => audio.play('explosion', { volume: 0.16, rate: 0.9 + Math.random() * 0.2 }));
listenDetail<GameEventDetail>(gameEvents, 'pickup', () => audio.play('pickup', { volume: 0.2, rate: 1.05 + Math.random() * 0.15 }));
listenDetail<GameEventDetail>(gameEvents, 'respawned', () => audio.play('pickup', { volume: 0.16, rate: 1.15 }));

for (const button of diagnosticsPanel.querySelectorAll<HTMLButtonElement>('[data-failure]')) {
  button.addEventListener('click', async () => {
    const kind = button.dataset.failure ?? 'unknown';
    diagnosticOutput.textContent = `Running ${kind}...`;
    const result = await runFailureGallery(kind); const combinators = await runPromiseCombinatorsDemo();
    diagnosticOutput.textContent = [JSON.stringify(result, null, 2), '', 'Promise combinators demo:', JSON.stringify(combinators, null, 2)].join('\n');
  });
}

timingButton.addEventListener('click', async () => {
  timingButton.disabled = true; diagnosticOutput.textContent = 'Measuring sequential await vs concurrent Promise.all...';
  try {
    const manifest = parseAssetManifest(await loadJson('/assets/manifest.json', { retries: 0 }));
    const result = await measureAssetStrategies(manifest, await audio.unlock());
    diagnosticOutput.textContent = `Asset loading timing\n${JSON.stringify(result, null, 2)}\n\nRun this again if you want a fresh measurement for README.`;
  } catch (error: unknown) { diagnosticOutput.textContent = formatError(error); }
  finally { timingButton.disabled = false; }
});
microtaskButton.addEventListener('click', async () => {
  microtaskButton.disabled = true; diagnosticOutput.textContent = 'Running five microtask puzzles...';
  try {
    const results = await runMicrotaskPuzzles();
    diagnosticOutput.textContent = results.map((result) => `${result.name}\n${result.output.join(' → ')}\n${result.explanation}`).join('\n\n');
  } finally { microtaskButton.disabled = false; }
});

function updateNetworkControlLabels(): void {
  latencyValue.textContent = `${latencyRange.value} ms`; jitterValue.textContent = `${jitterRange.value} ms`; lossValue.textContent = `${lossRange.value}%`;
}
for (const control of [latencyRange, jitterRange, lossRange]) control.addEventListener('input', updateNetworkControlLabels);
updateNetworkControlLabels();
window.addEventListener('beforeunload', () => { lobby.stop(); game?.stop(); socketClient.close(); loadController?.abort(new DOMException('Page closed', 'AbortError')); });
hud.hide();
loadingRenderer.draw({ progress: 0, label: 'Click “Enable audio & load game” to begin.' });
