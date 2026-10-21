import { Entity } from './entity.ts';
import { Bullet } from './bullet.ts';
import { HomingComponent } from './components.ts';
import { Vector2 } from './vector2.ts';
import { integrate } from './physics.ts';
import { emitGameEvent } from './event-bus.ts';

const FIRE_COOLDOWN = 0.22;

export class Ship extends Entity {
  #hp;

  constructor({ position, player = false, hp = 100, angle = 0, maxHp = 100, name = 'Pilot' } = {}) {
    super({ position, velocity: new Vector2(), radius: 20, kind: 'ship', angle });
    this.isPlayer = player;
    this.name = name;
    this.#hp = hp;
    this.maxHp = maxHp;
    this.fireCooldown = 0;
    this.shotsFired = 0;
    this.spriteFrame = 0;
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
    this.#hp = Math.min(this.maxHp, this.#hp + amount);
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
    emitGameEvent('fired', { ship: this, bullet });
    return bullet;
  }

  update(dt, world) {
    super.update(dt, world);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    if (this.isPlayer) {
      const next = integrate(
        {
          x: this.position.x,
          y: this.position.y,
          vx: this.velocity.x,
          vy: this.velocity.y,
          angle: this.angle,
        },
        world.inputState,
        dt,
        world.arena,
      );
      this.position = new Vector2(next.x, next.y);
      this.velocity = new Vector2(next.vx, next.vy);
      this.angle = next.angle;
    } else {
      const player = world.playerShip;
      if (player) {
        const toPlayer = player.position.sub(this.position);
        const distance = toPlayer.length();
        this.angle = toPlayer.angle();
        const thrust = distance > 180 ? 120 : -30;
        this.velocity = Vector2.fromAngle(this.angle, thrust);
        if (this.fireCooldown <= 0 && distance < 560) this.fire(world);
      }

      this.position = this.position.add(this.velocity.scale(dt));
      const { width, height } = world.arena;
      this.position = new Vector2(
        ((this.position.x % width) + width) % width,
        ((this.position.y % height) + height) % height,
      );
    }
  }
}
