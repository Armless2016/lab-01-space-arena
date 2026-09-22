import { Entity } from './entity.js';
import { HomingComponent } from './components.js';

export class Asteroid extends Entity {
  constructor({ position, velocity, radius = 28, hp = 50, homing = false } = {}) {
    super({ position, velocity, radius, kind: 'asteroid' });
    this.hp = hp;
    this.isHoming = homing;

    if (homing) {
      this.addComponent(new HomingComponent({ turnRate: 0.8, targetKinds: ['ship'] }));
    }
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) this.markDead();
    return this.dead;
  }

  update(dt, world) {
    super.update(dt, world);
    this.position = this.position.add(this.velocity.scale(dt));

    const { width, height } = world.arena;
    this.position.x = ((this.position.x % width) + width) % width;
    this.position.y = ((this.position.y % height) + height) % height;
  }
}
