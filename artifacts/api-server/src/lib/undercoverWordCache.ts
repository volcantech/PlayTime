import { db } from "@workspace/db";
import { undercoverWordPairsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface CachedUndercoverWordPair {
  id: number;
  wordCivilian: string;
  wordUndercover: string;
}

export const DEFAULT_UNDERCOVER_WORD_PAIRS: [string, string][] = [
  ["chat", "tigre"],
  ["pizza", "tarte"],
  ["plage", "piscine"],
  ["café", "chocolat"],
  ["avion", "fusée"],
  ["école", "université"],
  ["soleil", "lampe"],
  ["cinéma", "théâtre"],
  ["football", "basket"],
  ["montagne", "colline"],
  ["médecin", "dentiste"],
  ["voiture", "moto"],
  ["banane", "ananas"],
  ["ordinateur", "tablette"],
  ["restaurant", "cantine"],
  ["hiver", "neige"],
  ["pirate", "voleur"],
  ["roi", "président"],
  ["parfum", "savon"],
  ["train", "métro"],
  ["livre", "journal"],
  ["musique", "podcast"],
  ["jardin", "forêt"],
  ["fromage", "yaourt"],
  ["téléphone", "radio"],
  ["hôpital", "pharmacie"],
  ["sirène", "princesse"],
  ["robot", "alien"],
  ["argent", "trésor"],
  ["dragon", "dinosaure"],
];

let cachedWordPairs: CachedUndercoverWordPair[] = [];

export async function reloadUndercoverWordCache(): Promise<void> {
  cachedWordPairs = await db
    .select({
      id: undercoverWordPairsTable.id,
      wordCivilian: undercoverWordPairsTable.wordCivilian,
      wordUndercover: undercoverWordPairsTable.wordUndercover,
    })
    .from(undercoverWordPairsTable)
    .where(eq(undercoverWordPairsTable.active, true));
}

export function getUndercoverWordPairs(): CachedUndercoverWordPair[] {
  return cachedWordPairs;
}