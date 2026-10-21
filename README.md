# Space Arena — JavaScript Semester Project

Labs 01–06 build one browser multiplayer game step by step. The client is in `client/`, the Node.js server in `server/`, and **the deterministic simulation and wire codecs shared by both runtimes are in `shared/`**.

## Lab 05 — Server-authoritative multiplayer, prediction and binary protocol

### What changed in Lab 05

- The Node.js server owns the world simulation. Clients send only `{ seq, throttle, turn, fire }`; the server rejects input objects with extra properties such as `x`, `y`, `position` or `coordinates`.
- The simulation is in `shared/simulation.ts`. It contains no DOM access, Node imports, `Date.now()` or `Math.random()`. Both Node and the browser import the same integration functions. The asteroid field uses a seeded PRNG initialized from a deterministic room seed.
- Every room runs at **30 fixed simulation steps/s** (`dt = 1/30`). The scheduler uses a monotonic `performance.now()` deadline and recursive `setTimeout`, not `setInterval`. If the process falls too far behind it caps catch-up work instead of running an unbounded spiral.
- Every input has a monotonically increasing `seq`. Each personalized snapshot includes `ackSeq`, the last input sequence applied by the server for that player.
- The client has a baseline mode (prediction disabled) and client prediction + reconciliation. When prediction is enabled, it integrates the player's controls immediately; after a snapshot it replaces its state with the authoritative state and replays inputs newer than `ackSeq`. The remaining visual offset decays smoothly; the exponential correction leaves about 5% of the offset after roughly 100 ms.
- Other ships are rendered from snapshots about **100 ms in the past**, interpolated between adjacent snapshots. The local ship's projectiles are created immediately on the client; remote projectiles come from the server state.
- A network diagnostics panel displays RTT, snapshot age, traffic in bytes/s, unacknowledged input queue length, correction distance, dropped packets and protocol mode.
- Artificial network conditions can be changed while playing: simulated RTT, jitter and packet loss. The configured RTT is split between client-to-server and server-to-client delay. A seeded client PRNG derived from the server-provided room seed and player ID makes the artificial delay/jitter/loss demonstration repeatable.
- The protocol selector supports binary and JSON modes. JSON is retained as a comparison baseline. An opt-in fault-injection checkbox adds `Math.random()` noise only to the client prediction after integration; correction distance grows, and unchecking it restores deterministic prediction without contaminating the shared server simulation.

## Gameplay systems kept in the Lab 05 authoritative simulation

- **Enemy ships:** each room spawns red-tinted enemy ships from its `enemies` room setting. Their deterministic AI steers toward the nearest live player and fires server-side bullets; enemy health, projectiles and respawn state are carried in snapshots.
- **Pickups:** three seeded green repair pickups are spawned by default. Their collision radius is deliberately generous to match the visible sprite. The server detects circle-circle overlap (including across wrapped arena edges), heals up to 35 HP, deactivates the pickup for five seconds, and then respawns it. A full-health player still collects it and receives a small score bonus instead of passing through invisibly.
- **Asteroid destruction:** asteroids have visible HP bars and do not have a time-to-live. Mere contact with a ship and enemy fire do not destroy asteroids; player projectiles damage them. A large asteroid takes two standard hits and splits into two smaller fragments; fragments have their own HP and disappear only after the player shoots them.
- **Homing fire:** every fifth shot homes deterministically toward the nearest valid target. Homing is part of the shared simulation, and the binary frame carries the homing flag so JSON and binary mode preserve the same gameplay.
- **Effects/audio:** the client renders local cosmetic particles when an asteroid or ship is destroyed and emits the existing Lab 03 Web Audio events for firing, impacts, pickups, explosions and respawns. Cosmetic particles never alter server state.

## Project structure

```text
.
├── client/
│   ├── public/assets/             # Existing Lab 03 sprites and audio
│   ├── src/
│   │   ├── main.ts                # Typed app entry and lobby wiring
│   │   ├── network-game.ts        # Prediction, reconciliation, interpolation, netgraph
│   │   ├── socket-client.ts       # Reconnecting WebSocket wrapper + binary frames
│   │   └── ...                    # Typed loading, audio, HUD and socket modules
│   ├── index.html
│   └── vite.config.ts             # /api and /ws proxy to Node
├── server/
│   ├── src/
│   │   ├── rooms.ts               # Room state and target-time 30 Hz scheduler
│   │   ├── ws-server.ts           # Input validation and snapshots
│   │   └── ...                    # Labs 04 HTTP, stream logging and config
│   ├── examples/shared-smoke.ts   # Test the pure simulation and codecs
│   └── bench/protocol-size.ts     # JSON vs binary payload measurement
├── shared/
│   ├── simulation.ts              # Same deterministic simulation in Node and browser
│   ├── protocol.ts                # ArrayBuffer + DataView encoders/decoders
│   ├── types.ts                   # Branded IDs, inputs and discriminated snapshot entities
│   ├── schemas.ts                 # Zod runtime validation and inferred message types
│   ├── vector2.ts                 # Readonly, immutable vector value
│   └── package.json
├── docs/
│   ├── rss-backpressure.svg
│   └── two-window-demo.gif        # Schematic placeholder; replace with real recording
├── tsconfig.json                  # strict TS + noUncheckedIndexedAccess
└── .github/workflows/ci.yml       # typecheck + deterministic test + build
```

