'use strict';

const socket = io({
  transports: ['websocket', 'polling']
});

const LOGICAL_WIDTH = 1000;
const LOGICAL_HEIGHT = 560;
const INTERPOLATION_DELAY_MS = 100;

const elements = {
  screens: Array.from(document.querySelectorAll('.screen')),
  lobby: document.getElementById('lobby-screen'),
  waiting: document.getElementById('waiting-screen'),
  game: document.getElementById('game-screen'),
  createRoom: document.getElementById('create-room'),
  joinForm: document.getElementById('join-form'),
  roomCodeInput: document.getElementById('room-code'),
  lobbyMessage: document.getElementById('lobby-message'),
  waitingCode: document.getElementById('waiting-code'),
  copyCode: document.getElementById('copy-code'),
  hudRoom: document.getElementById('hud-room'),
  connectionDot: document.getElementById('connection-dot'),
  connectionText: document.getElementById('connection-text'),
  pingLabel: document.getElementById('ping-label'),
  canvas: document.getElementById('game-canvas'),
  canvasShell: document.getElementById('canvas-shell'),
  overlay: document.getElementById('game-overlay'),
  overlayTitle: document.getElementById('overlay-title'),
  overlayMessage: document.getElementById('overlay-message'),
  returnLobby: document.getElementById('return-lobby'),
  moveLeft: document.getElementById('move-left'),
  moveRight: document.getElementById('move-right')
};

const ctx = elements.canvas.getContext('2d', { alpha: false });

const game = {
  roomCode: '',
  localSlot: null,
  active: false,
  snapshots: [],
  visualX: new Map(),
  inputSequence: 0,
  direction: 0,
  leftHeld: false,
  rightHeld: false,
  previousFrameTime: performance.now()
};

function showScreen(screen) {
  for (const item of elements.screens) {
    item.classList.toggle('active', item === screen);
  }
}

function setConnectionStatus(isOnline) {
  elements.connectionDot.classList.toggle('offline', !isOnline);
  elements.connectionText.textContent = isOnline ? 'Подключено' : 'Нет связи';
}

function setLobbyMessage(message) {
  elements.lobbyMessage.textContent = message || '';
}

function resetToLobby() {
  game.active = false;
  game.roomCode = '';
  game.localSlot = null;
  game.snapshots.length = 0;
  game.visualX.clear();
  game.leftHeld = false;
  game.rightHeld = false;
  game.direction = 0;
  elements.overlay.classList.add('hidden');
  elements.roomCodeInput.value = '';
  setLobbyMessage('');
  updateHeldButtonStyles();
  showScreen(elements.lobby);
}

function openGameOverlay(title, message) {
  game.active = false;
  sendDirection(0, true);
  elements.overlayTitle.textContent = title;
  elements.overlayMessage.textContent = message;
  elements.overlay.classList.remove('hidden');
}

function normalizeRoomCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
}

function sendDirection(direction, force = false) {
  if (!force && (!game.active || direction === game.direction)) return;

  game.direction = direction;
  game.inputSequence += 1;
  socket.emit('player:input', {
    direction,
    sequence: game.inputSequence
  });
}

function updateDirectionFromControls() {
  const direction = Number(game.rightHeld) - Number(game.leftHeld);
  sendDirection(direction);
  updateHeldButtonStyles();
}

function updateHeldButtonStyles() {
  elements.moveLeft.classList.toggle('is-held', game.leftHeld);
  elements.moveRight.classList.toggle('is-held', game.rightHeld);
}

function bindHoldButton(button, side) {
  const setHeld = (held) => {
    if (side === 'left') game.leftHeld = held;
    if (side === 'right') game.rightHeld = held;
    updateDirectionFromControls();
  };

  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    setHeld(true);
  });

  const release = (event) => {
    event.preventDefault();
    setHeld(false);
  };

  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', () => setHeld(false));
}

bindHoldButton(elements.moveLeft, 'left');
bindHoldButton(elements.moveRight, 'right');

elements.createRoom.addEventListener('click', () => {
  setLobbyMessage('Создаём комнату…');
  socket.emit('room:create');
});

elements.joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const code = normalizeRoomCode(elements.roomCodeInput.value);

  if (code.length !== 4) {
    setLobbyMessage('Введите четырёхзначный код комнаты.');
    return;
  }

  setLobbyMessage('Подключаемся…');
  socket.emit('room:join', { code });
});

elements.roomCodeInput.addEventListener('input', () => {
  elements.roomCodeInput.value = normalizeRoomCode(elements.roomCodeInput.value);
});

elements.copyCode.addEventListener('click', async () => {
  if (!game.roomCode) return;

  try {
    await navigator.clipboard.writeText(game.roomCode);
    elements.copyCode.textContent = 'Код скопирован';
  } catch (_error) {
    elements.copyCode.textContent = game.roomCode;
  }

  window.setTimeout(() => {
    elements.copyCode.textContent = 'Копировать код';
  }, 1400);
});

