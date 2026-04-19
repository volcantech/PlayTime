import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage, Server } from "http";
import { logger } from "./logger";
import {
  createRoom, joinRoom, startGame, submitAnswer, pickWinner,
  nextRound, nextRoundInternal, resetToLobby, setTargetScore, setCardMode, getRoom, setPlayerDisconnected,
  destroyRoom, findPublicBMCRoom, removePlayerFromBMCRoom,
  type Room,
} from "./gameEngine";
import {
  createC4Room, joinC4Room, dropPiece, resetC4Room,
  setC4PlayerDisconnected, getC4Room, getC4RoomByCode,
  destroyC4Room, findPublicC4Room,
  type C4Room,
} from "./connect4Engine";
import {
  createUCRoom, joinUCRoom, startUCRoom, markUCWordSeen,
  submitUCClue, voteUCPlayer, nextUCRound, nextUCRoundInternal, resetUCRoom,
  setUCPlayerDisconnected, getUCRoom, getUCRoomByCode,
  destroyUCRoom, findPublicUCRoom, removePlayerFromUCRoom,
  setUCUndercoverCount, setUCDiscussionDuration, setUCVotingDuration, addUCChatMessage,
  startUCVoting, processUCVotes,
  type UCRoom,
} from "./undercoverEngine";
import {
  createPBRoom, joinPBRoom, getPBRoom, getPBRoomByCode,
  setPBPlayerDisconnected, destroyPBRoom, removePlayerFromPBRoom,
  startPBGame, configurePBRoom, setPBAnswer, setPBDone,
  submitPBVote, nextPBRound, nextPBRoundInternal, resetPBRoom, setPBBroadcastFn,
  addPBCategory, removePBCategory, findPublicPBRoom,
  type PBRoom,
} from "./petitBacEngine";
import {
  createGWRoom, joinGWRoom, startGWSelection, startGWGame, selectGWCharacter,
  askGWQuestion, answerGWQuestion, nextGWTurn, toggleGWEliminate,
  makeGWGuess, resetGWRoom, sanitizeGWRoom, setGWPlayerDisconnected,
  getGWRoom, getGWRoomByCode, destroyGWRoom, forfeitGWGame,
  setGWTheme, removePlayerFromGWRoom, findPublicGWRoom,
  type GWRoom,
} from "./guessWhoEngine";
import { db, petitBacCategoriesTable, guessWhoCharactersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { getPBCategories, reloadPBCategoryCache } from "./petitBacCategoryCache";
import { recordWin, recordLoss, recordDraw } from "./userStats";
import { verifyUserToken } from "./authUtils";

function extractUserId(msg: { [key: string]: unknown }): number | undefined {
  const token = typeof msg.userToken === "string" ? msg.userToken : null;
  if (!token) return undefined;
  const id = verifyUserToken(token);
  return id ?? undefined;
}

function setPlayerUserId(room: Room | C4Room | UCRoom | PBRoom, playerId: string, userId: number | undefined) {
  if (!userId) return;
  const player = (room as any).players?.find((p: any) => p.id === playerId);
  if (player) player.userId = userId;
}

interface WSClient extends WebSocket {
  roomId?: string;
  playerId?: string;
  gameType?: "bmc" | "connect4" | "undercover" | "petitbac" | "guess_who";
  isAlive?: boolean;
}

const clients = new Map<string, Set<WSClient>>();

function getRoomClients(roomId: string): Set<WSClient> {
  if (!clients.has(roomId)) clients.set(roomId, new Set());
  return clients.get(roomId)!;
}

const ucDiscussionTimers = new Map<string, ReturnType<typeof setTimeout>>();
const ucVotingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const ucRoundResultTimers = new Map<string, ReturnType<typeof setTimeout>>();
const bmcRoundResultTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pbScoresTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearUCTimers(roomId: string) {
  const dt = ucDiscussionTimers.get(roomId);
  if (dt) { clearTimeout(dt); ucDiscussionTimers.delete(roomId); }
  const vt = ucVotingTimers.get(roomId);
  if (vt) { clearTimeout(vt); ucVotingTimers.delete(roomId); }
  const rt = ucRoundResultTimers.get(roomId);
  if (rt) { clearTimeout(rt); ucRoundResultTimers.delete(roomId); }
}

function clearBMCRoundTimer(roomId: string) {
  const t = bmcRoundResultTimers.get(roomId);
  if (t) { clearTimeout(t); bmcRoundResultTimers.delete(roomId); }
}

function clearPBScoresTimer(roomId: string) {
  const t = pbScoresTimers.get(roomId);
  if (t) { clearTimeout(t); pbScoresTimers.delete(roomId); }
}

function scheduleUCNextRound(roomId: string) {
  const rt = ucRoundResultTimers.get(roomId);
  if (rt) { clearTimeout(rt); ucRoundResultTimers.delete(roomId); }
  const timer = setTimeout(() => {
    ucRoundResultTimers.delete(roomId);
    const updated = nextUCRoundInternal(roomId);
    if (!updated) return;
    broadcast(roomId, updated);
  }, 10_000);
  ucRoundResultTimers.set(roomId, timer);
}

function scheduleBMCNextRound(roomId: string) {
  clearBMCRoundTimer(roomId);
  const timer = setTimeout(() => {
    bmcRoundResultTimers.delete(roomId);
    const updated = nextRoundInternal(roomId);
    if (!updated) return;
    broadcast(roomId, updated);
  }, 10_000);
  bmcRoundResultTimers.set(roomId, timer);
}

function schedulePBNextRound(roomId: string) {
  clearPBScoresTimer(roomId);
  const timer = setTimeout(() => {
    pbScoresTimers.delete(roomId);
    const updated = nextPBRoundInternal(roomId);
    if (!updated) return;
    broadcast(roomId, updated);
  }, 10_000);
  pbScoresTimers.set(roomId, timer);
}

function scheduleUCDiscussion(roomId: string, msRemaining: number) {
  clearUCTimers(roomId);
  const timer = setTimeout(() => {
    ucDiscussionTimers.delete(roomId);
    const updated = startUCVoting(roomId);
    if (!updated) return;
    broadcast(roomId, updated);
    if (updated.phase === "voting" && updated.votingEndsAt) {
      scheduleUCVoting(roomId, updated.votingEndsAt - Date.now());
    }
  }, Math.max(msRemaining, 0));
  ucDiscussionTimers.set(roomId, timer);
}

function scheduleUCVoting(roomId: string, msRemaining: number) {
  const vt = ucVotingTimers.get(roomId);
  if (vt) { clearTimeout(vt); ucVotingTimers.delete(roomId); }
  const timer = setTimeout(() => {
    ucVotingTimers.delete(roomId);
    const updated = processUCVotes(roomId);
    if (!updated) return;
    broadcast(roomId, updated);
    if (updated.phase === "game-over" && updated.winnerTeam) {
      const winRole = updated.winnerTeam === "civilians" ? "civilian" : "undercover";
      const loseRole = winRole === "civilian" ? "undercover" : "civilian";
      for (const p of updated.players) {
        if (p.userId && p.role === winRole) recordWin(p.userId, "undercover").catch(() => {});
        else if (p.userId && p.role === loseRole) recordLoss(p.userId, "undercover").catch(() => {});
      }
    } else if (updated.phase === "round-result" && updated.roundResultEndsAt) {
      scheduleUCNextRound(roomId);
    }
  }, Math.max(msRemaining, 0));
  ucVotingTimers.set(roomId, timer);
}

function sanitizeBMCRoom(room: Room, forPlayerId: string) {
  return {
    ...room,
    gameType: "bmc",
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      handCount: p.hand.length,
      submittedCardId: p.submittedCardId !== null ? "submitted" : null,
      isConnected: p.isConnected,
      hand: p.id === forPlayerId ? p.hand : undefined,
    })),
    questionDeck: undefined,
    answerDeck: undefined,
    submissions: room.phase === "playing-submit"
      ? room.submissions.map(s => ({ playerId: s.playerId, cardId: s.cardId }))
      : room.submissions,
  };
}

