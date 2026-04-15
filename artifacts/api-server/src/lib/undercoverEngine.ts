import { getUndercoverWordPairs } from "./undercoverWordCache";

export interface UCPlayer {
  id: string;
  name: string;
  avatar: string;
  isConnected: boolean;
  isAlive: boolean;
  role: "civilian" | "undercover";
  word: string;
  hasSeenWord: boolean;
  clues: string[];
  voteTargetId: string | null;
}

export interface UCChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  avatar: string;
  text: string;
  createdAt: number;
}

export type UCPhase = "lobby" | "reveal" | "clue" | "voting" | "round-result" | "game-over";

export interface UCRoom {
  id: string;
  code: string;
  gameType: "undercover";
  hostId: string;
  players: UCPlayer[];
  phase: UCPhase;
  roundNumber: number;
  clueRound: number;
  undercoverCount: number;
  civilianWord: string;
  undercoverWord: string;
  eliminatedPlayerId: string | null;
  winnerTeam: "civilians" | "undercover" | null;
  lastVotes: Record<string, string>;
  voteSkipped: boolean;
  chatMessages: UCChatMessage[];
  createdAt: number;
}

const rooms = new Map<string, UCRoom>();
const roomsByCode = new Map<string, UCRoom>();

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function resetRoundState(room: UCRoom) {
  room.eliminatedPlayerId = null;
  room.lastVotes = {};
  room.voteSkipped = false;
  room.clueRound = 0;
  for (const player of room.players) {
    player.hasSeenWord = false;
    player.clues = [];
    player.voteTargetId = null;
  }
}

function pickWords(): [string, string] | null {
  const pairs = getUndercoverWordPairs();
  if (pairs.length === 0) return null;
  const pair = pairs[Math.floor(Math.random() * pairs.length)];
  return Math.random() > 0.5
    ? [pair.wordCivilian, pair.wordUndercover]
    : [pair.wordUndercover, pair.wordCivilian];
}

function assignRoles(room: UCRoom): boolean {
  const alivePlayers = room.players.filter((player) => player.isAlive);
  const undercoverCount = Math.min(Math.max(1, room.undercoverCount), alivePlayers.length - 1);
  const undercoverIds = new Set(shuffleArray(alivePlayers).slice(0, undercoverCount).map((player) => player.id));
  const words = pickWords();
  if (!words) return false;
  const [civilianWord, undercoverWord] = words;
  room.civilianWord = civilianWord;
  room.undercoverWord = undercoverWord;
  for (const player of room.players) {
    player.role = undercoverIds.has(player.id) ? "undercover" : "civilian";
    player.word = player.role === "undercover" ? undercoverWord : civilianWord;
  }
  return true;
}

function checkWinner(room: UCRoom): "civilians" | "undercover" | null {
  const alive = room.players.filter((player) => player.isAlive);
  const undercoverAlive = alive.filter((player) => player.role === "undercover").length;
  const civilianAlive = alive.length - undercoverAlive;
  if (undercoverAlive === 0) return "civilians";
  if (undercoverAlive >= civilianAlive) return "undercover";
  return null;
}

export function createUCRoom(hostName: string, avatar: string, undercoverCount = 1): { room: UCRoom; playerId: string } {
  let code = generateRoomCode();
  while (roomsByCode.has(code)) code = generateRoomCode();

  const playerId = generateId();
  const roomId = generateId();
  const room: UCRoom = {
    id: roomId,
    code,
    gameType: "undercover",
    hostId: playerId,
    players: [{
      id: playerId,
      name: hostName,
      avatar: avatar || "🐱",
      isConnected: true,
      isAlive: true,
      role: "civilian",
      word: "",
      hasSeenWord: false,
      clues: [],
      voteTargetId: null,
    }],
    phase: "lobby",
    roundNumber: 0,
    clueRound: 0,
    undercoverCount: Math.min(Math.max(Math.round(undercoverCount), 1), 5),
    civilianWord: "",
    undercoverWord: "",
    eliminatedPlayerId: null,
    winnerTeam: null,
    lastVotes: {},
    voteSkipped: false,
    chatMessages: [],
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);
  roomsByCode.set(code, room);
  return { room, playerId };
}