elements.returnLobby.addEventListener('click', resetToLobby);

window.addEventListener('keydown', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

  if (['KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight'].includes(event.code)) {
    event.preventDefault();
  }

  if (event.code === 'KeyA' || event.code === 'ArrowLeft') game.leftHeld = true;
  if (event.code === 'KeyD' || event.code === 'ArrowRight') game.rightHeld = true;
  updateDirectionFromControls();
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'KeyA' || event.code === 'ArrowLeft') game.leftHeld = false;
  if (event.code === 'KeyD' || event.code === 'ArrowRight') game.rightHeld = false;
  updateDirectionFromControls();
});

window.addEventListener('blur', () => {
  game.leftHeld = false;
  game.rightHeld = false;
  updateDirectionFromControls();
});

socket.on('connect', () => {
  setConnectionStatus(true);
  setLobbyMessage('');
});

socket.on('disconnect', () => {
  setConnectionStatus(false);
  if (game.active) {
    openGameOverlay('Соединение потеряно', 'Клиент отключился от игрового сервера.');
  }
});

socket.on('room:created', ({ code, slot }) => {
  game.roomCode = code;
  game.localSlot = slot;
  elements.waitingCode.textContent = code;
  elements.hudRoom.textContent = code;
  showScreen(elements.waiting);
});

socket.on('room:joined', ({ code, slot }) => {
  game.roomCode = code;
  game.localSlot = slot;
  elements.hudRoom.textContent = code;
});

socket.on('room:waiting', ({ code }) => {
  game.roomCode = code;
  elements.waitingCode.textContent = code;
  showScreen(elements.waiting);
});

socket.on('match:start', (snapshot) => {
  game.roomCode = snapshot.code;
  game.active = true;
  game.snapshots.length = 0;
  game.visualX.clear();
  elements.hudRoom.textContent = snapshot.code;
  elements.overlay.classList.add('hidden');
  addSnapshot(snapshot);
  showScreen(elements.game);
});

socket.on('match:snapshot', addSnapshot);

socket.on('opponent:disconnected', () => {
  openGameOverlay('Соперник отключился', 'Комната закрыта. Можно вернуться в меню и создать новый матч.');
});

socket.on('server:error', ({ message }) => {
  setLobbyMessage(message || 'Ошибка сервера.');
  showScreen(elements.lobby);
});

socket.on('latency:pong', ({ sentAt }) => {
  const ping = Math.max(0, Math.round(performance.now() - Number(sentAt)));
  elements.pingLabel.textContent = `${ping} ms`;
});

function addSnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.players)) return;

  game.snapshots.push({
    ...snapshot,
    clientTime: performance.now()
  });

  if (game.snapshots.length > 30) {
    game.snapshots.splice(0, game.snapshots.length - 30);
  }
}

function findPlayer(snapshot, slot) {
  return snapshot.players.find((player) => player.slot === slot) || null;
}

function getRenderTargets(now) {
  if (game.snapshots.length === 0) return [];

  const latest = game.snapshots[game.snapshots.length - 1];
  const targetTime = now - INTERPOLATION_DELAY_MS;
  let older = game.snapshots[0];
  let newer = latest;

  for (let index = 0; index < game.snapshots.length - 1; index += 1) {
    const first = game.snapshots[index];
    const second = game.snapshots[index + 1];

    if (first.clientTime <= targetTime && second.clientTime >= targetTime) {
      older = first;
      newer = second;
      break;
    }

    if (targetTime > second.clientTime) {
      older = second;
      newer = second;
    }
  }

  const span = Math.max(1, newer.clientTime - older.clientTime);
  const alpha = Math.max(0, Math.min(1, (targetTime - older.clientTime) / span));

  return latest.players.map((latestPlayer) => {
    if (latestPlayer.slot === game.localSlot) {
      return { ...latestPlayer, x: latestPlayer.x };
    }

    const olderPlayer = findPlayer(older, latestPlayer.slot) || latestPlayer;
    const newerPlayer = findPlayer(newer, latestPlayer.slot) || latestPlayer;
    return {
      ...latestPlayer,
      x: olderPlayer.x + (newerPlayer.x - olderPlayer.x) * alpha
    };
  });
}

function resizeCanvas() {
  const rect = elements.canvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5);
  const width = Math.max(1, Math.round(rect.width * pixelRatio));
  const height = Math.max(1, Math.round(rect.height * pixelRatio));

  if (elements.canvas.width !== width || elements.canvas.height !== height) {
    elements.canvas.width = width;
    elements.canvas.height = height;
  }
}

