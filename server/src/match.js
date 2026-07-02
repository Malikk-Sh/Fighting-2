'use strict';

const {
  ARENA_WIDTH,
  PLAYER_SPEED,
  PLAYER_HALF_WIDTH,
  MIN_PLAYER_GAP,
  SPAWN_P1_X,
  SPAWN_P2_X,
  MAX_HEALTH,
  ATTACK_COOLDOWN_MS,
  ATTACK_RANGE
} = require('./constants');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createMatchId(now = Date.now()) {
  return `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function resetPlayerForMatch(player, now = Date.now()) {
  player.x = player.slot === 1 ? SPAWN_P1_X : SPAWN_P2_X;
  player.direction = 0;
  player.facing = player.slot === 1 ? 1 : -1;
  player.health = MAX_HEALTH;
  player.nextAttackAt = now;
  player.lastAttackAt = 0;
  player.attackSequence = 0;
  player.hitSequence = 0;
  player.inputSequence = 0;
}

function startMatch(room, now = Date.now()) {
  room.phase = 'playing';
  room.matchId = createMatchId(now);
  room.winnerSlot = null;
  room.finishedAt = null;
  room.rematchReadySlots = new Set();

  for (const player of room.players) {
    resetPlayerForMatch(player, now);
  }

  return room;
}

function updateRoom(room, deltaSeconds) {
  if (room.phase !== 'playing' || room.players.length !== 2) return;

  const playerOne = room.players.find((player) => player.slot === 1);
  const playerTwo = room.players.find((player) => player.slot === 2);
  if (!playerOne || !playerTwo) return;

  playerOne.x += playerOne.direction * PLAYER_SPEED * deltaSeconds;
  playerTwo.x += playerTwo.direction * PLAYER_SPEED * deltaSeconds;

  const minX = PLAYER_HALF_WIDTH;
  const maxX = ARENA_WIDTH - PLAYER_HALF_WIDTH;
  playerOne.x = clamp(playerOne.x, minX, maxX);
  playerTwo.x = clamp(playerTwo.x, minX, maxX);

  if (playerTwo.x - playerOne.x < MIN_PLAYER_GAP) {
    const midpoint = (playerOne.x + playerTwo.x) / 2;
    playerOne.x = midpoint - MIN_PLAYER_GAP / 2;
    playerTwo.x = midpoint + MIN_PLAYER_GAP / 2;

    if (playerOne.x < minX) {
      playerOne.x = minX;
      playerTwo.x = minX + MIN_PLAYER_GAP;
    }

    if (playerTwo.x > maxX) {
      playerTwo.x = maxX;
      playerOne.x = maxX - MIN_PLAYER_GAP;
    }
  }

  playerOne.facing = 1;
  playerTwo.facing = -1;
}

function resolveAttack(room, attackerSlot, now = Date.now()) {
  if (!room || room.phase !== 'playing') {
    return { accepted: false, reason: 'MATCH_NOT_ACTIVE' };
  }

  const attacker = room.players.find((player) => player.slot === attackerSlot);
  const target = room.players.find((player) => player.slot !== attackerSlot);

  if (!attacker || !target) {
    return { accepted: false, reason: 'PLAYER_NOT_FOUND' };
  }

  if (now < attacker.nextAttackAt) {
    return {
      accepted: false,
      reason: 'COOLDOWN',
      readyAt: attacker.nextAttackAt
    };
  }

  attacker.lastAttackAt = now;
  attacker.nextAttackAt = now + ATTACK_COOLDOWN_MS;
  attacker.attackSequence += 1;

  const signedDistance = (target.x - attacker.x) * attacker.facing;
  const distance = Math.abs(target.x - attacker.x);
  const hit = signedDistance > 0 && distance <= ATTACK_RANGE;

  if (hit) {
    target.health = Math.max(0, target.health - 1);
    target.hitSequence += 1;
  }

  let ended = false;
  if (hit && target.health === 0) {
    room.phase = 'finished';
    room.winnerSlot = attacker.slot;
    room.finishedAt = now;
    attacker.direction = 0;
    target.direction = 0;
    ended = true;
  }

  return {
    accepted: true,
    hit,
    ended,
    attackerSlot: attacker.slot,
    targetSlot: target.slot,
    startedAt: now,
    nextAttackAt: attacker.nextAttackAt,
    distance,
    targetHealth: target.health,
    impactX: (attacker.x + target.x) / 2,
    winnerSlot: room.winnerSlot
  };
}

function requestRematch(room, slot, now = Date.now()) {
  if (!room || room.phase !== 'finished') {
    return { accepted: false, reason: 'MATCH_NOT_FINISHED' };
  }

  if (!room.players.some((player) => player.slot === slot)) {
    return { accepted: false, reason: 'PLAYER_NOT_FOUND' };
  }

  if (!(room.rematchReadySlots instanceof Set)) {
    room.rematchReadySlots = new Set();
  }

  room.rematchReadySlots.add(slot);
  const readySlots = Array.from(room.rematchReadySlots).sort();

  if (room.rematchReadySlots.size < room.players.length) {
    return { accepted: true, started: false, readySlots };
  }

  startMatch(room, now);
  return { accepted: true, started: true, readySlots: [] };
}

function serializeRoom(room, now = Date.now()) {
  return {
    code: room.code,
    matchId: room.matchId || null,
    phase: room.phase,
    winnerSlot: room.winnerSlot || null,
    serverTime: now,
    rematchReadySlots:
      room.rematchReadySlots instanceof Set
        ? Array.from(room.rematchReadySlots).sort()
        : [],
    players: room.players.map((player) => ({
      slot: player.slot,
      x: player.x,
      direction: player.direction,
      facing: player.facing,
      connected: player.connected,
      health: player.health,
      maxHealth: MAX_HEALTH,
      nextAttackAt: player.nextAttackAt,
      lastAttackAt: player.lastAttackAt,
      attackSequence: player.attackSequence,
      hitSequence: player.hitSequence
    }))
  };
}

module.exports = {
  resetPlayerForMatch,
  startMatch,
  updateRoom,
  resolveAttack,
  requestRematch,
  serializeRoom
};
