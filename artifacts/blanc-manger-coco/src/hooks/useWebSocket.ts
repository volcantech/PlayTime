import { useEffect, useRef, useState, useCallback } from "react";

export interface GameRoom {
  id: string;
  code: string;
  gameType: "bmc";
  hostId: string;
  players: {
    id: string;
    name: string;
    avatar: string;
    score: number;
    handCount: number;
    submittedCardId: string | null;
    isConnected: boolean;
    hand?: { id: number; text: string; isBlank?: boolean }[];
  }[];
  phase: "lobby" | "playing-submit" | "playing-judge" | "playing-vote" | "round-result" | "game-over";
  currentQuestion: { id: number; text: string; blanks: number } | null;
  questionMasterIndex: number;
  submissions: { playerId: string; cardId: number; card: { id: number; text: string }; _realPlayerId?: string }[];
  lastWinnerId: string | null;
  lastWinnerCardId: number | null;
  targetScore: number;
  roundNumber: number;
  isPrivate: boolean;
  cardMode: "normal" | "adult" | "mixed";
  voteMode: "classic" | "democratic";
  votes: Record<string, string>;
  myVote?: string | null;
  voteCount?: number;
  roundResultEndsAt: number | null;
}

export interface C4Room {
  id: string;
  code: string;
  gameType: "connect4";
  hostId: string;
  players: {
    id: string;
    name: string;
    avatar: string;
    isConnected: boolean;
  }[];
  spectators: {
    id: string;
    name: string;
    avatar: string;
  }[];
  phase: "lobby" | "playing" | "game-over";
  board: (string | null)[][];
  currentTurnIndex: number;
  winnerId: string | null;
  isDraw: boolean;
  isPrivate: boolean;
}

export interface UCRoom {
  id: string;
  code: string;
  gameType: "undercover";
  hostId: string;
  players: {
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
  }[];
  phase: "lobby" | "reveal" | "clue" | "discussion" | "voting" | "round-result" | "game-over";
  roundNumber: number;
  clueRound: number;
  undercoverCount: number;
  civilianWord: string;
  undercoverWord: string;
  eliminatedPlayerId: string | null;
  winnerTeam: "civilians" | "undercover" | null;
  lastVotes: Record<string, string>;
  voteSkipped: boolean;
  isPrivate: boolean;
  discussionEndsAt: number | null;
  votingEndsAt: number | null;
  chatMessages: {
    id: string;
    playerId: string;
    playerName: string;
    avatar: string;
    text: string;
    createdAt: number;
  }[];
  discussionDuration: number;
  votingDuration: number;
  roundResultEndsAt: number | null;
}

export interface PBRoom {
  id: string;
  code: string;
  gameType: "petitbac";
  hostId: string;
  players: {
    id: string;
    name: string;
    avatar: string;
    isConnected: boolean;
    hasDone: boolean;
    answers: Record<number, string>;
  }[];
  phase: "lobby" | "playing" | "voting" | "scores" | "game-over";
  categories: { id: number; name: string }[];
  excludedLetters: string[];
  timePerRound: number | null;
  totalRounds: number;
  currentRound: number;
  currentLetter: string | null;
  roundStartedAt: number | null;
  votes: Record<string, Record<string, Record<string, boolean>>>;
  roundScores: { playerId: string; scoresByCat: Record<number, number>; roundTotal: number }[];
  totalScores: Record<string, number>;
  isPrivate: boolean;
  scoresEndsAt: number | null;
  stopAtFirstDone: boolean;
}

export interface GWPlayer {
  id: string;
  name: string;
  avatar: string;
  isConnected: boolean;
  secretCharacterId: number | null;
  eliminatedIds: number[];
  hasSelected: boolean;
  userId?: number;
}

export interface GWCharacter {
  id: number;
  name: string;
  emoji: string;
  imageUrl?: string | null;
  category?: string | null;
  info?: Record<string, string> | null;
  traits: {
    gender: string;
    hair_color: string;
    hair_length?: string;
    glasses: boolean;
    hat: boolean;
    beard: boolean;
    earrings: boolean;
  };
}

export interface GWRoom {
  id: string;
  code: string;
  gameType: "guess_who";
  hostId: string;
  players: GWPlayer[];
  phase: "lobby" | "selection" | "playing" | "game-over";
  characters: GWCharacter[];
  theme: string | null;
  bothSelected: boolean;
  currentAskerId: string | null;
  currentQuestion: string | null;
  currentAnswer: boolean | null;
  questionState: "idle" | "asked" | "answered";
  questionHistory: { question: string; askerId: string; answer: boolean | null }[];
  winnerId: string | null;
  winnerReason: "correct_guess" | "opponent_wrong_guess" | "forfeit" | null;
  isPrivate: boolean;
}

export type GameType = "bmc" | "connect4" | "undercover" | "petitbac" | "guess_who";

export type AnyRoom = GameRoom | C4Room | UCRoom | PBRoom | GWRoom;

export interface SpectateHint {
  code: string;
  gameType: string;
}

type WSMessage =
  | { type: "ROOM_UPDATE"; room: AnyRoom }
  | { type: "JOINED"; playerId: string; roomId: string; gameType: string }
  | { type: "JOINED_AS_SPECTATOR"; spectatorId: string; roomId: string; gameType: string }
  | { type: "ROOM_DESTROYED"; reason: string }
  | { type: "ERROR"; message: string; canSpectate?: boolean; gameType?: string; code?: string };

export type SendMessage = (msg: object) => void;

