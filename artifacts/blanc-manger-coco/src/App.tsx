import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { GameRoom, C4Room, UCRoom, PBRoom, GWRoom, GameType } from "@/hooks/useWebSocket";
import { useAuth } from "@/hooks/useAuth";
import { Home } from "@/pages/Home";
import { Lobby } from "@/pages/Lobby";
import { Playing } from "@/pages/Playing";
import { GameOver } from "@/pages/GameOver";
import { Connect4 } from "@/pages/Connect4";
import { Undercover } from "@/pages/Undercover";
import { PetitBac } from "@/pages/PetitBac";
import { GuessWho } from "@/pages/GuessWho";
import { AuthPage } from "@/pages/Auth";
import { ProfilePage } from "@/pages/Profile";
import { LeaderboardPage } from "@/pages/Leaderboard";
import Admin from "@/pages/Admin";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type AppPage = "game" | "auth" | "profile" | "leaderboard" | "admin";

function getUrlRoomCode(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("room");
}

function getUrlGameMode(): GameType | null {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  if (mode === "bmc" || mode === "connect4" || mode === "undercover" || mode === "petitbac" || mode === "guess_who") return mode;
  return null;
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
    <div className="fixed top-0 left-0 right-0 z-[60] text-center text-xs font-bold py-1.5 flex items-center justify-center gap-2"
      style={{ background: "rgba(234,179,8,0.95)", color: "#78350f", backdropFilter: "blur(8px)" }}>
      <span className="animate-spin">⏳</span> Reconnexion au serveur...
    </div>
  );
}

function DestroyedBanner({ reason, onDismiss }: { reason: string; onDismiss: () => void }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] text-white text-center text-sm font-bold py-2 flex items-center justify-center gap-3"
      style={{ background: "rgba(239,68,68,0.95)", backdropFilter: "blur(8px)" }}>
      <span>🚪 {reason}</span>
      <button onClick={onDismiss} className="text-white/70 hover:text-white text-xs underline">
        Fermer
      </button>
    </div>
  );
}

function TopBar({ onNavigate, onHome, showFullNav }: { onNavigate: (page: AppPage) => void; onHome?: () => void; showFullNav: boolean }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="jb-topbar">
      <button
        type="button"
        className="jb-logo group"
        onClick={() => onHome ? onHome() : window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <span className="jb-logo-badge group-hover:rotate-[-6deg] transition-transform">PT</span>
        <span>PlayTime</span>
      </button>

      <div className="flex items-center gap-1.5">
        {showFullNav && (
          <>
            <button className="jb-navlink hidden sm:inline-flex" onClick={() => onNavigate("leaderboard")}>
              🏆 <span>Classement</span>
            </button>
            {user && (
              <button className="jb-navlink hidden sm:inline-flex" onClick={() => onNavigate("profile")}>
                👤 <span>Profil</span>
              </button>
            )}
          </>
        )}

        {!user ? (
          <button onClick={() => onNavigate("auth")} className="btn-jb btn-jb-sm btn-jb-yellow">
            🔑 Connexion
          </button>
        ) : (
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setOpen(o => !o)}
              className="btn-jb btn-jb-sm btn-jb-ghost flex items-center gap-2"
            >
              <span className="text-base leading-none">{user.avatar}</span>
              <span className="max-w-[100px] truncate">{user.username}</span>
              <span className="text-white/40 text-[0.65rem]">{open ? "▲" : "▼"}</span>
            </button>
            {open && (
              <div
                className="absolute right-0 top-full mt-2 rounded-2xl overflow-hidden min-w-[200px] shadow-2xl z-50"
                style={{ background: "rgba(20,8,40,0.97)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(20px)" }}
              >
                <button
                  onClick={() => { setOpen(false); onNavigate("profile"); }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-white/80 hover:text-white hover:bg-white/[0.07] text-left transition-colors"
                >
                  👤 Mon profil
                </button>
                <button
                  onClick={() => { setOpen(false); onNavigate("leaderboard"); }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-white/80 hover:text-white hover:bg-white/[0.07] text-left transition-colors"
                >
                  🏆 Classement
                </button>
                {user.isAdmin && (
                  <>
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />
                    <button
                      onClick={() => { setOpen(false); onNavigate("admin"); }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold hover:bg-white/[0.07] text-left transition-colors"
                      style={{ color: "#a78bfa" }}
                    >
                      ⚙️ Administration
                    </button>
                  </>
                )}
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />
                <button
                  onClick={() => { setOpen(false); logout(); }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold hover:bg-red-500/10 text-left transition-colors"
                  style={{ color: "#fca5a5" }}
                >
                  🚪 Déconnexion
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Game({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  const {
    room, playerId, isSpectating, error, connected, send,
    createRoom, joinRoom, joinAsSpectator, quickMatch, leaveRoom,
    destroyedReason, dismissDestroyed,
    spectateHint, clearSpectateHint,
    setMyPlayerId,
  } = useWebSocket();
  const [initialCode] = useState(getUrlRoomCode);
  const [initialMode, setInitialMode] = useState<GameType | null>(getUrlGameMode);

  useEffect(() => {
    if (!initialCode) return;
    fetch(`${window.location.origin}${BASE}/api/rooms/${initialCode.toUpperCase()}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.gameType) setInitialMode(data.gameType as GameType);
      })
      .catch(() => {});
  }, [initialCode]);

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
    } else if (room.gameType === "petitbac") {
      document.title = "PlayTime - Petit Bac";
    } else if (room.gameType === "guess_who") {
      document.title = "PlayTime - Qui est-ce ?";
    } else {
      document.title = "PlayTime - Blanc Manger Coco";
    }
  }, [room?.gameType]);

  if (!room || !playerId) {
    return (
      <>
        <ConnectionBanner connected={connected} />
        {destroyedReason && <DestroyedBanner reason={destroyedReason} onDismiss={dismissDestroyed} />}
        <TopBar onNavigate={onNavigate} showFullNav={true} />
        <Home
          error={error}
          connected={connected}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onJoinAsSpectator={joinAsSpectator}
          onQuickMatch={quickMatch}
          setMyPlayerId={setMyPlayerId}
          send={send}
          initialCode={initialCode || undefined}
          initialMode={initialMode || undefined}
          onNavigate={onNavigate}
          spectateHint={spectateHint}
          onClearSpectateHint={clearSpectateHint}
        />
      </>
    );
  }

  if (room.gameType === "connect4") {
    return (
      <>
        <ConnectionBanner connected={connected} />
        <Connect4 room={room as C4Room} playerId={playerId} send={send} error={error} onLeave={leaveRoom} isSpectating={isSpectating} />
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

  if (room.gameType === "guess_who") {
    return (
      <>
        <ConnectionBanner connected={connected} />
        <GuessWho room={room as GWRoom} playerId={playerId} send={send} error={error} onLeave={leaveRoom} />
      </>
    );
  }

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
  const [page, setPage] = useState<AppPage>("game");

  if (isAdminPath()) return <Admin />;

  if (page === "auth") {
    return <AuthPage onSuccess={() => setPage("game")} onBack={() => setPage("game")} />;
  }
  if (page === "profile") {
    return <ProfilePage onBack={() => setPage("game")} />;
  }
  if (page === "leaderboard") {
    return <LeaderboardPage onBack={() => setPage("game")} />;
  }
  if (page === "admin") {
    return <Admin onBack={() => setPage("game")} />;
  }
  return <Game onNavigate={setPage} />;
}

export default App;
