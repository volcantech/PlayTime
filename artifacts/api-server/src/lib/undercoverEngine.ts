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
  pastClues: string[][];
  voteTargetId: string | null;
  userId?: number;
}

export interface UCChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  avatar: string;
  text: string;
  createdAt: number;
}

export type UCPhase = "lobby" | "reveal" | "clue" | "discussion" | "voting" | "round-result" | "game-over";

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
  discussionDuration: number;
  civilianWord: string;
  undercoverWord: string;
  eliminatedPlayerId: string | null;
  winnerTeam: "civilians" | "undercover" | null;
  lastVotes: Record<string, string>;
  voteSkipped: boolean;
  chatMessages: UCChatMessage[];
  isPrivate: boolean;
  discussionEndsAt: number | null;
  votingEndsAt: number | null;
  roundResultEndsAt: number | null;
  createdAt: number;
  usedWordPairIds: Set<number>;
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
  room.discussionEndsAt = null;
  room.votingEndsAt = null;
  room.roundResultEndsAt = null;
  for (const player of room.players) {
    player.hasSeenWord = false;
    player.clues = [];
    player.voteTargetId = null;
  }
}

function pickWords(usedWordPairIds: Set<number>): [string, string, number] | null {
  const pairs = getUndercoverWordPairs();
  if (pairs.length === 0) return null;
  const available = pairs.filter(p => !usedWordPairIds.has(p.id));
  const pool = available.length > 0 ? available : pairs;
  const pair = pool[Math.floor(Math.random() * pool.length)];
  const words: [string, string] = Math.random() > 0.5
    ? [pair.wordCivilian, pair.wordUndercover]
    : [pair.wordUndercover, pair.wordCivilian];
  return [...words, pair.id] as [string, string, number];
}

function assignRoles(room: UCRoom): boolean {
  const alivePlayers = room.players.filter((player) => player.isAlive);
  const undercoverCount = Math.min(Math.max(1, room.undercoverCount), alivePlayers.length - 1);
  const undercoverIds = new Set(shuffleArray(alivePlayers).slice(0, undercoverCount).map((player) => player.id));
  const result = pickWords(room.usedWordPairIds);
  if (!result) return false;
  const [civilianWord, undercoverWord, pairId] = result;
  room.usedWordPairIds.add(pairId);
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

function processVotesInternal(room: UCRoom): UCRoom {
  if (room.phase !== "voting") return room;

  const alivePlayers = room.players.filter((p) => p.isAlive);
  const voteCounts = new Map<string, number>();

  for (const player of alivePlayers) {
    const target = player.voteTargetId ?? "__skip__";
    voteCounts.set(target, (voteCounts.get(target) || 0) + 1);
  }

  const voteMap: Record<string, string> = {};
  for (const player of alivePlayers) {
    if (player.voteTargetId) voteMap[player.id] = player.voteTargetId;
  }
  room.lastVotes = voteMap;
  room.votingEndsAt = null;

  const skipVotes = voteCounts.get("__skip__") || 0;
  const playerVotes = [...voteCounts.entries()]
    .filter(([k]) => k !== "__skip__")
    .sort((a, b) => b[1] - a[1]);
  const maxPlayerVotes = playerVotes.length > 0 ? playerVotes[0][1] : 0;

  const isTie = playerVotes.length > 1 && playerVotes[0][1] === playerVotes[1][1];
  const skipWins = skipVotes > maxPlayerVotes || isTie || playerVotes.length === 0;

  if (skipWins) {
    if (room.clueRound < 3) {
      room.clueRound++;
      room.voteSkipped = true;
      room.discussionEndsAt = null;
      room.chatMessages = [];
      for (const p of room.players) p.voteTargetId = null;
      room.phase = "clue";
    } else {
      room.eliminatedPlayerId = null;
      room.phase = "round-result";
      room.roundResultEndsAt = Date.now() + 10_000;
    }
  } else {
    const [eliminatedId] = playerVotes[0];
    const eliminated = room.players.find((p) => p.id === eliminatedId);
    if (eliminated) {
      eliminated.isAlive = false;
      room.eliminatedPlayerId = eliminatedId;
      const winner = checkWinner(room);
      if (winner) {
        room.winnerTeam = winner;
        room.phase = "game-over";
      } else {
        room.phase = "round-result";
        room.roundResultEndsAt = Date.now() + 10_000;
      }
    }
  }

  return room;
}

export function setUCDiscussionDuration(roomId: string, requesterId: string, duration: number): UCRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.hostId !== requesterId) return { error: "Seul l'hôte peut modifier la durée de discussion." };
  if (room.phase !== "lobby") return { error: "Impossible de modifier pendant la partie." };
  if (![20, 30, 60, 90].includes(duration)) return { error: "Durée invalide. Choisir 20, 30, 60 ou 90 secondes." };
  room.discussionDuration = duration;
  return room;
}

