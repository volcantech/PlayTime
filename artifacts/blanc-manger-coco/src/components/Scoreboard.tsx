import type { Player } from "../types/game";

interface ScoreboardProps {
  players: Player[];
  currentPlayerIndex: number;
  compact?: boolean;
}

export function Scoreboard({ players, currentPlayerIndex, compact = false }: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  if (compact) {
    return (
      <div className="flex gap-2 flex-wrap justify-center" data-testid="scoreboard-compact">
        {players.map((player, idx) => (
          <div
            key={player.id}
            data-testid={`player-score-${player.id}`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border-2 transition-all ${
              idx === currentPlayerIndex
                ? "bg-rose-500 border-rose-600 text-white scale-105 active-player-ring shadow-md"
                : "bg-white border-gray-200 text-gray-700"
            }`}
          >
            <span>{player.avatar}</span>
            <span>{player.name}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-xs font-black ${
                idx === currentPlayerIndex ? "bg-white/20" : "bg-gray-100"
              }`}
            >
              {player.score}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="scoreboard">
      {sorted.map((player, rank) => {
        const originalIdx = players.findIndex(p => p.id === player.id);
        const isActive = originalIdx === currentPlayerIndex;
        const medals = ["🥇", "🥈", "🥉"];
        return (
          <div
            key={player.id}
            data-testid={`scoreboard-row-${player.id}`}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
              isActive
                ? "bg-rose-50 border-rose-300 shadow-md"
                : "bg-white border-gray-100"
            }`}
          >
            <span className="text-xl w-8 text-center">
              {rank < 3 ? medals[rank] : `${rank + 1}.`}
            </span>
            <span className="text-2xl">{player.avatar}</span>
            <div className="flex-1">
              <div className={`font-bold text-sm ${isActive ? "text-rose-700" : "text-gray-800"}`}>
                {player.name}
                {isActive && <span className="ml-2 text-xs bg-rose-500 text-white px-2 py-0.5 rounded-full">En jeu</span>}
              </div>
              <div className="text-xs text-gray-500">{player.cardsDone} carte{player.cardsDone !== 1 ? "s" : ""} jouée{player.cardsDone !== 1 ? "s" : ""}</div>
            </div>
            <div className={`text-2xl font-black ${isActive ? "text-rose-600" : "text-gray-700"}`}>
              {player.score}
            </div>
          </div>
        );
      })}
    </div>
  );
}
