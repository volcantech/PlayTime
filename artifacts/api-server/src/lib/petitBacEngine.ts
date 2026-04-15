export interface PBCategory {
  id: number;
  name: string;
}

export interface PBPlayer {
  id: string;
  name: string;
  avatar: string;
  isConnected: boolean;
  hasDone: boolean;
  answers: Record<number, string>; // categoryId -> answer
}

export type PBPhase = "lobby" | "playing" | "voting" | "scores" | "game-over";

export interface PBRoundScore {
  playerId: string;
  scoresByCat: Record<number, number>;
  roundTotal: number;
}

export interface PBRoom {
  id: string;
  code: string;
  gameType: "petitbac";
  hostId: string;
  players: PBPlayer[];
  phase: PBPhase;
  categories: PBCategory[];
  excludedLetters: string[];
  usedLetters: string[];
  timePerRound: number | null;
  totalRounds: number;
  currentRound: number;
  currentLetter: string | null;
  roundStartedAt: number | null;
  votes: Record<string, Record<string, Record<number, boolean>>>;
  roundScores: PBRoundScore[];
  totalScores: Record<string, number>;
  isPrivate: boolean;
  scoresEndsAt: number | null;
  createdAt: number;
}

type BroadcastFn = (roomId: string, room: PBRoom) => void;
let broadcastFn: BroadcastFn | null = null;
const timerHandles = new Map<string, ReturnType<typeof setTimeout>>();

export function setPBBroadcastFn(fn: BroadcastFn) {
  broadcastFn = fn;
}

const rooms = new Map<string, PBRoom>();
const roomsByCode = new Map<string, PBRoom>();

const ALL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function pickLetter(excluded: string[]): string {
  const available = ALL_LETTERS.filter(l => !excluded.includes(l));
  if (available.length === 0) return ALL_LETTERS[Math.floor(Math.random() * ALL_LETTERS.length)];
  return available[Math.floor(Math.random() * available.length)];
}

function clearRoomTimer(roomId: string) {
  const handle = timerHandles.get(roomId);
  if (handle) {
    clearTimeout(handle);
    timerHandles.delete(roomId);
  }
}

function startRoundTimer(room: PBRoom) {
  clearRoomTimer(room.id);
  if (!room.timePerRound) return;
  const handle = setTimeout(() => {
    timerHandles.delete(room.id);
    const r = rooms.get(room.id);
    if (!r || r.phase !== "playing") return;
    moveToVoting(r);
    if (broadcastFn) broadcastFn(r.id, r);
  }, room.timePerRound * 1000);
  timerHandles.set(room.id, handle);
}

function moveToVoting(room: PBRoom) {
  clearRoomTimer(room.id);
  room.phase = "voting";
  room.votes = {};
  if (isVotingComplete(room)) {
    finalizeRound(room);
  }
}

function computeRoundScores(room: PBRoom): PBRoundScore[] {
  const results: PBRoundScore[] = [];
  for (const player of room.players) {
    const scoresByCat: Record<number, number> = {};
    let roundTotal = 0;
    for (const cat of room.categories) {
      const answer = (player.answers[cat.id] || "").trim().toLowerCase();
      if (!answer) {
        scoresByCat[cat.id] = 0;
        continue;
      }
      let validCount = 0;
      let invalidCount = 0;
      for (const voter of room.players) {
        if (voter.id === player.id) continue;
        const vote = room.votes[voter.id]?.[player.id]?.[cat.id];
        if (vote === true) validCount++;
        else if (vote === false) invalidCount++;
      }
      const otherVoters = room.players.length - 1;
      const isValid = otherVoters === 0 || validCount >= Math.ceil(otherVoters / 2);
      if (!isValid) {
        scoresByCat[cat.id] = 0;
        continue;
      }
      const sameAnswers = room.players.filter(p => {
        if (p.id === player.id) return false;
        const pa = (p.answers[cat.id] || "").trim().toLowerCase();
        return pa === answer;
      });
      const score = sameAnswers.length === 0 ? 2 : 1;
      scoresByCat[cat.id] = score;
      roundTotal += score;
    }
    results.push({ playerId: player.id, scoresByCat, roundTotal });
  }
  return results;
}

