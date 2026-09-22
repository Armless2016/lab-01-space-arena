import { Entity } from './entity.js';
import { Bullet } from './bullet.js';
import { Vector2 } from './vector2.js';
import { HomingComponent } from './components.js';

const ACCELERATION = 320;
const DRAG_PER_SECOND = 0.86;
const MAX_SPEED = 360;
const FIRE_COOLDOWN = 0.22;

function wrap(value, size) {
  return ((value % size) + size) % size;
}

export class Ship extends Entity {
  #hp;

  constructor({ position, player = false, hp = 100, angle = 0 } = {}) {
    super({ position, velocity: new Vector2(), radius: 20, kind: 'ship', angle });
    this.isPlayer = player;
    this.#hp = hp;
    this.fireCooldown = 0;
    this.shotsFired = 0;
  }

  get hp() {
    return this.#hp;
  }

  takeDamage(amount) {
    this.#hp = Math.max(0, this.#hp - amount);
    if (this.#hp === 0) this.markDead();
    return this.dead;
  }

  heal(amount) {
    const oldHp = this.#hp;
    this.#hp = Math.min(100, this.#hp + amount);
    return this.#hp - oldHp;
  }

  fire(world) {
    if (this.fireCooldown > 0 || this.dead) return null;

    const direction = Vector2.fromAngle(this.angle);
    const muzzle = this.position.add(direction.scale(this.radius + 10));
    this.fireCooldown = FIRE_COOLDOWN;
    this.shotsFired += 1;

    const homing = this.shotsFired % 5 === 0;
    const bullet = new Bullet({
      position: muzzle,
      angle: this.angle,
      ownerId: this.id,
      damage: this.isPlayer ? 25 : 12,
      homing,
    });

    if (homing) {
      bullet.addComponent(new HomingComponent({
        turnRate: 5,
        targetKinds: ['ship', 'asteroid'],
      }));
    }

    world.spawn(bullet);
    return bullet;
  }

  update(dt, world) {
    super.update(dt, world);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    if (this.isPlayer) {
      const input = world.inputState;
      const horizontal = Number(input.right) - Number(input.left);
      const vertical = Number(input.down) - Number(input.up);
      const length = Math.hypot(horizontal, vertical);

      const ax = length > 0 ? (horizontal / length) * ACCELERATION : 0;
      const ay = length > 0 ? (vertical / length) * ACCELERATION : 0;
      let nextVelocity = this.velocity.add(new Vector2(ax, ay).scale(dt));
      nextVelocity = nextVelocity.scale(Math.pow(DRAG_PER_SECOND, dt));

      const speed = nextVelocity.length();
      if (speed > MAX_SPEED) {
        nextVelocity = nextVelocity.scale(MAX_SPEED / speed);
      }

      this.velocity = nextVelocity;
      if (speed > 5) this.angle = Math.atan2(nextVelocity.y, nextVelocity.x);
    } else {
      const player = world.playerShip;
      if (player) {
        const toPlayer = player.position.sub(this.position);
        const distance = toPlayer.length();
        this.angle = toPlayer.angle();
        const thrust = distance > 170 ? 120 : -30;
        this.velocity = Vector2.fromAngle(this.angle, thrust);

        if (this.fireCooldown <= 0 && distance < 520) {
          this.fire(world);
        }
      }
    }

    this.position = this.position.add(this.velocity.scale(dt));
    this.position = new Vector2(
      wrap(this.position.x, world.arena.width),
      wrap(this.position.y, world.arena.height),
    );
  }
}
