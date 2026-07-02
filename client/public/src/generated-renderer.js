'use strict';

(() => {
  const SPRITE_COLUMNS = 6;
  const SPRITE_ROWS = 4;
  const EFFECT_COLUMNS = 6;
  const EFFECT_ROWS = 2;
  const FIGHTER_DRAW_SIZE = 238;
  const EFFECT_DRAW_SIZE = 230;
  const FLOOR_Y = 438;

  const assetPaths = Object.freeze({
    fighterRonin: '/assets/generated/fighter-ronin.webp',
    fighterKage: '/assets/generated/fighter-kage.webp',
    effects: '/assets/generated/effects.webp',
    arenas: [
      '/assets/generated/arena-moon.webp',
      '/assets/generated/arena-shrine.webp',
      '/assets/generated/arena-bloodmoon.webp'
    ]
  });

  const originalDrawArena = drawArena;
  const originalDrawPlayer = drawPlayer;
  const images = {
    fighterRonin: createImage(assetPaths.fighterRonin),
    fighterKage: createImage(assetPaths.fighterKage),
    effects: createImage(assetPaths.effects),
    arenas: assetPaths.arenas.map(createImage)
  };

  const animationState = new Map([
    [1, createAnimationState()],
    [2, createAnimationState()]
  ]);

  let selectedArenaIndex = 1;

  function createImage(source) {
    const image = new Image();
    image.decoding = 'async';
    image.src = source;
    return image;
  }

  function imageIsReady(image) {
    return Boolean(image && image.complete && image.naturalWidth > 0);
  }

  function createAnimationState() {
    return {
      attackStartedAt: -Infinity,
      hitStartedAt: -Infinity,
      knockoutStartedAt: -Infinity,
      victoryStartedAt: -Infinity
    };
  }

  function resetAnimations() {
    for (const state of animationState.values()) {
      state.attackStartedAt = -Infinity;
      state.hitStartedAt = -Infinity;
      state.knockoutStartedAt = -Infinity;
      state.victoryStartedAt = -Infinity;
    }
  }

  function hashRoomCode(code) {
    let hash = 0;
    for (const character of String(code || '')) {
      hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    }
    return hash;
  }

  function chooseArena(code) {
    selectedArenaIndex = hashRoomCode(code) % images.arenas.length;
  }

  function drawCoverImage(image, timeSeconds) {
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = LOGICAL_WIDTH / LOGICAL_HEIGHT;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;

    if (sourceRatio > targetRatio) {
      sourceWidth = sourceHeight * targetRatio;
    } else {
      sourceHeight = sourceWidth / targetRatio;
    }

    const pan = Math.sin(timeSeconds * 0.08) * Math.min(12, image.naturalWidth * 0.008);
    const sourceX = Math.max(
      0,
      Math.min(image.naturalWidth - sourceWidth, (image.naturalWidth - sourceWidth) / 2 + pan)
    );
    const sourceY = Math.max(0, (image.naturalHeight - sourceHeight) / 2);

    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      LOGICAL_WIDTH,
      LOGICAL_HEIGHT
    );
  }

  function drawGeneratedArena(timeSeconds) {
    const arena = images.arenas[selectedArenaIndex];
    if (!imageIsReady(arena)) {
      originalDrawArena(timeSeconds);
      return;
    }

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    drawCoverImage(arena, timeSeconds);

    const lowerShade = ctx.createLinearGradient(0, 280, 0, LOGICAL_HEIGHT);
    lowerShade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    lowerShade.addColorStop(0.72, 'rgba(0, 0, 0, 0.08)');
    lowerShade.addColorStop(1, 'rgba(0, 0, 0, 0.52)');
    ctx.fillStyle = lowerShade;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    const vignette = ctx.createRadialGradient(
      LOGICAL_WIDTH / 2,
      LOGICAL_HEIGHT * 0.46,
      130,
      LOGICAL_WIDTH / 2,
      LOGICAL_HEIGHT * 0.46,
      650
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.restore();
  }

  function resolveAnimation(player, now) {
    const state = animationState.get(player.slot) || createAnimationState();

    if (player.health <= 0 || Number.isFinite(state.knockoutStartedAt)) {
      if (!Number.isFinite(state.knockoutStartedAt)) state.knockoutStartedAt = now;
      return {
        row: 3,
        frame: Math.min(5, Math.floor((now - state.knockoutStartedAt) / 115))
      };
    }

    const hitElapsed = now - state.hitStartedAt;
    if (hitElapsed >= 0 && hitElapsed < 300) {
      return {
        row: 3,
        frame: Math.min(1, Math.floor(hitElapsed / 145))
      };
    }

    const attackElapsed = now - state.attackStartedAt;
    if (attackElapsed >= 0 && attackElapsed < 540) {
      return {
        row: 2,
        frame: Math.min(5, Math.floor(attackElapsed / 90))
      };
    }

    if (player.direction !== 0) {
      return {
        row: 1,
        frame: Math.floor(now / 92) % 6
      };
    }

    if (now - state.victoryStartedAt >= 0 && now - state.victoryStartedAt < 720) {
      return { row: 2, frame: 5 };
    }

    return {
      row: 0,
      frame: Math.floor(now / 155) % 6
    };
  }

  function drawSpriteFrame(image, row, frame, size) {
    const frameWidth = image.naturalWidth / SPRITE_COLUMNS;
    const frameHeight = image.naturalHeight / SPRITE_ROWS;
    const sourceX = frame * frameWidth;
    const sourceY = row * frameHeight;

    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      frameWidth,
      frameHeight,
      -size / 2,
      -size + 8,
      size,
      size
    );
  }

  function drawEffectFrame(row, frame, size) {
    if (!imageIsReady(images.effects)) return;

    const frameWidth = images.effects.naturalWidth / EFFECT_COLUMNS;
    const frameHeight = images.effects.naturalHeight / EFFECT_ROWS;
    const sourceX = Math.max(0, Math.min(5, frame)) * frameWidth;
    const sourceY = row * frameHeight;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.92;
    ctx.drawImage(
      images.effects,
      sourceX,
      sourceY,
      frameWidth,
      frameHeight,
      -size / 2,
      -size / 2,
      size,
      size
    );
    ctx.restore();
  }

  function drawGeneratedPlayer(player, deltaSeconds) {
    const fighterImage = player.slot === 1 ? images.fighterRonin : images.fighterKage;
    if (!imageIsReady(fighterImage)) {
      originalDrawPlayer(player, deltaSeconds);
      return;
    }

    const targetX = player.x;
    const previousX = game.visualX.has(player.slot) ? game.visualX.get(player.slot) : targetX;
    const smoothing = 1 - Math.exp(-16 * deltaSeconds);
    const visualX = previousX + (targetX - previousX) * smoothing;
    game.visualX.set(player.slot, visualX);

    const now = performance.now();
    const animation = resolveAnimation(player, now);
    const state = animationState.get(player.slot);
    const facing = player.facing < 0 ? -1 : 1;
    const isLocal = player.slot === game.localSlot;

    ctx.save();
    ctx.translate(visualX, FLOOR_Y);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
    ctx.beginPath();
    ctx.ellipse(0, 7, 62, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isLocal && player.health > 0) {
      const aura = ctx.createRadialGradient(0, -75, 18, 0, -75, 105);
      aura.addColorStop(0, 'rgba(255, 255, 255, 0.11)');
      aura.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = aura;
      ctx.fillRect(-120, -220, 240, 230);
    }

    ctx.scale(facing, 1);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    drawSpriteFrame(fighterImage, animation.row, animation.frame, FIGHTER_DRAW_SIZE);

    const attackElapsed = now - state.attackStartedAt;
    if (attackElapsed >= 145 && attackElapsed < 500) {
      const effectFrame = Math.min(5, Math.floor((attackElapsed - 145) / 58));
      ctx.save();
      ctx.translate(76, -106);
      drawEffectFrame(0, effectFrame, EFFECT_DRAW_SIZE);
      ctx.restore();
    }

    const hitElapsed = now - state.hitStartedAt;
    if (hitElapsed >= 0 && hitElapsed < 380) {
      const effectFrame = Math.min(5, Math.floor(hitElapsed / 64));
      ctx.save();
      ctx.scale(facing, 1);
      ctx.translate(0, -112);
      drawEffectFrame(1, effectFrame, EFFECT_DRAW_SIZE * 0.86);
      ctx.restore();
    }

    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '900 18px system-ui';
    ctx.fillStyle = isLocal ? '#ffffff' : '#f08a83';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 7;
    ctx.fillText(`P${player.slot}`, visualX, FLOOR_Y - 220);
    ctx.restore();
  }

  drawArena = drawGeneratedArena;
  drawPlayer = drawGeneratedPlayer;

  socket.on('match:start', (snapshot) => {
    resetAnimations();
    chooseArena(snapshot && snapshot.code);
  });

  socket.on('match:attack', ({ attackerSlot }) => {
    const state = animationState.get(attackerSlot);
    if (state) state.attackStartedAt = performance.now();
  });

  socket.on('match:hit', ({ targetSlot }) => {
    const state = animationState.get(targetSlot);
    if (state) state.hitStartedAt = performance.now();
  });

  socket.on('match:end', ({ winnerSlot }) => {
    const now = performance.now();
    for (const [slot, state] of animationState.entries()) {
      if (slot === winnerSlot) {
        state.victoryStartedAt = now;
      } else {
        state.knockoutStartedAt = now;
      }
    }
  });

  window.generatedAssetStatus = Object.freeze({
    paths: assetPaths,
    images
  });
})();
