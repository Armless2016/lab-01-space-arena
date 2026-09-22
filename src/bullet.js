import { Entity } from './entity.js';
import { Vector2 } from './vector2.js';

export class Bullet extends Entity {
  constructor({ position, angle, ownerId, damage = 25, homing = false } = {}) {
    super({
      position,
      velocity: Vector2.fromAngle(angle, 620),
      radius: 4,
      kind: 'bullet',
      angle,
    });

    this.ownerId = ownerId;
    this.damage = damage;
    this.ttl = 1.6;
    this.homingSpeed = 620;
    this.isHoming = homing;
  }

  update(dt, world) {
    super.update(dt, world);

    this.position = this.position.add(this.velocity.scale(dt));
    this.ttl -= dt;

    if (this.ttl <= 0) {
      this.markDead();
      return;
    }

    const { width, height } = world.arena;
    const x = ((this.position.x % width) + width) % width;
    const y = ((this.position.y % height) + height) % height;
    this.position = new Vector2(x, y);
  }
}
