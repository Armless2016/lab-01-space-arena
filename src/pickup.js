import { Entity } from './entity.js';
import { PickupComponent } from './components.js';
import { Vector2 } from './vector2.js';

export class Pickup extends Entity {
  constructor({ position, type = 'repair', amount = 25 } = {}) {
    super({ position, velocity: new Vector2(), radius: 13, kind: 'pickup' });
    this.addComponent(new PickupComponent({ type, amount }));
  }
}
