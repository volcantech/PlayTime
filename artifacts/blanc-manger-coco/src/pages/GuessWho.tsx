import { useState } from "react";
import type { SendMessage, GWRoom, GWCharacter } from "../hooks/useWebSocket";

interface Props {
  room: GWRoom;
  playerId: string;
  send: SendMessage;
  error: string | null;
  onLeave: () => void;
}

function CharacterAvatar({ char, size = "md" }: { char: GWCharacter; size?: "sm" | "md" | "lg" }) {
  const sizeMap = {
    sm: { img: "w-10 h-10", emoji: "text-2xl", text: "text-[10px]" },
    md: { img: "w-12 h-12", emoji: "text-3xl", text: "text-xs" },
    lg: { img: "w-16 h-16", emoji: "text-5xl", text: "text-sm" },
  };
  const s = sizeMap[size];
  if (char.imageUrl) {
    return (
      <img
        src={char.imageUrl}
        alt={char.name}
        className={`${s.img} rounded-full object-cover border-2 border-gray-200 mx-auto`}
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return <span className={s.emoji}>{char.emoji}</span>;
}

function CharacterCard({
  char,
  eliminated,
  selected,
  secret,
  onToggleEliminate,
  onSelect,
  size = "md",
  zoomed = false,
}: {
  char: GWCharacter;
  eliminated?: boolean;
  selected?: boolean;
  secret?: boolean;
  onToggleEliminate?: () => void;
  onSelect?: () => void;
  size?: "sm" | "md" | "lg";
  zoomed?: boolean;
}) {
  const isFlipped = !!eliminated;
  const cardW = zoomed ? "w-20" : size === "sm" ? "w-14" : "w-16";
  const cardH = zoomed ? "h-24" : size === "sm" ? "h-16" : "h-20";

  return (
    <div className={`relative ${cardW} ${cardH} flex flex-col`} style={{ perspective: "600px" }}>
      <div
        className="relative w-full h-full transition-transform duration-500"
        style={{ transformStyle: "preserve-3d", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        {/* Front */}
        <div
          className={[
            "absolute inset-0 rounded-xl border-2 flex flex-col items-center justify-center overflow-hidden",
            selected ? "border-rose-500 bg-rose-50 shadow-lg scale-105" : secret ? "border-yellow-500 bg-yellow-50 ring-2 ring-yellow-400" : "border-gray-200 bg-white",
            onSelect ? "cursor-pointer hover:border-rose-400" : "cursor-default",
          ].join(" ")}
          style={{ backfaceVisibility: "hidden" }}
          onClick={onSelect}
          title={char.name}
        >
          <CharacterAvatar char={char} size={zoomed ? "md" : size} />
          <span className="text-[9px] font-medium text-gray-700 mt-0.5 leading-tight text-center px-0.5 line-clamp-1">{char.name}</span>
          {selected && <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-rose-500" />}
          {onToggleEliminate && !isFlipped && (
            <button
              onClick={e => { e.stopPropagation(); onToggleEliminate(); }}
              className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center hover:bg-red-700 z-10"
              title="Éliminer"
            >
              ✕
            </button>
          )}
        </div>
        {/* Back */}
        <div
          className="absolute inset-0 rounded-xl border-2 border-gray-300 bg-gray-100 flex items-center justify-center"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          {onToggleEliminate && (
            <button
              onClick={e => { e.stopPropagation(); onToggleEliminate(); }}
              className="w-6 h-6 rounded-full bg-gray-400 text-white text-xs flex items-center justify-center hover:bg-gray-600"
              title="Remettre"
            >
              ↩
            </button>
          )}
          {!onToggleEliminate && <span className="text-gray-300 text-2xl">✕</span>}
        </div>
      </div>
    </div>
  );
}

export function GuessWho({ room, playerId, send, error, onLeave }: Props) {
  const [questionInput, setQuestionInput] = useState("");
  const [selectedGuessId, setSelectedGuessId] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);

  const me = room.players.find(p => p.id === playerId);
  const opponent = room.players.find(p => p.id !== playerId);
  const isHost = room.hostId === playerId;
  const isMyTurn = room.currentAskerId === playerId;
  const myEliminated = me?.eliminatedIds ?? [];

  function handleStartSelection() {
    send({ type: "GW_START_SELECTION" });
  }

  function handleSelectCharacter(charId: number) {
    send({ type: "GW_SELECT_CHARACTER", characterId: charId });
  }

  function handleAskQuestion() {
    const q = questionInput.trim();
    if (!q) return;
    send({ type: "GW_ASK_QUESTION", question: q });
    setQuestionInput("");
  }

  function handleAnswer(answer: boolean) {
    send({ type: "GW_ANSWER_QUESTION", answer });
  }

  function handleNextTurn() {
    send({ type: "GW_NEXT_TURN" });
  }

  function handleToggleEliminate(charId: number) {
    send({ type: "GW_TOGGLE_ELIMINATE", characterId: charId });
    if (selectedGuessId === charId) setSelectedGuessId(null);
  }

  function handleMakeGuess() {
    if (selectedGuessId == null) return;
    send({ type: "GW_MAKE_GUESS", characterId: selectedGuessId });
    setSelectedGuessId(null);
  }

  function handleReset() {
    send({ type: "GW_RESET" });
  }

  const mySecretChar = me?.secretCharacterId != null
    ? room.characters.find(c => c.id === me.secretCharacterId) ?? null
    : null;

  if (room.phase === "lobby") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
           style={{ background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #ff9a9e 100%)" }}>
        <div className="bg-white/90 rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-3xl font-black text-rose-700 mb-2">Qui est-ce ?</h1>
          <p className="text-gray-500 mb-2 text-sm">Code de la salle :</p>
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="text-4xl font-black tracking-widest text-rose-600">{room.code}</div>
            {room.isPrivate && (
              <span className="text-xs bg-rose-100 text-rose-700 border border-rose-300 rounded-full px-2 py-0.5 font-bold">🔒 Privée</span>
            )}
          </div>

          <div className="mb-6 space-y-2">
            {room.players.map(p => (
              <div key={p.id} className="flex items-center gap-3 bg-rose-50 rounded-xl px-4 py-2">
                <span className="text-2xl">{p.avatar}</span>
                <span className="font-bold text-gray-800">{p.name}</span>
                {p.id === room.hostId && <span className="text-xs bg-yellow-200 text-yellow-800 rounded-full px-2 py-0.5">Hôte</span>}
                {!p.isConnected && <span className="text-xs text-red-500">Déconnecté</span>}
              </div>
            ))}
          </div>

          {room.players.length < 2 && (
            <p className="text-gray-500 text-sm mb-4 animate-pulse">En attente d'un adversaire…</p>
          )}

          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          {isHost && room.players.length === 2 && (
            <button
              onClick={handleStartSelection}
              className="w-full py-3 bg-rose-600 text-white font-black rounded-xl text-lg hover:bg-rose-700 transition-colors"
            >
              Choisir les personnages 🎭
            </button>
          )}

          {!isHost && room.players.length === 2 && (
            <p className="text-gray-500 text-sm">En attente de l'hôte pour démarrer…</p>
          )}

          <button onClick={onLeave} className="mt-4 text-sm text-gray-400 hover:text-rose-600 transition-colors">
            Quitter la salle
          </button>
        </div>
      </div>
    );
  }

  if (room.phase === "selection") {
    const hasSelected = me?.hasSelected ?? false;
    return (
      <div className="min-h-screen flex flex-col px-4 py-6"
           style={{ background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #ff9a9e 100%)" }}>
        <div className="max-w-2xl mx-auto w-full">
          <div className="text-center mb-6">
            <div className="text-3xl font-black text-rose-700">Choisissez votre personnage secret</div>
            <p className="text-gray-600 text-sm mt-1">L'adversaire devra deviner qui vous avez choisi !</p>
          </div>

          {hasSelected ? (
            <div className="bg-white/90 rounded-2xl p-6 text-center shadow">
              <div className="flex flex-col items-center gap-2 mb-3">
                <CharacterAvatar char={mySecretChar!} size="lg" />
                <div className="font-black text-rose-700 text-xl">{mySecretChar?.name}</div>
              </div>
              <p className="text-gray-500 text-sm mt-4 animate-pulse">
                {opponent?.hasSelected ? "Les deux joueurs sont prêts. La partie va commencer !" : "En attente de l'adversaire…"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {room.characters.map(char => (
                <CharacterCard
                  key={char.id}
                  char={char}
                  onSelect={() => handleSelectCharacter(char.id)}
                />
              ))}
            </div>
          )}

          <button onClick={onLeave} className="mt-6 block mx-auto text-sm text-gray-400 hover:text-rose-600 transition-colors">
            Quitter la salle
          </button>
        </div>
      </div>
    );
  }

  if (room.phase === "playing") {
    const isAnswering = room.questionState === "asked" && !isMyTurn;
    const canAsk = isMyTurn && room.questionState === "idle";
    const canNextTurn = isMyTurn && room.questionState === "answered";

    return (
      <div className="min-h-screen flex flex-col px-4 py-4"
           style={{ background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #ff9a9e 100%)" }}>
        <div className="max-w-2xl mx-auto w-full space-y-4">
          {/* Header */}
          <div className="bg-white/90 rounded-2xl px-4 py-3 flex items-center justify-between shadow">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔍</span>
              <span className="font-black text-rose-700">Qui est-ce ?</span>
            </div>
            <div className="text-sm text-gray-600">
              {isMyTurn ? <span className="text-rose-600 font-bold">C'est ton tour !</span> : <span className="text-gray-500">Tour de {opponent?.name}</span>}
            </div>
            <button onClick={onLeave} className="text-xs text-gray-400 hover:text-rose-600">Quitter</button>
          </div>

          {/* Players row */}
          <div className="grid grid-cols-2 gap-3">
            {room.players.map(p => (
              <div key={p.id} className={[
                "bg-white/90 rounded-2xl p-3 shadow flex items-center gap-2",
                p.id === room.currentAskerId ? "ring-2 ring-rose-500" : "",
              ].join(" ")}>
                <span className="text-2xl">{p.avatar}</span>
                <div>
                  <div className="font-bold text-gray-800 text-sm">{p.name} {p.id === playerId ? "(toi)" : ""}</div>
                  {p.id === playerId && mySecretChar && (
                    <div className="flex items-center gap-1 text-xs text-rose-600">
                      <CharacterAvatar char={mySecretChar} size="sm" />
                      <span>{mySecretChar.name}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Current Q&A */}
          <div className="bg-white/90 rounded-2xl p-4 shadow">
            {room.questionState === "idle" && canAsk && (
              <div>
                <div className="font-bold text-gray-700 mb-2 text-sm">Pose une question (oui/non) :</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={questionInput}
                    onChange={e => setQuestionInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAskQuestion()}
                    placeholder="Ex: Est-ce une femme ?"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-rose-400"
                  />
                  <button
                    onClick={handleAskQuestion}
                    disabled={!questionInput.trim()}
                    className="px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 disabled:opacity-50"
                  >
                    Poser
                  </button>
                </div>

                <div className="mt-3 border-t pt-3">
                  <div className="font-bold text-gray-700 mb-2 text-sm">Ou faire une supposition :</div>
                  {selectedGuessId != null && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                      <CharacterAvatar char={room.characters.find(c => c.id === selectedGuessId)!} size="sm" />
                      <span>Sélectionné : {room.characters.find(c => c.id === selectedGuessId)?.name}</span>
                    </div>
                  )}
                  <button
                    onClick={handleMakeGuess}
                    disabled={selectedGuessId == null}
                    className="px-4 py-2 bg-yellow-500 text-white rounded-xl text-sm font-bold hover:bg-yellow-600 disabled:opacity-50"
                  >
                    🎯 Je suppose : {selectedGuessId != null ? room.characters.find(c => c.id === selectedGuessId)?.name : "sélectionner"}
                  </button>
                </div>
              </div>
            )}

            {room.questionState === "idle" && !isMyTurn && (
              <div className="text-center text-gray-500 text-sm animate-pulse">
                {opponent?.name} réfléchit…
              </div>
            )}

            {room.questionState === "asked" && (
              <div>
                <div className="font-bold text-gray-700 mb-1 text-sm">
                  {isMyTurn ? "Tu as posé :" : `${opponent?.name} demande :`}
                </div>
                <div className="bg-rose-50 rounded-xl px-4 py-2 text-rose-800 font-medium mb-3">
                  "{room.currentQuestion}"
                </div>
                {isAnswering && (
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => handleAnswer(true)}
                      className="flex-1 py-3 bg-green-500 text-white font-black rounded-xl text-lg hover:bg-green-600"
                    >
                      ✅ Oui
                    </button>
                    <button
                      onClick={() => handleAnswer(false)}
                      className="flex-1 py-3 bg-red-500 text-white font-black rounded-xl text-lg hover:bg-red-600"
                    >
                      ❌ Non
                    </button>
                  </div>
                )}
                {!isAnswering && (
                  <div className="text-center text-gray-500 text-sm animate-pulse">En attente de la réponse…</div>
                )}
              </div>
            )}

            {room.questionState === "answered" && (
              <div>
                <div className="font-bold text-gray-700 mb-1 text-sm">Question :</div>
                <div className="bg-rose-50 rounded-xl px-4 py-2 text-rose-800 font-medium mb-2">
                  "{room.currentQuestion}"
                </div>
                <div className={`text-center text-2xl font-black mb-3 ${room.currentAnswer ? "text-green-600" : "text-red-600"}`}>
                  {room.currentAnswer ? "✅ Oui !" : "❌ Non !"}
                </div>
                {canNextTurn && (
                  <button
                    onClick={handleNextTurn}
                    className="w-full py-2 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 text-sm"
                  >
                    Continuer →
                  </button>
                )}
                {!isMyTurn && (
                  <div className="text-center text-gray-500 text-sm animate-pulse">En attente de {opponent?.name}…</div>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          {/* Character board */}
          <div className="bg-white/90 rounded-2xl p-4 shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-gray-700 text-sm">
                Personnages
                <span className="text-xs text-gray-400 font-normal ml-1">— ✕ pour éliminer · clic pour supposer</span>
              </div>
              <button
                onClick={() => setZoomed(z => !z)}
                className="text-xs text-rose-600 hover:text-rose-800 font-bold border border-rose-200 rounded-lg px-2 py-0.5"
              >
                {zoomed ? "🔎 Normal" : "🔍 Zoom"}
              </button>
            </div>
            <div className={`grid gap-2 ${zoomed ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-4 sm:grid-cols-6"}`}>
              {room.characters.map(char => {
                const isEliminated = myEliminated.includes(char.id);
                return (
                  <div key={char.id} className="flex flex-col items-center">
                    <CharacterCard
                      char={char}
                      eliminated={isEliminated}
                      selected={selectedGuessId === char.id}
                      onToggleEliminate={() => handleToggleEliminate(char.id)}
                      onSelect={!isEliminated ? () => {
                        setSelectedGuessId(prev => prev === char.id ? null : char.id);
                      } : undefined}
                      size="sm"
                      zoomed={zoomed}
                    />
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-gray-400 mt-2 text-center">
              {myEliminated.length} éliminé(s) — {room.characters.length - myEliminated.length} restant(s)
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (room.phase === "game-over") {
    const winner = room.players.find(p => p.id === room.winnerId);
    const iWon = room.winnerId === playerId;

    const opponentSecretChar = opponent?.secretCharacterId != null
      ? room.characters.find(c => c.id === opponent.secretCharacterId) ?? null
      : null;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
           style={{ background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #ff9a9e 100%)" }}>
        <div className="bg-white/90 rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-3">{iWon ? "🏆" : "😔"}</div>
          <h2 className="text-3xl font-black text-rose-700 mb-2">
            {iWon ? "Victoire !" : "Défaite…"}
          </h2>
          <p className="text-gray-500 text-sm mb-4">{room.winnerReason}</p>

          {winner && (
            <div className="bg-rose-50 rounded-2xl p-4 mb-4">
              <div className="text-2xl">{winner.avatar}</div>
              <div className="font-bold text-rose-700">{winner.name} a gagné !</div>
            </div>
          )}

          {opponentSecretChar && (
            <div className="mb-4">
              <div className="text-sm text-gray-500 mb-2">Le personnage secret de {opponent?.name} était :</div>
              <div className="flex flex-col items-center gap-1">
                <CharacterAvatar char={opponentSecretChar} size="lg" />
                <span className="font-bold text-rose-700 text-lg">{opponentSecretChar.name}</span>
              </div>
            </div>
          )}

          {mySecretChar && (
            <div className="mb-6">
              <div className="text-sm text-gray-500 mb-2">Ton personnage secret était :</div>
              <div className="flex flex-col items-center gap-1">
                <CharacterAvatar char={mySecretChar} size="lg" />
                <span className="font-bold text-gray-700 text-lg">{mySecretChar.name}</span>
              </div>
            </div>
          )}

          {isHost ? (
            <button
              onClick={handleReset}
              className="w-full py-3 bg-rose-600 text-white font-black rounded-xl text-lg hover:bg-rose-700 transition-colors mb-3"
            >
              Rejouer 🔄
            </button>
          ) : (
            <p className="text-gray-500 text-sm mb-3 animate-pulse">En attente de l'hôte…</p>
          )}

          <button onClick={onLeave} className="text-sm text-gray-400 hover:text-rose-600 transition-colors">
            Quitter
          </button>
        </div>
      </div>
    );
  }

  return null;
}
