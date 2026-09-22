export class World {
  #entities = new Map();

  constructor({ width, height, playerFactory }) {
    this.arena = { width, height };
    this.playerFactory = playerFactory;
    this.inputState = {};
    this.score = 0;
    this.respawnTimer = null;
  }

  get size() {
    return this.#entities.size;
  }

  get playerShip() {
    for (const entity of this.#entities.values()) {
      if (entity.kind === 'ship' && entity.isPlayer && !entity.dead) return entity;
    }
    return null;
  }

  spawn(entity) {
    this.#entities.set(entity.id, entity);
    return entity;
  }

  despawn(entity) {
    entity.markDead();
  }

  *ofKind(kind) {
    for (const entity of this.#entities.values()) {
      if (!entity.dead && entity.kind === kind) yield entity;
    }
  }

  [Symbol.iterator]() {
    return this.#entities.values();
  }

  step(dt, inputState = {}) {
    this.inputState = inputState;

    const entities = [...this.#entities.values()];
    for (const entity of entities) {
      if (entity.dead) continue;
      entity.capturePreviousState();
      entity.update(dt, this);
    }

    this.onBeforeCollision?.(dt, this);
    this.collisionSystem?.(this);
    this.handlePlayerRespawn(dt);
    this.sweep();
  }

  handlePlayerRespawn(dt) {
    if (this.playerShip) {
      this.respawnTimer = null;
      return;
    }

    if (this.respawnTimer === null) {
      this.respawnTimer = 2;
      return;
    }

    this.respawnTimer -= dt;
    if (this.respawnTimer <= 0) {
      this.respawnTimer = null;
      const newPlayer = this.playerFactory?.();
      if (newPlayer) this.spawn(newPlayer);
    }
  }

  sweep() {
    for (const [id, entity] of this.#entities) {
      if (entity.dead) this.#entities.delete(id);
    }
  }
}
