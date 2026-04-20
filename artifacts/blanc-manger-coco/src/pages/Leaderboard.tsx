import { useState, useEffect } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const STATS_API = `${window.location.origin}${BASE}/api/stats`;

const MODES = [
  { id: "bmc", label: "Blanc Manger Coco", icon: "🃏", accent: "#e91e63" },
  { id: "connect4", label: "Puissance 4", icon: "🔴", accent: "#3b82f6" },
  { id: "undercover", label: "Undercover", icon: "🕵️", accent: "#a855f7" },
  { id: "petitbac", label: "Petit Bac", icon: "🔤", accent: "#14b8a6" },
  { id: "guess_who", label: "Qui est-ce ?", icon: "🔍", accent: "#06b6d4" },
];

interface LeaderboardEntry {
  username: string;
  avatar: string;
  wins: number;
  losses: number;
  draws: number;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
  page: number;
  totalPages: number;
}

interface LeaderboardPageProps {
  onBack: () => void;
}

export function LeaderboardPage({ onBack }: LeaderboardPageProps) {
  const [mode, setMode] = useState("bmc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentMode = MODES.find(m => m.id === mode) || MODES[0];

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`${STATS_API}/leaderboard?mode=${mode}&page=${page}`)
      .then(r => r.ok ? r.json() : Promise.reject("Erreur"))
      .then(d => setData(d))
      .catch(() => setError("Impossible de charger le classement."))
      .finally(() => setLoading(false));
  }, [mode, page]);

  const handleMode = (m: string) => {
    setMode(m);
    setPage(1);
    setData(null);
  };

  const MEDAL: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };

  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 py-8 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #07071a 0%, #0d0d2b 50%, #080f1f 100%)" }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-700"
        style={{
          background: `radial-gradient(ellipse 50% 40% at 50% 0%, ${currentMode.accent}30, transparent 70%)`,
        }}
      />

      <div className="w-full max-w-md relative z-10">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-white/40 hover:text-white/80 transition-colors"
        >
          ← Retour
        </button>

        {/* Header */}
        <div className="text-center mb-7">
          <div className="text-5xl mb-3">🏆</div>
          <h1
            className="text-4xl font-black tracking-tight text-gradient"
            style={{ backgroundImage: `linear-gradient(135deg, #fff 30%, ${currentMode.accent})` }}
          >
            Classement
          </h1>
        </div>

        {/* Mode pills */}
        <div className="flex gap-2 mb-5 flex-wrap justify-center">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => handleMode(m.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
              style={mode === m.id ? {
                background: `${m.accent}25`,
                color: m.accent,
                border: `1px solid ${m.accent}50`,
              } : {
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.4)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              title={m.label}
            >
              <span>{m.icon}</span>
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div
            className="px-5 py-3 flex items-center gap-2"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <span style={{ color: currentMode.accent }}>{currentMode.icon}</span>
            <span className="text-sm font-bold text-white/70">{currentMode.label}</span>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="py-10 text-center text-white/30 font-semibold">
                <div className="text-2xl mb-2 animate-pulse">⏳</div>
                Chargement...
              </div>
            ) : error ? (
              <div className="py-10 text-center font-semibold" style={{ color: "#f87171" }}>{error}</div>
            ) : !data || data.entries.length === 0 ? (
              <div className="py-10 text-center text-white/30 font-semibold">
                <div className="text-3xl mb-2">😴</div>
                Aucun joueur encore. Sois le premier !
              </div>
            ) : (
              <div className="space-y-2">
                {data.entries.map((entry, i) => {
                  const rank = (page - 1) * 10 + i;
                  const isTop3 = rank < 3;
                  return (
                    <div
                      key={entry.username}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all"
                      style={isTop3 ? {
                        background: `${currentMode.accent}12`,
                        border: `1px solid ${currentMode.accent}25`,
                      } : {
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      <div className="text-lg font-black w-8 text-center flex-shrink-0">
                        {MEDAL[rank] ?? <span className="text-white/30 text-sm">#{rank + 1}</span>}
                      </div>
                      <div className="text-2xl flex-shrink-0">{entry.avatar}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white text-sm truncate">{entry.username}</div>
                        <div className="flex gap-2 mt-0.5 flex-wrap">
                          {(mode === "connect4" || mode === "undercover" || mode === "guess_who") && (
                            <span className="text-xs text-white/30">💀 {entry.losses ?? 0} défaite{(entry.losses ?? 0) !== 1 ? "s" : ""}</span>
                          )}
                          {(entry.draws ?? 0) > 0 && (
                            <span className="text-xs text-yellow-500/70">🤝 {entry.draws} nul</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="font-black text-lg" style={{ color: currentMode.accent }}>{entry.wins}</span>
                        <span className="text-xs text-white/30 ml-1">🏆</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="text-sm font-bold transition-colors disabled:opacity-30"
                style={{ color: currentMode.accent }}
              >
                ← Préc.
              </button>
              <span className="text-xs font-semibold text-white/30">
                Page {page} / {data.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="text-sm font-bold transition-colors disabled:opacity-30"
                style={{ color: currentMode.accent }}
              >
                Suiv. →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
