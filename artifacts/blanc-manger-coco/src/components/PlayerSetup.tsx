import { useState } from "react";
import { AVATARS } from "../types/game";
import type { Player } from "../types/game";

interface PlayerSetupProps {
  onStartGame: (players: Player[], maxRounds: number) => void;
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

export function PlayerSetup({ onStartGame }: PlayerSetupProps) {
  const [playerNames, setPlayerNames] = useState<string[]>(["", ""]);
  const [maxRounds, setMaxRounds] = useState(5);
  const [error, setError] = useState("");

  const addPlayer = () => {
    if (playerNames.length >= 8) return;
    setPlayerNames([...playerNames, ""]);
  };

  const removePlayer = (index: number) => {
    if (playerNames.length <= 2) return;
    setPlayerNames(playerNames.filter((_, i) => i !== index));
  };

  const updateName = (index: number, value: string) => {
    const updated = [...playerNames];
    updated[index] = value;
    setPlayerNames(updated);
    setError("");
  };

  const handleStart = () => {
    const filledNames = playerNames.map(n => n.trim()).filter(Boolean);
    if (filledNames.length < 2) {
      setError("Il faut au moins 2 joueurs pour commencer !");
      return;
    }
    const uniqueNames = new Set(filledNames);
    if (uniqueNames.size !== filledNames.length) {
      setError("Deux joueurs ne peuvent pas avoir le même prénom !");
      return;
    }

    const players: Player[] = filledNames.map((name, i) => ({
      id: generateId(),
      name,
      avatar: AVATARS[i % AVATARS.length],
      score: 0,
      tokensBlanche: 0,
      cardsDone: 0,
    }));

    onStartGame(players, maxRounds);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
         style={{ background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #ff9a9e 100%)" }}>
      
      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-7xl mb-3 drop-shadow-lg">🥥</div>
        <h1 className="text-5xl font-black tracking-tight mb-2"
            style={{ fontFamily: "Pacifico, cursive", color: "#c2185b", textShadow: "3px 3px 0px #f8bbd0" }}>
          Blanc Manger
        </h1>
        <h1 className="text-5xl font-black tracking-tight mb-4"
            style={{ fontFamily: "Pacifico, cursive", color: "#e64a19", textShadow: "3px 3px 0px #ffccbc" }}>
          Coco
        </h1>
        <p className="text-lg font-semibold text-rose-700 bg-white/60 rounded-full px-6 py-2 inline-block shadow">
          Le jeu de cartes qui ne laisse personne indemne !
        </p>
      </div>

      {/* Rules summary */}
      <div className="bg-white/80 backdrop-blur rounded-2xl p-5 mb-6 max-w-md w-full shadow-lg">
        <h3 className="font-bold text-lg text-rose-700 mb-3 text-center">Comment jouer ?</h3>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="bg-blue-50 rounded-xl p-3 border-2 border-blue-200">
            <div className="text-2xl mb-1">❓</div>
            <div className="font-bold text-blue-700">BLANC</div>
            <div className="text-blue-600 text-xs">Réponds honnêtement</div>
            <div className="mt-1 text-xs font-bold text-blue-500">+2 pts</div>
          </div>
          <div className="bg-orange-50 rounded-xl p-3 border-2 border-orange-200">
            <div className="text-2xl mb-1">🍽️</div>
            <div className="font-bold text-orange-700">MANGER</div>
            <div className="text-orange-600 text-xs">Défi culinaire</div>
            <div className="mt-1 text-xs font-bold text-orange-500">+1 pt</div>
          </div>
          <div className="bg-pink-50 rounded-xl p-3 border-2 border-pink-200">
            <div className="text-2xl mb-1">🥥</div>
            <div className="font-bold text-pink-700">COCO</div>
            <div className="text-pink-600 text-xs">Action ou gage</div>
            <div className="mt-1 text-xs font-bold text-pink-500">+3 pts</div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3 text-center">
          Pioche une carte, réalise le défi, gagne des points !<br/>
          Le joueur avec le plus de points gagne la partie.
        </p>
      </div>

      {/* Setup form */}
      <div className="bg-white/90 backdrop-blur rounded-2xl p-6 max-w-md w-full shadow-xl">
        <h2 className="text-xl font-black text-gray-800 mb-4 text-center">Configuration de la partie</h2>

        {/* Rounds */}
        <div className="mb-5">
          <label className="block font-bold text-gray-700 mb-2 text-sm">Nombre de tours par joueur</label>
          <div className="flex gap-2">
            {[3, 5, 7, 10].map(r => (
              <button
                key={r}
                data-testid={`rounds-${r}`}
                onClick={() => setMaxRounds(r)}
                className={`flex-1 py-2 rounded-xl font-bold text-sm border-2 transition-all ${
                  maxRounds === r
                    ? "bg-rose-500 border-rose-600 text-white shadow-md scale-105"
                    : "bg-white border-gray-200 text-gray-600 hover:border-rose-300"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Players */}
        <div className="mb-4">
          <label className="block font-bold text-gray-700 mb-2 text-sm">Joueurs ({playerNames.length}/8)</label>
          <div className="space-y-2">
            {playerNames.map((name, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-2xl w-8 text-center">{AVATARS[i % AVATARS.length]}</span>
                <input
                  data-testid={`player-name-${i}`}
                  type="text"
                  value={name}
                  onChange={e => updateName(i, e.target.value)}
                  placeholder={`Joueur ${i + 1}`}
                  maxLength={20}
                  className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:border-rose-400 focus:outline-none transition-colors"
                />
                {playerNames.length > 2 && (
                  <button
                    data-testid={`remove-player-${i}`}
                    onClick={() => removePlayer(i)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-200 font-bold text-lg leading-none"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {playerNames.length < 8 && (
          <button
            data-testid="add-player"
            onClick={addPlayer}
            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 text-sm font-semibold hover:border-rose-400 hover:text-rose-500 transition-colors mb-4"
          >
            + Ajouter un joueur
          </button>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-2 mb-4 text-sm font-medium">
            {error}
          </div>
        )}

        <button
          data-testid="start-game"
          onClick={handleStart}
          className="w-full py-4 rounded-2xl font-black text-xl text-white shadow-lg hover:shadow-xl active:scale-95 transition-all"
          style={{ background: "linear-gradient(135deg, #e91e63, #c2185b)" }}
        >
          🎲 Commencer la partie !
        </button>
      </div>
    </div>
  );
}
