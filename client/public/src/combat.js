'use strict';

const ATTACK_COOLDOWN_MS = 3000;
const ARENA_WIDTH = 1000;

const combatElements = {
  attackButton: document.getElementById('attack-button'),
  cooldownLabel: document.getElementById('attack-cooldown-label'),
  healthP1: Array.from(document.querySelectorAll('#health-p1 .health-pip')),
  healthP2: Array.from(document.querySelectorAll('#health-p2 .health-pip')),
  playAgain: document.getElementById('play-again')
};

Object.assign(game, {
  clockOffsetMs: 0,
  clockInitialized: false,
  localNextAttackAt: 0,
  matchFinished: false,
  rematchRequested: false,
  healthBySlot: new Map([
    [1, 2],
    [2, 2]
  ])
});

function observeServerClock(serverTime, travelAdjustmentMs = 0) {
  if (!Number.isFinite(serverTime)) return;

  const candidateOffset = serverTime + travelAdjustmentMs - Date.now();
  if (!game.clockInitialized) {
    game.clockOffsetMs = candidateOffset;
    game.clockInitialized = true;
    return;
  }

  game.clockOffsetMs += (candidateOffset - game.clockOffsetMs) * 0.16;
}

function estimatedServerNow() {
  return Date.now() + game.clockOffsetMs;
}

function getHealthPips(slot) {
  return slot === 1 ? combatElements.healthP1 : combatElements.healthP2;
}

function renderHealth(slot, health) {
  const pips = getHealthPips(slot);
  const safeHealth = Math.max(0, Math.min(pips.length, Number(health) || 0));

  pips.forEach((pip, index) => {
    pip.classList.toggle('lost', index >= safeHealth);
  });
}

function applySnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.players)) return;

  observeServerClock(Number(snapshot.serverTime));

  for (const player of snapshot.players) {
    game.healthBySlot.set(player.slot, player.health);
    renderHealth(player.slot, player.health);

    if (player.slot === game.localSlot) {
      game.localNextAttackAt = Number(player.nextAttackAt) || 0;
    }
  }

  if (snapshot.phase === 'finished') {
    game.matchFinished = true;
  }
}

function resetCombat(snapshot) {
  game.matchFinished = false;
  game.rematchRequested = false;
  game.localNextAttackAt = 0;
  combatElements.playAgain.classList.add('hidden');
  combatElements.playAgain.disabled = false;
  combatElements.playAgain.textContent = 'Играть снова';

  if (snapshot) applySnapshot(snapshot);
}

function triggerAttackPulse() {
  combatElements.attackButton.classList.remove('attack-pulse');
  void combatElements.attackButton.offsetWidth;
  combatElements.attackButton.classList.add('attack-pulse');
}

function triggerImpact(impactX) {
  const percent = Math.max(0, Math.min(100, (Number(impactX) / ARENA_WIDTH) * 100));
  elements.canvasShell.style.setProperty('--impact-x', `${percent}%`);
  elements.canvasShell.classList.remove('impact');
  void elements.canvasShell.offsetWidth;
  elements.canvasShell.classList.add('impact');

  window.setTimeout(() => {
    elements.canvasShell.classList.remove('impact');
  }, 170);
}

function tryAttack() {
  if (!game.active || game.matchFinished || !socket.connected) return;

  const now = estimatedServerNow();
  if (now < game.localNextAttackAt) return;

  game.localNextAttackAt = now + ATTACK_COOLDOWN_MS;
  triggerAttackPulse();
  socket.emit('player:attack');
}

combatElements.attackButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  tryAttack();
});

window.addEventListener('keydown', (event) => {
  if (event.code !== 'Space' || event.repeat) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

  event.preventDefault();
  tryAttack();
});

combatElements.playAgain.addEventListener('click', () => {
  if (!game.matchFinished || game.rematchRequested) return;

  game.rematchRequested = true;
  combatElements.playAgain.disabled = true;
  combatElements.playAgain.textContent = 'Ожидание соперника…';
  elements.overlayMessage.textContent = 'Ваш запрос отправлен. Второй игрок должен тоже выбрать «Играть снова».';
  socket.emit('match:rematch');
});

