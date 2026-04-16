import { useState, useEffect, useCallback } from "react";
import { AVATARS } from "@/data/avatars";
import { useAuth } from "@/hooks/useAuth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${window.location.origin}${BASE}/api/admin`;

interface QuestionCard { id: number; text: string; blanks: number; active: boolean; isAdult: boolean; createdAt: string; }
interface AnswerCard { id: number; text: string; isBlank: boolean; active: boolean; isAdult: boolean; createdAt: string; }
interface UndercoverWordPair { id: number; wordCivilian: string; wordUndercover: string; words: string | null; active: boolean; createdAt: string; }
interface PBCategory { id: number; name: string; active: boolean; createdAt: string; }
interface GWCharacterItem {
  id: number;
  name: string;
  emoji: string;
  imageUrl?: string | null;
  traits: { gender: string; hair_color: string; hair_length?: string; glasses: boolean; hat: boolean; beard: boolean; earrings: boolean; };
  active: boolean;
  createdAt: string;
}

type BMCTab = "questions" | "answers";
type GameTab = "bmc" | "undercover" | "petitbac" | "guess_who" | "settings" | "users" | "avatars";

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

interface UserAdminEntry {
  id: number;
  username: string;
  email: string;
  avatar: string;
  isAdmin: boolean;
  createdAt: string;
  stats: Record<string, { wins: number; losses: number; draws: number }>;
}

interface CustomAvatar {
  id: number;
  emoji: string;
  label: string;
  createdAt: string;
}

