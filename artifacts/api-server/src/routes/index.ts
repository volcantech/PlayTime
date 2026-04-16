import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import authRouter from "./auth";
import statsRouter from "./stats";
import petitBacRouter from "./petitBac";
import roomsRouter from "./rooms";
import { db } from "@workspace/db";
import { gameSettingsTable, customAvatarsTable } from "@workspace/db";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminRouter);
router.use("/auth", authRouter);
router.use("/stats", statsRouter);
router.use("/petitbac", petitBacRouter);
router.use("/rooms", roomsRouter);

router.get("/avatars", async (_req, res) => {
  const avatars = await db.select().from(customAvatarsTable).orderBy(customAvatarsTable.id);
  return res.json(avatars);
});

router.get("/game-settings", async (_req, res) => {
  const rows = await db.select().from(gameSettingsTable);
  const result: Record<string, boolean> = { bmc: true, connect4: true, undercover: true, petitbac: true };
  for (const row of rows) {
    result[row.gameKey] = row.enabled;
  }
  return res.json(result);
});

export default router;
