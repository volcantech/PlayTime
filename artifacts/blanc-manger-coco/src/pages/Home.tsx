import { useState, useEffect, useRef } from "react";
import type { GameType, SendMessage } from "../hooks/useWebSocket";
import { DEFAULT_AVATAR } from "../data/avatars";
import { useAvatars } from "@/hooks/useAvatars";
import { useAuth } from "../hooks/useAuth";

type AppPage = "game" | "auth" | "profile" | "leaderboard";

interface HomeProps {
  error: string | null;
  connected: boolean;
  onCreateRoom: (name: string, avatar: string, gameType: GameType, options?: { undercoverCount?: number; isPrivate?: boolean; cardMode?: "normal" | "adult" | "mixed" }) => void;
  onJoinRoom: (code: string, name: string, avatar: string) => void;
  onQuickMatch: (name: string, avatar: string, gameType: GameType) => void;
  setMyPlayerId: (id: string) => void;
  send: SendMessage;
  initialCode?: string;
  initialMode?: GameType;
  onNavigate?: (page: AppPage) => void;
}

const RULES_BMC = [
  { n: "1", text: <>3 joueurs min. Chacun reçoit <strong>11 cartes réponses</strong>.</> },
  { n: "2", text: <>Le <strong>Question Master</strong> lit une carte à trou.</> },
  { n: "3", text: <>Les autres posent leur meilleure carte face cachée.</> },
  { n: "4", text: <>Le QM choisit la <strong>réponse la plus drôle</strong> → 1 point !</> },
  { n: "5", text: <>Le gagnant devient QM. Premier à <strong>5 pts</strong> gagne !</> },
];

