import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const gwCategoriesTable = pgTable("gw_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