export function createPBRoom(hostName: string, avatar: string, categories: PBCategory[], options?: { isPrivate?: boolean }): { room: PBRoom; playerId: string } {
  let code = generateRoomCode();
  while (roomsByCode.has(code)) code = generateRoomCode();

  const playerId = generateId();
  const roomId = generateId();
  const player: PBPlayer = { id: playerId, name: hostName, avatar, isConnected: true, hasDone: false, answers: {} };

  const room: PBRoom = {
    id: roomId,
    code,
    gameType: "petitbac",
    hostId: playerId,
    players: [player],
    phase: "lobby",
    categories,
    excludedLetters: ["W", "X", "Y"],
    usedLetters: [],
    timePerRound: 120,
    totalRounds: 5,
    currentRound: 0,
    currentLetter: null,
    roundStartedAt: null,
    votes: {},
    roundScores: [],
    totalScores: { [playerId]: 0 },
    isPrivate: options?.isPrivate ?? false,
    scoresEndsAt: null,
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);
  roomsByCode.set(code, room);
  return { room, playerId };
}

export function joinPBRoom(code: string, playerName: string, avatar: string): { room: PBRoom; playerId: string } | { error: string } {
  const room = roomsByCode.get(code.toUpperCase());
  if (!room) return { error: "Salle introuvable. Vérifie le code." };
  if (room.phase !== "lobby") return { error: "La partie a déjà commencé." };
  if (room.players.length >= 10) return { error: "La salle est pleine (10 joueurs max)." };
  if (room.players.find(p => p.name.toLowerCase() === playerName.toLowerCase())) {
    return { error: "Ce prénom est déjà utilisé dans cette salle." };
  }
  const playerId = generateId();
  const player: PBPlayer = { id: playerId, name: playerName, avatar, isConnected: true, hasDone: false, answers: {} };
  room.players.push(player);
  room.totalScores[playerId] = 0;
  return { room, playerId };
}

export function getPBRoom(roomId: string): PBRoom | undefined {
  return rooms.get(roomId);
}

export function getPBRoomByCode(code: string): PBRoom | undefined {
  return roomsByCode.get(code.toUpperCase());
}

export function setPBPlayerDisconnected(roomId: string, playerId: string): PBRoom | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  const player = room.players.find(p => p.id === playerId);
  if (player) player.isConnected = false;
  return room;
}

export function destroyPBRoom(roomId: string): PBRoom | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  clearRoomTimer(roomId);
  rooms.delete(roomId);
  roomsByCode.delete(room.code);
  return room;
}

export function removePlayerFromPBRoom(roomId: string, playerId: string): { room: PBRoom | null; destroyed: boolean } {
  const room = rooms.get(roomId);
  if (!room) return { room: null, destroyed: false };
  const idx = room.players.findIndex(p => p.id === playerId);
  if (idx === -1) return { room, destroyed: false };
  room.players.splice(idx, 1);
  if (room.players.length < 2) {
    clearRoomTimer(roomId);
    rooms.delete(roomId);
    roomsByCode.delete(room.code);
    return { room, destroyed: true };
  }
  if (room.hostId === playerId) room.hostId = room.players[0].id;
  return { room, destroyed: false };
}

export function addPBCategory(roomId: string, requesterId: string, category: PBCategory): PBRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.hostId !== requesterId) return { error: "Seul l'hôte peut modifier les catégories." };
  if (room.phase !== "lobby") return { error: "Impossible de modifier les catégories pendant la partie." };
  if (room.categories.some(cat => cat.id === category.id)) return { error: "Cette catégorie est déjà présente." };
  room.categories.push(category);
  return room;
}

export function removePBCategory(roomId: string, requesterId: string, categoryId: number): PBRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.hostId !== requesterId) return { error: "Seul l'hôte peut modifier les catégories." };
  if (room.phase !== "lobby") return { error: "Impossible de modifier les catégories pendant la partie." };
  room.categories = room.categories.filter(cat => cat.id !== categoryId);
  return room;
}

export function startPBGame(roomId: string, requesterId: string): PBRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.hostId !== requesterId) return { error: "Seul l'hôte peut démarrer la partie." };
  if (room.players.length < 2) return { error: "Il faut au moins 2 joueurs pour jouer." };
  if (room.phase !== "lobby") return { error: "La partie a déjà commencé." };
  if (room.categories.length === 0) return { error: "Aucune catégorie disponible." };
  room.currentRound = 0;
  room.totalScores = {};
  for (const p of room.players) { room.totalScores[p.id] = 0; p.hasDone = false; p.answers = {}; }
  return startPBRound(room);
}

function startPBRound(room: PBRoom): PBRoom {
  room.currentRound++;
  room.currentLetter = pickLetter([...room.excludedLetters, ...room.usedLetters]);
  room.usedLetters.push(room.currentLetter);
  room.roundStartedAt = Date.now();
  room.phase = "playing";
  room.votes = {};
  room.roundScores = [];
  for (const p of room.players) { p.hasDone = false; p.answers = {}; }
  startRoundTimer(room);
  return room;
}

