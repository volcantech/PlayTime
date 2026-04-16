import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const undercoverWordPairsTable = pgTable("undercover_word_pairs", {
  id: serial("id").primaryKey(),
  wordCivilian: text("word_civilian").notNull(),
  wordUndercover: text("word_undercover").notNull(),
  words: text("words"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUndercoverWordPairSchema = createInsertSchema(undercoverWordPairsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUndercoverWordPair = z.infer<typeof insertUndercoverWordPairSchema>;
export type UndercoverWordPair = typeof undercoverWordPairsTable.$inferSelect;