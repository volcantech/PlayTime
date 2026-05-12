import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

interface AuthPageProps {
  onSuccess: () => void;
  onBack: () => void;
}

export function AuthPage({ onSuccess, onBack }: AuthPageProps) {
  const { login, register, loading, error, setError } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("login");

  const [loginField, setLoginField] = useState("");
  const [loginPwd, setLoginPwd] = useState("");

  const [regEmail, setRegEmail] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPwd, setRegPwd] = useState("");
  const [regPwd2, setRegPwd2] = useState("");

  const [localError, setLocalError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    setError(null);
    if (!loginField.trim() || !loginPwd) { setLocalError("Remplis tous les champs."); return; }
    const res = await login(loginField.trim(), loginPwd);
    if (res.ok) onSuccess();
    else setLocalError(res.error || "Erreur.");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    setError(null);
    if (!regEmail.trim() || !regUsername.trim() || !regPwd) { setLocalError("Remplis tous les champs."); return; }
    if (regPwd !== regPwd2) { setLocalError("Les mots de passe ne correspondent pas."); return; }
    const res = await register(regEmail.trim(), regUsername.trim(), regPwd);
    if (res.ok) onSuccess();
    else setLocalError(res.error || "Erreur.");
  };

  const displayError = localError || error;

  return (
    <div className="bg-party min-h-screen relative">
      <div className="party-cards-layer" />

      <div className="relative z-10 max-w-md mx-auto px-4 sm:px-6 pt-12 pb-12">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3 float-y">🎮</div>
          <h1 className="title-display text-white text-4xl sm:text-5xl mb-2" style={{
            background: "linear-gradient(180deg, #fff 0%, #ffd93d 50%, #ff2e7a 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            PlayTime
          </h1>
          <p className="text-white/55 font-bold text-sm">
            {tab === "login" ? "Connecte-toi pour retrouver tes parties" : "Crée ton compte en 30 secondes"}
          </p>
        </div>

        <div className="card-jb overflow-hidden">
          <div className="flex p-1.5 m-3 rounded-2xl gap-1.5"
               style={{ background: "rgba(0,0,0,0.30)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={() => { setTab("login"); setLocalError(""); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={tab === "login" ? {
                background: "linear-gradient(180deg, #ff2e7a, #c1185f)", color: "#fff",
                boxShadow: "0 6px 18px -6px rgba(255,46,122,0.55), inset 0 1px 0 0 rgba(255,255,255,0.25)",
              } : { color: "rgba(255,255,255,0.55)", background: "transparent" }}
            >
              🔑 Connexion
            </button>
            <button
              onClick={() => { setTab("register"); setLocalError(""); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={tab === "register" ? {
                background: "linear-gradient(180deg, #ff2e7a, #c1185f)", color: "#fff",
                boxShadow: "0 6px 18px -6px rgba(255,46,122,0.55), inset 0 1px 0 0 rgba(255,255,255,0.25)",
              } : { color: "rgba(255,255,255,0.55)", background: "transparent" }}
            >
              ✨ Inscription
            </button>
          </div>

          <div className="px-6 pb-6 pt-1">
            {tab === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block section-eyebrow mb-2">Email ou pseudo</label>
                  <input
                    type="text"
                    value={loginField}
                    onChange={e => setLoginField(e.target.value)}
                    placeholder="ton@email.fr ou pseudo"
                    className="jb-input"
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label className="block section-eyebrow mb-2">Mot de passe</label>
                  <input
                    type="password"
                    value={loginPwd}
                    onChange={e => setLoginPwd(e.target.value)}
                    placeholder="••••••••"
                    className="jb-input"
                    autoComplete="current-password"
                  />
                </div>
                {displayError && (
                  <div className="rounded-2xl px-4 py-3 text-sm font-semibold"
                       style={{ background: "rgba(239,68,68,0.18)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.35)" }}>
                    ⚠️ {displayError}
                  </div>
                )}
                <button type="submit" disabled={loading} className="btn-jb w-full">
                  {loading ? "Connexion..." : "Se connecter"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block section-eyebrow mb-2">Email</label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    placeholder="ton@email.fr"
                    className="jb-input"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="block section-eyebrow mb-2">Pseudo</label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={e => setRegUsername(e.target.value)}
                    placeholder="3 caractères minimum"
                    maxLength={30}
                    className="jb-input"
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label className="block section-eyebrow mb-2">Mot de passe</label>
                  <input
                    type="password"
                    value={regPwd}
                    onChange={e => setRegPwd(e.target.value)}
                    placeholder="6 caractères minimum"
                    className="jb-input"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block section-eyebrow mb-2">Confirmer le mot de passe</label>
                  <input
                    type="password"
                    value={regPwd2}
                    onChange={e => setRegPwd2(e.target.value)}
                    placeholder="••••••••"
                    className="jb-input"
                    autoComplete="new-password"
                  />
                </div>
                {displayError && (
                  <div className="rounded-2xl px-4 py-3 text-sm font-semibold"
                       style={{ background: "rgba(239,68,68,0.18)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.35)" }}>
                    ⚠️ {displayError}
                  </div>
                )}
                <button type="submit" disabled={loading} className="btn-jb w-full">
                  {loading ? "Inscription..." : "Créer mon compte"}
                </button>
              </form>
            )}
          </div>
        </div>

        <button
          onClick={onBack}
          className="mt-5 w-full text-sm font-bold text-white/50 hover:text-white/90 transition-colors py-2.5"
        >
          ← Retour à l'accueil
        </button>
      </div>
    </div>
  );
}
