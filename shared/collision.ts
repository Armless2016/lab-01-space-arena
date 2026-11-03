export interface CircleLike {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

function wrappedDelta(a: number, b: number, size: number): number {
  let delta = a - b;
  if (delta > size / 2) delta -= size;
  if (delta < -size / 2) delta += size;
  return delta;
}

/** Circle-circle collision in a toroidal arena (ships can wrap at the edges). */
export function circlesOverlap(a: CircleLike, b: CircleLike, width: number, height: number): boolean {
  const dx = wrappedDelta(a.x, b.x, width);
  const dy = wrappedDelta(a.y, b.y, height);
  const radius = a.radius + b.radius;
  return dx * dx + dy * dy <= radius * radius;
}

export function squaredToroidalDistance(a: Pick<CircleLike, 'x' | 'y'>, b: Pick<CircleLike, 'x' | 'y'>, width: number, height: number): number {
  const dx = wrappedDelta(a.x, b.x, width);
  const dy = wrappedDelta(a.y, b.y, height);
  return dx * dx + dy * dy;
}
