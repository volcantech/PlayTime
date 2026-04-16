export interface GWTraits {
  gender: "homme" | "femme";
  hair_color: "brun" | "blond" | "roux" | "gris" | "chauve";
  hair_length?: "court" | "long";
  glasses: boolean;
  hat: boolean;
  beard: boolean;
  earrings: boolean;
}

export interface GWCharacter {
  id: number;
  name: string;
  emoji: string;
  imageUrl?: string | null;
  category?: string | null;
  traits: GWTraits;
}

export interface GWPlayer {
  id: string;
  name: string;
  avatar: string;
  isConnected: boolean;
  userId?: number;
  secretCharacterId: number | null;
  eliminatedIds: number[];
  hasSelected: boolean;
}

export type GWPhase = "lobby" | "selection" | "playing" | "game-over";
export type GWQuestionState = "idle" | "asked" | "answered";

export interface GWRoom {
  id: string;
  code: string;
  gameType: "guess_who";
  hostId: string;
  players: GWPlayer[];
  phase: GWPhase;
  characters: GWCharacter[];
  allCharacters: GWCharacter[];
  theme: string | null;
  bothSelected: boolean;
  currentAskerId: string | null;
  currentQuestion: string | null;
  currentAnswer: boolean | null;
  questionState: GWQuestionState;
  questionHistory: string[];
  winnerId: string | null;
  winnerReason: "correct_guess" | "opponent_wrong_guess" | "forfeit" | null;
  isPrivate: boolean;
  createdAt: number;
}

const rooms = new Map<string, GWRoom>();
const roomsByCode = new Map<string, GWRoom>();

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function sanitizeGWRoom(room: GWRoom, forPlayerId: string): object {
  const isGameOver = room.phase === "game-over";
  return {
    ...room,
    allCharacters: undefined,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isConnected: p.isConnected,
      hasSelected: p.hasSelected,
      secretCharacterId: (p.id === forPlayerId || isGameOver) ? p.secretCharacterId : null,
      eliminatedIds: p.id === forPlayerId ? p.eliminatedIds : [],
    })),
  };
}

export function createGWRoom(
  hostName: string,
  avatar: string,
  characters: GWCharacter[],
  options?: { isPrivate?: boolean },
): { room: GWRoom; playerId: string } {
  let code = generateRoomCode();
  while (roomsByCode.has(code)) code = generateRoomCode();

  const playerId = generateId();
  const roomId = generateId();

  const room: GWRoom = {
    id: roomId,
    code,
    gameType: "guess_who",
    hostId: playerId,
    players: [{
      id: playerId,
      name: hostName,
      avatar,
      isConnected: true,
      secretCharacterId: null,
      eliminatedIds: [],
      hasSelected: false,
    }],
    phase: "lobby",
    characters,
    allCharacters: characters,
    theme: null,
    bothSelected: false,
    currentAskerId: null,
    currentQuestion: null,
    currentAnswer: null,
    questionState: "idle",
    questionHistory: [],
    winnerId: null,
    winnerReason: null,
    isPrivate: options?.isPrivate ?? false,
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);
  roomsByCode.set(code, room);
  return { room, playerId };
}

export function joinGWRoom(
  code: string,
  name: string,
  avatar: string,
): { room: GWRoom; playerId: string } | { error: string } {
  const room = roomsByCode.get(code.toUpperCase());
  if (!room) return { error: "Salle introuvable." };
  if (room.phase !== "lobby") return { error: "La partie a déjà commencé." };
  if (room.players.length >= 2) return { error: "La salle est pleine (2 joueurs max)." };

  const playerId = generateId();
  room.players.push({
    id: playerId,
    name,
    avatar,
    isConnected: true,
    secretCharacterId: null,
    eliminatedIds: [],
    hasSelected: false,
  });

  return { room, playerId };
}

export function setGWTheme(
  roomId: string,
  playerId: string,
  theme: string | null,
): GWRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.hostId !== playerId) return { error: "Seul l'hôte peut changer le thème." };
  if (room.phase !== "lobby") return { error: "Impossible de changer le thème après le début." };
  room.theme = theme;
  return room;
}

export function startGWSelection(
  roomId: string,
  playerId: string,
): GWRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.hostId !== playerId) return { error: "Seul l'hôte peut démarrer." };
  if (room.players.length < 2) return { error: "Il faut 2 joueurs pour commencer." };
  if (room.phase !== "lobby") return { error: "La partie a déjà commencé." };

  let chars = room.allCharacters;
  if (room.theme && room.theme !== "all") {
    chars = room.allCharacters.filter(c => c.category === room.theme);
  }
  if (chars.length < 6) {
    return { error: `Pas assez de personnages pour ce thème (${chars.length}/6 minimum). Choisissez un autre thème.` };
  }

  room.characters = chars;
  room.phase = "selection";
  room.bothSelected = false;
  room.players.forEach(p => {
    p.secretCharacterId = null;
    p.eliminatedIds = [];
    p.hasSelected = false;
  });
  return room;
}

export function selectGWCharacter(
  roomId: string,
  playerId: string,
  characterId: number,
): GWRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.phase !== "selection") return { error: "Phase de sélection terminée." };

  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: "Joueur introuvable." };

  const character = room.characters.find(c => c.id === characterId);
  if (!character) return { error: "Personnage introuvable." };

  player.secretCharacterId = characterId;
  player.hasSelected = true;

  if (room.players.every(p => p.hasSelected)) {
    room.bothSelected = true;
  }

  return room;
}

