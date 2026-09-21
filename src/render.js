function wrap(value, size) {
  return ((value % size) + size) % size;
}

function interpolateWrapped(previous, current, alpha, size) {
  let delta = current - previous;

  if (Math.abs(delta) > size / 2) {
    delta -= Math.sign(delta) * size;
  }

  return wrap(previous + delta * alpha, size);
}

function interpolateAngle(previous, current, alpha) {
  let delta = current - previous;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return previous + delta * alpha;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 1;
  let height = 1;
  let dpr = 1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawBackground() {
    ctx.fillStyle = '#02050b';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(125, 170, 230, 0.08)';
    ctx.lineWidth = 1;
    const grid = 48;

    ctx.beginPath();
    for (let x = 0; x <= width; x += grid) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += grid) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  function drawShip(ship, previousShip, alpha) {
    const x = interpolateWrapped(previousShip.x, ship.x, alpha, width);
    const y = interpolateWrapped(previousShip.y, ship.y, alpha, height);
    const angle = interpolateAngle(previousShip.angle, ship.angle, alpha);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.fillStyle = '#e7f2ff';
    ctx.strokeStyle = '#66a9ff';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(23, 0);
    ctx.lineTo(-15, -11);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-15, 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(102, 169, 255, 0.9)';
    ctx.beginPath();
    ctx.moveTo(-14, -5);
    ctx.lineTo(-28, 0);
    ctx.lineTo(-14, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function render(previousShip, ship, alpha) {
    drawBackground();
    drawShip(ship, previousShip, alpha);
  }

  window.addEventListener('resize', resize);
  resize();

  return {
    getSize() {
      return { width, height };
    },
    render,
    destroy() {
      window.removeEventListener('resize', resize);
    },
  };
}
