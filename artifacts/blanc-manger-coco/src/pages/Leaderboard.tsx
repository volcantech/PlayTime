import { useState, useEffect } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const STATS_API = `${window.location.origin}${BASE}/api/stats`;

const MODES = [
  { id: "bmc",       label: "Blanc Manger Coco", icon: "🃏", accent: "#ff2e7a", bg: "linear-gradient(135deg, #ff2e7a, #c1185f)" },
  { id: "connect4",  label: "Puissance 4",        icon: "🔴", accent: "#3b82f6", bg: "linear-gradient(135deg, #3b82f6, #1d4ed8)" },
  { id: "undercover",label: "Undercover",          icon: "🕵️", accent: "#a855f7", bg: "linear-gradient(135deg, #a855f7, #7c3aed)" },
  { id: "petitbac",  label: "Petit Bac",           icon: "🔤", accent: "#14b8a6", bg: "linear-gradient(135deg, #14b8a6, #0d9488)" },
  { id: "guess_who", label: "Qui est-ce ?",        icon: "🔍", accent: "#06b6d4", bg: "linear-gradient(135deg, #06b6d4, #0891b2)" },
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
  const hasLosses = mode === "connect4" || mode === "undercover" || mode === "guess_who";

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
    <div className="bg-party min-h-screen relative">
      <div className="party-cards-layer" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-12">
        <button onClick={onBack} className="btn-jb btn-jb-ghost btn-jb-sm mb-6">
          ← Retour
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3 float-y" style={{ filter: "drop-shadow(0 10px 30px rgba(255,217,61,0.45))" }}>🏆</div>
          <p className="section-eyebrow mb-2">Hall of fame</p>
          <h1 className="title-display text-white text-[clamp(2.4rem,7vw,4rem)] mb-1" style={{
            background: `linear-gradient(180deg, #fff 0%, ${currentMode.accent} 60%, #ff2e7a 100%)`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            transition: "all .4s ease",
          }}>
            Classement
          </h1>
          <p className="text-white/55 font-bold text-sm">Les meilleurs joueurs, tous jeux confondus</p>
        </div>

        {/* Mode pills */}
        <div className="flex gap-2 mb-6 flex-wrap justify-center">
          {MODES.map(m => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => handleMode(m.id)}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-black transition-all"
                style={active ? {
                  background: m.bg,
                  color: "#fff",
                  border: "2px solid rgba(255,255,255,0.20)",
                  boxShadow: `0 6px 0 0 rgba(0,0,0,0.30), 0 10px 24px -8px ${m.accent}80, inset 0 1px 0 0 rgba(255,255,255,0.30)`,
                  transform: "translateY(-1px)",
                } : {
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.55)",
                  border: "2px solid rgba(255,255,255,0.10)",
                }}
                title={m.label}
              >
                <span className="text-base">{m.icon}</span>
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Table card */}
        <div className="card-jb overflow-hidden">
          <div
            className="px-5 py-4 flex items-center gap-3 relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${currentMode.accent}25, transparent 70%)`, borderBottom: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                 style={{ background: currentMode.bg, boxShadow: `0 6px 18px -6px ${currentMode.accent}80` }}>
              {currentMode.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="section-eyebrow mb-0.5">Top joueurs</p>
              <p className="font-black text-white truncate">{currentMode.label}</p>
            </div>
            {data && (
              <div className="text-xs font-bold text-white/45 flex-shrink-0">
                {data.total} joueur{data.total !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          <div className="p-4">
            {loading ? (
              <div className="py-12 text-center text-white/40 font-bold">
                <div className="text-3xl mb-2 animate-pulse">⏳</div>
                Chargement...
              </div>
            ) : error ? (
              <div className="py-12 text-center font-bold" style={{ color: "#fca5a5" }}>
                <div className="text-3xl mb-2">😬</div>
                {error}
              </div>
            ) : !data || data.entries.length === 0 ? (
              <div className="py-12 text-center text-white/40 font-bold">
                <div className="text-4xl mb-3">😴</div>
                Aucun joueur encore.<br />
                <span className="text-white/60">Sois le premier à marquer !</span>
              </div>
            ) : (
              <div className="space-y-2">
                {data.entries.map((entry, i) => {
                  const rank = (page - 1) * 10 + i;
                  const isTop3 = rank < 3;
                  const isFirst = rank === 0;
                  return (
                    <div
                      key={entry.username}
                      className="flex items-center gap-3 px-3 py-3 rounded-2xl transition-all relative overflow-hidden"
                      style={isFirst ? {
                        background: `linear-gradient(135deg, ${currentMode.accent}28, ${currentMode.accent}10)`,
                        border: `1.5px solid ${currentMode.accent}55`,
                        boxShadow: `0 8px 24px -10px ${currentMode.accent}60`,
                      } : isTop3 ? {
                        background: `${currentMode.accent}14`,
                        border: `1px solid ${currentMode.accent}30`,
                      } : {
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div className="text-xl font-black w-10 text-center flex-shrink-0">
                        {MEDAL[rank] ?? <span className="text-white/40 text-sm">#{rank + 1}</span>}
                      </div>
                      <div className="text-3xl flex-shrink-0" style={{ filter: isFirst ? "drop-shadow(0 4px 10px rgba(255,217,61,0.5))" : undefined }}>
                        {entry.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-white truncate">{entry.username}</div>
                        <div className="flex gap-2 mt-0.5 flex-wrap">
                          {hasLosses && (
                            <span className="text-xs font-bold text-white/40">💀 {entry.losses ?? 0}</span>
                          )}
                          {(entry.draws ?? 0) > 0 && (
                            <span className="text-xs font-bold text-yellow-300/70">🤝 {entry.draws}</span>
                          )}
                          {hasLosses && (entry.wins + (entry.losses ?? 0)) > 0 && (
                            <span className="text-xs font-bold text-white/35">
                              {Math.round((entry.wins / (entry.wins + (entry.losses ?? 0))) * 100)}% WR
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="title-display text-2xl leading-none" style={{ color: currentMode.accent }}>
                          {entry.wins}
                        </div>
                        <div className="text-[0.65rem] text-white/35 font-bold uppercase tracking-wider mt-0.5">🏆 wins</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-4"
                 style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-jb btn-jb-sm btn-jb-ghost disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← Préc.
              </button>
              <span className="text-xs font-black text-white/50">
                Page <span className="text-white">{page}</span> / {data.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="btn-jb btn-jb-sm btn-jb-ghost disabled:opacity-30 disabled:cursor-not-allowed"
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