## Run locally

Use a current Node.js LTS release. At the repository root:

```bash
npm install
npm run dev
```

This starts Vite and the Node server. Open `http://localhost:5173/`. Click through the asset-loading step and choose a room in the lobby. Open a **second browser window** at the same address, enter a different name and join the **same room**. Use WASD/arrow keys to steer and Space to fire.

Useful commands from the root:

```bash
npm run typecheck
npm run test:shared
npm run bench:protocol
npm run lint
npm run build
```

Production flow:

```bash
npm run build
npm start
```

## Input and snapshot rules

The client never sends its coordinates. For example, an input message is:

```json
{ "type": "input", "seq": 42, "throttle": 1, "turn": -1, "fire": true }
```

The server validates type, shape, sequence and control ranges. The `shared` module integrates players, enemy AI, homing bullets, asteroids and pickups using the server's fixed `dt`. A server snapshot includes players, enemies, bullets, asteroids, pickups and `ackSeq`. Coordinates are never accepted from the client.

### Prediction and reconciliation

1. The client samples keyboard controls at 30 Hz, increments `seq`, saves that input in a pending-input history and sends it to the server.
2. With **prediction enabled**, the client runs `integrateShip()` immediately so the local ship does not wait for a round trip.
3. When a snapshot arrives, the client measures RTT from the acknowledged input's send time, installs the server's local-ship state, removes inputs with `seq <= ackSeq`, and replays the rest in order.
4. The difference between the previous displayed position and the replayed position becomes a correction offset. That offset fades over approximately 100 ms rather than snapping instantly.
5. If prediction is unchecked, the local ship is drawn from snapshots instead. Set simulated RTT to 100 ms and compare both modes to see the input delay directly.

### Remote interpolation

The client stores a short buffer of timestamped snapshots. To draw remote ships, it targets a render time 100 ms behind the latest local receive time and interpolates positions and angles between the two snapshots surrounding that time. A small buffer is intentional: it gives the next snapshot time to arrive under typical jitter. More interpolation delay looks smoother but makes remote motion older; less delay is more responsive but more likely to extrapolate or visibly step when packets arrive late.

## Binary protocol: `ArrayBuffer` and `DataView`

All multi-byte fields are **little-endian**. The current version byte is `3`; JSON snapshot records include a literal `kind` discriminator (`ship`, `enemy`, `bullet`, `asteroid`, `pickup`). In binary, the section/count identifies the record kind and the decoder restores that `kind` field. The second byte is the frame type (`1` input, `2` snapshot). A signed 16-bit angle maps `[-π, π]` to `[-32767, 32767]`.

**Input frame (9 bytes)**

| Offset | Field | Encoding |
|---:|---|---|
| 0 | version | `uint8` |
| 1 | type = input | `uint8` |
| 2 | sequence | `uint32`, little-endian |
| 6 | throttle | `int8`, scaled by 127 |
| 7 | turn | `int8`, scaled by 127 |
| 8 | flags; bit 0 = fire | `uint8` |

**Snapshot frame (23-byte header, then fixed-size records)**

| Offset | Field | Encoding |
|---:|---|---|
| 0 | version | `uint8` |
| 1 | type = snapshot | `uint8` |
| 2 | server tick | `uint32`, little-endian |
| 6 | acknowledged input sequence | `uint32`, little-endian |
| 10 | arena width | `uint16`, little-endian |
| 12 | arena height | `uint16`, little-endian |
| 14 | server timestamp for age telemetry | `uint32`, little-endian |
| 18 | player count | `uint8` |
| 19 | bullet count | `uint8` |
| 20 | asteroid count | `uint8` |
| 21 | pickup count | `uint8` |
| 22 | enemy count | `uint8` |

After the header: player and enemy records are 30 bytes each; bullet records are 27 bytes; asteroid records are 30 bytes; pickup records are 15 bytes. Ship records include hp/maxHp, score, cooldown and shots fired. Bullets include velocity, TTL and the homing flag. Asteroids include velocity, angle, angular velocity, radius and hp/maxHp. Pickups include position, radius and active state. `shared/protocol.ts` checks the version/type and verifies that the frame length exactly matches the counts in the header. Server simulation state never depends on the binary representation; JSON and binary carry the same snapshot information.

