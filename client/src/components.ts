import { Vector2 } from './vector2.ts';

function angleDifference(from, to) {
  let difference = to - from;
  while (difference > Math.PI) difference -= Math.PI * 2;
  while (difference < -Math.PI) difference += Math.PI * 2;
  return difference;
}

export class HomingComponent {
  constructor({ turnRate = 5, targetKinds = ['ship'] } = {}) {
    this.turnRate = turnRate;
    this.targetKinds = new Set(targetKinds);
  }

  update(entity, world, dt) {
    if (entity.dead) return;

    let nearest = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const target of world) {
      if (target === entity || target.dead || !this.targetKinds.has(target.kind)) continue;
      if (target.kind === 'ship' && entity.kind === 'bullet' && target.id === entity.ownerId) continue;

      const distance = entity.position.distanceTo(target.position);
      if (distance < nearestDistance) {
        nearest = target;
        nearestDistance = distance;
      }
    }

    if (!nearest) return;

    const desired = nearest.position.sub(entity.position).angle();
    const current = entity.velocity.length() > 1 ? entity.velocity.angle() : entity.angle;
    const delta = angleDifference(current, desired);
    const maxTurn = this.turnRate * dt;
    const nextAngle = current + Math.max(-maxTurn, Math.min(maxTurn, delta));
    const speed = Math.max(entity.velocity.length(), entity.homingSpeed ?? 0);

    entity.angle = nextAngle;
    entity.velocity = Vector2.fromAngle(nextAngle, speed);
  }
}

export class PickupComponent {
  constructor({ type = 'repair', amount = 25 } = {}) {
    this.type = type;
    this.amount = amount;
  }

  collect(pickup, ship) {
    if (this.type === 'repair') {
      const healed = ship.heal(this.amount);
      return healed > 0;
    }

    return false;
  }
}
