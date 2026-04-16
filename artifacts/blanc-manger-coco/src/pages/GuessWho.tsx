import { useState, useEffect } from "react";
import type { SendMessage, GWRoom, GWCharacter } from "../hooks/useWebSocket";

interface Props {
  room: GWRoom;
  playerId: string;
  send: SendMessage;
  error: string | null;
  onLeave: () => void;
}

function CharacterAvatar({ char, size = "md" }: { char: GWCharacter; size?: "sm" | "md" | "lg" | "xl" }) {
  const sizeMap = {
    sm: { img: "w-10 h-10", emoji: "text-2xl" },
    md: { img: "w-12 h-12", emoji: "text-3xl" },
    lg: { img: "w-16 h-16", emoji: "text-5xl" },
    xl: { img: "w-24 h-24", emoji: "text-7xl" },
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

function ZoomModal({ char, onClose }: { char: GWCharacter; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl p-6 flex flex-col items-center gap-4 w-full"
        style={{ maxWidth: 540 }}
        onClick={e => e.stopPropagation()}
      >
        {char.imageUrl ? (
          <img
            src={char.imageUrl}
            alt={char.name}
            style={{ width: 500, height: 520, objectFit: "cover" }}
            className="rounded-2xl border-2 border-gray-200"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <span style={{ fontSize: 120, lineHeight: 1 }}>{char.emoji}</span>
        )}
        <div className="text-2xl font-black text-gray-800 text-center">{char.name}</div>
        {char.category && (
          <span className="text-xs bg-rose-100 text-rose-700 px-3 py-1 rounded-full font-semibold">{char.category}</span>
        )}
        <button
          onClick={onClose}
          className="mt-1 px-6 py-2 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-colors"
        >
          Fermer ✕
        </button>
      </div>
    </div>
  );
}

function CharacterCard({
  char,
  eliminated,
  selected,
  secret,
  onToggleEliminate,
  onSelect,
  onZoom,
  size = "md",
  large = false,
}: {
  char: GWCharacter;
  eliminated?: boolean;
  selected?: boolean;
  secret?: boolean;
  onToggleEliminate?: () => void;
  onSelect?: () => void;
  onZoom?: () => void;
  size?: "sm" | "md" | "lg";
  large?: boolean;
}) {
  const isFlipped = !!eliminated;
  const cardW = large ? "w-20" : size === "sm" ? "w-14" : "w-16";
  const cardH = large ? "h-24" : size === "sm" ? "h-16" : "h-20";

  return (
    <div className="flex flex-col items-center gap-0.5">
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
            <CharacterAvatar char={char} size={large ? "md" : size} />
            <span className="text-[9px] font-medium text-gray-700 mt-0.5 leading-tight text-center px-0.5 line-clamp-1">{char.name}</span>
            {selected && <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-rose-500" />}
          </div>
          {/* Back */}
          <div
            className="absolute inset-0 rounded-xl border-2 border-gray-300 bg-gray-100 flex items-center justify-center"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <span className="text-gray-300 text-2xl">✕</span>
          </div>
        </div>
      </div>
      {/* Buttons row below card: eliminate + zoom */}
      {(onToggleEliminate || onZoom) && !isFlipped && (
        <div className="flex items-center gap-0.5">
          {onToggleEliminate && (
            <button
              onClick={e => { e.stopPropagation(); onToggleEliminate(); }}
              className="text-[9px] text-red-500 hover:text-red-700 border border-red-200 rounded px-1 py-0.5 leading-none bg-white hover:border-red-400 transition-colors font-bold"
              title="Éliminer"
            >
              ✕
            </button>
          )}
          {onZoom && (
            <button
              onClick={e => { e.stopPropagation(); onZoom(); }}
              className="text-[9px] text-gray-400 hover:text-rose-600 border border-gray-200 rounded px-1 py-0.5 leading-none bg-white hover:border-rose-300 transition-colors"
              title="Agrandir"
            >
              🔍
            </button>
          )}
        </div>
      )}
      {/* Restore button when flipped (eliminated) */}
      {onToggleEliminate && isFlipped && (
        <button
          onClick={e => { e.stopPropagation(); onToggleEliminate(); }}
          className="text-[9px] text-gray-500 hover:text-gray-700 border border-gray-300 rounded px-1 py-0.5 leading-none bg-white hover:border-gray-500 transition-colors"
          title="Remettre"
        >
          ↩
        </button>
      )}
    </div>
  );
}

function QuitButton({ onLeave }: { onLeave: () => void }) {
  return (
    <button
      onClick={onLeave}
      className="px-5 py-2.5 bg-gray-700 hover:bg-gray-900 text-white font-bold rounded-xl text-sm transition-colors shadow"
    >
      🚪 Quitter
    </button>
  );
}

function winnerReasonLabel(reason: GWRoom["winnerReason"]): string {
  if (reason === "correct_guess") return "Bonne devinette !";
  if (reason === "opponent_wrong_guess") return "L'adversaire a mal deviné.";
  if (reason === "forfeit") return "L'adversaire a abandonné.";
  return "";
}

export function GuessWho({ room, playerId, send, error, onLeave }: Props) {
  const [questionInput, setQuestionInput] = useState("");
  const [selectedGuessId, setSelectedGuessId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [zoomedChar, setZoomedChar] = useState<GWCharacter | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Categories fetched for theme selector
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/guess-who-categories")
      .then(r => r.json())
      .then((data: { id: number; name: string }[]) => setCategories(data))
      .catch(() => {});
  }, []);

  const me = room.players.find(p => p.id === playerId);
  const opponent = room.players.find(p => p.id !== playerId);
  const isHost = room.hostId === playerId;
  const isMyTurn = room.currentAskerId === playerId;
  const myEliminated = me?.eliminatedIds ?? [];

  function handleStartSelection() {
    send({ type: "GW_START_SELECTION" });
  }

  function handleSetTheme(theme: string | null) {
    send({ type: "GW_SET_THEME", theme });
  }

  function handleSelectCharacter(charId: number) {
    if (me?.hasSelected) return;
    send({ type: "GW_SELECT_CHARACTER", characterId: charId });
  }

  function handleStartGame() {
    send({ type: "GW_START_GAME" });
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

  // ── LOBBY ─────────────────────────────────────────────────────────
  if (room.phase === "lobby") {
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${room.code}`;
    const copyLink = () => {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-start px-4 py-8"
           style={{ background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #ff9a9e 100%)" }}>

        {zoomedChar && <ZoomModal char={zoomedChar} onClose={() => setZoomedChar(null)} />}

        <div className="text-center mb-6">
          <div className="text-4xl mb-1">🔍</div>
          <h1 className="text-3xl font-black" style={{ fontFamily: "Pacifico, cursive", color: "#0e7490" }}>
            Qui est-ce ?
          </h1>
        </div>

        {/* Room code */}
        <div className="bg-white rounded-2xl shadow-lg p-5 w-full max-w-sm mb-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Code de la salle</p>
            {room.isPrivate && (
              <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">🔒 Privée</span>
            )}
          </div>
          <div className="text-5xl font-black tracking-[0.4em] text-rose-600 text-center mb-3">
            {room.code}
          </div>
          <button
            onClick={copyLink}
            className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
              copied
                ? "bg-green-100 text-green-700 border-2 border-green-300"
                : "bg-rose-50 text-rose-700 border-2 border-rose-200 hover:bg-rose-100"
            }`}
          >
            {copied ? "✅ Lien copié !" : "🔗 Copier le lien d'invitation"}
          </button>
        </div>

        {/* Players */}
        <div className="bg-white rounded-2xl shadow-lg p-5 w-full max-w-sm mb-4">
          <h2 className="font-black text-gray-700 mb-3 text-sm uppercase tracking-wide">
            Joueurs ({room.players.length}/2)
          </h2>
          <div className="space-y-2">
            {room.players.map(p => (
              <div key={p.id} className={`flex items-center gap-3 p-2.5 rounded-xl ${
                p.id === playerId ? "bg-rose-50 border-2 border-rose-200" : "bg-gray-50"
              }`}>
                <span className="text-2xl">{p.avatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-800 text-sm truncate">{p.name}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {p.id === playerId && <span className="text-xs bg-rose-100 text-rose-700 rounded-full px-2 py-0.5 font-bold">Toi</span>}
                  {p.id === room.hostId && <span className="text-xs bg-yellow-100 text-yellow-700 rounded-full px-2 py-0.5 font-bold">Hôte</span>}
                  {!p.isConnected && <span className="text-xs text-red-500 font-semibold">Déconnecté</span>}
                </div>
              </div>
            ))}
            {room.players.length < 2 && (
              <div className="text-center text-gray-400 text-sm py-3 animate-pulse">
                En attente d'un adversaire…
              </div>
            )}
          </div>
        </div>

        {/* Theme selector — host only, 2 players */}
        {isHost && categories.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-4 w-full max-w-sm mb-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
              🎭 Thème (optionnel)
            </label>
            <select
              value={room.theme ?? "all"}
              onChange={e => handleSetTheme(e.target.value === "all" ? null : e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-rose-400"
            >
              <option value="all">Tous les personnages</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
            {room.theme && (
              <p className="text-xs text-rose-600 mt-1 font-medium">Thème sélectionné : {room.theme}</p>
            )}
          </div>
        )}

        {/* Non-host sees current theme */}
        {!isHost && room.theme && (
          <div className="bg-white/80 rounded-xl px-4 py-2 w-full max-w-sm mb-4 text-center">
            <span className="text-sm text-gray-600">Thème : <strong className="text-rose-700">{room.theme}</strong></span>
          </div>
        )}

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        {isHost && room.players.length === 2 && (
          <button
            onClick={handleStartSelection}
            className="w-full max-w-sm py-3.5 bg-rose-600 text-white font-black rounded-xl text-lg hover:bg-rose-700 transition-colors mb-4 shadow-lg"
          >
            Lancer la partie 🚀
          </button>
        )}

        {!isHost && room.players.length === 2 && (
          <p className="text-gray-500 text-sm mb-4 animate-pulse">En attente de l'hôte pour démarrer…</p>
        )}

        <QuitButton onLeave={onLeave} />
      </div>
    );
  }

  // ── SELECTION ─────────────────────────────────────────────────────
  if (room.phase === "selection") {
    const hasSelected = me?.hasSelected ?? false;
    return (
      <div className="min-h-screen flex flex-col px-4 py-6"
           style={{ background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #ff9a9e 100%)" }}>
        {zoomedChar && <ZoomModal char={zoomedChar} onClose={() => setZoomedChar(null)} />}

        <div className="max-w-2xl mx-auto w-full">
          <div className="text-center mb-4">
            <div className="text-3xl font-black text-rose-700">Choisissez votre personnage secret</div>
            <p className="text-gray-600 text-sm mt-1">L'adversaire devra deviner qui vous avez choisi !</p>
            {room.theme && (
              <span className="inline-block mt-1 text-xs bg-rose-100 text-rose-700 px-3 py-1 rounded-full font-semibold">
                🎭 Thème : {room.theme}
              </span>
            )}
          </div>

          {hasSelected ? (
            <div className="bg-white/90 rounded-2xl p-6 text-center shadow mb-4">
              <div className="flex flex-col items-center gap-2 mb-3">
                <CharacterAvatar char={mySecretChar!} size="lg" />
                <div className="font-black text-rose-700 text-xl">{mySecretChar?.name}</div>
              </div>

              {room.bothSelected ? (
                isHost ? (
                  <div>
                    <p className="text-green-700 font-bold mb-3">Les deux joueurs ont choisi ! 🎉</p>
                    <button
                      onClick={handleStartGame}
                      className="w-full py-3.5 bg-rose-600 text-white font-black rounded-xl text-lg hover:bg-rose-700 transition-colors shadow-lg"
                    >
                      Lancer la partie 🚀
                    </button>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm animate-pulse">
                    Les deux joueurs ont choisi. En attente de l'hôte pour lancer…
                  </p>
                )
              ) : (
                <p className="text-gray-500 text-sm animate-pulse">En attente de l'adversaire…</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mb-4">
              {room.characters.map(char => (
                <CharacterCard
                  key={char.id}
                  char={char}
                  onSelect={() => handleSelectCharacter(char.id)}
                />
              ))}
            </div>
          )}

          <div className="flex justify-center mt-4">
            <QuitButton onLeave={onLeave} />
          </div>
        </div>
      </div>
    );
  }

  // ── PLAYING ───────────────────────────────────────────────────────
  if (room.phase === "playing") {
    const isAnswering = room.questionState === "asked" && !isMyTurn;
    const canAsk = isMyTurn && room.questionState === "idle";
    const canNextTurn = isMyTurn && room.questionState === "answered";

    return (
      <div className="min-h-screen flex flex-col px-3 py-3"
           style={{ background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #ff9a9e 100%)" }}>
        {zoomedChar && <ZoomModal char={zoomedChar} onClose={() => setZoomedChar(null)} />}

        <div className="max-w-2xl mx-auto w-full space-y-3">
          {/* Header */}
          <div className="bg-white/95 rounded-2xl px-4 py-3 flex items-center justify-between shadow">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔍</span>
              <span className="font-black text-rose-700">Qui est-ce ?</span>
            </div>
            {/* Turn indicator — more visible */}
            <div>
              {isMyTurn ? (
                <span className="bg-rose-600 text-white font-black text-sm px-3 py-1.5 rounded-full shadow">
                  🎯 Ton tour !
                </span>
              ) : (
                <span className="bg-gray-700 text-white font-bold text-sm px-3 py-1.5 rounded-full shadow">
                  ⏳ Tour de {opponent?.name}
                </span>
              )}
            </div>
            <QuitButton onLeave={onLeave} />
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

          {/* "Réfléchit" banner — more visible when waiting */}
          {!isMyTurn && room.questionState === "idle" && (
            <div className="bg-gray-800 text-white rounded-2xl px-4 py-3 text-center shadow font-bold text-base animate-pulse">
              ⏳ {opponent?.name} réfléchit…
            </div>
          )}

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

            {room.questionState === "asked" && (
              <div>
                <div className="font-bold text-gray-700 mb-1 text-sm">
                  {isMyTurn ? "Tu as posé :" : `${opponent?.name} demande :`}
                </div>
                <div className="bg-rose-50 rounded-xl px-4 py-2 text-rose-800 font-medium mb-3 text-sm">
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
                <div className="bg-rose-50 rounded-xl px-4 py-2 text-rose-800 font-medium mb-2 text-sm">
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

          {/* Question history */}
          {room.questionHistory && room.questionHistory.length > 0 && (
            <div className="bg-white/90 rounded-2xl shadow overflow-hidden">
              <button
                onClick={() => setShowHistory(h => !h)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                <span>📜 Historique des questions ({room.questionHistory.length})</span>
                <span>{showHistory ? "▲" : "▼"}</span>
              </button>
              {showHistory && (
                <div className="px-4 pb-3 space-y-1 max-h-40 overflow-y-auto">
                  {room.questionHistory.map((q, i) => (
                    <div key={i} className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-1.5">
                      {i + 1}. {q}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Character board */}
          <div className="bg-white/90 rounded-2xl p-3 shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-gray-700 text-sm">
                Personnages
                <span className="text-xs text-gray-400 font-normal ml-1">— ✕ éliminer · clic supposition · 🔍 zoom</span>
              </div>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {room.characters.map(char => {
                const isEliminated = myEliminated.includes(char.id);
                return (
                  <CharacterCard
                    key={char.id}
                    char={char}
                    eliminated={isEliminated}
                    selected={selectedGuessId === char.id}
                    onToggleEliminate={() => handleToggleEliminate(char.id)}
                    onSelect={!isEliminated ? () => {
                      setSelectedGuessId(prev => prev === char.id ? null : char.id);
                    } : undefined}
                    onZoom={() => setZoomedChar(char)}
                    size="sm"
                  />
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

  // ── GAME OVER ─────────────────────────────────────────────────────
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
          {room.winnerReason && (
            <p className="text-gray-500 text-sm mb-4 font-medium">{winnerReasonLabel(room.winnerReason)}</p>
          )}

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
              className="w-full py-3 bg-rose-600 text-white font-black rounded-xl text-lg hover:bg-rose-700 transition-colors mb-4"
            >
              Rejouer 🔄
            </button>
          ) : (
            <p className="text-gray-500 text-sm mb-4 animate-pulse">En attente de l'hôte…</p>
          )}

          <QuitButton onLeave={onLeave} />
        </div>
      </div>
    );
  }

  return null;
}
