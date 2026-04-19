import { useState, useEffect, useCallback } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${window.location.origin}${BASE}/api/auth`;

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  avatar: string;
  isAdmin: boolean;
}

const TOKEN_KEY = "pt_user_token";
const USER_KEY = "pt_user";

function loadToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredToken(): string | null {
  return loadToken();
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(loadToken);
  const [user, setUser] = useState<AuthUser | null>(loadUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiFetch = useCallback((path: string, opts?: RequestInit, tok?: string | null) => {
    const t = tok !== undefined ? tok : token;
    return fetch(`${API}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        ...(opts?.headers || {}),
      },
    });
  }, [token]);

  const register = useCallback(async (email: string, username: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch("/register", {
        method: "POST",
        body: JSON.stringify({ email, username, password }),
      }, null);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'inscription.");
      saveAuth(data.token, data.user);
      setToken(data.token);
      setUser(data.user);
      return { ok: true as const };
    } catch (e: any) {
      const msg = e.message || "Erreur réseau.";
      setError(msg);
      return { ok: false as const, error: msg };
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  const login = useCallback(async (login: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch("/login", {
        method: "POST",
        body: JSON.stringify({ login, password }),
      }, null);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de connexion.");
      saveAuth(data.token, data.user);
      setToken(data.token);
      setUser(data.user);
      return { ok: true as const };
    } catch (e: any) {
      const msg = e.message || "Erreur réseau.";
      setError(msg);
      return { ok: false as const, error: msg };
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  const logout = useCallback(() => {
    clearAuth();
    setToken(null);
    setUser(null);
    setError(null);
  }, []);

  const updateProfile = useCallback(async (updates: { avatar?: string; currentPassword?: string; newPassword?: string }) => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch("/profile", {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de mise à jour.");
      const newUser = data as AuthUser;
      saveAuth(token!, newUser);
      setUser(newUser);
      return { ok: true as const };
    } catch (e: any) {
      const msg = e.message || "Erreur réseau.";
      setError(msg);
      return { ok: false as const, error: msg };
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token]);

  useEffect(() => {
    if (!token) return;
    apiFetch("/me").then(async res => {
      if (res.ok) {
        const data: AuthUser = await res.json();
        const saved = loadUser();
        if (JSON.stringify(saved) !== JSON.stringify(data)) {
          localStorage.setItem(USER_KEY, JSON.stringify(data));
          setUser(data);
        }
      } else if (res.status === 401) {
        clearAuth();
        setToken(null);
        setUser(null);
      }
    }).catch(() => {});
  }, []);

  return { token, user, loading, error, register, login, logout, updateProfile, setError };
}
