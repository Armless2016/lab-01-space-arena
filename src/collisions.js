import { Particle } from './particle.js';
import { Vector2 } from './vector2.js';

function circlesOverlap(first, second) {
  const dx = first.position.x - second.position.x;
  const dy = first.position.y - second.position.y;
  const radius = first.radius + second.radius;
  return dx * dx + dy * dy <= radius * radius;
}

function spawnExplosion(world, position, amount = 18) {
  for (let index = 0; index < amount; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 240;
    const life = 0.35 + Math.random() * 0.5;
    world.spawn(
      new Particle({
        position: position.clone(),
        velocity: new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        life,
        size: 1 + Math.random() * 3,
      }),
    );
  }
}

function handleBulletHit(bullet, target, world) {
  bullet.markDead();

  if (target.kind === 'ship') {
    const destroyed = target.takeDamage(bullet.damage);
    if (destroyed) {
      world.score += target.isPlayer ? 0 : 100;
      spawnExplosion(world, target.position, 28);
    }
    return;
  }

  if (target.kind === 'asteroid') {
    const destroyed = target.takeDamage(bullet.damage);
    if (destroyed) {
      world.score += 25;
      spawnExplosion(world, target.position, 20);
    }
  }
}

function handleShipVsAsteroid(ship, asteroid, world) {
  ship.takeDamage(10);
  asteroid.takeDamage(10);

  if (ship.dead) {
    spawnExplosion(world, ship.position, 30);
  }
  if (asteroid.dead) {
    world.score += 25;
    spawnExplosion(world, asteroid.position, 20);
  }
}

function handleShipPickup(ship, pickup) {
  const pickupComponent = [...pickup.components].find((component) => typeof component.collect === 'function');
  if (pickupComponent?.collect(pickup, ship)) {
    pickup.markDead();
  }
}

export function processCollisions(world) {
  const entities = [...world].filter((entity) => !entity.dead);

  for (let firstIndex = 0; firstIndex < entities.length; firstIndex += 1) {
    const first = entities[firstIndex];
    if (first.dead) continue;

    for (let secondIndex = firstIndex + 1; secondIndex < entities.length; secondIndex += 1) {
      const second = entities[secondIndex];
      if (second.dead || !circlesOverlap(first, second)) continue;

      if (first.kind === 'bullet' && second.kind === 'bullet') continue;

      if (first.kind === 'bullet' && (second.kind === 'ship' || second.kind === 'asteroid')) {
        if (second.id !== first.ownerId) handleBulletHit(first, second, world);
        continue;
      }

      if (second.kind === 'bullet' && (first.kind === 'ship' || first.kind === 'asteroid')) {
        if (first.id !== second.ownerId) handleBulletHit(second, first, world);
        continue;
      }

      if (first.kind === 'ship' && second.kind === 'asteroid') {
        handleShipVsAsteroid(first, second, world);
        continue;
      }

      if (first.kind === 'asteroid' && second.kind === 'ship') {
        handleShipVsAsteroid(second, first, world);
        continue;
      }

      if (first.kind === 'ship' && second.kind === 'pickup') {
        handleShipPickup(first, second);
        continue;
      }

      if (first.kind === 'pickup' && second.kind === 'ship') {
        handleShipPickup(second, first);
      }
    }
  }
}