socket.on('match:start', (snapshot) => {
  resetCombat(snapshot);
});

socket.on('match:snapshot', applySnapshot);

socket.on('match:attack', (event) => {
  observeServerClock(Number(event.startedAt));

  if (event.attackerSlot === game.localSlot) {
    game.localNextAttackAt = Number(event.nextAttackAt) || game.localNextAttackAt;
    triggerAttackPulse();
  }
});

socket.on('match:attackRejected', (event) => {
  observeServerClock(Number(event.serverTime));

  if (event.reason === 'COOLDOWN' && Number.isFinite(Number(event.readyAt))) {
    game.localNextAttackAt = Number(event.readyAt);
    return;
  }

  game.localNextAttackAt = estimatedServerNow();
});

socket.on('match:hit', (event) => {
  observeServerClock(Number(event.serverTime));
  game.healthBySlot.set(event.targetSlot, event.targetHealth);
  renderHealth(event.targetSlot, event.targetHealth);
  triggerImpact(event.impactX);
});

socket.on('match:end', (event) => {
  observeServerClock(Number(event.serverTime));
  game.matchFinished = true;
  game.active = false;
  sendDirection(0, true);

  const won = event.winnerSlot === game.localSlot;
  elements.overlayTitle.textContent = won ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
  elements.overlayMessage.textContent = won
    ? 'Два точных удара решили бой.'
    : 'Ваше здоровье закончилось. Можно вызвать соперника на реванш.';
  combatElements.playAgain.classList.remove('hidden');
  combatElements.playAgain.disabled = false;
  combatElements.playAgain.textContent = 'Играть снова';
  elements.overlay.classList.remove('hidden');
});

socket.on('match:rematchPending', ({ readySlots = [] }) => {
  const localReady = readySlots.includes(game.localSlot);
  game.rematchRequested = localReady;
  combatElements.playAgain.classList.remove('hidden');
  combatElements.playAgain.disabled = localReady;
  combatElements.playAgain.textContent = localReady ? 'Ожидание соперника…' : 'Принять реванш';
  elements.overlayMessage.textContent = localReady
    ? 'Ожидаем подтверждение второго игрока.'
    : 'Соперник предлагает сыграть ещё раз.';
});

socket.on('latency:pong', ({ sentAt, serverTime }) => {
  const roundTripMs = Math.max(0, performance.now() - Number(sentAt));
  observeServerClock(Number(serverTime), roundTripMs / 2);
});

function hideRematchAfterConnectionLoss() {
  combatElements.playAgain.classList.add('hidden');
  combatElements.playAgain.disabled = true;
}

socket.on('disconnect', hideRematchAfterConnectionLoss);
socket.on('opponent:disconnected', hideRematchAfterConnectionLoss);

function updateCooldownUi() {
  const remainingMs = game.active
    ? Math.max(0, game.localNextAttackAt - estimatedServerNow())
    : 0;
  const ratio = Math.max(0, Math.min(1, remainingMs / ATTACK_COOLDOWN_MS));
  const angle = ratio * 360;
  const ready = game.active && remainingMs <= 0 && !game.matchFinished && socket.connected;

  combatElements.attackButton.style.setProperty('--cooldown-angle', `${angle}deg`);
  combatElements.attackButton.classList.toggle('ready', ready);
  combatElements.attackButton.classList.toggle('cooling-down', game.active && !ready);
  combatElements.attackButton.disabled = !ready;
  combatElements.cooldownLabel.textContent = ready
    ? 'ГОТОВ'
    : game.active
      ? `${(remainingMs / 1000).toFixed(1)} с`
      : 'НЕДОСТУПЕН';

  requestAnimationFrame(updateCooldownUi);
}

renderHealth(1, 2);
renderHealth(2, 2);
requestAnimationFrame(updateCooldownUi);
