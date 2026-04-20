import { getQuestions, getAnswers, type CachedQuestion, type CachedAnswer, type CardMode } from "./cardCache";

export type AnswerCard = CachedAnswer;
export type QuestionCard = CachedQuestion;

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  hand: AnswerCard[];
  submittedCardId: number | null;
  isConnected: boolean;
  userId?: number;
}

export type GamePhase =
  | "lobby"
  | "playing-submit"
  | "playing-judge"
  | "playing-vote"
  | "round-result"
  | "game-over";

export type VoteMode = "classic" | "democratic";

export interface Submission {
  playerId: string;
  cardId: number;
  card: AnswerCard;
}

export interface Room {
  id: string;
  code: string;
  gameType: "bmc";
  hostId: string;
  players: Player[];
  phase: GamePhase;
  questionDeck: QuestionCard[];
  answerDeck: AnswerCard[];
  currentQuestion: QuestionCard | null;
  questionMasterIndex: number;
  submissions: Submission[];
  lastWinnerId: string | null;
  lastWinnerCardId: number | null;
  targetScore: number;
  roundNumber: number;
  roundResultEndsAt: number | null;
  isPrivate: boolean;
  cardMode: CardMode;
  voteMode: VoteMode;
  votes: Record<string, string>;
  createdAt: number;
  usedAnswerCardIds: Set<number>;
  usedQuestionCardIds: Set<number>;
}

const rooms = new Map<string, Room>();
const roomsByCode = new Map<string, Room>();

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function createRoom(hostName: string, avatar: string, options?: { isPrivate?: boolean; cardMode?: CardMode; voteMode?: VoteMode }): { room: Room; playerId: string } {
  let code = generateRoomCode();
  while (roomsByCode.has(code)) code = generateRoomCode();

  const playerId = generateId();
  const roomId = generateId();

  const player: Player = {
    id: playerId,
    name: hostName,
    avatar: avatar || "🐱",
    score: 0,
    hand: [],
    submittedCardId: null,
    isConnected: true,
  };

  const room: Room = {
    id: roomId,
    code,
    gameType: "bmc",
    hostId: playerId,
    players: [player],
    phase: "lobby",
    questionDeck: [],
    answerDeck: [],
    currentQuestion: null,
    questionMasterIndex: 0,
    submissions: [],
    lastWinnerId: null,
    lastWinnerCardId: null,
    targetScore: 5,
    roundNumber: 0,
    roundResultEndsAt: null,
    isPrivate: options?.isPrivate ?? false,
    cardMode: options?.cardMode ?? "normal",
    voteMode: options?.voteMode ?? "classic",
    votes: {},
    createdAt: Date.now(),
    usedAnswerCardIds: new Set(),
    usedQuestionCardIds: new Set(),
  };

  rooms.set(roomId, room);
  roomsByCode.set(code, room);
  return { room, playerId };
}

export function joinRoom(code: string, playerName: string, avatar: string): { room: Room; playerId: string } | { error: string } {
  const room = roomsByCode.get(code.toUpperCase());
  if (!room) return { error: "Salle introuvable. Vérifie le code." };
  if (room.phase !== "lobby") return { error: "La partie a déjà commencé." };
  if (room.players.length >= 10) return { error: "La salle est pleine (10 joueurs max)." };

  const existingName = room.players.find(p => p.name.toLowerCase() === playerName.toLowerCase());
  if (existingName) return { error: "Ce prénom est déjà utilisé dans cette salle." };

  const playerId = generateId();
  const player: Player = {
    id: playerId,
    name: playerName,
    avatar: avatar || "🐱",
    score: 0,
    hand: [],
    submittedCardId: null,
    isConnected: true,
  };
  room.players.push(player);
  return { room, playerId };
}

export function rejoinRoom(roomId: string, playerId: string): Room | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  const player = room.players.find(p => p.id === playerId);
  if (!player) return null;
  player.isConnected = true;
  return room;
}

