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
}

function getPlayerColor(i: number) {
  return i === 0
    ? { bg: "#ef4444", border: "#b91c1c", glow: "#ef444488", emoji: "🔴" }
    : { bg: "#eab308", border: "#a16207", glow: "#eab30888", emoji: "🟡" };
}

interface AnimCell {
  row: number;
  col: number;
  id: number;
}

export function Connect4({ room, playerId, send, error, onLeave }: Props) {
  const [copied, setCopied] = useState(false);
  const myIndex = room.players.findIndex((p) => p.id === playerId);
  const isHost = room.hostId === playerId;
  const isMyTurn =
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
  // ── Animation tracking ────────────────────────────────────────────
  const [animCell, setAnimCell] = useState<AnimCell | null>(null);
  const prevBoardRef = useRef<(string | null)[][] | null>(null);
  const animIdRef = useRef(0);

  useEffect(() => {
    const prev = prevBoardRef.current;
    if (prev && room.board) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!prev[r]?.[c] && room.board[r]?.[c]) {
            const id = ++animIdRef.current;
            setAnimCell({ row: r, col: c, id });
            const timer = setTimeout(
              () => setAnimCell((a) => (a?.id === id ? null : a)),
              550,
            );
            prevBoardRef.current = room.board.map((row) => [...row]);
            return () => clearTimeout(timer);
          }
        }
      }
    }
    prevBoardRef.current = room.board
      ? room.board.map((row) => [...row])
      : null;
  }, [room.board]);

  const drop = (col: number) => {
    if (!isMyTurn || room.phase !== "playing") return;
    send({ type: "C4_DROP", col });
  };

  // ── LOBBY ──────────────────────────────────────────────────────────
  if (room.phase === "lobby") {
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${room.code}`;
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4"
        style={{
          background:
            "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)",
        }}
      >
        <div className="text-6xl mb-3">🔴</div>
        <h1 className="text-3xl font-black text-white mb-1">Puissance 4</h1>
        <p className="text-purple-300 text-sm mb-6">
          En attente d'un adversaire…
        </p>
        <div className="bg-white/10 backdrop-blur rounded-2xl p-5 w-full max-w-sm mb-4 text-center border border-white/10">
          <p className="text-xs font-bold text-purple-200 uppercase tracking-widest mb-1">
            Code de la salle
          </p>
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="text-5xl font-black tracking-[0.35em] text-white">
              {room.code}
            </div>
            {room.isPrivate && (
              <span className="text-xs bg-white/20 text-white border border-white/30 rounded-full px-2 py-0.5 font-bold">🔒 Privée</span>
            )}
          </div>
          <button
            onClick={copyLink}
            className="w-full py-2.5 rounded-xl font-bold text-sm bg-purple-500 hover:bg-purple-400 text-white transition-colors"
          >
            {copied ? "✅ Lien copié !" : "🔗 Copier le lien d'invitation"}
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">
            {room.isPrivate ? "Seuls les joueurs avec ce code peuvent rejoindre" : "Partage ce lien pour inviter des amis"}
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur rounded-2xl p-6 max-w-sm w-full text-center">
          <div className="space-y-2 mb-5">
            {[0, 1].map((i) => {
              const p = room.players[i];
              const c = getPlayerColor(i);
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-2.5"
                >
                  <span className="text-xl">{c.emoji}</span>
                  {p ? (
                    <>
                      <span className="text-xl">{p.avatar}</span>
                      <span className="text-white font-bold flex-1 text-left">
                        {p.name}
                      </span>
                      <span className="text-green-400 text-xs font-bold">
                        ✓ Connecté
                      </span>
                    </>
                  ) : (
                    <span className="text-purple-300 text-sm italic flex-1 text-left">
                      En attente…
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <button
          onClick={onLeave}
          className="mt-3 text-sm font-semibold py-2 px-5 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-red-200 transition-colors"
        >
          🚪 Quitter la salle
        </button>
      </div>
    );
  }

  // ── GAME ───────────────────────────────────────────────────────────
  const currentPlayer = room.players[room.currentTurnIndex];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background:
          "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)",
      }}
    >
      {/* Keyframes injected once */}
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

      {/* Header */}
      <div className="px-4 py-3 bg-black/30 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          {room.players.map((p, i) => {
            const c = getPlayerColor(i);
            const isActive =
              room.phase === "playing" && room.currentTurnIndex === i;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition-all shrink-0 ${
                  isActive
                    ? "bg-white/20 ring-2 ring-white scale-105"
                    : "bg-white/5"
                }`}
              >
                <span>{c.emoji}</span>
                <span className="text-sm">{p.avatar}</span>
                <span className="text-white text-xs font-bold">{p.name}</span>
              </div>
            );
          })}
        </div>
        <button
          onClick={onLeave}
          className="shrink-0 text-xs font-semibold py-1.5 px-3 rounded-xl bg-white/10 text-white/70 hover:bg-red-500/20 hover:text-red-200 transition-colors"
        >
          🚪 Quitter
        </button>
      </div>

      {/* Status */}
      <div className="px-4 py-2.5 text-center min-h-[2.5rem] flex items-center justify-center">
        {room.phase === "game-over" ? (
          room.isDraw ? (
            <span className="text-yellow-300 font-black text-lg">
              🤝 Égalité !
            </span>
          ) : (
            <span className="font-black text-lg text-white">
              {winner?.avatar} {winner?.name} a gagné !{" "}
              {
                getPlayerColor(
                  room.players.findIndex((p) => p.id === room.winnerId),
                ).emoji
              }
            </span>
          )
        ) : isMyTurn ? (
          <span className="text-green-300 font-black text-base animate-pulse">
            {getPlayerColor(myIndex).emoji} C'est ton tour !
          </span>
        ) : (
          <span className="text-purple-300 text-sm">
            {currentPlayer?.avatar} {currentPlayer?.name} réfléchit…
          </span>
        )}
      </div>

      {error && (
        <div className="mx-4 mb-1 bg-red-900/50 text-red-300 rounded-xl px-4 py-2 text-sm font-semibold text-center">
          ⚠️ {error}
        </div>
      )}

      {/* Board area */}
      <div className="flex-1 flex items-center justify-center px-3 pb-4">
        <div className="w-full max-w-sm">
          {/* Arrow row */}
          <div
            className="grid mb-1"
            style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: "6px" }}
          >
            {Array.from({ length: COLS }, (_, col) => {
              const isHov =
                hoveredCol === col && isMyTurn && room.phase === "playing";
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
                    background: isHov ? "rgba(255,255,255,0.2)" : "transparent",
                    border: "none",
                    cursor:
                      isMyTurn && room.phase === "playing"
                        ? "pointer"
                        : "default",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.1rem",
                    transition: "background 0.15s",
                    color:
                      isMyTurn && room.phase === "playing"
                        ? "#e2e8f0"
                        : "transparent",
                  }}
                  className={isHov ? "col-arrow-hover" : ""}
                >
                  ▼
                </button>
              );
            })}
          </div>

          {/* Grid */}
          <div
            className="rounded-2xl p-2.5 shadow-2xl overflow-hidden"
            style={{
              background: "linear-gradient(180deg, #1e40af 0%, #1e3a8a 100%)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
            }}
          >
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                gap: "6px",
              }}
            >
              {Array.from({ length: ROWS }, (_, r) =>
                Array.from({ length: COLS }, (_, c) => {
                  const cellValue = room.board[r]?.[c] ?? null;
                  const pIdx = cellValue
                    ? room.players.findIndex((p) => p.id === cellValue)
                    : -1;
                  const color = pIdx >= 0 ? getPlayerColor(pIdx) : null;
                  const isAnim = animCell?.row === r && animCell?.col === c;
                  const isColHovered =
                    hoveredCol === c &&
                    isMyTurn &&
                    room.phase === "playing" &&
                    !cellValue;

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
                            ? "rgba(255,255,255,0.18)"
                            : "rgba(15,23,42,0.55)",
                        border: color
                          ? `2px solid ${color.border}`
                          : `2px solid rgba(255,255,255,0.06)`,
                        cursor:
                          isMyTurn && room.phase === "playing"
                            ? "pointer"
                            : "default",
                        boxShadow: color
                          ? `0 2px 10px ${color.glow}, inset 0 -2px 4px rgba(0,0,0,0.2)`
                          : "inset 0 3px 6px rgba(0,0,0,0.4)",
                        transition: "background 0.12s, box-shadow 0.12s",
                      }}
                    />
                  );
                }),
              )}
            </div>
          </div>

          {/* Replay */}
          {room.phase === "game-over" && (
            <div className="mt-5 space-y-2">
              {isHost ? (
                <button
                  onClick={() => send({ type: "C4_RESET" })}
                  className="w-full py-3.5 rounded-2xl font-black text-white text-base shadow-lg active:scale-95 transition-all"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                  }}
                >
                  🔄 Rejouer
                </button>
              ) : (
                <p className="text-center text-purple-300 text-sm">
                  En attente que l'hôte relance la partie…
                </p>
              )}
              <button
                onClick={onLeave}
                className="w-full py-2.5 rounded-2xl font-semibold text-sm text-white/70 hover:text-red-200 bg-white/10 hover:bg-white/20 transition-colors"
              >
                🚪 Quitter la partie
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