function clearRoomSession() {
  sessionStorage.removeItem("bmc_room_id");
  sessionStorage.removeItem("bmc_game_type");
  sessionStorage.removeItem("bmc_spectator_id");
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [room, setRoom] = useState<AnyRoom | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(
    () => sessionStorage.getItem("bmc_player_id")
  );
  const [spectatorId, setSpectatorId] = useState<string | null>(
    () => sessionStorage.getItem("bmc_spectator_id")
  );
  const [isSpectating, setIsSpectating] = useState(false);
  const [spectateHint, setSpectateHint] = useState<SpectateHint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [destroyedReason, setDestroyedReason] = useState<string | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalClose = useRef(false);
  const hasRejoined = useRef(false);

  const getWsUrl = () => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws`;
  };

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    intentionalClose.current = false;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);

      if (!hasRejoined.current) {
        const savedRoomId = sessionStorage.getItem("bmc_room_id");
        const savedPlayerId = sessionStorage.getItem("bmc_player_id");
        const savedGameType = sessionStorage.getItem("bmc_game_type") || "bmc";
        if (savedRoomId && savedPlayerId) {
          hasRejoined.current = true;
          ws.send(JSON.stringify({
            type: "REJOIN_ROOM",
            roomId: savedRoomId,
            playerId: savedPlayerId,
            gameType: savedGameType,
          }));
        }
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        if (msg.type === "JOINED") {
          setPlayerId(msg.playerId);
          setIsSpectating(false);
          setSpectatorId(null);
          setSpectateHint(null);
          sessionStorage.setItem("bmc_player_id", msg.playerId);
          sessionStorage.setItem("bmc_room_id", msg.roomId);
          sessionStorage.setItem("bmc_game_type", msg.gameType);
          sessionStorage.removeItem("bmc_spectator_id");
          setDestroyedReason(null);
        } else if (msg.type === "JOINED_AS_SPECTATOR") {
          setSpectatorId(msg.spectatorId);
          setIsSpectating(true);
          setPlayerId(msg.spectatorId);
          setSpectateHint(null);
          sessionStorage.setItem("bmc_spectator_id", msg.spectatorId);
          sessionStorage.setItem("bmc_room_id", msg.roomId);
          sessionStorage.setItem("bmc_game_type", msg.gameType);
          setDestroyedReason(null);
        } else if (msg.type === "ROOM_UPDATE") {
          setRoom(msg.room);
          setError(null);
        } else if (msg.type === "ROOM_DESTROYED") {
          setRoom(null);
          setIsSpectating(false);
          setSpectatorId(null);
          clearRoomSession();
          setDestroyedReason(msg.reason);
        } else if (msg.type === "ERROR") {
          setError(msg.message);
          if (msg.canSpectate && msg.gameType && msg.code) {
            setSpectateHint({ code: msg.code, gameType: msg.gameType });
          }
          if (msg.message === "Salle introuvable.") {
            setRoom(null);
            clearRoomSession();
          }
        }
      } catch {
        setError("Erreur de communication avec le serveur.");
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (!intentionalClose.current) {
        reconnectTimer.current = setTimeout(connect, 2000);
      }
    };

    ws.onerror = () => { setConnected(false); };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      intentionalClose.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "LEAVE_ROOM" }));
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
      setError(null);
    } else {
      setError("Connexion perdue. Reconnexion en cours...");
    }
  }, []);

  const getUserToken = () => localStorage.getItem("pt_user_token") || undefined;

  const createRoom = useCallback((name: string, avatar: string, gameType: GameType = "bmc", options?: { undercoverCount?: number; isPrivate?: boolean; cardMode?: "normal" | "adult" | "mixed"; voteMode?: "classic" | "democratic" }) => {
    sessionStorage.setItem("bmc_player_name", name);
    sessionStorage.setItem("bmc_player_avatar", avatar);
    send({
      type: "CREATE_ROOM",
      name,
      avatar,
      gameType,
      undercoverCount: options?.undercoverCount,
      isPrivate: options?.isPrivate ?? false,
      cardMode: options?.cardMode ?? "normal",
      voteMode: options?.voteMode ?? "classic",
      userToken: getUserToken(),
    });
  }, [send]);

  const joinRoom = useCallback((code: string, name: string, avatar: string) => {
    sessionStorage.setItem("bmc_player_name", name);
    sessionStorage.setItem("bmc_player_avatar", avatar);
    setSpectateHint(null);
    send({ type: "JOIN_ROOM", code, name, avatar, userToken: getUserToken() });
  }, [send]);

  const joinAsSpectator = useCallback((code: string, name: string, avatar: string) => {
    sessionStorage.setItem("bmc_player_name", name);
    sessionStorage.setItem("bmc_player_avatar", avatar);
    send({ type: "C4_JOIN_SPECTATOR", code, name, avatar });
  }, [send]);

  const quickMatch = useCallback((name: string, avatar: string, gameType: GameType = "bmc") => {
    sessionStorage.setItem("bmc_player_name", name);
    sessionStorage.setItem("bmc_player_avatar", avatar);
    send({ type: "QUICK_MATCH", name, avatar, gameType, userToken: getUserToken() });
  }, [send]);

  const leaveRoom = useCallback(() => {
    send({ type: "LEAVE_ROOM" });
    setRoom(null);
    setIsSpectating(false);
    setSpectatorId(null);
    clearRoomSession();
    setDestroyedReason(null);
  }, [send]);

  const dismissDestroyed = useCallback(() => setDestroyedReason(null), []);

  const clearSpectateHint = useCallback(() => setSpectateHint(null), []);

  const setMyPlayerId = useCallback((id: string) => {
    setPlayerId(id);
    sessionStorage.setItem("bmc_player_id", id);
  }, []);

  return {
    room, playerId, spectatorId, isSpectating, error, connected, send,
    createRoom, joinRoom, joinAsSpectator, quickMatch, leaveRoom,
    destroyedReason, dismissDestroyed,
    spectateHint, clearSpectateHint,
    setMyPlayerId,
  };
}
