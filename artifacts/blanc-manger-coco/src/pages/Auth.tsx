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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
         style={{ background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #ff9a9e 100%)" }}>

      <div className="text-center mb-6">
        <div className="text-5xl mb-2">🎮</div>
        <h1 className="text-4xl font-black mb-1"
            style={{ fontFamily: "Pacifico, cursive", color: "#c2185b", textShadow: "2px 2px 0px #f8bbd0" }}>
          PlayTime
        </h1>
        <p className="text-sm font-semibold text-rose-700 bg-white/60 rounded-full px-5 py-1.5 inline-block">
          Connexion / Inscription
        </p>
      </div>

      <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => { setTab("login"); setLocalError(""); }}
            className={`flex-1 py-3 text-xs font-bold transition-colors ${
              tab === "login" ? "text-rose-600 border-b-2 border-rose-600 bg-rose-50" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            🔑 Connexion
          </button>
          <button
            onClick={() => { setTab("register"); setLocalError(""); }}
            className={`flex-1 py-3 text-xs font-bold transition-colors ${
              tab === "register" ? "text-rose-600 border-b-2 border-rose-600 bg-rose-50" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            ✨ Inscription
          </button>
        </div>

        <div className="p-5">
          {tab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Email ou pseudo</label>
                <input
                  type="text"
                  value={loginField}
                  onChange={e => setLoginField(e.target.value)}
                  placeholder="ton@email.fr ou pseudo"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-semibold focus:border-rose-400 focus:outline-none text-sm transition-colors"
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Mot de passe</label>
                <input
                  type="password"
                  value={loginPwd}
                  onChange={e => setLoginPwd(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-semibold focus:border-rose-400 focus:outline-none text-sm transition-colors"
                  autoComplete="current-password"
                />
              </div>
              {displayError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm font-semibold">
                  ⚠️ {displayError}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl font-black text-lg text-white shadow-lg hover:shadow-xl active:scale-95 transition-all disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #e91e63, #c2185b)" }}
              >
                {loading ? "Connexion..." : "Se connecter"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Email</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  placeholder="ton@email.fr"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-semibold focus:border-rose-400 focus:outline-none text-sm transition-colors"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Pseudo</label>
                <input
                  type="text"
                  value={regUsername}
                  onChange={e => setRegUsername(e.target.value)}
                  placeholder="3 caractères minimum"
                  maxLength={30}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-semibold focus:border-rose-400 focus:outline-none text-sm transition-colors"
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Mot de passe</label>
                <input
                  type="password"
                  value={regPwd}
                  onChange={e => setRegPwd(e.target.value)}
                  placeholder="6 caractères minimum"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-semibold focus:border-rose-400 focus:outline-none text-sm transition-colors"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Confirmer le mot de passe</label>
                <input
                  type="password"
                  value={regPwd2}
                  onChange={e => setRegPwd2(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-semibold focus:border-rose-400 focus:outline-none text-sm transition-colors"
                  autoComplete="new-password"
                />
              </div>
              {displayError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm font-semibold">
                  ⚠️ {displayError}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl font-black text-lg text-white shadow-lg hover:shadow-xl active:scale-95 transition-all disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #e91e63, #c2185b)" }}
              >
                {loading ? "Inscription..." : "Créer mon compte"}
              </button>
            </form>
          )}
        </div>
      </div>

      <button
        onClick={onBack}
        className="mt-4 text-sm font-semibold text-rose-800/80 hover:text-rose-900 bg-white/50 rounded-full px-4 py-2 transition-colors"
      >
        ← Retour
      </button>
    </div>
  );
}
