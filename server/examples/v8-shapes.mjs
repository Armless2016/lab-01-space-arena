// Run with: npm run v8:trace
// The objects deliberately use the same property insertion order in the stable case.
function createStableShip(index) {
  return { id: index, x: index * 0.5, y: index * 0.25, vx: 0, vy: 0, angle: 0 };
}

function createPolymorphicShip(index) {
  if (index % 2 === 0) return { id: index, x: index * 0.5, y: index * 0.25, vx: 0, vy: 0, angle: 0 };
  // A different property order/shape creates a different hidden class (V8 Map).
  return { x: index * 0.5, id: index, y: index * 0.25, vx: 0, vy: 0, angle: 0, debugLabel: 'bot' };
}

function readPosition(ship) {
  return ship.x + ship.y;
}

function measure(name, ships) {
  let total = 0;
  const started = performance.now();
  for (let round = 0; round < 300; round += 1) {
    for (const ship of ships) total += readPosition(ship);
  }
  const elapsedMs = performance.now() - started;
  console.log(`${name}: ${elapsedMs.toFixed(2)} ms; checksum=${total.toFixed(2)}`);
}

const stable = Array.from({ length: 20_000 }, (_, index) => createStableShip(index));
const polymorphic = Array.from({ length: 20_000 }, (_, index) => createPolymorphicShip(index));
console.log(`Node ${process.version}; V8 ${process.versions.v8}`);
measure('stable object shape', stable);
measure('polymorphic object shapes', polymorphic);
console.log('Inspect --trace-opt / --trace-deopt output above; timings depend on the machine and V8 version.');
