import { useState, useEffect, useRef } from "react";
import type { SendMessage, PBRoom } from "../hooks/useWebSocket";

interface Props {
  room: PBRoom;
  playerId: string;
  send: SendMessage;
  error: string | null;
  onLeave: () => void;
}

const ALL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function useTimer(room: PBRoom) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  useEffect(() => {
    if (
      room.phase !== "playing" ||
      !room.timePerRound ||
      !room.roundStartedAt
    ) {
      setTimeLeft(null);
      return;
    }
    const update = () => {
      const elapsed = Math.floor((Date.now() - room.roundStartedAt!) / 1000);
      const left = Math.max(0, room.timePerRound! - elapsed);
      setTimeLeft(left);
    };
    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [room.phase, room.timePerRound, room.roundStartedAt]);
  return timeLeft;
}

function TimerBar({ timeLeft, total }: { timeLeft: number; total: number }) {
  const pct = total > 0 ? Math.max(0, timeLeft / total) : 1;
  const color =
    pct > 0.5 ? "bg-green-400" : pct > 0.25 ? "bg-yellow-400" : "bg-red-400";
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  return (
    <div className="w-full mb-3">
      <div className="flex justify-between text-xs text-teal-100 mb-1">
        <span>Temps restant</span>
        <span className="font-bold text-white">
          {m > 0 ? `${m}m ` : ""}
          {s}s
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}

export function PetitBac({ room, playerId, send, error, onLeave }: Props) {
  const me = room.players.find((p) => p.id === playerId);
  const isHost = room.hostId === playerId;
  const timeLeft = useTimer(room);
  const [copied, setCopied] = useState(false);
  const [localAnswers, setLocalAnswers] = useState<Record<number, string>>({});
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [newCategoryMode, setNewCategoryMode] = useState(false);
  const [newCategoryText, setNewCategoryText] = useState("");
  const [allCategories, setAllCategories] = useState<
    { id: number; name: string }[]
  >([]);
  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${room.code}`;

  const [votePlayerIndex, setVotePlayerIndex] = useState(0);
  const [localVotes, setLocalVotes] = useState<
    Record<string, Record<number, boolean>>
  >({});

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    if (room.phase === "playing") {
      setLocalAnswers({});
      setNewCategoryMode(false);
      setNewCategoryText("");
    }
  }, [room.phase, room.currentRound]);

  useEffect(() => {
    if (room.phase === "voting") {
      setVotePlayerIndex(0);
      setLocalVotes({});
    }
  }, [room.phase, room.currentRound]);

  useEffect(() => {
    if (room.phase === "lobby") {
      fetch("/api/petit-bac/categories")
        .then((r) => r.json())
        .then((cats: { id: number; name: string; active: boolean }[]) => {
          setAllCategories(cats.filter((c) => c.active));
        })
        .catch(() => {});
    }
  }, [room.phase]);

  const handleAnswerChange = (catId: number, value: string) => {
    setLocalAnswers((prev) => ({ ...prev, [catId]: value }));
    if (sendTimer.current) clearTimeout(sendTimer.current);
    sendTimer.current = setTimeout(() => {
      send({ type: "PB_SET_ANSWER", categoryId: catId, answer: value });
    }, 400);
  };

  const handleDone = () => {
    if (sendTimer.current) clearTimeout(sendTimer.current);
    for (const [catId, answer] of Object.entries(localAnswers)) {
      send({ type: "PB_SET_ANSWER", categoryId: Number(catId), answer });
    }
    setTimeout(() => send({ type: "PB_DONE" }), 100);
  };

  const addCategory = () => {
    if (!newCategoryText.trim()) return;
    send({ type: "PB_ADD_CATEGORY", categoryName: newCategoryText.trim() });
    setNewCategoryText("");
    setNewCategoryMode(false);
  };

  const removeCategory = (categoryId: number) => {
    send({ type: "PB_REMOVE_CATEGORY", categoryId });
  };

  const getVoteForCat = (
    targetId: string,
    catId: number,
  ): boolean | undefined => {
    if (localVotes[targetId]?.[catId] !== undefined)
      return localVotes[targetId][catId];
    return (
      room.votes[playerId] as
        | Record<string, Record<number, boolean>>
        | undefined
    )?.[targetId]?.[catId];
  };

  const handleVote = (
    targetPlayerId: string,
    categoryId: number,
    valid: boolean,
  ) => {
    send({ type: "PB_VOTE", targetPlayerId, categoryId, valid });
    const newLocalVotes = {
      ...localVotes,
      [targetPlayerId]: {
        ...(localVotes[targetPlayerId] || {}),
        [categoryId]: valid,
      },
    };
    setLocalVotes(newLocalVotes);

    const otherPlayers = room.players.filter((p) => p.id !== playerId);
    const currentTarget = otherPlayers[votePlayerIndex];
    if (currentTarget && currentTarget.id === targetPlayerId) {
      const allVoted = room.categories.every((cat) => {
        const answer = (currentTarget.answers[cat.id] || "").trim();
        if (!answer) return true;
        return (
          (newLocalVotes[targetPlayerId]?.[cat.id] ??
            (
              room.votes[playerId] as
                | Record<string, Record<number, boolean>>
                | undefined
            )?.[targetPlayerId]?.[cat.id]) !== undefined
        );
      });
      if (allVoted && votePlayerIndex < otherPlayers.length - 1) {
        setTimeout(() => setVotePlayerIndex((prev) => prev + 1), 400);
      }
    }
  };

  const votingComplete = () => {
    for (const target of room.players) {
      if (target.id === playerId) continue;
      for (const cat of room.categories) {
        const answer = (target.answers[cat.id] || "").trim();
        if (!answer) continue;
        const voted = getVoteForCat(target.id, cat.id);
        if (voted === undefined) return false;
      }
    }
    return true;
  };

  const sortedPlayers = [...room.players].sort(
    (a, b) => (room.totalScores[b.id] ?? 0) - (room.totalScores[a.id] ?? 0),
  );

  const availableToAdd = allCategories.filter(
    (cat) => !room.categories.some((rc) => rc.id === cat.id),
  );

  // ── LOBBY ────────────────────────────────────────────────────────────
  if (room.phase === "lobby") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-start px-4 py-8"
        style={{
          background: "linear-gradient(135deg, #1e3a5f 0%, #1a6b5c 100%)",
        }}
      >
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🔤</div>
          <h1 className="text-4xl font-black text-white">Petit Bac</h1>
          <p className="text-teal-200 text-sm mt-1">
            Trouve le plus vite un mot pour chaque catégorie !
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-2xl p-5 w-full max-w-sm mb-4 text-center border border-white/10">
          <p className="text-xs font-bold text-teal-200 uppercase tracking-widest mb-1">
            Code de la salle
          </p>
          <div className="text-5xl font-black tracking-[0.35em] text-white mb-3">
            {room.code}
          </div>
          <button
            onClick={copyLink}
            className="w-full py-2.5 rounded-xl font-bold text-sm bg-teal-500 hover:bg-teal-400 text-white transition-colors"
          >
            {copied ? "✅ Lien copié !" : "🔗 Copier le lien d'invitation"}
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">
            Partage ce lien pour inviter des amis
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-2xl p-5 w-full max-w-sm mb-4 border border-white/10">
          <p className="text-xs font-bold text-teal-200 uppercase tracking-widest mb-3">
            Joueurs ({room.players.length}/10)
          </p>
          <div className="space-y-2">
            {room.players.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 ${p.id === playerId ? "bg-white/20" : "bg-white/5"}`}
              >
                <span className="text-2xl">{p.avatar}</span>
                <span className="text-white font-semibold flex-1">
                  {p.name}
                </span>
                {room.hostId === p.id && (
                  <span className="text-xs text-yellow-300 font-bold">
                    Chef
                  </span>
                )}
                {!p.isConnected && (
                  <span className="text-xs text-gray-400">déconnecté</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-2xl p-5 w-full max-w-sm mb-4 border border-white/10">
          <p className="text-xs font-bold text-teal-200 uppercase tracking-widest mb-3">
            Catégories ({room.categories.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {room.categories.map((cat) => (
              <span
                key={cat.id}
                className="bg-white/20 text-white text-sm px-3 py-1 rounded-full"
              >
                {cat.name}
              </span>
            ))}
          </div>
        </div>

        {isHost && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-5 w-full max-w-sm mb-4 border border-white/10">
            <p className="text-xs font-bold text-teal-200 uppercase tracking-widest mb-4">
              Configuration
            </p>

            <div className="mb-4">
              <p className="text-sm text-teal-100 font-semibold mb-2">
                Temps par manche
              </p>
              <div className="flex gap-2">
                {[
                  { label: "2 min", value: 120 },
                  { label: "5 min", value: 300 },
                  { label: "Sans limite", value: null },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    onClick={() =>
                      send({ type: "PB_CONFIG", timePerRound: opt.value })
                    }
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${room.timePerRound === opt.value ? "bg-teal-400 text-white" : "bg-white/10 text-teal-100 hover:bg-white/20"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-teal-100 font-semibold mb-2">
                Nombre de manches
              </p>
              <div className="flex gap-2">
                {[5, 10, 15, 20].map((n) => (
                  <button
                    key={n}
                    onClick={() => send({ type: "PB_CONFIG", totalRounds: n })}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${room.totalRounds === n ? "bg-teal-400 text-white" : "bg-white/10 text-teal-100 hover:bg-white/20"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-teal-100 font-semibold mb-2">
                Lettres exclues du tirage
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_LETTERS.map((letter) => {
                  const excluded = room.excludedLetters.includes(letter);
                  return (
                    <button
                      key={letter}
                      onClick={() => {
                        const next = excluded
                          ? room.excludedLetters.filter((l) => l !== letter)
                          : [...room.excludedLetters, letter];
                        send({ type: "PB_CONFIG", excludedLetters: next });
                      }}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition ${excluded ? "bg-red-500/70 text-white/60 line-through" : "bg-white/20 text-white hover:bg-white/30"}`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
              {room.excludedLetters.length > 0 && (
                <p className="text-xs text-teal-300 mt-2">
                  Exclues : {room.excludedLetters.join(", ")}
                </p>
              )}
            </div>

            <div className="mb-2">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm text-teal-100 font-semibold">
                  Catégories en partie
                </p>
                <button
                  onClick={() => setNewCategoryMode((v) => !v)}
                  className="text-xs font-bold text-teal-100 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg"
                >
                  + Catégorie
                </button>
              </div>
              {newCategoryMode && (
                <div className="bg-white/10 rounded-xl p-3 mb-3 border border-white/10">
                  {availableToAdd.length > 0 && (
                    <div className="mb-2">
                      <select
                        value=""
                        onChange={(e) => {
                          const id = Number(e.target.value);
                          if (!id) return;
                          send({ type: "PB_ADD_CATEGORY", categoryId: id });
                          setNewCategoryMode(false);
                        }}
                        className="w-full rounded-lg px-3 py-2 text-sm bg-white text-gray-800"
                      >
                        <option value="">
                          Sélectionner une catégorie existante
                        </option>
                        {availableToAdd.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex gap-2 mt-1">
                    <input
                      value={newCategoryText}
                      onChange={(e) => setNewCategoryText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addCategory()}
                      placeholder="Écrire une nouvelle catégorie"
                      className="flex-1 rounded-lg px-3 py-2 text-sm bg-white text-gray-800"
                    />
                    <button
                      onClick={addCategory}
                      className="bg-teal-400 hover:bg-teal-300 text-white text-sm font-bold px-3 py-2 rounded-lg"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {room.categories.map((cat) => (
                  <span
                    key={cat.id}
                    className="inline-flex items-center gap-2 bg-white/20 text-white text-sm px-3 py-1 rounded-full"
                  >
                    {cat.name}
                    <button
                      onClick={() => removeCategory(cat.id)}
                      className="text-white/70 hover:text-white text-xs"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {!isHost && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 w-full max-w-sm mb-4 border border-white/10 text-sm text-teal-100 space-y-1">
            <div>
              ⏱ Temps :{" "}
              <span className="font-bold text-white">
                {room.timePerRound
                  ? `${room.timePerRound / 60} min`
                  : "Sans limite"}
              </span>
            </div>
            <div>
              🔄 Manches :{" "}
              <span className="font-bold text-white">{room.totalRounds}</span>
            </div>
            {room.excludedLetters.length > 0 && (
              <div>
                🚫 Exclues :{" "}
                <span className="font-bold text-white">
                  {room.excludedLetters.join(", ")}
                </span>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-400/30 text-red-200 rounded-xl px-4 py-2 mb-4 text-sm w-full max-w-sm">
            {error}
          </div>
        )}

        <div className="w-full max-w-sm space-y-3">
          {isHost && (
            <button
              onClick={() => send({ type: "PB_START" })}
              disabled={room.players.length < 2}
              className="w-full py-4 rounded-2xl font-black text-lg bg-teal-400 hover:bg-teal-300 text-white disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg"
            >
              {room.players.length < 2
                ? "En attente de joueurs…"
                : "🚀 Lancer la partie"}
            </button>
          )}
          {!isHost && (
            <div className="text-center text-teal-200 text-sm">
              En attente que le chef lance la partie…
            </div>
          )}
          <button
            onClick={onLeave}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-teal-300 font-semibold text-sm transition-colors mt-2"
          >
            ← Quitter
          </button>
        </div>
      </div>
    );
  }

  // ── PLAYING ─────────────────────────────────────────────────────────
  if (room.phase === "playing") {
    const iDone = me?.hasDone ?? false;
    const donePlayers = room.players.filter((p) => p.hasDone);
    return (
      <div className="min-h-screen bg-gradient-to-b from-teal-900 to-teal-700 px-4 py-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-teal-300 text-sm font-medium">
                Manche {room.currentRound}/{room.totalRounds}
              </span>
              <div className="flex items-center gap-3 mt-1">
                <div className="text-8xl font-black text-white leading-none">
                  {room.currentLetter}
                </div>
              </div>
            </div>
            <div className="text-right text-sm text-teal-200">
              <div>
                {donePlayers.length}/{room.players.length} terminés
              </div>
              {donePlayers.map((p) => (
                <div key={p.id} className="text-xs text-teal-300">
                  ✓ {p.name}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur rounded-2xl p-5 w-full max-w-sm mb-4 text-center border border-white/10">
            <p className="text-xs font-bold text-teal-200 uppercase tracking-widest mb-1">
              Code de la salle
            </p>
            <div className="text-5xl font-black tracking-[0.35em] text-white mb-3">
              {room.code}
            </div>
            <button
              onClick={copyLink}
              className="w-full py-2.5 rounded-xl font-bold text-sm bg-teal-500 hover:bg-teal-400 text-white transition-colors"
            >
              {copied ? "✅ Lien copié !" : "🔗 Copier le lien d'invitation"}
            </button>
            <p className="text-xs text-gray-400 text-center mt-2">
              Partage ce lien pour inviter des amis
            </p>
          </div>

          {room.timePerRound && timeLeft !== null && (
            <TimerBar timeLeft={timeLeft} total={room.timePerRound} />
          )}

          {!iDone ? (
            <div className="space-y-3 mb-6">
              {room.categories.map((cat) => (
                <div
                  key={cat.id}
                  className="bg-white/10 rounded-xl px-4 py-3 border border-white/10"
                >
                  <label className="block text-teal-200 text-xs font-bold uppercase tracking-wider mb-1">
                    {cat.name}
                  </label>
                  <input
                    type="text"
                    value={localAnswers[cat.id] ?? ""}
                    onChange={(e) => handleAnswerChange(cat.id, e.target.value)}
                    placeholder={`${room.currentLetter}…`}
                    maxLength={100}
                    className="w-full bg-transparent text-white text-lg font-semibold placeholder-white/30 outline-none border-b border-white/20 focus:border-teal-300 pb-1 transition"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-teal-500/20 border border-teal-400/30 rounded-2xl p-6 text-center mb-6">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-white font-bold text-lg">Tu as fini !</p>
              <p className="text-teal-200 text-sm mt-1">
                En attente des autres joueurs…
              </p>
            </div>
          )}

          {!iDone && (
            <button
              onClick={handleDone}
              className="w-full py-4 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-yellow-900 font-black text-lg shadow-lg transition mb-3"
            >
              ✋ J'ai fini !
            </button>
          )}
          <button
            onClick={onLeave}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-teal-300 font-semibold text-sm transition-colors mt-2"
          >
            ← Quitter la partie
          </button>
        </div>
      </div>
    );
  }

  // ── VOTING ───────────────────────────────────────────────────────────
  if (room.phase === "voting") {
    const myVotesDone = votingComplete();
    const otherPlayers = room.players.filter((p) => p.id !== playerId);
    const safeIndex = Math.min(votePlayerIndex, otherPlayers.length - 1);
    const currentTarget = otherPlayers[safeIndex];

    const isCurrentPlayerDone = currentTarget
      ? room.categories.every((cat) => {
          const answer = (currentTarget.answers[cat.id] || "").trim();
          if (!answer) return true;
          return getVoteForCat(currentTarget.id, cat.id) !== undefined;
        })
      : true;

    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-900 to-purple-900 px-4 py-6">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-4">
            <div className="text-4xl font-black text-white mb-1">✅ Vote !</div>
            <p className="text-purple-200 text-sm">
              Valide ou invalide les réponses des autres joueurs
            </p>
            <div className="mt-2 text-3xl font-black text-yellow-300">
              Lettre : {room.currentLetter}
            </div>
          </div>

          {otherPlayers.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() =>
                    setVotePlayerIndex((prev) => Math.max(0, prev - 1))
                  }
                  disabled={safeIndex === 0}
                  className="px-3 py-2 rounded-xl bg-white/10 text-white font-bold disabled:opacity-30 hover:bg-white/20 transition text-sm"
                >
                  ←
                </button>
                <div className="text-center">
                  <span className="text-purple-200 text-sm font-medium">
                    Joueur {safeIndex + 1} / {otherPlayers.length}
                  </span>
                  <div className="flex gap-1.5 justify-center mt-1.5">
                    {otherPlayers.map((p, i) => {
                      const done = room.categories.every((cat) => {
                        const answer = (p.answers[cat.id] || "").trim();
                        if (!answer) return true;
                        return getVoteForCat(p.id, cat.id) !== undefined;
                      });
                      return (
                        <button
                          key={p.id}
                          onClick={() => setVotePlayerIndex(i)}
                          className={`w-2.5 h-2.5 rounded-full transition ${i === safeIndex ? "bg-white" : done ? "bg-green-400" : "bg-white/30"}`}
                        />
                      );
                    })}
                  </div>
                </div>
                <button
                  onClick={() =>
                    setVotePlayerIndex((prev) =>
                      Math.min(otherPlayers.length - 1, prev + 1),
                    )
                  }
                  disabled={safeIndex === otherPlayers.length - 1}
                  className="px-3 py-2 rounded-xl bg-white/10 text-white font-bold disabled:opacity-30 hover:bg-white/20 transition text-sm"
                >
                  →
                </button>
              </div>

              {currentTarget && (
                <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/10 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{currentTarget.avatar}</span>
                    <span className="text-white font-bold text-lg">
                      {currentTarget.name}
                    </span>
                    {isCurrentPlayerDone && (
                      <span className="ml-auto text-green-400 text-sm font-bold">
                        ✓ Voté
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {room.categories.map((cat) => {
                      const answer = (
                        currentTarget.answers[cat.id] || ""
                      ).trim();
                      const voted = getVoteForCat(currentTarget.id, cat.id);
                      return (
                        <div
                          key={cat.id}
                          className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-purple-200 text-xs">
                              {cat.name}
                            </div>
                            <div
                              className={`text-sm font-semibold truncate ${answer ? "text-white" : "text-gray-500 italic"}`}
                            >
                              {answer || "(vide — non compté)"}
                            </div>
                          </div>
                          {answer ? (
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() =>
                                  handleVote(currentTarget.id, cat.id, true)
                                }
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${voted === true ? "bg-green-500 text-white" : "bg-white/10 text-green-300 hover:bg-green-500/30"}`}
                              >
                                ✓
                              </button>
                              <button
                                onClick={() =>
                                  handleVote(currentTarget.id, cat.id, false)
                                }
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${voted === false ? "bg-red-500 text-white" : "bg-white/10 text-red-300 hover:bg-red-500/30"}`}
                              >
                                ✗
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-xs shrink-0">
                              auto ✗
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {isCurrentPlayerDone &&
                    safeIndex < otherPlayers.length - 1 && (
                      <button
                        onClick={() => setVotePlayerIndex((prev) => prev + 1)}
                        className="w-full mt-3 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-sm transition"
                      >
                        Joueur suivant →
                      </button>
                    )}
                </div>
              )}
            </>
          )}

          {myVotesDone ? (
            <div className="bg-white/10 border border-white/20 rounded-2xl p-4 text-center text-purple-200">
              ✅ Votes envoyés. En attente des autres…
            </div>
          ) : (
            <div className="text-center text-purple-300 text-sm">
              Vote sur toutes les réponses pour continuer
            </div>
          )}

          <button
            onClick={onLeave}
            className="w-full py-2 mt-4 rounded-2xl font-bold text-sm text-white/40 hover:text-white/80 transition"
          >
            ← Quitter la partie
          </button>
        </div>
      </div>
    );
  }

  // ── SCORES ───────────────────────────────────────────────────────────
  if (room.phase === "scores") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-900 to-teal-900 px-4 py-6">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-6">
            <div className="text-4xl font-black text-white mb-1">
              📊 Résultats manche {room.currentRound}
            </div>
            <div className="text-2xl font-bold text-yellow-300">
              Lettre : {room.currentLetter}
            </div>
          </div>

          <div className="space-y-4 mb-6">
            {room.players.map((player) => {
              const rs = room.roundScores.find((r) => r.playerId === player.id);
              return (
                <div
                  key={player.id}
                  className={`bg-white/10 rounded-2xl p-4 border ${player.id === playerId ? "border-yellow-400/50" : "border-white/10"}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{player.avatar}</span>
                    <span className="text-white font-bold flex-1">
                      {player.name}
                    </span>
                    <span className="text-yellow-300 font-black text-lg">
                      +{rs?.roundTotal ?? 0} pts
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {room.categories.map((cat) => {
                      const answer = (player.answers[cat.id] || "").trim();
                      const score = rs?.scoresByCat[cat.id] ?? 0;
                      return (
                        <div
                          key={cat.id}
                          className={`rounded-lg px-2 py-1.5 text-xs ${score === 10 ? "bg-green-500/30" : score === 5 ? "bg-yellow-500/20" : "bg-white/5"}`}
                        >
                          <div className="text-gray-400 truncate">
                            {cat.name}
                          </div>
                          <div
                            className={`font-semibold truncate ${answer ? "text-white" : "text-gray-500 italic"}`}
                          >
                            {answer || "(vide)"}
                          </div>
                          {answer && (
                            <div
                              className={`font-bold ${score === 2 ? "text-green-400" : score === 1 ? "text-yellow-400" : "text-red-400"}`}
                            >
                              {score === 2
                                ? "✓ unique +2"
                                : score === 1
                                  ? "✓ partagé +1"
                                  : "✗ +0"}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white/10 rounded-2xl p-4 mb-6 border border-white/10">
            <p className="text-xs font-bold text-teal-200 uppercase tracking-widest mb-3">
              Classement général
            </p>
            {sortedPlayers.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 py-1.5 ${p.id === playerId ? "text-yellow-300" : "text-white"}`}
              >
                <span className="text-lg font-black w-6">
                  {i === 0
                    ? "🥇"
                    : i === 1
                      ? "🥈"
                      : i === 2
                        ? "🥉"
                        : `${i + 1}.`}
                </span>
                <span className="text-lg">{p.avatar}</span>
                <span className="flex-1 font-semibold">{p.name}</span>
                <span className="font-black">
                  {room.totalScores[p.id] ?? 0} pts
                </span>
              </div>
            ))}
          </div>

          {isHost ? (
            <button
              onClick={() => send({ type: "PB_NEXT_ROUND" })}
              className="w-full py-4 rounded-2xl bg-teal-400 hover:bg-teal-300 text-white font-black text-lg shadow-lg transition mb-3"
            >
              ▶️ Manche suivante ({room.currentRound + 1}/{room.totalRounds})
            </button>
          ) : (
            <div className="text-center text-teal-200 text-sm mb-3">
              En attente que le chef lance la manche suivante…
            </div>
          )}
          <button
            onClick={onLeave}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-teal-300 font-semibold text-sm transition-colors mt-2"
          >
            ← Quitter la partie
          </button>
        </div>
      </div>
    );
  }

  // ── GAME OVER ────────────────────────────────────────────────────────
  if (room.phase === "game-over") {
    const winner = sortedPlayers[0];
    return (
      <div className="min-h-screen bg-gradient-to-b from-yellow-900 to-orange-900 px-4 py-6">
        <div className="max-w-lg mx-auto text-center">
          <div className="text-7xl mb-4">🏆</div>
          <h1 className="text-4xl font-black text-white mb-2">
            Fin de partie !
          </h1>
          {winner && (
            <div className="bg-yellow-400/20 border border-yellow-400/40 rounded-2xl p-4 mb-6">
              <p className="text-yellow-200 text-sm font-medium">Vainqueur</p>
              <div className="text-5xl mt-1">{winner.avatar}</div>
              <div className="text-2xl font-black text-white mt-1">
                {winner.name}
              </div>
              <div className="text-yellow-300 font-bold">
                {room.totalScores[winner.id] ?? 0} points
              </div>
            </div>
          )}
          <div className="bg-white/10 rounded-2xl p-4 mb-6 border border-white/10">
            <p className="text-xs font-bold text-orange-200 uppercase tracking-widest mb-3">
              Classement final
            </p>
            {sortedPlayers.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 py-1.5 ${p.id === playerId ? "text-yellow-300" : "text-white"}`}
              >
                <span className="text-lg font-black w-6">
                  {i === 0
                    ? "🥇"
                    : i === 1
                      ? "🥈"
                      : i === 2
                        ? "🥉"
                        : `${i + 1}.`}
                </span>
                <span className="text-lg">{p.avatar}</span>
                <span className="flex-1 font-semibold">{p.name}</span>
                <span className="font-black">
                  {room.totalScores[p.id] ?? 0} pts
                </span>
              </div>
            ))}
          </div>
          {isHost && (
            <button
              onClick={() => send({ type: "PB_RESET" })}
              className="w-full py-4 rounded-2xl bg-orange-400 hover:bg-orange-300 text-white font-black text-lg shadow-lg transition mb-3"
            >
              🔄 Rejouer
            </button>
          )}
          <button
            onClick={onLeave}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-teal-300 font-semibold text-sm transition-colors mt-2"
          >
            ← Quitter
          </button>
        </div>
      </div>
    );
  }

  return null;
}