function sanitizeC4Room(room: C4Room) {
  return { ...room };
}

function sanitizeUCRoom(room: UCRoom, forPlayerId: string) {
  const viewingPlayer = room.players.find(p => p.id === forPlayerId);
  const isSpectating = viewingPlayer != null && !viewingPlayer.isAlive;
  return {
    ...room,
    players: room.players.map(p => ({
      ...p,
      role: p.id === forPlayerId || room.phase === "game-over" || !p.isAlive ? p.role : "civilian",
      word: p.id === forPlayerId || room.phase === "game-over" || (isSpectating && !p.isAlive) ? p.word : "",
    })),
  };
}

function sanitizePBRoom(room: PBRoom, forPlayerId: string) {
  return {
    ...room,
    players: room.players.map(p => ({
      ...p,
      answers: room.phase === "voting" || room.phase === "scores" || room.phase === "game-over"
        ? p.answers
        : p.id === forPlayerId ? p.answers : {},
    })),
  };
}

function broadcast(roomId: string, room: Room | C4Room | UCRoom | PBRoom | GWRoom) {
  const roomClients = getRoomClients(roomId);
  for (const client of roomClients) {
    if (client.readyState === WebSocket.OPEN && client.playerId) {
      try {
        const payload = room.gameType === "connect4"
          ? sanitizeC4Room(room as C4Room)
          : room.gameType === "undercover"
            ? sanitizeUCRoom(room as UCRoom, client.playerId)
            : room.gameType === "petitbac"
              ? sanitizePBRoom(room as PBRoom, client.playerId)
              : room.gameType === "guess_who"
                ? sanitizeGWRoom(room as GWRoom, client.playerId)
                : sanitizeBMCRoom(room as Room, client.playerId);
        client.send(JSON.stringify({ type: "ROOM_UPDATE", room: payload }));
      } catch (err) {
        logger.error({ err }, "Error broadcasting to client");
      }
    }
  }
}

function broadcastDestroyed(roomId: string, reason = "La salle a été fermée.") {
  const roomClients = getRoomClients(roomId);
  for (const client of roomClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify({ type: "ROOM_DESTROYED", reason }));
      } catch (err) {
        logger.error({ err }, "Error sending ROOM_DESTROYED");
      }
      client.roomId = undefined;
      client.playerId = undefined;
      client.gameType = undefined;
    }
  }
  clients.delete(roomId);
}

function sendError(ws: WSClient, message: string) {
  if (ws.readyState === WebSocket.OPEN)
    ws.send(JSON.stringify({ type: "ERROR", message }));
}

function attachAndJoin(
  ws: WSClient,
  roomId: string,
  playerId: string,
  gameType: "bmc" | "connect4" | "undercover",
  room: Room | C4Room | UCRoom
) {
  ws.roomId = roomId;
  ws.playerId = playerId;
  ws.gameType = gameType;
  getRoomClients(roomId).add(ws);
  ws.send(JSON.stringify({ type: "JOINED", playerId, roomId, gameType }));
  broadcast(roomId, room);
}

