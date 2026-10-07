import './style.css';
import { loadJson, loadAll } from './asset-loader.js';
import { createLoadingRenderer } from './render.js';
import { createAudioSystem } from './audio.js';
import { gameEvents } from './event-bus.js';
import { createHud } from './hud.js';
import { Lobby } from './lobby.js';
import { createLobbyView } from './lobby-view.js';
import { createGame } from './game.js';
import { runFailureGallery, runMicrotaskPuzzles, runPromiseCombinatorsDemo, measureAssetStrategies } from './diagnostics.js';
import { ReconnectingSocket } from './socket-client.js';

const canvas = document.querySelector('#game');
const loadingRenderer = createLoadingRenderer(canvas);
const audio = createAudioSystem();

const bootPanel = document.querySelector('#bootPanel');
const bootText = document.querySelector('#bootText');
const bootError = document.querySelector('#bootError');
const loadGameButton = document.querySelector('#loadGameBtn');
const cancelLoadButton = document.querySelector('#cancelLoadBtn');
const retryButton = document.querySelector('#retryBtn');
const lobbyPanel = document.querySelector('#lobbyPanel');
const lobbyElements = {
  panel: lobbyPanel,
  nameInput: document.querySelector('#playerNameInput'),
  roomSelect: document.querySelector('#roomSelect'),
  roomList: document.querySelector('#roomList'),
  joinButton: document.querySelector('#joinBtn'),
};
const leaveLobbyButton = document.querySelector('#leaveLobbyBtn');
const diagnosticsPanel = document.querySelector('#diagnosticsPanel');
const diagnosticOutput = document.querySelector('#diagnosticOutput');
const microtaskButton = document.querySelector('#microtaskBtn');
const timingButton = document.querySelector('#timingBtn');
const controls = document.querySelector('#controls');
const canvasMessage = document.querySelector('#canvasMessage');
const chatPanel = document.querySelector('#chatPanel');
const chatMessages = document.querySelector('#chatMessages');
const chatInput = document.querySelector('#chatInput');
const chatSendBtn = document.querySelector('#chatSendBtn');
const socketState = document.querySelector('#socketState');

const hud = createHud({
  root: document.querySelector('#hud'),
  playerName: document.querySelector('#playerName'),
  roomName: document.querySelector('#roomName'),
  hp: document.querySelector('#hp'),
  score: document.querySelector('#score'),
  entities: document.querySelector('#entities'),
  steps: document.querySelector('#steps'),
  frames: document.querySelector('#frames'),
  frameTime: document.querySelector('#frameTime'),
  audioState: document.querySelector('#audioState'),
});

const lobbyView = createLobbyView(lobbyElements);
const lobby = new Lobby();
const socketClient = new ReconnectingSocket();
let game = null;
let assets = null;
let loadController = null;

function setBootMessage(text, isError = false) {
  bootText.textContent = text;
  canvasMessage.textContent = isError ? 'Asset loading failed' : '';
  canvasMessage.classList.toggle('error', isError);
}

