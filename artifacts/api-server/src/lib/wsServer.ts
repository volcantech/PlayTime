import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage, Server } from "http";
import { logger } from "./logger";
import {
  createRoom, joinRoom, startGame, submitAnswer, pickWinner,
  nextRound, resetToLobby, setTargetScore, getRoom, setPlayerDisconnected,
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
  submitUCClue, voteUCPlayer, nextUCRound, resetUCRoom,
  setUCPlayerDisconnected, getUCRoom, getUCRoomByCode,
  destroyUCRoom, findPublicUCRoom, removePlayerFromUCRoom,
  setUCUndercoverCount, addUCChatMessage,
  type UCRoom,
} from "./undercoverEngine";
import {
  createPBRoom, joinPBRoom, getPBRoom, getPBRoomByCode,
  setPBPlayerDisconnected, destroyPBRoom, removePlayerFromPBRoom,
  startPBGame, configurePBRoom, setPBAnswer, setPBDone,
  submitPBVote, nextPBRound, resetPBRoom, setPBBroadcastFn,
  addPBCategory, removePBCategory,
  type PBRoom,
} from "./petitBacEngine";
import { getPBCategories, reloadPBCategoryCache } from "./petitBacCategoryCache";
import { db, petitBacCategoriesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

interface WSClient extends WebSocket {
  roomId?: string;
  playerId?: string;
  gameType?: "bmc" | "connect4" | "undercover" | "petitbac";
  isAlive?: boolean;
}

const clients = new Map<string, Set<WSClient>>();

function getRoomClients(roomId: string): Set<WSClient> {
  if (!clients.has(roomId)) clients.set(roomId, new Set());
  return clients.get(roomId)!;
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
  return {
    ...room,
    players: room.players.map(p => ({
      ...p,
      role: p.id === forPlayerId || room.phase === "game-over" || !p.isAlive ? p.role : "civilian",
      word: p.id === forPlayerId || room.phase === "game-over" ? p.word : "",
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

function broadcast(roomId: string, room: Room | C4Room | UCRoom | PBRoom) {
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
  setPBBroadcastFn((roomId, room) => broadcast(roomId, room));

  const pingInterval = setInterval(() => {
    wss.clients.forEach((rawWs) => {
      const ws = rawWs as WSClient;
      if (ws.isAlive === false) {
        if (ws.roomId && ws.playerId) {
          if (ws.gameType === "connect4") {
            const room = setC4PlayerDisconnected(ws.roomId, ws.playerId);
            if (room) broadcast(ws.roomId, room);
          } else if (ws.gameType === "undercover") {
            const room = setUCPlayerDisconnected(ws.roomId, ws.playerId);
            if (room) broadcast(ws.roomId, room);
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
          const room = setUCPlayerDisconnected(ws.roomId, ws.playerId);
          if (room) broadcast(ws.roomId, room);
        } else if (ws.gameType === "petitbac") {
          const room = setPBPlayerDisconnected(ws.roomId, ws.playerId);
          if (room) broadcast(ws.roomId, room);
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
        if (!name) { sendError(ws, "Le prénom est requis."); return; }

        if (gameType === "connect4") {
          const { room, playerId } = createC4Room(name, avatar);
          attachAndJoin(ws, room.id, playerId, "connect4", room);
        } else if (gameType === "undercover") {
          const undercoverCount = Number(msg.undercoverCount) || 1;
          const { room, playerId } = createUCRoom(name, avatar, undercoverCount);
          attachAndJoin(ws, room.id, playerId, "undercover", room);
        } else if (gameType === "petitbac") {
          const categories = getPBCategories();
          if (categories.length === 0) { sendError(ws, "Aucune catégorie disponible. Contactez l'administrateur."); return; }
          const { room, playerId } = createPBRoom(name, avatar, categories);
          attachAndJoin(ws, room.id, playerId, "petitbac", room);
        } else {
          const { room, playerId } = createRoom(name, avatar);
          attachAndJoin(ws, room.id, playerId, "bmc", room);
        }
        return;
      }

      // ── QUICK MATCH ───────────────────────────────────────────────
      if (type === "QUICK_MATCH") {
        const name = String(msg.name || "").trim();
        const avatar = String(msg.avatar || "🐱");
        const gameType = String(msg.gameType || "bmc");
        if (!name) { sendError(ws, "Le prénom est requis."); return; }

        if (gameType === "connect4") {
          const existing = findPublicC4Room();
          if (existing) {
            const result = joinC4Room(existing.code, name, avatar);
            if ("error" in result) { sendError(ws, result.error); return; }
            attachAndJoin(ws, result.room.id, result.playerId, "connect4", result.room);
          } else {
            const { room, playerId } = createC4Room(name, avatar);
            attachAndJoin(ws, room.id, playerId, "connect4", room);
          }
        } else if (gameType === "undercover") {
          const existing = findPublicUCRoom();
          if (existing) {
            const result = joinUCRoom(existing.code, name, avatar);
            if ("error" in result) { sendError(ws, result.error); return; }
            attachAndJoin(ws, result.room.id, result.playerId, "undercover", result.room);
          } else {
            const { room, playerId } = createUCRoom(name, avatar);
            attachAndJoin(ws, room.id, playerId, "undercover", room);
          }
        } else if (gameType === "petitbac") {
          const categories = getPBCategories();
          if (categories.length === 0) { sendError(ws, "Aucune catégorie disponible. Contactez l'administrateur."); return; }
          const { room, playerId } = createPBRoom(name, avatar, categories);
          attachAndJoin(ws, room.id, playerId, "petitbac", room);
        } else {
          const existing = findPublicBMCRoom();
          if (existing) {
            const result = joinRoom(existing.code, name, avatar);
            if ("error" in result) { sendError(ws, result.error); return; }
            attachAndJoin(ws, result.room.id, result.playerId, "bmc", result.room);
          } else {
            const { room, playerId } = createRoom(name, avatar);
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
        if (!code || !name) { sendError(ws, "Code et prénom requis."); return; }

        const c4Room = getC4RoomByCode(code);
        if (c4Room) {
          const result = joinC4Room(code, name, avatar);
          if ("error" in result) { sendError(ws, result.error); return; }
          attachAndJoin(ws, result.room.id, result.playerId, "connect4", result.room);
          return;
        }

        const ucRoom = getUCRoomByCode(code);
        if (ucRoom) {
          const result = joinUCRoom(code, name, avatar);
          if ("error" in result) { sendError(ws, result.error); return; }
          attachAndJoin(ws, result.room.id, result.playerId, "undercover", result.room);
          return;
        }

        const pbRoom = getPBRoomByCode(code);
        if (pbRoom) {
          const result = joinPBRoom(code, name, avatar);
          if ("error" in result) { sendError(ws, result.error); return; }
          attachAndJoin(ws, result.room.id, result.playerId, "petitbac", result.room);
          return;
        }

        const result = joinRoom(code, name, avatar);
        if ("error" in result) { sendError(ws, result.error); return; }
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
          const destroyed = destroyC4Room(roomId);
          if (destroyed) broadcastDestroyed(roomId, "Un joueur a quitté la partie.");
        } else if (gameType === "undercover" && leavingPlayerId) {
          const { room, destroyed } = removePlayerFromUCRoom(roomId, leavingPlayerId);
          if (destroyed) {
            broadcastDestroyed(roomId, "Pas assez de joueurs pour continuer à Undercover.");
          } else if (room) {
            broadcast(roomId, room);
          }
        } else if (gameType === "petitbac" && leavingPlayerId) {
          const { room, destroyed } = removePlayerFromPBRoom(roomId, leavingPlayerId);
          if (destroyed) {
            broadcastDestroyed(roomId, "Pas assez de joueurs pour continuer (moins de 2).");
          } else if (room) {
            broadcast(roomId, room);
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
        return;
      }

      if (type === "UC_VOTE") {
        const targetId = String(msg.targetId || "");
        const result = voteUCPlayer(ws.roomId, ws.playerId, targetId);
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
        const result = nextUCRound(ws.roomId, ws.playerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "UC_RESET") {
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

      if (type === "START_GAME") {
        const result = startGame(ws.roomId, ws.playerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "SUBMIT_ANSWER") {
        const cardId = Number(msg.cardId);
        const result = submitAnswer(ws.roomId, ws.playerId, cardId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "PICK_WINNER") {
        const winnerId = String(msg.winnerId || "");
        const result = pickWinner(ws.roomId, ws.playerId, winnerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "NEXT_ROUND") {
        const result = nextRound(ws.roomId, ws.playerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "RESET_TO_LOBBY") {
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
        const { excludedLetters, timePerRound, totalRounds } = msg as { excludedLetters?: string[]; timePerRound?: number | null; totalRounds?: number };
        const result = configurePBRoom(ws.roomId, ws.playerId, { excludedLetters, timePerRound, totalRounds });
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
        return;
      }

      if (type === "PB_NEXT_ROUND") {
        const result = nextPBRound(ws.roomId, ws.playerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

      if (type === "PB_RESET") {
        const result = resetPBRoom(ws.roomId, ws.playerId);
        if ("error" in result) { sendError(ws, result.error); return; }
        broadcast(ws.roomId, result);
        return;
      }

  sendError(ws, `Type de message inconnu: ${type}`);
}
