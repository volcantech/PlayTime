import type { GameRoom, SendMessage } from "../hooks/useWebSocket";

interface GameOverProps {
  room: GameRoom;
  playerId: string;
  send: SendMessage;
  onLeave: () => void;
}

export function GameOver({ room, playerId, send, onLeave }: GameOverProps) {
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const isHost = room.hostId === playerId;
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="min-h-screen flex flex-col items-center overflow-y-auto px-4 py-10"
         style={{ background: "linear-gradient(180deg, #0f0c29 0%, #1a1a2e 40%, #16213e 100%)" }}>

      <div className="text-center mb-6 shrink-0">
        <div className="text-5xl mb-2 animate-bounce">🏆</div>
        <h1 className="text-3xl font-black text-white mb-1" style={{ fontFamily: "Pacifico, cursive" }}>
          Fin de partie !
        </h1>
        <p className="text-purple-300 text-sm font-semibold">
          {winner?.avatar} <span className="text-white font-bold">{winner?.name}</span> remporte la victoire !
        </p>
      </div>

      {/* Winner highlight */}
      <div
        data-testid="winner-card"
        className="w-full max-w-sm mb-5 rounded-3xl p-5 text-center shadow-2xl overflow-hidden shrink-0"
        style={{
          background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
          boxShadow: "0 8px 32px rgba(245, 158, 11, 0.4)",
        }}
      >
        <div className="text-5xl mb-2 leading-none">{winner?.avatar || "🏆"}</div>
        <h2 className="text-2xl font-black mb-1 break-words" style={{ color: "#1a0a00" }}>
          {winner?.name}
        </h2>
        <div className="text-3xl font-black" style={{ color: "#1a0a00" }}>
          {winner?.score} <span className="text-xl font-bold opacity-70">points</span>
        </div>
      </div>

      {/* Rankings */}
      <div className="rounded-2xl p-4 w-full max-w-sm mb-6 shrink-0"
           style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}>
        <h3 className="text-white font-bold text-xs mb-3 text-center uppercase tracking-widest opacity-70">
          Classement final
        </h3>
        {sorted.map((player, rank) => (
          <div
            key={player.id}
            data-testid={`final-rank-${player.id}`}
            className="flex items-center gap-3 py-2.5 px-3 rounded-xl mb-1"
            style={{
              background: rank === 0
                ? "rgba(251, 191, 36, 0.15)"
                : "rgba(255,255,255,0.04)",
              border: rank === 0 ? "1px solid rgba(251, 191, 36, 0.35)" : "1px solid transparent",
            }}
          >
            <span className="text-base w-6 text-center shrink-0">
              {rank < 3 ? medals[rank] : `${rank + 1}.`}
            </span>
            <span className="text-xl shrink-0">{player.avatar || "🐱"}</span>
            <span className="text-white font-bold flex-1 truncate">{player.name}</span>
            <span className="font-black text-base shrink-0"
                  style={{ color: rank === 0 ? "#fbbf24" : "#9ca3af" }}>
              {player.score} pts
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="w-full max-w-sm space-y-3 shrink-0 pb-4">
        {isHost ? (
          <>
            <button
              data-testid="play-again"
              onClick={() => send({ type: "RESET_TO_LOBBY" })}
              className="w-full py-4 rounded-2xl font-black text-xl text-white shadow-xl active:scale-95 transition-all"
              style={{ background: "linear-gradient(135deg, #e91e63, #c2185b)" }}
            >
              🎲 Rejouer !
            </button>
            <button
              onClick={onLeave}
              className="w-full py-3 rounded-2xl font-bold text-sm transition-colors"
              style={{ background: "rgba(255,255,255,0.08)", color: "#9ca3af" }}
            >
              🚪 Quitter la partie
            </button>
          </>
        ) : (
          <>
            <p className="text-center text-sm font-semibold" style={{ color: "#9ca3af" }}>
              ⏳ En attente que l'hôte relance...
            </p>
            <button
              onClick={onLeave}
              className="w-full py-3 rounded-2xl font-bold text-sm transition-colors"
              style={{ background: "rgba(255,255,255,0.08)", color: "#9ca3af" }}
            >
              🚪 Quitter la partie
            </button>
          </>
        )}
      </div>
    </div>
  );
}
