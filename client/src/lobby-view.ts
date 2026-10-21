import type { LobbyRoom } from './lobby.ts';

export interface LobbyViewElements {
  readonly panel: HTMLElement;
  readonly nameInput: HTMLInputElement;
  readonly roomSelect: HTMLSelectElement;
  readonly roomList: HTMLElement;
  readonly joinButton: HTMLButtonElement;
}
export interface LobbyView {
  setRooms(rooms: readonly LobbyRoom[]): void;
  show(): void;
  hide(): void;
  readonly selectedRoomId: string;
  readonly playerName: string;
}

export function createLobbyView({ panel, nameInput, roomSelect, roomList, joinButton }: LobbyViewElements): LobbyView {
  function setRooms(nextRooms: readonly LobbyRoom[]): void {
    roomSelect.replaceChildren();
    roomList.replaceChildren();
    if (nextRooms.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No rooms available.';
      roomList.append(empty);
      joinButton.disabled = true;
      return;
    }
    for (const room of nextRooms) {
      const option = document.createElement('option');
      option.value = room.id;
      option.textContent = `${room.name} — ${room.players}/${room.maxPlayers}`;
      roomSelect.append(option);
      const card = document.createElement('div');
      card.className = 'room-card';
      const title = document.createElement('strong');
      title.textContent = room.name;
      const players = document.createElement('span');
      players.textContent = `${room.players}/${room.maxPlayers} players`;
      const details = document.createElement('small');
      details.textContent = `${room.width}×${room.height} · ${room.asteroids} asteroids · ${room.enemies} enemies`;
      card.append(title, players, details);
      roomList.append(card);
    }
    joinButton.disabled = false;
  }
  return {
    setRooms,
    show: () => { panel.hidden = false; },
    hide: () => { panel.hidden = true; },
    get selectedRoomId() { return roomSelect.value; },
    get playerName() { return nameInput.value; },
  };
}