async function bootAssets() {
  loadController = new AbortController();
  loadGameButton.hidden = true;
  retryButton.hidden = true;
  cancelLoadButton.hidden = false;
  bootError.hidden = true;
  loadingRenderer.draw({ progress: 0, label: 'Loading manifest...' });

  try {
    const manifest = await loadJson('/assets/manifest.json', {
      signal: loadController.signal,
      retries: 3,
    });

    setBootMessage('Loading images, audio and room metadata...');
    const loaded = await loadAll(manifest, {
      signal: loadController.signal,
      audioContext: await audio.unlock(),
      onProgress({ completed, total, current }) {
        const progress = total > 0 ? completed / total : 0;
        loadingRenderer.draw({
          progress,
          label: current ? `Loaded: ${current}` : 'Starting...',
        });
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
  } catch (error) {
    if (loadController.signal.aborted) {
      setBootMessage('Loading cancelled. Press Retry to start again.');
    } else {
      setBootMessage('Loading failed. Press Retry to try again.', true);
      bootError.textContent = `${error.name}: ${error.message}`;
      bootError.hidden = false;
    }
    loadingRenderer.draw({ progress: 0, label: error.message, error: true });
    loadGameButton.hidden = true;
    cancelLoadButton.hidden = true;
    retryButton.hidden = false;
  } finally {
    loadController = null;
  }
}

loadGameButton.addEventListener('click', () => {
  void bootAssets();
});

cancelLoadButton.addEventListener('click', () => {
  loadController?.abort(new DOMException('Loading cancelled by player', 'AbortError'));
});

retryButton.addEventListener('click', () => {
  void bootAssets();
});

lobby.addEventListener('rooms', (event) => {
  lobbyView.setRooms(event.detail.rooms);
});

lobby.addEventListener('error', (event) => {
  diagnosticOutput.textContent = `Lobby error handled: ${event.detail.error?.message ?? 'unknown error'}`;
});

lobby.addEventListener('join', (event) => {
  startLocalGame(event.detail);
});

lobbyElements.joinButton.addEventListener('click', () => {
  lobby.join(lobbyView.selectedRoomId, lobbyView.playerName);
});

leaveLobbyButton.addEventListener('click', () => {
  game?.stop();
  game = null;
  controls.hidden = true;
  chatPanel.hidden = true;
  socketClient.close();
  hud.hide();
  lobbyPanel.hidden = false;
  void lobby.start();
});

function addChatLine(text, className = '') {
  const line = document.createElement('div');
  line.className = `chat-line ${className}`.trim();
  line.textContent = text;
  chatMessages.append(line);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

socketClient.addEventListener('state', (event) => {
  const { state, delay, reason } = event.detail;
  socketState.textContent = state === 'reconnecting' ? `reconnecting in ${Math.round(delay)} ms` : state;
  if (state === 'closed' && reason) addChatLine(`Socket closed: ${reason}`, 'system');
});

socketClient.addEventListener('message', (event) => {
  const message = event.detail;
  if (message.type === 'chat') addChatLine(`${message.playerName}: ${message.message}`);
  if (message.type === 'system') addChatLine(message.text, 'system');
  if (message.type === 'error') addChatLine(`Server error: ${message.code}`, 'system');
});

chatSendBtn.addEventListener('click', () => {
  const message = chatInput.value.trim();
  if (!message) return;
  socketClient.send({ type: 'chat', message });
  chatInput.value = '';
  chatInput.focus();
});

chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') chatSendBtn.click();
});

function startLocalGame({ room, playerName }) {
  lobby.stop();
  lobbyPanel.hidden = true;
  hud.show();
  controls.hidden = false;
  chatPanel.hidden = false;
  chatMessages.replaceChildren();
  hud.setPlayer(playerName);
  hud.setRoom(room.name);
  socketClient.connect();
  socketClient.join(room.id, playerName);

  game = createGame({
    canvas,
    assets,
    room,
    playerName,
    onLeave: () => {
      leaveLobbyButton.click();
    },
    onStats: (stats) => {
      if (game) hud.update(game.world, stats);
      hud.setAudioState(audio.state);
    },
  });
  game.start();
}

gameEvents.addEventListener('fired', () => {
  audio.play('fire', { volume: 0.12, rate: 0.94 + Math.random() * 0.12 });
});

gameEvents.addEventListener('hit', (event) => {
  const damage = event.detail.damage;
  audio.play(damage < 0 ? 'pickup' : 'hit', { volume: damage < 0 ? 0.18 : 0.1 });
});

gameEvents.addEventListener('exploded', () => {
  audio.play('explosion', { volume: 0.16, rate: 0.9 + Math.random() * 0.2 });
});

gameEvents.addEventListener('respawned', () => {
  audio.play('pickup', { volume: 0.16, rate: 1.15 });
});

for (const button of diagnosticsPanel.querySelectorAll('[data-failure]')) {
  button.addEventListener('click', async () => {
    const kind = button.dataset.failure;
    diagnosticOutput.textContent = `Running ${kind}...`;
    const result = await runFailureGallery(kind);
    const combinators = await runPromiseCombinatorsDemo();
    diagnosticOutput.textContent = [
      JSON.stringify(result, null, 2),
      '',
      'Promise combinators demo:',
      JSON.stringify(combinators, null, 2),
    ].join('\n');
  });
}


timingButton.addEventListener('click', async () => {
  timingButton.disabled = true;
  diagnosticOutput.textContent = 'Measuring sequential await vs concurrent Promise.all...';
  try {
    const result = await measureAssetStrategies(await loadJson('/assets/manifest.json', { retries: 0 }), await audio.unlock());
    diagnosticOutput.textContent = `Asset loading timing\n${JSON.stringify(result, null, 2)}\n\nRun this again if you want a fresh measurement for README.`;
  } catch (error) {
    diagnosticOutput.textContent = `${error.name}: ${error.message}`;
  } finally {
    timingButton.disabled = false;
  }
});

microtaskButton.addEventListener('click', async () => {
  microtaskButton.disabled = true;
  diagnosticOutput.textContent = 'Running five microtask puzzles...';
  try {
    const results = await runMicrotaskPuzzles();
    diagnosticOutput.textContent = results.map((result) => `${result.name}\n${result.output.join(' → ')}\n${result.explanation}`).join('\n\n');
  } finally {
    microtaskButton.disabled = false;
  }
});

window.addEventListener('beforeunload', () => {
  lobby.stop();
  game?.stop();
  socketClient.close();
  loadController?.abort(new DOMException('Page closed', 'AbortError'));
});

hud.hide();
loadingRenderer.draw({ progress: 0, label: 'Click “Enable audio & load game” to begin.' });