export function setPlayerDisconnected(roomId: string, playerId: string): Room | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  const player = room.players.find(p => p.id === playerId);
  if (player) player.isConnected = false;
  return room;
}

export function startGame(roomId: string, requesterId: string): Room | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.hostId !== requesterId) return { error: "Seul l'hôte peut démarrer la partie." };
  if (room.players.length < 3) return { error: "Il faut au moins 3 joueurs pour jouer." };
  if (room.phase !== "lobby") return { error: "La partie a déjà commencé." };

  const allQuestions = getQuestions(room.cardMode);
  const allAnswers = getAnswers(room.cardMode);

  if (allQuestions.length === 0 || allAnswers.length === 0) {
    return { error: "Aucune carte disponible. Contactez l'administrateur." };
  }

  room.answerDeck = shuffleArray(allAnswers);
  room.questionMasterIndex = Math.floor(Math.random() * room.players.length);
  room.roundNumber = 0;
  room.votes = {};
  room.usedAnswerCardIds = new Set();
  room.usedQuestionCardIds = new Set();

  for (const player of room.players) {
    player.score = 0;
    player.hand = [];
    player.submittedCardId = null;
    dealCards(room, player, 11);
  }

  startRound(room);
  return room;
}

function dealCards(room: Room, player: Player, count: number): void {
  const allAnswers = getAnswers(room.cardMode);
  const allInHandIds = new Set(room.players.flatMap(p => p.hand.map(c => c.id)));

  let available = allAnswers.filter(c => !room.usedAnswerCardIds.has(c.id) && !allInHandIds.has(c.id));

  if (available.length === 0) {
    room.usedAnswerCardIds = new Set();
    available = allAnswers.filter(c => !allInHandIds.has(c.id));
  }

  const pool = available.length > 0 ? available : allAnswers.filter(c => !player.hand.find(h => h.id === c.id));
  const shuffled = shuffleArray(pool);

  for (let i = 0; i < count && i < shuffled.length; i++) {
    const card = shuffled[i];
    player.hand.push(card);
    allInHandIds.add(card.id);
  }
}

function startRound(room: Room): void {
  room.roundNumber++;
  room.submissions = [];
  room.votes = {};
  room.lastWinnerId = null;
  room.lastWinnerCardId = null;
  room.phase = "playing-submit";

  for (const player of room.players) {
    player.submittedCardId = null;
  }

  const allQuestions = getQuestions(room.cardMode);
  const available = allQuestions.filter(q => !room.usedQuestionCardIds.has(q.id));

  const pool = available.length > 0 ? available : (() => {
    room.usedQuestionCardIds = new Set();
    return allQuestions;
  })();

  const picked = pool[Math.floor(Math.random() * pool.length)];
  room.usedQuestionCardIds.add(picked.id);
  room.currentQuestion = picked;
}

export function setCardMode(roomId: string, requesterId: string, cardMode: CardMode): Room | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.hostId !== requesterId) return { error: "Seul l'hôte peut modifier ça." };
  if (room.phase !== "lobby") return { error: "Impossible de modifier pendant la partie." };
  if (!["normal", "adult", "mixed"].includes(cardMode)) return { error: "Mode invalide." };
  room.cardMode = cardMode;
  return room;
}

export function setVoteMode(roomId: string, requesterId: string, voteMode: VoteMode): Room | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.hostId !== requesterId) return { error: "Seul l'hôte peut modifier ça." };
  if (room.phase !== "lobby") return { error: "Impossible de modifier pendant la partie." };
  if (!["classic", "democratic"].includes(voteMode)) return { error: "Mode de vote invalide." };
  room.voteMode = voteMode;
  return room;
}

export function setTargetScore(roomId: string, requesterId: string, score: number): Room | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.hostId !== requesterId) return { error: "Seul l'hôte peut modifier ça." };
  if (room.phase !== "lobby") return { error: "Impossible de modifier pendant la partie." };
  if (![5, 10, 15].includes(score)) return { error: "Score invalide." };
  room.targetScore = score;
  return room;
}