function drawArena(timeSeconds) {
  const sky = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
  sky.addColorStop(0, '#11142a');
  sky.addColorStop(0.58, '#28152f');
  sky.addColorStop(1, '#090a0d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  ctx.globalAlpha = 0.78;
  ctx.fillStyle = '#d8d7e8';
  ctx.beginPath();
  ctx.arc(790, 105, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const farShift = Math.sin(timeSeconds * 0.08) * 6;
  ctx.fillStyle = '#10101a';
  ctx.beginPath();
  ctx.moveTo(0, 330);
  ctx.lineTo(160 + farShift, 165);
  ctx.lineTo(300 + farShift, 330);
  ctx.lineTo(470 + farShift, 205);
  ctx.lineTo(650 + farShift, 330);
  ctx.lineTo(820 + farShift, 190);
  ctx.lineTo(1000, 326);
  ctx.lineTo(1000, 420);
  ctx.lineTo(0, 420);
  ctx.closePath();
  ctx.fill();

  const haze = ctx.createLinearGradient(0, 300, 0, 445);
  haze.addColorStop(0, 'rgba(155, 72, 126, 0.22)');
  haze.addColorStop(1, 'rgba(4, 5, 8, 0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 270, LOGICAL_WIDTH, 190);

  ctx.fillStyle = '#09090c';
  ctx.fillRect(0, 420, LOGICAL_WIDTH, 140);

  ctx.strokeStyle = 'rgba(255,255,255,0.055)';
  ctx.lineWidth = 2;
  for (let x = -80; x < LOGICAL_WIDTH + 100; x += 105) {
    ctx.beginPath();
    ctx.moveTo(x, 560);
    ctx.lineTo(500 + (x - 500) * 0.35, 420);
    ctx.stroke();
  }

  for (let y = 442; y < 560; y += 28) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(LOGICAL_WIDTH, y);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(226, 33, 25, 0.12)';
  ctx.fillRect(0, 418, LOGICAL_WIDTH, 3);
}

function drawPlayer(player, deltaSeconds) {
  const targetX = player.x;
  const previousX = game.visualX.has(player.slot) ? game.visualX.get(player.slot) : targetX;
  const smoothing = 1 - Math.exp(-16 * deltaSeconds);
  const visualX = previousX + (targetX - previousX) * smoothing;
  game.visualX.set(player.slot, visualX);

  const floorY = 438;
  const width = 68;
  const height = 152;
  const isLocal = player.slot === game.localSlot;

  ctx.save();
  ctx.translate(visualX, floorY);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 54, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  const bodyGradient = ctx.createLinearGradient(-width / 2, -height, width / 2, 0);
  if (player.slot === 1) {
    bodyGradient.addColorStop(0, '#f2eee8');
    bodyGradient.addColorStop(0.5, '#b7b4b5');
    bodyGradient.addColorStop(1, '#292931');
  } else {
    bodyGradient.addColorStop(0, '#ef3b31');
    bodyGradient.addColorStop(0.55, '#81100e');
    bodyGradient.addColorStop(1, '#200606');
  }

  ctx.shadowColor = isLocal ? 'rgba(255,255,255,0.24)' : 'rgba(226,33,25,0.24)';
  ctx.shadowBlur = 22;
  ctx.fillStyle = bodyGradient;
  ctx.fillRect(-width / 2, -height, width, height);
  ctx.shadowBlur = 0;

  ctx.strokeStyle = isLocal ? '#ffffff' : '#f06a63';
  ctx.lineWidth = isLocal ? 4 : 3;
  ctx.strokeRect(-width / 2, -height, width, height);

  ctx.fillStyle = '#0a0a0d';
  ctx.fillRect(-width / 2 + 8, -height + 50, width - 16, 8);

  ctx.fillStyle = '#f7f3eb';
  ctx.font = '900 20px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(`P${player.slot}`, 0, -height - 18);

  if (player.direction !== 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '700 18px system-ui';
    ctx.fillText(player.direction < 0 ? '←' : '→', 0, -height / 2 + 8);
  }

  ctx.restore();
}

function render(frameTime) {
  resizeCanvas();

  const deltaSeconds = Math.min((frameTime - game.previousFrameTime) / 1000, 0.1);
  game.previousFrameTime = frameTime;

  const scaleX = elements.canvas.width / LOGICAL_WIDTH;
  const scaleY = elements.canvas.height / LOGICAL_HEIGHT;
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  drawArena(frameTime / 1000);

  const players = getRenderTargets(frameTime);
  for (const player of players) {
    drawPlayer(player, deltaSeconds);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  requestAnimationFrame(render);
}

new ResizeObserver(resizeCanvas).observe(elements.canvasShell);
window.addEventListener('resize', resizeCanvas);

window.setInterval(() => {
  if (socket.connected) {
    socket.emit('latency:ping', { sentAt: performance.now() });
  }
}, 2000);

setConnectionStatus(socket.connected);
showScreen(elements.lobby);
requestAnimationFrame(render);
