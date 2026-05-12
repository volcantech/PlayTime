import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAvatars } from "@/hooks/useAvatars";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const STATS_API = `${window.location.origin}${BASE}/api/stats`;

const GAME_LABELS: Record<string, { label: string; icon: string; accent: string; bg: string }> = {
  bmc:       { label: "Blanc Manger Coco", icon: "🃏", accent: "#ff2e7a", bg: "linear-gradient(135deg, #ff2e7a, #c1185f)" },
  connect4:  { label: "Puissance 4",       icon: "🔴", accent: "#3b82f6", bg: "linear-gradient(135deg, #3b82f6, #1d4ed8)" },
  undercover:{ label: "Undercover",         icon: "🕵️", accent: "#a855f7", bg: "linear-gradient(135deg, #a855f7, #7c3aed)" },
  petitbac:  { label: "Petit Bac",          icon: "🔤", accent: "#14b8a6", bg: "linear-gradient(135deg, #14b8a6, #0d9488)" },
  guess_who: { label: "Qui est-ce ?",       icon: "🔍", accent: "#06b6d4", bg: "linear-gradient(135deg, #06b6d4, #0891b2)" },
};

const MODES_WITH_LOSSES = ["connect4", "undercover", "guess_who"];

interface ProfilePageProps {
  onBack: () => void;
}

interface ModeStats { wins: number; losses: number; draws: number; }

