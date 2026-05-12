import { useState, useCallback } from "react";
import type { GameState } from "../types/game";
import type { Player } from "../types/game";
import { PlayerSetup } from "../components/PlayerSetup";
import { GameCard } from "../components/GameCard";
import { Scoreboard } from "../components/Scoreboard";
import { GameOver } from "../components/GameOver";
import { ALL_CARDS, shuffleCards, CATEGORY_CONFIG } from "../data/cards";

function createInitialState(): GameState {
  return {
    phase: "setup",
    players: [],
    currentPlayerIndex: 0,
    currentCard: null,
    remainingCards: shuffleCards(ALL_CARDS),
    usedCardIds: new Set(),
    roundNumber: 1,
    maxRounds: 5,
    cardResult: null,
  };
}

export function Game() {
  const [state, setState] = useState<GameState>(createInitialState);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [resultAnim, setResultAnim] = useState<"success" | "fail" | null>(null);

  const startGame = useCallback((players: Player[], maxRounds: number) => {
    setState(prev => ({
      ...prev,
      phase: "playing",
      players,
      maxRounds,
      currentPlayerIndex: 0,
      remainingCards: shuffleCards(ALL_CARDS),
    }));
  }, []);

  const drawCard = useCallback(() => {
    setState(prev => {
      let remaining = prev.remainingCards;
      if (remaining.length === 0) {
        remaining = shuffleCards(ALL_CARDS.filter(c => !prev.usedCardIds.has(c.id)));
        if (remaining.length === 0) {
          remaining = shuffleCards(ALL_CARDS);
        }
      }
      const card = remaining[0];
      const newRemaining = remaining.slice(1);
      return {
        ...prev,
        phase: "card-drawn",
        currentCard: card,
        remainingCards: newRemaining,
        cardResult: null,
      };
    });
  }, []);

  const handleResult = useCallback((success: boolean) => {
    setResultAnim(success ? "success" : "fail");
    setTimeout(() => {
      setResultAnim(null);
      setState(prev => {
        if (!prev.currentCard) return prev;

        const pointValue = CATEGORY_CONFIG[prev.currentCard.category].pointValue;
        const updatedPlayers = prev.players.map((p, idx) => {
          if (idx !== prev.currentPlayerIndex) return p;
          return {
            ...p,
            score: success ? p.score + pointValue : p.score,
            cardsDone: p.cardsDone + 1,
          };
        });

        const newUsedIds = new Set(prev.usedCardIds);
        newUsedIds.add(prev.currentCard!.id);

        const nextPlayerIndex = (prev.currentPlayerIndex + 1) % prev.players.length;
        const newRound = nextPlayerIndex === 0 ? prev.roundNumber + 1 : prev.roundNumber;

        const isGameOver = newRound > prev.maxRounds && nextPlayerIndex === 0;

        return {
          ...prev,
          phase: isGameOver ? "game-over" : "playing",
          players: updatedPlayers,
          currentPlayerIndex: nextPlayerIndex,
          currentCard: null,
          cardResult: success ? "success" : "fail",
          usedCardIds: newUsedIds,
          roundNumber: newRound,
        };
      });
    }, 800);
  }, []);

  const restartGame = useCallback(() => {
    setState(createInitialState());
    setShowScoreboard(false);
  }, []);

  if (state.phase === "setup") {
    return <PlayerSetup onStartGame={startGame} />;
  }

  if (state.phase === "game-over") {
    return <GameOver players={state.players} onRestart={restartGame} />;
  }

  const currentPlayer = state.players[state.currentPlayerIndex];

  return (
    <div className="min-h-screen flex flex-col"
         style={{ background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 60%, #ff9a9e 100%)" }}>

      {/* Result animation overlay */}
      {resultAnim && (
        <div className={`fixed inset-0 flex items-center justify-center z-50 pointer-events-none`}>
          <div className={`text-8xl animate-bounce ${resultAnim === "success" ? "text-green-500" : "text-red-500"}`}>
            {resultAnim === "success" ? "🎉" : "😬"}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-rose-100 px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="font-black text-rose-700 text-lg" style={{ fontFamily: "Pacifico, cursive" }}>
                🥥 BMC
              </h1>
              <p className="text-xs text-gray-500">
                Tour {state.roundNumber}/{state.maxRounds}
              </p>
            </div>
            <button
              data-testid="toggle-scoreboard"
              onClick={() => setShowScoreboard(s => !s)}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 hover:bg-rose-200 transition-colors"
            >
              {showScoreboard ? "Masquer" : "Scores 📊"}
            </button>
          </div>
          <Scoreboard
            players={state.players}
            currentPlayerIndex={state.currentPlayerIndex}
            compact={!showScoreboard}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">

          {state.phase === "playing" && (
            <div className="flex flex-col items-center gap-6">
              {/* Current player */}
              <div className="text-center">
                <div className="text-5xl mb-2">{currentPlayer.avatar}</div>
                <h2 className="text-2xl font-black text-rose-700">
                  {currentPlayer.name}
                </h2>
                <p className="text-gray-600 text-sm font-semibold">C'est ton tour !</p>
              </div>

              {/* Round progress */}
              <div className="w-full bg-white/60 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${((state.roundNumber - 1) / state.maxRounds) * 100}%`,
                    background: "linear-gradient(90deg, #e91e63, #f97316)",
                  }}
                />
              </div>

              <button
                data-testid="draw-card"
                onClick={drawCard}
                className="w-full py-6 rounded-3xl font-black text-2xl text-white shadow-2xl hover:shadow-3xl active:scale-95 transition-all"
                style={{ background: "linear-gradient(135deg, #e91e63 0%, #c2185b 100%)" }}
              >
                🃏 Piocher une carte !
              </button>

              {/* Card distribution info */}
              <div className="flex gap-3 text-center">
                <div className="bg-blue-50 rounded-xl px-3 py-2 flex-1 border border-blue-200">
                  <div className="text-base">❓</div>
                  <div className="text-xs font-bold text-blue-600">BLANC</div>
                </div>
                <div className="bg-orange-50 rounded-xl px-3 py-2 flex-1 border border-orange-200">
                  <div className="text-base">🍽️</div>
                  <div className="text-xs font-bold text-orange-600">MANGER</div>
                </div>
                <div className="bg-pink-50 rounded-xl px-3 py-2 flex-1 border border-pink-200">
                  <div className="text-base">🥥</div>
                  <div className="text-xs font-bold text-pink-600">COCO</div>
                </div>
              </div>
            </div>
          )}

          {state.phase === "card-drawn" && state.currentCard && (
            <div className="flex flex-col items-center gap-4">
              <div className="text-center mb-2">
                <div className="text-3xl">{currentPlayer.avatar}</div>
                <p className="font-bold text-rose-700 text-sm">{currentPlayer.name}</p>
              </div>
              <GameCard
                card={state.currentCard}
                onSuccess={() => handleResult(true)}
                onFail={() => handleResult(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
