import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const customAvatarsTable = pgTable("custom_avatars", {
  id: serial("id").primaryKey(),
  emoji: text("emoji").notNull().unique(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CustomAvatar = typeof customAvatarsTable.$inferSelect;
