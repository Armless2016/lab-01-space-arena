import './style.css';
import { createInput } from './input.js';
import { createLoop } from './loop.js';
import { integrate } from './physics.js';
import { createRenderer } from './render.js';
import {
  runBlockingExperiment,
  runIntervalExperiment,
  runVariableStepExperiment,
} from './experiments.js';

const canvas = document.querySelector('#game');
const stepsElement = document.querySelector('#steps');
const framesElement = document.querySelector('#frames');
const frameTimeElement = document.querySelector('#frameTime');
const outputElement = document.querySelector('#experimentOutput');
const blockingButton = document.querySelector('#blockingBtn');
const intervalButton = document.querySelector('#intervalBtn');
const variableButton = document.querySelector('#variableBtn');

const renderer = createRenderer(canvas);
const input = createInput();

let ship = {
  x: renderer.getSize().width / 2,
  y: renderer.getSize().height / 2,
  vx: 0,
  vy: 0,
  angle: 0,
};

let previousShip = { ...ship };

const loop = createLoop({
  step: 1 / 60,
  update(dt) {
    previousShip = ship;
    ship = integrate(ship, input.snapshot(), dt, renderer.getSize());
  },
  render(alpha) {
    renderer.render(previousShip, ship, alpha);
  },
  onStats({ stepsPerSecond, framesPerSecond, frameTimeMs }) {
    stepsElement.textContent = String(stepsPerSecond);
    framesElement.textContent = String(framesPerSecond);
    frameTimeElement.textContent = frameTimeMs.toFixed(2);
  },
});

function setButtonsDisabled(disabled) {
  blockingButton.disabled = disabled;
  intervalButton.disabled = disabled;
  variableButton.disabled = disabled;
}

function appendOutput(title, value) {
  outputElement.textContent = `${title}\n${JSON.stringify(value, null, 2)}`;
}

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

window.addEventListener('beforeunload', () => {
  loop.stop();
  input.destroy();
  renderer.destroy();
});

loop.start();
