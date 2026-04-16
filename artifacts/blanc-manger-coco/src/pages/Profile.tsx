import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAvatars } from "@/hooks/useAvatars";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const STATS_API = `${window.location.origin}${BASE}/api/stats`;

const GAME_LABELS: Record<string, { label: string; icon: string }> = {
  bmc: { label: "Blanc Manger Coco", icon: "🃏" },
  connect4: { label: "Puissance 4", icon: "🔴" },
  undercover: { label: "Undercover", icon: "🕵️" },
  petitbac: { label: "Petit Bac", icon: "🔤" },
};

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
      setCurrentPwd("");
      setNewPwd("");
      setNewPwd2("");
    } else {
      setPwdError(res.error || "Erreur.");
    }
    setPwdLoading(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #ff9a9e 100%)" }}>
        <div className="bg-white/90 rounded-2xl shadow-xl p-8 text-center">
          <p className="text-gray-600 font-semibold mb-4">Tu dois être connecté pour voir ton profil.</p>
          <button onClick={onBack} className="text-rose-600 font-bold hover:underline">← Retour</button>
        </div>
      </div>
    );
  }

  const MODES_WITH_LOSSES = ["connect4", "undercover"];

  const totalWins = stats ? Object.values(stats).reduce((a, b) => a + (b.wins ?? 0), 0) : 0;
  const totalLosses = stats ? Object.entries(stats).reduce((a, [mode, b]) => a + (MODES_WITH_LOSSES.includes(mode) ? (b.losses ?? 0) : 0), 0) : 0;
  const totalDraws = stats ? Object.values(stats).reduce((a, b) => a + (b.draws ?? 0), 0) : 0;

  const hasChanged = selectedAvatar !== user.avatar;

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10"
         style={{ background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #ff9a9e 100%)" }}>

      <div className="w-full max-w-sm">
        <button
          onClick={onBack}
          className="mb-4 text-sm font-semibold text-rose-800/80 hover:text-rose-900 bg-white/50 rounded-full px-4 py-2 transition-colors"
        >
          ← Retour
        </button>

        {/* Header */}
        <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl p-6 mb-4 text-center">
          <div className="text-5xl mb-2">{user.avatar}</div>
          <h2 className="text-2xl font-black text-gray-800">{user.username}</h2>
          <p className="text-sm text-gray-500">{user.email}</p>
          <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
            <span className="bg-rose-50 text-rose-700 text-sm font-bold px-3 py-1 rounded-full">🏆 {totalWins} victoire{totalWins !== 1 ? "s" : ""}</span>
            {totalLosses > 0 && <span className="bg-gray-50 text-gray-600 text-sm font-bold px-3 py-1 rounded-full">💀 {totalLosses} défaite{totalLosses !== 1 ? "s" : ""}</span>}
            {totalDraws > 0 && <span className="bg-yellow-50 text-yellow-700 text-sm font-bold px-3 py-1 rounded-full">🤝 {totalDraws} nul{totalDraws !== 1 ? "s" : ""}</span>}
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl p-5 mb-4">
          <h3 className="font-black text-gray-700 text-sm uppercase tracking-wide mb-3">Mes statistiques</h3>
          {statsLoading ? (
            <p className="text-gray-400 text-sm text-center py-2">Chargement...</p>
          ) : stats ? (
            <div className="space-y-3">
              {Object.entries(GAME_LABELS).map(([mode, { label, icon }]) => {
                const s = stats[mode] ?? { wins: 0, losses: 0, draws: 0 };
                return (
                  <div key={mode} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{icon}</span>
                      <span className="text-sm font-bold text-gray-700">{label}</span>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <span className="font-bold text-rose-600">🏆 {s.wins} victoire{s.wins !== 1 ? "s" : ""}</span>
                      {MODES_WITH_LOSSES.includes(mode) && (
                        <span className="font-bold text-gray-500">💀 {s.losses} défaite{s.losses !== 1 ? "s" : ""}</span>
                      )}
                      {s.draws > 0 && <span className="font-bold text-yellow-600">🤝 {s.draws} nul{s.draws !== 1 ? "s" : ""}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-2">Aucune stat disponible.</p>
          )}
        </div>

        {/* Avatar */}
        <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl p-5 mb-4">
          <h3 className="font-black text-gray-700 text-sm uppercase tracking-wide mb-3">Mon avatar</h3>

          <div className="flex items-center gap-2 mb-3">
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

          <div className="text-center text-sm font-bold text-rose-600 mb-3">{AVATARS[currentIndex]?.label}</div>

          {avatarError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm font-semibold mb-2">
              ⚠️ {avatarError}
            </div>
          )}
          {avatarSaved && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-2 text-sm font-semibold mb-2">
              ✓ Avatar mis à jour !
            </div>
          )}
          <button
            onClick={handleSaveAvatar}
            disabled={authLoading || !hasChanged}
            className="w-full py-3 rounded-xl font-bold text-sm text-white shadow hover:shadow-md active:scale-95 transition-all disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #e91e63, #c2185b)" }}
          >
            {authLoading ? "Sauvegarde..." : "Sauvegarder l'avatar"}
          </button>
        </div>

        {/* Change password */}
        <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl p-5 mb-4">
          <h3 className="font-black text-gray-700 text-sm uppercase tracking-wide mb-3">Changer de mot de passe</h3>
          <form onSubmit={handleChangePwd} className="space-y-3">
            <input
              type="password"
              value={currentPwd}
              onChange={e => setCurrentPwd(e.target.value)}
              placeholder="Mot de passe actuel"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-semibold focus:border-rose-400 focus:outline-none text-sm transition-colors"
              autoComplete="current-password"
            />
            <input
              type="password"
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              placeholder="Nouveau mot de passe (6 min.)"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-semibold focus:border-rose-400 focus:outline-none text-sm transition-colors"
              autoComplete="new-password"
            />
            <input
              type="password"
              value={newPwd2}
              onChange={e => setNewPwd2(e.target.value)}
              placeholder="Confirmer le nouveau mot de passe"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-semibold focus:border-rose-400 focus:outline-none text-sm transition-colors"
              autoComplete="new-password"
            />
            {pwdError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm font-semibold">
                ⚠️ {pwdError}
              </div>
            )}
            {pwdMsg && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-2 text-sm font-semibold">
                ✓ {pwdMsg}
              </div>
            )}
            <button
              type="submit"
              disabled={pwdLoading}
              className="w-full py-3 rounded-xl font-bold text-sm text-white shadow hover:shadow-md active:scale-95 transition-all disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #e91e63, #c2185b)" }}
            >
              {pwdLoading ? "Mise à jour..." : "Changer le mot de passe"}
            </button>
          </form>
        </div>

        {/* Logout */}
        <button
          onClick={() => { logout(); onBack(); }}
          className="w-full py-3 rounded-2xl font-bold text-sm text-rose-700 bg-white/80 border-2 border-rose-200 hover:bg-rose-50 transition-all"
        >
          🚪 Se déconnecter
        </button>
      </div>
    </div>
  );
}
