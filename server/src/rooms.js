'use strict';

const {
  ROOM_CODE_LENGTH,
  SPAWN_P1_X,
  SPAWN_P2_X
} = require('./constants');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function createPlayer(socketId, slot) {
  return {
    socketId,
    slot,
    x: slot === 1 ? SPAWN_P1_X : SPAWN_P2_X,
    direction: 0,
    facing: slot === 1 ? 1 : -1,
    connected: true,
    inputSequence: 0
  };
}

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.socketToRoom = new Map();
  }

  createRoom(socketId) {
    this.removeSocket(socketId);

    const code = this.generateUniqueCode();
    const room = {
      code,
      phase: 'waiting',
      createdAt: Date.now(),
      players: [createPlayer(socketId, 1)]
    };

    this.rooms.set(code, room);
    this.socketToRoom.set(socketId, code);
    return room;
  }

  joinRoom(socketId, rawCode) {
    this.removeSocket(socketId);

    const code = String(rawCode || '').trim().toUpperCase();
    const room = this.rooms.get(code);

    if (!room) {
      return { error: 'ROOM_NOT_FOUND' };
    }

    if (room.phase !== 'waiting' || room.players.length >= 2) {
      return { error: 'ROOM_FULL' };
    }

    const player = createPlayer(socketId, 2);
    room.players.push(player);
    room.phase = 'playing';
    this.socketToRoom.set(socketId, code);

    return { room, player };
  }

  getRoomBySocket(socketId) {
    const code = this.socketToRoom.get(socketId);
    return code ? this.rooms.get(code) || null : null;
  }

  getPlayerBySocket(socketId) {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;
    return room.players.find((player) => player.socketId === socketId) || null;
  }

  removeSocket(socketId) {
    const code = this.socketToRoom.get(socketId);
    if (!code) return null;

    const room = this.rooms.get(code);
    this.socketToRoom.delete(socketId);

    if (!room) return null;

    const leavingPlayer = room.players.find((player) => player.socketId === socketId) || null;
    const opponent = room.players.find((player) => player.socketId !== socketId) || null;

    this.destroyRoom(code);
    return { room, leavingPlayer, opponent };
  }

  destroyRoom(code) {
    const room = this.rooms.get(code);
    if (!room) return;

    for (const player of room.players) {
      this.socketToRoom.delete(player.socketId);
    }

    this.rooms.delete(code);
  }

  generateUniqueCode() {
    let code = '';

    do {
      code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
        const index = Math.floor(Math.random() * CODE_ALPHABET.length);
        code += CODE_ALPHABET[index];
      }
    } while (this.rooms.has(code));

    return code;
  }
}

module.exports = { RoomManager };
