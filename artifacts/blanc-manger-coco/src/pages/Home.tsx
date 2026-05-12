import { useState, useEffect, useRef } from "react";
import type { GameType, SendMessage, SpectateHint } from "../hooks/useWebSocket";
import { DEFAULT_AVATAR } from "../data/avatars";
import { useAvatars } from "@/hooks/useAvatars";
import { useAuth } from "../hooks/useAuth";

type AppPage = "game" | "auth" | "profile" | "leaderboard";

interface HomeProps {
  error: string | null;
  connected: boolean;
  onCreateRoom: (name: string, avatar: string, gameType: GameType, options?: { undercoverCount?: number; isPrivate?: boolean; cardMode?: "normal" | "adult" | "mixed"; voteMode?: "classic" | "democratic" }) => void;
  onJoinRoom: (code: string, name: string, avatar: string) => void;
  onJoinAsSpectator?: (code: string, name: string, avatar: string) => void;
  onQuickMatch: (name: string, avatar: string, gameType: GameType) => void;
  setMyPlayerId: (id: string) => void;
  send: SendMessage;
  initialCode?: string;
  initialMode?: GameType;
  onNavigate?: (page: AppPage) => void;
  spectateHint?: SpectateHint | null;
  onClearSpectateHint?: () => void;
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
    accent: "#ff2e7a",
    accentDark: "#c1185f",
    glow: "rgba(255,46,122,0.40)",
    bg: "linear-gradient(135deg, #ff2e7a, #c1185f)",
    tag: "Le party game culte",
  },
  {
    id: "connect4" as const,
    icon: "🔴",
    label: "Puissance 4",
    sub: "2 joueurs",
    accent: "#3b82f6",
    accentDark: "#1d4ed8",
    glow: "rgba(59,130,246,0.40)",
    bg: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    tag: "Aligne 4 jetons",
  },
  {
    id: "undercover" as const,
    icon: "🕵️",
    label: "Undercover",
    sub: "3–12 joueurs",
    accent: "#a855f7",
    accentDark: "#7c3aed",
    glow: "rgba(168,85,247,0.40)",
    bg: "linear-gradient(135deg, #a855f7, #7c3aed)",
    tag: "Démasque l'imposteur",
  },
  {
    id: "petitbac" as const,
    icon: "🔤",
    label: "Petit Bac",
    sub: "2–10 joueurs",
    accent: "#14b8a6",
    accentDark: "#0d9488",
    glow: "rgba(20,184,166,0.40)",
    bg: "linear-gradient(135deg, #14b8a6, #0d9488)",
    tag: "Vite, une lettre !",
  },
  {
    id: "guess_who" as const,
    icon: "🔍",
    label: "Qui est-ce ?",
    sub: "2 joueurs",
    accent: "#06b6d4",
    accentDark: "#0891b2",
    glow: "rgba(6,182,212,0.40)",
    bg: "linear-gradient(135deg, #06b6d4, #0891b2)",
    tag: "Pose les bonnes questions",
  },
];

