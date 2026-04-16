import { db } from "@workspace/db";
import { petitBacCategoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface CachedPBCategory {
  id: number;
  name: string;
}

let categoryCache: CachedPBCategory[] = [];

export async function reloadPBCategoryCache(): Promise<void> {
  const rows = await db
    .select({ id: petitBacCategoriesTable.id, name: petitBacCategoriesTable.name })
    .from(petitBacCategoriesTable)
    .where(eq(petitBacCategoriesTable.active, true))
    .orderBy(petitBacCategoriesTable.id);
  categoryCache = rows;
}

export function getPBCategories(): CachedPBCategory[] {
  return categoryCache;
}
