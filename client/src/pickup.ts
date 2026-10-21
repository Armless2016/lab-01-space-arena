import { Entity } from './entity.ts';
import { PickupComponent } from './components.ts';
import { Vector2 } from './vector2.ts';

export class Pickup extends Entity {
  constructor({ position, type = 'repair', amount = 25 } = {}) {
    super({ position, velocity: new Vector2(), radius: 14, kind: 'pickup' });
    this.addComponent(new PickupComponent({ type, amount }));
    this.pulse = Math.random() * Math.PI * 2;
  }

  update(dt, world) {
    super.update(dt, world);
    this.pulse += dt * 3;
  }
}