export function joinUCRoom(code: string, playerName: string, avatar: string): { room: UCRoom; playerId: string } | { error: string } {
  const room = roomsByCode.get(code.toUpperCase());
  if (!room) return { error: "Salle introuvable. Vérifie le code." };
  if (room.phase !== "lobby") return { error: "La partie a déjà commencé." };
  if (room.players.length >= 12) return { error: "La salle est pleine (12 joueurs max pour Undercover)." };
  if (room.players.find((player) => player.name.toLowerCase() === playerName.toLowerCase())) {
    return { error: "Ce prénom est déjà utilisé dans cette salle." };
  }

  const playerId = generateId();
  room.players.push({
    id: playerId,
    name: playerName,
    avatar: avatar || "🐱",
    isConnected: true,
    isAlive: true,
    role: "civilian",
    word: "",
    hasSeenWord: false,
    clues: [],
    voteTargetId: null,
  });
  return { room, playerId };
}

export function setUCUndercoverCount(roomId: string, requesterId: string, count: number): UCRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.hostId !== requesterId) return { error: "Seul l'hôte peut modifier le nombre d'Undercover." };
  if (room.phase !== "lobby") return { error: "Impossible de modifier pendant la partie." };
  const maxCount = Math.max(1, room.players.length - 1);
  room.undercoverCount = Math.min(Math.max(Math.round(count), 1), maxCount);
  return room;
}

export function startUCRoom(roomId: string, requesterId: string): UCRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.hostId !== requesterId) return { error: "Seul l'hôte peut démarrer la partie." };
  if (room.players.length < 3) return { error: "Il faut au moins 3 joueurs pour jouer à Undercover." };
  if (room.phase !== "lobby") return { error: "La partie a déjà commencé." };

  room.roundNumber = 1;
  room.winnerTeam = null;
  for (const player of room.players) player.isAlive = true;
  room.undercoverCount = Math.min(Math.max(1, room.undercoverCount), room.players.length - 1);
  if (!assignRoles(room)) return { error: "Aucun groupe de mots Undercover actif. Ajoute au moins un groupe dans l'administration." };
  resetRoundState(room);
  room.chatMessages = [];
  room.phase = "reveal";
  return room;
}

export function markUCWordSeen(roomId: string, playerId: string): UCRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.phase !== "reveal") return { error: "Ce n'est pas le moment de valider le mot." };
  const player = room.players.find((p) => p.id === playerId);
  if (!player || !player.isAlive) return { error: "Joueur introuvable." };
  player.hasSeenWord = true;
  if (room.players.filter((p) => p.isAlive).every((p) => p.hasSeenWord)) room.phase = "clue";
  return room;
}

export function submitUCClue(roomId: string, playerId: string, clue: string): UCRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.phase !== "clue") return { error: "Ce n'est pas le moment de donner un indice." };
  const player = room.players.find((p) => p.id === playerId);
  if (!player || !player.isAlive) return { error: "Joueur introuvable." };
  if (player.clues.length > room.clueRound) return { error: "Tu as déjà donné ton indice pour ce tour." };
  const cleanClue = clue.trim();
  if (!cleanClue || cleanClue.length > 40) return { error: "L'indice doit faire entre 1 et 40 caractères." };
  player.clues.push(cleanClue);
  if (room.players.filter((p) => p.isAlive).every((p) => p.clues.length > room.clueRound)) room.phase = "voting";
  return room;
}

export function voteUCPlayer(roomId: string, playerId: string, targetId: string): UCRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.phase !== "voting") return { error: "Ce n'est pas le moment de voter." };
  const voter = room.players.find((p) => p.id === playerId);
  if (!voter || !voter.isAlive) return { error: "Tu ne peux pas voter." };

  if (targetId === "__skip__") {
    if (room.hostId !== playerId) return { error: "Seul le créateur de la salle peut passer les votes." };
    if (room.clueRound >= 4) return { error: "Le maximum de 5 indices a été atteint." };
    for (const player of room.players) player.voteTargetId = null;
    room.lastVotes = {};
    room.voteSkipped = true;
    room.clueRound++;
    room.phase = "clue";
    room.chatMessages = [];
    return room;
  }

  const target = room.players.find((p) => p.id === targetId);
  if (!target || !target.isAlive) return { error: "Joueur cible invalide." };
  if (target.id === voter.id) return { error: "Tu ne peux pas voter contre toi-même." };
  voter.voteTargetId = targetId;

  const alivePlayers = room.players.filter((p) => p.isAlive);
  if (!alivePlayers.every((p) => p.voteTargetId)) return room;

  const voteCounts = new Map<string, number>();
  const voteMap: Record<string, string> = {};
  for (const player of alivePlayers) {
    if (!player.voteTargetId || player.voteTargetId === "__skip__") continue;
    voteMap[player.id] = player.voteTargetId;
    voteCounts.set(player.voteTargetId, (voteCounts.get(player.voteTargetId) || 0) + 1);
  }

  if (voteCounts.size === 0) {
    room.lastVotes = voteMap;
    room.phase = "round-result";
    return room;
  }

  const sortedVotes = [...voteCounts.entries()].sort((a, b) => b[1] - a[1]);
  if (sortedVotes.length > 1 && sortedVotes[0][1] === sortedVotes[1][1]) {
    for (const player of room.players) player.voteTargetId = null;
    room.lastVotes = voteMap;
    return room;
  }

  const eliminatedId = sortedVotes[0][0];
  const eliminated = room.players.find((p) => p.id === eliminatedId);
  if (!eliminated) return { error: "Joueur éliminé introuvable." };
  eliminated.isAlive = false;
  room.eliminatedPlayerId = eliminatedId;
  room.lastVotes = voteMap;
  const winner = checkWinner(room);
  if (winner) {
    room.winnerTeam = winner;
    room.phase = "game-over";
  } else {
    room.phase = "round-result";
  }
  return room;
}

