export function runPrototypeExperiment(entity) {
  const chain = [];
  let current = entity;
  let first = true;

  while (current !== null) {
    if (first) {
      chain.push(`${current.constructor.name} instance`);
      first = false;
    } else {
      chain.push(`${current.constructor?.name ?? 'Object'} prototype`);
    }
    current = Object.getPrototypeOf(current);
  }
  chain.push('null');

  const result = {
    instanceToShipPrototype: Object.getPrototypeOf(entity) === entity.constructor.prototype,
    shipPrototypeToEntityPrototype:
      Object.getPrototypeOf(entity.constructor.prototype)?.constructor?.name === 'Entity',
    entityPrototypeToObjectPrototype:
      Object.getPrototypeOf(Object.getPrototypeOf(entity.constructor.prototype)) === Object.prototype,
    fullChain: chain.join(' -> '),
  };

  console.group('Lab 02 — Prototype chain experiment');
  console.table(result);
  console.log('Expected: Ship instance -> Ship.prototype -> Entity.prototype -> Object.prototype -> null');
  console.groupEnd();

  return result;
}