export function createUCRoom(hostName: string, avatar: string, undercoverCount = 1, options?: { isPrivate?: boolean; discussionDuration?: number }): { room: UCRoom; playerId: string } {
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
      pastClues: [],
      voteTargetId: null,
    }],
    phase: "lobby",
    roundNumber: 0,
    clueRound: 0,
    undercoverCount: Math.min(Math.max(Math.round(undercoverCount), 1), 5),
    discussionDuration: [20, 30, 60, 90].includes(options?.discussionDuration ?? -1) ? options!.discussionDuration! : 60,
    civilianWord: "",
    undercoverWord: "",
    eliminatedPlayerId: null,
    winnerTeam: null,
    lastVotes: {},
    voteSkipped: false,
    chatMessages: [],
    isPrivate: options?.isPrivate ?? false,
    discussionEndsAt: null,
    votingEndsAt: null,
    roundResultEndsAt: null,
    createdAt: Date.now(),
    usedWordPairIds: new Set(),
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
    pastClues: [],
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
  if (room.players.filter((p) => p.isAlive).every((p) => p.clues.length > room.clueRound)) {
    room.phase = "discussion";
    room.chatMessages = [];
    room.discussionEndsAt = Date.now() + room.discussionDuration * 1_000;
  }
  return room;
}

export function startUCVoting(roomId: string): UCRoom | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  if (room.phase !== "discussion") return room;
  room.phase = "voting";
  room.discussionEndsAt = null;
  room.votingEndsAt = Date.now() + 10_000;
  for (const p of room.players) p.voteTargetId = null;
  return room;
}

export function voteUCPlayer(roomId: string, playerId: string, targetId: string): UCRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.phase !== "voting") return { error: "Ce n'est pas le moment de voter." };
  const voter = room.players.find((p) => p.id === playerId);
  if (!voter || !voter.isAlive) return { error: "Tu ne peux pas voter." };

  if (targetId === "__skip__") {
    voter.voteTargetId = "__skip__";
  } else {
    const target = room.players.find((p) => p.id === targetId);
    if (!target || !target.isAlive) return { error: "Joueur cible invalide." };
    if (target.id === voter.id) return { error: "Tu ne peux pas voter contre toi-même." };
    voter.voteTargetId = targetId;
  }

  const alivePlayers = room.players.filter((p) => p.isAlive);
  if (alivePlayers.every((p) => p.voteTargetId !== null)) {
    return processVotesInternal(room);
  }

  return room;
}

export function processUCVotes(roomId: string): UCRoom | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  return processVotesInternal(room);
}

export function addUCChatMessage(roomId: string, playerId: string, text: string): UCRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.phase !== "discussion") return { error: "Le chat est disponible pendant la phase de discussion." };
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

function advanceUCRound(room: UCRoom): UCRoom {
  room.roundNumber++;
  room.eliminatedPlayerId = null;
  room.lastVotes = {};
  room.voteSkipped = false;
  room.clueRound = 0;
  room.discussionEndsAt = null;
  room.votingEndsAt = null;
  room.roundResultEndsAt = null;
  room.chatMessages = [];
  for (const player of room.players) {
    if (player.clues.length > 0) {
      player.pastClues = [...player.pastClues, [...player.clues]];
    }
    player.clues = [];
    player.voteTargetId = null;
  }
  room.phase = "clue";
  return room;
}

export function nextUCRound(roomId: string, requesterId: string): UCRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.hostId !== requesterId) return { error: "Seul l'hôte peut lancer le tour suivant." };
  if (room.phase !== "round-result") return { error: "Impossible de passer au tour suivant maintenant." };
  return advanceUCRound(room);
}

export function nextUCRoundInternal(roomId: string): UCRoom | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  if (room.phase !== "round-result") return null;
  return advanceUCRound(room);
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
  room.discussionEndsAt = null;
  room.votingEndsAt = null;
  room.roundResultEndsAt = null;
  for (const player of room.players) {
    player.isAlive = true;
    player.role = "civilian";
    player.word = "";
    player.hasSeenWord = false;
    player.clues = [];
    player.pastClues = [];
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
    if (!room.isPrivate && room.phase === "lobby" && room.players.filter((p) => p.isConnected).length > 0 && room.players.length < 12) return room;
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