export default function Admin({ onBack }: { onBack?: () => void }) {
  const { user, token: userToken } = useAuth();

  const [token, setToken] = useState<string | null>(() =>
    onBack
      ? (localStorage.getItem("pt_user_token") || sessionStorage.getItem("bmc_admin_token"))
      : sessionStorage.getItem("bmc_admin_token")
  );
  const [adminName, setAdminName] = useState<string>(() => {
    if (onBack) {
      try {
        const u = JSON.parse(localStorage.getItem("pt_user") || "null");
        return u?.username || sessionStorage.getItem("bmc_admin_name") || "";
      } catch { return ""; }
    }
    return sessionStorage.getItem("bmc_admin_name") || "";
  });

  useEffect(() => {
    if (onBack && userToken) {
      setToken(userToken);
      setAdminName(user?.username || "");
    }
  }, [onBack, userToken, user?.username]);
  const [loginUser, setLoginUser] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [gameTab, setGameTab] = useState<GameTab>("bmc");
  const [bmcTab, setBmcTab] = useState<BMCTab>("questions");

  const [questions, setQuestions] = useState<QuestionCard[]>([]);
  const [qPage, setQPage] = useState(1);
  const [qTotalPages, setQTotalPages] = useState(1);
  const [qTotal, setQTotal] = useState(0);
  const [qAdultFilter, setQAdultFilter] = useState<"all" | "adult" | "normal">("all");
  const [answers, setAnswers] = useState<AnswerCard[]>([]);
  const [aPage, setAPage] = useState(1);
  const [aTotalPages, setATotalPages] = useState(1);
  const [aTotal, setATotal] = useState(0);
  const [aAdultFilter, setAAdultFilter] = useState<"all" | "adult" | "normal">("all");
  const [undercoverWords, setUndercoverWords] = useState<UndercoverWordPair[]>([]);
  const [uPage, setUPage] = useState(1);
  const [uTotalPages, setUTotalPages] = useState(1);
  const [uTotal, setUTotal] = useState(0);
  const [pbCategories, setPBCategories] = useState<PBCategory[]>([]);
  const [gameSettings, setGameSettings] = useState<Record<string, boolean>>({ bmc: true, connect4: true, undercover: true, petitbac: true, guess_who: true });
  const [settingsSaving, setSettingsSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [qSearch, setQSearch] = useState("");
  const [aSearch, setASearch] = useState("");
  const [uSearch, setUSearch] = useState("");
  const [pbSearch, setPBSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  // Guess Who characters
  const [gwCharacters, setGWCharacters] = useState<GWCharacterItem[]>([]);
  const [gwPage, setGWPage] = useState(1);
  const [gwTotalPages, setGWTotalPages] = useState(1);
  const [gwTotal, setGWTotal] = useState(0);
  const [gwSearch, setGWSearch] = useState("");
  const [gwActiveOnly, setGWActiveOnly] = useState(true);
  const [gwLoading, setGWLoading] = useState(false);
  const [editingGW, setEditingGW] = useState<GWCharacterItem | null>(null);
  const [addingGW, setAddingGW] = useState(false);
  const [newGWName, setNewGWName] = useState("");
  const [newGWImageUrl, setNewGWImageUrl] = useState("");
  const [newGWUploading, setNewGWUploading] = useState(false);
  const [editGWUploading, setEditGWUploading] = useState(false);

  const [editingQ, setEditingQ] = useState<QuestionCard | null>(null);
  const [editingA, setEditingA] = useState<AnswerCard | null>(null);
  const [editingU, setEditingU] = useState<UndercoverWordPair | null>(null);
  const [editingPB, setEditingPB] = useState<PBCategory | null>(null);
  const [addingQ, setAddingQ] = useState(false);
  const [addingA, setAddingA] = useState(false);
  const [addingU, setAddingU] = useState(false);
  const [addingPB, setAddingPB] = useState(false);

  const [newQText, setNewQText] = useState("");
  const [newQAdult, setNewQAdult] = useState(false);
  const [newAText, setNewAText] = useState("");
  const [newABlank, setNewABlank] = useState(false);
  const [newAAdult, setNewAAdult] = useState(false);
  const [newUCivilian, setNewUCivilian] = useState("");
  const [newUUndercover, setNewUUndercover] = useState("");
  const [newUWords, setNewUWords] = useState("");
  const [newPBName, setNewPBName] = useState("");

  const [changePwd, setChangePwd] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [changeUsernameOpen, setChangeUsernameOpen] = useState(false);
  const [newAdminName, setNewAdminName] = useState(() => sessionStorage.getItem("bmc_admin_name") || "");
  const [usernameMsg, setUsernameMsg] = useState("");

  // Users management
  const [users, setUsers] = useState<UserAdminEntry[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAdminEntry | null>(null);
  const [editUserPwd, setEditUserPwd] = useState("");
  const [editUserAvatar, setEditUserAvatar] = useState("");
  const [editUserStats, setEditUserStats] = useState<Record<string, { wins: number; losses: number; draws: number }>>({});
  const [userSaving, setUserSaving] = useState(false);
  const [userMsg, setUserMsg] = useState("");

  // Avatars management
  const [customAvatars, setCustomAvatars] = useState<CustomAvatar[]>([]);
  const [avatarsLoading, setAvatarsLoading] = useState(false);
  const [newAvatarEmoji, setNewAvatarEmoji] = useState("");
  const [newAvatarLabel, setNewAvatarLabel] = useState("");
  const [avatarAddMsg, setAvatarAddMsg] = useState("");
  const [addingAvatar, setAddingAvatar] = useState(false);

  const logout = () => {
    sessionStorage.removeItem("bmc_admin_token");
    sessionStorage.removeItem("bmc_admin_name");
    if (onBack) {
      onBack();
    } else {
      setToken(null);
      setAdminName("");
    }
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

  const loadQuestions = useCallback(async (opts: { page?: number; search?: string; isAdult?: string; showSpinner?: boolean } = {}) => {
    if (!token) return;
    const { page = 1, search = "", isAdult = "all", showSpinner = true } = opts;
    if (showSpinner) setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), search });
      if (isAdult !== "all") params.set("isAdult", String(isAdult === "adult"));
      const res = await apiFetch(`/questions?${params}`, token);
      if (res.status === 401) { logout(); return; }
      const data = await res.json();
      setQuestions(data.items);
      setQPage(data.page);
      setQTotalPages(data.totalPages);
      setQTotal(data.total);
    } catch { setError("Erreur de chargement des questions."); }
    finally { if (showSpinner) setLoading(false); }
  }, [token]);

  const loadAnswers = useCallback(async (opts: { page?: number; search?: string; isAdult?: string; showSpinner?: boolean } = {}) => {
    if (!token) return;
    const { page = 1, search = "", isAdult = "all", showSpinner = true } = opts;
    if (showSpinner) setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), search });
      if (isAdult !== "all") params.set("isAdult", String(isAdult === "adult"));
      const res = await apiFetch(`/answers?${params}`, token);
      if (res.status === 401) { logout(); return; }
      const data = await res.json();
      setAnswers(data.items);
      setAPage(data.page);
      setATotalPages(data.totalPages);
      setATotal(data.total);
    } catch { setError("Erreur de chargement des réponses."); }
    finally { if (showSpinner) setLoading(false); }
  }, [token]);

  const loadUndercoverWords = useCallback(async (opts: { page?: number; search?: string; showSpinner?: boolean } = {}) => {
    if (!token) return;
    const { page = 1, search = "", showSpinner = true } = opts;
    if (showSpinner) setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), search });
      const res = await apiFetch(`/undercover-word-pairs?${params}`, token);
      if (res.status === 401) { logout(); return; }
      const data = await res.json();
      setUndercoverWords(data.items);
      setUPage(data.page);
      setUTotalPages(data.totalPages);
      setUTotal(data.total);
    } catch { setError("Erreur de chargement des mots Undercover."); }
    finally { if (showSpinner) setLoading(false); }
  }, [token]);

  const loadGWCharacters = useCallback(async (opts: { page?: number; search?: string; active?: string } = {}) => {
    if (!token) return;
    const { page = 1, search = "", active = "true" } = opts;
    setGWLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), search });
      if (active !== "all") params.set("active", active);
      const res = await apiFetch(`/guess-who-characters?${params}`, token);
      if (res.status === 401) { logout(); return; }
      const data = await res.json();
      setGWCharacters(data.items);
      setGWPage(data.page);
      setGWTotalPages(data.totalPages);
      setGWTotal(data.total);
    } catch { setError("Erreur de chargement des personnages."); }
    finally { setGWLoading(false); }
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

  const loadUsers = useCallback(async (page = 1, search = "") => {
    if (!token) return;
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), search });
      const res = await apiFetch(`/users?${params}`, token);
      if (res.status === 401) { logout(); return; }
      const data = await res.json();
      setUsers(data.users);
      setUsersTotal(data.total);
      setUsersPage(data.page);
      setUsersTotalPages(data.totalPages);
    } catch { setError("Erreur de chargement des utilisateurs."); }
    finally { setUsersLoading(false); }
  }, [token]);

  const loadCustomAvatars = useCallback(async () => {
    if (!token) return;
    setAvatarsLoading(true);
    try {
      const res = await apiFetch("/avatars", token);
      if (res.status === 401) { logout(); return; }
      setCustomAvatars(await res.json());
    } catch { setError("Erreur de chargement des avatars."); }
    finally { setAvatarsLoading(false); }
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
    Promise.all([loadQuestions({ showSpinner: false }), loadAnswers({ showSpinner: false }), loadUndercoverWords({ showSpinner: false }), loadPBCategories(false), loadGameSettings()]).finally(() => setLoading(false));
  }, [token, loadQuestions, loadAnswers, loadUndercoverWords, loadPBCategories, loadGameSettings]);

  useEffect(() => {
    if (!token) return;
    if (gameTab === "users") loadUsers(1, usersSearch);
    if (gameTab === "avatars") loadCustomAvatars();
    if (gameTab === "guess_who") loadGWCharacters({ page: 1, search: "", active: "true" });
  }, [gameTab, token]);

  // BMC Actions
  const addQuestion = async () => {
    if (!token || !newQText.trim()) return;
    const res = await apiFetch("/questions", token, { method: "POST", body: JSON.stringify({ text: newQText, isAdult: newQAdult }) });
    if (res.ok) { setNewQText(""); setNewQAdult(false); setAddingQ(false); loadQuestions({ page: qPage, search: qSearch, isAdult: qAdultFilter }); }
    else { setError(await readApiError(res)); }
  };

  const updateQuestion = async (q: QuestionCard) => {
    if (!token) return;
    const res = await apiFetch(`/questions/${q.id}`, token, { method: "PUT", body: JSON.stringify({ text: q.text, blanks: q.blanks, active: q.active, isAdult: q.isAdult }) });
    if (res.ok) { setEditingQ(null); loadQuestions({ page: qPage, search: qSearch, isAdult: qAdultFilter }); }
    else { setError(await readApiError(res)); }
  };

  const deleteQuestion = async (id: number) => {
    if (!token || !confirm("Supprimer cette question définitivement ?")) return;
    const res = await apiFetch(`/questions/${id}`, token, { method: "DELETE" });
    if (res.ok) loadQuestions({ page: qPage, search: qSearch, isAdult: qAdultFilter });
  };

  const addAnswer = async () => {
    if (!token || !newAText.trim()) return;
    const res = await apiFetch("/answers", token, { method: "POST", body: JSON.stringify({ text: newAText, isBlank: newABlank, isAdult: newAAdult }) });
    if (res.ok) { setNewAText(""); setNewABlank(false); setNewAAdult(false); setAddingA(false); loadAnswers({ page: aPage, search: aSearch, isAdult: aAdultFilter }); }
    else { setError(await readApiError(res)); }
  };

  const updateAnswer = async (a: AnswerCard) => {
    if (!token) return;
    const res = await apiFetch(`/answers/${a.id}`, token, { method: "PUT", body: JSON.stringify({ text: a.text, isBlank: a.isBlank, isAdult: a.isAdult, active: a.active }) });
    if (res.ok) { setEditingA(null); loadAnswers({ page: aPage, search: aSearch, isAdult: aAdultFilter }); }
    else { setError(await readApiError(res)); }
  };

  const deleteAnswer = async (id: number) => {
    if (!token || !confirm("Supprimer cette réponse définitivement ?")) return;
    const res = await apiFetch(`/answers/${id}`, token, { method: "DELETE" });
    if (res.ok) loadAnswers({ page: aPage, search: aSearch, isAdult: aAdultFilter });
  };

  const addUndercoverWordPair = async () => {
    if (!token || !newUCivilian.trim() || !newUUndercover.trim()) return;
    const wordsArray = newUWords.split("\n").map(w => w.trim()).filter(w => w.length > 0);
    const body: Record<string, unknown> = { wordCivilian: newUCivilian, wordUndercover: newUUndercover };
    if (wordsArray.length >= 2) body.words = wordsArray;
    const res = await apiFetch("/undercover-word-pairs", token, { method: "POST", body: JSON.stringify(body) });
    if (res.ok) { setNewUCivilian(""); setNewUUndercover(""); setNewUWords(""); setAddingU(false); loadUndercoverWords({ page: uPage, search: uSearch }); }
    else { setError(await readApiError(res)); }
  };

  const updateUndercoverWordPair = async (pair: UndercoverWordPair) => {
    if (!token) return;
    const res = await apiFetch(`/undercover-word-pairs/${pair.id}`, token, { method: "PUT", body: JSON.stringify({ wordCivilian: pair.wordCivilian, wordUndercover: pair.wordUndercover, active: pair.active }) });
    if (res.ok) { setEditingU(null); loadUndercoverWords({ page: uPage, search: uSearch }); }
    else { setError(await readApiError(res)); }
  };

  const deleteUndercoverWordPair = async (id: number) => {
    if (!token || !confirm("Supprimer ce groupe de mots définitivement ?")) return;
    const res = await apiFetch(`/undercover-word-pairs/${id}`, token, { method: "DELETE" });
    if (res.ok) loadUndercoverWords({ page: uPage, search: uSearch });
  };

  const uploadGWImage = async (file: File, setUploading: (v: boolean) => void, setUrl: (url: string) => void) => {
    if (!token) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const res = await apiFetch("/upload-image", token, { method: "POST", body: JSON.stringify({ image: base64 }) });
        if (res.ok) {
          const data = await res.json();
          setUrl(data.url);
        } else {
          setError(await readApiError(res));
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch { setUploading(false); }
  };

  const addGWCharacter = async () => {
    if (!token || !newGWName.trim()) return;
    const res = await apiFetch("/guess-who-characters", token, { method: "POST", body: JSON.stringify({ name: newGWName, imageUrl: newGWImageUrl || null }) });
    if (res.ok) { setNewGWName(""); setNewGWImageUrl(""); setAddingGW(false); loadGWCharacters({ page: gwPage, search: gwSearch, active: gwActiveOnly ? "true" : "all" }); }
    else { setError(await readApiError(res)); }
  };

  const updateGWCharacter = async (char: GWCharacterItem) => {
    if (!token) return;
    const res = await apiFetch(`/guess-who-characters/${char.id}`, token, { method: "PUT", body: JSON.stringify({ name: char.name, imageUrl: char.imageUrl || null, active: char.active }) });
    if (res.ok) { setEditingGW(null); loadGWCharacters({ page: gwPage, search: gwSearch, active: gwActiveOnly ? "true" : "all" }); }
    else { setError(await readApiError(res)); }
  };

  const deleteGWCharacter = async (id: number) => {
    if (!token || !confirm("Supprimer ce personnage définitivement ?")) return;
    const res = await apiFetch(`/guess-who-characters/${id}`, token, { method: "DELETE" });
    if (res.ok) loadGWCharacters({ page: gwPage, search: gwSearch, active: gwActiveOnly ? "true" : "all" });
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

  // Users
  const openEditUser = (u: UserAdminEntry) => {
    setEditingUser(u);
    setEditUserPwd("");
    setEditUserAvatar(u.avatar);
    setEditUserStats(JSON.parse(JSON.stringify(u.stats)));
    setUserMsg("");
  };

  const saveUser = async () => {
    if (!token || !editingUser) return;
    setUserSaving(true);
    setUserMsg("");
    const body: Record<string, unknown> = {};
    if (editUserPwd.trim()) body.password = editUserPwd.trim();
    if (editUserAvatar !== editingUser.avatar) body.avatar = editUserAvatar;
    body.stats = editUserStats;
    try {
      const res = await apiFetch(`/users/${editingUser.id}`, token, { method: "PUT", body: JSON.stringify(body) });
      if (res.ok) {
        setUserMsg("Enregistré !");
        setEditUserPwd("");
        loadUsers(usersPage, usersSearch);
      } else {
        const d = await res.json().catch(() => ({}));
        setUserMsg(d.error || "Erreur.");
      }
    } catch { setUserMsg("Erreur réseau."); }
    finally { setUserSaving(false); }
  };

  const addCustomAvatar = async () => {
    if (!token || !newAvatarEmoji.trim() || !newAvatarLabel.trim()) return;
    setAvatarAddMsg("");
    const res = await apiFetch("/avatars", token, { method: "POST", body: JSON.stringify({ emoji: newAvatarEmoji.trim(), label: newAvatarLabel.trim() }) });
    if (res.ok) {
      setNewAvatarEmoji("");
      setNewAvatarLabel("");
      setAddingAvatar(false);
      setAvatarAddMsg("Avatar ajouté !");
      loadCustomAvatars();
    } else {
      const d = await res.json().catch(() => ({}));
      setAvatarAddMsg(d.error || "Erreur.");
    }
  };

  const deleteCustomAvatar = async (id: number) => {
    if (!token || !confirm("Supprimer cet avatar ?")) return;
    const res = await apiFetch(`/avatars/${id}`, token, { method: "DELETE" });
    if (res.ok) loadCustomAvatars();
    else { const d = await res.json().catch(() => ({})); setError(d.error || "Erreur."); }
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

  const filteredQuestions = questions;
  const filteredAnswers = answers;
  const filteredUndercoverWords = undercoverWords;
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
          {onBack
            ? <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100">← Jeu</button>
            : <a href="/" className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100">← Jeu</a>
          }
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
            onClick={() => setGameTab("guess_who")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${gameTab === "guess_who" ? "bg-rose-600 text-white shadow" : "text-gray-600 hover:bg-gray-100"}`}
          >
            🔍 Qui est-ce ?
          </button>
          <button
            onClick={() => setGameTab("settings")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${gameTab === "settings" ? "bg-gray-700 text-white shadow" : "text-gray-600 hover:bg-gray-100"}`}
          >
            ⚙️ Paramètres
          </button>
          <button
            onClick={() => setGameTab("users")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${gameTab === "users" ? "bg-indigo-600 text-white shadow" : "text-gray-600 hover:bg-gray-100"}`}
          >
            👥 Utilisateurs
          </button>
          <button
            onClick={() => setGameTab("avatars")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${gameTab === "avatars" ? "bg-teal-600 text-white shadow" : "text-gray-600 hover:bg-gray-100"}`}
          >
            🖼️ Avatars
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
                  {t === "questions" ? `Questions (${qTotal})` : `Réponses (${aTotal})`}
                </button>
              ))}
            </div>

            {bmcTab === "questions" && (
              <div>
                <div className="flex flex-wrap gap-3 mb-4 items-center">
                  <input type="text" value={qSearch} onChange={e => { setQSearch(e.target.value); setQPage(1); loadQuestions({ page: 1, search: e.target.value, isAdult: qAdultFilter }); }} placeholder="Rechercher..." className="flex-1 min-w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
                  <select value={qAdultFilter} onChange={e => { const v = e.target.value as "all" | "adult" | "normal"; setQAdultFilter(v); setQPage(1); loadQuestions({ page: 1, search: qSearch, isAdult: v }); }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="all">Tout</option>
                    <option value="adult">🔞 Adulte</option>
                    <option value="normal">Tout public</option>
                  </select>
                  <span className="text-xs text-gray-400">{qTotal} questions</span>
                  <button onClick={() => { setAddingQ(true); setNewQText(""); }} className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-lg whitespace-nowrap">+ Ajouter</button>
                </div>
                {addingQ && (
                  <div className="bg-white border border-rose-200 rounded-xl p-4 mb-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Nouvelle question (utilise _____ pour le blanc)</p>
                    <textarea value={newQText} onChange={e => setNewQText(e.target.value)} rows={2} placeholder="Ex: Mon chat me regarde faire _____ depuis des heures." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 mb-3" />
                    <label className="flex items-center gap-2 text-sm text-gray-600 mb-3 cursor-pointer select-none">
                      <input type="checkbox" checked={newQAdult} onChange={e => setNewQAdult(e.target.checked)} />
                      <span>🔞 Contenu adulte (+18)</span>
                    </label>
                    <div className="flex gap-2">
                      <button onClick={addQuestion} className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">Ajouter</button>
                      <button onClick={() => setAddingQ(false)} className="text-gray-500 hover:text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-100">Annuler</button>
                    </div>
                  </div>
                )}
                {loading ? <div className="text-center text-gray-400 py-8">Chargement...</div> : (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-200 bg-gray-50"><th className="text-left px-4 py-3 text-gray-500 font-medium w-12">#</th><th className="text-left px-4 py-3 text-gray-500 font-medium">Texte</th><th className="text-left px-4 py-3 text-gray-500 font-medium w-16">+18</th><th className="text-left px-4 py-3 text-gray-500 font-medium w-20">Statut</th><th className="px-4 py-3 w-36"></th></tr></thead>
                      <tbody>
                        {filteredQuestions.map(q => (
                          <tr key={q.id} className={`border-b border-gray-100 hover:bg-gray-50 ${!q.active ? "opacity-50" : ""}`}>
                            <td className="px-4 py-3 text-gray-400">{q.id}</td>
                            <td className="px-4 py-3">
                              {editingQ?.id === q.id ? (
                                <div className="flex gap-2 items-start">
                                  <div className="flex-1">
                                    <textarea value={editingQ.text} onChange={e => setEditingQ({ ...editingQ, text: e.target.value })} rows={2} className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 mb-1" />
                                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                                      <input type="checkbox" checked={editingQ.isAdult} onChange={e => setEditingQ({ ...editingQ, isAdult: e.target.checked })} />
                                      🔞 Contenu adulte
                                    </label>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <button onClick={() => updateQuestion(editingQ)} className="bg-rose-500 text-white text-xs px-2 py-1 rounded">OK</button>
                                    <button onClick={() => setEditingQ(null)} className="text-gray-500 text-xs px-2 py-1 rounded hover:bg-gray-100">✕</button>
                                  </div>
                                </div>
                              ) : <span>{q.text}</span>}
                            </td>
                            <td className="px-4 py-3">
                              <button onClick={() => updateQuestion({ ...q, isAdult: !q.isAdult })} className={`text-xs px-2 py-0.5 rounded-full font-medium transition ${q.isAdult ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}>{q.isAdult ? "🔞" : "—"}</button>
                            </td>
                            <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${q.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{q.active ? "Active" : "Inactive"}</span></td>
                            <td className="px-4 py-3"><div className="flex gap-1 justify-end">
                              <button onClick={() => setEditingQ(editingQ?.id === q.id ? null : { ...q })} className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded hover:bg-blue-50">Modifier</button>
                              <button onClick={() => updateQuestion({ ...q, active: !q.active })} className="text-yellow-600 hover:text-yellow-800 text-xs px-2 py-1 rounded hover:bg-yellow-50">{q.active ? "Désact." : "Activer"}</button>
                              <button onClick={() => deleteQuestion(q.id)} className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50">Suppr.</button>
                            </div></td>
                          </tr>
                        ))}
                        {filteredQuestions.length === 0 && <tr><td colSpan={5} className="text-center text-gray-400 py-8">Aucune question trouvée.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
                {qTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <button disabled={qPage <= 1} onClick={() => { const p = qPage - 1; setQPage(p); loadQuestions({ page: p, search: qSearch, isAdult: qAdultFilter }); }} className="px-3 py-1 rounded border text-sm disabled:opacity-40">←</button>
                    <span className="text-sm text-gray-600">Page {qPage} / {qTotalPages}</span>
                    <button disabled={qPage >= qTotalPages} onClick={() => { const p = qPage + 1; setQPage(p); loadQuestions({ page: p, search: qSearch, isAdult: qAdultFilter }); }} className="px-3 py-1 rounded border text-sm disabled:opacity-40">→</button>
                  </div>
                )}
              </div>
            )}

            {bmcTab === "answers" && (
              <div>
                <div className="flex flex-wrap gap-3 mb-4 items-center">
                  <input type="text" value={aSearch} onChange={e => { setASearch(e.target.value); setAPage(1); loadAnswers({ page: 1, search: e.target.value, isAdult: aAdultFilter }); }} placeholder="Rechercher..." className="flex-1 min-w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
                  <select value={aAdultFilter} onChange={e => { const v = e.target.value as "all" | "adult" | "normal"; setAAdultFilter(v); setAPage(1); loadAnswers({ page: 1, search: aSearch, isAdult: v }); }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="all">Tout</option>
                    <option value="adult">🔞 Adulte</option>
                    <option value="normal">Tout public</option>
                  </select>
                  <span className="text-xs text-gray-400">{aTotal} réponses</span>
                  <button onClick={() => { setAddingA(true); setNewAText(""); setNewABlank(false); }} className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-lg whitespace-nowrap">+ Ajouter</button>
                </div>
                {addingA && (
                  <div className="bg-white border border-rose-200 rounded-xl p-4 mb-4">
                    <input type="text" value={newAText} onChange={e => setNewAText(e.target.value)} placeholder="Texte de la réponse" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 mb-3" />
                    <div className="flex gap-4 mb-3">
                      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none"><input type="checkbox" checked={newABlank} onChange={e => setNewABlank(e.target.checked)} /> Carte blanche</label>
                      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none"><input type="checkbox" checked={newAAdult} onChange={e => setNewAAdult(e.target.checked)} /> 🔞 Contenu adulte (+18)</label>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addAnswer} className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">Ajouter</button>
                      <button onClick={() => setAddingA(false)} className="text-gray-500 hover:text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-100">Annuler</button>
                    </div>
                  </div>
                )}
                {loading ? <div className="text-center text-gray-400 py-8">Chargement...</div> : (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-200 bg-gray-50"><th className="text-left px-4 py-3 text-gray-500 font-medium w-12">#</th><th className="text-left px-4 py-3 text-gray-500 font-medium">Texte</th><th className="text-left px-4 py-3 text-gray-500 font-medium">Type</th><th className="text-left px-4 py-3 text-gray-500 font-medium w-16">+18</th><th className="text-left px-4 py-3 text-gray-500 font-medium w-20">Statut</th><th className="px-4 py-3 w-36"></th></tr></thead>
                      <tbody>
                        {filteredAnswers.map(a => (
                          <tr key={a.id} className={`border-b border-gray-100 hover:bg-gray-50 ${!a.active ? "opacity-50" : ""}`}>
                            <td className="px-4 py-3 text-gray-400">{a.id}</td>
                            <td className="px-4 py-3">
                              {editingA?.id === a.id ? (
                                <div className="flex gap-2 items-start">
                                  <div className="flex-1">
                                    <input type="text" value={editingA.text} onChange={e => setEditingA({ ...editingA, text: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1 text-sm mb-1" />
                                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                                      <input type="checkbox" checked={editingA.isAdult} onChange={e => setEditingA({ ...editingA, isAdult: e.target.checked })} />
                                      🔞 Contenu adulte
                                    </label>
                                  </div>
                                  <button onClick={() => updateAnswer(editingA)} className="bg-rose-500 text-white text-xs px-2 py-1 rounded">OK</button>
                                  <button onClick={() => setEditingA(null)} className="text-gray-500 text-xs px-2 py-1 rounded hover:bg-gray-100">✕</button>
                                </div>
                              ) : <span>{a.text}</span>}
                            </td>
                            <td className="px-4 py-3"><span className={`text-xs ${a.isBlank ? "text-purple-600" : "text-gray-500"}`}>{a.isBlank ? "Blanche" : "Normale"}</span></td>
                            <td className="px-4 py-3">
                              <button onClick={() => updateAnswer({ ...a, isAdult: !a.isAdult })} className={`text-xs px-2 py-0.5 rounded-full font-medium transition ${a.isAdult ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}>{a.isAdult ? "🔞" : "—"}</button>
                            </td>
                            <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{a.active ? "Active" : "Inactive"}</span></td>
                            <td className="px-4 py-3"><div className="flex gap-1 justify-end">
                              <button onClick={() => setEditingA(editingA?.id === a.id ? null : { ...a })} className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded hover:bg-blue-50">Modifier</button>
                              <button onClick={() => updateAnswer({ ...a, active: !a.active })} className="text-yellow-600 hover:text-yellow-800 text-xs px-2 py-1 rounded hover:bg-yellow-50">{a.active ? "Désact." : "Activer"}</button>
                              <button onClick={() => deleteAnswer(a.id)} className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50">Suppr.</button>
                            </div></td>
                          </tr>
                        ))}
                        {filteredAnswers.length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-8">Aucune réponse trouvée.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
                {aTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <button disabled={aPage <= 1} onClick={() => { const p = aPage - 1; setAPage(p); loadAnswers({ page: p, search: aSearch, isAdult: aAdultFilter }); }} className="px-3 py-1 rounded border text-sm disabled:opacity-40">←</button>
                    <span className="text-sm text-gray-600">Page {aPage} / {aTotalPages}</span>
                    <button disabled={aPage >= aTotalPages} onClick={() => { const p = aPage + 1; setAPage(p); loadAnswers({ page: p, search: aSearch, isAdult: aAdultFilter }); }} className="px-3 py-1 rounded border text-sm disabled:opacity-40">→</button>
                  </div>
                )}
              </div>
            )}

          </>
        )}

        {gameTab === "undercover" && (
          <div>
            <div className="flex flex-wrap gap-3 mb-4 items-center">
              <input type="text" value={uSearch} onChange={e => { setUSearch(e.target.value); setUPage(1); loadUndercoverWords({ page: 1, search: e.target.value }); }} placeholder="Rechercher..." className="flex-1 min-w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              <span className="text-xs text-gray-400">{uTotal} paires</span>
              <button onClick={() => { setAddingU(true); setNewUCivilian(""); setNewUUndercover(""); }} className="bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold px-4 py-2 rounded-lg whitespace-nowrap">+ Ajouter</button>
            </div>
            {addingU && (
              <div className="bg-white border border-purple-200 rounded-xl p-4 mb-4 space-y-3">
                <div className="flex gap-3">
                  <input type="text" value={newUCivilian} onChange={e => setNewUCivilian(e.target.value)} placeholder="Mot civil (principal)" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  <input type="text" value={newUUndercover} onChange={e => setNewUUndercover(e.target.value)} placeholder="Mot undercover (principal)" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Mots supplémentaires (optionnel, un par ligne, max 10)</label>
                  <textarea
                    value={newUWords}
                    onChange={e => setNewUWords(e.target.value)}
                    rows={4}
                    placeholder={"mot1\nmot2\nmot3\n..."}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y"
                  />
                  <p className="text-xs text-gray-400 mt-1">Si au moins 2 mots supplémentaires sont fournis, le jeu piochera aléatoirement parmi ces mots à chaque partie.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={addUndercoverWordPair} className="bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">Ajouter</button>
                  <button onClick={() => { setAddingU(false); setNewUWords(""); }} className="text-gray-500 hover:text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-100">Annuler</button>
                </div>
              </div>
            )}
            {loading ? <div className="text-center text-gray-400 py-8">Chargement...</div> : (<>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-200 bg-gray-50"><th className="text-left px-4 py-3 text-gray-500 font-medium w-12">#</th><th className="text-left px-4 py-3 text-gray-500 font-medium">Civil</th><th className="text-left px-4 py-3 text-gray-500 font-medium">Undercover</th><th className="text-left px-4 py-3 text-gray-500 font-medium">Mots supplémentaires</th><th className="text-left px-4 py-3 text-gray-500 font-medium w-20">Statut</th><th className="px-4 py-3 w-36"></th></tr></thead>
                  <tbody>
                    {filteredUndercoverWords.map(pair => {
                      const extraWords: string[] = (() => { try { return pair.words ? JSON.parse(pair.words) : []; } catch { return []; } })();
                      return (
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
                        <td className="px-4 py-3">
                          {extraWords.length >= 2 ? (
                            <div className="flex flex-wrap gap-1">
                              {extraWords.map((w, i) => (
                                <span key={i} className="bg-purple-50 text-purple-700 text-xs font-medium px-2 py-0.5 rounded-full border border-purple-100">{w}</span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs italic">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pair.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{pair.active ? "Actif" : "Inactif"}</span></td>
                        <td className="px-4 py-3"><div className="flex gap-1 justify-end">
                          <button onClick={() => setEditingU(editingU?.id === pair.id ? null : { ...pair })} className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded hover:bg-blue-50">Modifier</button>
                          <button onClick={() => updateUndercoverWordPair({ ...pair, active: !pair.active })} className="text-yellow-600 hover:text-yellow-800 text-xs px-2 py-1 rounded hover:bg-yellow-50">{pair.active ? "Désact." : "Activer"}</button>
                          <button onClick={() => deleteUndercoverWordPair(pair.id)} className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50">Suppr.</button>
                        </div></td>
                      </tr>
                    ); })}
                    {filteredUndercoverWords.length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-8">Aucun mot trouvé.</td></tr>}
                  </tbody>
                </table>
              </div>
              {uTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button disabled={uPage <= 1} onClick={() => { const p = uPage - 1; setUPage(p); loadUndercoverWords({ page: p, search: uSearch }); }} className="px-3 py-1 rounded border text-sm disabled:opacity-40">←</button>
                  <span className="text-sm text-gray-600">Page {uPage} / {uTotalPages}</span>
                  <button disabled={uPage >= uTotalPages} onClick={() => { const p = uPage + 1; setUPage(p); loadUndercoverWords({ page: p, search: uSearch }); }} className="px-3 py-1 rounded border text-sm disabled:opacity-40">→</button>
                </div>
              )}
            </>)}
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

        {/* Guess Who characters section */}
        {gameTab === "guess_who" && (
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <button onClick={() => { setAddingGW(true); setEditingGW(null); }} className="bg-rose-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-rose-700 transition">+ Ajouter un personnage</button>
              <input
                type="text" placeholder="Rechercher…" value={gwSearch}
                onChange={e => { setGWSearch(e.target.value); setGWPage(1); loadGWCharacters({ page: 1, search: e.target.value, active: gwActiveOnly ? "true" : "all" }); }}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-rose-300"
              />
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={gwActiveOnly} onChange={e => { setGWActiveOnly(e.target.checked); loadGWCharacters({ page: 1, search: gwSearch, active: e.target.checked ? "true" : "all" }); }} className="accent-rose-600" />
                Actifs seulement
              </label>
              <span className="text-xs text-gray-400 ml-auto">{gwTotal} personnage{gwTotal !== 1 ? "s" : ""}</span>
            </div>

            {addingGW && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-5">
                <h3 className="font-bold text-rose-700 mb-3">Nouveau personnage</h3>
                <div className="flex gap-3 items-start mb-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Nom *</label>
                    <input type="text" placeholder="Ex: Jean" value={newGWName} onChange={e => setNewGWName(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-full" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Photo (optionnel)</label>
                    <div className="flex items-center gap-2">
                      <label className={`cursor-pointer px-3 py-2 rounded-lg text-xs font-semibold border ${newGWUploading ? "opacity-50" : "bg-white hover:bg-gray-50 border-gray-300"}`}>
                        {newGWUploading ? "Envoi…" : "📷 Choisir"}
                        <input type="file" accept="image/*" className="hidden" disabled={newGWUploading}
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadGWImage(f, setNewGWUploading, setNewGWImageUrl); }} />
                      </label>
                      {newGWImageUrl && (
                        <img src={newGWImageUrl} alt="preview" className="w-10 h-10 rounded-full object-cover border-2 border-rose-300" />
                      )}
                    </div>
                    {newGWImageUrl && (
                      <button onClick={() => setNewGWImageUrl("")} className="text-xs text-red-400 hover:text-red-600 mt-1">Retirer la photo</button>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={addGWCharacter} disabled={!newGWName.trim() || newGWUploading} className="bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-rose-700 disabled:opacity-50">Ajouter</button>
                  <button onClick={() => { setAddingGW(false); setNewGWName(""); setNewGWImageUrl(""); }} className="px-4 py-2 rounded-lg text-sm bg-gray-100 text-gray-600 hover:bg-gray-200">Annuler</button>
                </div>
              </div>
            )}

            {editingGW && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 mb-5">
                <h3 className="font-bold text-yellow-700 mb-3">Modifier "{editingGW.name}"</h3>
                <div className="flex gap-3 items-start mb-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Nom *</label>
                    <input type="text" value={editingGW.name} onChange={e => setEditingGW(g => g ? { ...g, name: e.target.value } : g)} className="border rounded-lg px-3 py-2 text-sm w-full" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Photo</label>
                    <div className="flex items-center gap-2">
                      <label className={`cursor-pointer px-3 py-2 rounded-lg text-xs font-semibold border ${editGWUploading ? "opacity-50" : "bg-white hover:bg-gray-50 border-gray-300"}`}>
                        {editGWUploading ? "Envoi…" : "📷 Choisir"}
                        <input type="file" accept="image/*" className="hidden" disabled={editGWUploading}
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadGWImage(f, setEditGWUploading, url => setEditingGW(g => g ? { ...g, imageUrl: url } : g)); }} />
                      </label>
                      {editingGW.imageUrl && (
                        <img src={editingGW.imageUrl} alt="preview" className="w-10 h-10 rounded-full object-cover border-2 border-yellow-400" />
                      )}
                    </div>
                    {editingGW.imageUrl && (
                      <button onClick={() => setEditingGW(g => g ? { ...g, imageUrl: null } : g)} className="text-xs text-red-400 hover:text-red-600 mt-1">Retirer la photo</button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={editingGW.active} onChange={e => setEditingGW(g => g ? { ...g, active: e.target.checked } : g)} className="accent-rose-600" />
                    Actif
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => updateGWCharacter(editingGW)} disabled={!editingGW.name.trim() || editGWUploading} className="bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-700 disabled:opacity-50">Enregistrer</button>
                  <button onClick={() => setEditingGW(null)} className="px-4 py-2 rounded-lg text-sm bg-gray-100 text-gray-600 hover:bg-gray-200">Annuler</button>
                </div>
              </div>
            )}

            {gwLoading ? (
              <div className="text-center py-12 text-gray-400">Chargement…</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left">Photo</th>
                      <th className="px-4 py-3 text-left">Nom</th>
                      <th className="px-4 py-3 text-left">Statut</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {gwCharacters.map(char => (
                      <tr key={char.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          {char.imageUrl
                            ? <img src={char.imageUrl} alt={char.name} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                            : <span className="text-2xl">{char.emoji}</span>
                          }
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{char.name}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${char.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                            {char.active ? "Actif" : "Inactif"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => { setEditingGW(char); setAddingGW(false); }} className="text-yellow-600 hover:underline mr-3 text-xs font-semibold">Modifier</button>
                          <button onClick={() => deleteGWCharacter(char.id)} className="text-red-500 hover:underline text-xs font-semibold">Supprimer</button>
                        </td>
                      </tr>
                    ))}
                    {gwCharacters.length === 0 && <tr><td colSpan={4} className="text-center text-gray-400 py-8">Aucun personnage trouvé.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {gwTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button disabled={gwPage <= 1} onClick={() => { const p = gwPage - 1; setGWPage(p); loadGWCharacters({ page: p, search: gwSearch, active: gwActiveOnly ? "true" : "all" }); }} className="px-3 py-1 rounded border text-sm disabled:opacity-40">←</button>
                <span className="text-sm text-gray-600">Page {gwPage} / {gwTotalPages}</span>
                <button disabled={gwPage >= gwTotalPages} onClick={() => { const p = gwPage + 1; setGWPage(p); loadGWCharacters({ page: p, search: gwSearch, active: gwActiveOnly ? "true" : "all" }); }} className="px-3 py-1 rounded border text-sm disabled:opacity-40">→</button>
              </div>
            )}
          </div>
        )}

        {/* Settings section */}
        {gameTab === "settings" && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-black text-gray-800 mb-1">Activation des jeux</h2>
            <p className="text-sm text-gray-500 mb-5">Active ou désactive chaque mode de jeu sur la plateforme.</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: "bmc", label: "Blanc Manger Coco", emoji: "🃏" },
                { key: "connect4", label: "Puissance 4", emoji: "🔴" },
                { key: "undercover", label: "Undercover", emoji: "🕵️" },
                { key: "petitbac", label: "Petit Bac", emoji: "🔤" },
                { key: "guess_who", label: "Qui est-ce ?", emoji: "🔍" },
              ] as const).map(({ key, label, emoji }) => {
                const enabled = gameSettings[key] !== false;
                const saving = settingsSaving === key;
                return (
                  <div key={key} className="bg-white border border-gray-200 rounded-xl px-4 py-4 flex items-center gap-3 shadow-sm">
                    <span className="text-2xl">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 text-sm truncate">{label}</p>
                      <p className={`text-xs font-medium ${enabled ? "text-green-600" : "text-gray-400"}`}>
                        {enabled ? "Activé" : "Désactivé"}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleGameSetting(key, !enabled)}
                      disabled={saving}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none disabled:opacity-60 shrink-0 ${enabled ? "bg-green-500" : "bg-gray-300"}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-8" : "translate-x-1"}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Users section */}
        {gameTab === "users" && (
          <div>
            <div className="flex gap-3 mb-4 items-center">
              <input
                type="text"
                value={usersSearch}
                onChange={e => setUsersSearch(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { setUsersPage(1); loadUsers(1, usersSearch); } }}
                placeholder="Rechercher par nom ou email..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button onClick={() => { setUsersPage(1); loadUsers(1, usersSearch); }} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg whitespace-nowrap">
                Rechercher
              </button>
            </div>

            <div className="text-sm text-gray-500 mb-3">{usersTotal} utilisateur{usersTotal !== 1 ? "s" : ""} au total</div>

            {usersLoading ? (
              <div className="text-center text-gray-400 py-8">Chargement...</div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 text-gray-500 font-medium w-12">#</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Utilisateur</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Email</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium w-20">Admin</th>
                      <th className="px-4 py-3 w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400">{u.id}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{u.avatar}</span>
                            <span className="font-semibold text-gray-800">{u.username}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                        <td className="px-4 py-3">
                          {u.isAdmin ? <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Admin</span> : <span className="text-xs text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => openEditUser(u)} className="text-indigo-500 hover:text-indigo-700 text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-50 font-semibold">
                            Modifier
                          </button>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && <tr><td colSpan={5} className="text-center text-gray-400 py-8">Aucun utilisateur trouvé.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {usersTotalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <button onClick={() => { const p = Math.max(1, usersPage - 1); setUsersPage(p); loadUsers(p, usersSearch); }} disabled={usersPage <= 1} className="text-sm font-bold text-indigo-600 disabled:opacity-30 hover:text-indigo-800">← Préc.</button>
                <span className="text-xs font-semibold text-gray-500">Page {usersPage} / {usersTotalPages}</span>
                <button onClick={() => { const p = Math.min(usersTotalPages, usersPage + 1); setUsersPage(p); loadUsers(p, usersSearch); }} disabled={usersPage >= usersTotalPages} className="text-sm font-bold text-indigo-600 disabled:opacity-30 hover:text-indigo-800">Suiv. →</button>
              </div>
            )}

            {/* Edit User Modal */}
            {editingUser && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-auto max-h-[90vh]">
                  <div className="p-5 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{editingUser.avatar}</span>
                      <div>
                        <h3 className="font-black text-gray-800">{editingUser.username}</h3>
                        <p className="text-xs text-gray-500">{editingUser.email}</p>
                      </div>
                    </div>
                    <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
                  </div>
                  <div className="p-5 space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Avatar (emoji)</label>
                      <div className="flex items-center gap-2">
                        <span className="text-3xl">{editUserAvatar || "?"}</span>
                        <input
                          type="text"
                          value={editUserAvatar}
                          onChange={e => setEditUserAvatar(e.target.value)}
                          placeholder="Ex: 🦋"
                          maxLength={8}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Nouveau mot de passe (laisser vide = inchangé)</label>
                      <input
                        type="password"
                        value={editUserPwd}
                        onChange={e => setEditUserPwd(e.target.value)}
                        placeholder="Nouveau mot de passe (6 min.)"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        autoComplete="new-password"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Statistiques par jeu</label>
                      <div className="space-y-2">
                        {(["bmc", "connect4", "undercover", "petitbac", "guess_who"] as const).map(mode => {
                          const modeLabels: Record<string, string> = { bmc: "🃏 BMC", connect4: "🔴 Puissance 4", undercover: "🕵️ Undercover", petitbac: "🔤 Petit Bac", guess_who: "🔍 Qui est-ce ?" };
                          const s = editUserStats[mode] ?? { wins: 0, losses: 0, draws: 0 };
                          return (
                            <div key={mode} className="bg-gray-50 rounded-xl p-3">
                              <p className="text-xs font-bold text-gray-600 mb-2">{modeLabels[mode]}</p>
                              <div className="flex gap-2">
                                {(["wins", "losses", "draws"] as const).map(field => (
                                  <div key={field} className="flex-1">
                                    <label className="text-xs text-gray-500">{field === "wins" ? "🏆 V" : field === "losses" ? "💀 D" : "🤝 N"}</label>
                                    <input
                                      type="number"
                                      min={0}
                                      value={s[field]}
                                      onChange={e => setEditUserStats(prev => ({
                                        ...prev,
                                        [mode]: { ...prev[mode] ?? { wins: 0, losses: 0, draws: 0 }, [field]: Math.max(0, parseInt(e.target.value) || 0) }
                                      }))}
                                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {userMsg && (
                      <div className={`rounded-lg px-4 py-2 text-sm font-semibold ${userMsg === "Enregistré !" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                        {userMsg}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button onClick={saveUser} disabled={userSaving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition disabled:opacity-50">
                        {userSaving ? "Enregistrement..." : "Enregistrer"}
                      </button>
                      <button onClick={() => setEditingUser(null)} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 font-semibold text-sm transition">
                        Fermer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Custom Avatars section */}
        {gameTab === "avatars" && (
          <div className="max-w-3xl">
            {/* Add custom avatar */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-black text-gray-800 mb-0.5">Gestion des avatars</h2>
                <p className="text-sm text-gray-500">Les avatars ajoutés ici apparaissent dans le carrousel de tous les utilisateurs.</p>
              </div>
              <button onClick={() => { setAddingAvatar(!addingAvatar); setAvatarAddMsg(""); }} className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                + Ajouter
              </button>
            </div>

            {addingAvatar && (
              <div className="bg-white border border-teal-200 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-4xl w-12 h-12 flex items-center justify-center bg-teal-50 rounded-xl border-2 border-teal-200">{newAvatarEmoji || "?"}</span>
                  <div className="flex-1 space-y-2">
                    <input type="text" value={newAvatarEmoji} onChange={e => setNewAvatarEmoji(e.target.value)} placeholder="Emoji (ex: 🦋)" maxLength={8} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-teal-400" />
                    <input type="text" value={newAvatarLabel} onChange={e => setNewAvatarLabel(e.target.value)} placeholder="Nom (ex: Papillon)" maxLength={40} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                  </div>
                </div>
                {avatarAddMsg && <p className={`text-sm font-semibold mb-2 ${avatarAddMsg.startsWith("Avatar") ? "text-green-600" : "text-red-600"}`}>{avatarAddMsg}</p>}
                <div className="flex gap-2">
                  <button onClick={addCustomAvatar} className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Ajouter</button>
                  <button onClick={() => { setAddingAvatar(false); setAvatarAddMsg(""); }} className="text-gray-500 hover:text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-100">Annuler</button>
                </div>
              </div>
            )}

            {/* Predefined avatars (read-only) */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-2">Avatars de base ({AVATARS.length})</h3>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex flex-wrap gap-2">
                  {AVATARS.map(av => (
                    <div key={av.emoji} title={av.label} className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-gray-50 border border-gray-100 min-w-[48px]">
                      <span className="text-2xl">{av.emoji}</span>
                      <span className="text-[10px] text-gray-400 text-center leading-tight max-w-[48px] truncate">{av.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom avatars (manageable) */}
            <div>
              <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-2">Avatars personnalisés ({customAvatars.length})</h3>
              {avatarsLoading ? (
                <div className="text-center text-gray-400 py-8">Chargement...</div>
              ) : customAvatars.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
                  <div className="text-4xl mb-2">✨</div>
                  Aucun avatar personnalisé. Utilisez le bouton "+ Ajouter" pour en créer.
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left px-4 py-3 text-gray-500 font-medium w-12">#</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Emoji</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Nom</th>
                        <th className="px-4 py-3 w-24"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {customAvatars.map(av => (
                        <tr key={av.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-400">{av.id}</td>
                          <td className="px-4 py-3 text-2xl">{av.emoji}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{av.label}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => deleteCustomAvatar(av.id)} className="text-red-500 hover:text-red-700 text-xs px-3 py-1.5 rounded-lg hover:bg-red-50 font-semibold">
                              Suppr.
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
