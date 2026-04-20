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
    ? <span className="font-black" style={{ color: "#e91e63", borderBottom: "2px solid #e91e63" }}>{answer}</span>
    : <span className="inline-block w-24 border-b-2 border-gray-400 align-middle" />;

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
        className="flex items-center gap-1.5 text-xs font-bold py-1.5 px-3 rounded-xl transition-all"
        style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}
      >
        <span>👥</span>
        <span>{room.players.length}</span>
        <span className="text-white/25">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 rounded-2xl overflow-hidden min-w-[190px] z-50 shadow-2xl"
          style={{ background: "rgba(10,10,30,0.97)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)" }}
        >
          <div className="px-4 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <span className="text-xs font-bold text-white/30 uppercase tracking-widest">Joueurs</span>
          </div>
          {room.players.map((p, i) => {
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
                    <span className="text-sm font-semibold text-white truncate">{p.name}</span>
                    {isQM && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 rounded-full font-bold ml-1">QM</span>}
                    {p.id === playerId && <span className="text-xs text-white/25 ml-1">toi</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs">{medals[rank] ?? `#${rank + 1}`}</span>
                    <span className="text-xs font-black" style={{ color: "#e91e63" }}>{p.score} pts</span>
                    {!p.isConnected && <span className="text-xs text-white/25">⚪</span>}
                  </div>
                </div>
                {isHost && p.id !== playerId && (
                  <button
                    onClick={() => { send({ type: "KICK_PLAYER", targetPlayerId: p.id }); setOpen(false); }}
                    className="text-xs px-2 py-1 rounded-lg font-bold transition-colors flex-shrink-0"
                    style={{ color: "#f87171", background: "rgba(239,68,68,0.1)" }}
                    title={`Exclure ${p.name}`}
                  >
                    Exclure
                  </button>
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

  const vote = (targetPlayerId: string) => {
    if (hasVoted) return;
    setHasVoted(true);
    send({ type: "BMC_VOTE", targetPlayerId });
  };

  // Shuffle submissions for QM so player identity can't be inferred from order
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

  const BG = "linear-gradient(135deg, #07071a 0%, #1a0828 50%, #070f1a 100%)";

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: BG }}>
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 35% at 50% 0%, rgba(233,30,99,0.2), transparent 65%)" }}
      />

      {/* Header */}
      <div className="px-4 py-3 relative z-10" style={{ background: "rgba(0,0,0,0.35)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <div>
              <span className="text-xs text-white/30 font-semibold uppercase tracking-wide">Tour {room.roundNumber}</span>
              {isDemocratic && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background: "rgba(168,85,247,0.2)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.3)" }}>
                  🗳️ Vote
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PlayersDropdown room={room} playerId={playerId} send={send} />
            <button
              onClick={onLeave}
              className="text-xs font-semibold py-1.5 px-3 rounded-xl transition-colors"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}
            >
              🚪
            </button>
          </div>
        </div>
      </div>

      {/* Question Master + Question */}
      <div className="px-4 pt-5 pb-2 relative z-10">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">{qmPlayer?.avatar || "🐱"}</span>
            <span className="text-white font-bold text-sm">{qmPlayer?.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-black"
              style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>
              {isDemocratic ? "🎭 Animateur" : "Question Master"}
            </span>
          </div>

          {/* Question card */}
          <div
            className="rounded-2xl p-5 mb-4 shadow-2xl"
            style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(233,30,99,0.2)", backdropFilter: "blur(10px)" }}
            data-testid="question-card"
          >
            <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(233,30,99,0.7)" }}>Question</div>
            <p className="text-white text-lg font-bold leading-relaxed">
              {room.currentQuestion ? formatQuestion(room.currentQuestion.text) : "..."}
            </p>
          </div>
        </div>
      </div>

      {/* Phase: Submit */}
      {room.phase === "playing-submit" && (
        <div className="flex-1 flex flex-col px-4 pb-4 relative z-10">
          <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
            {(isQM && !isDemocratic) ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <div className="text-5xl mb-3">⏳</div>
                <h3 className="text-white font-black text-xl mb-2">C'est le moment de patienter !</h3>
                <p className="text-white/40 text-sm">Les joueurs choisissent leur meilleure réponse...</p>
                <div className="mt-5 rounded-2xl px-6 py-4" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="text-3xl font-black text-white">{submittedCount}/{totalPlayers}</div>
                  <div className="text-xs text-white/30 mt-1">réponses soumises</div>
                </div>
                <div className="mt-4 space-y-2 w-full">
                  {room.players.filter(p => p.id !== qmPlayer?.id).map((p) => {
                    const sub = room.submissions.find(s => s.playerId === p.id);
                    return (
                      <div key={p.id} className="flex items-center gap-2 rounded-xl px-3 py-2"
                        style={{ background: "rgba(255,255,255,0.05)" }}>
                        <span>{p.avatar || "🐱"}</span>
                        <span className="text-white text-sm font-semibold flex-1">{p.name}</span>
                        {sub
                          ? <span className="text-xs font-bold" style={{ color: "#4ade80" }}>✅ Soumis</span>
                          : <span className="text-xs text-white/25">⏳</span>
                        }
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : hasSubmitted ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <div className="text-5xl mb-3">✅</div>
                <h3 className="text-white font-black text-xl mb-2">Réponse soumise !</h3>
                <p className="text-white/40 text-sm mb-5">
                  {isDemocratic ? "En attente de tout le monde..." : "En attente des autres joueurs..."} ({submittedCount}/{totalPlayers})
                </p>
                <div className="space-y-2 w-full">
                  {room.players.filter(p => isDemocratic ? true : p.id !== qmPlayer?.id).map((p) => {
                    const sub = isDemocratic
                      ? room.submissions.find(s => s._realPlayerId === p.id || s.playerId === p.id)
                      : room.submissions.find(s => s.playerId === p.id);
                    return (
                      <div key={p.id} className="flex items-center gap-2 rounded-xl px-3 py-2"
                        style={{ background: "rgba(255,255,255,0.05)" }}>
                        <span>{p.avatar || "🐱"}</span>
                        <span className="text-white text-sm font-semibold flex-1">{p.name}</span>
                        {isDemocratic && p.id === qmPlayer?.id && <span className="text-xs text-yellow-400/70">🎭</span>}
                        {sub
                          ? <span className="text-xs font-bold" style={{ color: "#4ade80" }}>✅</span>
                          : <span className="text-xs text-white/25">⏳</span>
                        }
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <p className="text-white/50 text-sm font-semibold mb-3 text-center">
                  Choisis ta meilleure réponse ! ({myHand.length} cartes en main)
                </p>
                {error && (
                  <div className="rounded-xl px-4 py-2.5 mb-3 text-sm font-semibold"
                    style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
                    data-testid="error-message">
                    ⚠️ {error}
                  </div>
                )}
                <div className="space-y-2 mb-4">
                  {myHand.map(card => (
                    <button
                      key={card.id}
                      data-testid={`hand-card-${card.id}`}
                      onClick={() => { setSelectedCardId(card.id); setBlankText(""); }}
                      className={`w-full text-left p-4 rounded-xl transition-all font-semibold text-sm ${
                        selectedCardId === card.id
                          ? "bg-white text-gray-900 shadow-lg"
                          : "bg-white/10 text-white hover:bg-white/15"
                      }`}
                      style={selectedCardId === card.id ? {
                        boxShadow: "0 0 0 2px #e91e63, 0 4px 20px rgba(233,30,99,0.3)",
                      } : {}}
                    >
                      {card.text}
                    </button>
                  ))}
                </div>
                {isBlankCardSelected && (
                  <div className="mb-4">
                    <label className="text-white/40 text-xs font-bold uppercase tracking-wide mb-2 block">✍️ Écris ta réponse</label>
                    <textarea
                      autoFocus
                      maxLength={200}
                      value={blankText}
                      onChange={e => setBlankText(e.target.value)}
                      placeholder="Tape ta réponse ici..."
                      rows={3}
                      className="w-full rounded-xl px-4 py-3 bg-white text-gray-900 font-semibold text-sm resize-none focus:outline-none"
                      style={{ boxShadow: "0 0 0 2px #e91e63" }}
                    />
                    <div className="text-right text-xs text-white/25 mt-1">{blankText.length}/200</div>
                  </div>
                )}
                <button
                  data-testid="submit-answer"
                  onClick={submitAnswer}
                  disabled={selectedCardId === null || submitted || (isBlankCardSelected && !blankText.trim())}
                  className="w-full py-4 rounded-2xl font-black text-lg text-white shadow-xl active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: (selectedCardId !== null && (!isBlankCardSelected || blankText.trim())) ? "linear-gradient(135deg, #e91e63, #c2185b)" : "rgba(255,255,255,0.1)" }}
                >
                  {submitted ? "⏳ En cours..." : "Soumettre cette carte"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Phase: Judge (classic mode) */}
      {room.phase === "playing-judge" && (
        <div className="flex-1 flex flex-col px-4 pb-4 relative z-10">
          <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
            {isQM ? (
              <>
                <h3 className="text-white font-black text-lg text-center mb-1">
                  👑 Choisis la réponse la plus drôle !
                </h3>
                <p className="text-white/30 text-xs text-center mb-4">🙈 Vote à l'aveugle — l'ordre est mélangé</p>
                {error && (
                  <div className="rounded-xl px-4 py-2.5 mb-3 text-sm font-semibold"
                    style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
                    data-testid="error-message">
                    ⚠️ {error}
                  </div>
                )}
                <div className="space-y-3">
                  {shuffledSubmissions.map((submission, i) => (
                    <div key={submission.playerId} className="space-y-2">
                      <div className="bg-white/95 rounded-2xl p-4 shadow-xl">
                        <div className="text-gray-400 text-xs font-bold mb-1">Réponse {i + 1}</div>
                        <p className="text-gray-900 font-bold text-sm mb-2">{submission.card.text}</p>
                        <div className="text-xs text-gray-400 italic mb-3">
                          {room.currentQuestion ? formatQuestion(room.currentQuestion.text, submission.card.text) : ""}
                        </div>
                        <button
                          data-testid={`pick-winner-${submission.playerId}`}
                          onClick={() => pickWinner(submission.playerId)}
                          className="w-full py-2 rounded-xl font-black text-sm text-white"
                          style={{ background: "linear-gradient(135deg, #e91e63, #c2185b)" }}
                        >
                          🏆 Choisir cette réponse
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                <div className="text-5xl mb-3">🤔</div>
                <h3 className="text-white font-black text-xl mb-2">{qmPlayer?.name} choisit...</h3>
                <p className="text-white/40 text-sm mb-5">Toutes les réponses sont révélées !</p>
                <div className="space-y-3 w-full">
                  {room.submissions.map((submission, i) => (
                    <div key={i}
                      className="rounded-2xl p-4 text-left"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <div className="text-white/30 text-xs mb-1">Réponse {i + 1}</div>
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
        <div className="flex-1 flex flex-col px-4 pb-4 relative z-10">
          <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl mb-3"
                style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)" }}>
                <span style={{ color: "#c084fc" }}>🗳️</span>
                <span className="text-sm font-black" style={{ color: "#c084fc" }}>
                  Vote pour la meilleure réponse !
                </span>
              </div>
              <p className="text-white/30 text-xs">Tu ne peux pas voter pour ta propre carte — anonyme</p>
              {!hasVoted && !myVoteTarget && (
                <div className="mt-2 text-xs text-white/25">
                  {voteCount}/{room.submissions.length} votes reçus
                </div>
              )}
            </div>

            {hasVoted || myVoteTarget ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <div className="text-5xl mb-3">✅</div>
                <h3 className="text-white font-black text-xl mb-2">Vote enregistré !</h3>
                <p className="text-white/40 text-sm mb-4">En attente des autres joueurs...</p>
                <div className="rounded-2xl px-6 py-4" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="text-3xl font-black text-white">{voteCount}/{room.submissions.length}</div>
                  <div className="text-xs text-white/30 mt-1">votes reçus</div>
                </div>
                {/* Show all anonymous submissions while waiting */}
                <div className="mt-4 space-y-2 w-full">
                  {shuffledSubmissions.map((sub, i) => (
                    <div key={i} className="rounded-xl p-3 text-left"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="text-white/25 text-xs mb-0.5">Réponse {i + 1}</div>
                      <p className="text-white font-semibold text-sm">{sub.card.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {error && (
                  <div className="rounded-xl px-4 py-2.5 mb-3 text-sm font-semibold"
                    style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
                    ⚠️ {error}
                  </div>
                )}
                <div className="space-y-3">
                  {shuffledSubmissions.map((sub, i) => {
                    const isMyOwnCard = sub._realPlayerId === playerId;
                    return (
                      <div key={i}
                        className="rounded-2xl overflow-hidden"
                        style={{ opacity: isMyOwnCard ? 0.4 : 1 }}
                      >
                        <div className="bg-white/95 p-4">
                          <div className="text-gray-400 text-xs font-bold mb-1">Réponse {i + 1}</div>
                          <p className="text-gray-900 font-bold text-sm mb-2">{sub.card.text}</p>
                          <div className="text-xs text-gray-400 italic mb-3">
                            {room.currentQuestion ? formatQuestion(room.currentQuestion.text, sub.card.text) : ""}
                          </div>
                          {isMyOwnCard ? (
                            <div className="w-full py-2 rounded-xl text-center text-xs font-bold text-gray-400 bg-gray-100">
                              🙈 C'est ta carte
                            </div>
                          ) : (
                            <button
                              onClick={() => vote(sub.playerId)}
                              disabled={hasVoted}
                              className="w-full py-2.5 rounded-xl font-black text-sm text-white transition-all active:scale-95 disabled:opacity-40"
                              style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
                            >
                              🗳️ Voter pour cette réponse
                            </button>
                          )}
                        </div>
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
    <div
      className="min-h-screen overflow-y-auto flex flex-col items-center px-4 pt-10 pb-8 text-center relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #07071a 0%, #1a0828 50%, #070f1a 100%)" }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 35% at 50% 0%, rgba(233,30,99,0.25), transparent 65%)" }} />

      <div className="max-w-sm w-full relative z-10">
        {/* Winner avatar */}
        <div
          className="w-20 h-20 flex items-center justify-center rounded-3xl mx-auto shadow-xl mb-2"
          style={{ background: "rgba(233,30,99,0.15)", border: "1px solid rgba(233,30,99,0.3)", fontSize: "2.8rem" }}
        >
          {winner?.avatar || "🎉"}
        </div>
        <h3 className="font-black text-2xl mb-1" style={{ color: "#f9a8d4" }}>{winner?.name}</h3>
        <p className="font-black text-xl text-white mb-1">gagne ce tour !</p>
        {isDemocratic && <p className="text-xs text-white/30 mb-1">🗳️ Élu par les votes</p>}
        <p className="text-sm mb-5" style={{ color: "#94a3b8" }}>
          Score : {winner?.score} / {room.targetScore} pts
        </p>

        {winnerCard && (
          <div className="bg-white rounded-2xl p-5 shadow-2xl mb-5 text-left">
            <div className="text-xs text-gray-400 mb-1 text-center">La meilleure réponse était...</div>
            <p className="text-gray-900 font-black text-lg text-center">"{winnerCard.text}"</p>
            {room.currentQuestion && (
              <div className="mt-2 text-sm text-gray-500 italic text-center">
                {formatQuestion(room.currentQuestion.text, winnerCard.text)}
              </div>
            )}
          </div>
        )}

        {/* Scores */}
        <div className="rounded-2xl p-4 mb-5" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {room.players
            .slice()
            .sort((a, b) => b.score - a.score)
            .map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 py-1.5 px-1">
                <span className="text-sm w-6 text-center shrink-0">{["🥇", "🥈", "🥉"][i] || `${i + 1}.`}</span>
                <span className="text-lg shrink-0">{p.avatar || "🐱"}</span>
                <span className="text-sm font-bold flex-1 text-left truncate text-white/80">{p.name}</span>
                <span className="font-black shrink-0" style={{ color: "#fbbf24" }}>{p.score} pts</span>
              </div>
            ))}
        </div>

        {isQM ? (
          <button
            data-testid="next-round"
            onClick={() => send({ type: "NEXT_ROUND" })}
            className="w-full py-4 rounded-2xl font-black text-xl text-white shadow-xl active:scale-95 transition-all"
            style={{ background: "linear-gradient(135deg, #e91e63, #c2185b)", boxShadow: "0 8px 25px rgba(233,30,99,0.4)" }}
          >
            ▶️ Tour suivant !
          </button>
        ) : (
          <p className="text-sm" style={{ color: "#94a3b8" }}>
            ⏳ En attente que {qmPlayer?.name} lance le tour suivant...
          </p>
        )}
        {room.roundResultEndsAt && (
          <p className="text-xs mt-2 font-bold" style={{ color: "#a78bfa" }}>
            ⏱️ Tour suivant automatique dans {roundResultRemaining}s
          </p>
        )}
      </div>
    </div>
  );
}
