import { db } from "@workspace/db";
import { questionCardsTable, answerCardsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type CardMode = "normal" | "adult" | "mixed";

export interface CachedQuestion {
  id: number;
  text: string;
  blanks: number;
  isAdult: boolean;
}

export interface CachedAnswer {
  id: number;
  text: string;
  isBlank: boolean;
  isAdult: boolean;
}

let cachedQuestions: CachedQuestion[] = [];
let cachedAnswers: CachedAnswer[] = [];

export async function reloadCardCache(): Promise<void> {
  const questions = await db
    .select({ id: questionCardsTable.id, text: questionCardsTable.text, blanks: questionCardsTable.blanks, isAdult: questionCardsTable.isAdult })
    .from(questionCardsTable)
    .where(eq(questionCardsTable.active, true));

  const answers = await db
    .select({ id: answerCardsTable.id, text: answerCardsTable.text, isBlank: answerCardsTable.isBlank, isAdult: answerCardsTable.isAdult })
    .from(answerCardsTable)
    .where(eq(answerCardsTable.active, true));

  cachedQuestions = questions;
  cachedAnswers = answers;
}

export function getQuestions(mode: CardMode = "normal"): CachedQuestion[] {
  if (mode === "adult") return cachedQuestions.filter(q => q.isAdult);
  if (mode === "mixed") return cachedQuestions;
  return cachedQuestions.filter(q => !q.isAdult);
}

export function getAnswers(mode: CardMode = "normal"): CachedAnswer[] {
  if (mode === "adult") return cachedAnswers.filter(a => a.isAdult);
  if (mode === "mixed") return cachedAnswers;
  return cachedAnswers.filter(a => !a.isAdult);
}