export function Home({ error, connected, onCreateRoom, onJoinRoom, onJoinAsSpectator, onQuickMatch, initialCode, initialMode, setMyPlayerId, onNavigate, spectateHint, onClearSpectateHint }: HomeProps) {
  const AVATARS = useAvatars();
  const { user } = useAuth();
  const [gameMode, setGameMode] = useState<GameType>(initialMode || "bmc");
  const [tab, setTab] = useState<"play" | "create" | "join">(initialCode ? "join" : "play");
  const [name, setName] = useState(() => user?.username || sessionStorage.getItem("bmc_player_name") || "");
  const [avatar, setAvatar] = useState(() => user?.avatar || sessionStorage.getItem("bmc_player_avatar") || DEFAULT_AVATAR);
  const formRef = useRef<HTMLDivElement>(null);

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

  const selectMode = (id: GameType) => {
    setGameMode(id);
    sessionStorage.setItem("bmc_last_mode", id);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  return (
    <div className="bg-party min-h-screen relative">
      {/* Decorative floating cards */}
      <div className="party-cards-layer" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-16">

        {/* HERO */}
        <section className="text-center pt-10 pb-12 sm:pt-16 sm:pb-16 relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold text-white/80 mb-6"
               style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {connected ? "Serveurs en ligne · jouer entre amis maintenant" : "Connexion au serveur..."}
          </div>

          <h1 className="title-display text-white text-[clamp(2.6rem,8vw,5.5rem)] mb-4">
            Le <span style={{
              background: "linear-gradient(180deg, #fff 0%, #ffd93d 50%, #ff2e7a 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>party game</span>
            <br />en ligne, avec tes potes.
          </h1>
          <p className="text-white/70 text-base sm:text-lg max-w-xl mx-auto font-semibold mb-8 leading-relaxed">
            5 jeux, 1 lien à partager, 0 install. Choisis un jeu, lance la salle et c'est parti.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              data-testid="hero-quick-match"
              onClick={handleQuickMatch}
              disabled={!connected}
              className="btn-jb"
              style={{ minWidth: 220 }}
            >
              ⚡ Trouver une partie
            </button>
            <a
              href="#choisir"
              onClick={(e) => { e.preventDefault(); document.getElementById("choisir")?.scrollIntoView({ behavior: "smooth" }); }}
              className="btn-jb btn-jb-ghost"
            >
              🎮 Voir les jeux
            </a>
          </div>

          {/* Floating decorative emoji */}
          <div className="hidden sm:block absolute top-10 left-2 text-5xl float-y-slow opacity-70" style={{ filter: "drop-shadow(0 8px 20px rgba(255,46,122,0.5))" }}>🃏</div>
          <div className="hidden sm:block absolute top-20 right-4 text-5xl float-y opacity-70" style={{ filter: "drop-shadow(0 8px 20px rgba(45,212,255,0.5))" }}>🎲</div>
          <div className="hidden sm:block absolute bottom-0 left-12 text-4xl float-y opacity-60" style={{ filter: "drop-shadow(0 8px 20px rgba(168,85,247,0.5))" }}>🎉</div>
          <div className="hidden sm:block absolute bottom-2 right-12 text-4xl float-y-slow opacity-60" style={{ filter: "drop-shadow(0 8px 20px rgba(255,217,61,0.5))" }}>🏆</div>
        </section>

        {/* GAME TILES */}
        <section id="choisir" className="mb-10 scroll-mt-24">
          <div className="flex items-end justify-between mb-5">
            <div>
              <p className="section-eyebrow mb-1">1 · Choisis ton jeu</p>
              <h2 className="title-display text-white text-2xl sm:text-3xl">Quel sera ton poison ce soir ?</h2>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-white/40">
              {availableModes.length} jeux disponibles
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {availableModes.map((m, i) => {
              const selected = m.id === gameMode;
              const tilt = ([-1.5, 1, -0.5, 1.2, -1][i % 5]).toFixed(1) + "deg";
              return (
                <button
                  key={m.id}
                  data-testid={`tile-${m.id}`}
                  onClick={() => selectMode(m.id)}
                  className="game-tile"
                  style={{
                    background: m.bg,
                    "--tile-rot": selected ? "0deg" : tilt,
                    outline: selected ? `3px solid #fff` : "none",
                    outlineOffset: "3px",
                    boxShadow: selected
                      ? `0 1px 0 0 rgba(255,255,255,0.25) inset, 0 24px 48px -12px ${m.glow}`
                      : undefined,
                  } as React.CSSProperties}
                >
                  <span className="game-tile-pill">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" /> live
                  </span>
                  <div className="game-tile-icon">{m.icon}</div>
                  <div>
                    <div className="game-tile-title">{m.label}</div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="game-tile-sub">{m.sub}</div>
                      {selected && <div className="text-[0.65rem] font-black uppercase tracking-wider bg-white/25 rounded-full px-2 py-0.5">Choisi ✓</div>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* FORM PANEL */}
        <section ref={formRef} className="grid lg:grid-cols-[1.15fr_1fr] gap-6 mb-10 scroll-mt-24">
          {/* Left: form */}
          <div className="card-jb p-6 sm:p-8 relative overflow-hidden">
            <div
              className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-50 blur-3xl"
              style={{ background: currentMode.glow }}
            />

            <p className="section-eyebrow mb-2">2 · Lance-toi</p>
            <div className="flex items-center gap-3 mb-5">
              <span className="text-3xl">{currentMode.icon}</span>
              <h2 className="title-display text-white text-2xl sm:text-3xl">{currentMode.label}</h2>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: `${currentMode.accent}25`, color: currentMode.accent, border: `1px solid ${currentMode.accent}50` }}>
                {currentMode.sub}
              </span>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-5 p-1 rounded-2xl" style={{ background: "rgba(0,0,0,0.30)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {[
                { key: "play" as const, label: "Trouver", icon: "⚡" },
                { key: "create" as const, label: "Créer", icon: "✨" },
                { key: "join" as const, label: "Rejoindre", icon: "🔑" },
              ].map(t => (
                <button
                  key={t.key}
                  data-testid={`tab-${t.key}`}
                  onClick={() => setTab(t.key)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={tab === t.key ? {
                    background: currentMode.bg,
                    color: "#fff",
                    boxShadow: `0 6px 18px -6px ${currentMode.glow}, inset 0 1px 0 0 rgba(255,255,255,0.25)`,
                  } : {
                    color: "rgba(255,255,255,0.55)",
                    background: "transparent",
                  }}
                >
                  <span className="mr-1.5">{t.icon}</span>{t.label}
                </button>
              ))}
            </div>

            <div className="space-y-5">
              {/* Avatar */}
              <div>
                <label className="block section-eyebrow mb-2">Ton avatar</label>
                {user ? (
                  <div className="flex items-center gap-3 rounded-2xl px-4 py-3"
                       style={{ background: `${currentMode.accent}15`, border: `1px solid ${currentMode.accent}30` }}>
                    <span className="text-3xl">{user.avatar}</span>
                    <div>
                      <div className="text-sm font-bold text-white">Avatar de ton profil</div>
                      <div className="text-xs text-white/40">Modifiable dans Mon profil</div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => goTo(currentIndex - 1)}
                        className="w-10 h-10 rounded-full flex items-center justify-center font-black text-lg transition-all active:scale-90 flex-shrink-0"
                        style={{ background: `${currentMode.accent}25`, color: currentMode.accent }}
                        aria-label="Avatar précédent"
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
                                fontSize: isCenter ? "2.1rem" : dist === 1 ? "1.5rem" : "1.05rem",
                                opacity: isCenter ? 1 : dist === 1 ? 0.55 : 0.25,
                                transition: "all 0.18s ease",
                                width: isCenter ? "3.5rem" : dist === 1 ? "2.4rem" : "1.9rem",
                                height: isCenter ? "3.5rem" : dist === 1 ? "2.4rem" : "1.9rem",
                                borderRadius: "1rem",
                                background: isCenter ? `${currentMode.accent}25` : "transparent",
                                outline: isCenter ? `3px solid ${currentMode.accent}` : "none",
                                outlineOffset: "2px",
                                boxShadow: isCenter ? `0 6px 18px ${currentMode.glow}` : "none",
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
                        className="w-10 h-10 rounded-full flex items-center justify-center font-black text-lg transition-all active:scale-90 flex-shrink-0"
                        style={{ background: `${currentMode.accent}25`, color: currentMode.accent }}
                        aria-label="Avatar suivant"
                      >›</button>
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <span className="text-sm font-bold" style={{ color: currentMode.accent }}>{AVATARS[currentIndex].label}</span>
                      <span className="text-xs text-white/30">{currentIndex + 1}/{AVATARS.length}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block section-eyebrow mb-2">Ton prénom</label>
                {user ? (
                  <div className="flex items-center gap-3 rounded-2xl px-4 py-3"
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
                    className="jb-input"
                  />
                )}
              </div>

              {/* Join code */}
              {tab === "join" && (
                <div>
                  <label className="block section-eyebrow mb-2">Code de la salle</label>
                  <input
                    data-testid="input-code"
                    type="text"
                    value={code}
                    onChange={e => { setCode(e.target.value.toUpperCase()); setLocalError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleJoin()}
                    placeholder="ABCD"
                    maxLength={4}
                    className="jb-input text-center"
                    style={{ fontFamily: "var(--app-font-display)", fontSize: "1.7rem", letterSpacing: "0.4em", fontWeight: 700 }}
                  />
                </div>
              )}

              {/* Undercover count */}
              {tab === "create" && gameMode === "undercover" && (
                <div>
                  <label className="block section-eyebrow mb-2">Nombre d'Undercover · {undercoverCount}</label>
                  <div className="flex gap-2">
                    {[1, 2, 3].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setUndercoverCount(n)}
                        className="flex-1 py-2.5 rounded-xl font-black text-sm transition-all"
                        style={undercoverCount === n ? {
                          background: currentMode.accent, color: "#fff",
                          boxShadow: `0 6px 18px -6px ${currentMode.glow}`,
                        } : {
                          background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)",
                          border: "1px solid rgba(255,255,255,0.10)",
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
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition-all"
                  style={isPrivate ? {
                    background: `${currentMode.accent}18`, border: `1px solid ${currentMode.accent}50`,
                  } : {
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
                  }}
                >
                  <span className="text-lg">{isPrivate ? "🔒" : "🌐"}</span>
                  <div className="flex-1 text-left">
                    <div className="font-bold text-white leading-tight">{isPrivate ? "Salle privée" : "Salle publique"}</div>
                    <div className="text-xs text-white/40">
                      {isPrivate ? "Seulement via lien/code" : "Visible via « Trouver une partie »"}
                    </div>
                  </div>
                  <div className="w-10 h-5 rounded-full transition-all relative flex-shrink-0"
                       style={{ background: isPrivate ? currentMode.accent : "rgba(255,255,255,0.15)" }}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${isPrivate ? "left-5" : "left-0.5"}`} />
                  </div>
                </button>
              )}

              {/* Error */}
              {displayError && !(spectateHint && tab === "join") && (
                <div className="rounded-2xl px-4 py-3 text-sm font-semibold"
                     style={{ background: "rgba(239,68,68,0.18)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.35)" }}
                     data-testid="error-message">
                  ⚠️ {displayError}
                </div>
              )}

              {/* Spectator join option */}
              {spectateHint && tab === "join" && spectateHint.gameType === "connect4" && (
                <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(99,102,241,0.4)" }}>
                  <div className="px-4 py-3" style={{ background: "rgba(99,102,241,0.15)" }}>
                    <p className="text-sm font-bold text-white mb-0.5">La partie a déjà commencé</p>
                    <p className="text-xs text-white/60">Tu peux regarder la partie en spectateur.</p>
                  </div>
                  <div className="px-4 py-3 flex flex-col gap-2" style={{ background: "rgba(99,102,241,0.08)" }}>
                    <button
                      onClick={() => {
                        const trimmed = (user?.username || name).trim();
                        if (!trimmed) { setLocalError("Entre ton prénom pour jouer !"); return; }
                        genId();
                        onJoinAsSpectator?.(spectateHint.code, trimmed, user?.avatar || avatar);
                      }}
                      className="btn-jb btn-jb-purple w-full"
                    >
                      👁️ Rejoindre en spectateur
                    </button>
                    <button
                      onClick={() => onClearSpectateHint?.()}
                      className="text-xs text-white/40 hover:text-white/70 transition-colors text-center py-1"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {/* CTA */}
              {!(spectateHint && tab === "join") && (
                <button
                  data-testid={tab === "play" ? "quick-match" : tab === "create" ? "create-room" : "join-room"}
                  onClick={tab === "play" ? handleQuickMatch : tab === "create" ? handleCreate : handleJoin}
                  disabled={!connected}
                  className="btn-jb w-full"
                  style={{ background: currentMode.bg, boxShadow: `0 6px 0 0 rgba(0,0,0,0.35), 0 14px 36px -8px ${currentMode.glow}, inset 0 1px 0 0 rgba(255,255,255,0.25)` }}
                >
                  {tab === "play"
                    ? "⚡ Trouver une partie"
                    : tab === "create"
                      ? "✨ Créer une salle"
                      : "🎯 Rejoindre la partie"}
                </button>
              )}

              {tab === "play" && (
                <p className="text-xs text-white/40 text-center -mt-1">
                  Rejoindre une salle existante ou en créer une nouvelle.
                </p>
              )}
            </div>
          </div>

          {/* Right: rules + features */}
          <div className="space-y-5">
            <div className="card-jb p-6 sm:p-7">
              <p className="section-eyebrow mb-3">Règles · {currentMode.label}</p>
              <ol className="space-y-3">
                {rules.map(r => (
                  <li key={r.n} className="flex gap-3 items-start">
                    <span
                      className="w-7 h-7 rounded-full font-black text-sm flex items-center justify-center flex-shrink-0"
                      style={{ background: currentMode.accent, color: "#fff", boxShadow: `0 4px 12px -4px ${currentMode.glow}` }}
                    >
                      {r.n}
                    </span>
                    <p className="text-sm text-white/75 leading-relaxed pt-1">{r.text}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="card-jb p-4 text-center">
                <div className="text-2xl mb-1">⚡</div>
                <div className="text-xs font-bold text-white">Instantané</div>
                <div className="text-[0.65rem] text-white/45 leading-snug mt-0.5">Aucune install</div>
              </div>
              <div className="card-jb p-4 text-center">
                <div className="text-2xl mb-1">🔗</div>
                <div className="text-xs font-bold text-white">1 lien</div>
                <div className="text-[0.65rem] text-white/45 leading-snug mt-0.5">à partager</div>
              </div>
              <div className="card-jb p-4 text-center">
                <div className="text-2xl mb-1">🎉</div>
                <div className="text-xs font-bold text-white">5 jeux</div>
                <div className="text-[0.65rem] text-white/45 leading-snug mt-0.5">en français</div>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="text-center pt-6 pb-2">
          <p className="text-xs text-white/30 font-semibold">
            PlayTime · Fait pour les soirées entre amis · 🥖🇫🇷
          </p>
        </footer>
      </div>
    </div>
  );
}
