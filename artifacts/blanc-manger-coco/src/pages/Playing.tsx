import { useState, useEffect, useMemo } from "react";
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
    ? <span className="font-black text-rose-600 border-b-2 border-rose-400">{answer}</span>
    : <span className="inline-block w-24 border-b-2 border-gray-400 align-middle" />;

  const parts = text.split("_____");
  return (
    <>
      {parts[0]}{blank}{parts[1] || ""}
    </>
  );
}

export function Playing({ room, playerId, send, error, onLeave }: PlayingProps) {
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [blankText, setBlankText] = useState("");

  useEffect(() => {
    setSelectedCardId(null);
    setSubmitted(false);
    setBlankText("");
  }, [room.roundNumber, room.phase]);

  const qmPlayer = room.players[room.questionMasterIndex];
  const isQM = qmPlayer?.id === playerId;
  const me = room.players.find(p => p.id === playerId);
  const myHand = me?.hand || [];
  const mySubmission = room.submissions.find(s => s.playerId === playerId);
  const hasSubmitted = me?.submittedCardId !== null || !!mySubmission;

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
  const totalNonQM = room.players.filter(p => p.id !== qmPlayer?.id && p.isConnected).length;

  if (room.phase === "round-result") {
    return <RoundResult room={room} playerId={playerId} send={send} />;
  }

  return (
    <div className="min-h-screen flex flex-col"
         style={{ background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}>

      {/* Header */}
      <div className="px-4 py-3 bg-black/30">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Tour {room.roundNumber}</span>
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              {room.players.map(p => (
                <div key={p.id} className="flex items-center gap-1 bg-white/10 rounded-full px-2 py-0.5">
                  <span className="text-sm">{p.avatar || "🐱"}</span>
                  <span className="text-xs font-bold text-white">{p.name}</span>
                  <span className="text-xs text-yellow-400 font-black">{p.score}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            <div>
              <div className="text-xs text-gray-400">Objectif</div>
              <div className="text-white font-black">{room.targetScore} pts</div>
            </div>
            <button
              onClick={onLeave}
              className="shrink-0 text-xs font-semibold py-1.5 px-3 rounded-xl bg-white/10 text-white/70 hover:bg-red-500/20 hover:text-red-200 transition-colors"
            >
              🚪 Quitter
            </button>
          </div>
        </div>
      </div>

      {/* Question Master tag */}
      <div className="px-4 pt-4">
        <div className="max-w-lg mx-auto flex items-center gap-2 mb-3">
          <span className="text-xl">{qmPlayer?.avatar || "🐱"}</span>
          <span className="text-white font-bold text-sm">{qmPlayer?.name}</span>
          <span className="bg-yellow-400 text-yellow-900 text-xs px-2 py-0.5 rounded-full font-black">Question Master</span>
        </div>

        {/* Question card */}
        <div className="max-w-lg mx-auto">
          <div className="bg-black/80 border border-gray-600 rounded-2xl p-5 mb-4 shadow-2xl"
               data-testid="question-card">
            <div className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-2">Question</div>
            <p className="text-white text-lg font-bold leading-relaxed">
              {room.currentQuestion ? formatQuestion(room.currentQuestion.text) : "..."}
            </p>
          </div>
        </div>
      </div>

      {/* Phase: Submit */}
      {room.phase === "playing-submit" && (
        <div className="flex-1 flex flex-col px-4 pb-4">
          <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
            {isQM ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                <div className="text-5xl mb-3">⏳</div>
                <h3 className="text-white font-black text-xl mb-2">C'est le moment de patienter !</h3>
                <p className="text-gray-400 text-sm">Les joueurs choisissent leur meilleure réponse...</p>
                <div className="mt-6 bg-white/10 rounded-2xl px-6 py-4">
                  <div className="text-3xl font-black text-white">{submittedCount}/{totalNonQM}</div>
                  <div className="text-xs text-gray-400 mt-1">réponses soumises</div>
                </div>
                {/* Waiting status per player */}
                <div className="mt-4 space-y-2 w-full">
                  {room.players.filter(p => p.id !== qmPlayer?.id).map((p) => {
                    const sub = room.submissions.find(s => s.playerId === p.id);
                    return (
                      <div key={p.id} className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
                        <span>{p.avatar || "🐱"}</span>
                        <span className="text-white text-sm font-semibold flex-1">{p.name}</span>
                        {sub ? (
                          <span className="text-green-400 text-xs font-bold">✅ Soumis</span>
                        ) : (
                          <span className="text-gray-500 text-xs">⏳ En train de choisir...</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : hasSubmitted ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                <div className="text-5xl mb-3">✅</div>
                <h3 className="text-white font-black text-xl mb-2">Réponse soumise !</h3>
                <p className="text-gray-400 text-sm mb-6">
                  En attente des autres joueurs... ({submittedCount}/{totalNonQM})
                </p>
                <div className="mt-4 space-y-2 w-full">
                  {room.players.filter(p => p.id !== qmPlayer?.id).map((p) => {
                    const sub = room.submissions.find(s => s.playerId === p.id);
                    return (
                      <div key={p.id} className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
                        <span>{p.avatar || "🐱"}</span>
                        <span className="text-white text-sm font-semibold flex-1">{p.name}</span>
                        {sub ? (
                          <span className="text-green-400 text-xs font-bold">✅</span>
                        ) : (
                          <span className="text-gray-500 text-xs">⏳</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <p className="text-gray-300 text-sm font-semibold mb-3 text-center">
                  Choisis ta meilleure réponse ! ({myHand.length} cartes en main)
                </p>
                {error && (
                  <div className="bg-red-900/50 border border-red-500 text-red-200 rounded-xl px-3 py-2 mb-3 text-sm font-semibold" data-testid="error-message">
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
                          ? "bg-white ring-2 ring-rose-400 ring-offset-2 ring-offset-transparent text-gray-900 shadow-lg"
                          : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      {card.text}
                    </button>
                  ))}
                </div>
                {isBlankCardSelected && (
                  <div className="mb-4">
                    <label className="text-gray-300 text-xs font-bold uppercase tracking-wide mb-2 block">
                      ✍️ Écris ta réponse
                    </label>
                    <textarea
                      autoFocus
                      maxLength={200}
                      value={blankText}
                      onChange={e => setBlankText(e.target.value)}
                      placeholder="Tape ta réponse ici..."
                      rows={3}
                      className="w-full rounded-xl px-4 py-3 bg-white text-gray-900 font-semibold text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                    <div className="text-right text-xs text-gray-500 mt-1">{blankText.length}/200</div>
                  </div>
                )}
                <button
                  data-testid="submit-answer"
                  onClick={submitAnswer}
                  disabled={selectedCardId === null || submitted || (isBlankCardSelected && !blankText.trim())}
                  className="w-full py-4 rounded-2xl font-black text-lg text-white shadow-xl active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: (selectedCardId !== null && (!isBlankCardSelected || blankText.trim())) ? "linear-gradient(135deg, #e91e63, #c2185b)" : "#4a5568" }}
                >
                  {submitted ? "⏳ En cours..." : "Soumettre cette carte"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Phase: Judge */}
      {room.phase === "playing-judge" && (
        <div className="flex-1 flex flex-col px-4 pb-4">
          <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
            {isQM ? (
              <>
                <h3 className="text-white font-black text-lg text-center mb-1">
                  👑 Choisis la réponse la plus drôle !
                </h3>
                <p className="text-gray-400 text-xs text-center mb-4">🙈 Vote à l'aveugle — l'ordre est mélangé</p>
                {error && (
                  <div className="bg-red-900/50 border border-red-500 text-red-200 rounded-xl px-3 py-2 mb-3 text-sm font-semibold" data-testid="error-message">
                    ⚠️ {error}
                  </div>
                )}
                <div className="space-y-3">
                  {shuffledSubmissions.map((submission, i) => (
                    <div key={submission.playerId} className="space-y-2">
                      <div className="bg-white/90 rounded-xl p-4 shadow-lg">
                        <div className="text-gray-500 text-xs font-bold mb-1">Réponse {i + 1}</div>
                        <p className="text-gray-900 font-bold text-sm mb-2">{submission.card.text}</p>
                        <div className="text-xs text-gray-400 italic mb-3">
                          {room.currentQuestion ? formatQuestion(room.currentQuestion.text, submission.card.text) : ""}
                        </div>
                        <button
                          data-testid={`pick-winner-${submission.playerId}`}
                          onClick={() => pickWinner(submission.playerId)}
                          className="w-full py-2 rounded-lg font-black text-sm text-white"
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
                <p className="text-gray-400 text-sm mb-6">Toutes les réponses sont révélées !</p>
                <div className="space-y-3 w-full">
                  {room.submissions.map((submission, i) => (
                    <div key={submission.playerId}
                         className="bg-white/10 border border-white/20 rounded-xl p-4 text-left">
                      <div className="text-gray-400 text-xs mb-1">Réponse {i + 1}</div>
                      <p className="text-white font-bold text-sm">{submission.card.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
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

function RoundResult({ room, playerId, send }: { room: GameRoom; playerId: string; send: SendMessage }) {
  const winner = room.players.find(p => p.id === room.lastWinnerId);
  const winnerCard = room.submissions.find(s => s.playerId === room.lastWinnerId)?.card
    || (room.lastWinnerCardId ? { id: room.lastWinnerCardId, text: "..." } : null);
  const qmPlayer = room.players[room.questionMasterIndex];
  const isQM = qmPlayer?.id === playerId;
  const roundResultRemaining = useCountdown(room.roundResultEndsAt ?? null);

  return (
    <div
      className="min-h-screen overflow-y-auto flex flex-col items-center px-4 pt-10 pb-8 text-center"
      style={{ background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}
    >
      <div className="max-w-sm w-full">
        {/* Winner avatar + name */}
        <div
          className="text-5xl mb-2 w-20 h-20 flex items-center justify-center rounded-3xl mx-auto shadow-xl"
          style={{ background: "rgba(255,255,255,0.1)", fontSize: "2.8rem" }}
        >
          {winner?.avatar || "🎉"}
        </div>
        <h3 className="font-black text-2xl mb-1" style={{ color: "#f9a8d4" }}>
          {winner?.name}
        </h3>
        <p className="font-black text-xl text-white mb-1">gagne ce tour !</p>
        <p className="text-sm mb-6" style={{ color: "#94a3b8" }}>
          Score : {winner?.score} / {room.targetScore} pts
        </p>

        {winnerCard && (
          <div className="bg-white rounded-2xl p-5 shadow-2xl mb-6 text-left">
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
        <div className="rounded-2xl p-4 mb-6" style={{ background: "rgba(255,255,255,0.08)" }}>
          {room.players
            .slice()
            .sort((a, b) => b.score - a.score)
            .map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 py-1.5 px-1">
                <span className="text-sm w-6 text-center shrink-0">{["🥇", "🥈", "🥉"][i] || `${i + 1}.`}</span>
                <span className="text-lg shrink-0">{p.avatar || "🐱"}</span>
                <span className="text-sm font-bold flex-1 text-left truncate" style={{ color: "#e2e8f0" }}>
                  {p.name}
                </span>
                <span className="font-black shrink-0" style={{ color: "#fbbf24" }}>{p.score} pts</span>
              </div>
            ))}
        </div>

        {isQM ? (
          <button
            data-testid="next-round"
            onClick={() => send({ type: "NEXT_ROUND" })}
            className="w-full py-4 rounded-2xl font-black text-xl text-white shadow-xl active:scale-95 transition-all"
            style={{ background: "linear-gradient(135deg, #e91e63, #c2185b)" }}
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
