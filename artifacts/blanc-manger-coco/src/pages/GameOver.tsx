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
    <div className="bg-party-warm min-h-screen relative overflow-y-auto">
      <div className="party-cards-layer" />

      <div className="relative z-10 max-w-xl mx-auto px-4 sm:px-6 pt-10 pb-12">
        <div className="text-center mb-8">
          <div className="text-7xl mb-3 animate-bounce" style={{ filter: "drop-shadow(0 10px 30px rgba(255,217,61,0.5))" }}>🏆</div>
          <h1 className="title-display text-white text-[clamp(2.4rem,7vw,4rem)] mb-2" style={{
            background: "linear-gradient(180deg, #fff 0%, #ffd93d 50%, #ff2e7a 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Fin de partie !
          </h1>
          <p className="text-white/65 font-bold">
            {winner?.avatar} <span className="text-white">{winner?.name}</span> remporte la victoire !
          </p>
        </div>

        {/* Winner highlight */}
        <div
          data-testid="winner-card"
          className="mb-6 rounded-[2rem] p-7 text-center overflow-hidden relative"
          style={{
            background: "linear-gradient(135deg, #ffd93d 0%, #ff8a3d 50%, #ff2e7a 100%)",
            boxShadow: "0 20px 60px -12px rgba(255,138,61,0.6), inset 0 1px 0 0 rgba(255,255,255,0.4)",
            border: "2px solid rgba(255,255,255,0.25)",
          }}
        >
          <div className="absolute inset-0 bg-confetti opacity-40 pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-3 text-5xl" style={{ background: "rgba(0,0,0,0.20)", border: "2px solid rgba(255,255,255,0.30)" }}>
              {winner?.avatar || "🏆"}
            </div>
            <h2 className="title-display text-3xl mb-1 break-words" style={{ color: "#1a0533" }}>
              {winner?.name}
            </h2>
            <div className="title-display text-5xl" style={{ color: "#1a0533" }}>
              {winner?.score} <span className="text-2xl opacity-70">pts</span>
            </div>
          </div>
        </div>

        {/* Rankings */}
        <div className="card-jb p-5 mb-6">
          <p className="section-eyebrow mb-3 text-center">Classement final</p>
          <div className="space-y-2">
            {sorted.map((player, rank) => (
              <div
                key={player.id}
                data-testid={`final-rank-${player.id}`}
                className="flex items-center gap-3 py-2.5 px-3 rounded-2xl"
                style={{
                  background: rank === 0 ? "rgba(255,217,61,0.15)" : "rgba(255,255,255,0.04)",
                  border: rank === 0 ? "1px solid rgba(255,217,61,0.40)" : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <span className="text-lg w-7 text-center shrink-0 font-black">
                  {rank < 3 ? medals[rank] : `${rank + 1}.`}
                </span>
                <span className="text-2xl shrink-0">{player.avatar || "🐱"}</span>
                <span className="text-white font-bold flex-1 truncate">{player.name}</span>
                <span className="title-display text-lg shrink-0"
                      style={{ color: rank === 0 ? "#fde047" : "rgba(255,255,255,0.7)" }}>
                  {player.score} pts
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {isHost ? (
            <>
              <button
                data-testid="play-again"
                onClick={() => send({ type: "RESET_TO_LOBBY" })}
                className="btn-jb w-full"
                style={{ fontSize: "1.15rem", padding: "1.1rem 1.6rem" }}
              >
                🎲 Rejouer une partie !
              </button>
              <button onClick={onLeave} className="btn-jb btn-jb-ghost w-full">
                🚪 Quitter
              </button>
            </>
          ) : (
            <>
              <p className="text-center text-sm font-bold text-white/55">
                ⏳ En attente que l'hôte relance...
              </p>
              <button onClick={onLeave} className="btn-jb btn-jb-ghost w-full">
                🚪 Quitter
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
