# Lab 01 — Space Arena

JavaScript course project: the first step toward a real-time multiplayer browser game.

## Goal

The project demonstrates:

- JavaScript event loop concepts: call stack, tasks, microtasks and rendering;
- ES modules;
- `let` / `const`, block scope and closures;
- `requestAnimationFrame`;
- a fixed-step simulation using an accumulator;
- interpolation between simulation states during rendering;
- keyboard input implemented as a closure;
- pure ship physics separated from the DOM;
- Canvas 2D rendering with `devicePixelRatio` support;
- wrapping the ship around arena edges;
- three intentionally broken timing experiments.

## Run locally

Requirements: a recent Node.js version compatible with the current Vite release.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Controls

- `WASD` or arrow keys — move the ship.

## Project structure

```text
lab-01-space-arena/
├─ index.html
├─ package.json
├─ eslint.config.js
├─ README.md
└─ src/
   ├─ main.js
   ├─ style.css
   ├─ loop.js
   ├─ input.js
   ├─ physics.js
   ├─ render.js
   └─ experiments.js
```

## Fixed timestep

The browser calls `requestAnimationFrame()` before a repaint. The callback frequency usually follows the display refresh rate, so it may be approximately 60, 75, 120 or 144 times per second.

The game therefore does **not** use the frame rate as the simulation timestep. `createLoop()` accumulates real elapsed time and repeatedly calls:

```js
update(1 / 60);
```

The simulation has one fixed step of `1/60` second. Rendering can happen at another rate. The renderer receives `alpha`, a value from `0` to `1`, and interpolates between the previous and current simulation states.

This separates simulation time from rendering time and prevents game physics from becoming directly dependent on the monitor refresh rate.

## Closure for keyboard input

`createInput()` keeps the pressed-key `Set` private. The returned `snapshot()` function closes over that Set and exposes only the current input state.

`physics.js` does not access `window`, `document` or the Canvas. It receives plain data and returns a new ship state:

```js
integrate(ship, input, dt, arena)
```

This keeps the physics function independent from the DOM.

## Canvas and devicePixelRatio

The Canvas CSS size is used as the logical game size. The backing resolution is multiplied by `window.devicePixelRatio`, and the drawing context is transformed by the same factor. This keeps the ship and grid sharp on high-DPI screens.

## Event loop explanation

JavaScript executes jobs on a main thread. The browser event loop processes tasks, then drains the microtask queue, and then performs rendering when appropriate. Events and timer callbacks such as `setInterval()` are associated with task scheduling, while Promise callbacks are microtasks.

A long synchronous operation blocks the main thread because JavaScript execution is run-to-completion. While it is blocked, input handling, timers and rendering cannot proceed normally.

## Experiments

Run the three experiment buttons in the browser and copy the numbers printed in the result panel into this README.

### 1. Blocking loop inside a frame

**Measured on:** Windows 11, Google Chrome

**Result:**

```text
"blockMsRequested": 500,
  "blockMsActual": 500,
  "nextFrameGapMs": 497.1999999761583,
  "skipped60HzFrames": 28.831999998569497
```

**Explanation:** a synchronous busy loop occupies the main JavaScript thread. While the stack is busy, the browser cannot run the next JavaScript work or perform the normal rendering opportunity. The next `requestAnimationFrame` callback is therefore delayed.

### 2. `setInterval()` instead of `requestAnimationFrame()`

**Measured on:** Windows 11, Google Chrome

**Result:**

```text
"requestedIntervalMs": 16.666666666666668,
  "elapsedMs": 3008.399999976158,
  "callbacks": 188,
  "callbacksPerSecond": 62.49168993534434,
  "averageIntervalMs": 16.00212765944765,
  "minIntervalMs": 14.200000047683716,
  "maxIntervalMs": 17.600000023841858,
  "jitterStdDevMs": 0.6967979514308006
```

**Explanation:** `setInterval()` schedules timer callbacks as tasks. It is not a rendering synchronization mechanism. Its callback may run before or after a repaint and can be delayed when the main thread is busy. `requestAnimationFrame()` is designed specifically to schedule work before the next repaint.

### 3. Variable timestep instead of fixed timestep

The experiment simulates the same acceleration for 2 seconds at different render/update rates.

**Result:**

```text
[
  {
    "renderFps": 30,
    "variablePosition": 203.33333333333337,
    "fixedPosition": 201.66666666666669,
    "variableVelocity": 200.00000000000014,
    "fixedVelocity": 199.99999999999974
  },
  {
    "renderFps": 60,
    "variablePosition": 201.66666666666669,
    "fixedPosition": 201.66666666666669,
    "variableVelocity": 199.99999999999974,
    "fixedVelocity": 199.99999999999974
  },
  {
    "renderFps": 120,
    "variablePosition": 200.83333333333337,
    "fixedPosition": 201.66666666666669,
    "variableVelocity": 200.00000000000054,
    "fixedVelocity": 199.99999999999974
  }
]
```

**Explanation:** with a variable timestep, physics receives different `dt` values depending on how often frames arrive. Numerical integration can therefore produce different states for different frame rates. With a fixed timestep, the simulation advances using the same `1/60` second step regardless of the render rate.

## Lint and build

```bash
npm run lint
npm run build
```

The build should complete without errors, and ESLint should report no errors.

## Lab result

The project implements the first client-side foundation of the semester game: a Canvas-based spaceship controlled by the keyboard, with a fixed 60 Hz simulation, interpolated rendering, performance HUD and timing experiments. The code is split into ES modules so that the game loop, input, physics and rendering can later be reused when networking is added.
