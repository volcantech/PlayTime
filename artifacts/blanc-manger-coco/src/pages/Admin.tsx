import { useState, useEffect, useCallback } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${window.location.origin}${BASE}/api/admin`;

interface QuestionCard {
  id: number;
  text: string;
  blanks: number;
  active: boolean;
  createdAt: string;
}

interface AnswerCard {
  id: number;
  text: string;
  isBlank: boolean;
  active: boolean;
  createdAt: string;
}

type Tab = "questions" | "answers";

function apiFetch(path: string, token: string, opts?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts?.headers || {}),
    },
  });
}

export default function Admin() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem("bmc_admin_token"));
  const [adminName, setAdminName] = useState<string>(() => sessionStorage.getItem("bmc_admin_name") || "");
  const [loginUser, setLoginUser] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [tab, setTab] = useState<Tab>("questions");
  const [questions, setQuestions] = useState<QuestionCard[]>([]);
  const [answers, setAnswers] = useState<AnswerCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [qSearch, setQSearch] = useState("");
  const [aSearch, setASearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [editingQ, setEditingQ] = useState<QuestionCard | null>(null);
  const [editingA, setEditingA] = useState<AnswerCard | null>(null);
  const [addingQ, setAddingQ] = useState(false);
  const [addingA, setAddingA] = useState(false);

  const [newQText, setNewQText] = useState("");
  const [newAText, setNewAText] = useState("");
  const [newABlank, setNewABlank] = useState(false);

  const [changePwd, setChangePwd] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");

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
      if (!res.ok) {
        setLoginError(data.error || "Erreur de connexion.");
      } else {
        sessionStorage.setItem("bmc_admin_token", data.token);
        sessionStorage.setItem("bmc_admin_name", data.username);
        setToken(data.token);
        setAdminName(data.username);
      }
    } catch {
      setLoginError("Impossible de contacter le serveur.");
    } finally {
      setLoginLoading(false);
    }
  };

  const loadQuestions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/questions", token);
      if (res.status === 401) { logout(); return; }
      const data = await res.json();
      setQuestions(data);
    } catch {
      setError("Erreur de chargement des questions.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadAnswers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/answers", token);
      if (res.status === 401) { logout(); return; }
      const data = await res.json();
      setAnswers(data);
    } catch {
      setError("Erreur de chargement des réponses.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (tab === "questions") loadQuestions();
    else loadAnswers();
  }, [token, tab, loadQuestions, loadAnswers]);

  const addQuestion = async () => {
    if (!token || !newQText.trim()) return;
    const res = await apiFetch("/questions", token, {
      method: "POST",
      body: JSON.stringify({ text: newQText }),
    });
    if (res.ok) {
      setNewQText("");
      setAddingQ(false);
      loadQuestions();
    } else {
      const d = await res.json();
      setError(d.error || "Erreur lors de l'ajout.");
    }
  };

  const updateQuestion = async (q: QuestionCard) => {
    if (!token) return;
    const res = await apiFetch(`/questions/${q.id}`, token, {
      method: "PUT",
      body: JSON.stringify({ text: q.text, blanks: q.blanks, active: q.active }),
    });
    if (res.ok) {
      setEditingQ(null);
      loadQuestions();
    } else {
      const d = await res.json();
      setError(d.error || "Erreur lors de la modification.");
    }
  };

  const deleteQuestion = async (id: number) => {
    if (!token || !confirm("Supprimer cette question définitivement ?")) return;
    const res = await apiFetch(`/questions/${id}`, token, { method: "DELETE" });
    if (res.ok) loadQuestions();
  };

  const addAnswer = async () => {
    if (!token || !newAText.trim()) return;
    const res = await apiFetch("/answers", token, {
      method: "POST",
      body: JSON.stringify({ text: newAText, isBlank: newABlank }),
    });
    if (res.ok) {
      setNewAText("");
      setNewABlank(false);
      setAddingA(false);
      loadAnswers();
    } else {
      const d = await res.json();
      setError(d.error || "Erreur lors de l'ajout.");
    }
  };

  const updateAnswer = async (a: AnswerCard) => {
    if (!token) return;
    const res = await apiFetch(`/answers/${a.id}`, token, {
      method: "PUT",
      body: JSON.stringify({ text: a.text, isBlank: a.isBlank, active: a.active }),
    });
    if (res.ok) {
      setEditingA(null);
      loadAnswers();
    } else {
      const d = await res.json();
      setError(d.error || "Erreur lors de la modification.");
    }
  };

  const deleteAnswer = async (id: number) => {
    if (!token || !confirm("Supprimer cette réponse définitivement ?")) return;
    const res = await apiFetch(`/answers/${id}`, token, { method: "DELETE" });
    if (res.ok) loadAnswers();
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg("");
    if (!token) return;
    const res = await apiFetch("/change-password", token, {
      method: "POST",
      body: JSON.stringify({ newCode: newPwd }),
    });
    const d = await res.json();
    if (res.ok) {
      setPwdMsg("Mot de passe changé avec succès !");
      setNewPwd("");
    } else {
      setPwdMsg(d.error || "Erreur.");
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
          <h1 className="text-2xl font-bold text-rose-600 mb-1 text-center">Administration</h1>
          <p className="text-gray-500 text-sm text-center mb-6">Blanc Manger Coco</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pseudo</label>
              <input
                type="text"
                value={loginUser}
                onChange={e => setLoginUser(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400"
                placeholder="admin"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code d'accès</label>
              <input
                type="password"
                value={loginCode}
                onChange={e => setLoginCode(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2.5 rounded-lg transition"
            >
              {loginLoading ? "Connexion..." : "Se connecter"}
            </button>
          </form>
          <p className="text-center mt-4">
            <a href="/" className="text-rose-400 text-sm hover:underline">← Retour au jeu</a>
          </p>
        </div>
      </div>
    );
  }

  const filteredQuestions = questions.filter(q =>
    (showInactive || q.active) &&
    q.text.toLowerCase().includes(qSearch.toLowerCase())
  );

  const filteredAnswers = answers.filter(a =>
    (showInactive || a.active) &&
    a.text.toLowerCase().includes(aSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-rose-600">BMC Admin</h1>
          <span className="text-gray-400 text-sm">·</span>
          <span className="text-gray-600 text-sm">{adminName}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setChangePwd(!changePwd)}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100"
          >
            Changer le mot de passe
          </button>
          <a href="/" className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100">
            ← Jeu
          </a>
          <button
            onClick={logout}
            className="text-sm text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50"
          >
            Déconnexion
          </button>
        </div>
      </header>

      {changePwd && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
          <form onSubmit={changePassword} className="flex items-center gap-3 max-w-xl">
            <input
              type="password"
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              placeholder="Nouveau code d'accès (min 6 caractères)"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
            <button type="submit" className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-semibold px-4 py-1.5 rounded-lg">
              Changer
            </button>
            {pwdMsg && <span className="text-sm text-gray-600">{pwdMsg}</span>}
          </form>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-4">
        <div className="flex gap-1 mb-4 bg-white rounded-xl border border-gray-200 p-1 w-fit">
          <button
            onClick={() => setTab("questions")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === "questions" ? "bg-rose-500 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            Questions ({questions.length})
          </button>
          <button
            onClick={() => setTab("answers")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === "answers" ? "bg-rose-500 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            Réponses ({answers.length})
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-2 mb-4 text-sm flex justify-between">
            {error}
            <button onClick={() => setError("")} className="font-bold">×</button>
          </div>
        )}

        {tab === "questions" && (
          <div>
            <div className="flex gap-3 mb-4 items-center">
              <input
                type="text"
                value={qSearch}
                onChange={e => setQSearch(e.target.value)}
                placeholder="Rechercher une question..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
              <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
                <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
                Voir inactives
              </label>
              <button
                onClick={() => { setAddingQ(true); setNewQText(""); }}
                className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-lg whitespace-nowrap"
              >
                + Ajouter
              </button>
            </div>

            {addingQ && (
              <div className="bg-white border border-rose-200 rounded-xl p-4 mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Nouvelle question (utilise _____ pour le blanc)</p>
                <textarea
                  value={newQText}
                  onChange={e => setNewQText(e.target.value)}
                  rows={2}
                  placeholder="Ex: Mon chat me regarde faire _____ depuis des heures."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 mb-3"
                />
                <div className="flex gap-2">
                  <button onClick={addQuestion} className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                    Ajouter
                  </button>
                  <button onClick={() => setAddingQ(false)} className="text-gray-500 hover:text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-100">
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="text-center text-gray-400 py-8">Chargement...</div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 text-gray-500 font-medium w-12">#</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Texte</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium w-20">Statut</th>
                      <th className="px-4 py-3 w-32"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuestions.map(q => (
                      <tr key={q.id} className={`border-b border-gray-100 hover:bg-gray-50 ${!q.active ? "opacity-50" : ""}`}>
                        <td className="px-4 py-3 text-gray-400">{q.id}</td>
                        <td className="px-4 py-3">
                          {editingQ?.id === q.id ? (
                            <div className="flex gap-2 items-start">
                              <textarea
                                value={editingQ.text}
                                onChange={e => setEditingQ({ ...editingQ, text: e.target.value })}
                                rows={2}
                                className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                              />
                              <div className="flex flex-col gap-1">
                                <button onClick={() => updateQuestion(editingQ)} className="bg-rose-500 text-white text-xs px-2 py-1 rounded">OK</button>
                                <button onClick={() => setEditingQ(null)} className="text-gray-500 text-xs px-2 py-1 rounded hover:bg-gray-100">✕</button>
                              </div>
                            </div>
                          ) : (
                            <span>{q.text}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${q.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {q.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => setEditingQ(editingQ?.id === q.id ? null : { ...q })}
                              className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded hover:bg-blue-50"
                            >
                              Modifier
                            </button>
                            <button
                              onClick={() => updateQuestion({ ...q, active: !q.active })}
                              className="text-yellow-600 hover:text-yellow-800 text-xs px-2 py-1 rounded hover:bg-yellow-50"
                            >
                              {q.active ? "Désact." : "Activer"}
                            </button>
                            <button
                              onClick={() => deleteQuestion(q.id)}
                              className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50"
                            >
                              Suppr.
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredQuestions.length === 0 && (
                      <tr><td colSpan={4} className="text-center text-gray-400 py-8">Aucune question trouvée.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "answers" && (
          <div>
            <div className="flex gap-3 mb-4 items-center">
              <input
                type="text"
                value={aSearch}
                onChange={e => setASearch(e.target.value)}
                placeholder="Rechercher une réponse..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
              <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
                <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
                Voir inactives
              </label>
              <button
                onClick={() => { setAddingA(true); setNewAText(""); setNewABlank(false); }}
                className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-lg whitespace-nowrap"
              >
                + Ajouter
              </button>
            </div>

            {addingA && (
              <div className="bg-white border border-rose-200 rounded-xl p-4 mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Nouvelle carte réponse</p>
                <input
                  type="text"
                  value={newAText}
                  onChange={e => setNewAText(e.target.value)}
                  placeholder="Ex: Le regard vide d'un stagiaire"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 mb-3"
                />
                <label className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <input type="checkbox" checked={newABlank} onChange={e => setNewABlank(e.target.checked)} />
                  Carte vierge (le joueur écrit sa propre réponse)
                </label>
                <div className="flex gap-2">
                  <button onClick={addAnswer} className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                    Ajouter
                  </button>
                  <button onClick={() => setAddingA(false)} className="text-gray-500 hover:text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-100">
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="text-center text-gray-400 py-8">Chargement...</div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 text-gray-500 font-medium w-12">#</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Texte</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium w-20">Type</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium w-20">Statut</th>
                      <th className="px-4 py-3 w-36"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAnswers.map(a => (
                      <tr key={a.id} className={`border-b border-gray-100 hover:bg-gray-50 ${!a.active ? "opacity-50" : ""}`}>
                        <td className="px-4 py-3 text-gray-400">{a.id}</td>
                        <td className="px-4 py-3">
                          {editingA?.id === a.id ? (
                            <div className="flex gap-2 items-start">
                              <input
                                type="text"
                                value={editingA.text}
                                onChange={e => setEditingA({ ...editingA, text: e.target.value })}
                                className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                              />
                              <div className="flex flex-col gap-1">
                                <button onClick={() => updateAnswer(editingA)} className="bg-rose-500 text-white text-xs px-2 py-1 rounded">OK</button>
                                <button onClick={() => setEditingA(null)} className="text-gray-500 text-xs px-2 py-1 rounded hover:bg-gray-100">✕</button>
                              </div>
                            </div>
                          ) : (
                            <span>{a.text}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.isBlank ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                            {a.isBlank ? "Vierge" : "Normal"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {a.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => setEditingA(editingA?.id === a.id ? null : { ...a })}
                              className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded hover:bg-blue-50"
                            >
                              Modifier
                            </button>
                            <button
                              onClick={() => updateAnswer({ ...a, active: !a.active })}
                              className="text-yellow-600 hover:text-yellow-800 text-xs px-2 py-1 rounded hover:bg-yellow-50"
                            >
                              {a.active ? "Désact." : "Activer"}
                            </button>
                            <button
                              onClick={() => deleteAnswer(a.id)}
                              className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50"
                            >
                              Suppr.
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredAnswers.length === 0 && (
                      <tr><td colSpan={5} className="text-center text-gray-400 py-8">Aucune réponse trouvée.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
