'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPlayer } = require('../src/rooms');
const {
  startMatch,
  resolveAttack,
  requestRematch
} = require('../src/match');
const {
  MAX_HEALTH,
  ATTACK_COOLDOWN_MS,
  ATTACK_RANGE
} = require('../src/constants');

function createRoom() {
  return {
    code: 'TEST',
    phase: 'waiting',
    players: [createPlayer('one', 1), createPlayer('two', 2)],
    rematchReadySlots: new Set()
  };
}

test('attack in range damages the opponent', () => {
  const room = createRoom();
  startMatch(room, 1000);
  room.players[0].x = 400;
  room.players[1].x = 400 + ATTACK_RANGE;

  const result = resolveAttack(room, 1, 2000);

  assert.equal(result.accepted, true);
  assert.equal(result.hit, true);
  assert.equal(room.players[1].health, MAX_HEALTH - 1);
  assert.equal(room.players[0].nextAttackAt, 2000 + ATTACK_COOLDOWN_MS);
});

test('miss still consumes the attack cooldown', () => {
  const room = createRoom();
  startMatch(room, 1000);
  room.players[0].x = 200;
  room.players[1].x = 800;

  const result = resolveAttack(room, 1, 2000);

  assert.equal(result.accepted, true);
  assert.equal(result.hit, false);
  assert.equal(room.players[1].health, MAX_HEALTH);
  assert.equal(room.players[0].nextAttackAt, 2000 + ATTACK_COOLDOWN_MS);
});

test('server rejects attacks made during cooldown', () => {
  const room = createRoom();
  startMatch(room, 1000);
  room.players[0].x = 400;
  room.players[1].x = 500;

  resolveAttack(room, 1, 2000);
  const rejected = resolveAttack(room, 1, 2500);

  assert.equal(rejected.accepted, false);
  assert.equal(rejected.reason, 'COOLDOWN');
  assert.equal(rejected.readyAt, 2000 + ATTACK_COOLDOWN_MS);
  assert.equal(room.players[1].health, MAX_HEALTH - 1);
});

test('two successful hits finish the match', () => {
  const room = createRoom();
  startMatch(room, 1000);
  room.players[0].x = 400;
  room.players[1].x = 500;

  resolveAttack(room, 1, 2000);
  const finalHit = resolveAttack(room, 1, 2000 + ATTACK_COOLDOWN_MS);

  assert.equal(finalHit.ended, true);
  assert.equal(room.phase, 'finished');
  assert.equal(room.winnerSlot, 1);
  assert.equal(room.players[1].health, 0);
});

test('rematch starts only after both players are ready', () => {
  const room = createRoom();
  startMatch(room, 1000);
  room.phase = 'finished';
  room.winnerSlot = 1;
  room.players[1].health = 0;

  const first = requestRematch(room, 1, 5000);
  assert.equal(first.started, false);
  assert.deepEqual(first.readySlots, [1]);
  assert.equal(room.phase, 'finished');

  const second = requestRematch(room, 2, 6000);
  assert.equal(second.started, true);
  assert.equal(room.phase, 'playing');
  assert.equal(room.winnerSlot, null);
  assert.equal(room.players[0].health, MAX_HEALTH);
  assert.equal(room.players[1].health, MAX_HEALTH);
});
