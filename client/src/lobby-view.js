export function createLobbyView({ panel, nameInput, roomSelect, roomList, joinButton }) {
  let rooms = [];

  function setRooms(nextRooms) {
    rooms = nextRooms;
    roomSelect.replaceChildren();
    roomList.replaceChildren();

    if (rooms.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No rooms available.';
      roomList.append(empty);
      joinButton.disabled = true;
      return;
    }

    for (const room of rooms) {
      const option = document.createElement('option');
      option.value = room.id;
      option.textContent = `${room.name} — ${room.players}/${room.maxPlayers}`;
      roomSelect.append(option);

      const card = document.createElement('div');
      card.className = 'room-card';
      card.innerHTML = `<strong>${room.name}</strong><span>${room.players}/${room.maxPlayers} players</span><small>${room.width}×${room.height} · ${room.asteroids} asteroids · ${room.enemies} enemies</small>`;
      roomList.append(card);
    }

    joinButton.disabled = false;
  }

  function show() {
    panel.hidden = false;
  }

  function hide() {
    panel.hidden = true;
  }

  return {
    setRooms,
    show,
    hide,
    get selectedRoomId() {
      return roomSelect.value;
    },
    get playerName() {
      return nameInput.value;
    },
  };
}
