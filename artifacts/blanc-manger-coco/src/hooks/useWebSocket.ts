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
    hand?: { id: number; text: string }[];
  }[];
  phase: "lobby" | "playing-submit" | "playing-judge" | "round-result" | "game-over";
  currentQuestion: { id: number; text: string; blanks: number } | null;
  questionMasterIndex: number;
  submissions: { playerId: string; cardId: number; card: { id: number; text: string } }[];
  lastWinnerId: string | null;
  lastWinnerCardId: number | null;
  targetScore: number;
  roundNumber: number;
  isPrivate: boolean;
  hardMode: boolean;
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

export type GameType = "bmc" | "connect4" | "undercover" | "petitbac";

export type AnyRoom = GameRoom | C4Room | UCRoom | PBRoom;

type WSMessage =
  | { type: "ROOM_UPDATE"; room: AnyRoom }
  | { type: "JOINED"; playerId: string; roomId: string; gameType: string }
  | { type: "ROOM_DESTROYED"; reason: string }
  | { type: "ERROR"; message: string };

export type SendMessage = (msg: object) => void;

function clearRoomSession() {
  sessionStorage.removeItem("bmc_room_id");
  sessionStorage.removeItem("bmc_game_type");
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [room, setRoom] = useState<AnyRoom | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(
    () => sessionStorage.getItem("bmc_player_id")
  );
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
          sessionStorage.setItem("bmc_player_id", msg.playerId);
          sessionStorage.setItem("bmc_room_id", msg.roomId);
          sessionStorage.setItem("bmc_game_type", msg.gameType);
          setDestroyedReason(null);
        } else if (msg.type === "ROOM_UPDATE") {
          setRoom(msg.room);
          setError(null);
        } else if (msg.type === "ROOM_DESTROYED") {
          setRoom(null);
          clearRoomSession();
          setDestroyedReason(msg.reason);
        } else if (msg.type === "ERROR") {
          setError(msg.message);
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

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
      setError(null);
    } else {
      setError("Connexion perdue. Reconnexion en cours...");
    }
  }, []);

  const getUserToken = () => localStorage.getItem("pt_user_token") || undefined;

  const createRoom = useCallback((name: string, avatar: string, gameType: GameType = "bmc", options?: { undercoverCount?: number; isPrivate?: boolean; hardMode?: boolean }) => {
    sessionStorage.setItem("bmc_player_name", name);
    sessionStorage.setItem("bmc_player_avatar", avatar);
    send({ type: "CREATE_ROOM", name, avatar, gameType, undercoverCount: options?.undercoverCount, isPrivate: options?.isPrivate ?? false, hardMode: options?.hardMode ?? false, userToken: getUserToken() });
  }, [send]);

  const joinRoom = useCallback((code: string, name: string, avatar: string) => {
    sessionStorage.setItem("bmc_player_name", name);
    sessionStorage.setItem("bmc_player_avatar", avatar);
    send({ type: "JOIN_ROOM", code, name, avatar, userToken: getUserToken() });
  }, [send]);

  const quickMatch = useCallback((name: string, avatar: string, gameType: GameType = "bmc") => {
    sessionStorage.setItem("bmc_player_name", name);
    sessionStorage.setItem("bmc_player_avatar", avatar);
    send({ type: "QUICK_MATCH", name, avatar, gameType, userToken: getUserToken() });
  }, [send]);

  const leaveRoom = useCallback(() => {
    send({ type: "LEAVE_ROOM" });
    setRoom(null);
    clearRoomSession();
    setDestroyedReason(null);
  }, [send]);

  const dismissDestroyed = useCallback(() => setDestroyedReason(null), []);

  const setMyPlayerId = useCallback((id: string) => {
    setPlayerId(id);
    sessionStorage.setItem("bmc_player_id", id);
  }, []);

  return {
    room, playerId, error, connected, send,
    createRoom, joinRoom, quickMatch, leaveRoom,
    destroyedReason, dismissDestroyed,
    setMyPlayerId,
  };
}
