import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const answerCardsTable = pgTable("answer_cards", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  isBlank: boolean("is_blank").notNull().default(false),
  active: boolean("active").notNull().default(true),
  isAdult: boolean("is_adult").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAnswerCardSchema = createInsertSchema(answerCardsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAnswerCard = z.infer<typeof insertAnswerCardSchema>;
export type AnswerCard = typeof answerCardsTable.$inferSelect;
