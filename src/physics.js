const ACCELERATION = 320;
const DRAG_PER_SECOND = 0.86;
const MAX_SPEED = 360;

function wrap(value, size) {
  if (value < 0) return value + size;
  if (value >= size) return value - size;
  return value;
}

export function integrate(ship, input, dt, arena) {
  const horizontal = Number(input.right) - Number(input.left);
  const vertical = Number(input.down) - Number(input.up);
  const length = Math.hypot(horizontal, vertical);

  const ax = length > 0 ? (horizontal / length) * ACCELERATION : 0;
  const ay = length > 0 ? (vertical / length) * ACCELERATION : 0;

  let vx = ship.vx + ax * dt;
  let vy = ship.vy + ay * dt;

  const drag = Math.pow(DRAG_PER_SECOND, dt);
  vx *= drag;
  vy *= drag;

  const speed = Math.hypot(vx, vy);
  if (speed > MAX_SPEED) {
    const scale = MAX_SPEED / speed;
    vx *= scale;
    vy *= scale;
  }

  const nextX = wrap(ship.x + vx * dt, arena.width);
  const nextY = wrap(ship.y + vy * dt, arena.height);
  const nextAngle = speed > 5 ? Math.atan2(vy, vx) : ship.angle;

  return {
    x: nextX,
    y: nextY,
    vx,
    vy,
    angle: nextAngle,
  };
}