export function submitAnswer(roomId: string, playerId: string, cardId: number, customText?: string): Room | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.phase !== "playing-submit") return { error: "Ce n'est pas le moment de soumettre une réponse." };

  const questionMaster = room.players[room.questionMasterIndex];

  if (room.voteMode === "classic" && playerId === questionMaster.id) {
    return { error: "Le Question Master ne peut pas soumettre de réponse." };
  }

  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: "Joueur introuvable." };
  if (player.submittedCardId !== null) return { error: "Tu as déjà soumis une réponse." };

  const card = player.hand.find(c => c.id === cardId);
  if (!card) return { error: "Carte introuvable dans ta main." };

  if (card.isBlank) {
    const text = customText?.trim();
    if (!text) return { error: "Tu dois écrire une réponse pour la carte vierge." };
    if (text.length > 200) return { error: "Ta réponse est trop longue (200 caractères max)." };
  }

  const effectiveCard = card.isBlank && customText?.trim()
    ? { ...card, text: customText.trim() }
    : card;

  player.submittedCardId = cardId;
  room.submissions.push({ playerId, cardId, card: effectiveCard });

  const connectedPlayers = room.players.filter(p => p.isConnected);

  if (room.voteMode === "democratic") {
    if (room.submissions.length >= connectedPlayers.length) {
      room.phase = "playing-vote";
      room.submissions = shuffleArray(room.submissions);
    }
  } else {
    const nonQMPlayers = connectedPlayers.filter(p => p.id !== questionMaster.id);
    if (room.submissions.length >= nonQMPlayers.length) {
      room.phase = "playing-judge";
      room.submissions = shuffleArray(room.submissions);
    }
  }

  return room;
}

export function submitBMCVote(roomId: string, playerId: string, targetPlayerId: string): Room | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.phase !== "playing-vote") return { error: "Ce n'est pas le moment de voter." };
  if (room.voteMode !== "democratic") return { error: "Mode de vote invalide." };

  if (playerId === targetPlayerId) return { error: "Tu ne peux pas voter pour toi-même." };

  const targetSubmission = room.submissions.find(s => s.playerId === targetPlayerId);
  if (!targetSubmission) return { error: "Ce joueur n'a pas de réponse." };

  const mySubmission = room.submissions.find(s => s.playerId === playerId);
  if (!mySubmission) return { error: "Tu dois avoir soumis une réponse pour voter." };

  room.votes[playerId] = targetPlayerId;

  const submitters = room.submissions.map(s => s.playerId);
  const allVoted = submitters.every(vid => room.votes[vid] !== undefined);

  if (allVoted) {
    return finalizeVote(room);
  }

  return room;
}

function finalizeVote(room: Room): Room {
  const voteCount: Record<string, number> = {};
  for (const targetId of Object.values(room.votes)) {
    voteCount[targetId] = (voteCount[targetId] || 0) + 1;
  }

  let maxVotes = 0;
  for (const count of Object.values(voteCount)) {
    if (count > maxVotes) maxVotes = count;
  }

  const tied = Object.entries(voteCount).filter(([, c]) => c === maxVotes).map(([pid]) => pid);
  const winnerId = tied[Math.floor(Math.random() * tied.length)];

  const winnerSubmission = room.submissions.find(s => s.playerId === winnerId);
  const winner = room.players.find(p => p.id === winnerId);

  if (!winner || !winnerSubmission) {
    startRound(room);
    return room;
  }

  winner.score++;
  room.lastWinnerId = winnerId;
  room.lastWinnerCardId = winnerSubmission.cardId;

  for (const submission of room.submissions) {
    const player = room.players.find(p => p.id === submission.playerId);
    if (!player) continue;
    room.usedAnswerCardIds.add(submission.cardId);
    player.hand = player.hand.filter(c => c.id !== submission.cardId);
    dealCards(room, player, 1);
  }

  const winnerIndex = room.players.findIndex(p => p.id === winnerId);
  if (winnerIndex !== -1) room.questionMasterIndex = winnerIndex;

  room.phase = "round-result";
  room.roundResultEndsAt = Date.now() + 10_000;

  if (winner.score >= room.targetScore) {
    room.phase = "game-over";
    room.roundResultEndsAt = null;
  }

  return room;
}