const RULES_C4 = [
  { n: "1", text: <>2 joueurs. Chacun a sa couleur (<strong>rouge</strong> vs <strong>jaune</strong>).</> },
  { n: "2", text: <>À tour de rôle, choisissez une <strong>colonne</strong> pour lâcher votre jeton.</> },
  { n: "3", text: <>Le jeton tombe en bas de la colonne choisie.</> },
  { n: "4", text: <>Le premier à aligner <strong>4 jetons</strong> (horizontal, vertical ou diagonal) gagne !</> },
  { n: "5", text: <>Si la grille est pleine sans gagnant, c'est une <strong>égalité</strong>.</> },
];

const RULES_UNDERCOVER = [
  { n: "1", text: <>3 à 12 joueurs. La majorité reçoit le <strong>même mot secret</strong>.</> },
  { n: "2", text: <>Les Undercover reçoivent un <strong>mot proche mais différent</strong>.</> },
  { n: "3", text: <>Chacun donne un indice sans révéler son mot.</> },
  { n: "4", text: <>Tout le monde vote pour éliminer le joueur le plus suspect.</> },
  { n: "5", text: <>Les civils gagnent s'ils éliminent tous les Undercover !</> },
];

const RULES_PB = [
  { n: "1", text: <>2 joueurs minimum. Une <strong>lettre aléatoire</strong> est tirée chaque manche.</> },
  { n: "2", text: <>Chaque joueur remplit <strong>toutes les catégories</strong> avec un mot par cette lettre.</> },
  { n: "3", text: <>Le premier à finir appuie sur <strong>"J'ai fini !"</strong> pour arrêter le chrono.</> },
  { n: "4", text: <>Les joueurs <strong>votent</strong> pour valider ou invalider les réponses.</> },
  { n: "5", text: <>Réponse unique = <strong>2 pts</strong>, partagée = <strong>1 pt</strong>, invalide = <strong>0 pt</strong>.</> },
];

const RULES_GW = [
  { n: "1", text: <>Jeu en <strong>1v1</strong>. Chaque joueur choisit secrètement un personnage.</> },
  { n: "2", text: <>À tour de rôle, posez une <strong>question fermée</strong> (oui/non).</> },
  { n: "3", text: <>Éliminez les personnages qui ne correspondent pas aux réponses.</> },
  { n: "4", text: <>Faites une <strong>supposition</strong> quand vous êtes prêt. Bonne supposition = victoire !</> },
];

const GAME_MODES = [
  {
    id: "bmc" as const,
    icon: "🃏",
    label: "Blanc Manger Coco",
    sub: "3–10 joueurs",
    accent: "#e91e63",
    accentDark: "#c2185b",
    glow: "rgba(233,30,99,0.35)",
    bg: "linear-gradient(135deg, #880e4f, #c2185b)",
  },
  {
    id: "connect4" as const,
    icon: "🔴",
    label: "Puissance 4",
    sub: "2 joueurs",
    accent: "#3b82f6",
    accentDark: "#2563eb",
    glow: "rgba(59,130,246,0.35)",
    bg: "linear-gradient(135deg, #1e3a8a, #2563eb)",
  },
  {
    id: "undercover" as const,
    icon: "🕵️",
    label: "Undercover",
    sub: "3–12 joueurs",
    accent: "#a855f7",
    accentDark: "#7c3aed",
    glow: "rgba(168,85,247,0.35)",
    bg: "linear-gradient(135deg, #4c1d95, #7c3aed)",
  },
  {
    id: "petitbac" as const,
    icon: "🔤",
    label: "Petit Bac",
    sub: "2–10 joueurs",
    accent: "#14b8a6",
    accentDark: "#0d9488",
    glow: "rgba(20,184,166,0.35)",
    bg: "linear-gradient(135deg, #134e4a, #0d9488)",
  },
  {
    id: "guess_who" as const,
    icon: "🔍",
    label: "Qui est-ce ?",
    sub: "2 joueurs",
    accent: "#06b6d4",
    accentDark: "#0891b2",
    glow: "rgba(6,182,212,0.35)",
    bg: "linear-gradient(135deg, #164e63, #0891b2)",
  },
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
  const [enabledGames, setEnabledGames] = useState<Record<string, boolean>>({ bmc: true, connect4: true, undercover: true, petitbac: true, guess_who: true });

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
  const currentMode = GAME_MODES.find(m => m.id === gameMode) || GAME_MODES[0];

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
  const rules = gameMode === "bmc" ? RULES_BMC : gameMode === "connect4" ? RULES_C4 : gameMode === "undercover" ? RULES_UNDERCOVER : gameMode === "guess_who" ? RULES_GW : RULES_PB;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #07071a 0%, #0d0d2b 50%, #080f1f 100%)" }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-700"
        style={{
          background: `radial-gradient(ellipse 60% 50% at 50% 10%, ${currentMode.glow}, transparent 70%)`,
        }}
      />

      {/* Nav links */}
      <div className="absolute top-4 left-4 flex items-center gap-3 z-20">
        <button
          onClick={() => onNavigate?.("leaderboard")}
          className="flex items-center gap-1.5 text-white/50 hover:text-white/90 text-xs font-semibold transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10"
        >
          🏆 Classement
        </button>
      </div>

      <div className="w-full max-w-sm relative z-10">

        {/* Hero */}
        <div className="text-center mb-7">
          <div className="text-5xl mb-3 drop-shadow-lg">{currentMode.icon}</div>
          <h1
            className="text-4xl font-black mb-1 tracking-tight text-gradient"
            style={{ backgroundImage: `linear-gradient(135deg, #fff 30%, ${currentMode.accent})` }}
          >
            {currentMode.label}
          </h1>
          <p className="text-sm font-medium" style={{ color: currentMode.accent + "cc" }}>
            {currentMode.sub}
          </p>
        </div>

        {!connected && (
          <div className="mb-4 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
            style={{ background: "rgba(234,179,8,0.15)", color: "#fbbf24", border: "1px solid rgba(234,179,8,0.3)" }}>
            <span className="animate-spin inline-block">⏳</span> Connexion au serveur...
          </div>
        )}

        {/* Game mode selector */}
        <div ref={modeRef} className="mb-4 relative">
          <button
            type="button"
            onClick={() => setModeOpen(o => !o)}
            className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all focus:outline-none"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              backdropFilter: "blur(12px)",
            }}
          >
            <span className="text-2xl">{currentMode.icon}</span>
            <div className="flex-1 text-left">
              <div className="font-bold text-white text-sm">{currentMode.label}</div>
              <div className="text-xs" style={{ color: currentMode.accent + "aa" }}>{currentMode.sub}</div>
            </div>
            <div className="text-white/40 text-sm flex-shrink-0">{modeOpen ? "▲" : "▼"}</div>
          </button>

          {modeOpen && (
            <div
              className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: "rgba(15,15,35,0.95)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)" }}
            >
              {availableModes.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setGameMode(m.id); setModeOpen(false); sessionStorage.setItem("bmc_last_mode", m.id); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all hover:bg-white/[0.06]"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <span className="text-2xl">{m.icon}</span>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-white">{m.label}</div>
                    <div className="text-xs text-white/40">{m.sub}</div>
                  </div>
                  {gameMode === m.id && (
                    <span className="text-sm font-black flex-shrink-0" style={{ color: m.accent }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main Card */}
        <div
          className="rounded-2xl overflow-hidden mb-4"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Tabs */}
          <div className="flex" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {[
              { key: "play" as const, label: "Jouer", icon: "🎲" },
              { key: "create" as const, label: "Créer", icon: "➕" },
              { key: "join" as const, label: "Rejoindre", icon: "🔑" },
            ].map(t => (
              <button
                key={t.key}
                data-testid={`tab-${t.key === "play" ? "play" : t.key === "create" ? "create" : "join"}`}
                onClick={() => setTab(t.key)}
                className="flex-1 py-3.5 text-xs font-bold transition-all"
                style={{
                  color: tab === t.key ? currentMode.accent : "rgba(255,255,255,0.35)",
                  borderBottom: tab === t.key ? `2px solid ${currentMode.accent}` : "2px solid transparent",
                  background: tab === t.key ? `${currentMode.accent}11` : "transparent",
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-4">
            {/* Avatar */}
            <div>
              <label className="block text-xs font-bold text-white/40 mb-2 uppercase tracking-wider">Avatar</label>
              {user ? (
                <div className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: `${currentMode.accent}15`, border: `1px solid ${currentMode.accent}30` }}>
                  <span className="text-3xl">{user.avatar}</span>
                  <div>
                    <div className="text-sm font-bold text-white/80">Avatar de ton profil</div>
                    <div className="text-xs text-white/40">Modifiable dans Mon profil</div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => goTo(currentIndex - 1)}
                      className="w-9 h-9 rounded-full flex items-center justify-center font-black text-lg transition-all active:scale-90 flex-shrink-0"
                      style={{ background: `${currentMode.accent}20`, color: currentMode.accent }}
                    >‹</button>
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
                              opacity: isCenter ? 1 : dist === 1 ? 0.5 : 0.2,
                              transition: "all 0.18s ease",
                              width: isCenter ? "3rem" : dist === 1 ? "2.2rem" : "1.8rem",
                              height: isCenter ? "3rem" : dist === 1 ? "2.2rem" : "1.8rem",
                              borderRadius: "0.75rem",
                              background: isCenter ? `${currentMode.accent}25` : "transparent",
                              outline: isCenter ? `2px solid ${currentMode.accent}` : "none",
                              outlineOffset: "2px",
                              boxShadow: isCenter ? `0 4px 14px ${currentMode.glow}` : "none",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              flexShrink: 0, cursor: "pointer",
                            }}
                          >{av.emoji}</button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => goTo(currentIndex + 1)}
                      className="w-9 h-9 rounded-full flex items-center justify-center font-black text-lg transition-all active:scale-90 flex-shrink-0"
                      style={{ background: `${currentMode.accent}20`, color: currentMode.accent }}
                    >›</button>
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-1.5">
                    <span className="text-sm font-bold" style={{ color: currentMode.accent }}>{AVATARS[currentIndex].label}</span>
                    <span className="text-xs text-white/30">{currentIndex + 1}/{AVATARS.length}</span>
                  </div>
                </>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-white/40 mb-1.5 uppercase tracking-wider">Prénom</label>
              {user ? (
                <div className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: `${currentMode.accent}15`, border: `1px solid ${currentMode.accent}30` }}>
                  <span className="text-lg font-bold text-white">{user.username}</span>
                  <span className="text-xs text-white/40">Pseudo de ton compte</span>
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
                  className="w-full rounded-xl px-4 py-3 font-semibold text-sm text-white placeholder-white/30 focus:outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid rgba(255,255,255,0.12)`,
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = currentMode.accent + "80"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"}
                />
              )}
            </div>

            {/* Join code */}
            {tab === "join" && (
              <div>
                <label className="block text-xs font-bold text-white/40 mb-1.5 uppercase tracking-wider">Code de la salle</label>
                <input
                  data-testid="input-code"
                  type="text"
                  value={code}
                  onChange={e => { setCode(e.target.value.toUpperCase()); setLocalError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleJoin()}
                  placeholder="ABCD"
                  maxLength={4}
                  className="w-full rounded-xl px-4 py-3 font-black text-2xl tracking-[0.4em] text-center uppercase text-white placeholder-white/20 focus:outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid rgba(255,255,255,0.12)`,
                    letterSpacing: "0.4em",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = currentMode.accent + "80"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"}
                />
              </div>
            )}

            {/* Undercover count */}
            {tab === "create" && gameMode === "undercover" && (
              <div>
                <label className="block text-xs font-bold text-white/40 mb-1.5 uppercase tracking-wider">
                  Nombre d'Undercover : {undercoverCount}
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setUndercoverCount(n)}
                      className="flex-1 py-2.5 rounded-xl font-black text-sm transition-all"
                      style={undercoverCount === n ? {
                        background: currentMode.accent,
                        color: "#fff",
                      } : {
                        background: "rgba(255,255,255,0.06)",
                        color: "rgba(255,255,255,0.5)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >{n}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Private toggle */}
            {tab === "create" && (
              <button
                type="button"
                onClick={() => setIsPrivate(p => !p)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all"
                style={isPrivate ? {
                  background: `${currentMode.accent}18`,
                  border: `1px solid ${currentMode.accent}50`,
                } : {
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <span className="text-lg">{isPrivate ? "🔒" : "🌐"}</span>
                <div className="flex-1 text-left">
                  <div className="font-bold text-white/80 leading-tight">{isPrivate ? "Salle privée" : "Salle publique"}</div>
                  <div className="text-xs text-white/40">
                    {isPrivate ? "Seulement via lien/code" : "Visible via « Trouver une partie »"}
                  </div>
                </div>
                <div
                  className="w-10 h-5 rounded-full transition-all relative flex-shrink-0"
                  style={{ background: isPrivate ? currentMode.accent : "rgba(255,255,255,0.15)" }}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${isPrivate ? "left-5" : "left-0.5"}`} />
                </div>
              </button>
            )}

            {/* Error */}
            {displayError && (
              <div className="rounded-xl px-4 py-2.5 text-sm font-semibold"
                style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
                data-testid="error-message">
                ⚠️ {displayError}
              </div>
            )}

            {/* CTA Button */}
            <button
              data-testid={tab === "play" ? "quick-match" : tab === "create" ? "create-room" : "join-room"}
              onClick={tab === "play" ? handleQuickMatch : tab === "create" ? handleCreate : handleJoin}
              disabled={!connected}
              className="w-full py-4 rounded-2xl font-black text-base text-white shadow-xl active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: currentMode.bg, boxShadow: `0 8px 32px ${currentMode.glow}` }}
            >
              {tab === "play"
                ? "⚡ Trouver une partie"
                : tab === "create"
                  ? `✨ Créer une salle`
                  : "🎯 Rejoindre la partie"}
            </button>

            {tab === "play" && (
              <p className="text-xs text-white/30 text-center -mt-1">
                Rejoindre une salle existante ou en créer une nouvelle.
              </p>
            )}
          </div>
        </div>

        {/* Rules */}
        <div
          className="rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3">Règles du jeu</p>
          <div className="space-y-2">
            {rules.map(r => (
              <div key={r.n} className="flex gap-3 items-start">
                <span
                  className="w-5 h-5 rounded-full text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `${currentMode.accent}30`, color: currentMode.accent }}
                >
                  {r.n}
                </span>
                <p className="text-xs text-white/55 leading-relaxed">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
