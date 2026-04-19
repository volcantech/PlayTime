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
  const handleCardMode = (mode: "normal" | "adult" | "mixed") => send({ type: "SET_HARD_MODE", cardMode: mode });

  const { cardMode, isPrivate } = room;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start px-4 py-8 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #07071a 0%, #1a0828 50%, #070f1a 100%)" }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(233,30,99,0.25), transparent 70%)" }}
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Header */}
        <div className="text-center mb-7">
          <div className="text-5xl mb-3">🃏</div>
          <h1
            className="text-4xl font-black tracking-tight text-gradient"
            style={{ backgroundImage: "linear-gradient(135deg, #fff 30%, #e91e63)" }}
          >
            Salle d'attente
          </h1>
          <p className="text-sm text-white/40 mt-1">Blanc Manger Coco</p>
        </div>

        {/* Room code */}
        <div
          className="rounded-2xl p-5 mb-4"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <p className="text-xs font-bold text-white/30 uppercase tracking-widest text-center">Code de la salle</p>
            {isPrivate && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)" }}>
                🔒 Privée
              </span>
            )}
          </div>
          <div
            className="text-5xl font-black tracking-[0.4em] text-center mb-4"
            data-testid="room-code"
            style={{ color: "#e91e63", textShadow: "0 0 20px rgba(233,30,99,0.5)" }}
          >
            {room.code}
          </div>
          <button
            data-testid="copy-link"
            onClick={copyLink}
            className="w-full py-2.5 rounded-xl font-bold text-sm transition-all"
            style={copied ? {
              background: "rgba(34,197,94,0.2)",
              color: "#4ade80",
              border: "1px solid rgba(34,197,94,0.3)",
            } : {
              background: "rgba(233,30,99,0.15)",
              color: "#f06292",
              border: "1px solid rgba(233,30,99,0.3)",
            }}
          >
            {copied ? "✅ Lien copié !" : "🔗 Copier le lien d'invitation"}
          </button>
          <p className="text-xs text-white/25 text-center mt-2">
            {isPrivate ? "Seuls les joueurs avec ce lien peuvent rejoindre" : "Partage ce lien pour inviter des amis"}
          </p>
        </div>

        {/* Players */}
        <div
          className="rounded-2xl p-5 mb-4"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}
        >
          <h2 className="font-black text-white/50 mb-3 text-xs uppercase tracking-widest">
            Joueurs ({room.players.length}/10)
          </h2>
          <div className="space-y-2">
            {room.players.map((player) => (
              <div
                key={player.id}
                data-testid={`player-${player.id}`}
                className="flex items-center gap-3 p-2.5 rounded-xl transition-all"
                style={player.id === playerId ? {
                  background: "rgba(233,30,99,0.12)",
                  border: "1px solid rgba(233,30,99,0.25)",
                } : {
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span className="text-2xl">{player.avatar || "🐱"}</span>
                <span className="flex-1 font-bold text-sm text-white">{player.name}</span>
                {!player.isConnected && <span className="text-xs text-white/25">⚪ hors ligne</span>}
                {player.id === room.hostId && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>
                    Hôte
                  </span>
                )}
                {player.id === playerId && player.id !== room.hostId && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ background: "rgba(233,30,99,0.15)", color: "#f06292", border: "1px solid rgba(233,30,99,0.3)" }}>
                    Toi
                  </span>
                )}
                {isHost && player.id !== playerId && (
                  <button
                    onClick={() => send({ type: "KICK_PLAYER", targetPlayerId: player.id })}
                    className="text-xs text-white/25 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"
                    title="Exclure ce joueur"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {room.players.length < 3 && (
            <div className="mt-3 px-3 py-2.5 rounded-xl text-center text-xs font-semibold"
              style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}>
              ⚠️ Il faut au moins 3 joueurs pour commencer
            </div>
          )}
        </div>

        {/* Settings (host only) */}
        {isHost && (
          <div
            className="rounded-2xl p-5 mb-4 space-y-4"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}
          >
            <div>
              <h2 className="font-black text-white/50 mb-3 text-xs uppercase tracking-widest">Score de victoire</h2>
              <div className="flex gap-2">
                {[5, 10, 15].map(score => (
                  <button
                    key={score}
                    data-testid={`target-score-${score}`}
                    onClick={() => handleTargetScore(score)}
                    className="flex-1 py-2.5 rounded-xl font-black text-sm transition-all"
                    style={room.targetScore === score ? {
                      background: "#e91e63",
                      color: "#fff",
                      boxShadow: "0 4px 15px rgba(233,30,99,0.4)",
                    } : {
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.4)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    {score} pts
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="font-black text-white/50 mb-3 text-xs uppercase tracking-widest">Mode de cartes</h2>
              <div className="space-y-2">
                {([
                  { mode: "normal", icon: "🃏", label: "Normal", desc: "Cartes sans contenu adulte", accent: "#3b82f6" },
                  { mode: "adult", icon: "🔞", label: "Trash (+18)", desc: "Uniquement les cartes trash", accent: "#ef4444" },
                  { mode: "mixed", icon: "🎭", label: "Mixte", desc: "Cartes normales + trash mélangées", accent: "#a855f7" },
                ] as const).map(({ mode, icon, label, desc, accent }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleCardMode(mode)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all"
                    style={cardMode === mode ? {
                      background: `${accent}18`,
                      border: `1px solid ${accent}40`,
                      color: accent,
                    } : {
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    <span className="text-lg">{icon}</span>
                    <div className="flex-1 text-left">
                      <div className="font-bold leading-tight">{label}</div>
                      <div className="text-xs opacity-70">{desc}</div>
                    </div>
                    {cardMode === mode && <span className="font-black text-sm">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {!isHost && (
          <div
            className="rounded-xl px-4 py-3 mb-4 text-center"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="text-sm text-white/50 font-semibold">⏳ En attente que l'hôte démarre...</p>
            <p className="text-xs text-white/25 mt-1">Score de victoire : {room.targetScore} points</p>
            {cardMode === "adult" && <p className="text-xs font-bold mt-1" style={{ color: "#f87171" }}>🔞 Mode adulte activé</p>}
            {cardMode === "mixed" && <p className="text-xs font-bold mt-1" style={{ color: "#c084fc" }}>🎭 Mode mixte activé</p>}
          </div>
        )}

        {error && (
          <div className="rounded-xl px-4 py-2.5 mb-4 text-sm font-semibold"
            style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
            data-testid="error-message">
            ⚠️ {error}
          </div>
        )}

        {isHost && (
          <button
            data-testid="start-game"
            onClick={handleStart}
            disabled={room.players.length < 3}
            className="w-full py-4 rounded-2xl font-black text-lg text-white mb-3 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, #e91e63, #c2185b)",
              boxShadow: "0 8px 32px rgba(233,30,99,0.4)",
            }}
          >
            🎲 Démarrer la partie !
          </button>
        )}

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
