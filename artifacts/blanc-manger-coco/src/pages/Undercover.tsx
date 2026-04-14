import { useMemo, useState } from "react";
import type { SendMessage, UCRoom } from "../hooks/useWebSocket";

interface Props {
  room: UCRoom;
  playerId: string;
  send: SendMessage;
  error: string | null;
  onLeave: () => void;
}

export function Undercover({ room, playerId, send, error, onLeave }: Props) {
  const [copied, setCopied] = useState(false);
  const [clue, setClue] = useState("");
  const [chatText, setChatText] = useState("");
  const isHost = room.hostId === playerId;
  const me = room.players.find((player) => player.id === playerId);
  const alivePlayers = room.players.filter((player) => player.isAlive);
  const eliminated = room.players.find(
    (player) => player.id === room.eliminatedPlayerId,
  );
  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${room.code}`;
  const votesByTarget = useMemo(() => {
    const counts = new Map<string, number>();
    Object.values(room.lastVotes || {}).forEach((targetId) =>
      counts.set(targetId, (counts.get(targetId) || 0) + 1),
    );
    return counts;
  }, [room.lastVotes]);

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

  if (room.phase === "lobby") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-start px-4 py-8"
        style={{
          background:
            "linear-gradient(135deg, #111827 0%, #312e81 55%, #581c87 100%)",
        }}
      >
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🕵️</div>
          <h1 className="text-4xl font-black text-white">Undercover</h1>
          <p className="text-purple-200 text-sm mt-1">
            Trouve les imposteurs avant qu'ils ne prennent le contrôle.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-2xl p-5 w-full max-w-sm mb-4 text-center border border-white/10">
          <p className="text-xs font-bold text-purple-200 uppercase tracking-widest mb-1">
            Code de la salle
          </p>
          <div className="text-5xl font-black tracking-[0.35em] text-white mb-3">
            {room.code}
          </div>
          <button
            onClick={copyLink}
            className="w-full py-2.5 rounded-xl font-bold text-sm bg-purple-500 hover:bg-purple-400 text-white transition-colors"
          >
            {copied ? "✅ Lien copié !" : "🔗 Copier le lien d'invitation"}
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">
            Partage ce lien pour inviter des amis
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-5 w-full max-w-sm mb-4">
          <h2 className="font-black text-gray-700 mb-3 text-sm uppercase tracking-wide">
            Joueurs ({room.players.length}/12)
          </h2>
          <div className="space-y-2">
            {room.players.map((player) => (
              <div
                key={player.id}
                className={`flex items-center gap-3 p-2.5 rounded-xl ${player.id === playerId ? "bg-purple-50 border-2 border-purple-200" : "bg-gray-50"}`}
              >
                <span className="text-2xl">{player.avatar || "🐱"}</span>
                <span className="flex-1 font-bold text-sm text-gray-800">
                  {player.name}
                </span>
                {!player.isConnected && (
                  <span className="text-xs text-gray-400">⚪ hors ligne</span>
                )}
                {player.id === room.hostId && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">
                    Hôte
                  </span>
                )}
                {player.id === playerId && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                    Toi
                  </span>
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

        {isHost && (
          <div className="bg-white rounded-2xl shadow-lg p-5 w-full max-w-sm mb-4">
            <label className="block text-xs font-black text-gray-600 uppercase tracking-wide mb-2">
              Nombre d'Undercover
            </label>
            <select
              value={Math.min(
                room.undercoverCount,
                Math.max(1, room.players.length - 1),
              )}
              onChange={(event) =>
                send({
                  type: "UC_SET_UNDERCOVER_COUNT",
                  count: Number(event.target.value),
                })
              }
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
            >
              {Array.from(
                { length: Math.max(1, Math.min(5, room.players.length - 1)) },
                (_, index) => index + 1,
              ).map((count) => (
                <option key={count} value={count}>
                  {count} Undercover{count > 1 ? "s" : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              Il restera toujours au moins un civil.
            </p>
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
          className="mt-3 text-sm text-purple-100 hover:text-red-200 font-semibold py-2 px-5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
        >
          🚪 Quitter la salle
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background:
          "linear-gradient(135deg, #0f172a 0%, #312e81 55%, #4c1d95 100%)",
      }}
    >
      <header className="px-4 py-3 bg-black/30 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-white font-black text-lg">🕵️ Undercover</h1>
          <p className="text-purple-200 text-xs">
            Salle {room.code} · Tour {room.roundNumber}
          </p>
        </div>
        <button
          onClick={onLeave}
          className="text-xs font-semibold py-1.5 px-3 rounded-xl bg-white/10 text-purple-100 hover:bg-red-500/20 hover:text-red-200 transition-colors"
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

        <section className="bg-white rounded-3xl shadow-xl p-5 text-center">
          {room.phase === "reveal" && (
            <>
              <p className="text-xs font-black text-purple-500 uppercase tracking-widest mb-2">
                Ton mot secret
              </p>
              <div className="text-4xl font-black text-gray-900 mb-2">
                {me?.word}
              </div>
              <p className="text-gray-500 text-sm mb-4">
                Ne le montre à personne. Donne ensuite un indice assez discret.
              </p>
              <button
                onClick={() => send({ type: "UC_SEEN" })}
                disabled={me?.hasSeenWord}
                className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:bg-gray-300 text-white font-black transition-colors"
              >
                {me?.hasSeenWord
                  ? "✅ Mot gardé à l'écran"
                  : "Je garde ce mot affiché"}
              </button>
              <p className="text-xs text-gray-400 mt-3">
                {room.players.filter((player) => player.hasSeenWord).length}/
                {alivePlayers.length} joueurs prêts
              </p>
            </>
          )}

          {room.phase === "clue" && (
            <>
              <p className="text-xs font-black text-purple-500 uppercase tracking-widest mb-2">
                Ton mot
              </p>
              <div className="text-3xl font-black text-gray-900 mb-4">
                {me?.word}
              </div>
              {me?.clue ? (
                <p className="bg-green-50 text-green-700 rounded-xl px-4 py-3 font-bold">
                  Ton indice : {me.clue}
                </p>
              ) : me?.isAlive ? (
                <div className="flex gap-2">
                  <input
                    value={clue}
                    onChange={(event) => setClue(event.target.value)}
                    maxLength={40}
                    placeholder="Ton indice en un mot ou courte phrase"
                    className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  <button
                    onClick={submitClue}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 rounded-xl"
                  >
                    Envoyer
                  </button>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">
                  Tu es éliminé, observe la partie.
                </p>
              )}
            </>
          )}

          {room.phase === "voting" && (
            <>
              <p className="text-xs font-black text-purple-500 uppercase tracking-widest mb-2">
                Ton mot
              </p>
              <div className="text-3xl font-black text-gray-900 mb-4">
                {me?.word}
              </div>
              <p className="text-xs font-black text-purple-500 uppercase tracking-widest mb-2">
                Vote
              </p>
              <h2 className="text-2xl font-black text-gray-900 mb-2">
                Qui est Undercover ?
              </h2>
              <p className="text-gray-500 text-sm">
                Discutez dans le chat, défendez-vous, puis votez contre le
                joueur le plus suspect.
              </p>
            </>
          )}

          {room.phase === "round-result" && (
            <>
              <p className="text-xs font-black text-purple-500 uppercase tracking-widest mb-2">
                Résultat du vote
              </p>
              <h2 className="text-2xl font-black text-gray-900 mb-2">
                {eliminated?.avatar} {eliminated?.name} est éliminé
              </h2>
              <p
                className={`font-black ${eliminated?.role === "undercover" ? "text-purple-600" : "text-rose-600"}`}
              >
                {eliminated?.role === "undercover"
                  ? "C'était un Undercover !"
                  : "C'était un Civil..."}
              </p>
              {isHost ? (
                <button
                  onClick={() => send({ type: "UC_NEXT_ROUND" })}
                  className="mt-4 w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black"
                >
                  Tour suivant
                </button>
              ) : (
                <p className="text-gray-500 text-sm mt-4">
                  En attente que l'hôte lance le tour suivant...
                </p>
              )}
            </>
          )}

          {room.phase === "game-over" && (
            <>
              <p className="text-xs font-black text-purple-500 uppercase tracking-widest mb-2">
                Fin de partie
              </p>
              <h2 className="text-3xl font-black text-gray-900 mb-2">
                {room.winnerTeam === "civilians"
                  ? "Les Civils gagnent !"
                  : "Les Undercover gagnent !"}
              </h2>
              <p className="text-gray-500 text-sm mb-4">
                Mot civil : <strong>{room.civilianWord}</strong> · Mot
                undercover : <strong>{room.undercoverWord}</strong>
              </p>
              {isHost ? (
                <button
                  onClick={() => send({ type: "UC_RESET" })}
                  className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black"
                >
                  🔄 Rejouer
                </button>
              ) : (
                <p className="text-gray-500 text-sm">
                  En attente que l'hôte relance...
                </p>
              )}
            </>
          )}
        </section>

        {room.phase === "voting" && (
          <section className="bg-white rounded-3xl shadow-xl p-4">
            <h2 className="font-black text-gray-800 text-sm uppercase tracking-wide mb-3">
              Chat de défense
            </h2>
            <div className="space-y-2 max-h-56 overflow-y-auto mb-3">
              {room.chatMessages.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  Aucun message pour le moment.
                </p>
              ) : (
                room.chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-2xl px-3 py-2 ${message.playerId === playerId ? "bg-purple-50 ml-8" : "bg-gray-100 mr-8"}`}
                  >
                    <p className="text-xs font-black text-gray-500 mb-1">
                      {message.avatar} {message.playerName}
                    </p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                      {message.text}
                    </p>
                  </div>
                ))
              )}
            </div>
            {me?.isAlive ? (
              <div className="flex gap-2">
                <input
                  value={chatText}
                  onChange={(event) => setChatText(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && submitChat()}
                  maxLength={220}
                  placeholder="Écris pour te défendre..."
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <button
                  onClick={submitChat}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 rounded-xl"
                >
                  Envoyer
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center">
                Tu es éliminé, tu peux lire le chat mais pas écrire.
              </p>
            )}
          </section>
        )}

        <section className="bg-white/10 backdrop-blur rounded-3xl p-4 border border-white/10">
          <h2 className="text-white font-black text-sm uppercase tracking-wide mb-3">
            Joueurs
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {room.players.map((player) => {
              const isMe = player.id === playerId;
              const voted = !!player.voteTargetId;
              const voteCount = votesByTarget.get(player.id) || 0;
              return (
                <div
                  key={player.id}
                  className={`rounded-2xl p-3 ${player.isAlive ? "bg-white" : "bg-white/40 opacity-70"}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{player.avatar}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-800 truncate">
                        {player.name} {isMe ? "(toi)" : ""}
                      </p>
                      <p className="text-xs text-gray-400">
                        {player.isAlive
                          ? "En jeu"
                          : `Éliminé · ${player.role === "undercover" ? "Undercover" : "Civil"}`}
                      </p>
                    </div>
                    {room.phase === "voting" && voted && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                        A voté
                      </span>
                    )}
                    {voteCount > 0 && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                        {voteCount}
                      </span>
                    )}
                  </div>
                  {player.clue && (
                    <p className="text-sm bg-gray-100 rounded-xl px-3 py-2 text-gray-700">
                      Indice : <strong>{player.clue}</strong>
                    </p>
                  )}
                  {room.phase === "voting" &&
                    me?.isAlive &&
                    player.isAlive &&
                    player.id !== playerId &&
                    !me.voteTargetId && (
                      <button
                        onClick={() =>
                          send({ type: "UC_VOTE", targetId: player.id })
                        }
                        className="mt-2 w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold"
                      >
                        Voter contre {player.name}
                      </button>
                    )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
