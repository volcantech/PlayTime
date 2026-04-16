import { pgTable, serial, text, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

export interface GWTraits {
  gender: "homme" | "femme";
  hair_color: "brun" | "blond" | "roux" | "gris" | "chauve";
  hair_length?: "court" | "long";
  glasses: boolean;
  hat: boolean;
  beard: boolean;
  earrings: boolean;
}

export const guessWhoCharactersTable = pgTable("guess_who_characters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🧑"),
  imageUrl: text("image_url"),
  traits: jsonb("traits").$type<GWTraits>().notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type GWCharacter = typeof guessWhoCharactersTable.$inferSelect;
