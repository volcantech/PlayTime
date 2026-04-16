import { useState, useEffect, useRef } from "react";
import type { GameType, SendMessage } from "../hooks/useWebSocket";
import { DEFAULT_AVATAR } from "../data/avatars";
import { useAvatars } from "@/hooks/useAvatars";
import { useAuth } from "../hooks/useAuth";

type AppPage = "game" | "auth" | "profile" | "leaderboard";

interface HomeProps {
  error: string | null;
  connected: boolean;
  onCreateRoom: (name: string, avatar: string, gameType: GameType, options?: { undercoverCount?: number; isPrivate?: boolean; hardMode?: boolean }) => void;
  onJoinRoom: (code: string, name: string, avatar: string) => void;
  onQuickMatch: (name: string, avatar: string, gameType: GameType) => void;
  setMyPlayerId: (id: string) => void;
  send: SendMessage;
  initialCode?: string;
  initialMode?: GameType;
  onNavigate?: (page: AppPage) => void;
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

const RULES_UNDERCOVER = [
  { n: "1", text: <>3 à 12 joueurs. La majorité reçoit le <strong>même mot secret</strong>.</> },
  { n: "2", text: <>Les Undercover reçoivent un <strong>mot proche mais différent</strong>.</> },
  { n: "3", text: <>Chacun donne un indice sans révéler son mot.</> },
  { n: "4", text: <>Tout le monde vote pour éliminer le joueur le plus suspect.</> },
  { n: "5", text: <>Les civils gagnent s'ils éliminent les Undercover. Les Undercover gagnent s'ils deviennent aussi nombreux que les civils.</> },
];

const RULES_PB = [
  { n: "1", text: <>2 joueurs minimum. Une <strong>lettre aléatoire</strong> est tirée chaque manche.</> },
  { n: "2", text: <>Chaque joueur remplit <strong>toutes les catégories</strong> avec un mot commençant par cette lettre.</> },
  { n: "3", text: <>Le premier à finir peut appuyer sur <strong>"J'ai fini !"</strong> pour arrêter le chrono.</> },
  { n: "4", text: <>Les joueurs <strong>votent</strong> pour valider ou invalider les réponses.</> },
  { n: "5", text: <>Réponse unique = <strong>2 pts</strong>, partagée = <strong>1 pt</strong>, invalide = <strong>0 pt</strong>. Le joueur avec le plus de points à la fin gagne !</> },
];

const GAME_MODES = [
  { id: "bmc" as const,       icon: "🃏", label: "Blanc Manger Coco", sub: "3–10 joueurs" },
  { id: "connect4" as const,  icon: "🔴", label: "Puissance 4",       sub: "2 joueurs"    },
  { id: "undercover" as const, icon: "🕵️", label: "Undercover",       sub: "3–12 joueurs" },
  { id: "petitbac" as const,  icon: "🔤", label: "Petit Bac",         sub: "2–10 joueurs" },
];

export function Home({ error, connected, onCreateRoom, onJoinRoom, onQuickMatch, initialCode, initialMode, setMyPlayerId, onNavigate }: HomeProps) {
  const AVATARS = useAvatars();
  const { user } = useAuth();
  const [gameMode, setGameMode] = useState<GameType>(initialMode || "bmc");
  const [modeOpen, setModeOpen] = useState(false);
  const modeRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"play" | "create" | "join">(initialCode ? "join" : "play");
  const [name, setName] = useState(() => user?.username || sessionStorage.getItem("bmc_player_name") || "");
  const [avatar, setAvatar] = useState(() => user?.avatar || sessionStorage.getItem("bmc_player_avatar") || DEFAULT_AVATAR);

  useEffect(() => {
    if (user) {
      setName(prev => prev === (sessionStorage.getItem("bmc_player_name") || "") ? user.username : prev);
      setAvatar(prev => prev === (sessionStorage.getItem("bmc_player_avatar") || DEFAULT_AVATAR) ? user.avatar : prev);
    }
  }, [user?.username, user?.avatar]);

  const [code, setCode] = useState(initialCode || "");
  const [localError, setLocalError] = useState("");
  const [undercoverCount, setUndercoverCount] = useState(1);
  const [isPrivate, setIsPrivate] = useState(false);
  const [enabledGames, setEnabledGames] = useState<Record<string, boolean>>({ bmc: true, connect4: true, undercover: true, petitbac: true });

  useEffect(() => {
    fetch("/api/game-settings")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setEnabledGames(data);
          setGameMode(prev => {
            if (data[prev] === false) {
              const first = GAME_MODES.find(m => data[m.id] !== false);
              return first ? first.id : prev;
            }
            return prev;
          });
        }
      })
      .catch(() => {});
  }, []);

  const availableModes = GAME_MODES.filter(m => enabledGames[m.id] !== false);

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

  useEffect(() => {
    if (initialMode) setGameMode(initialMode);
  }, [initialMode]);

  const genId = () => {
    const id = Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem("bmc_player_id", id);
    sessionStorage.setItem("bmc_player_name", name.trim());
    sessionStorage.setItem("bmc_player_avatar", avatar);
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
    const baseOptions = { isPrivate };
    onCreateRoom(trimmed, avatar, gameMode, gameMode === "undercover" ? { undercoverCount, ...baseOptions } : baseOptions);
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
  const rules = gameMode === "bmc" ? RULES_BMC : gameMode === "connect4" ? RULES_C4 : gameMode === "undercover" ? RULES_UNDERCOVER : RULES_PB;

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
        ) : gameMode === "connect4" ? (
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
        ) : gameMode === "petitbac" ? (
          <>
            <div className="text-6xl mb-2">🔤</div>
            <h1 className="text-5xl font-black mb-3 whitespace-nowrap"
                style={{ fontFamily: "Pacifico, cursive", color: "#0f766e", textShadow: "2px 2px 0px #ccfbf1" }}>
              Petit Bac
            </h1>
            <p className="text-sm font-semibold text-teal-700 bg-white/60 rounded-full px-5 py-1.5 inline-block">
              ✍️ Trouve le plus vite un mot par catégorie !
            </p>
          </>
        ) : (
          <>
            <div className="text-6xl mb-2">🕵️</div>
            <h1 className="text-5xl font-black mb-3 whitespace-nowrap"
                style={{ fontFamily: "Pacifico, cursive", color: "#4c1d95", textShadow: "2px 2px 0px #ddd6fe" }}>
              Undercover
            </h1>
            <p className="text-sm font-semibold text-purple-700 bg-white/60 rounded-full px-5 py-1.5 inline-block">
              🔍 Trouve les imposteurs !
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
            {availableModes.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => { setGameMode(m.id); setModeOpen(false); sessionStorage.setItem("bmc_last_mode", m.id); }}
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
            {user ? (
              <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
                <span className="text-3xl">{user.avatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-rose-700 truncate">Avatar de ton profil</div>
                  <div className="text-xs text-rose-500">Modifiable dans Mon profil</div>
                </div>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Ton prénom</label>
            {user ? (
              <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
                <span className="text-lg font-bold text-rose-700">{user.username}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-rose-500">Pseudo de ton compte</div>
                </div>
              </div>
            ) : (
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
            )}
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

          {/* Private room toggle (create only) */}
          {tab === "create" && (
            <button
              type="button"
              onClick={() => setIsPrivate(p => !p)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                isPrivate
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                  : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              <span className="text-lg">{isPrivate ? "🔒" : "🌐"}</span>
              <div className="flex-1 text-left">
                <div className="font-bold leading-tight">{isPrivate ? "Salle privée" : "Salle publique"}</div>
                <div className="text-xs font-normal opacity-70">
                  {isPrivate ? "Seulement les gens avec le lien/code peuvent rejoindre" : "Visible via « Trouver une partie »"}
                </div>
              </div>
              <div className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${isPrivate ? "bg-indigo-500" : "bg-gray-300"}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${isPrivate ? "left-5" : "left-0.5"}`} />
              </div>
            </button>
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
                ? `Créer une salle ${gameMode === "connect4" ? "P4" : gameMode === "undercover" ? "Undercover" : gameMode === "petitbac" ? "Petit Bac" : "BMC"}`
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
          Comment jouer ? {gameMode === "connect4" ? "🔴" : gameMode === "undercover" ? "🕵️" : gameMode === "petitbac" ? "🔤" : "🃏"}
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

      {onNavigate && (
        <button
          onClick={() => onNavigate("leaderboard")}
          className="mt-4 text-sm font-bold text-rose-800/80 hover:text-rose-900 bg-white/60 rounded-full px-5 py-2 transition-colors"
        >
          🏆 Voir le classement
        </button>
      )}

      <p className="text-xs text-center mt-4 pb-2 tracking-wide px-4 py-2 bg-white/60 rounded-xl max-w-xs mx-auto" style={{ color: "#374151" }}>
        Support &amp; retours — Discord : <span className="font-bold" style={{ color: "#111827" }}>sousbinouz</span>
      </p>
    </div>
  );
}
