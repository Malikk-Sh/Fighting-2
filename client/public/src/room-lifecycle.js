'use strict';

const returnLobbyButton = document.getElementById('return-lobby');

returnLobbyButton.addEventListener(
  'click',
  () => {
    if (game.roomCode && socket.connected) {
      socket.emit('room:leave');
    }
  },
  { capture: true }
);
