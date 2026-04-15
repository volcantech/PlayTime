import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const petitBacCategoriesTable = pgTable("petit_bac_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type PetitBacCategory = typeof petitBacCategoriesTable.$inferSelect;
