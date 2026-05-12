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
  const handleVoteMode = (voteMode: "classic" | "democratic") => send({ type: "BMC_SET_VOTE_MODE", voteMode });

  const { cardMode, isPrivate, voteMode } = room;
  const canStart = room.players.length >= 3;

  return (
    <div className="bg-party min-h-screen relative">
      <div className="party-cards-layer" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-12">
        {/* Header */}
        <div className="text-center mb-8 relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold text-white/80 mb-4"
               style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Salle d'attente · Blanc Manger Coco
          </div>
          <h1 className="title-display text-white text-[clamp(2rem,6vw,3.5rem)]" style={{
            background: "linear-gradient(180deg, #fff 0%, #ffd93d 50%, #ff2e7a 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Préparez-vous !
          </h1>
        </div>

        {/* Room code card */}
        <div className="card-jb p-6 sm:p-8 mb-5 text-center relative overflow-hidden">
          <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-40 blur-3xl"
               style={{ background: "rgba(255,46,122,0.6)" }} />

          <div className="flex items-center justify-center gap-2 mb-2">
            <p className="section-eyebrow">Code de la salle</p>
            {isPrivate && (
              <span className="text-[0.65rem] font-black px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(168,85,247,0.20)", color: "#c4b5fd", border: "1px solid rgba(168,85,247,0.4)" }}>
                🔒 Privée
              </span>
            )}
          </div>

          <div
            className="title-display text-[clamp(3.5rem,11vw,5.5rem)] tracking-[0.18em] mb-4"
            data-testid="room-code"
            style={{
              background: "linear-gradient(180deg, #fff 0%, #ffd93d 60%, #ff2e7a 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 6px 24px rgba(255,46,122,0.45))",
            }}
          >
            {room.code}
          </div>

          <button
            data-testid="copy-link"
            onClick={copyLink}
            className={copied ? "btn-jb btn-jb-sm" : "btn-jb btn-jb-sm btn-jb-yellow"}
            style={copied ? {
              background: "linear-gradient(180deg, #34d399, #059669)",
              boxShadow: "0 4px 0 0 rgba(0,0,0,0.35), 0 8px 22px -6px rgba(52,211,153,0.55), inset 0 1px 0 0 rgba(255,255,255,0.30)",
            } : undefined}
          >
            {copied ? "✅ Lien copié !" : "🔗 Copier le lien d'invitation"}
          </button>
          <p className="text-xs text-white/45 mt-3 font-semibold">
            {isPrivate ? "Seuls les joueurs avec ce lien peuvent rejoindre" : "Partage ce lien pour inviter des amis"}
          </p>
        </div>

        {/* Players grid */}
        <div className="card-jb p-5 sm:p-6 mb-5">
          <div className="flex items-center justify-between mb-4">
            <p className="section-eyebrow">Joueurs · {room.players.length}/10</p>
            {!canStart && (
              <span className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.30)" }}>
                ⚠️ 3 joueurs minimum
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {room.players.map((player) => (
              <div
                key={player.id}
                data-testid={`player-${player.id}`}
                className="flex items-center gap-3 p-3 rounded-2xl transition-all"
                style={player.id === playerId ? {
                  background: "linear-gradient(180deg, rgba(255,46,122,0.18), rgba(255,46,122,0.08))",
                  border: "1px solid rgba(255,46,122,0.40)",
                  boxShadow: "0 4px 18px -4px rgba(255,46,122,0.30)",
                } : {
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                     style={{ background: "rgba(0,0,0,0.30)", border: "1px solid rgba(255,255,255,0.10)" }}>
                  {player.avatar || "🐱"}
                </div>
                <span className="flex-1 font-bold text-white truncate">{player.name}</span>
                {!player.isConnected && <span className="text-xs text-white/30 font-semibold">⚪ off</span>}
                {player.id === room.hostId && (
                  <span className="text-[0.65rem] px-2 py-0.5 rounded-full font-black"
                        style={{ background: "rgba(255,217,61,0.18)", color: "#fde047", border: "1px solid rgba(255,217,61,0.4)" }}>
                    👑 HÔTE
                  </span>
                )}
                {player.id === playerId && player.id !== room.hostId && (
                  <span className="text-[0.65rem] px-2 py-0.5 rounded-full font-black"
                        style={{ background: "rgba(255,46,122,0.18)", color: "#fda4af", border: "1px solid rgba(255,46,122,0.4)" }}>
                    TOI
                  </span>
                )}
                {isHost && player.id !== playerId && (
                  <button
                    onClick={() => send({ type: "KICK_PLAYER", targetPlayerId: player.id })}
                    className="text-xs text-white/30 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"
                    title="Exclure ce joueur"
                  >✕</button>
                )}
              </div>
            ))}
            {/* Empty slots */}
            {Array.from({ length: Math.max(0, 3 - room.players.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-3 p-3 rounded-2xl border-2 border-dashed"
                   style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.02)" }}>
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl text-white/25 flex-shrink-0"
                     style={{ background: "rgba(255,255,255,0.04)" }}>?</div>
                <span className="flex-1 text-sm text-white/30 font-bold italic">En attente d'un joueur...</span>
              </div>
            ))}
          </div>
        </div>

        {/* Settings (host only) */}
        {isHost && (
          <div className="card-jb p-5 sm:p-6 mb-5 space-y-6">
            {/* Target score */}
            <div>
              <p className="section-eyebrow mb-3">🎯 Score de victoire</p>
              <div className="flex gap-2.5">
                {[5, 10, 15].map(score => (
                  <button
                    key={score}
                    data-testid={`target-score-${score}`}
                    onClick={() => handleTargetScore(score)}
                    className="flex-1 py-3 rounded-2xl font-black text-base transition-all"
                    style={room.targetScore === score ? {
                      background: "linear-gradient(180deg, #ff2e7a, #c1185f)",
                      color: "#fff",
                      boxShadow: "0 6px 0 0 rgba(0,0,0,0.30), 0 10px 24px -6px rgba(255,46,122,0.50), inset 0 1px 0 0 rgba(255,255,255,0.25)",
                    } : {
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.55)",
                      border: "1px solid rgba(255,255,255,0.10)",
                    }}
                  >
                    {score} pts
                  </button>
                ))}
              </div>
            </div>

            {/* Card mode */}
            <div>
              <p className="section-eyebrow mb-3">🃏 Mode de cartes</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {([
                  { mode: "normal", icon: "🃏", label: "Normal", desc: "Sans contenu adulte", accent: "#3b82f6" },
                  { mode: "adult", icon: "🔞", label: "Trash (+18)", desc: "Cartes trash uniquement", accent: "#ef4444" },
                  { mode: "mixed", icon: "🎭", label: "Mixte", desc: "Normal + trash mélangés", accent: "#a855f7" },
                ] as const).map(({ mode, icon, label, desc, accent }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleCardMode(mode)}
                    className="flex flex-col gap-1 px-4 py-3.5 rounded-2xl text-sm transition-all text-left"
                    style={cardMode === mode ? {
                      background: `${accent}1F`, border: `1.5px solid ${accent}80`, color: "#fff",
                      boxShadow: `0 6px 22px -8px ${accent}80`,
                    } : {
                      background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.55)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{icon}</span>
                      <span className="font-black">{label}</span>
                      {cardMode === mode && <span className="ml-auto font-black" style={{ color: accent }}>✓</span>}
                    </div>
                    <span className="text-xs opacity-70 font-semibold leading-snug">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Vote mode */}
            <div>
              <p className="section-eyebrow mb-1">🗳️ Mode de vote</p>
              <p className="text-xs text-white/40 font-semibold mb-3">Qui choisit la meilleure réponse ?</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {([
                  { id: "classic" as const, icon: "👑", label: "Classique", desc: "Le QM choisit seul", accent: "#fbbf24" },
                  { id: "democratic" as const, icon: "🗳️", label: "Démocratique", desc: "Tout le monde vote", accent: "#c084fc" },
                ]).map(({ id, icon, label, desc, accent }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleVoteMode(id)}
                    className="flex flex-col gap-1 px-4 py-3.5 rounded-2xl text-sm transition-all text-left"
                    style={voteMode === id ? {
                      background: `${accent}1F`, border: `1.5px solid ${accent}80`, color: "#fff",
                      boxShadow: `0 6px 22px -8px ${accent}80`,
                    } : {
                      background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.55)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{icon}</span>
                      <span className="font-black">{label}</span>
                      {voteMode === id && <span className="ml-auto font-black" style={{ color: accent }}>✓</span>}
                    </div>
                    <span className="text-xs opacity-70 font-semibold">{desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {!isHost && (
          <div className="card-jb p-5 mb-5 text-center">
            <p className="text-sm font-bold text-white/80">⏳ En attente que l'hôte démarre...</p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2 text-xs font-bold">
              <span className="px-2.5 py-1 rounded-full" style={{ background: "rgba(255,217,61,0.15)", color: "#fde047", border: "1px solid rgba(255,217,61,0.30)" }}>
                🎯 {room.targetScore} pts
              </span>
              {cardMode === "adult" && <span className="px-2.5 py-1 rounded-full" style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.30)" }}>🔞 Adulte</span>}
              {cardMode === "mixed" && <span className="px-2.5 py-1 rounded-full" style={{ background: "rgba(168,85,247,0.15)", color: "#c4b5fd", border: "1px solid rgba(168,85,247,0.30)" }}>🎭 Mixte</span>}
              {voteMode === "democratic" && <span className="px-2.5 py-1 rounded-full" style={{ background: "rgba(168,85,247,0.15)", color: "#c4b5fd", border: "1px solid rgba(168,85,247,0.30)" }}>🗳️ Démocratique</span>}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl px-4 py-3 mb-5 text-sm font-semibold"
               style={{ background: "rgba(239,68,68,0.18)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.35)" }}
               data-testid="error-message">
            ⚠️ {error}
          </div>
        )}

        <div className="flex gap-3">
          {isHost && (
            <button
              data-testid="start-game"
              onClick={handleStart}
              disabled={!canStart}
              className="btn-jb flex-1"
              style={{ fontSize: "1.1rem", padding: "1.1rem 1.6rem" }}
            >
              🎲 Démarrer la partie !
            </button>
          )}
          <button
            onClick={onLeave}
            className="btn-jb btn-jb-sm btn-jb-ghost"
            style={{ padding: ".95rem 1.4rem" }}
          >
            🚪 Quitter
          </button>
        </div>
      </div>
    </div>
  );
}
