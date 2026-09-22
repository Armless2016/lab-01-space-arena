export class Entity {
  static #nextId = 1;

  #id;

  constructor({ position, velocity, radius = 10, kind = 'entity', angle = 0 } = {}) {
    this.#id = Entity.#nextId;
    Entity.#nextId += 1;

    this.position = position;
    this.previousPosition = position.clone();
    this.velocity = velocity;
    this.previousAngle = angle;
    this.angle = angle;
    this.radius = radius;
    this.kind = kind;
    this.dead = false;
    this.components = new Set();
  }

  get id() {
    return this.#id;
  }

  addComponent(component) {
    this.components.add(component);
    return this;
  }

  hasComponent(componentClass) {
    return [...this.components].some((component) => component instanceof componentClass);
  }

  getComponent(componentClass) {
    return [...this.components].find((component) => component instanceof componentClass);
  }

  capturePreviousState() {
    this.previousPosition = this.position.clone();
    this.previousAngle = this.angle;
  }

  update(dt, world) {
    for (const component of this.components) {
      component.update?.(this, world, dt);
    }
  }

  markDead() {
    this.dead = true;
  }
}