export function configurePBRoom(roomId: string, requesterId: string, opts: {
  excludedLetters?: string[];
  timePerRound?: number | null;
  totalRounds?: number;
}): PBRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.hostId !== requesterId) return { error: "Seul l'hôte peut configurer." };
  if (room.phase !== "lobby") return { error: "Impossible de configurer pendant la partie." };
  if (opts.excludedLetters !== undefined) room.excludedLetters = opts.excludedLetters;
  if (opts.timePerRound !== undefined) room.timePerRound = opts.timePerRound;
  if (opts.totalRounds !== undefined) {
    if (![5, 10, 15, 20].includes(opts.totalRounds)) return { error: "Nombre de manches invalide." };
    room.totalRounds = opts.totalRounds;
  }
  return room;
}

export function setPBAnswer(roomId: string, playerId: string, categoryId: number, answer: string): PBRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.phase !== "playing") return { error: "Ce n'est pas la phase de jeu." };
  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: "Joueur introuvable." };
  if (player.hasDone) return { error: "Tu as déjà indiqué que tu as fini." };
  player.answers[categoryId] = answer.slice(0, 100);
  return room;
}

export function setPBDone(roomId: string, playerId: string): PBRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.phase !== "playing") return { error: "Ce n'est pas la phase de jeu." };
  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: "Joueur introuvable." };
  player.hasDone = true;
  if (room.players.every(p => p.hasDone)) {
    moveToVoting(room);
  }
  return room;
}

export function submitPBVote(roomId: string, voterId: string, targetPlayerId: string, categoryId: number, valid: boolean): PBRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.phase !== "voting") return { error: "Ce n'est pas la phase de vote." };
  if (voterId === targetPlayerId) return { error: "Tu ne peux pas voter pour toi-même." };
  if (!room.votes[voterId]) room.votes[voterId] = {};
  if (!room.votes[voterId][targetPlayerId]) room.votes[voterId][targetPlayerId] = {};
  room.votes[voterId][targetPlayerId][categoryId] = valid;
  if (isVotingComplete(room)) {
    finalizeRound(room);
  }
  return room;
}

function isVotingComplete(room: PBRoom): boolean {
  for (const voter of room.players) {
    for (const target of room.players) {
      if (voter.id === target.id) continue;
      for (const cat of room.categories) {
        const answer = (target.answers[cat.id] || "").trim();
        if (!answer) continue;
        if (room.votes[voter.id]?.[target.id]?.[cat.id] === undefined) return false;
      }
    }
  }
  return true;
}

function finalizeRound(room: PBRoom) {
  room.roundScores = computeRoundScores(room);
  for (const rs of room.roundScores) {
    if (room.totalScores[rs.playerId] === undefined) room.totalScores[rs.playerId] = 0;
    room.totalScores[rs.playerId] += rs.roundTotal;
  }
  if (room.currentRound >= room.totalRounds) {
    room.phase = "game-over";
    room.scoresEndsAt = null;
  } else {
    room.phase = "scores";
    room.scoresEndsAt = Date.now() + 10_000;
  }
}

export function nextPBRound(roomId: string, requesterId: string): PBRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.hostId !== requesterId) return { error: "Seul l'hôte peut passer à la manche suivante." };
  if (room.phase !== "scores") return { error: "Impossible maintenant." };
  room.scoresEndsAt = null;
  return startPBRound(room);
}

export function nextPBRoundInternal(roomId: string): PBRoom | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  if (room.phase !== "scores") return null;
  room.scoresEndsAt = null;
  return startPBRound(room);
}

export function resetPBRoom(roomId: string, requesterId: string): PBRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.hostId !== requesterId) return { error: "Seul l'hôte peut relancer." };
  clearRoomTimer(roomId);
  room.phase = "lobby";
  room.currentRound = 0;
  room.currentLetter = null;
  room.roundStartedAt = null;
  room.votes = {};
  room.roundScores = [];
  room.totalScores = {};
  room.scoresEndsAt = null;
  for (const p of room.players) { p.hasDone = false; p.answers = {}; room.totalScores[p.id] = 0; }
  return room;
}

setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms) {
    if (now - room.createdAt > 6 * 60 * 60 * 1000) {
      clearRoomTimer(roomId);
      rooms.delete(roomId);
      roomsByCode.delete(room.code);
    }
  }
}, 60 * 60 * 1000);
