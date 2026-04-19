import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAvatars } from "@/hooks/useAvatars";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const STATS_API = `${window.location.origin}${BASE}/api/stats`;

const GAME_LABELS: Record<string, { label: string; icon: string; accent: string }> = {
  bmc:       { label: "Blanc Manger Coco", icon: "🃏", accent: "#e91e63" },
  connect4:  { label: "Puissance 4",       icon: "🔴", accent: "#3b82f6" },
  undercover:{ label: "Undercover",         icon: "🕵️", accent: "#a855f7" },
  petitbac:  { label: "Petit Bac",          icon: "🔤", accent: "#14b8a6" },
  guess_who: { label: "Qui est-ce ?",       icon: "🔍", accent: "#06b6d4" },
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
    fetch(`${STATS_API}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
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
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #07071a 0%, #0d0d2b 50%, #080f1f 100%)" }}>
        <div className="rounded-2xl p-8 text-center"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <p className="text-white/60 font-semibold mb-4">Tu dois être connecté pour voir ton profil.</p>
          <button onClick={onBack} className="font-bold" style={{ color: "#e91e63" }}>← Retour</button>
        </div>
      </div>
    );
  }

  const totalWins = stats ? Object.values(stats).reduce((a, b) => a + (b.wins ?? 0), 0) : 0;
  const totalLosses = stats ? Object.entries(stats).reduce((a, [mode, b]) => a + (MODES_WITH_LOSSES.includes(mode) ? (b.losses ?? 0) : 0), 0) : 0;
  const totalDraws = stats ? Object.values(stats).reduce((a, b) => a + (b.draws ?? 0), 0) : 0;
  const hasChanged = selectedAvatar !== user.avatar;

  const inputStyle = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 py-8 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #07071a 0%, #0d0d2b 50%, #080f1f 100%)" }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 50% 35% at 50% 0%, rgba(233,30,99,0.2), transparent 70%)" }}
      />

      <div className="w-full max-w-sm relative z-10">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-white/40 hover:text-white/80 transition-colors"
        >
          ← Retour
        </button>

        {/* Hero card */}
        <div
          className="rounded-2xl p-6 mb-4 text-center relative overflow-hidden"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)" }}
        >
          <div className="text-6xl mb-3 drop-shadow-lg">{user.avatar}</div>
          <h2 className="text-2xl font-black text-white mb-0.5">{user.username}</h2>
          {user.email && <p className="text-sm text-white/30 mb-4">{user.email}</p>}

          {/* Global stats chips */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-black"
              style={{ background: "rgba(233,30,99,0.15)", color: "#f06292", border: "1px solid rgba(233,30,99,0.3)" }}
            >
              🏆 {totalWins} victoire{totalWins !== 1 ? "s" : ""}
            </div>
            {totalLosses > 0 && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-black"
                style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}
              >
                💀 {totalLosses} défaite{totalLosses !== 1 ? "s" : ""}
              </div>
            )}
            {totalDraws > 0 && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-black"
                style={{ background: "rgba(234,179,8,0.12)", color: "#fbbf24", border: "1px solid rgba(234,179,8,0.25)" }}
              >
                🤝 {totalDraws} nul{totalDraws !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>

        {/* Stats per game */}
        <div
          className="rounded-2xl p-5 mb-4"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}
        >
          <h3 className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3">Statistiques par jeu</h3>
          {statsLoading ? (
            <div className="py-6 text-center text-white/30 font-semibold">
              <div className="text-xl mb-2 animate-pulse">⏳</div>
              Chargement...
            </div>
          ) : stats ? (
            <div className="space-y-2">
              {Object.entries(GAME_LABELS).map(([mode, { label, icon, accent }]) => {
                const s = stats[mode] ?? { wins: 0, losses: 0, draws: 0 };
                const hasLosses = MODES_WITH_LOSSES.includes(mode);
                return (
                  <div
                    key={mode}
                    className="rounded-xl px-4 py-3 flex items-center gap-3"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <span className="text-2xl flex-shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white/60 mb-1 truncate">{label}</div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs font-black" style={{ color: accent }}>
                          🏆 {s.wins}
                        </span>
                        {hasLosses && (
                          <span className="text-xs font-bold text-red-400/70">
                            💀 {s.losses}
                          </span>
                        )}
                        {s.draws > 0 && (
                          <span className="text-xs font-bold text-yellow-500/70">
                            🤝 {s.draws}
                          </span>
                        )}
                        {s.wins === 0 && (!hasLosses || s.losses === 0) && s.draws === 0 && (
                          <span className="text-xs text-white/20">Aucune partie</span>
                        )}
                      </div>
                    </div>
                    {/* Win rate mini-bar */}
                    {hasLosses && (s.wins + s.losses) > 0 && (
                      <div className="flex-shrink-0 text-right">
                        <div className="text-xs font-black" style={{ color: accent }}>
                          {Math.round((s.wins / (s.wins + s.losses)) * 100)}%
                        </div>
                        <div className="text-[10px] text-white/25">win rate</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-white/30 text-sm text-center py-4">Aucune statistique disponible.</p>
          )}
        </div>

        {/* Avatar editor */}
        <div
          className="rounded-2xl p-5 mb-4"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}
        >
          <h3 className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3">Mon avatar</h3>

          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => goTo(currentIndex - 1)}
              className="w-9 h-9 rounded-full flex items-center justify-center font-black text-lg transition-all active:scale-90 flex-shrink-0"
              style={{ background: "rgba(233,30,99,0.15)", color: "#f06292" }}
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
                      background: isCenter ? "rgba(233,30,99,0.2)" : "transparent",
                      outline: isCenter ? "2px solid #e91e63" : "none",
                      outlineOffset: "2px",
                      boxShadow: isCenter ? "0 4px 14px rgba(233,30,99,0.35)" : "none",
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
              style={{ background: "rgba(233,30,99,0.15)", color: "#f06292" }}
            >›</button>
          </div>
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-sm font-bold" style={{ color: "#f06292" }}>{AVATARS[currentIndex]?.label}</span>
            <span className="text-xs text-white/25">{currentIndex + 1}/{AVATARS.length}</span>
          </div>

          {avatarError && (
            <div className="rounded-xl px-4 py-2.5 text-sm font-semibold mb-2"
              style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
              ⚠️ {avatarError}
            </div>
          )}
          {avatarSaved && (
            <div className="rounded-xl px-4 py-2.5 text-sm font-semibold mb-2"
              style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}>
              ✓ Avatar mis à jour !
            </div>
          )}
          <button
            onClick={handleSaveAvatar}
            disabled={authLoading || !hasChanged}
            className="w-full py-3.5 rounded-xl font-black text-sm text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #e91e63, #c2185b)", boxShadow: "0 6px 20px rgba(233,30,99,0.35)" }}
          >
            {authLoading ? "Sauvegarde…" : hasChanged ? "Sauvegarder l'avatar" : "✓ Avatar actuel"}
          </button>
        </div>

        {/* Change password — collapsible */}
        <div
          className="rounded-2xl mb-4 overflow-hidden"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}
        >
          <button
            type="button"
            onClick={() => setPwdOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Changer de mot de passe</span>
            <span className="text-white/30 text-sm">{pwdOpen ? "▲" : "▼"}</span>
          </button>
          {pwdOpen && (
            <div className="px-5 pb-5">
              <form onSubmit={handleChangePwd} className="space-y-3">
                {(["Mot de passe actuel", "Nouveau mot de passe (6 min.)", "Confirmer le nouveau mot de passe"] as const).map((placeholder, i) => (
                  <input
                    key={i}
                    type="password"
                    value={[currentPwd, newPwd, newPwd2][i]}
                    onChange={e => [setCurrentPwd, setNewPwd, setNewPwd2][i](e.target.value)}
                    placeholder={placeholder}
                    autoComplete={i === 0 ? "current-password" : "new-password"}
                    className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white placeholder-white/25 focus:outline-none transition-all"
                    style={inputStyle}
                  />
                ))}
                {pwdError && (
                  <div className="rounded-xl px-4 py-2.5 text-sm font-semibold"
                    style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
                    ⚠️ {pwdError}
                  </div>
                )}
                {pwdMsg && (
                  <div className="rounded-xl px-4 py-2.5 text-sm font-semibold"
                    style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}>
                    ✓ {pwdMsg}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="w-full py-3.5 rounded-xl font-black text-sm text-white transition-all active:scale-95 disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)", boxShadow: "0 6px 20px rgba(99,102,241,0.3)" }}
                >
                  {pwdLoading ? "Mise à jour…" : "Changer le mot de passe"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={() => { logout(); onBack(); }}
          className="w-full py-3 rounded-2xl font-bold text-sm transition-all hover:bg-red-500/10"
          style={{ color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          🚪 Se déconnecter
        </button>
      </div>
    </div>
  );
}