export function addUCChatMessage(roomId: string, playerId: string, text: string): UCRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.phase !== "voting") return { error: "Le chat est disponible au moment des votes." };
  const player = room.players.find((p) => p.id === playerId);
  if (!player || !player.isAlive) return { error: "Tu ne peux pas écrire dans le chat." };
  const cleanText = text.trim();
  if (!cleanText || cleanText.length > 220) return { error: "Le message doit faire entre 1 et 220 caractères." };
  room.chatMessages.push({
    id: generateId(),
    playerId,
    playerName: player.name,
    avatar: player.avatar,
    text: cleanText,
    createdAt: Date.now(),
  });
  if (room.chatMessages.length > 80) room.chatMessages = room.chatMessages.slice(-80);
  return room;
}

export function nextUCRound(roomId: string, requesterId: string): UCRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.hostId !== requesterId) return { error: "Seul l'hôte peut lancer le tour suivant." };
  if (room.phase !== "round-result") return { error: "Impossible de passer au tour suivant maintenant." };
  room.roundNumber++;
  resetRoundState(room);
  room.chatMessages = [];
  room.voteSkipped = false;
  room.phase = "clue";
  return room;
}

export function resetUCRoom(roomId: string, requesterId: string): UCRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.hostId !== requesterId) return { error: "Seul l'hôte peut relancer la partie." };
  room.phase = "lobby";
  room.roundNumber = 0;
  room.clueRound = 0;
  room.civilianWord = "";
  room.undercoverWord = "";
  room.eliminatedPlayerId = null;
  room.winnerTeam = null;
  room.lastVotes = {};
  room.voteSkipped = false;
  room.chatMessages = [];
  for (const player of room.players) {
    player.isAlive = true;
    player.role = "civilian";
    player.word = "";
    player.hasSeenWord = false;
    player.clues = [];
    player.voteTargetId = null;
  }
  return room;
}

export function setUCPlayerDisconnected(roomId: string, playerId: string): UCRoom | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  const player = room.players.find((p) => p.id === playerId);
  if (player) player.isConnected = false;
  return room;
}

export function getUCRoom(roomId: string): UCRoom | undefined {
  return rooms.get(roomId);
}

export function getUCRoomByCode(code: string): UCRoom | undefined {
  return roomsByCode.get(code.toUpperCase());
}

export function destroyUCRoom(roomId: string): UCRoom | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  rooms.delete(roomId);
  roomsByCode.delete(room.code);
  return room;
}

export function removePlayerFromUCRoom(roomId: string, playerId: string): { room: UCRoom | null; destroyed: boolean } {
  const room = rooms.get(roomId);
  if (!room) return { room: null, destroyed: false };
  const index = room.players.findIndex((p) => p.id === playerId);
  if (index === -1) return { room, destroyed: false };
  room.players.splice(index, 1);
  if (room.players.length < 3 && room.phase !== "lobby") {
    rooms.delete(roomId);
    roomsByCode.delete(room.code);
    return { room, destroyed: true };
  }
  if (room.hostId === playerId && room.players[0]) room.hostId = room.players[0].id;
  return { room, destroyed: false };
}

export function findPublicUCRoom(): UCRoom | null {
  for (const room of rooms.values()) {
    if (room.phase === "lobby" && room.players.filter((p) => p.isConnected).length > 0 && room.players.length < 12) return room;
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
