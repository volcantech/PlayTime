import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const questionCardsTable = pgTable("question_cards", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  blanks: integer("blanks").notNull().default(1),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertQuestionCardSchema = createInsertSchema(questionCardsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuestionCard = z.infer<typeof insertQuestionCardSchema>;
export type QuestionCard = typeof questionCardsTable.$inferSelect;
