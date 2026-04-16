import type { Card } from "../data/cards";

export interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  tokensBlanche: number;
  cardsDone: number;
}

export type GamePhase =
  | "setup"
  | "playing"
  | "card-drawn"
  | "card-result"
  | "game-over";

export interface GameState {
  phase: GamePhase;
  players: Player[];
  currentPlayerIndex: number;
  currentCard: Card | null;
  remainingCards: Card[];
  usedCardIds: Set<number>;
  roundNumber: number;
  maxRounds: number;
  cardResult: "success" | "fail" | null;
}

export const AVATARS = ["🐶", "🐱", "🦊", "🐼", "🐨", "🐯", "🦁", "🐸", "🐙", "🦄", "🐲", "🌺"];
