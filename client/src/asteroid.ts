import { Entity } from './entity.ts';
import { HomingComponent } from './components.ts';
import { Vector2 } from './vector2.ts';

export class Asteroid extends Entity {
  constructor({ position, velocity, radius = 28, hp = 50, homing = false } = {}) {
    super({ position, velocity, radius, kind: 'asteroid' });
    this.hp = hp;
    this.isHoming = homing;
    this.spriteFrame = Math.floor(Math.random() * 4);

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
    this.position = new Vector2(
      ((this.position.x % width) + width) % width,
      ((this.position.y % height) + height) % height,
    );
  }
}