## JSON vs binary measurement

Run `npm run bench:protocol` to repeat the comparison on a deterministic sample (2 players, 2 enemy ships, 12 asteroids, 3 pickups and 2 bullets). One run of the included sample produced:

| Payload | JSON | Binary | Reduction |
|---|---:|---:|---:|
| One input | 62 bytes | 9 bytes | 85.5% |
| One snapshot sample (with kind-discriminated entities) | 4,472 bytes | 602 bytes | 86.5% |

These numbers are for this specific sample and field set, not a promise that every possible game state has the same ratio. JSON remains available via the **Network protocol** selector in the lobby so the two representations can be compared in the same game.

## Network test procedure and GIF

1. Run `npm run dev` and open `http://localhost:5173/` in two separate browser windows (or one regular and one private window).
2. Enable audio/load assets in both, choose different player names, choose the same room, and click **Join** in both.
3. In both windows select binary protocol for the default test. Move and fire; the other ship should be visible in the same arena.
4. Set simulated RTT to 100 ms. Turn prediction off and move to demonstrate delayed control response; turn it back on and observe immediate local movement plus reconciliation. Enable “Inject Math.random() drift” briefly: correction distance should grow because the client estimate no longer follows the shared deterministic integration. Disable it after observing the effect. Try jitter 60 ms and packet loss 5–10% to see input queue and dropped-packet counters respond.
5. Record both live windows with a screen recorder such as ScreenToGif, and replace `docs/two-window-demo.gif` with that real recording before final submission.

![Two-client preview — schematic placeholder, replace with a live capture](docs/two-window-demo.gif)

The included GIF is intentionally marked as a **schematic placeholder**, not a recording of a running browser session. The submitted README should contain your own live two-window recording after you perform the steps above.

## Experiment note: latency, divergence, cheating and interpolation

**Latency and prediction.** Without prediction, local controls affect the displayed ship only when a server snapshot returns, so the perceived delay grows with network round-trip time. Prediction applies the same fixed-step integration to local input immediately. It feels more responsive, but the client is only estimating: the server remains authoritative. A snapshot can disagree with the estimate because of latency, packet loss, input quantization, a different acknowledged sequence or an implementation bug. Reconciliation replaces the local estimate with the authoritative state and replays only unacknowledged inputs; a smoothed correction hides small differences without allowing the client to decide the official position.

**Determinism and divergence.** `shared/simulation.ts` is deliberately free of `Math.random()` and `Date.now()`. Arena randomness is produced from a seed generated by the server and sent with the join response, and simulation advances only in fixed 1/30-second steps. The optional `Math.random()` fault is isolated to the client-side prediction view and must be unchecked for normal play. Both environments use the same integration function and quantized binary controls. This reduces divergence; it does not make a client trusted. Rendering, network arrival times and prediction correction may still differ, so the server's snapshot is the final truth.

**Cheats.** Accepting coordinates from the client would allow a modified client to teleport, move faster, ignore collisions or claim hits that did not happen. The server therefore accepts controls only and calculates positions, bullets, hits and score itself. The client can lie about its local display, but it cannot make the server accept an arbitrary position through the input protocol. Server-side rate limits and bounds checks remain necessary in a production game.

**Interpolation choice.** Remote ships are rendered 100 ms behind the latest received snapshot. This gives a buffer of about three 30 Hz ticks for normal jitter, allowing motion to be interpolated instead of jumping from snapshot to snapshot. A larger buffer can look smoother on unstable links but makes opponents visibly older; a smaller buffer looks more current but increases visible stepping when snapshots arrive late. The selected 100 ms is a deliberate compromise for this lab and can be changed via `INTERPOLATION_DELAY_MS` in `client/src/network-game.ts`.

## Labs 01–05 retained

- **Lab 01:** Vite, modules, Canvas/DPR, closure-based input, fixed timestep, interpolation, HUD and event-loop experiments.
- **Lab 02:** `Vector2`, `Entity`, `Ship extends Entity`, `Map` world, bullets, collisions, `this`, prototype chain and composition.
- **Lab 03:** Promise-based asset pipeline, cancellation/retry, loading screen, lobby, Web Audio, event bus and microtask puzzles.
- **Lab 04:** Node HTTP, `EventEmitter` rooms, WebSocket chat, input validation, streams/backpressure and streamed match logs.
- **Lab 05:** Server-authoritative deterministic simulation, prediction/reconciliation, remote interpolation, JSON/binary protocols, network diagnostics, enemy ships, pickups, asteroid fragments and audio effects.

## Submission — Lab 05

After verifying both windows and completing your live GIF, from the repository root:

```bash
git add .
git commit -m "lab-05: authoritative simulation prediction and binary protocol"
git push origin main
git tag lab-05
git push origin lab-05
```

