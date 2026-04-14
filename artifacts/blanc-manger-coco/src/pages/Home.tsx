import { useState, useEffect, useRef } from "react";
import type { SendMessage } from "../hooks/useWebSocket";
import { AVATARS, DEFAULT_AVATAR } from "../data/avatars";

interface HomeProps {
  error: string | null;
  connected: boolean;
  onCreateRoom: (name: string, avatar: string, gameType: "bmc" | "connect4") => void;
  onJoinRoom: (code: string, name: string, avatar: string) => void;
  onQuickMatch: (name: string, avatar: string, gameType: "bmc" | "connect4") => void;
  setMyPlayerId: (id: string) => void;
  send: SendMessage;
  initialCode?: string;
}

const RULES_BMC = [
  { n: "1", text: <>3 joueurs minimum. Chacun reçoit <strong>11 cartes réponses</strong>.</> },
  { n: "2", text: <>Le <strong>Question Master</strong> lit une carte à trou.</> },
  { n: "3", text: <>Les autres posent leur meilleure carte face cachée.</> },
  { n: "4", text: <>Le QM choisit la <strong>réponse la plus drôle</strong> → 1 point !</> },
  { n: "5", text: <>Le gagnant devient QM. Premier à <strong>5 pts</strong> gagne !</> },
];