export function ProfilePage({ onBack }: ProfilePageProps) {
  const AVATARS = useAvatars();
  const { user, token, updateProfile, logout, loading: authLoading } = useAuth();

  const [stats, setStats] = useState<Record<string, ModeStats> | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || "🐱");
  const [avatarSaved, setAvatarSaved] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);

  const avatarIndex = AVATARS.findIndex(a => a.emoji === selectedAvatar);
  const currentIndex = avatarIndex === -1 ? 0 : avatarIndex;

  useEffect(() => {
    if (!token) return;
    setStatsLoading(true);
    fetch(`${STATS_API}/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStats(data); })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [token]);

  const goTo = (idx: number) => {
    const next = (idx + AVATARS.length) % AVATARS.length;
    setSelectedAvatar(AVATARS[next].emoji);
    setAvatarSaved(false);
    setAvatarError("");
  };

  const handleSaveAvatar = async () => {
    setAvatarError("");
    setAvatarSaved(false);
    if (!selectedAvatar) { setAvatarError("Avatar invalide."); return; }
    const res = await updateProfile({ avatar: selectedAvatar });
    if (res.ok) setAvatarSaved(true);
    else setAvatarError(res.error || "Erreur.");
  };

  const handleChangePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg("");
    setPwdError("");
    if (!currentPwd || !newPwd || !newPwd2) { setPwdError("Remplis tous les champs."); return; }
    if (newPwd !== newPwd2) { setPwdError("Les mots de passe ne correspondent pas."); return; }
    setPwdLoading(true);
    const res = await updateProfile({ currentPassword: currentPwd, newPassword: newPwd });
    if (res.ok) {
      setPwdMsg("Mot de passe mis à jour !");
      setCurrentPwd(""); setNewPwd(""); setNewPwd2("");
    } else {
      setPwdError(res.error || "Erreur.");
    }
    setPwdLoading(false);
  };

  if (!user) {
    return (
      <div className="bg-party min-h-screen flex items-center justify-center px-4">
        <div className="card-jb p-8 text-center max-w-sm">
          <div className="text-5xl mb-3">🔒</div>
          <p className="text-white font-bold mb-5">Tu dois être connecté pour voir ton profil.</p>
          <button onClick={onBack} className="btn-jb btn-jb-sm">← Retour</button>
        </div>
      </div>
    );
  }

  const totalWins = stats ? Object.values(stats).reduce((a, b) => a + (b.wins ?? 0), 0) : 0;
  const totalLosses = stats ? Object.entries(stats).reduce((a, [mode, b]) => a + (MODES_WITH_LOSSES.includes(mode) ? (b.losses ?? 0) : 0), 0) : 0;
  const totalDraws = stats ? Object.values(stats).reduce((a, b) => a + (b.draws ?? 0), 0) : 0;
  const totalGames = totalWins + totalLosses + totalDraws;
  const hasChanged = selectedAvatar !== user.avatar;

  return (
    <div className="bg-party min-h-screen relative">
      <div className="party-cards-layer" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-12">
        <button
          onClick={onBack}
          className="btn-jb btn-jb-ghost btn-jb-sm mb-6"
        >
          ← Retour
        </button>

        {/* Hero card */}
        <div className="card-jb p-7 sm:p-9 mb-6 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-50 blur-3xl"
               style={{ background: "rgba(255,46,122,0.55)" }} />
          <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full opacity-40 blur-3xl"
               style={{ background: "rgba(168,85,247,0.55)" }} />

          <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
            <div className="w-28 h-28 rounded-3xl flex items-center justify-center text-7xl flex-shrink-0 float-y-slow"
                 style={{
                   background: "linear-gradient(135deg, rgba(255,46,122,0.20), rgba(168,85,247,0.20))",
                   border: "2px solid rgba(255,255,255,0.20)",
                   boxShadow: "0 20px 50px -12px rgba(255,46,122,0.45)",
                 }}>
              {user.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="section-eyebrow mb-1">Ton profil</p>
              <h1 className="title-display text-white text-4xl sm:text-5xl mb-1 truncate">{user.username}</h1>
              {user.email && <p className="text-sm text-white/45 font-semibold mb-4 truncate">{user.email}</p>}

              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-black"
                     style={{ background: "rgba(255,217,61,0.15)", color: "#fde047", border: "1px solid rgba(255,217,61,0.35)" }}>
                  🏆 {totalWins} victoire{totalWins !== 1 ? "s" : ""}
                </div>
                {totalLosses > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-black"
                       style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.30)" }}>
                    💀 {totalLosses}
                  </div>
                )}
                {totalDraws > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-black"
                       style={{ background: "rgba(168,85,247,0.15)", color: "#c4b5fd", border: "1px solid rgba(168,85,247,0.30)" }}>
                    🤝 {totalDraws}
                  </div>
                )}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-black"
                     style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  🎮 {totalGames} parties
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
          {/* Stats per game (left, large) */}
          <div className="card-jb p-6">
            <p className="section-eyebrow mb-4">Statistiques par jeu</p>
            {statsLoading ? (
              <div className="py-10 text-center text-white/40 font-bold">
                <div className="text-3xl mb-2 animate-pulse">⏳</div>
                Chargement...
              </div>
            ) : stats ? (
              <div className="space-y-2.5">
                {Object.entries(GAME_LABELS).map(([mode, { label, icon, accent, bg }]) => {
                  const s = stats[mode] ?? { wins: 0, losses: 0, draws: 0 };
                  const hasLosses = MODES_WITH_LOSSES.includes(mode);
                  const total = s.wins + (hasLosses ? s.losses : 0) + s.draws;
                  const winRate = hasLosses && (s.wins + s.losses) > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : null;
                  return (
                    <div
                      key={mode}
                      className="rounded-2xl p-3.5 flex items-center gap-3 relative overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}
                    >
                      {/* Color accent bar */}
                      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: bg }} />
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ml-1"
                           style={{ background: `${accent}1F`, border: `1px solid ${accent}40` }}>
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-white truncate">{label}</div>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          <span className="text-xs font-black" style={{ color: accent }}>🏆 {s.wins}</span>
                          {hasLosses && <span className="text-xs font-bold text-red-300/70">💀 {s.losses}</span>}
                          {s.draws > 0 && <span className="text-xs font-bold text-yellow-300/70">🤝 {s.draws}</span>}
                          {total === 0 && <span className="text-xs text-white/30 italic">Aucune partie</span>}
                        </div>
                      </div>
                      {winRate !== null && (
                        <div className="text-right flex-shrink-0">
                          <div className="title-display text-2xl" style={{ color: accent }}>{winRate}%</div>
                          <div className="text-[0.65rem] text-white/35 font-bold uppercase tracking-wider">winrate</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-white/40 text-sm text-center py-6">Aucune statistique disponible.</p>
            )}
          </div>

          {/* Right column: avatar + password + logout */}
          <div className="space-y-5">
            {/* Avatar editor */}
            <div className="card-jb p-6">
              <p className="section-eyebrow mb-4">Mon avatar</p>
              <div className="flex items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => goTo(currentIndex - 1)}
                  className="w-10 h-10 rounded-full flex items-center justify-center font-black text-lg transition-all active:scale-90 flex-shrink-0"
                  style={{ background: "rgba(255,46,122,0.20)", color: "#ff2e7a" }}
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
                          background: isCenter ? "rgba(255,46,122,0.25)" : "transparent",
                          outline: isCenter ? "3px solid #ff2e7a" : "none",
                          outlineOffset: "2px",
                          boxShadow: isCenter ? "0 6px 18px rgba(255,46,122,0.40)" : "none",
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
                  style={{ background: "rgba(255,46,122,0.20)", color: "#ff2e7a" }}
                  aria-label="Avatar suivant"
                >›</button>
              </div>
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="text-sm font-black" style={{ color: "#ff2e7a" }}>{AVATARS[currentIndex]?.label}</span>
                <span className="text-xs text-white/30 font-semibold">{currentIndex + 1}/{AVATARS.length}</span>
              </div>

              {avatarError && (
                <div className="rounded-2xl px-4 py-3 text-sm font-semibold mb-3"
                     style={{ background: "rgba(239,68,68,0.18)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.35)" }}>
                  ⚠️ {avatarError}
                </div>
              )}
              {avatarSaved && (
                <div className="rounded-2xl px-4 py-3 text-sm font-semibold mb-3"
                     style={{ background: "rgba(34,197,94,0.18)", color: "#86efac", border: "1px solid rgba(34,197,94,0.35)" }}>
                  ✓ Avatar mis à jour !
                </div>
              )}
              <button
                onClick={handleSaveAvatar}
                disabled={authLoading || !hasChanged}
                className="btn-jb w-full"
              >
                {authLoading ? "Sauvegarde…" : hasChanged ? "💾 Sauvegarder" : "✓ Avatar actuel"}
              </button>
            </div>

            {/* Change password */}
            <div className="card-jb overflow-hidden">
              <button
                type="button"
                onClick={() => setPwdOpen(o => !o)}
                className="w-full flex items-center justify-between px-6 py-5 text-left transition-colors hover:bg-white/[0.03]"
              >
                <span className="section-eyebrow">🔐 Changer de mot de passe</span>
                <span className="text-white/40 text-xs">{pwdOpen ? "▲" : "▼"}</span>
              </button>
              {pwdOpen && (
                <div className="px-6 pb-6">
                  <form onSubmit={handleChangePwd} className="space-y-3">
                    {(["Mot de passe actuel", "Nouveau mot de passe (6 min.)", "Confirmer le nouveau mot de passe"] as const).map((placeholder, i) => (
                      <input
                        key={i}
                        type="password"
                        value={[currentPwd, newPwd, newPwd2][i]}
                        onChange={e => [setCurrentPwd, setNewPwd, setNewPwd2][i](e.target.value)}
                        placeholder={placeholder}
                        autoComplete={i === 0 ? "current-password" : "new-password"}
                        className="jb-input"
                      />
                    ))}
                    {pwdError && (
                      <div className="rounded-2xl px-4 py-3 text-sm font-semibold"
                           style={{ background: "rgba(239,68,68,0.18)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.35)" }}>
                        ⚠️ {pwdError}
                      </div>
                    )}
                    {pwdMsg && (
                      <div className="rounded-2xl px-4 py-3 text-sm font-semibold"
                           style={{ background: "rgba(34,197,94,0.18)", color: "#86efac", border: "1px solid rgba(34,197,94,0.35)" }}>
                        ✓ {pwdMsg}
                      </div>
                    )}
                    <button type="submit" disabled={pwdLoading} className="btn-jb btn-jb-purple w-full">
                      {pwdLoading ? "Mise à jour…" : "Mettre à jour"}
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Logout */}
            <button
              onClick={() => { logout(); onBack(); }}
              className="w-full py-3 rounded-2xl font-black text-sm transition-all"
              style={{ color: "#fca5a5", border: "1.5px solid rgba(239,68,68,0.30)", background: "rgba(239,68,68,0.05)" }}
            >
              🚪 Se déconnecter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
