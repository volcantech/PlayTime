import { useState, useEffect, useMemo, useRef } from "react";
import type { GameRoom, SendMessage } from "../hooks/useWebSocket";

interface PlayingProps {
  room: GameRoom;
  playerId: string;
  send: SendMessage;
  error: string | null;
  onLeave: () => void;
}

function formatQuestion(text: string, answer?: string): React.ReactNode {
  const blank = answer
    ? <span className="font-black px-1" style={{ color: "#ff2e7a", borderBottom: "2px solid #ff2e7a" }}>{answer}</span>
    : <span className="inline-block w-24 border-b-2 border-white/40 align-middle" />;

  const parts = text.split("_____");
  return (
    <>
      {parts[0]}{blank}{parts[1] || ""}
    </>
  );
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

function PlayersDropdown({ room, playerId, send }: { room: GameRoom; playerId: string; send: SendMessage }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isHost = room.hostId === playerId;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs font-black py-2 px-3 rounded-full transition-all"
        style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.85)" }}
      >
        <span>👥</span>
        <span>{room.players.length}</span>
        <span className="text-white/40">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 rounded-2xl overflow-hidden min-w-[210px] z-50 shadow-2xl"
          style={{ background: "rgba(15,10,40,0.97)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(20px)" }}
        >
          <div className="px-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="section-eyebrow">Joueurs · {room.players.length}</span>
          </div>
          {room.players.map((p) => {
            const medals = ["🥇", "🥈", "🥉"];
            const sorted = [...room.players].sort((a, b) => b.score - a.score);
            const rank = sorted.findIndex(s => s.id === p.id);
            const qmIdx = room.questionMasterIndex;
            const isQM = room.players[qmIdx]?.id === p.id;
            return (
              <div key={p.id} className="flex items-center gap-2 px-4 py-2.5">
                <span className="text-base">{p.avatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-black text-white truncate">{p.name}</span>
                    {isQM && <span className="text-[0.6rem] font-black px-1.5 rounded-full ml-1"
                                    style={{ background: "rgba(255,217,61,0.20)", color: "#fde047", border: "1px solid rgba(255,217,61,0.40)" }}>QM</span>}
                    {p.id === playerId && <span className="text-[0.6rem] text-white/40 ml-1 font-bold">toi</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs">{medals[rank] ?? `#${rank + 1}`}</span>
                    <span className="text-xs font-black" style={{ color: "#ff2e7a" }}>{p.score} pts</span>
                    {!p.isConnected && <span className="text-xs text-white/30">⚪</span>}
                  </div>
                </div>
                {isHost && p.id !== playerId && (
                  <button
                    onClick={() => { send({ type: "KICK_PLAYER", targetPlayerId: p.id }); setOpen(false); }}
                    className="text-[0.65rem] px-2 py-1 rounded-lg font-black transition-colors flex-shrink-0"
                    style={{ color: "#fca5a5", background: "rgba(239,68,68,0.12)" }}
                    title={`Exclure ${p.name}`}
                  >Exclure</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Playing({ room, playerId, send, error, onLeave }: PlayingProps) {
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [blankText, setBlankText] = useState("");
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    setSelectedCardId(null);
    setSubmitted(false);
    setBlankText("");
    setHasVoted(false);
  }, [room.roundNumber, room.phase]);

  const qmPlayer = room.players[room.questionMasterIndex];
  const isQM = qmPlayer?.id === playerId;
  const me = room.players.find(p => p.id === playerId);
  const myHand = me?.hand || [];
  const mySubmission = room.submissions.find(s => s._realPlayerId === playerId || s.playerId === playerId);
  const hasSubmitted = me?.submittedCardId !== null || !!mySubmission;
  const isDemocratic = room.voteMode === "democratic";

  const selectedCard = myHand.find(c => c.id === selectedCardId);
  const isBlankCardSelected = selectedCard?.isBlank === true;

  const submitAnswer = () => {
    if (selectedCardId === null) return;
    if (isBlankCardSelected && !blankText.trim()) return;
    setSubmitted(true);
    send({
      type: "SUBMIT_ANSWER",
      cardId: selectedCardId,
      ...(isBlankCardSelected ? { customText: blankText.trim() } : {}),
    });
  };

  const pickWinner = (winnerId: string) => {
    send({ type: "PICK_WINNER", winnerId });
  };

  const vote = (cardId: number) => {
    if (hasVoted) return;
    setHasVoted(true);
    send({ type: "BMC_VOTE", cardId });
  };

  const shuffledSubmissions = useMemo(() => {
    const arr = [...room.submissions];
    if (arr.length === 0) return arr;
    let seed = room.roundNumber * 1664525 + 1013904223;
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
      const j = seed % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [room.submissions, room.roundNumber]);

  const submittedCount = room.submissions.length;
  const totalPlayers = isDemocratic
    ? room.players.filter(p => p.isConnected).length
    : room.players.filter(p => p.id !== qmPlayer?.id && p.isConnected).length;

  const myVoteTarget = room.myVote;
  const voteCount = room.voteCount ?? 0;

  if (room.phase === "round-result") {
    return <RoundResult room={room} playerId={playerId} send={send} />;
  }

  return (
    <div className="bg-party min-h-screen flex flex-col relative">
      <div className="party-cards-layer" />

      {/* Header */}
      <div className="relative z-10" style={{ background: "rgba(0,0,0,0.30)", borderBottom: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(14px)" }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                 style={{ background: "rgba(255,46,122,0.15)", border: "1px solid rgba(255,46,122,0.30)" }}>
              <span className="text-xs font-black" style={{ color: "#ff7eb0" }}>🃏 Tour {room.roundNumber}</span>
            </div>
            {isDemocratic && (
              <span className="text-[0.65rem] px-2.5 py-1 rounded-full font-black"
                    style={{ background: "rgba(168,85,247,0.18)", color: "#c4b5fd", border: "1px solid rgba(168,85,247,0.35)" }}>
                🗳️ Vote
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PlayersDropdown room={room} playerId={playerId} send={send} />
            <button
              onClick={onLeave}
              className="text-sm font-black py-2 px-3 rounded-full transition-colors"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.65)" }}
              title="Quitter"
            >🚪</button>
          </div>
        </div>
      </div>

      {/* Question Master + Question */}
      <div className="px-4 pt-6 pb-2 relative z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-2xl">{qmPlayer?.avatar || "🐱"}</span>
            <span className="text-white font-black">{qmPlayer?.name}</span>
            <span className="text-[0.65rem] px-2.5 py-1 rounded-full font-black"
                  style={{ background: "rgba(255,217,61,0.18)", color: "#fde047", border: "1px solid rgba(255,217,61,0.35)" }}>
              {isDemocratic ? "🎭 Animateur" : "👑 Question Master"}
            </span>
          </div>

          {/* Question card */}
          <div
            className="card-jb p-6 sm:p-7 mb-5 relative overflow-hidden"
            data-testid="question-card"
            style={{ borderColor: "rgba(255,46,122,0.30)" }}
          >
            <div className="pointer-events-none absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-30 blur-3xl"
                 style={{ background: "rgba(255,46,122,0.55)" }} />
            <div className="relative">
              <p className="section-eyebrow mb-2" style={{ color: "rgba(255,126,176,0.85)" }}>Question</p>
              <p className="text-white text-xl sm:text-2xl font-black leading-snug" style={{ fontFamily: "Fredoka, system-ui, sans-serif" }}>
                {room.currentQuestion ? formatQuestion(room.currentQuestion.text) : "..."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Phase: Submit */}
      {room.phase === "playing-submit" && (
        <div className="flex-1 flex flex-col px-4 pb-6 relative z-10">
          <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
            {(isQM && !isDemocratic) ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <div className="text-6xl mb-3 float-y">⏳</div>
                <h3 className="title-display text-white text-2xl mb-2">Patience...</h3>
                <p className="text-white/55 font-bold text-sm mb-5">Les joueurs choisissent leur meilleure réponse</p>
                <div className="card-jb px-7 py-4 mb-5">
                  <div className="title-display text-white text-4xl">{submittedCount}<span className="text-white/40">/{totalPlayers}</span></div>
                  <div className="text-xs text-white/45 font-black uppercase tracking-widest mt-1">soumises</div>
                </div>
                <div className="space-y-2 w-full max-w-md">
                  {room.players.filter(p => p.id !== qmPlayer?.id).map((p) => {
                    const sub = room.submissions.find(s => s.playerId === p.id);
                    return (
                      <div key={p.id} className="flex items-center gap-2 rounded-2xl px-4 py-2.5"
                           style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}>
                        <span className="text-lg">{p.avatar || "🐱"}</span>
                        <span className="text-white font-bold text-sm flex-1">{p.name}</span>
                        {sub
                          ? <span className="text-xs font-black" style={{ color: "#86efac" }}>✅ Soumis</span>
                          : <span className="text-xs text-white/30 font-bold">⏳ En cours...</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : hasSubmitted ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <div className="text-6xl mb-3 wiggle-on-hover">✅</div>
                <h3 className="title-display text-white text-2xl mb-2">Réponse soumise !</h3>
                <p className="text-white/55 font-bold text-sm mb-5">
                  En attente {isDemocratic ? "de tout le monde" : "des autres joueurs"}... ({submittedCount}/{totalPlayers})
                </p>
                <div className="space-y-2 w-full max-w-md">
                  {room.players.filter(p => isDemocratic ? true : p.id !== qmPlayer?.id).map((p) => {
                    const sub = isDemocratic
                      ? room.submissions.find(s => s._realPlayerId === p.id || s.playerId === p.id)
                      : room.submissions.find(s => s.playerId === p.id);
                    return (
                      <div key={p.id} className="flex items-center gap-2 rounded-2xl px-4 py-2.5"
                           style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}>
                        <span className="text-lg">{p.avatar || "🐱"}</span>
                        <span className="text-white font-bold text-sm flex-1">{p.name}</span>
                        {isDemocratic && p.id === qmPlayer?.id && <span className="text-xs text-yellow-300/80">🎭</span>}
                        {sub
                          ? <span className="text-xs font-black" style={{ color: "#86efac" }}>✅</span>
                          : <span className="text-xs text-white/30 font-bold">⏳</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <p className="section-eyebrow text-center mb-3">
                  Choisis ta meilleure réponse · {myHand.length} cartes
                </p>
                {error && (
                  <div className="rounded-2xl px-4 py-3 mb-3 text-sm font-bold"
                       style={{ background: "rgba(239,68,68,0.18)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.35)" }}
                       data-testid="error-message">
                    ⚠️ {error}
                  </div>
                )}
                <div className="space-y-2.5 mb-5">
                  {myHand.map(card => {
                    const sel = selectedCardId === card.id;
                    return (
                      <button
                        key={card.id}
                        data-testid={`hand-card-${card.id}`}
                        onClick={() => { setSelectedCardId(card.id); setBlankText(""); }}
                        className="w-full text-left p-4 rounded-2xl transition-all font-bold text-base"
                        style={sel ? {
                          background: "linear-gradient(180deg, #fff 0%, #fef9c3 100%)",
                          color: "#1a0533",
                          border: "2px solid #ff2e7a",
                          boxShadow: "0 8px 0 0 rgba(255,46,122,0.40), 0 14px 30px -8px rgba(255,46,122,0.55), inset 0 1px 0 0 rgba(255,255,255,0.6)",
                          transform: "translateY(-2px)",
                        } : {
                          background: "rgba(255,255,255,0.06)",
                          color: "#fff",
                          border: "1px solid rgba(255,255,255,0.14)",
                        }}
                      >
                        {card.text}
                      </button>
                    );
                  })}
                </div>
                {isBlankCardSelected && (
                  <div className="mb-5">
                    <p className="section-eyebrow mb-2">✍️ Écris ta réponse</p>
                    <textarea
                      autoFocus
                      maxLength={200}
                      value={blankText}
                      onChange={e => setBlankText(e.target.value)}
                      placeholder="Tape ta réponse ici..."
                      rows={3}
                      className="jb-input resize-none"
                      style={{ background: "#fff", color: "#1a0533" }}
                    />
                    <div className="text-right text-xs text-white/40 mt-1 font-bold">{blankText.length}/200</div>
                  </div>
                )}
                <button
                  data-testid="submit-answer"
                  onClick={submitAnswer}
                  disabled={selectedCardId === null || submitted || (isBlankCardSelected && !blankText.trim())}
                  className="btn-jb w-full"
                  style={{ fontSize: "1.1rem", padding: "1.05rem 1.6rem" }}
                >
                  {submitted ? "⏳ En cours..." : "🎯 Soumettre cette carte !"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Phase: Judge (classic mode) */}
      {room.phase === "playing-judge" && (
        <div className="flex-1 flex flex-col px-4 pb-6 relative z-10">
          <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
            {isQM ? (
              <>
                <h3 className="title-display text-white text-xl text-center mb-1">
                  👑 Choisis la plus drôle !
                </h3>
                <p className="text-white/45 text-xs text-center font-bold mb-5">🙈 Vote à l'aveugle — l'ordre est mélangé</p>
                {error && (
                  <div className="rounded-2xl px-4 py-3 mb-3 text-sm font-bold"
                       style={{ background: "rgba(239,68,68,0.18)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.35)" }}
                       data-testid="error-message">
                    ⚠️ {error}
                  </div>
                )}
                <div className="space-y-3.5">
                  {shuffledSubmissions.map((submission, i) => (
                    <div key={submission.playerId}
                         className="rounded-3xl p-5 shadow-2xl"
                         style={{
                           background: "linear-gradient(180deg, #fff 0%, #fef9c3 100%)",
                           border: "1px solid rgba(255,255,255,0.4)",
                           boxShadow: "0 14px 32px -10px rgba(0,0,0,0.45), inset 0 1px 0 0 rgba(255,255,255,0.6)",
                         }}>
                      <div className="text-xs font-black mb-1.5 uppercase tracking-widest" style={{ color: "#ff2e7a" }}>
                        Réponse {i + 1}
                      </div>
                      <p className="font-black text-base mb-2.5" style={{ color: "#1a0533" }}>{submission.card.text}</p>
                      <div className="text-xs italic mb-4" style={{ color: "#6b7280" }}>
                        {room.currentQuestion ? formatQuestion(room.currentQuestion.text, submission.card.text) : ""}
                      </div>
                      <button
                        data-testid={`pick-winner-${submission.playerId}`}
                        onClick={() => pickWinner(submission.playerId)}
                        className="btn-jb w-full"
                        style={{ padding: "0.85rem 1.4rem", fontSize: "0.95rem" }}
                      >
                        🏆 Choisir cette réponse
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center text-center py-4">
                <div className="text-6xl mb-3 float-y">🤔</div>
                <h3 className="title-display text-white text-2xl mb-2">{qmPlayer?.name} choisit...</h3>
                <p className="text-white/55 font-bold text-sm mb-5">Toutes les réponses sont révélées !</p>
                <div className="space-y-2.5 w-full">
                  {room.submissions.map((submission, i) => (
                    <div key={i}
                         className="rounded-2xl p-4 text-left"
                         style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                      <div className="text-xs font-black mb-1 uppercase tracking-widest" style={{ color: "rgba(255,126,176,0.7)" }}>
                        Réponse {i + 1}
                      </div>
                      <p className="text-white font-bold text-sm">{submission.card.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Phase: Vote démocratique */}
      {room.phase === "playing-vote" && (
        <div className="flex-1 flex flex-col px-4 pb-6 relative z-10">
          <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
            <div className="text-center mb-5">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl mb-3"
                   style={{ background: "rgba(168,85,247,0.18)", border: "1px solid rgba(168,85,247,0.40)" }}>
                <span style={{ color: "#c4b5fd" }}>🗳️</span>
                <span className="text-sm font-black" style={{ color: "#c4b5fd" }}>
                  Vote pour la meilleure réponse !
                </span>
              </div>
              <p className="text-white/45 text-xs font-bold">Tu ne peux pas voter pour ta propre carte — anonyme</p>
              {!hasVoted && !myVoteTarget && (
                <div className="mt-2 text-xs text-white/35 font-bold">
                  {voteCount}/{room.submissions.length} votes reçus
                </div>
              )}
            </div>

            {hasVoted || myVoteTarget ? (
              <div className="flex-1 flex flex-col items-center text-center py-4">
                <div className="text-6xl mb-3 wiggle-on-hover">✅</div>
                <h3 className="title-display text-white text-2xl mb-2">Vote enregistré !</h3>
                <p className="text-white/55 font-bold text-sm mb-4">En attente des autres joueurs...</p>
                <div className="card-jb px-7 py-4 mb-5">
                  <div className="title-display text-white text-4xl">{voteCount}<span className="text-white/40">/{room.submissions.length}</span></div>
                  <div className="text-xs text-white/45 font-black uppercase tracking-widest mt-1">votes</div>
                </div>
                <div className="space-y-2.5 w-full">
                  {shuffledSubmissions.map((sub, i) => (
                    <div key={i} className="rounded-2xl p-4 text-left"
                         style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}>
                      <div className="text-xs font-black mb-1 uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.40)" }}>Réponse {i + 1}</div>
                      <p className="text-white font-bold text-sm">{sub.card.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {error && (
                  <div className="rounded-2xl px-4 py-3 mb-3 text-sm font-bold"
                       style={{ background: "rgba(239,68,68,0.18)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.35)" }}>
                    ⚠️ {error}
                  </div>
                )}
                <div className="space-y-3.5">
                  {shuffledSubmissions.map((sub, i) => {
                    const isMyOwnCard = sub._realPlayerId === playerId;
                    return (
                      <div key={i}
                           className="rounded-3xl p-5"
                           style={{
                             background: "linear-gradient(180deg, #fff 0%, #fef9c3 100%)",
                             opacity: isMyOwnCard ? 0.45 : 1,
                             boxShadow: "0 14px 32px -10px rgba(0,0,0,0.45), inset 0 1px 0 0 rgba(255,255,255,0.6)",
                           }}>
                        <div className="text-xs font-black mb-1.5 uppercase tracking-widest" style={{ color: "#a855f7" }}>
                          Réponse {i + 1}
                        </div>
                        <p className="font-black text-base mb-2.5" style={{ color: "#1a0533" }}>{sub.card.text}</p>
                        <div className="text-xs italic mb-3.5" style={{ color: "#6b7280" }}>
                          {room.currentQuestion ? formatQuestion(room.currentQuestion.text, sub.card.text) : ""}
                        </div>
                        {isMyOwnCard ? (
                          <div className="w-full py-2.5 rounded-xl text-center text-xs font-black"
                               style={{ background: "rgba(0,0,0,0.08)", color: "#6b7280" }}>
                            🙈 C'est ta carte
                          </div>
                        ) : (
                          <button
                            onClick={() => vote(sub.cardId)}
                            disabled={hasVoted}
                            className="btn-jb btn-jb-purple w-full"
                            style={{ padding: "0.85rem 1.4rem", fontSize: "0.95rem" }}
                          >
                            🗳️ Voter pour cette réponse
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RoundResult({ room, playerId, send }: { room: GameRoom; playerId: string; send: SendMessage }) {
  const winner = room.players.find(p => p.id === room.lastWinnerId);
  const winnerCard = room.submissions.find(s => s.playerId === room.lastWinnerId || s._realPlayerId === room.lastWinnerId)?.card
    || (room.lastWinnerCardId ? { id: room.lastWinnerCardId, text: "..." } : null);
  const qmPlayer = room.players[room.questionMasterIndex];
  const isQM = qmPlayer?.id === playerId;
  const roundResultRemaining = useCountdown(room.roundResultEndsAt ?? null);
  const isDemocratic = room.voteMode === "democratic";

  return (
    <div className="bg-party-warm min-h-screen overflow-y-auto relative">
      <div className="party-cards-layer" />

      <div className="relative z-10 max-w-md mx-auto px-4 pt-10 pb-8 text-center">
        {/* Winner header */}
        <div className="mb-5 relative">
          <div className="absolute inset-0 bg-confetti opacity-30 pointer-events-none" />
          <div className="relative">
            <div className="text-7xl mb-2 animate-bounce" style={{ filter: "drop-shadow(0 10px 30px rgba(255,217,61,0.5))" }}>🎉</div>
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl mb-3 text-6xl"
                 style={{
                   background: "linear-gradient(135deg, rgba(255,46,122,0.25), rgba(168,85,247,0.20))",
                   border: "2px solid rgba(255,255,255,0.30)",
                   boxShadow: "0 14px 40px -10px rgba(255,46,122,0.55)",
                 }}>
              {winner?.avatar || "🎉"}
            </div>
            <h3 className="title-display text-3xl mb-1" style={{
              background: "linear-gradient(180deg, #fff, #fde047, #ff2e7a)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              {winner?.name}
            </h3>
            <p className="title-display text-2xl text-white mb-1">gagne ce tour !</p>
            {isDemocratic && <p className="text-xs text-white/55 font-bold mb-1">🗳️ Élu par les votes</p>}
            <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.65)" }}>
              Score : <span className="text-white">{winner?.score}</span> / {room.targetScore} pts
            </p>
          </div>
        </div>

        {winnerCard && (
          <div className="rounded-3xl p-5 mb-5 text-left"
               style={{
                 background: "linear-gradient(180deg, #fff 0%, #fef9c3 100%)",
                 boxShadow: "0 14px 32px -10px rgba(0,0,0,0.45), inset 0 1px 0 0 rgba(255,255,255,0.6)",
                 border: "2px solid rgba(255,255,255,0.30)",
               }}>
            <div className="text-xs font-black mb-1.5 text-center uppercase tracking-widest" style={{ color: "#ff2e7a" }}>
              La meilleure réponse
            </div>
            <p className="font-black text-lg text-center mb-2" style={{ color: "#1a0533" }}>"{winnerCard.text}"</p>
            {room.currentQuestion && (
              <div className="text-sm italic text-center" style={{ color: "#6b7280" }}>
                {formatQuestion(room.currentQuestion.text, winnerCard.text)}
              </div>
            )}
          </div>
        )}

        {/* Scores */}
        <div className="card-jb p-4 mb-5">
          <p className="section-eyebrow mb-2.5">Classement</p>
          <div className="space-y-1.5">
            {room.players
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((p, i) => (
                <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl"
                     style={i === 0 ? { background: "rgba(255,217,61,0.12)", border: "1px solid rgba(255,217,61,0.30)" } : {}}>
                  <span className="text-base w-6 text-center shrink-0 font-black">{["🥇", "🥈", "🥉"][i] || `${i + 1}.`}</span>
                  <span className="text-xl shrink-0">{p.avatar || "🐱"}</span>
                  <span className="text-sm font-bold flex-1 text-left truncate text-white">{p.name}</span>
                  <span className="title-display shrink-0" style={{ color: i === 0 ? "#fde047" : "rgba(255,255,255,0.7)" }}>
                    {p.score} pts
                  </span>
                </div>
              ))}
          </div>
        </div>

        {isQM ? (
          <button
            data-testid="next-round"
            onClick={() => send({ type: "NEXT_ROUND" })}
            className="btn-jb w-full"
            style={{ fontSize: "1.15rem", padding: "1.1rem 1.6rem" }}
          >
            ▶️ Tour suivant !
          </button>
        ) : (
          <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.65)" }}>
            ⏳ En attente que <span className="text-white">{qmPlayer?.name}</span> lance le tour suivant...
          </p>
        )}
        {room.roundResultEndsAt && (
          <p className="text-xs mt-3 font-black" style={{ color: "#c4b5fd" }}>
            ⏱️ Tour suivant automatique dans {roundResultRemaining}s
          </p>
        )}
      </div>
    </div>
  );
}