export function startGWGame(
  roomId: string,
  playerId: string,
): GWRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.hostId !== playerId) return { error: "Seul l'hôte peut lancer la partie." };
  if (room.phase !== "selection") return { error: "Pas en phase de sélection." };
  if (!room.bothSelected) return { error: "Les deux joueurs doivent choisir leur personnage." };

  room.phase = "playing";
  room.currentAskerId = room.hostId;
  room.questionState = "idle";
  room.questionHistory = [];
  return room;
}

export function askGWQuestion(
  roomId: string,
  playerId: string,
  question: string,
): GWRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.phase !== "playing") return { error: "La partie n'est pas en cours." };
  if (room.currentAskerId !== playerId) return { error: "Ce n'est pas ton tour." };
  if (room.questionState !== "idle") return { error: "Attends la fin du tour en cours." };

  const q = question.trim();
  if (!q) return { error: "La question ne peut pas être vide." };

  room.currentQuestion = q;
  room.currentAnswer = null;
  room.questionState = "asked";
  room.questionHistory.push(q);
  return room;
}

export function answerGWQuestion(
  roomId: string,
  playerId: string,
  answer: boolean,
): GWRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.phase !== "playing") return { error: "La partie n'est pas en cours." };
  if (room.currentAskerId === playerId) return { error: "Tu ne peux pas répondre à ta propre question." };
  if (room.questionState !== "asked") return { error: "Aucune question en attente." };

  room.currentAnswer = answer;
  room.questionState = "answered";
  return room;
}

export function nextGWTurn(
  roomId: string,
  playerId: string,
): GWRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.phase !== "playing") return { error: "La partie n'est pas en cours." };
  if (room.currentAskerId !== playerId) return { error: "Ce n'est pas ton tour." };
  if (room.questionState !== "answered") return { error: "Attends la réponse de l'adversaire." };

  const otherPlayer = room.players.find(p => p.id !== playerId);
  room.currentAskerId = otherPlayer?.id ?? null;
  room.currentQuestion = null;
  room.currentAnswer = null;
  room.questionState = "idle";
  return room;
}

export function toggleGWEliminate(
  roomId: string,
  playerId: string,
  characterId: number,
): GWRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.phase !== "playing") return { error: "La partie n'est pas en cours." };

  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: "Joueur introuvable." };

  const idx = player.eliminatedIds.indexOf(characterId);
  if (idx === -1) {
    player.eliminatedIds.push(characterId);
  } else {
    player.eliminatedIds.splice(idx, 1);
  }
  return room;
}

export function makeGWGuess(
  roomId: string,
  playerId: string,
  characterId: number,
): GWRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.phase !== "playing") return { error: "La partie n'est pas en cours." };
  if (room.currentAskerId !== playerId) return { error: "Ce n'est pas ton tour." };
  if (room.questionState !== "idle") return { error: "Termine le tour en cours avant de deviner." };

  const opponent = room.players.find(p => p.id !== playerId);
  if (!opponent) return { error: "Adversaire introuvable." };

  if (opponent.secretCharacterId === characterId) {
    room.phase = "game-over";
    room.winnerId = playerId;
    room.winnerReason = "correct_guess";
  } else {
    room.phase = "game-over";
    room.winnerId = opponent.id;
    room.winnerReason = "opponent_wrong_guess";
  }
  return room;
}

export function forfeitGWGame(
  roomId: string,
  leavingPlayerId: string,
): GWRoom | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  if (room.phase !== "playing" && room.phase !== "selection") return null;
  if (room.players.length < 2) return null;

  const winner = room.players.find(p => p.id !== leavingPlayerId);
  if (!winner) return null;

  room.phase = "game-over";
  room.winnerId = winner.id;
  room.winnerReason = "forfeit";
  return room;
}

export function resetGWRoom(
  roomId: string,
  playerId: string,
): GWRoom | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Salle introuvable." };
  if (room.hostId !== playerId) return { error: "Seul l'hôte peut relancer la partie." };

  room.phase = "lobby";
  room.characters = room.allCharacters;
  room.theme = null;
  room.bothSelected = false;
  room.players.forEach(p => {
    p.secretCharacterId = null;
    p.eliminatedIds = [];
    p.hasSelected = false;
  });
  room.currentAskerId = null;
  room.currentQuestion = null;
  room.currentAnswer = null;
  room.questionState = "idle";
  room.questionHistory = [];
  room.winnerId = null;
  room.winnerReason = null;
  return room;
}

export function setGWPlayerDisconnected(roomId: string, playerId: string, disconnected: boolean): void {
  const room = rooms.get(roomId);
  if (!room) return;
  const player = room.players.find(p => p.id === playerId);
  if (player) player.isConnected = !disconnected;
}

export function getGWRoom(roomId: string): GWRoom | undefined {
  return rooms.get(roomId);
}

export function getGWRoomByCode(code: string): GWRoom | undefined {
  return roomsByCode.get(code.toUpperCase());
}

export function destroyGWRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  roomsByCode.delete(room.code);
  rooms.delete(roomId);
}

export function findPublicGWRoom(): GWRoom | undefined {
  for (const room of rooms.values()) {
    if (!room.isPrivate && room.phase === "lobby" && room.players.length === 1) {
      return room;
    }
  }
  return undefined;
}

export function removePlayerFromGWRoom(roomId: string, playerId: string): GWRoom | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.players = room.players.filter(p => p.id !== playerId);
  if (room.players.length === 0) {
    destroyGWRoom(roomId);
    return null;
  }
  if (room.hostId === playerId && room.players.length > 0) {
    room.hostId = room.players[0].id;
  }
  return room;
}
