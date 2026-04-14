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

interface WSClient extends WebSocket {
  roomId?: string;
  playerId?: string;
  gameType?: "bmc" | "connect4";
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

function broadcast(roomId: string, room: Room | C4Room) {
  const roomClients = getRoomClients(roomId);
  for (const client of roomClients) {
    if (client.readyState === WebSocket.OPEN && client.playerId) {
      try {
        const payload = room.gameType === "connect4"
          ? sanitizeC4Room(room as C4Room)
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
  gameType: "bmc" | "connect4",
  room: Room | C4Room
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

  const pingInterval = setInterval(() => {
    wss.clients.forEach((rawWs) => {
      const ws = rawWs as WSClient;
      if (ws.isAlive === false) {
        if (ws.roomId && ws.playerId) {
          if (ws.gameType === "connect4") {
            const room = setC4PlayerDisconnected(ws.roomId, ws.playerId);
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

    ws.on("message", (data) => {
      let msg: { type: string; [key: string]: unknown };
      try {
        msg = JSON.parse(data.toString());
      } catch {
        sendError(ws, "Message invalide.");
        return;
      }

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

      sendError(ws, `Type de message inconnu: ${type}`);
    });

    ws.on("close", () => {
      if (ws.roomId && ws.playerId) {
        getRoomClients(ws.roomId).delete(ws);
        if (ws.gameType === "connect4") {
          const room = setC4PlayerDisconnected(ws.roomId, ws.playerId);
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