export function setupWebSocketServer(server: Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" });
  setPBBroadcastFn((roomId, room) => {
    broadcast(roomId, room);
    if (room.phase === "game-over") {
      const scores = room.totalScores;
      const activePlayers = room.players;
      const maxScore = Math.max(...activePlayers.map(p => scores[p.id] ?? 0));
      const winners = activePlayers.filter(p => (scores[p.id] ?? 0) === maxScore);
      const isDraw = winners.length > 1;
      for (const p of activePlayers) {
        if (!p.userId) continue;
        const isWinner = (scores[p.id] ?? 0) === maxScore;
        if (isDraw && isWinner) recordDraw(p.userId, "petitbac").catch(() => {});
        else if (!isDraw && isWinner) recordWin(p.userId, "petitbac").catch(() => {});
      }
    } else if (room.phase === "scores" && room.scoresEndsAt) {
      schedulePBNextRound(roomId);
    }
  });

  const pingInterval = setInterval(() => {
    wss.clients.forEach((rawWs) => {
      const ws = rawWs as WSClient;
      if (ws.isAlive === false) {
        if (ws.roomId && ws.playerId) {
          if (ws.gameType === "connect4") {
            const room = setC4PlayerDisconnected(ws.roomId, ws.playerId);
            if (room) broadcast(ws.roomId, room);
          } else if (ws.gameType === "undercover") {
            const roomId = ws.roomId;
            const room = setUCPlayerDisconnected(roomId, ws.playerId);
            if (room) {
              broadcast(roomId, room);
              if (room.phase === "discussion" && room.discussionEndsAt) {
                scheduleUCDiscussion(roomId, room.discussionEndsAt - Date.now());
              } else if (room.phase === "voting" && room.votingEndsAt) {
                scheduleUCVoting(roomId, room.votingEndsAt - Date.now());
              } else if (room.phase === "round-result" && room.roundResultEndsAt) {
                scheduleUCNextRound(roomId);
              }
            }
          } else if (ws.gameType === "petitbac") {
            const room = setPBPlayerDisconnected(ws.roomId, ws.playerId);
            if (room) broadcast(ws.roomId, room);
          } else {
            const room = setPlayerDisconnected(ws.roomId, ws.playerId);
            if (room) broadcast(ws.roomId, room);
          }
        }
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(pingInterval));

  wss.on("connection", (rawWs: WebSocket, req: IncomingMessage) => {
    const ws = rawWs as WSClient;
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });
    logger.info({ url: req.url }, "WebSocket connected");

    ws.on("message", async (data) => {
      let msg: { type: string; [key: string]: unknown };
      try {
        msg = JSON.parse(data.toString());
      } catch {
        sendError(ws, "Message invalide.");
        return;
      }
      try {
        await handleMessage(ws, msg);
      } catch (err) {
        logger.error({ err }, "Unhandled error in WebSocket message handler");
        sendError(ws, "Une erreur interne est survenue.");
      }
    });

    ws.on("close", () => {
      if (ws.roomId && ws.playerId) {
        getRoomClients(ws.roomId).delete(ws);
        if (ws.gameType === "connect4") {
          const room = setC4PlayerDisconnected(ws.roomId, ws.playerId);
          if (room) broadcast(ws.roomId, room);
        } else if (ws.gameType === "undercover") {
          const roomId = ws.roomId;
          const room = setUCPlayerDisconnected(roomId, ws.playerId);
          if (room) {
            broadcast(roomId, room);
            if (room.phase === "discussion" && room.discussionEndsAt) {
              scheduleUCDiscussion(roomId, room.discussionEndsAt - Date.now());
            } else if (room.phase === "voting" && room.votingEndsAt) {
              scheduleUCVoting(roomId, room.votingEndsAt - Date.now());
            } else if (room.phase === "round-result" && room.roundResultEndsAt) {
              scheduleUCNextRound(roomId);
            }
          }
        } else if (ws.gameType === "petitbac") {
          const room = setPBPlayerDisconnected(ws.roomId, ws.playerId);
          if (room) broadcast(ws.roomId, room);
        } else if (ws.gameType === "guess_who") {
          const roomId = ws.roomId;
          const playerId = ws.playerId;
          const gwRoom = getGWRoom(roomId);
          if (gwRoom && gwRoom.players.length >= 2 && (gwRoom.phase === "playing" || gwRoom.phase === "selection")) {
            const forfeitResult = forfeitGWGame(roomId, playerId);
            if (forfeitResult) {
              const winner = forfeitResult.players.find(p => p.id !== playerId);
              const loser = forfeitResult.players.find(p => p.id === playerId);
              if (winner?.userId) recordWin(winner.userId, "guess_who").catch(() => {});
              if (loser?.userId) recordLoss(loser.userId, "guess_who").catch(() => {});
              broadcast(roomId, forfeitResult);
              removePlayerFromGWRoom(roomId, playerId);
            }
          } else {
            setGWPlayerDisconnected(roomId, playerId, true);
            const room = getGWRoom(roomId);
            if (room) broadcast(roomId, room);
          }
        } else {
          const room = setPlayerDisconnected(ws.roomId, ws.playerId);
          if (room) broadcast(ws.roomId, room);
        }
      }
    });

    ws.on("error", (err) => { logger.error({ err }, "WebSocket error"); });
  });

  logger.info("WebSocket server set up at /ws");
}

async function handleMessage(ws: WSClient, msg: { type: string; [key: string]: unknown }) {
  const { type } = msg;

      // ── CREATE ROOM ──────────────────────────────────────────────
      if (type === "CREATE_ROOM") {
        const name = String(msg.name || "").trim();
        const avatar = String(msg.avatar || "🐱");
        const gameType = String(msg.gameType || "bmc");
        const isPrivate = msg.isPrivate === true;
        const userId = extractUserId(msg);
        if (!name) { sendError(ws, "Le prénom est requis."); return; }

        if (gameType === "connect4") {
          const { room, playerId } = createC4Room(name, avatar, { isPrivate });
          setPlayerUserId(room, playerId, userId);
          attachAndJoin(ws, room.id, playerId, "connect4", room);
        } else if (gameType === "undercover") {
          const undercoverCount = Number(msg.undercoverCount) || 1;
          const { room, playerId } = createUCRoom(name, avatar, undercoverCount, { isPrivate });
          setPlayerUserId(room, playerId, userId);
          attachAndJoin(ws, room.id, playerId, "undercover", room);
        } else if (gameType === "petitbac") {
          const categories = getPBCategories();
          if (categories.length === 0) { sendError(ws, "Aucune catégorie disponible. Contactez l'administrateur."); return; }
          const { room, playerId } = createPBRoom(name, avatar, categories, { isPrivate });
          setPlayerUserId(room, playerId, userId);
          attachAndJoin(ws, room.id, playerId, "petitbac", room);
        } else if (gameType === "guess_who") {
          const chars = await db.select().from(guessWhoCharactersTable).where(eq(guessWhoCharactersTable.active, true));
          if (chars.length < 6) { sendError(ws, "Pas assez de personnages actifs. Contactez l'administrateur."); return; }
          const { room, playerId } = createGWRoom(name, avatar, chars as any[], { isPrivate });
          setPlayerUserId(room, playerId, userId);
          attachAndJoin(ws, room.id, playerId, "guess_who", room);
        } else {
          const rawCardMode = String(msg.cardMode ?? "normal");
          const cardMode = (["normal", "adult", "mixed"].includes(rawCardMode) ? rawCardMode : "normal") as import("./cardCache").CardMode;
          const { room, playerId } = createRoom(name, avatar, { isPrivate, cardMode });
          setPlayerUserId(room, playerId, userId);
          attachAndJoin(ws, room.id, playerId, "bmc", room);
        }
        return;
      }

      // ── QUICK MATCH ───────────────────────────────────────────────
      if (type === "QUICK_MATCH") {
        const name = String(msg.name || "").trim();
        const avatar = String(msg.avatar || "🐱");
        const gameType = String(msg.gameType || "bmc");
        const userId = extractUserId(msg);
        if (!name) { sendError(ws, "Le prénom est requis."); return; }

        if (gameType === "connect4") {
          const existing = findPublicC4Room();
          if (existing) {
            const result = joinC4Room(existing.code, name, avatar);
            if ("error" in result) { sendError(ws, result.error); return; }
            setPlayerUserId(result.room, result.playerId, userId);
            attachAndJoin(ws, result.room.id, result.playerId, "connect4", result.room);
          } else {
            const { room, playerId } = createC4Room(name, avatar);
            setPlayerUserId(room, playerId, userId);
            attachAndJoin(ws, room.id, playerId, "connect4", room);
          }
        } else if (gameType === "undercover") {
          const existing = findPublicUCRoom();
          if (existing) {
            const result = joinUCRoom(existing.code, name, avatar);
            if ("error" in result) { sendError(ws, result.error); return; }
            setPlayerUserId(result.room, result.playerId, userId);
            attachAndJoin(ws, result.room.id, result.playerId, "undercover", result.room);
          } else {
            const { room, playerId } = createUCRoom(name, avatar);
            setPlayerUserId(room, playerId, userId);
            attachAndJoin(ws, room.id, playerId, "undercover", room);
          }
        } else if (gameType === "petitbac") {
          const existingPB = findPublicPBRoom();
          if (existingPB) {
            const result = joinPBRoom(existingPB.code, name, avatar);
            if ("error" in result) { sendError(ws, result.error); return; }
            setPlayerUserId(result.room, result.playerId, userId);
            attachAndJoin(ws, result.room.id, result.playerId, "petitbac", result.room);
          } else {
            const categories = getPBCategories();
            if (categories.length === 0) { sendError(ws, "Aucune catégorie disponible. Contactez l'administrateur."); return; }
            const { room, playerId } = createPBRoom(name, avatar, categories);
            setPlayerUserId(room, playerId, userId);
            attachAndJoin(ws, room.id, playerId, "petitbac", room);
          }
        } else if (gameType === "guess_who") {
          const existingGW = findPublicGWRoom();
          if (existingGW) {
            const result = joinGWRoom(existingGW.code, name, avatar);
            if ("error" in result) { sendError(ws, result.error); return; }
            setPlayerUserId(result.room, result.playerId, userId);
            attachAndJoin(ws, result.room.id, result.playerId, "guess_who", result.room);
          } else {
            const chars = await db.select().from(guessWhoCharactersTable).where(eq(guessWhoCharactersTable.active, true));
            if (chars.length < 6) { sendError(ws, "Pas assez de personnages actifs. Contactez l'administrateur."); return; }
            const { room, playerId } = createGWRoom(name, avatar, chars as any[]);
            setPlayerUserId(room, playerId, userId);
            attachAndJoin(ws, room.id, playerId, "guess_who", room);
          }
        } else {
          const existing = findPublicBMCRoom();
          if (existing) {
            const result = joinRoom(existing.code, name, avatar);
            if ("error" in result) { sendError(ws, result.error); return; }
            setPlayerUserId(result.room, result.playerId, userId);
            attachAndJoin(ws, result.room.id, result.playerId, "bmc", result.room);
          } else {
            const { room, playerId } = createRoom(name, avatar);
            setPlayerUserId(room, playerId, userId);
            attachAndJoin(ws, room.id, playerId, "bmc", room);
          }
        }
        return;
      }

      // ── JOIN ROOM ─────────────────────────────────────────────────
      if (type === "JOIN_ROOM") {
        const code = String(msg.code || "").trim().toUpperCase();
        const name = String(msg.name || "").trim();
        const avatar = String(msg.avatar || "🐱");
        const userId = extractUserId(msg);
        if (!code || !name) { sendError(ws, "Code et prénom requis."); return; }

        const c4Room = getC4RoomByCode(code);
        if (c4Room) {
          const result = joinC4Room(code, name, avatar);
          if ("error" in result) { sendError(ws, result.error); return; }
          setPlayerUserId(result.room, result.playerId, userId);
          attachAndJoin(ws, result.room.id, result.playerId, "connect4", result.room);
          return;
        }

        const ucRoom = getUCRoomByCode(code);
        if (ucRoom) {
          const result = joinUCRoom(code, name, avatar);
          if ("error" in result) { sendError(ws, result.error); return; }
          setPlayerUserId(result.room, result.playerId, userId);
          attachAndJoin(ws, result.room.id, result.playerId, "undercover", result.room);
          return;
        }

        const pbRoom = getPBRoomByCode(code);
        if (pbRoom) {
          const result = joinPBRoom(code, name, avatar);
          if ("error" in result) { sendError(ws, result.error); return; }
          setPlayerUserId(result.room, result.playerId, userId);
          attachAndJoin(ws, result.room.id, result.playerId, "petitbac", result.room);
          return;
        }

        const gwRoom = getGWRoomByCode(code);
        if (gwRoom) {
          const result = joinGWRoom(code, name, avatar);
          if ("error" in result) { sendError(ws, result.error); return; }
          setPlayerUserId(result.room, result.playerId, userId);
          attachAndJoin(ws, result.room.id, result.playerId, "guess_who", result.room);
          return;
        }

        const result = joinRoom(code, name, avatar);
        if ("error" in result) { sendError(ws, result.error); return; }
        setPlayerUserId(result.room, result.playerId, userId);
        attachAndJoin(ws, result.room.id, result.playerId, "bmc", result.room);
        return;
      }

      // ── REJOIN ROOM ───────────────────────────────────────────────
      if (type === "REJOIN_ROOM") {
        const roomId = String(msg.roomId || "");
        const playerId = String(msg.playerId || "");
        const gameType = String(msg.gameType || "bmc");

        if (gameType === "connect4") {
          const room = getC4Room(roomId);
          if (!room) { sendError(ws, "Salle introuvable."); return; }
          const player = room.players.find(p => p.id === playerId);
          if (!player) { sendError(ws, "Joueur introuvable."); return; }
          player.isConnected = true;
          ws.roomId = roomId;
          ws.playerId = playerId;
          ws.gameType = "connect4";
          getRoomClients(roomId).add(ws);
          broadcast(roomId, room);
        } else if (gameType === "undercover") {
          const room = getUCRoom(roomId);
          if (!room) { sendError(ws, "Salle introuvable."); return; }
          const player = room.players.find(p => p.id === playerId);
          if (!player) { sendError(ws, "Joueur introuvable."); return; }
          player.isConnected = true;
          ws.roomId = roomId;
          ws.playerId = playerId;
          ws.gameType = "undercover";
          getRoomClients(roomId).add(ws);
          broadcast(roomId, room);
        } else if (gameType === "petitbac") {
          const room = getPBRoom(roomId);
          if (!room) { sendError(ws, "Salle introuvable."); return; }
          const player = room.players.find(p => p.id === playerId);
          if (!player) { sendError(ws, "Joueur introuvable."); return; }
          player.isConnected = true;
          ws.roomId = roomId;
          ws.playerId = playerId;
          ws.gameType = "petitbac";
          getRoomClients(roomId).add(ws);
          broadcast(roomId, room);
        } else if (gameType === "guess_who") {
          const room = getGWRoom(roomId);
          if (!room) { sendError(ws, "Salle introuvable."); return; }
          const player = room.players.find(p => p.id === playerId);
          if (!player) { sendError(ws, "Joueur introuvable."); return; }
          player.isConnected = true;
          ws.roomId = roomId;
          ws.playerId = playerId;
          ws.gameType = "guess_who";
          getRoomClients(roomId).add(ws);
          broadcast(roomId, room);
        } else {
          const room = getRoom(roomId);
          if (!room) { sendError(ws, "Salle introuvable."); return; }
          const player = room.players.find(p => p.id === playerId);
          if (!player) { sendError(ws, "Joueur introuvable."); return; }
          player.isConnected = true;
          ws.roomId = roomId;
          ws.playerId = playerId;
          ws.gameType = "bmc";
          getRoomClients(roomId).add(ws);
          broadcast(roomId, room);
        }
        return;
      }

      // ── LEAVE ROOM ────────────────────────────────────────────────
      if (type === "KICK_PLAYER") {
        if (!ws.roomId || !ws.playerId) return;
        const targetPlayerId = String(msg.targetPlayerId || "");
        if (!targetPlayerId) return;

        const roomId = ws.roomId;
        const requesterId = ws.playerId;
        const gameType = ws.gameType;

        let isHost = false;
        if (gameType === "undercover") {
          const r = getUCRoom(roomId);
          isHost = r?.hostId === requesterId;
        } else if (gameType === "petitbac") {
          const r = getPBRoom(roomId);
          isHost = r?.hostId === requesterId;
        } else {
          const r = getRoom(roomId);
          isHost = r?.hostId === requesterId;
        }

        if (!isHost) { sendError(ws, "Seul l'hôte peut exclure des joueurs."); return; }
        if (targetPlayerId === requesterId) { sendError(ws, "Tu ne peux pas t'exclure toi-même."); return; }

        const roomClients = getRoomClients(roomId);
        for (const client of roomClients) {
          if (client.playerId === targetPlayerId) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: "ROOM_DESTROYED", reason: "Tu as été exclu de la salle par l'hôte." }));
            }
            client.roomId = undefined;
            client.playerId = undefined;
            client.gameType = undefined;
            roomClients.delete(client);
            break;
          }
        }

        if (gameType === "undercover") {
          const { room, destroyed } = removePlayerFromUCRoom(roomId, targetPlayerId);
          if (destroyed) {
            clearUCTimers(roomId);
            broadcastDestroyed(roomId, "Pas assez de joueurs pour continuer à Undercover.");
          } else if (room) {
            broadcast(roomId, room);
          }
        } else if (gameType === "petitbac") {
          const { room, destroyed } = removePlayerFromPBRoom(roomId, targetPlayerId);
          if (destroyed) {
            broadcastDestroyed(roomId, "Pas assez de joueurs pour continuer (moins de 2).");
          } else if (room) {
            broadcast(roomId, room);
          }
        } else {
          const { room, destroyed } = removePlayerFromBMCRoom(roomId, targetPlayerId);
          if (destroyed) {
            broadcastDestroyed(roomId, "Pas assez de joueurs pour continuer (moins de 3).");
          } else if (room) {
            broadcast(roomId, room);
          }
        }
        return;
      }

      if (type === "LEAVE_ROOM") {
        if (!ws.roomId) return;
        const roomId = ws.roomId;
        const leavingPlayerId = ws.playerId;
        const gameType = ws.gameType;
        ws.roomId = undefined;
        ws.playerId = undefined;
        ws.gameType = undefined;
        getRoomClients(roomId).delete(ws);

        if (gameType === "connect4") {
          const c4Room = getC4Room(roomId);
          if (c4Room && c4Room.players.length >= 2 && c4Room.phase === "playing" && leavingPlayerId) {
            const winner = c4Room.players.find(p => p.id !== leavingPlayerId);
            const loser = c4Room.players.find(p => p.id === leavingPlayerId);
            if (winner?.userId) recordWin(winner.userId, "connect4").catch(() => {});
            if (loser?.userId) recordLoss(loser.userId, "connect4").catch(() => {});
          }
          destroyC4Room(roomId);
          broadcastDestroyed(roomId, "Un joueur a quitté la partie.");
        } else if (gameType === "undercover" && leavingPlayerId) {
          const { room, destroyed } = removePlayerFromUCRoom(roomId, leavingPlayerId);
          if (destroyed) {
            clearUCTimers(roomId);
            broadcastDestroyed(roomId, "Pas assez de joueurs pour continuer à Undercover.");
          } else if (room) {
            broadcast(roomId, room);
          }
        } else if (gameType === "petitbac" && leavingPlayerId) {
          const pbRoom = getPBRoom(roomId);
          if (pbRoom && pbRoom.players.length === 2 && pbRoom.phase !== "lobby") {
            const winner = pbRoom.players.find(p => p.id !== leavingPlayerId);
            const loser = pbRoom.players.find(p => p.id === leavingPlayerId);
            if (winner?.userId) recordWin(winner.userId, "petitbac").catch(() => {});
            if (loser?.userId) recordLoss(loser.userId, "petitbac").catch(() => {});
          }
          const { room, destroyed } = removePlayerFromPBRoom(roomId, leavingPlayerId);
          if (destroyed) {
            broadcastDestroyed(roomId, "Pas assez de joueurs pour continuer (moins de 2).");
          } else if (room) {
            broadcast(roomId, room);
          }
        } else if (gameType === "guess_who" && leavingPlayerId) {
          const gwRoom = getGWRoom(roomId);
          if (gwRoom && gwRoom.players.length >= 2 && (gwRoom.phase === "playing" || gwRoom.phase === "selection")) {
            const forfeitResult = forfeitGWGame(roomId, leavingPlayerId);
            if (forfeitResult) {
              const winner = forfeitResult.players.find(p => p.id !== leavingPlayerId);
              const loser = forfeitResult.players.find(p => p.id === leavingPlayerId);
              if (winner?.userId) recordWin(winner.userId, "guess_who").catch(() => {});
              if (loser?.userId) recordLoss(loser.userId, "guess_who").catch(() => {});
              broadcast(roomId, forfeitResult);
              removePlayerFromGWRoom(roomId, leavingPlayerId);
            }
          } else if (gwRoom) {
            const updated = removePlayerFromGWRoom(roomId, leavingPlayerId);
            if (updated === null) {
              broadcastDestroyed(roomId, "La salle a été fermée.");
            } else {
              broadcast(roomId, updated);
            }
          }
        } else if (leavingPlayerId) {
          const { room, destroyed } = removePlayerFromBMCRoom(roomId, leavingPlayerId);
          if (destroyed) {
            broadcastDestroyed(roomId, "Pas assez de joueurs pour continuer (moins de 3).");
          } else if (room) {
            broadcast(roomId, room);
          }
        }
        return;
      }

      if (!ws.roomId || !ws.playerId) {
        sendError(ws, "Rejoins une salle d'abord.");
        return;
      }

      // ── CONNECT4 ACTIONS ──────────────────────────────────────────
      if (type === "C4_DROP") {
        const col = Number(msg.col);
        const result = dropPiece(ws.roomId, ws.playerId, col);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        if (result.winnerId) {
          const winnerPlayer = result.players.find(p => p.id === result.winnerId);
          if (winnerPlayer?.userId) recordWin(winnerPlayer.userId, "connect4").catch(() => {});
          for (const p of result.players) {
            if (p.userId && p.id !== result.winnerId) recordLoss(p.userId, "connect4").catch(() => {});
          }
        } else if (result.isDraw) {
          for (const p of result.players) {
            if (p.userId) recordDraw(p.userId, "connect4").catch(() => {});
          }
        }
        return;
      }

      if (type === "C4_RESET") {
        const result = resetC4Room(ws.roomId, ws.playerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "UC_START") {
        const result = startUCRoom(ws.roomId, ws.playerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "UC_SET_UNDERCOVER_COUNT") {
        const count = Number(msg.count);
        const result = setUCUndercoverCount(ws.roomId, ws.playerId, count);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "UC_SEEN") {
        const result = markUCWordSeen(ws.roomId, ws.playerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "UC_CLUE") {
        const clue = String(msg.clue || "");
        const result = submitUCClue(ws.roomId, ws.playerId, clue);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        if (result.phase === "discussion" && result.discussionEndsAt) {
          scheduleUCDiscussion(ws.roomId, result.discussionEndsAt - Date.now());
        }
        return;
      }

      if (type === "UC_VOTE") {
        const targetId = String(msg.targetId || "");
        const result = voteUCPlayer(ws.roomId, ws.playerId, targetId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        if (result.phase === "game-over" && result.winnerTeam) {
          clearUCTimers(ws.roomId);
          const winRole = result.winnerTeam === "civilians" ? "civilian" : "undercover";
          const loseRole = winRole === "civilian" ? "undercover" : "civilian";
          for (const p of result.players) {
            if (p.userId && p.role === winRole) recordWin(p.userId, "undercover").catch(() => {});
            else if (p.userId && p.role === loseRole) recordLoss(p.userId, "undercover").catch(() => {});
          }
        } else if (result.phase === "round-result" && result.roundResultEndsAt) {
          clearUCTimers(ws.roomId);
          scheduleUCNextRound(ws.roomId);
        } else if (result.phase !== "voting") {
          clearUCTimers(ws.roomId);
        }
        return;
      }

      if (type === "UC_SET_DISCUSSION_DURATION") {
        const duration = Number(msg.duration);
        const result = setUCDiscussionDuration(ws.roomId, ws.playerId, duration);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "UC_SET_VOTING_DURATION") {
        const duration = Number(msg.duration);
        const result = setUCVotingDuration(ws.roomId, ws.playerId, duration);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "UC_CHAT") {
        const text = String(msg.text || "");
        const result = addUCChatMessage(ws.roomId, ws.playerId, text);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "UC_NEXT_ROUND") {
        clearUCTimers(ws.roomId);
        const result = nextUCRound(ws.roomId, ws.playerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "UC_RESET") {
        clearUCTimers(ws.roomId);
        const result = resetUCRoom(ws.roomId, ws.playerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      // ── BMC ACTIONS ───────────────────────────────────────────────
      if (type === "SET_TARGET_SCORE") {
        const score = Number(msg.score);
        const result = setTargetScore(ws.roomId, ws.playerId, score);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "SET_HARD_MODE") {
        const rawCardMode = String(msg.cardMode ?? "normal");
        const cardMode = (["normal", "adult", "mixed"].includes(rawCardMode) ? rawCardMode : "normal") as import("./cardCache").CardMode;
        const result = setCardMode(ws.roomId, ws.playerId, cardMode);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "START_GAME") {
        const result = startGame(ws.roomId, ws.playerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "SUBMIT_ANSWER") {
        const cardId = Number(msg.cardId);
        const customText = typeof msg.customText === "string" ? msg.customText : undefined;
        const result = submitAnswer(ws.roomId, ws.playerId, cardId, customText);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "PICK_WINNER") {
        const winnerId = String(msg.winnerId || "");
        const result = pickWinner(ws.roomId, ws.playerId, winnerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        if (result.phase === "game-over" && result.lastWinnerId) {
          const winnerPlayer = result.players.find(p => p.id === result.lastWinnerId);
          if (winnerPlayer?.userId) recordWin(winnerPlayer.userId, "bmc").catch(() => {});
        } else if (result.phase === "round-result" && result.roundResultEndsAt) {
          scheduleBMCNextRound(ws.roomId);
        }
        return;
      }

      if (type === "NEXT_ROUND") {
        clearBMCRoundTimer(ws.roomId);
        const result = nextRound(ws.roomId, ws.playerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "RESET_TO_LOBBY") {
        clearBMCRoundTimer(ws.roomId);
        const result = resetToLobby(ws.roomId, ws.playerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      // ── PETIT BAC ACTIONS ─────────────────────────────────────────
      if (type === "PB_START") {
        const result = startPBGame(ws.roomId, ws.playerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "PB_CONFIG") {
        const { excludedLetters, timePerRound, totalRounds, stopAtFirstDone } = msg as { excludedLetters?: string[]; timePerRound?: number | null; totalRounds?: number; stopAtFirstDone?: boolean };
        const result = configurePBRoom(ws.roomId, ws.playerId, { excludedLetters, timePerRound, totalRounds, stopAtFirstDone });
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "PB_ADD_CATEGORY") {
        const categoryId = Number(msg.categoryId);
        const categoryName = String(msg.categoryName || "").trim();
        let category = null as { id: number; name: string } | null;
        if (categoryId) {
          const cached = getPBCategories().find(c => c.id === categoryId);
          if (cached) {
            category = cached;
          } else {
            const existing = await db.select().from(petitBacCategoriesTable).where(eq(petitBacCategoriesTable.id, categoryId)).limit(1);
            category = existing[0] && existing[0].active ? { id: existing[0].id, name: existing[0].name } : null;
          }
        } else if (categoryName) {
          // Custom category: in-memory only, never saved to DB
          const tempId = -(Math.floor(Math.random() * 1_000_000_000) + 1);
          category = { id: tempId, name: categoryName };
        }
        if (!category) { sendError(ws, "Catégorie introuvable."); return; }
        const result = addPBCategory(ws.roomId, ws.playerId, category);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "PB_REMOVE_CATEGORY") {
        const categoryId = Number(msg.categoryId);
        const result = removePBCategory(ws.roomId, ws.playerId, categoryId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "PB_SET_ANSWER") {
        const categoryId = Number(msg.categoryId);
        const answer = String(msg.answer || "");
        const result = setPBAnswer(ws.roomId, ws.playerId, categoryId, answer);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "PB_DONE") {
        const result = setPBDone(ws.roomId, ws.playerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "PB_VOTE") {
        const targetPlayerId = String(msg.targetPlayerId || "");
        const categoryId = Number(msg.categoryId);
        const valid = msg.valid === true;
        const result = submitPBVote(ws.roomId, ws.playerId, targetPlayerId, categoryId, valid);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        if (result.phase === "scores" && result.scoresEndsAt) {
          schedulePBNextRound(ws.roomId);
        }
        return;
      }

      if (type === "PB_NEXT_ROUND") {
        clearPBScoresTimer(ws.roomId);
        const result = nextPBRound(ws.roomId, ws.playerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "PB_RESET") {
        clearPBScoresTimer(ws.roomId);
        const result = resetPBRoom(ws.roomId, ws.playerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      // ── GUESS WHO ACTIONS ─────────────────────────────────────────
      if (type === "GW_SET_THEME") {
        if (!ws.roomId || !ws.playerId) return;
        const theme = msg.theme === null || msg.theme === "all" ? null : String(msg.theme || "");
        const result = setGWTheme(ws.roomId, ws.playerId, theme || null);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "GW_START_SELECTION") {
        if (!ws.roomId || !ws.playerId) return;
        const result = startGWSelection(ws.roomId, ws.playerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "GW_START_GAME") {
        if (!ws.roomId || !ws.playerId) return;
        const result = startGWGame(ws.roomId, ws.playerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "GW_SELECT_CHARACTER") {
        if (!ws.roomId || !ws.playerId) return;
        const characterId = Number(msg.characterId);
        const result = selectGWCharacter(ws.roomId, ws.playerId, characterId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "GW_ASK_QUESTION") {
        if (!ws.roomId || !ws.playerId) return;
        const question = String(msg.question || "").trim();
        if (!question) { sendError(ws, "La question est requise."); return; }
        const result = askGWQuestion(ws.roomId, ws.playerId, question);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "GW_ANSWER_QUESTION") {
        if (!ws.roomId || !ws.playerId) return;
        const answer = msg.answer as boolean;
        if (typeof answer !== "boolean") { sendError(ws, "Réponse invalide."); return; }
        const result = answerGWQuestion(ws.roomId, ws.playerId, answer);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "GW_NEXT_TURN") {
        if (!ws.roomId || !ws.playerId) return;
        const result = nextGWTurn(ws.roomId, ws.playerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "GW_TOGGLE_ELIMINATE") {
        if (!ws.roomId || !ws.playerId) return;
        const characterId = Number(msg.characterId);
        const result = toggleGWEliminate(ws.roomId, ws.playerId, characterId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "GW_MAKE_GUESS") {
        if (!ws.roomId || !ws.playerId) return;
        const characterId = Number(msg.characterId);
        const result = makeGWGuess(ws.roomId, ws.playerId, characterId);
        if ("error" in result) { sendError(ws, result.error); return; }
        // Record stats if game over
        if (result.phase === "game-over" && result.winnerId) {
          for (const player of result.players) {
            if (!player.userId) continue;
            if (player.id === result.winnerId) {
              recordWin(player.userId, "guess_who").catch(() => {});
            } else {
              recordLoss(player.userId, "guess_who").catch(() => {});
            }
          }
        }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "GW_RESET") {
        if (!ws.roomId || !ws.playerId) return;
        const result = resetGWRoom(ws.roomId, ws.playerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

  sendError(ws, `Type de message inconnu: ${type}`);
}
