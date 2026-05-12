import { db } from "@workspace/db";
import { undercoverWordPairsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface CachedUndercoverWordPair {
  id: number;
  wordCivilian: string;
  wordUndercover: string;
  words?: string[];
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
  const rows = await db
    .select({
      id: undercoverWordPairsTable.id,
      wordCivilian: undercoverWordPairsTable.wordCivilian,
      wordUndercover: undercoverWordPairsTable.wordUndercover,
      words: undercoverWordPairsTable.words,
    })
    .from(undercoverWordPairsTable)
    .where(eq(undercoverWordPairsTable.active, true));

  cachedWordPairs = rows.map((row) => {
    let parsedWords: string[] | undefined;
    if (row.words) {
      try {
        const parsed = JSON.parse(row.words);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          parsedWords = parsed.filter((w) => typeof w === "string" && w.trim().length > 0);
        }
      } catch {
      }
    }
    return {
      id: row.id,
      wordCivilian: row.wordCivilian,
      wordUndercover: row.wordUndercover,
      words: parsedWords,
    };
  });
}

export function getUndercoverWordPairs(): CachedUndercoverWordPair[] {
  return cachedWordPairs;
}