Submit the URL of the same public GitHub repository used for Labs 01–05. The required new tag is `lab-05`.


## Lab 06 — TypeScript for protocol and simulation

Lab 06 keeps the existing gameplay and converts the shared simulation/protocol plus the active client and server paths to TypeScript. It does not replace the Canvas renderer or add a UI framework: the goal is to make the network boundary and deterministic simulation safer while preserving the Lab 1–5 behaviour.

### What is typed

- `shared/types.ts` defines the shared contracts for controls, ships, bullets, asteroids, pickups and snapshots. Vector-like inputs use `readonly` coordinates, so callers cannot accidentally mutate a value through the interface.
- `EntityId`, `StepNumber` and `InputSeq` are branded numbers. They are all numbers at runtime, but TypeScript rejects accidentally passing an input sequence where an entity ID is required. The three brand constructors are the only branded casts. There are four type assertions in the active client/shared/server source total: those three constructors plus one documented `CustomEvent` detail boundary.
- Messages form discriminated unions using the `type` field (`input`, `snapshot`, `joined`, `chat`, and so on); simulation entities/snapshots have distinct shapes and the shared entity-kind union. Switch statements that need to handle all variants use `assertNever`/a `never` assignment so adding a new variant triggers a compile-time error until it is handled.
- `shared/schemas.ts` uses Zod schemas as the source of runtime validation and inferred types. The WebSocket entry point accepts untrusted data as `unknown`, checks JSON before dispatch, and closes/logs malformed messages rather than assuming that TypeScript types validate external data.
- `shared/protocol.ts` checks the binary version, exact packet length and field ranges before reading a frame. TypeScript does not validate a byte stream at runtime; the decoder and Zod schemas do that explicitly.
- `server/src/config.ts` validates environment variables using Zod. Error handlers keep caught errors typed as `unknown` and convert them to safe log messages.

### TypeScript errors found and fixed during migration

1. An unbranded `number` could be supplied as either an entity ID or an input sequence. The branded types now make those accidental substitutions a compile-time error.
2. Snapshot/wire data do not contain every internal simulation field. Snapshot types now distinguish wire fields from internal-only state instead of treating a partial network snapshot as a full mutable simulation entity.
3. `JSON.parse`, WebSocket payloads and environment variables were previously easy to use as if they had trusted shapes. They now enter the program as `unknown`/environment strings, then pass Zod or binary validation before the simulation consumes them.
4. With `noUncheckedIndexedAccess`, values read from arrays and maps may be absent. The active runtime paths explicitly handle missing entities/snapshots rather than assuming indexes always exist.
5. The discriminated message switch is exhaustive. If a new protocol message is added to the union, TypeScript will point out an unhandled variant instead of silently letting it fall through.

### Three types, in simple words

- **`EntityId` (branded type):** a normal number used specifically as a game entity ID. It helps stop mixing an ID with a tick number or a message sequence.
- **`InputMessage` / `SnapshotMessage` (discriminated message types):** the `type` field tells TypeScript which fields belong to the current message. An input has controls and a sequence; a snapshot has the server state.
- **`Readonly` fields:** a value can be read by the caller, but not edited through that type. For example, a function receiving a readonly vector cannot accidentally change its `x` or `y` as a side effect.

### Why no UI framework was added

The lab allows a framework for the lobby/HUD, but it is optional. The project keeps vanilla TypeScript/DOM for the lobby and HUD and Canvas 2D for the arena so the previous event-loop, rendering, loading and network code remains easy to trace. Introducing React/Vue/Svelte here would add a second migration without improving the learning target: strict typing of simulation, protocol, runtime validation and networking.

### Commands and CI

From the repository root:

```bash
npm install
npm run typecheck
npm run test:shared
npm run bench:protocol
npm run build
npm run lint
```

`npm run typecheck` runs `tsc --noEmit -p tsconfig.json` with `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `useUnknownInCatchVariables` and `verbatimModuleSyntax`. The GitHub Actions workflow in `.github/workflows/ci.yml` installs dependencies and runs typecheck, the deterministic/shared simulation test and the client build on each push and pull request.

The determinism test is `server/examples/shared-smoke.ts`. It runs two simulations with the same seed and inputs and asserts that ships, enemies, bullets, asteroids and pickups finish in exactly the same state. It also checks pickup collision, asteroid splitting, enemy movement/fire and binary input/snapshot round trips.

## Submission — Lab 06

Keep this change in the **same public GitHub repository** used for Labs 01–05. After `npm run typecheck`, `npm run test:shared` and `npm run build` pass:

```bash
git add .
git commit -m "lab-06: migrate simulation and protocol to TypeScript"
git push origin main
git tag lab-06
git push origin lab-06
```

The submission is the URL of the same public repository with tags `lab-01` through `lab-06`. The old tags are historical checkpoints and should not be moved.
