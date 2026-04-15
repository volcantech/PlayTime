const ROWS = 6;
const COLS = 7;
const WIN = 4;

export interface C4Player {
  id: string;
  name: string;
  avatar: string;
  isConnected: boolean;
}

export type C4Phase = "lobby" | "playing" | "game-over";

export interface C4Room {
  id: string;
  code: string;
  gameType: "connect4";
  hostId: string;
  players: C4Player[];
  phase: C4Phase;
  board: (string | null)[][];
  currentTurnIndex: number;
  winnerId: string | null;
  isDraw: boolean;
  isPrivate: boolean;
  createdAt: number;
}

const rooms = new Map<string, C4Room>();
const roomsByCode = new Map<string, C4Room>();

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function emptyBoard(): (string | null)[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function checkWin(board: (string | null)[][], pid: string): boolean {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c <= COLS - WIN; c++)
      if (board[r].slice(c, c + WIN).every(x => x === pid)) return true;

  for (let c = 0; c < COLS; c++)
    for (let r = 0; r <= ROWS - WIN; r++)
      if ([0, 1, 2, 3].every(i => board[r + i][c] === pid)) return true;

  for (let r = 0; r <= ROWS - WIN; r++)
    for (let c = 0; c <= COLS - WIN; c++)
      if ([0, 1, 2, 3].every(i => board[r + i][c + i] === pid)) return true;

  for (let r = 0; r <= ROWS - WIN; r++)
    for (let c = WIN - 1; c < COLS; c++)
      if ([0, 1, 2, 3].every(i => board[r + i][c - i] === pid)) return true;

  return false;
}

function isFull(board: (string | null)[][]): boolean {
  return board[0].every(x => x !== null);
}

export function createC4Room(hostName: string, avatar: string, options?: { isPrivate?: boolean }): { room: C4Room; playerId: string } {
  let code = generateRoomCode();
  while (roomsByCode.has(code)) code = generateRoomCode();

  const playerId = generateId();
  const roomId = generateId();

  const room: C4Room = {
    id: roomId,
    code,
    gameType: "connect4",
    hostId: playerId,
    players: [{ id: playerId, name: hostName, avatar: avatar || "🐱", isConnected: true }],
    phase: "lobby",
    board: emptyBoard(),
    currentTurnIndex: 0,
    winnerId: null,
    isDraw: false,
    isPrivate: options?.isPrivate ?? false,
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);
  roomsByCode.set(code, room);
  return { room, playerId };
}

export function joinC4Room(code: string, playerName: string, avatar: string): { room: C4Room; playerId: string } | { error: string } {
  const room = roomsByCode.get(code.toUpperCase());
  if (!room) return { error: "Salle introuvable. Vérifie le code." };
  if (room.phase !== "lobby") return { error: "La partie a déjà commencé." };
  if (room.players.length >= 2) return { error: "La salle est pleine (2 joueurs max pour Puissance 4)." };

  if (room.players.find(p => p.name.toLowerCase() === playerName.toLowerCase()))
    return { error: "Ce prénom est déjà utilisé dans cette salle." };

  const playerId = generateId();
  room.players.push({ id: playerId, name: playerName, avatar: avatar || "🐱", isConnected: true });

  if (room.players.length === 2) {
    room.phase = "playing";
    room.board = emptyBoard();
    room.currentTurnIndex = 0;
  }

  return { room, playerId };
}

export function dropPiece(roomId: string, playerId: string, col: number): C4Room | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.phase !== "playing") return { error: "La partie n'est pas en cours." };

  const current = room.players[room.currentTurnIndex];
  if (current.id !== playerId) return { error: "Ce n'est pas ton tour." };
  if (col < 0 || col >= COLS) return { error: "Colonne invalide." };

  let targetRow = -1;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (room.board[r][col] === null) { targetRow = r; break; }
  }
  if (targetRow === -1) return { error: "Cette colonne est pleine." };

  room.board[targetRow][col] = playerId;

  if (checkWin(room.board, playerId)) {
    room.winnerId = playerId;
    room.phase = "game-over";
  } else if (isFull(room.board)) {
    room.isDraw = true;
    room.phase = "game-over";
  } else {
    room.currentTurnIndex = (room.currentTurnIndex + 1) % 2;
  }

  return room;
}

export function resetC4Room(roomId: string, requesterId: string): C4Room | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.hostId !== requesterId) return { error: "Seul l'hôte peut relancer la partie." };

  room.phase = "playing";
  room.board = emptyBoard();
  room.winnerId = null;
  room.isDraw = false;
  room.currentTurnIndex = 0;

  return room;
}

export function setC4PlayerDisconnected(roomId: string, playerId: string): C4Room | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  const p = room.players.find(p => p.id === playerId);
  if (p) p.isConnected = false;
  return room;
}

export function getC4Room(roomId: string): C4Room | undefined {
  return rooms.get(roomId);
}

export function getC4RoomByCode(code: string): C4Room | undefined {
  return roomsByCode.get(code.toUpperCase());
}

export function destroyC4Room(roomId: string): C4Room | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  rooms.delete(roomId);
  roomsByCode.delete(room.code);
  return room;
}

export function findPublicC4Room(): C4Room | null {
  for (const room of rooms.values()) {
    if (!room.isPrivate && room.phase === "lobby" && room.players.filter(p => p.isConnected).length > 0 && room.players.length < 2) {
      return room;
    }
  }
  return null;
}

setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms) {
    if (now - room.createdAt > 6 * 60 * 60 * 1000) {
      rooms.delete(roomId);
      roomsByCode.delete(room.code);
    }
  }
}, 60 * 60 * 1000);
