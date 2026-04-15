import { useState } from "react";
import type { GameRoom, SendMessage } from "../hooks/useWebSocket";

interface LobbyProps {
  room: GameRoom;
  playerId: string;
  send: SendMessage;
  error: string | null;
  onLeave: () => void;
}

export function Lobby({ room, playerId, send, error, onLeave }: LobbyProps) {
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === playerId;
  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${room.code}`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleStart = () => send({ type: "START_GAME" });
  const handleTargetScore = (score: number) => send({ type: "SET_TARGET_SCORE", score });

  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-4 py-8"
         style={{ background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #ff9a9e 100%)" }}>

      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-4xl mb-1">🥥</div>
        <h1 className="text-3xl font-black" style={{ fontFamily: "Pacifico, cursive", color: "#c2185b" }}>
          Salle d'attente
        </h1>
      </div>

      {/* Room code */}
      <div className="bg-white rounded-2xl shadow-lg p-5 w-full max-w-sm mb-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 text-center">Code de la salle</p>
        <div className="text-5xl font-black tracking-[0.4em] text-rose-600 text-center mb-3" data-testid="room-code">
          {room.code}
        </div>
        <button
          data-testid="copy-link"
          onClick={copyLink}
          className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
            copied
              ? "bg-green-100 text-green-700 border-2 border-green-300"
              : "bg-rose-50 text-rose-700 border-2 border-rose-200 hover:bg-rose-100"
          }`}
        >
          {copied ? "✅ Lien copié !" : "🔗 Copier le lien d'invitation"}
        </button>
        <p className="text-xs text-gray-400 text-center mt-2">
          Partage ce lien pour inviter des amis
        </p>
      </div>

      {/* Players */}
      <div className="bg-white rounded-2xl shadow-lg p-5 w-full max-w-sm mb-4">
        <h2 className="font-black text-gray-700 mb-3 text-sm uppercase tracking-wide">
          Joueurs ({room.players.length}/10)
        </h2>
        <div className="space-y-2">
          {room.players.map((player) => (
            <div
              key={player.id}
              data-testid={`player-${player.id}`}
              className={`flex items-center gap-3 p-2.5 rounded-xl ${
                player.id === playerId ? "bg-rose-50 border-2 border-rose-200" : "bg-gray-50"
              }`}
            >
              <span className="text-2xl">{player.avatar || "🐱"}</span>
              <span className="flex-1 font-bold text-sm text-gray-800">{player.name}</span>
              {!player.isConnected && <span className="text-xs text-gray-400">⚪ hors ligne</span>}
              {player.id === room.hostId && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">Hôte</span>
              )}
              {player.id === playerId && (
                <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">Toi</span>
              )}
            </div>
          ))}
        </div>
        {room.players.length < 3 && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-3 text-center font-semibold">
            ⚠️ Il faut au moins 3 joueurs pour commencer
          </p>
        )}
      </div>

      {/* Settings (host only) */}
      {isHost && (
        <div className="bg-white rounded-2xl shadow-lg p-5 w-full max-w-sm mb-4">
          <h2 className="font-black text-gray-700 mb-3 text-sm uppercase tracking-wide">Score de victoire</h2>
          <div className="flex gap-2">
            {[5, 10, 15].map(score => (
              <button
                key={score}
                data-testid={`target-score-${score}`}
                onClick={() => handleTargetScore(score)}
                className={`flex-1 py-2 rounded-xl font-black text-sm border-2 transition-all ${
                  room.targetScore === score
                    ? "bg-rose-500 border-rose-600 text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:border-rose-300"
                }`}
              >
                {score} pts
              </button>
            ))}
          </div>
        </div>
      )}

      {!isHost && (
        <div className="bg-white/70 rounded-xl px-4 py-3 w-full max-w-sm mb-4 text-center">
          <p className="text-sm text-gray-600 font-semibold">
            ⏳ En attente que l'hôte démarre la partie...
          </p>
          <p className="text-xs text-gray-400 mt-1">Score de victoire : {room.targetScore} points</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 w-full max-w-sm mb-4 text-sm font-semibold" data-testid="error-message">
          ⚠️ {error}
        </div>
      )}

      {isHost && (
        <button
          data-testid="start-game"
          onClick={handleStart}
          disabled={room.players.length < 3}
          className="w-full max-w-sm py-4 rounded-2xl font-black text-xl text-white shadow-xl hover:shadow-2xl active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "linear-gradient(135deg, #e91e63, #c2185b)" }}
        >
          🎲 Démarrer la partie !
        </button>
      )}

      <button
        onClick={onLeave}
        className="mt-3 text-sm text-gray-500 hover:text-red-500 font-semibold py-2 px-5 rounded-xl bg-white/60 hover:bg-white/80 transition-colors"
      >
        🚪 Quitter la salle
      </button>
    </div>
  );
}
