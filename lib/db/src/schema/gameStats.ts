import { pgTable, serial, integer, text, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const gameStatsTable = pgTable("game_stats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  gameMode: text("game_mode").notNull(),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
}, (t) => [
  unique("game_stats_user_mode_unique").on(t.userId, t.gameMode),
]);

export type GameStats = typeof gameStatsTable.$inferSelect;
