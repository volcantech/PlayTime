import { useState, useEffect, useRef } from "react";
import type { C4Room, SendMessage } from "../hooks/useWebSocket";

const ROWS = 6;
const COLS = 7;

interface Props {
  room: C4Room;
  playerId: string;
  send: SendMessage;
  error: string | null;
  onLeave: () => void;
  isSpectating?: boolean;
}

function getPlayerColor(i: number) {
  return i === 0
    ? { bg: "#ef4444", border: "#b91c1c", glow: "#ef444488", emoji: "🔴", name: "Rouge" }
    : { bg: "#eab308", border: "#a16207", glow: "#eab30888", emoji: "🟡", name: "Jaune" };
}

interface AnimCell {
  row: number;
  col: number;
  id: number;
}

export function Connect4({ room, playerId, send, error, onLeave, isSpectating = false }: Props) {
  const [copied, setCopied] = useState(false);
  const myIndex = room.players.findIndex((p) => p.id === playerId);
  const isHost = room.hostId === playerId;
  const isMyTurn =
    !isSpectating &&
    room.phase === "playing" &&
    room.players[room.currentTurnIndex]?.id === playerId;
  const winner = room.players.find((p) => p.id === room.winnerId);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${room.code}`;
  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  const [animCell, setAnimCell] = useState<AnimCell | null>(null);
  const prevBoardRef = useRef<(string | null)[][] | null>(null);
  const animIdRef = useRef(0);

  useEffect(() => {
    const prev = prevBoardRef.current;
    let cleanup: (() => void) | undefined;
    if (prev && room.board) {
      outer: for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!prev[r]?.[c] && room.board[r]?.[c]) {
            const id = ++animIdRef.current;
            setAnimCell({ row: r, col: c, id });
            const timer = setTimeout(
              () => setAnimCell((a) => (a?.id === id ? null : a)),
              550,
            );
            cleanup = () => clearTimeout(timer);
            break outer;
          }
        }
      }
    }
    prevBoardRef.current = room.board ? room.board.map((row) => [...row]) : null;
    return cleanup;
  }, [room.board]);

  const drop = (col: number) => {
    if (!isMyTurn || room.phase !== "playing") return;
    send({ type: "C4_DROP", col });
  };

  // LOBBY
  if (room.phase === "lobby") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #07071a 0%, #0d1a3a 50%, #07071a 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% 10%, rgba(59,130,246,0.25), transparent 70%)" }} />

        <div className="relative z-10 w-full max-w-sm">
          <div className="text-center mb-7">
            <div className="text-5xl mb-3">🔴</div>
            <h1
              className="text-4xl font-black tracking-tight mb-1 text-gradient"
              style={{ backgroundImage: "linear-gradient(135deg, #fff 30%, #3b82f6)" }}
            >
              Puissance 4
            </h1>
            <p className="text-sm text-white/40">En attente d'un adversaire…</p>
          </div>

          {/* Room code */}
          <div
            className="rounded-2xl p-5 mb-4 text-center"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}
          >
            <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-2">Code de la salle</p>
            <div className="flex items-center justify-center gap-2 mb-3">
              <div
                className="text-5xl font-black tracking-[0.35em]"
                style={{ color: "#3b82f6", textShadow: "0 0 20px rgba(59,130,246,0.5)" }}
              >
                {room.code}
              </div>
              {room.isPrivate && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)" }}>
                  🔒 Privée
                </span>
              )}
            </div>
            <button
              onClick={copyLink}
              className="w-full py-2.5 rounded-xl font-bold text-sm transition-all"
              style={copied ? {
                background: "rgba(34,197,94,0.2)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)",
              } : {
                background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)",
              }}
            >
              {copied ? "✅ Lien copié !" : "🔗 Copier le lien d'invitation"}
            </button>
            <p className="text-xs text-white/25 mt-2">
              {room.isPrivate ? "Seuls les joueurs avec ce code peuvent rejoindre" : "Partage ce lien pour inviter des amis"}
            </p>
          </div>

          {/* Players */}
          <div
            className="rounded-2xl p-5 mb-4"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}
          >
            <div className="space-y-2">
              {[0, 1].map((i) => {
                const p = room.players[i];
                const c = getPlayerColor(i);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{ background: p ? `${c.bg}15` : "rgba(255,255,255,0.04)", border: `1px solid ${p ? c.bg + "30" : "rgba(255,255,255,0.06)"}` }}
                  >
                    <span className="text-xl">{c.emoji}</span>
                    {p ? (
                      <>
                        <span className="text-xl">{p.avatar}</span>
                        <span className="text-white font-bold flex-1 text-left">{p.name}</span>
                        {isHost && p.id !== playerId && (
                          <button
                            onClick={() => send({ type: "KICK_PLAYER", targetPlayerId: p.id })}
                            className="text-xs text-white/25 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"
                            title={`Exclure ${p.name}`}
                          >✕</button>
                        )}
                        <span className="text-xs font-bold" style={{ color: "#4ade80" }}>✓</span>
                      </>
                    ) : (
                      <span className="text-white/30 text-sm italic flex-1 text-left">En attente…</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={onLeave}
            className="w-full text-sm font-semibold py-2.5 px-5 rounded-xl text-white/30 hover:text-red-400 transition-colors hover:bg-red-500/10"
          >
            🚪 Quitter la salle
          </button>
        </div>
      </div>
    );
  }

  // GAME
  const currentPlayer = room.players[room.currentTurnIndex];

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #07071a 0%, #0d1a3a 50%, #07071a 100%)" }}
    >
      <style>{`
        @keyframes dropFall {
          0%   { transform: translateY(-320px); opacity: 0.6; }
          65%  { transform: translateY(6px);    opacity: 1;   }
          80%  { transform: translateY(-3px);                 }
          90%  { transform: translateY(2px);                  }
          100% { transform: translateY(0);                    }
        }
        .cell-drop { animation: dropFall 0.48s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
        @keyframes colHover {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(3px); }
        }
        .col-arrow-hover { animation: colHover 0.6s ease-in-out infinite; }
      `}</style>

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(59,130,246,0.15), transparent 60%)" }} />

      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between gap-2 relative z-10"
        style={{ background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          {/* Spectator badge */}
          {isSpectating && (
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 shrink-0"
              style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)", color: "#818cf8" }}
            >
              <span className="text-sm">👁️</span>
              <span className="text-xs font-bold">Spectateur</span>
            </div>
          )}
          {room.players.map((p, i) => {
            const c = getPlayerColor(i);
            const isActive = room.phase === "playing" && room.currentTurnIndex === i;
            return (
              <div
                key={p.id}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all shrink-0"
                style={isActive ? {
                  background: `${c.bg}25`,
                  border: `1.5px solid ${c.bg}80`,
                  boxShadow: `0 0 12px ${c.glow}`,
                } : {
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <span>{c.emoji}</span>
                <span className="text-sm">{p.avatar}</span>
                <span className="text-white text-xs font-bold">{p.name}</span>
              </div>
            );
          })}
          {/* Spectators count */}
          {room.spectators && room.spectators.length > 0 && (
            <div className="flex items-center gap-1 rounded-full px-2 py-1 shrink-0"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="text-xs text-white/30">👁️ {room.spectators.length}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Players dropdown with kick (host only, not spectating) */}
          {isHost && !isSpectating && (
            <PlayersDropdown room={room} playerId={playerId} send={send} />
          )}
          <button
            onClick={onLeave}
            className="text-xs font-semibold py-1.5 px-3 rounded-xl text-white/40 hover:bg-red-500/15 hover:text-red-300 transition-colors"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {isSpectating ? "👁️ Quitter" : "🚪"}
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="px-4 py-3 text-center min-h-[3rem] flex items-center justify-center relative z-10">
        {room.phase === "game-over" ? (
          room.isDraw ? (
            <span className="font-black text-xl text-yellow-300">🤝 Égalité !</span>
          ) : (
            <span className="font-black text-xl text-white">
              {winner?.avatar} <span style={{ color: getPlayerColor(room.players.findIndex(p => p.id === room.winnerId)).bg }}>{winner?.name}</span> a gagné !
            </span>
          )
        ) : isSpectating ? (
          <span className="text-white/40 text-sm">
            👁️ Mode spectateur — {currentPlayer?.name} joue…
          </span>
        ) : isMyTurn ? (
          <span className="font-black text-base animate-pulse" style={{ color: getPlayerColor(myIndex).bg }}>
            {getPlayerColor(myIndex).emoji} C'est ton tour !
          </span>
        ) : (
          <span className="text-white/40 text-sm">
            {currentPlayer?.avatar} {currentPlayer?.name} réfléchit…
          </span>
        )}
      </div>

      {error && !isSpectating && (
        <div className="mx-4 mb-1 rounded-xl px-4 py-2 text-sm font-semibold text-center relative z-10"
          style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Board area */}
      <div className="flex-1 flex items-center justify-center px-3 pb-4 relative z-10">
        <div className="w-full max-w-sm">
          {/* Arrow row */}
          <div className="grid mb-1" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: "6px" }}>
            {Array.from({ length: COLS }, (_, col) => {
              const isHov = hoveredCol === col && isMyTurn && room.phase === "playing";
              const myColor = getPlayerColor(myIndex);
              return (
                <button
                  key={col}
                  onClick={() => drop(col)}
                  onMouseEnter={() => isMyTurn && setHoveredCol(col)}
                  onMouseLeave={() => setHoveredCol(null)}
                  disabled={!isMyTurn || room.phase !== "playing"}
                  style={{
                    height: "2rem",
                    borderRadius: "0.5rem",
                    background: isHov ? `${myColor.bg}30` : "transparent",
                    border: "none",
                    cursor: isMyTurn && room.phase === "playing" ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.1rem", transition: "background 0.15s",
                    color: isMyTurn && room.phase === "playing" ? myColor.bg : "transparent",
                  }}
                  className={isHov ? "col-arrow-hover" : ""}
                >▼</button>
              );
            })}
          </div>

          {/* Grid */}
          <div
            className="rounded-2xl p-2.5 shadow-2xl overflow-hidden"
            style={{
              background: "linear-gradient(180deg, #1e3a8a 0%, #1e40af 100%)",
              boxShadow: "0 8px 40px rgba(30,58,138,0.6), inset 0 1px 0 rgba(255,255,255,0.1)",
            }}
          >
            <div className="grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: "6px" }}>
              {Array.from({ length: ROWS }, (_, r) =>
                Array.from({ length: COLS }, (_, c) => {
                  const cellValue = room.board[r]?.[c] ?? null;
                  const pIdx = cellValue ? room.players.findIndex(p => p.id === cellValue) : -1;
                  const color = pIdx >= 0 ? getPlayerColor(pIdx) : null;
                  const isAnim = animCell?.row === r && animCell?.col === c;
                  const isColHovered = hoveredCol === c && isMyTurn && room.phase === "playing" && !cellValue;

                  return (
                    <div
                      key={`${r}-${c}`}
                      onClick={() => drop(c)}
                      className={isAnim ? "cell-drop" : ""}
                      style={{
                        aspectRatio: "1",
                        borderRadius: "50%",
                        background: color
                          ? color.bg
                          : isColHovered
                            ? "rgba(255,255,255,0.15)"
                            : "rgba(7,7,26,0.7)",
                        border: color
                          ? `2px solid ${color.border}`
                          : "2px solid rgba(255,255,255,0.05)",
                        cursor: isMyTurn && room.phase === "playing" ? "pointer" : "default",
                        boxShadow: color
                          ? `0 2px 10px ${color.glow}, inset 0 -2px 4px rgba(0,0,0,0.3)`
                          : "inset 0 3px 6px rgba(0,0,0,0.5)",
                        transition: "background 0.12s, box-shadow 0.12s",
                      }}
                    />
                  );
                }),
              )}
            </div>
          </div>

          {/* Spectator label on board */}
          {isSpectating && room.phase === "playing" && (
            <div className="mt-3 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl"
                style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8" }}>
                <span>👁️</span>
                <span className="text-xs font-bold">Tu regardes la partie en spectateur</span>
              </div>
            </div>
          )}

          {/* Game over actions */}
          {room.phase === "game-over" && (
            <div className="mt-5 space-y-2">
              {isHost && !isSpectating ? (
                <button
                  onClick={() => send({ type: "C4_RESET" })}
                  className="w-full py-3.5 rounded-2xl font-black text-white text-base transition-all active:scale-95"
                  style={{
                    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                    boxShadow: "0 8px 25px rgba(37,99,235,0.4)",
                  }}
                >
                  🔄 Rejouer
                </button>
              ) : !isSpectating ? (
                <p className="text-center text-white/35 text-sm">En attente que l'hôte relance…</p>
              ) : null}
              <button
                onClick={onLeave}
                className="w-full py-2.5 rounded-2xl font-semibold text-sm text-white/30 hover:text-red-400 transition-colors hover:bg-red-500/10"
              >
                {isSpectating ? "👁️ Quitter la partie" : "🚪 Quitter"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayersDropdown({ room, playerId, send }: { room: C4Room; playerId: string; send: SendMessage }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs font-bold py-1.5 px-3 rounded-xl transition-all"
        style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}
      >
        <span>👥</span>
        <span>{room.players.length}</span>
        <span className="text-white/25">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 rounded-2xl overflow-hidden min-w-[180px] z-50 shadow-2xl"
          style={{ background: "rgba(10,10,30,0.97)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)" }}
        >
          <div className="px-4 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <span className="text-xs font-bold text-white/30 uppercase tracking-widest">Joueurs</span>
          </div>
          {room.players.map((p, i) => {
            const c = getPlayerColor(i);
            return (
              <div key={p.id} className="flex items-center gap-2 px-4 py-2.5">
                <span className="text-base">{p.avatar}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-white truncate block">{p.name}</span>
                  <span className="text-xs font-bold" style={{ color: c.bg }}>{c.emoji} {c.name}</span>
                </div>
                {p.id !== playerId && room.hostId === playerId && (
                  <button
                    onClick={() => { send({ type: "KICK_PLAYER", targetPlayerId: p.id }); setOpen(false); }}
                    className="text-xs px-2 py-1 rounded-lg font-bold transition-colors"
                    style={{ color: "#f87171", background: "rgba(239,68,68,0.1)" }}
                    title={`Exclure ${p.name}`}
                  >
                    Exclure
                  </button>
                )}
              </div>
            );
          })}
          {room.spectators && room.spectators.length > 0 && (
            <>
              <div className="px-4 py-1.5 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <span className="text-xs font-bold text-white/20 uppercase tracking-widest">Spectateurs</span>
              </div>
              {room.spectators.map(s => (
                <div key={s.id} className="flex items-center gap-2 px-4 py-2">
                  <span className="text-base">{s.avatar}</span>
                  <span className="text-sm font-semibold text-white/40 flex-1">{s.name}</span>
                  <span className="text-xs text-indigo-400/70">👁️</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
