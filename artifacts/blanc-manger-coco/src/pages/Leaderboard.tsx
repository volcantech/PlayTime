import { useState, useEffect } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const STATS_API = `${window.location.origin}${BASE}/api/stats`;

const MODES = [
  { id: "bmc", label: "Blanc Manger Coco", icon: "🃏" },
  { id: "connect4", label: "Puissance 4", icon: "🔴" },
  { id: "undercover", label: "Undercover", icon: "🕵️" },
  { id: "petitbac", label: "Petit Bac", icon: "🔤" },
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
    <div className="min-h-screen flex flex-col items-center px-4 py-10"
         style={{ background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #ff9a9e 100%)" }}>

      <div className="w-full max-w-sm">
        <button
          onClick={onBack}
          className="mb-4 text-sm font-semibold text-rose-800/80 hover:text-rose-900 bg-white/50 rounded-full px-4 py-2 transition-colors"
        >
          ← Retour
        </button>

        <div className="text-center mb-5">
          <div className="text-4xl mb-1">🏆</div>
          <h1 className="text-3xl font-black"
              style={{ fontFamily: "Pacifico, cursive", color: "#c2185b", textShadow: "2px 2px 0px #f8bbd0" }}>
            Classement
          </h1>
        </div>

        {/* Mode tabs */}
        <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl overflow-hidden mb-4">
          <div className="flex border-b border-gray-200">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => handleMode(m.id)}
                className={`flex-1 py-3 text-xs font-bold transition-colors ${
                  mode === m.id ? "text-rose-600 border-b-2 border-rose-600 bg-rose-50" : "text-gray-500 hover:text-gray-700"
                }`}
                title={m.label}
              >
                {m.icon}
              </button>
            ))}
          </div>
          <div className="px-5 py-2 text-xs font-bold text-gray-500 text-center border-b border-gray-100">
            {MODES.find(m => m.id === mode)?.icon} {MODES.find(m => m.id === mode)?.label}
          </div>

          <div className="p-4">
            {loading ? (
              <div className="py-8 text-center text-gray-400 font-semibold">Chargement...</div>
            ) : error ? (
              <div className="py-8 text-center text-red-500 font-semibold">{error}</div>
            ) : !data || data.entries.length === 0 ? (
              <div className="py-8 text-center text-gray-400 font-semibold">
                <div className="text-3xl mb-2">😴</div>
                Aucun joueur encore. Sois le premier !
              </div>
            ) : (
              <div className="space-y-2">
                {data.entries.map((entry, i) => {
                  const rank = (page - 1) * 10 + i;
                  return (
                    <div
                      key={entry.username}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                        rank < 3 ? "bg-rose-50 border border-rose-100" : "bg-gray-50"
                      }`}
                    >
                      <div className="text-lg font-black w-8 text-center flex-shrink-0">
                        {MEDAL[rank] ?? <span className="text-gray-500 text-sm">#{rank + 1}</span>}
                      </div>
                      <div className="text-2xl flex-shrink-0">{entry.avatar}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-800 text-sm truncate">{entry.username}</div>
                        <div className="flex gap-2 mt-0.5 flex-wrap">
                          {(mode === "connect4" || mode === "undercover") && (
                            <span className="text-xs text-gray-400">💀 {entry.losses ?? 0} défaite{(entry.losses ?? 0) !== 1 ? "s" : ""}</span>
                          )}
                          {(entry.draws ?? 0) > 0 && (
                            <span className="text-xs text-yellow-600">🤝 {entry.draws} nul{entry.draws !== 1 ? "s" : ""}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="font-black text-rose-600">{entry.wins}</span>
                        <span className="text-xs text-gray-400 ml-1">🏆</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="text-sm font-bold text-rose-600 disabled:opacity-30 hover:text-rose-800 transition-colors"
              >
                ← Préc.
              </button>
              <span className="text-xs font-semibold text-gray-500">
                Page {page} / {data.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="text-sm font-bold text-rose-600 disabled:opacity-30 hover:text-rose-800 transition-colors"
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
