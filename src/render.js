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

    const time = performance.now() * 0.00008;
    for (let index = 0; index < 100; index += 1) {
      const x = (index * 97) % width;
      const y = (index * 53) % height;
      const alpha = 0.2 + 0.15 * Math.sin(time + index);
      ctx.fillStyle = `rgba(220, 235, 255, ${alpha})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  function getPosition(entity, alpha) {
    return {
      x: interpolateWrapped(entity.previousPosition.x, entity.position.x, alpha, width),
      y: interpolateWrapped(entity.previousPosition.y, entity.position.y, alpha, height),
    };
  }

  function drawShip(entity, alpha) {
    const { x, y } = getPosition(entity, alpha);
    const angle = interpolateAngle(entity.previousAngle, entity.angle, alpha);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = entity.isPlayer ? '#e7f2ff' : '#ff9696';
    ctx.strokeStyle = entity.isPlayer ? '#66a9ff' : '#ff4d6d';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(-15, -11);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-15, 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(102, 169, 255, 0.9)';
    ctx.beginPath();
    ctx.moveTo(-14, -5);
    ctx.lineTo(-27, 0);
    ctx.lineTo(-14, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawBullet(entity, alpha) {
    const { x, y } = getPosition(entity, alpha);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(entity.angle);
    ctx.fillStyle = entity.isHoming ? '#ffd166' : '#8de1ff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = ctx.fillStyle;
    ctx.fillRect(-4, -2, 8, 4);
    ctx.restore();
  }

  function drawAsteroid(entity, alpha) {
    const { x, y } = getPosition(entity, alpha);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(entity.angle);
    ctx.strokeStyle = '#aeb7c6';
    ctx.fillStyle = entity.isHoming ? 'rgba(255, 209, 102, 0.18)' : 'rgba(170, 175, 190, 0.16)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    const points = 8;
    for (let index = 0; index < points; index += 1) {
      const angle = (index / points) * Math.PI * 2;
      const wobble = entity.radius * (0.78 + ((index * 17) % 23) / 100);
      const px = Math.cos(angle) * wobble;
      const py = Math.sin(angle) * wobble;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawPickup(entity, alpha) {
    const { x, y } = getPosition(entity, alpha);
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#6ee7b7';
    ctx.fillStyle = 'rgba(110, 231, 183, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, entity.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(6, 0);
    ctx.moveTo(0, -6);
    ctx.lineTo(0, 6);
    ctx.stroke();
    ctx.restore();
  }

  function drawParticle(entity, alpha) {
    const { x, y } = getPosition(entity, alpha);
    ctx.fillStyle = `rgba(255, 190, 80, ${entity.alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, entity.size, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEntity(entity, alpha) {
    if (entity.dead) return;
    switch (entity.kind) {
      case 'ship': drawShip(entity, alpha); break;
      case 'bullet': drawBullet(entity, alpha); break;
      case 'asteroid': drawAsteroid(entity, alpha); break;
      case 'pickup': drawPickup(entity, alpha); break;
      case 'particle': drawParticle(entity, alpha); break;
      default: break;
    }
  }

  function render(world, alpha) {
    drawBackground();
    for (const entity of world) drawEntity(entity, alpha);
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
