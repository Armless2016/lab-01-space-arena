import { Entity } from './entity.js';

export class Particle extends Entity {
  constructor({ position, velocity, life = 0.6, size = 2 } = {}) {
    super({ position, velocity, radius: size, kind: 'particle' });
    this.ttl = life;
    this.maxLife = life;
    this.size = size;
  }

  update(dt, world) {
    super.update(dt, world);
    this.position = this.position.add(this.velocity.scale(dt));
    this.velocity = this.velocity.scale(Math.pow(0.08, dt));
    this.ttl -= dt;
    if (this.ttl <= 0) this.markDead();
  }

  get alpha() {
    return Math.max(0, this.ttl / this.maxLife);
  }
}
