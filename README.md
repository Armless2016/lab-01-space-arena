# JavaScript Semester Project — Space Arena

## Lab 02 — Objects, prototypes, `this` and composition

Це продовження Lab 01 у тому самому репозиторії. Фіксований цикл `requestAnimationFrame`, fixed timestep 60 Hz, інтерполяція, Canvas та базове керування кораблем з Lab 01 збережені. Lab 02 додає модель сутностей і системи ігрового світу.

## Run locally

```bash
npm install
npm run dev
```

## Controls

- `WASD` або стрілки — рух;
- `Space` — стрільба;
- кожна п'ята куля отримує `HomingComponent`;
- `P` — експеримент з prototype chain.

## Lab 01 foundation

Проєкт використовує `requestAnimationFrame()` для рендерингу та fixed timestep `1/60` для симуляції. Акумулятор накопичує реальний час і за потреби виконує кілька фіксованих simulation steps. Рендер отримує `alpha` та інтерполює між попереднім і поточним станом.

`createInput()` зберігає натиснуті клавіші у приватному `Set`; `snapshot()` замкнений над цим станом. `physics.js` містить чисту `integrate()` без залежностей від DOM. Canvas масштабується через `devicePixelRatio`, а корабель загортається через краї арени.

## Lab 02 requirements

- `Vector2` з чистими методами: `add`, `sub`, `scale`, `dot`, `normalized`, `distanceTo`.
- `Entity` з `id`, позицією, швидкістю, радіусом, `kind`, `update` та приватним static counter `#nextId`.
- `class Ship extends Entity`; немає ієрархії глибше одного рівня `extends`.
- `World` поверх `Map<id, Entity>`: `spawn`, `despawn`, sweep наприкінці `step`, ітератор і генератор `ofKind(kind)`.
- Кулі з TTL, астероїди/перешкоди, ворожі кораблі та repair-pickup.
- `Ship.fire()` створює кулю з носа корабля.
- У `Ship` приватне `#hp` та публічний `get hp()`.
- Окрема колізійна система коло-коло з наївним `O(n²)`.
- Кулі пошкоджують кораблі та астероїди; при знищенні створюються частинки вибуху.
- Респаун гравця через 2 секунди, рахунок і стан респауну на HUD.
- `HomingComponent` і `PickupComponent` реалізовані композицією, а не окремими класами-комбінаціями.

## Project structure

```text
src/
├─ vector2.js
├─ entity.js
├─ ship.js
├─ bullet.js
├─ asteroid.js
├─ pickup.js
├─ particle.js
├─ components.js
├─ collisions.js
├─ world.js
├─ prototype-experiment.js
├─ input.js
├─ loop.js
├─ render.js
├─ physics.js
├─ experiments.js
├─ main.js
└─ style.css
```

## `this`: чотири правила і конкретний баг

У JavaScript важливий не текст оголошення функції, а спосіб її виклику.

1. **Default binding:** звичайний `fn()` у strict/module-коді має `this === undefined`.
2. **Implicit binding:** при `obj.method()` значення `this` — це `obj`.
3. **Explicit binding:** `call`, `apply` та `bind` дозволяють явно задати `this`.
4. **`new`:** під час `new Constructor()` `this` прив'язується до нового екземпляра.

Стрілочні функції не мають власного `this`: вони беруть його з лексичного зовнішнього контексту.

### Помилка `ship.fire`

Побічний ефект такого коду:

```js
input.onPress('Space', player.fire); // НЕПРАВИЛЬНО
```

`onPress` зберігає callback і пізніше викликає його як звичайну функцію. У strict/module-коді це означає, що `this` усередині `fire()` не буде об'єктом корабля.

### Фікс у проєкті

```js
input.onPress('Space', () => {
  const currentPlayer = world.playerShip;
  if (currentPlayer) currentPlayer.fire(world);
});
```

Тут стрілочна функція замикає `world`, знаходить актуальний корабель та викликає `fire()` через `currentPlayer`, тому implicit binding дає правильний `this`.

Ще два допустимі способи:

```js
input.onPress('Space', player.fire.bind(player));
```

або зберігати bound callback заздалегідь. У цьому проєкті вибрано arrow-wrapper, бо гравець може бути замінений після респауну і callback завжди бере актуальний `world.playerShip`.

## `Map`, `Set`, `spawn/despawn` та `World.step`

