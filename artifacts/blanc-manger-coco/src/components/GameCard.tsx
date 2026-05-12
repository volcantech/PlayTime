import { useState } from "react";
import type { Card } from "../data/cards";
import { CATEGORY_CONFIG } from "../data/cards";

interface GameCardProps {
  card: Card;
  onSuccess: () => void;
  onFail: () => void;
}

export function GameCard({ card, onSuccess, onFail }: GameCardProps) {
  const [revealed, setRevealed] = useState(false);
  const config = CATEGORY_CONFIG[card.category];

  const categoryColors = {
    blanc: {
      gradient: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 50%, #93c5fd 100%)",
      header: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
      border: "#93c5fd",
      text: "#1e40af",
      badge: "#eff6ff",
      badgeText: "#1d4ed8",
    },
    manger: {
      gradient: "linear-gradient(135deg, #ffedd5 0%, #fed7aa 50%, #fdba74 100%)",
      header: "linear-gradient(135deg, #f97316, #c2410c)",
      border: "#fdba74",
      text: "#9a3412",
      badge: "#fff7ed",
      badgeText: "#c2410c",
    },
    coco: {
      gradient: "linear-gradient(135deg, #fce7f3 0%, #fbcfe8 50%, #f9a8d4 100%)",
      header: "linear-gradient(135deg, #ec4899, #9d174d)",
      border: "#f9a8d4",
      text: "#9d174d",
      badge: "#fdf2f8",
      badgeText: "#9d174d",
    },
  };

  const colors = categoryColors[card.category];

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto">
      {/* Card */}
      <div
        className="w-full rounded-3xl shadow-2xl overflow-hidden bounce-in"
        style={{ border: `3px solid ${colors.border}` }}
        data-testid="game-card"
      >
        {/* Category header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ background: colors.header }}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">{config.emoji}</span>
            <div>
              <div className="text-white font-black text-xl tracking-widest">{config.label}</div>
              <div className="text-white/80 text-xs font-semibold">{config.description}</div>
            </div>
          </div>
          <div
            className="px-3 py-1 rounded-full text-sm font-black"
            style={{ background: colors.badge, color: colors.badgeText }}
          >
            +{config.pointValue} pt{config.pointValue > 1 ? "s" : ""}
          </div>
        </div>

        {/* Card body */}
        <div
          className="p-6 min-h-[180px] flex items-center justify-center"
          style={{ background: colors.gradient }}
        >
          {!revealed ? (
            <button
              data-testid="reveal-card"
              onClick={() => setRevealed(true)}
              className="flex flex-col items-center gap-3 group"
            >
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-lg group-hover:scale-110 transition-transform"
                style={{ background: colors.header }}
              >
                🃏
              </div>
              <span className="font-bold text-sm" style={{ color: colors.text }}>
                Appuie pour révéler !
              </span>
            </button>
          ) : (
            <div className="text-center">
              <p
                className="text-lg font-bold leading-snug"
                style={{ color: colors.text }}
                data-testid="card-question"
              >
                {card.question}
              </p>
              {card.hint && (
                <p className="mt-3 text-sm italic opacity-70" style={{ color: colors.text }}>
                  💡 {card.hint}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons - only show after reveal */}
      {revealed && (
        <div className="flex gap-4 w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
          <button
            data-testid="card-fail"
            onClick={onFail}
            className="flex-1 py-4 rounded-2xl font-black text-lg text-white shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #ef4444, #b91c1c)" }}
          >
            <span className="text-2xl">😬</span> Raté
          </button>
          <button
            data-testid="card-success"
            onClick={onSuccess}
            className="flex-1 py-4 rounded-2xl font-black text-lg text-white shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #22c55e, #15803d)" }}
          >
            <span className="text-2xl">🎉</span> Réussi !
          </button>
        </div>
      )}
    </div>
  );
}
