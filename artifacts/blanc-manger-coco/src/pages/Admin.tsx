import { useState, useEffect, useCallback } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${window.location.origin}${BASE}/api/admin`;

interface QuestionCard { id: number; text: string; blanks: number; active: boolean; createdAt: string; }
interface AnswerCard { id: number; text: string; isBlank: boolean; active: boolean; createdAt: string; }
interface UndercoverWordPair { id: number; wordCivilian: string; wordUndercover: string; active: boolean; createdAt: string; }
interface PBCategory { id: number; name: string; active: boolean; createdAt: string; }

type BMCTab = "questions" | "answers";
type GameTab = "bmc" | "undercover" | "petitbac" | "settings";

function apiFetch(path: string, token: string, opts?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers || {}) },
  });
}

async function readApiError(res: Response) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => null);
    return data?.error || "Erreur.";
  }
  const text = await res.text().catch(() => "");
  return text ? "Erreur serveur. Réessaie après quelques secondes." : "Erreur.";
}

export default function Admin() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem("bmc_admin_token"));
  const [adminName, setAdminName] = useState<string>(() => sessionStorage.getItem("bmc_admin_name") || "");
  const [loginUser, setLoginUser] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [gameTab, setGameTab] = useState<GameTab>("bmc");
  const [bmcTab, setBmcTab] = useState<BMCTab>("questions");

  const [questions, setQuestions] = useState<QuestionCard[]>([]);
  const [answers, setAnswers] = useState<AnswerCard[]>([]);
  const [undercoverWords, setUndercoverWords] = useState<UndercoverWordPair[]>([]);
  const [pbCategories, setPBCategories] = useState<PBCategory[]>([]);
  const [gameSettings, setGameSettings] = useState<Record<string, boolean>>({ bmc: true, connect4: true, undercover: true, petitbac: true });
  const [settingsSaving, setSettingsSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [qSearch, setQSearch] = useState("");
  const [aSearch, setASearch] = useState("");
  const [uSearch, setUSearch] = useState("");
  const [pbSearch, setPBSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [editingQ, setEditingQ] = useState<QuestionCard | null>(null);
  const [editingA, setEditingA] = useState<AnswerCard | null>(null);
  const [editingU, setEditingU] = useState<UndercoverWordPair | null>(null);
  const [editingPB, setEditingPB] = useState<PBCategory | null>(null);
  const [addingQ, setAddingQ] = useState(false);
  const [addingA, setAddingA] = useState(false);
  const [addingU, setAddingU] = useState(false);
  const [addingPB, setAddingPB] = useState(false);

  const [newQText, setNewQText] = useState("");
  const [newAText, setNewAText] = useState("");
  const [newABlank, setNewABlank] = useState(false);
  const [newUCivilian, setNewUCivilian] = useState("");
  const [newUUndercover, setNewUUndercover] = useState("");
  const [newPBName, setNewPBName] = useState("");

  const [changePwd, setChangePwd] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [changeUsernameOpen, setChangeUsernameOpen] = useState(false);
  const [newAdminName, setNewAdminName] = useState(() => sessionStorage.getItem("bmc_admin_name") || "");
  const [usernameMsg, setUsernameMsg] = useState("");

  const logout = () => {
    sessionStorage.removeItem("bmc_admin_token");
    sessionStorage.removeItem("bmc_admin_name");
    setToken(null);
    setAdminName("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUser, code: loginCode }),
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || "Erreur de connexion."); }
      else {
        sessionStorage.setItem("bmc_admin_token", data.token);
        sessionStorage.setItem("bmc_admin_name", data.username);
        setToken(data.token);
        setAdminName(data.username);
        setNewAdminName(data.username);
      }
    } catch { setLoginError("Impossible de contacter le serveur."); }
    finally { setLoginLoading(false); }
  };

  const loadQuestions = useCallback(async (showSpinner = true) => {
    if (!token) return;
    if (showSpinner) setLoading(true);
    try {
      const res = await apiFetch("/questions", token);
      if (res.status === 401) { logout(); return; }
      setQuestions(await res.json());
    } catch { setError("Erreur de chargement des questions."); }
    finally { if (showSpinner) setLoading(false); }
  }, [token]);

  const loadAnswers = useCallback(async (showSpinner = true) => {
    if (!token) return;
    if (showSpinner) setLoading(true);
    try {
      const res = await apiFetch("/answers", token);
      if (res.status === 401) { logout(); return; }
      setAnswers(await res.json());
    } catch { setError("Erreur de chargement des réponses."); }
    finally { if (showSpinner) setLoading(false); }
  }, [token]);

  const loadUndercoverWords = useCallback(async (showSpinner = true) => {
    if (!token) return;
    if (showSpinner) setLoading(true);
    try {
      const res = await apiFetch("/undercover-word-pairs", token);
      if (res.status === 401) { logout(); return; }
      setUndercoverWords(await res.json());
    } catch { setError("Erreur de chargement des mots Undercover."); }
    finally { if (showSpinner) setLoading(false); }
  }, [token]);

  const loadPBCategories = useCallback(async (showSpinner = true) => {
    if (!token) return;
    if (showSpinner) setLoading(true);
    try {
      const res = await apiFetch("/petitbac-categories", token);
      if (res.status === 401) { logout(); return; }
      setPBCategories(await res.json());
    } catch { setError("Erreur de chargement des catégories."); }
    finally { if (showSpinner) setLoading(false); }
  }, [token]);

  const loadGameSettings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch("/game-settings", token);
      if (res.status === 401) { logout(); return; }
      setGameSettings(await res.json());
    } catch { /* silent */ }
  }, [token]);

  const toggleGameSetting = async (gameKey: string, enabled: boolean) => {
    if (!token) return;
    setSettingsSaving(gameKey);
    try {
      const res = await apiFetch(`/game-settings/${gameKey}`, token, { method: "PUT", body: JSON.stringify({ enabled }) });
      if (res.ok) setGameSettings(prev => ({ ...prev, [gameKey]: enabled }));
      else setError(await readApiError(res));
    } catch { setError("Erreur lors de la sauvegarde."); }
    finally { setSettingsSaving(null); }
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([loadQuestions(false), loadAnswers(false), loadUndercoverWords(false), loadPBCategories(false), loadGameSettings()]).finally(() => setLoading(false));
  }, [token, loadQuestions, loadAnswers, loadUndercoverWords, loadPBCategories, loadGameSettings]);

  // BMC Actions
  const addQuestion = async () => {
    if (!token || !newQText.trim()) return;
    const res = await apiFetch("/questions", token, { method: "POST", body: JSON.stringify({ text: newQText }) });
    if (res.ok) { setNewQText(""); setAddingQ(false); loadQuestions(); }
    else { setError(await readApiError(res)); }
  };

  const updateQuestion = async (q: QuestionCard) => {
    if (!token) return;
    const res = await apiFetch(`/questions/${q.id}`, token, { method: "PUT", body: JSON.stringify({ text: q.text, blanks: q.blanks, active: q.active }) });
    if (res.ok) { setEditingQ(null); loadQuestions(); }
    else { setError(await readApiError(res)); }
  };

  const deleteQuestion = async (id: number) => {
    if (!token || !confirm("Supprimer cette question définitivement ?")) return;
    const res = await apiFetch(`/questions/${id}`, token, { method: "DELETE" });
    if (res.ok) loadQuestions();
  };

  const addAnswer = async () => {
    if (!token || !newAText.trim()) return;
    const res = await apiFetch("/answers", token, { method: "POST", body: JSON.stringify({ text: newAText, isBlank: newABlank }) });
    if (res.ok) { setNewAText(""); setNewABlank(false); setAddingA(false); loadAnswers(); }
    else { setError(await readApiError(res)); }
  };

  const updateAnswer = async (a: AnswerCard) => {
    if (!token) return;
    const res = await apiFetch(`/answers/${a.id}`, token, { method: "PUT", body: JSON.stringify({ text: a.text, isBlank: a.isBlank, active: a.active }) });
    if (res.ok) { setEditingA(null); loadAnswers(); }
    else { setError(await readApiError(res)); }
  };

  const deleteAnswer = async (id: number) => {
    if (!token || !confirm("Supprimer cette réponse définitivement ?")) return;
    const res = await apiFetch(`/answers/${id}`, token, { method: "DELETE" });
    if (res.ok) loadAnswers();
  };

  const addUndercoverWordPair = async () => {
    if (!token || !newUCivilian.trim() || !newUUndercover.trim()) return;
    const res = await apiFetch("/undercover-word-pairs", token, { method: "POST", body: JSON.stringify({ wordCivilian: newUCivilian, wordUndercover: newUUndercover }) });
    if (res.ok) { setNewUCivilian(""); setNewUUndercover(""); setAddingU(false); loadUndercoverWords(); }
    else { setError(await readApiError(res)); }
  };

  const updateUndercoverWordPair = async (pair: UndercoverWordPair) => {
    if (!token) return;
    const res = await apiFetch(`/undercover-word-pairs/${pair.id}`, token, { method: "PUT", body: JSON.stringify({ wordCivilian: pair.wordCivilian, wordUndercover: pair.wordUndercover, active: pair.active }) });
    if (res.ok) { setEditingU(null); loadUndercoverWords(); }
    else { setError(await readApiError(res)); }
  };

  const deleteUndercoverWordPair = async (id: number) => {
    if (!token || !confirm("Supprimer ce groupe de mots définitivement ?")) return;
    const res = await apiFetch(`/undercover-word-pairs/${id}`, token, { method: "DELETE" });
    if (res.ok) loadUndercoverWords();
  };

  // Petit Bac Actions
  const addPBCategory = async () => {
    if (!token || !newPBName.trim()) return;
    const res = await apiFetch("/petitbac-categories", token, { method: "POST", body: JSON.stringify({ name: newPBName }) });
    if (res.ok) { setNewPBName(""); setAddingPB(false); loadPBCategories(); }
    else { setError(await readApiError(res)); }
  };

  const updatePBCategory = async (cat: PBCategory) => {
    if (!token) return;
    const res = await apiFetch(`/petitbac-categories/${cat.id}`, token, { method: "PUT", body: JSON.stringify({ name: cat.name, active: cat.active }) });
    if (res.ok) { setEditingPB(null); loadPBCategories(); }
    else { const d = await res.json(); setError(d.error || "Erreur."); }
  };

  const deletePBCategory = async (id: number) => {
    if (!token || !confirm("Supprimer cette catégorie définitivement ?")) return;
    const res = await apiFetch(`/petitbac-categories/${id}`, token, { method: "DELETE" });
    if (res.ok) loadPBCategories();
  };

  // Account
  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg("");
    if (!token) return;
    const res = await apiFetch("/change-password", token, { method: "POST", body: JSON.stringify({ newCode: newPwd }) });
    const d = await res.json();
    if (res.ok) { setPwdMsg("Mot de passe changé avec succès !"); setNewPwd(""); }
    else { setPwdMsg(d.error || "Erreur."); }
  };

  const changeUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameMsg("");
    if (!token) return;
    const res = await apiFetch("/change-username", token, { method: "POST", body: JSON.stringify({ username: newAdminName }) });
    const d = await res.json();
    if (res.ok) {
      sessionStorage.setItem("bmc_admin_name", d.username);
      setAdminName(d.username);
      setNewAdminName(d.username);
      setUsernameMsg("Pseudo changé avec succès !");
    } else { setUsernameMsg(d.error || "Erreur."); }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
          <h1 className="text-2xl font-bold text-rose-600 mb-6 text-center">Administration</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pseudo</label>
              <input type="text" value={loginUser} onChange={e => setLoginUser(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400" placeholder="admin" autoComplete="username" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code d'accès</label>
              <input type="password" value={loginCode} onChange={e => setLoginCode(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400" placeholder="••••••••" autoComplete="current-password" />
            </div>
            {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
            <button type="submit" disabled={loginLoading} className="w-full bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2.5 rounded-lg transition">
              {loginLoading ? "Connexion..." : "Se connecter"}
            </button>
          </form>
          <p className="text-center mt-4"><a href="/" className="text-rose-400 text-sm hover:underline">← Retour au jeu</a></p>
        </div>
      </div>
    );
  }

  const filteredQuestions = questions.filter(q => (showInactive || q.active) && q.text.toLowerCase().includes(qSearch.toLowerCase()));
  const filteredAnswers = answers.filter(a => (showInactive || a.active) && a.text.toLowerCase().includes(aSearch.toLowerCase()));
  const filteredUndercoverWords = undercoverWords.filter(pair => (showInactive || pair.active) && `${pair.wordCivilian} ${pair.wordUndercover}`.toLowerCase().includes(uSearch.toLowerCase()));
  const filteredPBCategories = pbCategories.filter(cat => (showInactive || cat.active) && cat.name.toLowerCase().includes(pbSearch.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-rose-600">Administration</h1>
          <span className="text-gray-400 text-sm">·</span>
          <span className="text-gray-600 text-sm">{adminName}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setChangeUsernameOpen(!changeUsernameOpen); setNewAdminName(adminName); setUsernameMsg(""); }} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100">Changer le pseudo</button>
          <button onClick={() => setChangePwd(!changePwd)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100">Changer le mot de passe</button>
          <a href="/" className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100">← Jeu</a>
          <button onClick={logout} className="text-sm text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50">Déconnexion</button>
        </div>
      </header>

      {changeUsernameOpen && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-3">
          <form onSubmit={changeUsername} className="flex items-center gap-3 max-w-xl">
            <input type="text" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} placeholder="Nouveau pseudo admin" className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
            <button type="submit" className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-1.5 rounded-lg">Changer</button>
            {usernameMsg && <span className="text-sm text-gray-600">{usernameMsg}</span>}
          </form>
        </div>
      )}

      {changePwd && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
          <form onSubmit={changePassword} className="flex items-center gap-3 max-w-xl">
            <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Nouveau code d'accès (min 6 caractères)" className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
            <button type="submit" className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-semibold px-4 py-1.5 rounded-lg">Changer</button>
            {pwdMsg && <span className="text-sm text-gray-600">{pwdMsg}</span>}
          </form>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-4">
        {/* Game selector tabs */}
        <div className="flex gap-1 mb-5 bg-white rounded-xl border border-gray-200 p-1 w-fit shadow-sm">
          <button
            onClick={() => setGameTab("bmc")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${gameTab === "bmc" ? "bg-rose-500 text-white shadow" : "text-gray-600 hover:bg-gray-100"}`}
          >
            🃏 Blanc Manger Coco
          </button>
          <button
            onClick={() => setGameTab("undercover")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${gameTab === "undercover" ? "bg-purple-500 text-white shadow" : "text-gray-600 hover:bg-gray-100"}`}
          >
            🕵️ Undercover
          </button>
          <button
            onClick={() => setGameTab("petitbac")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${gameTab === "petitbac" ? "bg-blue-500 text-white shadow" : "text-gray-600 hover:bg-gray-100"}`}
          >
            🔤 Petit Bac
          </button>
          <button
            onClick={() => setGameTab("settings")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${gameTab === "settings" ? "bg-gray-700 text-white shadow" : "text-gray-600 hover:bg-gray-100"}`}
          >
            ⚙️ Paramètres
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-2 mb-4 text-sm flex justify-between">
            {error}
            <button onClick={() => setError("")} className="font-bold">×</button>
          </div>
        )}

        {/* BMC section */}
        {gameTab === "bmc" && (
          <>
            <div className="flex gap-1 mb-4 bg-white rounded-xl border border-gray-200 p-1 w-fit">
              {(["questions", "answers"] as BMCTab[]).map(t => (
                <button key={t} onClick={() => setBmcTab(t)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${bmcTab === t ? "bg-rose-500 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                  {t === "questions" ? `Questions (${questions.length})` : `Réponses (${answers.length})`}
                </button>
              ))}
            </div>

            {bmcTab === "questions" && (
              <div>
                <div className="flex gap-3 mb-4 items-center">
                  <input type="text" value={qSearch} onChange={e => setQSearch(e.target.value)} placeholder="Rechercher..." className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
                  <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Voir inactives</label>
                  <button onClick={() => { setAddingQ(true); setNewQText(""); }} className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-lg whitespace-nowrap">+ Ajouter</button>
                </div>
                {addingQ && (
                  <div className="bg-white border border-rose-200 rounded-xl p-4 mb-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Nouvelle question (utilise _____ pour le blanc)</p>
                    <textarea value={newQText} onChange={e => setNewQText(e.target.value)} rows={2} placeholder="Ex: Mon chat me regarde faire _____ depuis des heures." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 mb-3" />
                    <div className="flex gap-2">
                      <button onClick={addQuestion} className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">Ajouter</button>
                      <button onClick={() => setAddingQ(false)} className="text-gray-500 hover:text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-100">Annuler</button>
                    </div>
                  </div>
                )}
                {loading ? <div className="text-center text-gray-400 py-8">Chargement...</div> : (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-200 bg-gray-50"><th className="text-left px-4 py-3 text-gray-500 font-medium w-12">#</th><th className="text-left px-4 py-3 text-gray-500 font-medium">Texte</th><th className="text-left px-4 py-3 text-gray-500 font-medium w-20">Statut</th><th className="px-4 py-3 w-36"></th></tr></thead>
                      <tbody>
                        {filteredQuestions.map(q => (
                          <tr key={q.id} className={`border-b border-gray-100 hover:bg-gray-50 ${!q.active ? "opacity-50" : ""}`}>
                            <td className="px-4 py-3 text-gray-400">{q.id}</td>
                            <td className="px-4 py-3">
                              {editingQ?.id === q.id ? (
                                <div className="flex gap-2 items-start">
                                  <textarea value={editingQ.text} onChange={e => setEditingQ({ ...editingQ, text: e.target.value })} rows={2} className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
                                  <div className="flex flex-col gap-1">
                                    <button onClick={() => updateQuestion(editingQ)} className="bg-rose-500 text-white text-xs px-2 py-1 rounded">OK</button>
                                    <button onClick={() => setEditingQ(null)} className="text-gray-500 text-xs px-2 py-1 rounded hover:bg-gray-100">✕</button>
                                  </div>
                                </div>
                              ) : <span>{q.text}</span>}
                            </td>
                            <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${q.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{q.active ? "Active" : "Inactive"}</span></td>
                            <td className="px-4 py-3"><div className="flex gap-1 justify-end">
                              <button onClick={() => setEditingQ(editingQ?.id === q.id ? null : { ...q })} className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded hover:bg-blue-50">Modifier</button>
                              <button onClick={() => updateQuestion({ ...q, active: !q.active })} className="text-yellow-600 hover:text-yellow-800 text-xs px-2 py-1 rounded hover:bg-yellow-50">{q.active ? "Désact." : "Activer"}</button>
                              <button onClick={() => deleteQuestion(q.id)} className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50">Suppr.</button>
                            </div></td>
                          </tr>
                        ))}
                        {filteredQuestions.length === 0 && <tr><td colSpan={4} className="text-center text-gray-400 py-8">Aucune question trouvée.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {bmcTab === "answers" && (
              <div>
                <div className="flex gap-3 mb-4 items-center">
                  <input type="text" value={aSearch} onChange={e => setASearch(e.target.value)} placeholder="Rechercher..." className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
                  <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Voir inactives</label>
                  <button onClick={() => { setAddingA(true); setNewAText(""); setNewABlank(false); }} className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-lg whitespace-nowrap">+ Ajouter</button>
                </div>
                {addingA && (
                  <div className="bg-white border border-rose-200 rounded-xl p-4 mb-4">
                    <input type="text" value={newAText} onChange={e => setNewAText(e.target.value)} placeholder="Texte de la réponse" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 mb-3" />
                    <label className="flex items-center gap-2 text-sm text-gray-600 mb-3"><input type="checkbox" checked={newABlank} onChange={e => setNewABlank(e.target.checked)} /> Carte blanche</label>
                    <div className="flex gap-2">
                      <button onClick={addAnswer} className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">Ajouter</button>
                      <button onClick={() => setAddingA(false)} className="text-gray-500 hover:text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-100">Annuler</button>
                    </div>
                  </div>
                )}
                {loading ? <div className="text-center text-gray-400 py-8">Chargement...</div> : (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-200 bg-gray-50"><th className="text-left px-4 py-3 text-gray-500 font-medium w-12">#</th><th className="text-left px-4 py-3 text-gray-500 font-medium">Texte</th><th className="text-left px-4 py-3 text-gray-500 font-medium">Type</th><th className="text-left px-4 py-3 text-gray-500 font-medium w-20">Statut</th><th className="px-4 py-3 w-36"></th></tr></thead>
                      <tbody>
                        {filteredAnswers.map(a => (
                          <tr key={a.id} className={`border-b border-gray-100 hover:bg-gray-50 ${!a.active ? "opacity-50" : ""}`}>
                            <td className="px-4 py-3 text-gray-400">{a.id}</td>
                            <td className="px-4 py-3">
                              {editingA?.id === a.id ? (
                                <div className="flex gap-2 items-start">
                                  <input type="text" value={editingA.text} onChange={e => setEditingA({ ...editingA, text: e.target.value })} className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" />
                                  <button onClick={() => updateAnswer(editingA)} className="bg-rose-500 text-white text-xs px-2 py-1 rounded">OK</button>
                                  <button onClick={() => setEditingA(null)} className="text-gray-500 text-xs px-2 py-1 rounded hover:bg-gray-100">✕</button>
                                </div>
                              ) : <span>{a.text}</span>}
                            </td>
                            <td className="px-4 py-3"><span className={`text-xs ${a.isBlank ? "text-purple-600" : "text-gray-500"}`}>{a.isBlank ? "Blanche" : "Normale"}</span></td>
                            <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{a.active ? "Active" : "Inactive"}</span></td>
                            <td className="px-4 py-3"><div className="flex gap-1 justify-end">
                              <button onClick={() => setEditingA(editingA?.id === a.id ? null : { ...a })} className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded hover:bg-blue-50">Modifier</button>
                              <button onClick={() => updateAnswer({ ...a, active: !a.active })} className="text-yellow-600 hover:text-yellow-800 text-xs px-2 py-1 rounded hover:bg-yellow-50">{a.active ? "Désact." : "Activer"}</button>
                              <button onClick={() => deleteAnswer(a.id)} className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50">Suppr.</button>
                            </div></td>
                          </tr>
                        ))}
                        {filteredAnswers.length === 0 && <tr><td colSpan={5} className="text-center text-gray-400 py-8">Aucune réponse trouvée.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

          </>
        )}

        {gameTab === "undercover" && (
          <div>
            <div className="flex gap-3 mb-4 items-center">
              <input type="text" value={uSearch} onChange={e => setUSearch(e.target.value)} placeholder="Rechercher..." className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Voir inactifs</label>
              <button onClick={() => { setAddingU(true); setNewUCivilian(""); setNewUUndercover(""); }} className="bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold px-4 py-2 rounded-lg whitespace-nowrap">+ Ajouter</button>
            </div>
            {addingU && (
              <div className="bg-white border border-purple-200 rounded-xl p-4 mb-4">
                <div className="flex gap-3 mb-3">
                  <input type="text" value={newUCivilian} onChange={e => setNewUCivilian(e.target.value)} placeholder="Mot civil" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  <input type="text" value={newUUndercover} onChange={e => setNewUUndercover(e.target.value)} placeholder="Mot undercover" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
                <div className="flex gap-2">
                  <button onClick={addUndercoverWordPair} className="bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">Ajouter</button>
                  <button onClick={() => setAddingU(false)} className="text-gray-500 hover:text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-100">Annuler</button>
                </div>
              </div>
            )}
            {loading ? <div className="text-center text-gray-400 py-8">Chargement...</div> : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-200 bg-gray-50"><th className="text-left px-4 py-3 text-gray-500 font-medium w-12">#</th><th className="text-left px-4 py-3 text-gray-500 font-medium">Civil</th><th className="text-left px-4 py-3 text-gray-500 font-medium">Undercover</th><th className="text-left px-4 py-3 text-gray-500 font-medium w-20">Statut</th><th className="px-4 py-3 w-36"></th></tr></thead>
                  <tbody>
                    {filteredUndercoverWords.map(pair => (
                      <tr key={pair.id} className={`border-b border-gray-100 hover:bg-gray-50 ${!pair.active ? "opacity-50" : ""}`}>
                        <td className="px-4 py-3 text-gray-400">{pair.id}</td>
                        <td className="px-4 py-3">
                          {editingU?.id === pair.id ? <input type="text" value={editingU.wordCivilian} onChange={e => setEditingU({ ...editingU, wordCivilian: e.target.value })} className="border border-gray-300 rounded px-2 py-1 text-sm w-full" /> : <span>{pair.wordCivilian}</span>}
                        </td>
                        <td className="px-4 py-3">
                          {editingU?.id === pair.id ? (
                            <div className="flex gap-2 items-center">
                              <input type="text" value={editingU.wordUndercover} onChange={e => setEditingU({ ...editingU, wordUndercover: e.target.value })} className="border border-gray-300 rounded px-2 py-1 text-sm flex-1" />
                              <button onClick={() => updateUndercoverWordPair(editingU)} className="bg-purple-500 text-white text-xs px-2 py-1 rounded">OK</button>
                              <button onClick={() => setEditingU(null)} className="text-gray-500 text-xs px-2 py-1 rounded hover:bg-gray-100">✕</button>
                            </div>
                          ) : <span>{pair.wordUndercover}</span>}
                        </td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pair.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{pair.active ? "Actif" : "Inactif"}</span></td>
                        <td className="px-4 py-3"><div className="flex gap-1 justify-end">
                          <button onClick={() => setEditingU(editingU?.id === pair.id ? null : { ...pair })} className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded hover:bg-blue-50">Modifier</button>
                          <button onClick={() => updateUndercoverWordPair({ ...pair, active: !pair.active })} className="text-yellow-600 hover:text-yellow-800 text-xs px-2 py-1 rounded hover:bg-yellow-50">{pair.active ? "Désact." : "Activer"}</button>
                          <button onClick={() => deleteUndercoverWordPair(pair.id)} className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50">Suppr.</button>
                        </div></td>
                      </tr>
                    ))}
                    {filteredUndercoverWords.length === 0 && <tr><td colSpan={5} className="text-center text-gray-400 py-8">Aucun mot trouvé.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Petit Bac section */}
        {gameTab === "petitbac" && (
          <div>
            <div className="flex gap-3 mb-4 items-center">
              <input type="text" value={pbSearch} onChange={e => setPBSearch(e.target.value)} placeholder="Rechercher une catégorie..." className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Voir inactives</label>
              <button onClick={() => { setAddingPB(true); setNewPBName(""); }} className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg whitespace-nowrap">+ Ajouter</button>
            </div>

            {addingPB && (
              <div className="bg-white border border-blue-200 rounded-xl p-4 mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Nouvelle catégorie Petit Bac</p>
                <input type="text" value={newPBName} onChange={e => setNewPBName(e.target.value)} placeholder="Ex: Prénom, Animal, Ville..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mb-3" onKeyDown={e => e.key === "Enter" && addPBCategory()} />
                <div className="flex gap-2">
                  <button onClick={addPBCategory} className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">Ajouter</button>
                  <button onClick={() => setAddingPB(false)} className="text-gray-500 hover:text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-100">Annuler</button>
                </div>
              </div>
            )}

            {loading ? <div className="text-center text-gray-400 py-8">Chargement...</div> : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-200 bg-gray-50"><th className="text-left px-4 py-3 text-gray-500 font-medium w-12">#</th><th className="text-left px-4 py-3 text-gray-500 font-medium">Nom de la catégorie</th><th className="text-left px-4 py-3 text-gray-500 font-medium w-20">Statut</th><th className="px-4 py-3 w-36"></th></tr></thead>
                  <tbody>
                    {filteredPBCategories.map(cat => (
                      <tr key={cat.id} className={`border-b border-gray-100 hover:bg-gray-50 ${!cat.active ? "opacity-50" : ""}`}>
                        <td className="px-4 py-3 text-gray-400">{cat.id}</td>
                        <td className="px-4 py-3">
                          {editingPB?.id === cat.id ? (
                            <div className="flex gap-2 items-center">
                              <input type="text" value={editingPB.name} onChange={e => setEditingPB({ ...editingPB, name: e.target.value })} className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" onKeyDown={e => e.key === "Enter" && updatePBCategory(editingPB)} />
                              <button onClick={() => updatePBCategory(editingPB)} className="bg-blue-500 text-white text-xs px-2 py-1 rounded">OK</button>
                              <button onClick={() => setEditingPB(null)} className="text-gray-500 text-xs px-2 py-1 rounded hover:bg-gray-100">✕</button>
                            </div>
                          ) : <span className="font-medium">{cat.name}</span>}
                        </td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{cat.active ? "Active" : "Inactive"}</span></td>
                        <td className="px-4 py-3"><div className="flex gap-1 justify-end">
                          <button onClick={() => setEditingPB(editingPB?.id === cat.id ? null : { ...cat })} className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded hover:bg-blue-50">Modifier</button>
                          <button onClick={() => updatePBCategory({ ...cat, active: !cat.active })} className="text-yellow-600 hover:text-yellow-800 text-xs px-2 py-1 rounded hover:bg-yellow-50">{cat.active ? "Désact." : "Activer"}</button>
                          <button onClick={() => deletePBCategory(cat.id)} className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50">Suppr.</button>
                        </div></td>
                      </tr>
                    ))}
                    {filteredPBCategories.length === 0 && <tr><td colSpan={4} className="text-center text-gray-400 py-8">Aucune catégorie trouvée. Ajoutez-en avec le bouton ci-dessus.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Settings section */}
        {gameTab === "settings" && (
          <div className="max-w-md">
            <h2 className="text-lg font-black text-gray-800 mb-1">Activation des jeux</h2>
            <p className="text-sm text-gray-500 mb-5">Active ou désactive chaque mode de jeu sur la plateforme.</p>
            <div className="space-y-3">
              {([
                { key: "bmc", label: "Blanc Manger Coco", emoji: "🃏" },
                { key: "connect4", label: "Puissance 4", emoji: "🔴" },
                { key: "undercover", label: "Undercover", emoji: "🕵️" },
                { key: "petitbac", label: "Petit Bac", emoji: "🔤" },
              ] as const).map(({ key, label, emoji }) => {
                const enabled = gameSettings[key] !== false;
                const saving = settingsSaving === key;
                return (
                  <div key={key} className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4 shadow-sm">
                    <span className="text-2xl">{emoji}</span>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">{label}</p>
                      <p className={`text-xs font-medium ${enabled ? "text-green-600" : "text-gray-400"}`}>
                        {enabled ? "Activé" : "Désactivé"}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleGameSetting(key, !enabled)}
                      disabled={saving}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none disabled:opacity-60 ${enabled ? "bg-green-500" : "bg-gray-300"}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-8" : "translate-x-1"}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
