import { useEffect, useMemo, useRef, useState } from "react";
import type { SendMessage, UCRoom } from "../hooks/useWebSocket";

interface Props {
  room: UCRoom;
  playerId: string;
  send: SendMessage;
  error: string | null;
  onLeave: () => void;
}

function useCountdown(endsAt: number | null): number {
  const [remaining, setRemaining] = useState<number>(0);
  useEffect(() => {
    if (!endsAt) { setRemaining(0); return; }
    const tick = () => setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [endsAt]);
  return remaining;
}

function CountdownRing({ seconds, total, color }: { seconds: number; total: number; color: string }) {
  const pct = total > 0 ? seconds / total : 0;
  const r = 28;
  const circ = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      <svg width="72" height="72" className="-rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
        <circle
          cx="36" cy="36" r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.2s linear" }}
        />
      </svg>
      <span className="text-2xl font-black -mt-[52px]" style={{ color }}>{seconds}</span>
    </div>
  );
}

export function Undercover({ room, playerId, send, error, onLeave }: Props) {
  const [copied, setCopied] = useState(false);
  const [clue, setClue] = useState("");
  const [chatText, setChatText] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const ghostChatEndRef = useRef<HTMLDivElement>(null);

  const [spectatorMode, setSpectatorMode] = useState<null | "choosing" | "watching">(null);
  const prevAliveRef = useRef<boolean | undefined>(undefined);

  const discussionRemaining = useCountdown(room.discussionEndsAt ?? null);
  const votingRemaining = useCountdown(room.votingEndsAt ?? null);
  const roundResultRemaining = useCountdown(room.roundResultEndsAt ?? null);

  const isHost = room.hostId === playerId;
  const me = room.players.find((p) => p.id === playerId);
  const alivePlayers = room.players.filter((p) => p.isAlive);
  const eliminated = room.players.find((p) => p.id === room.eliminatedPlayerId);
  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${room.code}`;

  const votesByTarget = useMemo(() => {
    const counts = new Map<string, number>();
    Object.values(room.lastVotes || {}).forEach((t) =>
      counts.set(t, (counts.get(t) || 0) + 1),
    );
    return counts;
  }, [room.lastVotes]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [room.chatMessages.length]);

  useEffect(() => {
    ghostChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [room.chatMessages.length]);

  useEffect(() => {
    const wasAlive = prevAliveRef.current;
    const isAlive = me?.isAlive;
    prevAliveRef.current = isAlive;
    if (wasAlive === true && isAlive === false && room.phase !== "lobby" && room.phase !== "game-over") {
      setSpectatorMode("choosing");
    }
  }, [me?.isAlive, room.phase]);

  useEffect(() => {
    if (room.phase === "lobby") {
      setSpectatorMode(null);
      prevAliveRef.current = undefined;
    }
  }, [room.phase]);

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const submitClue = () => {
    if (!clue.trim()) return;
    send({ type: "UC_CLUE", clue });
    setClue("");
  };

  const submitChat = () => {
    if (!chatText.trim()) return;
    send({ type: "UC_CHAT", text: chatText });
    setChatText("");
  };

  const hasSubmittedCurrentClue = (me?.clues.length ?? 0) > room.clueRound;
  const hasVoted = !!me?.voteTargetId;
  const pastClueCount = (me?.pastClues ?? room.players[0]?.pastClues ?? []).flat().length;
  const totalClueNum = pastClueCount + room.clueRound + 1;
  const totalClueMax = pastClueCount + 4;

  if (room.phase === "lobby") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-start px-4 py-8"
        style={{ background: "linear-gradient(135deg, #111827 0%, #312e81 55%, #581c87 100%)" }}
      >
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🕵️</div>
          <h1 className="text-4xl font-black text-white">Undercover</h1>
          <p className="text-purple-200 text-sm mt-1">
            Trouve les imposteurs avant qu'ils ne prennent le contrôle.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-2xl p-5 w-full max-w-sm mb-4 text-center border border-white/10">
          <p className="text-xs font-bold text-purple-200 uppercase tracking-widest mb-1">Code de la salle</p>
          <div className="text-5xl font-black tracking-[0.35em] text-white mb-3">{room.code}</div>
          <button
            onClick={copyLink}
            className="w-full py-2.5 rounded-xl font-bold text-sm bg-purple-500 hover:bg-purple-400 text-white transition-colors"
          >
            {copied ? "✅ Lien copié !" : "🔗 Copier le lien d'invitation"}
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">Partage ce lien pour inviter des amis</p>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-2xl p-5 w-full max-w-sm mb-4 border border-white/20">
          <h2 className="font-black text-purple-200 mb-3 text-sm uppercase tracking-wide">
            Joueurs ({room.players.length}/12)
          </h2>
          <div className="space-y-2">
            {room.players.map((player) => (
              <div
                key={player.id}
                className={`flex items-center gap-3 p-2.5 rounded-xl ${player.id === playerId ? "bg-white/20" : "bg-white/5"}`}
              >
                <span className="text-2xl">{player.avatar || "🐱"}</span>
                <span className="flex-1 font-bold text-sm text-white">{player.name}</span>
                {!player.isConnected && <span className="text-xs text-gray-400">⚪ hors ligne</span>}
                {player.id === room.hostId && (
                  <span className="text-xs bg-yellow-400/20 text-yellow-300 px-2 py-0.5 rounded-full font-bold">Hôte</span>
                )}
                {player.id === playerId && (
                  <span className="text-xs bg-purple-400/30 text-purple-200 px-2 py-0.5 rounded-full font-bold">Toi</span>
                )}
                {isHost && player.id !== playerId && (
                  <button
                    onClick={() => send({ type: "KICK_PLAYER", targetPlayerId: player.id })}
                    className="text-xs text-white/30 hover:text-red-400 transition-colors px-1 py-0.5 rounded"
                    title="Exclure ce joueur"
                  >
                    ✕ Exclure
                  </button>
                )}
              </div>
            ))}
          </div>
          {room.players.length < 3 && (
            <p className="text-xs text-amber-300 bg-amber-400/20 rounded-lg px-3 py-2 mt-3 text-center font-semibold">
              ⚠️ Il faut au moins 3 joueurs pour commencer
            </p>
          )}
        </div>

        {isHost && (
          <div className="bg-white rounded-2xl shadow-lg p-5 w-full max-w-sm mb-4 space-y-4">
            <div>
              <label className="block text-xs font-black text-gray-600 uppercase tracking-wide mb-2">
                Nombre d'Undercover
              </label>
              <select
                value={Math.min(room.undercoverCount, Math.max(1, room.players.length - 1))}
                onChange={(e) => send({ type: "UC_SET_UNDERCOVER_COUNT", count: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
              >
                {Array.from({ length: Math.max(1, Math.min(5, room.players.length - 1)) }, (_, i) => i + 1).map((c) => (
                  <option key={c} value={c}>{c} Undercover{c > 1 ? "s" : ""}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-2">Il restera toujours au moins un civil.</p>
            </div>
            <div>
              <label className="block text-xs font-black text-gray-600 uppercase tracking-wide mb-2">
                Durée de discussion
              </label>
              <select
                value={room.discussionDuration}
                onChange={(e) => send({ type: "UC_SET_DISCUSSION_DURATION", duration: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
              >
                <option value={20}>20 secondes</option>
                <option value={30}>30 secondes</option>
                <option value={60}>60 secondes</option>
                <option value={90}>90 secondes</option>
              </select>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 w-full max-w-sm mb-4 text-sm font-semibold">
            ⚠️ {error}
          </div>
        )}

        {isHost ? (
          <button
            onClick={() => send({ type: "UC_START" })}
            disabled={room.players.length < 3}
            className="w-full max-w-sm py-4 rounded-2xl font-black text-xl text-white shadow-xl active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #7c3aed, #4c1d95)" }}
          >
            🕵️ Démarrer Undercover
          </button>
        ) : (
          <p className="bg-white/10 text-purple-100 rounded-xl px-4 py-3 w-full max-w-sm mb-2 text-center text-sm font-semibold">
            ⏳ En attente que l'hôte démarre la partie...
          </p>
        )}

        <button
          onClick={onLeave}
          className="mt-3 text-sm font-semibold py-2 px-5 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-red-200 transition-colors"
        >
          🚪 Quitter la salle
        </button>
      </div>
    );
  }

  if (spectatorMode === "choosing") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #2d1b69 100%)" }}
      >
        <div className="w-full max-w-sm text-center">
          <div className="text-6xl mb-4 animate-pulse">👻</div>
          <h1 className="text-3xl font-black text-white mb-2">Tu es éliminé·e !</h1>
          <p className="text-purple-200 text-sm mb-2">
            Tu étais{" "}
            <span className={`font-black ${me?.role === "undercover" ? "text-red-400" : "text-green-400"}`}>
              {me?.role === "undercover" ? "🕵️ Undercover" : "🏛️ Civil"}
            </span>
            {me?.word ? (
              <>
                {" "}avec le mot{" "}
                <span className="font-black text-yellow-300">« {me.word} »</span>
              </>
            ) : null}
          </p>
          <p className="text-purple-300 text-xs mb-8">
            Que veux-tu faire maintenant ?
          </p>

          <div className="space-y-3">
            <button
              onClick={() => setSpectatorMode("watching")}
              className="w-full py-4 rounded-2xl font-black text-lg text-white shadow-xl transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #6d28d9, #4c1d95)" }}
            >
              👻 Regarder en tant que fantôme
              <p className="text-xs font-normal text-purple-200 mt-0.5">
                Suis la partie sans pouvoir interagir
              </p>
            </button>

            <button
              onClick={onLeave}
              className="w-full py-3.5 rounded-2xl font-black text-base bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all"
            >
              🚪 Quitter la partie
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (spectatorMode === "watching") {
    const ghostPlayers = room.players.filter((p) => !p.isAlive);
    const alivePlayers2 = room.players.filter((p) => p.isAlive);

    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #2d1b69 100%)" }}
      >
        <header className="px-4 py-3 flex items-center justify-between gap-2" style={{ background: "rgba(109,40,217,0.25)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">👻</span>
            <div>
              <h1 className="text-white font-black text-base leading-tight">Mode Fantôme</h1>
              <p className="text-purple-300 text-xs">
                Salle {room.code} · Tour {room.roundNumber}
                {(room.phase === "clue" || room.phase === "discussion" || room.phase === "voting" || room.phase === "round-result") && ` · Indice ${totalClueNum}`}
              </p>
            </div>
          </div>
          <button
            onClick={onLeave}
            className="shrink-0 text-xs font-semibold py-1.5 px-3 rounded-xl bg-white/10 text-white/70 hover:bg-red-500/20 hover:text-red-200 transition-colors"
          >
            🚪 Quitter
          </button>
        </header>

        <div className="px-4 py-2 text-center">
          <span className="inline-flex items-center gap-1.5 bg-purple-900/60 border border-purple-500/40 text-purple-200 text-xs font-bold px-3 py-1.5 rounded-full">
            👻 Tu regardes la partie · tu ne peux pas interagir
          </span>
        </div>

        <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-3 space-y-4">

          {/* ── MY ELIMINATION INFO ── */}
          <section className="rounded-2xl p-4 border border-purple-500/30 text-center" style={{ background: "rgba(109,40,217,0.2)" }}>
            <p className="text-purple-300 text-xs font-black uppercase tracking-widest mb-1">Ton rôle révélé</p>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-sm mb-1 ${
              me?.role === "undercover"
                ? "bg-red-900/50 text-red-300 border border-red-500/40"
                : "bg-green-900/50 text-green-300 border border-green-500/40"
            }`}>
              {me?.role === "undercover" ? "🕵️ Tu étais Undercover" : "🏛️ Tu étais Civil"}
            </div>
            {me?.word && (
              <p className="text-white text-sm">
                Ton mot : <span className="font-black text-yellow-300">« {me.word} »</span>
              </p>
            )}
          </section>

          {/* ── PHASE STATUS ── */}
          {(room.phase === "reveal" || room.phase === "clue") && (
            <section className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/10">
              <p className="text-purple-200 text-xs font-black uppercase tracking-widest mb-3">
                {room.phase === "reveal" ? "Phase : Découverte des mots" : `Phase : Indices (${totalClueNum}/${totalClueMax})`}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {room.players.map((player) => (
                  <div key={player.id} className={`rounded-2xl p-3 ${player.isAlive ? "bg-white" : "bg-white/30 border border-purple-400/30"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{player.avatar}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-black truncate text-sm ${player.isAlive ? "text-gray-800" : "text-white"}`}>
                          {player.name}
                          {player.id === playerId && <span className="text-purple-400 ml-1">(toi)</span>}
                        </p>
                        {!player.isAlive && (
                          <p className={`text-xs font-bold ${player.role === "undercover" ? "text-red-300" : "text-green-300"}`}>
                            {player.role === "undercover" ? "🕵️ Undercover" : "🏛️ Civil"} · éliminé·e
                            {player.word ? ` · « ${player.word} »` : ""}
                          </p>
                        )}
                      </div>
                      {player.isAlive && room.phase === "reveal" && player.hasSeenWord && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Prêt</span>
                      )}
                      {player.isAlive && room.phase === "clue" && player.clues.length > room.clueRound && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">✅</span>
                      )}
                    </div>
                    {room.phase === "clue" && ([...(player.pastClues ?? []).flat(), ...player.clues].length > 0) && (
                      <div className="mt-1 space-y-1">
                        {[...(player.pastClues ?? []).flat(), ...player.clues].map((c, i) => (
                          <p key={i} className="text-xs bg-gray-100 rounded-lg px-2 py-1 text-gray-700">
                            Indice {i + 1} : <strong>{c}</strong>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {room.phase === "reveal" && (
                <p className="text-xs text-purple-300 text-center mt-3">
                  {room.players.filter((p) => p.isAlive && p.hasSeenWord).length}/{alivePlayers2.length} joueurs ont vu leur mot
                </p>
              )}
            </section>
          )}

          {/* ── DISCUSSION (ghost) ── */}
          {room.phase === "discussion" && (
            <>
              <section className="bg-white rounded-2xl shadow-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-black text-purple-500 uppercase tracking-widest">Discussion</p>
                    <h2 className="text-lg font-black text-gray-900">Les joueurs débattent</h2>
                  </div>
                  <CountdownRing seconds={discussionRemaining} total={room.discussionDuration} color="#7c3aed" />
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto mb-2 bg-gray-50 rounded-2xl p-3">
                  {room.chatMessages.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Pas encore de messages...</p>
                  ) : (
                    room.chatMessages.map((msg) => (
                      <div key={msg.id} className="rounded-2xl px-3 py-2 bg-white mr-4 shadow-sm">
                        <p className="text-xs font-black text-gray-500 mb-0.5">
                          {msg.avatar} {msg.playerName}
                        </p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{msg.text}</p>
                      </div>
                    ))
                  )}
                  <div ref={ghostChatEndRef} />
                </div>
                <p className="text-xs text-gray-400 text-center italic">👻 Tu observes le chat — tu ne peux pas écrire</p>
              </section>

              <section className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/10">
                <h2 className="text-white font-black text-sm uppercase tracking-wide mb-3">Indices donnés</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {room.players.map((player) => (
                    <div key={player.id} className={`rounded-2xl p-3 ${player.isAlive ? "bg-white" : "bg-white/30 border border-purple-400/30"}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{player.avatar}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`font-black truncate text-sm ${player.isAlive ? "text-gray-800" : "text-white"}`}>
                            {player.name}
                            {player.id === playerId && <span className="text-purple-400 ml-1">(toi)</span>}
                          </p>
                          {!player.isAlive && (
                            <p className={`text-xs font-bold ${player.role === "undercover" ? "text-red-300" : "text-green-300"}`}>
                              {player.role === "undercover" ? "🕵️ Undercover" : "🏛️ Civil"} · éliminé·e
                            </p>
                          )}
                        </div>
                      </div>
                      {[...(player.pastClues ?? []).flat(), ...player.clues].length > 0 ? (
                        <div className="space-y-1">
                          {[...(player.pastClues ?? []).flat(), ...player.clues].map((c, i) => (
                            <p key={i} className={`text-xs rounded-lg px-2 py-1 ${player.isAlive ? "bg-gray-100 text-gray-700" : "bg-purple-900/40 text-purple-200"}`}>
                              Indice {i + 1} : <strong>{c}</strong>
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">{player.isAlive ? "Pas encore d'indice" : "Aucun indice"}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ── VOTING (ghost) ── */}
          {room.phase === "voting" && (
            <>
              <section className="bg-white rounded-2xl shadow-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-black text-red-500 uppercase tracking-widest">Vote en cours</p>
                    <h2 className="text-lg font-black text-gray-900">Les joueurs votent</h2>
                    <p className="text-xs text-gray-500">👻 Tu ne peux plus voter</p>
                  </div>
                  <CountdownRing seconds={votingRemaining} total={10} color={votingRemaining <= 3 ? "#ef4444" : "#f59e0b"} />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {room.players.map((player) => {
                    const voted = !!player.voteTargetId;
                    const voteCount = votesByTarget.get(player.id) || 0;
                    return (
                      <div key={player.id} className={`rounded-2xl p-3 ${player.isAlive ? "bg-gray-50 border border-gray-200" : "bg-purple-900/30 border border-purple-500/30"}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{player.avatar}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`font-black truncate text-sm ${player.isAlive ? "text-gray-800" : "text-purple-200"}`}>
                              {player.name}
                              {player.id === playerId && <span className="text-purple-400 ml-1">(toi)</span>}
                            </p>
                            <p className="text-xs text-gray-400">{player.isAlive ? "En jeu" : "Éliminé·e"}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {voted && player.isAlive && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">A voté</span>
                            )}
                            {voteCount > 0 && (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
                                {voteCount} 🗳️
                              </span>
                            )}
                          </div>
                        </div>
                        {[...(player.pastClues ?? []).flat(), ...player.clues].length > 0 && (
                          <div className="mt-2 space-y-1">
                            {[...(player.pastClues ?? []).flat(), ...player.clues].map((c, i) => (
                              <p key={i} className="text-xs bg-gray-100 rounded-lg px-2 py-1 text-gray-600">
                                Indice {i + 1} : <strong>{c}</strong>
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {/* ── ROUND RESULT (ghost) ── */}
          {room.phase === "round-result" && (
            <section className="bg-white rounded-2xl shadow-xl p-5 text-center">
              <p className="text-xs font-black text-purple-500 uppercase tracking-widest mb-2">Résultat du vote</p>
              {room.eliminatedPlayerId ? (
                <>
                  <h2 className="text-2xl font-black text-gray-900 mb-1">
                    {eliminated?.avatar} {eliminated?.name} est éliminé·e
                  </h2>
                  <p className={`font-black text-lg ${eliminated?.role === "undercover" ? "text-purple-600" : "text-rose-600"}`}>
                    {eliminated?.role === "undercover" ? "🕵️ C'était un Undercover !" : "🏛️ C'était un Civil..."}
                  </p>
                  {eliminated?.word && (
                    <p className="text-sm text-gray-500 mt-1">
                      Son mot : <strong>{eliminated.word}</strong>
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="text-4xl mb-2">⏭️</div>
                  <h2 className="text-2xl font-black text-gray-900 mb-2">Personne n'est éliminé</h2>
                  <p className="text-gray-500 text-sm">
                    {room.clueRound >= 3
                      ? "Le maximum d'indices a été atteint."
                      : "Les votes ont choisi de passer."}
                  </p>
                </>
              )}
              {room.roundResultEndsAt && (
                <p className="text-xs text-purple-500 mt-4 font-bold">
                  ⏱️ Tour suivant dans {roundResultRemaining}s...
                </p>
              )}
            </section>
          )}

          {/* ── GAME OVER (ghost) ── */}
          {room.phase === "game-over" && (
            <section className="bg-white rounded-2xl shadow-xl p-5 text-center">
              <p className="text-xs font-black text-purple-500 uppercase tracking-widest mb-2">Fin de partie</p>
              <div className="text-5xl mb-2">{room.winnerTeam === "civilians" ? "🏛️" : "🕵️"}</div>
              <h2 className="text-3xl font-black text-gray-900 mb-2">
                {room.winnerTeam === "civilians" ? "Les Civils gagnent !" : "Les Undercover gagnent !"}
              </h2>
              <p className="text-gray-500 text-sm mb-4">
                Mot civil : <strong>{room.civilianWord}</strong> · Mot undercover : <strong>{room.undercoverWord}</strong>
              </p>
              <div className="space-y-1 mb-4">
                {room.players.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                    <span className="text-xl">{p.avatar}</span>
                    <span className="font-bold flex-1 text-left text-sm">{p.name}</span>
                    {!p.isAlive && <span className="text-xs text-purple-500 font-bold">👻</span>}
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${p.role === "undercover" ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
                      {p.role === "undercover" ? "🕵️ Undercover" : "🏛️ Civil"}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 italic">👻 En attente que l'hôte relance...</p>
            </section>
          )}

          {/* ── GHOST PLAYER LIST ── */}
          {ghostPlayers.length > 1 && room.phase !== "game-over" && (
            <section className="bg-white/5 backdrop-blur rounded-2xl p-4 border border-purple-500/20">
              <h2 className="text-purple-300 font-black text-xs uppercase tracking-widest mb-3">👻 Autres fantômes</h2>
              <div className="flex flex-wrap gap-2">
                {ghostPlayers
                  .filter((p) => p.id !== playerId)
                  .map((p) => (
                    <div key={p.id} className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-1.5">
                      <span className="text-base">{p.avatar}</span>
                      <span className="text-xs font-bold text-purple-200">{p.name}</span>
                      <span className={`text-xs font-black ${p.role === "undercover" ? "text-red-400" : "text-green-400"}`}>
                        {p.role === "undercover" ? "· Undercover" : "· Civil"}
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #312e81 55%, #4c1d95 100%)" }}
    >
      <header className="px-4 py-3 bg-black/30 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-white font-black text-lg">🕵️ Undercover</h1>
          <p className="text-purple-200 text-xs">
            Salle {room.code} · Tour {room.roundNumber}
            {(room.phase === "clue" || room.phase === "discussion" || room.phase === "voting" || room.phase === "round-result") && ` · Indice ${totalClueNum}`}
          </p>
        </div>
        <button
          onClick={onLeave}
          className="shrink-0 text-xs font-semibold py-1.5 px-3 rounded-xl bg-white/10 text-white/70 hover:bg-red-500/20 hover:text-red-200 transition-colors"
        >
          🚪 Quitter
        </button>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-5 space-y-4">
        {error && (
          <div className="bg-red-900/50 text-red-200 rounded-xl px-4 py-2 text-sm font-semibold text-center">
            ⚠️ {error}
          </div>
        )}

        {/* ── REVEAL ── */}
        {room.phase === "reveal" && (
          <section className="bg-white rounded-3xl shadow-xl p-5 text-center">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-sm mb-4 ${
              me?.role === "undercover"
                ? "bg-red-100 text-red-700 border-2 border-red-300"
                : "bg-green-100 text-green-700 border-2 border-green-300"
            }`}>
              {me?.role === "undercover" ? "🕵️ Tu es Undercover !" : "🏛️ Tu es Civil !"}
            </div>
            <p className="text-xs font-black text-purple-500 uppercase tracking-widest mb-2">Ton mot secret</p>
            <div className="text-4xl font-black text-gray-900 mb-2">{me?.word}</div>
            <p className="text-gray-500 text-sm mb-4">
              {me?.role === "undercover"
                ? "Les civils ont un mot similaire. Donne des indices sans te trahir !"
                : "Ne le montre à personne. Donne ensuite un indice assez discret."}
            </p>
            <button
              onClick={() => send({ type: "UC_SEEN" })}
              disabled={me?.hasSeenWord}
              className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:bg-gray-300 text-white font-black transition-colors"
            >
              {me?.hasSeenWord ? "✅ Mot gardé à l'écran" : "Je garde ce mot affiché"}
            </button>
            <p className="text-xs text-gray-400 mt-3">
              {room.players.filter((p) => p.hasSeenWord).length}/{alivePlayers.length} joueurs prêts
            </p>
          </section>
        )}

        {/* ── CLUE ── */}
        {room.phase === "clue" && (
          <section className="bg-white rounded-3xl shadow-xl p-5 text-center">
            <p className="text-xs font-black text-purple-500 uppercase tracking-widest mb-1">
              Indice {totalClueNum} / {totalClueMax}
            </p>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Ton mot</p>
            <div className="text-3xl font-black text-gray-900 mb-2">{me?.word}</div>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black mb-4 ${
              me?.role === "undercover" ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
            }`}>
              {me?.role === "undercover" ? "🕵️ Undercover" : "🏛️ Civil"}
            </div>

            {[...((me?.pastClues ?? []).flat()), ...(me?.clues ?? [])].length > 0 && (
              <div className="text-left mb-3 space-y-1">
                {[...((me?.pastClues ?? []).flat()), ...(me?.clues ?? [])].map((c, i) => (
                  <p key={i} className="bg-green-50 text-green-700 rounded-xl px-4 py-2 font-bold text-sm">
                    Indice {i + 1} : {c}
                  </p>
                ))}
              </div>
            )}

            {!hasSubmittedCurrentClue && me?.isAlive ? (
              <div className="flex gap-2">
                <input
                  value={clue}
                  onChange={(e) => setClue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitClue()}
                  maxLength={40}
                  placeholder={totalClueNum === 1 ? "Ton indice en un mot ou courte phrase" : `Indice ${totalClueNum}...`}
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <button onClick={submitClue} className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 rounded-xl">
                  Envoyer
                </button>
              </div>
            ) : hasSubmittedCurrentClue ? (
              <p className="bg-green-50 text-green-700 rounded-xl px-4 py-3 font-bold text-sm">
                ✅ Indice soumis, en attente des autres joueurs...
              </p>
            ) : (
              <p className="text-gray-500 text-sm">Tu es éliminé, observe la partie.</p>
            )}
          </section>
        )}

        {/* ── DISCUSSION ── */}
        {room.phase === "discussion" && (
          <>
            <section className="bg-white rounded-3xl shadow-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-black text-purple-500 uppercase tracking-widest">Discussion</p>
                  <h2 className="text-xl font-black text-gray-900">Débattez entre vous !</h2>
                  <p className="text-sm text-gray-500">Le vote démarrera automatiquement à la fin du temps.</p>
                </div>
                <CountdownRing seconds={discussionRemaining} total={room.discussionDuration} color="#7c3aed" />
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto mb-3 bg-gray-50 rounded-2xl p-3">
                {room.chatMessages.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Soyez les premiers à parler...</p>
                ) : (
                  room.chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-2xl px-3 py-2 ${msg.playerId === playerId ? "bg-purple-50 ml-6" : "bg-white mr-6 shadow-sm"}`}
                    >
                      <p className="text-xs font-black text-gray-500 mb-0.5">
                        {msg.avatar} {msg.playerName}
                      </p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{msg.text}</p>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {me?.isAlive ? (
                <div className="flex gap-2">
                  <input
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitChat()}
                    maxLength={220}
                    placeholder="Écris ton message..."
                    className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  <button onClick={submitChat} className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 rounded-xl">
                    Envoyer
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center">Tu es éliminé — tu peux lire le chat.</p>
              )}
            </section>

            <section className="bg-white/10 backdrop-blur rounded-3xl p-4 border border-white/10">
              <h2 className="text-white font-black text-sm uppercase tracking-wide mb-3">Indices donnés</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {room.players.map((player) => (
                  <div key={player.id} className={`rounded-2xl p-3 ${player.isAlive ? "bg-white" : "bg-white/40 opacity-70"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{player.avatar}</span>
                      <p className="font-black text-gray-800 truncate flex-1">
                        {player.name} {player.id === playerId ? "(toi)" : ""}
                      </p>
                      {player.id === room.hostId && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">Hôte</span>
                      )}
                    </div>
                    {[...(player.pastClues ?? []).flat(), ...player.clues].length > 0 ? (
                      <div className="space-y-1">
                        {[...(player.pastClues ?? []).flat(), ...player.clues].map((c, i) => (
                          <p key={i} className="text-sm bg-gray-100 rounded-xl px-3 py-1.5 text-gray-700">
                            Indice {i + 1} : <strong>{c}</strong>
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">{player.isAlive ? "Pas encore d'indice" : "Éliminé"}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ── VOTING ── */}
        {room.phase === "voting" && (
          <>
            <section className="bg-white rounded-3xl shadow-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-black text-red-500 uppercase tracking-widest">Vote</p>
                  <h2 className="text-xl font-black text-gray-900">Qui est l'Undercover ?</h2>
                  <p className="text-sm text-gray-500">
                    {hasVoted ? "Tu as voté. En attente des autres..." : "Vote vite, le temps est compté !"}
                  </p>
                </div>
                <CountdownRing seconds={votingRemaining} total={10} color={votingRemaining <= 3 ? "#ef4444" : "#f59e0b"} />
              </div>

              {me?.isAlive && !hasVoted && (
                <div className="space-y-2">
                  {alivePlayers
                    .filter((p) => p.id !== playerId)
                    .map((player) => (
                      <button
                        key={player.id}
                        onClick={() => send({ type: "UC_VOTE", targetId: player.id })}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-50 hover:bg-red-50 border border-gray-200 hover:border-red-300 transition-colors text-left"
                      >
                        <span className="text-2xl">{player.avatar}</span>
                        <span className="flex-1 font-bold text-gray-800">{player.name}</span>
                        <span className="text-xs font-black text-red-500 bg-red-50 border border-red-200 px-2 py-1 rounded-xl">
                          Éliminer
                        </span>
                      </button>
                    ))}
                  <button
                    onClick={() => send({ type: "UC_VOTE", targetId: "__skip__" })}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-300 transition-colors text-left"
                  >
                    <span className="text-2xl">⏭️</span>
                    <div className="flex-1">
                      <span className="font-bold text-gray-800">Passer les votes</span>
                      <p className="text-xs text-gray-500">Personne n'est éliminé, on passe à l'indice suivant</p>
                    </div>
                    {room.clueRound >= 3 && (
                      <span className="text-xs text-orange-500 font-bold">Dernier indice</span>
                    )}
                  </button>
                </div>
              )}

              {hasVoted && (
                <p className="bg-green-50 text-green-700 rounded-xl px-4 py-3 font-bold text-sm text-center">
                  ✅ Vote enregistré !
                </p>
              )}

              {!me?.isAlive && (
                <p className="text-gray-500 text-sm text-center">Tu es éliminé — tu ne peux plus voter.</p>
              )}
            </section>

            <section className="bg-white/10 backdrop-blur rounded-3xl p-4 border border-white/10">
              <h2 className="text-white font-black text-sm uppercase tracking-wide mb-3">Joueurs</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {room.players.map((player) => {
                  const voted = !!player.voteTargetId;
                  const voteCount = votesByTarget.get(player.id) || 0;
                  return (
                    <div key={player.id} className={`rounded-2xl p-3 ${player.isAlive ? "bg-white" : "bg-white/40 opacity-70"}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{player.avatar}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-gray-800 truncate">
                            {player.name} {player.id === playerId ? "(toi)" : ""}
                          </p>
                          <p className="text-xs text-gray-400">{player.isAlive ? "En jeu" : "Éliminé"}</p>
                        </div>
                        {voted && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                            A voté
                          </span>
                        )}
                        {voteCount > 0 && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
                            {voteCount} 🗳️
                          </span>
                        )}
                      </div>
                      {[...(player.pastClues ?? []).flat(), ...player.clues].length > 0 && (
                        <div className="mt-2 space-y-1">
                          {[...(player.pastClues ?? []).flat(), ...player.clues].map((c, i) => (
                            <p key={i} className="text-sm bg-gray-100 rounded-xl px-3 py-1.5 text-gray-700">
                              Indice {i + 1} : <strong>{c}</strong>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* ── ROUND RESULT ── */}
        {room.phase === "round-result" && (
          <section className="bg-white rounded-3xl shadow-xl p-5 text-center">
            <p className="text-xs font-black text-purple-500 uppercase tracking-widest mb-2">Résultat du vote</p>
            {room.eliminatedPlayerId ? (
              <>
                <h2 className="text-2xl font-black text-gray-900 mb-2">
                  {eliminated?.avatar} {eliminated?.name} est éliminé·e
                </h2>
                <p className={`font-black text-lg ${eliminated?.role === "undercover" ? "text-purple-600" : "text-rose-600"}`}>
                  {eliminated?.role === "undercover" ? "🕵️ C'était un Undercover !" : "🏛️ C'était un Civil..."}
                </p>
              </>
            ) : (
              <>
                <div className="text-4xl mb-2">⏭️</div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">Personne n'est éliminé</h2>
                <p className="text-gray-500 text-sm">
                  {room.clueRound >= 3
                    ? "Le maximum d'indices a été atteint."
                    : "Les votes ont choisi de passer."}
                </p>
              </>
            )}
            {isHost ? (
              <button
                onClick={() => send({ type: "UC_NEXT_ROUND" })}
                className="mt-4 w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black"
              >
                Tour suivant →
              </button>
            ) : (
              <p className="text-gray-500 text-sm mt-4">En attente que l'hôte lance le tour suivant...</p>
            )}
            {room.roundResultEndsAt && (
              <p className="text-xs text-purple-500 mt-2 font-bold">
                ⏱️ Tour suivant automatique dans {roundResultRemaining}s
              </p>
            )}
          </section>
        )}

        {/* ── GAME OVER ── */}
        {room.phase === "game-over" && (
          <section className="bg-white rounded-3xl shadow-xl p-5 text-center">
            <p className="text-xs font-black text-purple-500 uppercase tracking-widest mb-2">Fin de partie</p>
            <div className="text-5xl mb-2">{room.winnerTeam === "civilians" ? "🏛️" : "🕵️"}</div>
            <h2 className="text-3xl font-black text-gray-900 mb-2">
              {room.winnerTeam === "civilians" ? "Les Civils gagnent !" : "Les Undercover gagnent !"}
            </h2>
            <p className="text-gray-500 text-sm mb-4">
              Mot civil : <strong>{room.civilianWord}</strong> · Mot undercover : <strong>{room.undercoverWord}</strong>
            </p>
            <div className="space-y-1 mb-4">
              {room.players.map((p) => (
                <div key={p.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                  <span className="text-xl">{p.avatar}</span>
                  <span className="font-bold flex-1 text-left">{p.name}</span>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${p.role === "undercover" ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
                    {p.role === "undercover" ? "🕵️ Undercover" : "🏛️ Civil"}
                  </span>
                </div>
              ))}
            </div>
            {isHost ? (
              <button
                onClick={() => send({ type: "UC_RESET" })}
                className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black"
              >
                🔄 Rejouer
              </button>
            ) : (
              <p className="text-gray-500 text-sm">En attente que l'hôte relance...</p>
            )}
          </section>
        )}

        {/* ── PLAYERS GRID (always visible except lobby-only phases) ── */}
        {(room.phase === "reveal" || room.phase === "clue") && (
          <section className="bg-white/10 backdrop-blur rounded-3xl p-4 border border-white/10">
            <h2 className="text-white font-black text-sm uppercase tracking-wide mb-3">Joueurs</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {room.players.map((player) => (
                <div key={player.id} className={`rounded-2xl p-3 ${player.isAlive ? "bg-white" : "bg-white/40 opacity-70"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{player.avatar}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-800 truncate">
                        {player.name} {player.id === playerId ? "(toi)" : ""}
                      </p>
                      <p className="text-xs text-gray-400">
                        {player.isAlive ? "En jeu" : `Éliminé · ${player.role === "undercover" ? "Undercover" : "Civil"}`}
                      </p>
                    </div>
                    {room.phase === "reveal" && player.hasSeenWord && player.isAlive && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Prêt</span>
                    )}
                    {room.phase === "clue" && player.isAlive && player.clues.length > room.clueRound && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">✅</span>
                    )}
                  </div>
                  {room.phase === "clue" && [...(player.pastClues ?? []).flat(), ...player.clues].length > 0 && (
                    <div className="space-y-1">
                      {[...(player.pastClues ?? []).flat(), ...player.clues].map((c, i) => (
                        <p key={i} className="text-sm bg-gray-100 rounded-xl px-3 py-1.5 text-gray-700">
                          Indice {i + 1} : <strong>{c}</strong>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