`World` зберігає сутності у `Map<id, Entity>`. `despawn()` не видаляє об'єкт відразу, а ставить `dead = true`. Наприкінці фіксованого кроку `sweep()` видаляє мертві сутності з `Map`.

`World` є ітерованим:

```js
for (const entity of world) {
  // ...
}
```

і має генератор:

```js
for (const asteroid of world.ofKind('asteroid')) {
  // ...
}
```

`Entity.components` — це `Set`. Він використовується для підключення додаткової поведінки без створення нових гілок дерева класів.

## Vector2

Методи `Vector2` повертають нові вектори:

```js
const next = position.add(velocity.scale(dt));
```

Вхідний `position` не змінюється. Такий підхід спрощує передбачуваність фізики та допомагає не створювати прихованих побічних ефектів під час обчислень.

## Prototype chain experiment

Натисніть `P` або кнопку `Prototype chain`. Результат з'явиться у DevTools Console.

Очікуваний ланцюжок:

```text
Ship instance -> Ship.prototype -> Entity.prototype -> Object.prototype -> null
```

Експеримент перевіряє:

```js
Object.getPrototypeOf(ship) === Ship.prototype;
Object.getPrototypeOf(Ship.prototype) === Entity.prototype;
Object.getPrototypeOf(Entity.prototype) === Object.prototype;
```

Цього достатньо, щоб практично побачити ланцюжок прототипів, не перетворюючи роботу на окремий теоретичний розділ.

## Composition instead of deep inheritance

Наївна ієрархія могла б виглядати так:

```text
Entity
├─ Ship
├─ Bullet
│  └─ HomingBullet
├─ Asteroid
│  └─ HomingAsteroid
└─ Pickup
   └─ RepairPickup
```

Але додавання нових властивостей швидко створює комбінації класів: `ExplosiveHomingBullet`, `ShieldPickup`, `SpeedPickup` тощо.

У цій лабораторній використана композиція:

```text
Entity
└─ components: Set<behavior>
   ├─ Bullet + HomingComponent
   ├─ Asteroid + HomingComponent
   └─ Entity(kind="pickup") + PickupComponent
```

Той самий `HomingComponent` підключається і до кулі, і до астероїда. `PickupComponent` описує ефект предмета, а сам pickup залишається звичайною `Entity` із `kind="pickup"`. Тому поведінку можна комбінувати без розростання класової ієрархії.

## Lab 01 experiments

Ці три кнопки збережені в проєкті, щоб попередня лабораторна залишалась відтворюваною.

### 1. Blocking loop

**Measured on:** TODO — вставити свій браузер/ПК та результат з кнопки.

```text
Block requested: TODO ms
Block actual: TODO ms
Gap to next animation frame: TODO ms
Estimated 60 Hz frames skipped: TODO
```

**Пояснення:** довгий синхронний цикл займає головний JS thread. Поки він виконується, наступний `requestAnimationFrame`, обробники та нормальна можливість рендеру затримуються.

### 2. `setInterval()`

**Measured on:** TODO

```text
Requested interval: TODO ms
Elapsed: TODO ms
Callbacks: TODO
Callbacks/s: TODO
Average interval: TODO ms
Minimum interval: TODO ms
Maximum interval: TODO ms
Jitter (standard deviation): TODO ms
```

**Пояснення:** `setInterval()` запускає timer callbacks як задачі; це не механізм синхронізації з repaint. `requestAnimationFrame()` призначений для роботи безпосередньо перед наступною можливістю браузера перемалювати сторінку.

### 3. Variable timestep

```text
Render FPS | Variable position | Fixed position | Variable velocity | Fixed velocity
30         | TODO              | TODO          | TODO              | TODO
60         | TODO              | TODO          | TODO              | TODO
120        | TODO              | TODO          | TODO              | TODO
```

**Пояснення:** при variable timestep різні `dt` дають різний числовий результат інтегрування. Fixed timestep завжди рухає симуляцію кроком `1/60` секунди, тому render rate не визначає тривалість фізичного кроку.

## Lint / build

```bash
npm run lint
npm run build
```

## Submission for Lab 02

Після локальної перевірки:

```bash
git add .
git commit -m "lab-02: entities prototypes this and composition"
git tag lab-02
git push origin main
git push origin lab-02
```

Здача: той самий публічний GitHub-репозиторій з тегом `lab-02`.
