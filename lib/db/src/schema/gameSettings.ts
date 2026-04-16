import { pgTable, serial, varchar, boolean } from "drizzle-orm/pg-core";

export const gameSettingsTable = pgTable("game_settings", {
  id: serial("id").primaryKey(),
  gameKey: varchar("game_key", { length: 32 }).notNull().unique(),
  enabled: boolean("enabled").notNull().default(true),
});