export function pickWinner(roomId: string, requesterId: string, winnerId: string): Room | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.phase !== "playing-judge") return { error: "Ce n'est pas le moment de choisir un gagnant." };

  const questionMaster = room.players[room.questionMasterIndex];
  if (requesterId !== questionMaster.id) return { error: "Seul le Question Master peut choisir le gagnant." };

  const winnerSubmission = room.submissions.find(s => s.playerId === winnerId);
  if (!winnerSubmission) return { error: "Joueur introuvable parmi les soumissions." };

  const winner = room.players.find(p => p.id === winnerId);
  if (!winner) return { error: "Gagnant introuvable." };

  winner.score++;
  room.lastWinnerId = winnerId;
  room.lastWinnerCardId = winnerSubmission.cardId;

  for (const submission of room.submissions) {
    const player = room.players.find(p => p.id === submission.playerId);
    if (!player) continue;
    room.usedAnswerCardIds.add(submission.cardId);
    player.hand = player.hand.filter(c => c.id !== submission.cardId);
    dealCards(room, player, 1);
  }

  const winnerIndex = room.players.findIndex(p => p.id === winnerId);
  if (winnerIndex !== -1) room.questionMasterIndex = winnerIndex;

  room.phase = "round-result";
  room.roundResultEndsAt = Date.now() + 10_000;

  if (winner.score >= room.targetScore) {
    room.phase = "game-over";
    room.roundResultEndsAt = null;
  }

  return room;
}

export function nextRound(roomId: string, requesterId: string): Room | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.phase !== "round-result") return { error: "Impossible de passer au tour suivant maintenant." };

  const questionMaster = room.players[room.questionMasterIndex];
  if (requesterId !== questionMaster.id) return { error: "Seul le Question Master peut passer au tour suivant." };

  room.roundResultEndsAt = null;
  startRound(room);
  return room;
}

export function nextRoundInternal(roomId: string): Room | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  if (room.phase !== "round-result") return null;
  room.roundResultEndsAt = null;
  startRound(room);
  return room;
}

export function resetToLobby(roomId: string, requesterId: string): Room | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.hostId !== requesterId) return { error: "Seul l'hôte peut relancer la partie." };

  room.phase = "lobby";
  room.roundResultEndsAt = null;
  room.votes = {};
  for (const player of room.players) {
    player.score = 0;
    player.hand = [];
    player.submittedCardId = null;
  }
  room.currentQuestion = null;
  room.submissions = [];
  room.lastWinnerId = null;
  room.lastWinnerCardId = null;
  room.roundNumber = 0;
  return room;
}

export function getRoomByCode(code: string): Room | undefined {
  return roomsByCode.get(code.toUpperCase());
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function destroyRoom(roomId: string): Room | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  rooms.delete(roomId);
  roomsByCode.delete(room.code);
  return room;
}

export function removePlayerFromBMCRoom(
  roomId: string,
  playerId: string
): { room: Room | null; destroyed: boolean } {
  const room = rooms.get(roomId);
  if (!room) return { room: null, destroyed: false };

  const playerIndex = room.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return { room, destroyed: false };

  room.players.splice(playerIndex, 1);

  if (room.players.length < 3) {
    rooms.delete(roomId);
    roomsByCode.delete(room.code);
    return { room, destroyed: true };
  }

  if (room.hostId === playerId) room.hostId = room.players[0].id;
  if (room.questionMasterIndex >= room.players.length) room.questionMasterIndex = 0;
  room.submissions = room.submissions.filter(s => s.playerId !== playerId);
  delete room.votes[playerId];

  return { room, destroyed: false };
}

export function findPublicBMCRoom(): Room | null {
  for (const room of rooms.values()) {
    if (!room.isPrivate && room.phase === "lobby" && room.players.filter(p => p.isConnected).length > 0 && room.players.length < 10) {
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
