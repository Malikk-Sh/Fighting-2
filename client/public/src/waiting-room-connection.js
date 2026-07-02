'use strict';

let waitingRoomInvalidatedByDisconnect = false;

function showWaitingRoomDisconnectNotice() {
  setLobbyMessage(
    'Соединение потеряно. Комната ожидания закрыта — после восстановления связи создайте новую.'
  );
}

socket.on('disconnect', () => {
  const wasWaitingForOpponent =
    elements.waiting.classList.contains('active') && Boolean(game.roomCode);

  if (!wasWaitingForOpponent) return;

  waitingRoomInvalidatedByDisconnect = true;
  resetToLobby();
  showWaitingRoomDisconnectNotice();
});

socket.on('connect', () => {
  if (!waitingRoomInvalidatedByDisconnect) return;

  showWaitingRoomDisconnectNotice();
  waitingRoomInvalidatedByDisconnect = false;
});
