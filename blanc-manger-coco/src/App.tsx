import { useEffect, useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { GameRoom, C4Room, UCRoom, PBRoom } from "@/hooks/useWebSocket";
import { Home } from "@/pages/Home";
import { Lobby } from "@/pages/Lobby";
import { Playing } from "@/pages/Playing";
import { GameOver } from "@/pages/GameOver";
import { Connect4 } from "@/pages/Connect4";
import { Undercover } from "@/pages/Undercover";
import { PetitBac } from "@/pages/PetitBac";
import Admin from "@/pages/Admin";

function getUrlRoomCode(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("room");
}

function updateUrlWithRoom(code: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("room", code);
  window.history.replaceState({}, "", url.toString());
}

function clearUrlRoom() {
  const url = new URL(window.location.href);
  url.searchParams.delete("room");
  window.history.replaceState({}, "", url.toString());
}

function ConnectionBanner({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-400 text-yellow-900 text-center text-xs font-bold py-1.5 flex items-center justify-center gap-2">
      <span className="animate-spin">⏳</span> Reconnexion au serveur...
    </div>
  );
}

function DestroyedBanner({ reason, onDismiss }: { reason: string; onDismiss: () => void }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-orange-500 text-white text-center text-sm font-bold py-2 flex items-center justify-center gap-3">
      <span>🚪 {reason}</span>
      <button onClick={onDismiss} className="text-white/70 hover:text-white text-xs underline">
        Fermer
      </button>
    </div>
  );
}

function Game() {
  const {
    room, playerId, error, connected, send,
    createRoom, joinRoom, quickMatch, leaveRoom,
    destroyedReason, dismissDestroyed,
    setMyPlayerId,
  } = useWebSocket();
  const [initialCode] = useState(getUrlRoomCode);

  useEffect(() => {
    if (room) updateUrlWithRoom(room.code);
  }, [room?.code]);

  useEffect(() => {
    if (!room && !sessionStorage.getItem("bmc_room_id")) clearUrlRoom();
  }, [room]);

  useEffect(() => {
    if (!room) {
      document.title = "PlayTime";
    } else if (room.gameType === "connect4") {
      document.title = "PlayTime - Puissance 4";
    } else if (room.gameType === "undercover") {
      document.title = "PlayTime - Undercover";
    } else {
      document.title = "PlayTime - Blanc Manger Coco";
    }
  }, [room?.gameType]);

  if (!room || !playerId) {
    return (
      <>
        <ConnectionBanner connected={connected} />
        {destroyedReason && <DestroyedBanner reason={destroyedReason} onDismiss={dismissDestroyed} />}
        <Home
          error={error}
          connected={connected}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onQuickMatch={quickMatch}
          setMyPlayerId={setMyPlayerId}
          send={send}
          initialCode={initialCode || undefined}
        />
      </>
    );
  }

  // ── PUISSANCE 4 ───────────────────────────────────────────────────
  if (room.gameType === "connect4") {
    return (
      <>
        <ConnectionBanner connected={connected} />
        <Connect4 room={room as C4Room} playerId={playerId} send={send} error={error} onLeave={leaveRoom} />
      </>
    );
  }

  if (room.gameType === "undercover") {
    return (
      <>
        <ConnectionBanner connected={connected} />
        <Undercover room={room as UCRoom} playerId={playerId} send={send} error={error} onLeave={leaveRoom} />
      </>
    );
  }

  if (room.gameType === "petitbac") {
    return (
      <>
        <ConnectionBanner connected={connected} />
        <PetitBac room={room as PBRoom} playerId={playerId} send={send} error={error} onLeave={leaveRoom} />
      </>
    );
  }

  // ── BLANC MANGER COCO ─────────────────────────────────────────────
  const bmcRoom = room as GameRoom;

  if (bmcRoom.phase === "lobby") {
    return (
      <>
        <ConnectionBanner connected={connected} />
        <Lobby room={bmcRoom} playerId={playerId} send={send} error={error} onLeave={leaveRoom} />
      </>
    );
  }

  if (bmcRoom.phase === "game-over") {
    return (
      <>
        <ConnectionBanner connected={connected} />
        <GameOver room={bmcRoom} playerId={playerId} send={send} onLeave={leaveRoom} />
      </>
    );
  }

  return (
    <>
      <ConnectionBanner connected={connected} />
      <Playing room={bmcRoom} playerId={playerId} send={send} error={error} onLeave={leaveRoom} />
    </>
  );
}

function isAdminPath(): boolean {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const path = window.location.pathname;
  return path === `${base}/admin` || path === `${base}/admin/`;
}

function App() {
  if (isAdminPath()) return <Admin />;
  return <Game />;
}

export default App;
