export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const assets = {
    ship: null,
    bullet: null,
    asteroid: null,
    pickup: null,
  };
  let width = 960;
  let height = 540;
  let dpr = 1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(320, rect.width || 960);
    height = Math.max(240, rect.height || 540);
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setAssets(loaded) {
    assets.ship = loaded.ship;
    assets.bullet = loaded.bullet;
    assets.asteroid = loaded.asteroid;
    assets.pickup = loaded.pickup;
  }

  function drawSprite(image, frame, frameCount, x, y, size, angle = 0, enemyTint = false) {
    if (!image) return false;
    const frameWidth = image.width / frameCount;
    const frameHeight = image.height;
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.imageSmoothingEnabled = false;
    if (enemyTint) context.filter = 'hue-rotate(145deg) saturate(1.7)';
    context.drawImage(
      image,
      frame * frameWidth,
      0,
      frameWidth,
      frameHeight,
      -size / 2,
      -size / 2,
      size,
      size,
    );
    context.restore();
    return true;
  }

  function render(world, alpha = 0) {
    context.clearRect(0, 0, width, height);

    const gradient = context.createRadialGradient(width * 0.5, height * 0.45, 10, width * 0.5, height * 0.5, Math.max(width, height));
    gradient.addColorStop(0, '#0b1b35');
    gradient.addColorStop(1, '#02050b');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.fillStyle = 'rgba(255,255,255,0.8)';
    for (let index = 0; index < 80; index += 1) {
      const x = (index * 137.5) % width;
      const y = (index * 71.3) % height;
      const radius = index % 7 === 0 ? 1.4 : 0.7;
      context.globalAlpha = 0.25 + (index % 5) * 0.12;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;

    const entities = [...world];
    for (const entity of entities) {
      if (entity.dead) continue;
      const x = entity.previousPosition.x + (entity.position.x - entity.previousPosition.x) * alpha;
      const y = entity.previousPosition.y + (entity.position.y - entity.previousPosition.y) * alpha;

      if (entity.kind === 'ship' || entity.kind === 'enemy') {
        const frame = Math.floor(performance.now() / 130) % 4;
        const isEnemy = entity.kind === 'enemy';
        if (!drawSprite(assets.ship, frame, 4, x, y, 58, entity.angle, isEnemy)) {
          context.fillStyle = isEnemy ? '#ff536f' : entity.isPlayer ? '#72d6ff' : '#bca7ff';
          context.beginPath();
          context.moveTo(x + 22, y);
          context.lineTo(x - 15, y - 13);
          context.lineTo(x - 10, y);
          context.lineTo(x - 15, y + 13);
          context.closePath();
          context.fill();
        }
        // Keep enemies visually unmistakable even when a spritesheet has pale/white frames.
        if (isEnemy) {
          context.save();
          context.strokeStyle = '#ff536f';
          context.lineWidth = 2;
          context.beginPath();
          context.arc(x, y, 25, 0, Math.PI * 2);
          context.stroke();
          context.fillStyle = '#ff8095';
          context.font = '700 9px system-ui';
          context.textAlign = 'center';
          context.fillText('ENEMY', x, y - 29);
          context.restore();
        }
        if (isEnemy || !entity.isPlayer) {
          const maxHp = Math.max(1, Number(entity.maxHp) || 100);
          const ratio = Math.max(0, Math.min(1, Number(entity.hp ?? maxHp) / maxHp));
          const barWidth = 34;
          const barY = y + 24;
          context.fillStyle = 'rgba(0,0,0,0.65)';
          context.fillRect(x - barWidth / 2, barY, barWidth, 4);
          context.fillStyle = isEnemy ? '#ff536f' : '#72d6ff';
          context.fillRect(x - barWidth / 2, barY, barWidth * ratio, 4);
        }
      } else if (entity.kind === 'bullet') {
        const frame = entity.isHoming ? Math.floor(performance.now() / 80) % 4 : 0;
        if (!drawSprite(assets.bullet, frame, 4, x, y, 18, entity.angle)) {
          context.fillStyle = entity.isHoming ? '#ffe266' : '#dff8ff';
          context.beginPath();
          context.arc(x, y, 4, 0, Math.PI * 2);
          context.fill();
        }
      } else if (entity.kind === 'asteroid') {
        if (!drawSprite(assets.asteroid, entity.spriteFrame, 4, x, y, entity.radius * 2.3, entity.angle)) {
          context.fillStyle = '#6c758b';
          context.beginPath();
          context.arc(x, y, entity.radius, 0, Math.PI * 2);
          context.fill();
        }
        const maxHp = Math.max(1, Number(entity.maxHp) || 40);
        const ratio = Math.max(0, Math.min(1, Number(entity.hp ?? maxHp) / maxHp));
        const barWidth = Math.max(22, entity.radius * 1.6);
        const barY = y + entity.radius + 5;
        context.fillStyle = 'rgba(0,0,0,0.65)';
        context.fillRect(x - barWidth / 2, barY, barWidth, 3);
        context.fillStyle = ratio > 0.5 ? '#9bdfb1' : '#ffbf69';
        context.fillRect(x - barWidth / 2, barY, barWidth * ratio, 3);
      } else if (entity.kind === 'pickup') {
        const pulse = 1 + Math.sin(entity.pulse) * 0.08;
        drawSprite(assets.pickup, Math.floor(performance.now() / 150) % 4, 4, x, y, entity.radius * 2 * pulse);
        // Always add a green ring and plus sign over the spritesheet so the pickup
        // remains readable even if the source sprite has no transparent background.
        context.save();
        context.strokeStyle = '#76f0a6';
        context.lineWidth = 2.5;
        context.shadowColor = '#42ff9a';
        context.shadowBlur = 10;
        context.beginPath();
        context.arc(x, y, entity.radius * 0.72 * pulse, 0, Math.PI * 2);
        context.stroke();
        context.beginPath();
        context.moveTo(x - 7, y);
        context.lineTo(x + 7, y);
        context.moveTo(x, y - 7);
        context.lineTo(x, y + 7);
        context.stroke();
        context.restore();
      } else if (entity.kind === 'particle') {
        context.globalAlpha = entity.alpha;
        context.fillStyle = entity.color || '#ffd477';
        context.beginPath();
        context.arc(x, y, entity.size, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
      }
    }

    context.strokeStyle = 'rgba(127, 191, 255, 0.18)';
    context.strokeRect(0.5, 0.5, width - 1, height - 1);
  }

  function destroy() {
    window.removeEventListener('resize', resize);
  }

  window.addEventListener('resize', resize);
  resize();

  return {
    resize,
    getSize: () => ({ width, height }),
    setAssets,
    render,
    destroy,
  };
}

export function createLoadingRenderer(canvas) {
  const context = canvas.getContext('2d');
  let width = 960;
  let height = 540;
  let dpr = 1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(320, rect.width || 960);
    height = Math.max(240, rect.height || 540);
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw({ progress = 0, label = 'Loading...', error = false }) {
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#02050b';
    context.fillRect(0, 0, width, height);

    context.fillStyle = '#eaf2ff';
    context.textAlign = 'center';
    context.font = '700 30px system-ui';
    context.fillText('SPACE ARENA', width / 2, height / 2 - 48);

    context.fillStyle = '#91a4c6';
    context.font = '15px system-ui';
    context.fillText(label, width / 2, height / 2 - 16);

    const barWidth = Math.min(520, width - 80);
    const barX = (width - barWidth) / 2;
    const barY = height / 2 + 22;
    context.fillStyle = 'rgba(255,255,255,0.08)';
    context.fillRect(barX, barY, barWidth, 18);
    context.fillStyle = error ? '#ef6a7a' : '#69d2ff';
    context.fillRect(barX, barY, barWidth * Math.max(0, Math.min(1, progress)), 18);

    context.fillStyle = '#dfe9f8';
    context.font = '700 13px system-ui';
    context.fillText(`${Math.round(progress * 100)}%`, width / 2, barY + 45);
  }

  window.addEventListener('resize', resize);
  resize();

  return { resize, draw };
}
