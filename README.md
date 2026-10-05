# JavaScript Semester Project — Space Arena

## Lab 03 — Async JavaScript: Promises, async/await and loading

Це продовження тих самих Lab 01–02 у тому самому публічному репозиторії. Fixed timestep, Canvas, корабель, `Entity`, `World`, кулі, астероїди та зіткнення збереглися. Lab 03 додає асинхронний пайплайн ресурсів, екран завантаження, лобі, Web Audio, EventTarget-шину, Promise combinators, async iteration та контроль помилок.

## Run locally

```bash
npm install
npm run dev
```

Для Lab 03 використовується Vite middleware: `GET /api/rooms` повертає статичний JSON з `public/api/rooms.json`; `/api/slow` та `/api/broken-json` використовуються лише для тестів збоїв.

## User flow

1. Натиснути **Enable audio & load game**. Це user gesture, після якого створюється `AudioContext`.
2. На Canvas показується реальний прогрес-бар. `await loadAll(...)` завершується лише після завантаження всіх ресурсів.
3. Після завантаження відкривається Lobby. Вибір кімнати передає її конфіг локальній грі.
4. У грі працюють WASD/стрілки та Space. `Esc` повертає до Lobby.

## Async asset pipeline

`public/assets/manifest.json` містить картинки, звуки та JSON-метадані. `asset-loader.js` має:

- `fetchJson()` як спільний JSON-fetcher з перевіркою `response.ok`;
- `loadImage()`, `loadAudio()`, `loadJson()` — усі приймають `AbortSignal`;
- retry для мережевих/5xx помилок з exponential backoff + jitter;
- **жодного retry на 4xx**;
- `loadAll()` з `Promise.all`, тому незалежні файли завантажуються конкурентно;
- прогрес після завершення кожного окремого файлу.

Якщо завантаження падає, гра не падає: показується помилка та кнопка **Retry**. Кнопка **Cancel loading** abort-ить активний `fetch`.

### Sequential vs concurrent timing

У блоці Lab 03 diagnostics є **Measure sequential vs concurrent**. Натиснути його після завантаження і перенести числа у таблицю нижче.

| Files | Sequential `await` | Concurrent `Promise.all` | Speedup |
|---:|---:|---:|---:|
| 9 | TODO ms | TODO ms | TODO× |

**Висновок:** sequential варіант чекає завершення кожного файлу перед початком наступного; concurrent створює всі Promises одразу, тому мережеві очікування перекриваються.

## Spritesheets

Корабель, куля та астероїд малюються з локальних PNG sprite sheets. Рендер бере окремий кадр спрайтшита, а не малює ці сутності простими геометричними фігурами. Pickup також має власний sprite sheet.

## Web Audio + EventTarget

`audio.js` не імпортується симуляцією. `World`, `Ship` і collision system не знають про DOM або Audio API.

Шина знаходиться у `event-bus.js`:

```js
export const gameEvents = new EventTarget();
```

Симуляція генерує `CustomEvent`:

- `fired` — куля створена;
- `hit` — зафіксоване попадання/зіткнення;
- `exploded` — сутність знищена та створено вибух.

`main.js` слухає ці події та передає їх у `audio.js` і `hud.js`. Таким чином симуляція не залежить від presentation layer.

### Audio lifecycle

`AudioContext` створюється тільки після натискання **Enable audio & load game**. Після цього звукові буфери декодуються під час `loadAll()` і готові до моментального відтворення під час `fired`/`hit`/`exploded`.

## Lobby and AbortController

`class Lobby extends EventTarget` знаходиться у `lobby.js`, а робота з DOM винесена в `lobby-view.js`.

Поки Lobby видима, виконується періодичний `GET /api/rooms`. Кожен запит отримує `AbortSignal.timeout(...)`. Коли гравець Join-иться або виходить з Lobby, попередній controller абортиться, а interval очищується.

Поки мережевий endpoint не замінений реальною серверною логікою, Vite middleware віддає статичний JSON. У наступній лабораторній цей endpoint можна замінити справжнім сервером.

## Promise combinators

У diagnostics є демонстрація чотирьох combinators:

- `Promise.all` — чекає всі успішні результати; саме так завантажується manifest;
- `Promise.allSettled` — повертає результат кожної операції, навіть якщо одна впала;
- `Promise.race` — повертає першу завершену Promise;
- `Promise.any` — повертає першу успішну Promise.

## Five microtask/task ordering puzzles

Натиснути **Run 5 microtask puzzles**. Кожна головоломка виводить фактичний порядок у браузері та коротке пояснення.

1. **Promise microtask vs setTimeout task**

Очікувано:

```text
sync-A → sync-D → microtask-B → task-C
```

