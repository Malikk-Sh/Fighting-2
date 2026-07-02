' strict';

require('dotenv').config();

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { RoomManager } = require('./rooms');
const {
  TICK_RATE,
  SNAPSHOT_RATE,
  ARENA_WIDTH,
  PLAYER_SPEED,
  PLAYER_HALF_WIDTH,
  MIN_PLAYER_GAP
} = require('./constants');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN === '*' ? true : CLIENT_ORIGIN,
    methods: ['GET', 'POST']
  }
});

const rooms = new RoomManager();
const publicDir = path.resolve(__dirname, '../../client/public');

app.disable('x-powered-by');
app.use(express.static(publicDir));
app.get('/health', (_request, response) => {
  response.json({ ok: true, rooms: rooms.rooms.size, time: Date.now() });
});
app.get('*', (_request, response) => {
  response.sendFile(path.join(publicDir, 'index.html'));
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function serializeRoom(room) {
  return {
    code: room.code,
    phase: room.phase,
    serverTime: Date.now(),
    players: room.players.map((player) => ({
      slot: player.slot,
      x: player.x,
      direction: player.direction,
      facing: player.facing,
      connected: player.connected
    }))
  };
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

function emitServerError(socket, code, message) {
  socket.emit('server:error', { code, message });
}

io.on('connection', (socket) => {
  socket.emit('connection:ready', { socketId: socket.id, serverTime: Date.now() });

  socket.on('room:create', () => {
    const room = rooms.createRoom(socket.id);
    socket.join(room.code);
    socket.emit('room:created', { code: room.code, slot: 1 });
    socket.emit('room:waiting', { code: room.code });
  });

  socket.on('room:join', (payload = {}) => {
    const result = rooms.joinRoom(socket.id, payload.code);

    if (result.error === 'ROOM_NOT_FOUND') {
      emitServerError(socket, result.error, 'Комната с таким кодом не найдена.');
      return;
    }

    if (result.error === 'ROOM_FULL') {
      emitServerError(socket, result.error, 'Комната уже заполнена или матч начался.');
      return;
    }

    const { room, player } = result;
    socket.join(room.code);
    socket.emit('room:joined', { code: room.code, slot: player.slot });
    io.to(room.code).emit('match:start', serializeRoom(room));
  });

  socket.on('player:input', (payload = {}) => {
    const room = rooms.getRoomBySocket(socket.id);
    const player = rooms.getPlayerBySocket(socket.id);
    if (!room || !player || room.phase !== 'playing') return;

    const direction = Number(payload.direction);
    const sequence = Number(payload.sequence);

    if (![-1, 0, 1].includes(direction)) return;
    if (!Number.isSafeInteger(sequence) || sequence < player.inputSequence) return;

    player.direction = direction;
    player.inputSequence = sequence;
  });

  socket.on('latency:ping', (payload = {}) => {
    socket.emit('latency:pong', {
      sentAt: Number(payload.sentAt) || 0,
      serverTime: Date.now()
    });
  });

  socket.on('disconnect', () => {
    const result = rooms.removeSocket(socket.id);
    if (!result || !result.opponent) return;

    const opponentSocket = io.sockets.sockets.get(result.opponent.socketId);
    if (opponentSocket) {
      opponentSocket.leave(result.room.code);
      opponentSocket.emit('opponent:disconnected', {
        reason: 'connection_lost'
      });
    }
  });
});

let previousTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const deltaSeconds = Math.min((now - previousTick) / 1000, 0.1);
  previousTick = now;

  for (const room of rooms.rooms.values()) {
    updateRoom(room, deltaSeconds);
  }
}, 1000 / TICK_RATE);

setInterval(() => {
  for (const room of rooms.rooms.values()) {
    if (room.phase === 'playing') {
      io.to(room.code).emit('match:snapshot', serializeRoom(room));
    }
  }
}, 1000 / SNAPSHOT_RATE);

httpServer.listen(PORT, HOST, () => {
  console.log(`Fighting-2 listening on http://${HOST}:${PORT}`);
});