const RULES_C4 = [
  { n: "1", text: <>2 joueurs. Chacun a sa couleur (<strong>🔴 rouge</strong> vs <strong>🟡 jaune</strong>).</> },
  { n: "2", text: <>À tour de rôle, choisissez une <strong>colonne</strong> pour lâcher votre jeton.</> },
  { n: "3", text: <>Le jeton tombe en bas de la colonne.</> },
  { n: "4", text: <>Le premier à aligner <strong>4 jetons</strong> (horizontal, vertical ou diagonal) gagne !</> },
  { n: "5", text: <>Si la grille est pleine sans gagnant, c'est une <strong>égalité</strong>.</> },
];

const GAME_MODES = [
  { id: "bmc" as const,      icon: "🃏", label: "Blanc Manger Coco", sub: "3–10 joueurs" },
  { id: "connect4" as const, icon: "🔴", label: "Puissance 4",       sub: "2 joueurs"   },
];

export function Home({ error, connected, onCreateRoom, onJoinRoom, onQuickMatch, initialCode, setMyPlayerId }: HomeProps) {
  const [gameMode, setGameMode] = useState<"bmc" | "connect4">("bmc");
  const [modeOpen, setModeOpen] = useState(false);
  const modeRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"play" | "create" | "join">(initialCode ? "join" : "play");
  const [name, setName] = useState(() => sessionStorage.getItem("bmc_player_name") || "");
  const [avatar, setAvatar] = useState(() => sessionStorage.getItem("bmc_player_avatar") || DEFAULT_AVATAR);
  const [code, setCode] = useState(initialCode || "");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!modeOpen) return;
    const handler = (e: MouseEvent) => {
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) setModeOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modeOpen]);

  const avatarIndex = AVATARS.findIndex(a => a.emoji === avatar);
  const currentIndex = avatarIndex === -1 ? 0 : avatarIndex;

  const goTo = (idx: number) => {
    const next = (idx + AVATARS.length) % AVATARS.length;
    setAvatar(AVATARS[next].emoji);
    sessionStorage.setItem("bmc_player_avatar", AVATARS[next].emoji);
  };

  useEffect(() => {
    if (initialCode) { setTab("join"); setCode(initialCode); }
  }, [initialCode]);

  const genId = () => {
    const id = Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem("bmc_player_id", id);
    setMyPlayerId(id);
    return id;
  };

  const handleQuickMatch = () => {
    const trimmed = name.trim();
    if (!trimmed) { setLocalError("Entre ton prénom pour jouer !"); return; }
    setLocalError("");
    genId();
    onQuickMatch(trimmed, avatar, gameMode);
  };

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) { setLocalError("Entre ton prénom pour jouer !"); return; }
    setLocalError("");
    genId();
    onCreateRoom(trimmed, avatar, gameMode);
  };

  const handleJoin = () => {
    const trimmed = name.trim();
    const codeUp = code.trim().toUpperCase();
    if (!trimmed) { setLocalError("Entre ton prénom pour jouer !"); return; }
    if (!codeUp || codeUp.length !== 4) { setLocalError("Entre un code de salle valide (4 caractères)."); return; }
    setLocalError("");
    genId();
    onJoinRoom(codeUp, trimmed, avatar);
  };

  const displayError = error || localError;
  const rules = gameMode === "bmc" ? RULES_BMC : RULES_C4;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
         style={{ background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #ff9a9e 100%)" }}>

      {/* Logo */}
      <div className="text-center mb-6" style={{ transition: "all 0.3s ease" }}>
        {gameMode === "bmc" ? (
          <>
            <div className="text-6xl mb-2">🥥</div>
            <h1 className="text-5xl font-black mb-1"
                style={{ fontFamily: "Pacifico, cursive", color: "#c2185b", textShadow: "2px 2px 0px #f8bbd0" }}>
              Blanc Manger
            </h1>
            <h1 className="text-5xl font-black mb-3"
                style={{ fontFamily: "Pacifico, cursive", color: "#e64a19", textShadow: "2px 2px 0px #ffccbc" }}>
              Coco
            </h1>
            <p className="text-sm font-semibold text-rose-700 bg-white/60 rounded-full px-5 py-1.5 inline-block">
              🃏 Le jeu de cartes déjanté !
            </p>
          </>
        ) : (
          <>
            <div className="text-6xl mb-2">🔴🟡</div>
            <h1 className="text-5xl font-black mb-3 whitespace-nowrap"
                style={{ fontFamily: "Pacifico, cursive", color: "#4338ca", textShadow: "2px 2px 0px #c7d2fe" }}>
              Puissance 4
            </h1>
            <p className="text-sm font-semibold text-indigo-700 bg-white/60 rounded-full px-5 py-1.5 inline-block">
              ⚡ Aligne 4 jetons et gagne !
            </p>
          </>
        )}
      </div>

      {!connected && (
        <div className="mb-4 px-4 py-2 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-full text-sm font-semibold flex items-center gap-2">
          <span className="animate-spin inline-block">⏳</span> Connexion au serveur...
        </div>
      )}

      {/* Game mode dropdown */}
      <div ref={modeRef} className="w-full max-w-sm mb-4 relative">
        <p className="text-xs font-bold text-rose-800 uppercase tracking-wide mb-2 text-center">Mode de jeu</p>
        <button
          type="button"
          onClick={() => setModeOpen(o => !o)}
          className="w-full flex items-center gap-3 bg-white/90 border-2 border-white hover:border-rose-300 rounded-2xl px-4 py-3 shadow-md transition-colors focus:outline-none focus:border-rose-400"
        >
          <span className="text-2xl">{GAME_MODES.find(m => m.id === gameMode)?.icon}</span>
          <div className="flex-1 text-left">
            <div className="font-bold text-gray-800 text-sm leading-tight">
              {GAME_MODES.find(m => m.id === gameMode)?.label}
            </div>
            <div className="text-xs text-gray-400">{GAME_MODES.find(m => m.id === gameMode)?.sub}</div>
          </div>
          <span className="text-gray-400 text-sm">{modeOpen ? "▲" : "▼"}</span>
        </button>

        {modeOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
            {GAME_MODES.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => { setGameMode(m.id); setModeOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-rose-50 ${
                  gameMode === m.id ? "bg-rose-50" : ""
                }`}
              >
                <span className="text-2xl">{m.icon}</span>
                <div className="flex-1">
                  <div className={`font-bold text-sm ${gameMode === m.id ? "text-rose-600" : "text-gray-800"}`}>
                    {m.label}
                  </div>
                  <div className="text-xs text-gray-400">{m.sub}</div>
                </div>
                {gameMode === m.id && <span className="text-rose-500 text-sm font-black">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Card */}
      <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            data-testid="tab-play"
            onClick={() => setTab("play")}
            className={`flex-1 py-3 text-xs font-bold transition-colors ${
              tab === "play" ? "text-rose-600 border-b-2 border-rose-600 bg-rose-50" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            🎲 Jouer
          </button>
          <button
            data-testid="tab-create"
            onClick={() => setTab("create")}
            className={`flex-1 py-3 text-xs font-bold transition-colors ${
              tab === "create" ? "text-rose-600 border-b-2 border-rose-600 bg-rose-50" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            ➕ Créer
          </button>
          <button
            data-testid="tab-join"
            onClick={() => setTab("join")}
            className={`flex-1 py-3 text-xs font-bold transition-colors ${
              tab === "join" ? "text-rose-600 border-b-2 border-rose-600 bg-rose-50" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            🔑 Rejoindre
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Avatar carousel */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Ton avatar</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goTo(currentIndex - 1)}
                className="w-9 h-9 rounded-full bg-rose-100 hover:bg-rose-200 active:scale-90 flex items-center justify-center text-rose-600 font-black text-lg transition-all flex-shrink-0"
              >
                ‹
              </button>

              <div className="flex-1 flex items-center justify-center gap-2 py-1">
                {[-2, -1, 0, 1, 2].map(offset => {
                  const idx = (currentIndex + offset + AVATARS.length) % AVATARS.length;
                  const av = AVATARS[idx];
                  const isCenter = offset === 0;
                  const dist = Math.abs(offset);
                  return (
                    <button
                      key={`${offset}-${av.emoji}`}
                      type="button"
                      onClick={() => goTo(idx)}
                      title={av.label}
                      style={{
                        fontSize: isCenter ? "1.9rem" : dist === 1 ? "1.4rem" : "1rem",
                        opacity: isCenter ? 1 : dist === 1 ? 0.55 : 0.25,
                        transition: "all 0.18s ease",
                        width: isCenter ? "3rem" : dist === 1 ? "2.2rem" : "1.8rem",
                        height: isCenter ? "3rem" : dist === 1 ? "2.2rem" : "1.8rem",
                        borderRadius: "0.75rem",
                        background: isCenter ? "linear-gradient(135deg,#fce7f3,#fecdd3)" : "transparent",
                        outline: isCenter ? "2.5px solid #f43f5e" : "none",
                        outlineOffset: "2px",
                        boxShadow: isCenter ? "0 4px 14px #f43f5e44" : "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        cursor: "pointer",
                      }}
                    >
                      {av.emoji}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => goTo(currentIndex + 1)}
                className="w-9 h-9 rounded-full bg-rose-100 hover:bg-rose-200 active:scale-90 flex items-center justify-center text-rose-600 font-black text-lg transition-all flex-shrink-0"
              >
                ›
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-sm font-bold text-rose-600">{AVATARS[currentIndex].label}</span>
              <span className="text-xs text-gray-400">{currentIndex + 1}/{AVATARS.length}</span>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Ton prénom</label>
            <input
              data-testid="input-name"
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setLocalError(""); }}
              onKeyDown={e => e.key === "Enter" && (tab === "play" ? handleQuickMatch() : tab === "create" ? handleCreate() : handleJoin())}
              placeholder="Ex: Marie, Thomas..."
              maxLength={20}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-semibold focus:border-rose-400 focus:outline-none text-sm transition-colors"
            />
          </div>

          {/* Room code (join only) */}
          {tab === "join" && (
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Code de la salle</label>
              <input
                data-testid="input-code"
                type="text"
                value={code}
                onChange={e => { setCode(e.target.value.toUpperCase()); setLocalError(""); }}
                onKeyDown={e => e.key === "Enter" && handleJoin()}
                placeholder="Ex: ABCD"
                maxLength={4}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-bold text-xl tracking-[0.3em] text-center uppercase focus:border-rose-400 focus:outline-none transition-colors"
              />
            </div>
          )}

          {displayError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm font-semibold" data-testid="error-message">
              ⚠️ {displayError}
            </div>
          )}

          <button
            data-testid={tab === "play" ? "quick-match" : tab === "create" ? "create-room" : "join-room"}
            onClick={tab === "play" ? handleQuickMatch : tab === "create" ? handleCreate : handleJoin}
            disabled={!connected}
            className="w-full py-4 rounded-2xl font-black text-lg text-white shadow-lg hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #e91e63, #c2185b)" }}
          >
            {tab === "play"
              ? "Trouver une partie"
              : tab === "create"
                ? `Créer une salle ${gameMode === "connect4" ? "P4" : "BMC"}`
                : "Rejoindre la partie"}
          </button>

          {tab === "play" && (
            <p className="text-xs text-gray-500 text-center -mt-1">
              🔍 Rejoindre une salle existante, ou en créer une si aucune n'est disponible.
            </p>
          )}
        </div>
      </div>

      {/* Rules */}
      <div className="mt-6 bg-white/70 backdrop-blur rounded-2xl p-5 max-w-sm w-full">
        <h3 className="font-black text-rose-700 mb-3 text-center text-sm uppercase tracking-wide">
          Comment jouer ? {gameMode === "connect4" ? "🔴" : "🃏"}
        </h3>
        <ol className="space-y-2 text-sm text-gray-700">
          {rules.map(r => (
            <li key={r.n} className="flex gap-2">
              <span className="font-black text-rose-500 flex-shrink-0">{r.n}.</span>
              <span>{r.text}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="text-xs text-center mt-4 pb-2 tracking-wide px-4 py-2 bg-white/60 rounded-xl max-w-xs mx-auto" style={{ color: "#374151" }}>
        Support &amp; retours — Discord : <span className="font-bold" style={{ color: "#111827" }}>sousbinouz</span>
      </p>
    </div>
  );
}
