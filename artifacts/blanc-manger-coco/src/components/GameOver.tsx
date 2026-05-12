import type { Player } from "../types/game";

interface GameOverProps {
  players: Player[];
  onRestart: () => void;
}

export function GameOver({ players, onRestart }: GameOverProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
         style={{ background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #ff9a9e 100%)" }}>

      {/* Confetti effect via text */}
      <div className="text-center mb-6">
        <div className="text-6xl mb-2 animate-bounce">🎊</div>
        <h1 className="text-4xl font-black mb-1" style={{ fontFamily: "Pacifico, cursive", color: "#c2185b" }}>
          Fin de partie !
        </h1>
        <p className="text-lg font-semibold text-rose-600">
          Bravo à tous les joueurs !
        </p>
      </div>

      {/* Winner */}
      <div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 mb-6 text-center border-4 border-yellow-400"
        data-testid="winner-card"
      >
        <div className="text-5xl mb-2">🏆</div>
        <div className="text-6xl mb-2">{winner.avatar}</div>
        <h2 className="text-2xl font-black text-gray-800 mb-1">{winner.name}</h2>
        <p className="text-gray-500 text-sm mb-3">Grand(e) gagnant(e) !</p>
        <div
          className="text-5xl font-black shimmer-gold bg-clip-text text-transparent"
        >
          {winner.score} pts
        </div>
      </div>

      {/* Rankings */}
      <div className="w-full max-w-sm bg-white/90 backdrop-blur rounded-2xl shadow-lg p-4 mb-6">
        <h3 className="font-black text-gray-700 mb-3 text-center">Classement final</h3>
        <div className="space-y-2">
          {sorted.map((player, rank) => (
            <div
              key={player.id}
              data-testid={`final-rank-${player.id}`}
              className={`flex items-center gap-3 p-3 rounded-xl ${
                rank === 0 ? "bg-yellow-50 border-2 border-yellow-300" : "bg-gray-50"
              }`}
            >
              <span className="text-xl w-8 text-center">
                {rank < 3 ? medals[rank] : `${rank + 1}.`}
              </span>
              <span className="text-2xl">{player.avatar}</span>
              <div className="flex-1">
                <div className="font-bold text-sm text-gray-800">{player.name}</div>
                <div className="text-xs text-gray-500">{player.cardsDone} cartes jouées</div>
              </div>
              <div className="font-black text-lg text-gray-700">{player.score} pts</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="w-full max-w-sm bg-white/80 rounded-2xl p-4 mb-6 text-sm text-center">
        <p className="text-gray-600">
          {players.reduce((sum, p) => sum + p.cardsDone, 0)} cartes jouées au total
        </p>
      </div>

      <button
        data-testid="restart-game"
        onClick={onRestart}
        className="px-10 py-4 rounded-2xl font-black text-xl text-white shadow-xl hover:shadow-2xl active:scale-95 transition-all"
        style={{ background: "linear-gradient(135deg, #e91e63, #c2185b)" }}
      >
        🎲 Nouvelle partie !
      </button>
    </div>
  );
}
