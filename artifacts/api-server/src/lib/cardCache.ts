import { db } from "@workspace/db";
import { questionCardsTable, answerCardsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface CachedQuestion {
  id: number;
  text: string;
  blanks: number;
}

export interface CachedAnswer {
  id: number;
  text: string;
  isBlank: boolean;
}

let cachedQuestions: CachedQuestion[] = [];
let cachedAnswers: CachedAnswer[] = [];

export async function reloadCardCache(): Promise<void> {
  const questions = await db
    .select({ id: questionCardsTable.id, text: questionCardsTable.text, blanks: questionCardsTable.blanks })
    .from(questionCardsTable)
    .where(eq(questionCardsTable.active, true));

  const answers = await db
    .select({ id: answerCardsTable.id, text: answerCardsTable.text, isBlank: answerCardsTable.isBlank })
    .from(answerCardsTable)
    .where(eq(answerCardsTable.active, true));

  cachedQuestions = questions;
  cachedAnswers = answers;
}

export function getQuestions(): CachedQuestion[] {
  return cachedQuestions;
}

export function getAnswers(): CachedAnswer[] {
  return cachedAnswers;
}
