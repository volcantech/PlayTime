import { Router } from "express";
import { db } from "@workspace/db";
import { petitBacCategoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/categories", async (_req, res) => {
  const categories = await db
    .select()
    .from(petitBacCategoriesTable)
    .where(eq(petitBacCategoriesTable.active, true))
    .orderBy(petitBacCategoriesTable.id);
  return res.json(categories);
});

export default router;
