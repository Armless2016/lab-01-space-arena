import './style.css';
import { createInput } from './input.js';
import { createLoop } from './loop.js';
import { createRenderer } from './render.js';
import { runBlockingExperiment, runIntervalExperiment, runVariableStepExperiment } from './experiments.js';
import { World } from './world.js';
import { Ship } from './ship.js';
import { Asteroid } from './asteroid.js';
import { Pickup } from './pickup.js';
import { Vector2 } from './vector2.js';
import { processCollisions } from './collisions.js';
import { runPrototypeExperiment } from './prototype-experiment.js';

const canvas = document.querySelector('#game');
const stepsElement = document.querySelector('#steps');
const framesElement = document.querySelector('#frames');
const frameTimeElement = document.querySelector('#frameTime');
const hpElement = document.querySelector('#hp');
const scoreElement = document.querySelector('#score');
const entitiesElement = document.querySelector('#entities');
const respawnElement = document.querySelector('#respawn');
const outputElement = document.querySelector('#experimentOutput');
const blockingButton = document.querySelector('#blockingBtn');
const intervalButton = document.querySelector('#intervalBtn');
const variableButton = document.querySelector('#variableBtn');
const prototypeButton = document.querySelector('#prototypeBtn');

const renderer = createRenderer(canvas);
const input = createInput();
let size = renderer.getSize();
let player;

const world = new World({
  width: size.width,
  height: size.height,
  playerFactory: () => createPlayer(),
});
world.collisionSystem = processCollisions;

function randomPosition() {
  return new Vector2(
    70 + Math.random() * Math.max(1, size.width - 140),
    70 + Math.random() * Math.max(1, size.height - 140),
  );
}

function createPlayer() {
  return new Ship({
    position: new Vector2(size.width / 2, size.height / 2),
    player: true,
    hp: 100,
  });
}

function spawnInitialWorld() {
  player = createPlayer();
  world.spawn(player);

  const enemyPositions = [
    new Vector2(size.width * 0.78, size.height * 0.28),
    new Vector2(size.width * 0.72, size.height * 0.75),
  ];
  for (const position of enemyPositions) {
    world.spawn(new Ship({ position, angle: Math.PI, hp: 60 }));
  }

  for (let index = 0; index < 8; index += 1) {
    const homing = index === 0;
    const angle = Math.random() * Math.PI * 2;
    world.spawn(
      new Asteroid({
        position: randomPosition(),
        velocity: Vector2.fromAngle(angle, 20 + Math.random() * 45),
        radius: 20 + Math.random() * 12,
        hp: 50,
        homing,
      }),
    );
  }

  world.spawn(new Pickup({
    position: new Vector2(size.width * 0.25, size.height * 0.25),
    type: 'repair',
    amount: 35,
  }));
}

function refreshPlayerReference() {
  const current = world.playerShip;
  if (current) player = current;
}

function setButtonsDisabled(disabled) {
  blockingButton.disabled = disabled;
  intervalButton.disabled = disabled;
  variableButton.disabled = disabled;
  prototypeButton.disabled = disabled;
}

function appendOutput(title, value) {
  outputElement.textContent = `${title}\n${JSON.stringify(value, null, 2)}`;
}

// IMPORTANT: do not pass player.fire directly. This arrow keeps the desired player reference.
input.onPress('Space', () => {
  const currentPlayer = world.playerShip;
  if (currentPlayer) currentPlayer.fire(world);
});

input.onPress('KeyP', () => {
  runPrototypeExperiment(world.playerShip);
});

spawnInitialWorld();
runPrototypeExperiment(player);

const loop = createLoop({
  step: 1 / 60,
  update(dt) {
    size = renderer.getSize();
    world.arena.width = size.width;
    world.arena.height = size.height;
    world.step(dt, input.snapshot());
    refreshPlayerReference();
  },
  render(alpha) {
    renderer.render(world, alpha);
  },
  onStats({ stepsPerSecond, framesPerSecond, frameTimeMs }) {
    stepsElement.textContent = String(stepsPerSecond);
    framesElement.textContent = String(framesPerSecond);
    frameTimeElement.textContent = frameTimeMs.toFixed(2);

    const currentPlayer = world.playerShip;
    hpElement.textContent = currentPlayer ? String(currentPlayer.hp) : '0';
    scoreElement.textContent = String(world.score);
    entitiesElement.textContent = String(world.size);
    respawnElement.textContent = world.respawnTimer === null ? 'Ready' : `${Math.max(0, world.respawnTimer).toFixed(1)} s`;
  },
});

blockingButton.addEventListener('click', async () => {
  setButtonsDisabled(true);
  appendOutput('Running blocking-loop experiment...', {});
  const result = await runBlockingExperiment();
  appendOutput('1. Blocking loop result', result);
  setButtonsDisabled(false);
});

intervalButton.addEventListener('click', async () => {
  setButtonsDisabled(true);
  appendOutput('Running setInterval experiment...', {});
  const result = await runIntervalExperiment();
  appendOutput('2. setInterval result', result);
  setButtonsDisabled(false);
});

variableButton.addEventListener('click', () => {
  setButtonsDisabled(true);
  appendOutput('3. Variable timestep result', runVariableStepExperiment());
  setButtonsDisabled(false);
});

prototypeButton.addEventListener('click', () => {
  const result = runPrototypeExperiment(world.playerShip);
  appendOutput('Prototype chain result (also printed to DevTools console)', result);
});

window.addEventListener('beforeunload', () => {
  loop.stop();
  input.destroy();
  renderer.destroy();
});

loop.start();