Пояснення: synchronous code завершується першим, потім event loop очищає microtask queue, а timer callback потрапляє в наступну task.

2. **`await` continuation**

Очікувано:

```text
sync-A → async-B → sync-D → after-await-C
```

Пояснення: код після `await` не виконується синхронно — continuation ставиться у microtask queue.

3. **`setTimeout` всередині `.then()`**

Очікувано:

```text
sync-A → sync-E → then-B → then-D → timer-C
```

Пояснення: обидва `.then()` виконуються під час drain microtask queue; `setTimeout` з першого `.then()` створює окрему task.

4. **`requestAnimationFrame` + microtask**

Типовий результат у desktop Chromium після запуску головоломки:

```text
sync-A → sync-E → micro-D → raf-B → micro-after-raf-C
```

Пояснення: Promise callback є microtask після synchronous script; `requestAnimationFrame` виконується під час rendering opportunity, а Promise всередині rAF додає ще одну microtask. Точне співвідношення з іншими rendering/timer callbacks залежить від моменту кадру, тому у програмі виводиться фактичний результат.

5. **FIFO та chained Promise**

Очікувано:

```text
sync-A → sync-E → micro-B → micro-D → micro-C
```

Пояснення: перші microtasks обробляються у FIFO-порядку; continuation другого `.then()` додається до черги після виконання попереднього callback.

## Failure gallery

Кнопки у diagnostics навмисно запускають чотири помилки. Жодна не повинна ламати сторінку.

| Failure | What happens | Recovery |
|---|---|---|
| 404 sprite | `fetch` отримує HTTP 404; 4xx не retry-иться | Promise reject ловиться, гра продовжує роботу |
| Network timeout | `/api/slow` не відповідає до `AbortSignal.timeout(120)` | timeout abort ловиться |
| Abort during load | `AbortController.abort()` скасовує повільний запит посеред завантаження | AbortError ловиться |
| Broken JSON | сервер повертає 200, але JSON синтаксично битий | parsing error ловиться |

Під час реального старту критична помилка asset pipeline переводить Canvas у стан Error і показує **Retry**, тому гра не падає безконтрольно.

## Lab 01–02 foundation

### Lab 01

- `createLoop()` з `requestAnimationFrame` та accumulator;
- fixed timestep `1/60`, interpolation через `alpha`;
- `createInput()` як closure над приватним `Set`;
- чиста `integrate(ship, input, dt, arena)` без DOM;
- Canvas 2D та `devicePixelRatio`;
- wrapping країв;
- три timing experiments: blocking loop, `setInterval`, variable timestep.

### Lab 02

- `Vector2`, `Entity`, `Ship extends Entity`;
- приватні `#id` та `#hp`, `get hp()`;
- `World` на `Map<id, Entity>` та `Set` компонентів;
- `spawn/despawn` + sweep, generator `ofKind()`;
- TTL bullets, asteroids, collisions `O(n²)`, particles, score, respawn;
- `this` fix через arrow-wrapper / `bind`;
- prototype-chain experiment;
- `HomingComponent` і `PickupComponent` через композицію.

## Project structure

```text
.
├─ public/
│  ├─ api/rooms.json
│  └─ assets/
│     ├─ manifest.json
│     ├─ asset-meta.json
│     ├─ ship.png
│     ├─ bullet.png
│     ├─ asteroid.png
│     ├─ pickup.png
│     ├─ fire.wav
│     ├─ hit.wav
│     ├─ explosion.wav
│     └─ pickup.wav
├─ src/
│  ├─ asset-loader.js
│  ├─ audio.js
│  ├─ collisions.js
│  ├─ components.js
│  ├─ diagnostics.js
│  ├─ entity.js
│  ├─ event-bus.js
│  ├─ game.js
│  ├─ hud.js
│  ├─ input.js
│  ├─ lobby-view.js
│  ├─ lobby.js
│  ├─ loop.js
│  ├─ main.js
│  ├─ microtask-puzzles.js
│  ├─ particle.js
│  ├─ physics.js
│  ├─ render.js
│  ├─ ship.js
│  ├─ asteroid.js
│  ├─ bullet.js
│  ├─ pickup.js
│  ├─ vector2.js
│  ├─ world.js
│  └─ style.css
├─ index.html
├─ vite.config.js
├─ package.json
└─ README.md
```

## Submission for Lab 03

Після локальної перевірки:

```bash
npm run lint
npm run build
git add .
git commit -m "lab-03: async loading lobby audio and promises"
git push origin main
git tag lab-03
git push origin lab-03
```

Здача: **той самий публічний GitHub-репозиторій**, але з тегом `lab-03`, та README з:

1. sequential vs concurrent timing;
2. п'ятьма microtask/task puzzles;
3. failure gallery для 404, timeout, abort та broken JSON.
