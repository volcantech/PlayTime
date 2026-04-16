import { Router } from "express";
import { db, usersTable, gameStatsTable } from "@workspace/db";
import { eq, desc, sql, gt } from "drizzle-orm";
import { requireUserAuth } from "../lib/authUtils";

const router = Router();

const VALID_MODES = ["bmc", "connect4", "undercover", "petitbac"];

router.get("/me", requireUserAuth, async (req: any, res) => {
  const rows = await db
    .select()
    .from(gameStatsTable)
    .where(eq(gameStatsTable.userId, req.userId));

  const result: Record<string, { wins: number; losses: number; draws: number }> = {
    bmc: { wins: 0, losses: 0, draws: 0 },
    connect4: { wins: 0, losses: 0, draws: 0 },
    undercover: { wins: 0, losses: 0, draws: 0 },
    petitbac: { wins: 0, losses: 0, draws: 0 },
  };
  for (const row of rows) {
    result[row.gameMode] = { wins: row.wins, losses: row.losses, draws: row.draws };
  }
  return res.json(result);
});

router.get("/leaderboard", async (req, res) => {
  const mode = String(req.query.mode || "bmc");
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 10;
  const offset = (page - 1) * limit;

  if (!VALID_MODES.includes(mode)) {
    return res.status(400).json({ error: "Mode de jeu invalide." });
  }

  const rows = await db
    .select({
      username: usersTable.username,
      avatar: usersTable.avatar,
      wins: gameStatsTable.wins,
      losses: gameStatsTable.losses,
      draws: gameStatsTable.draws,
    })
    .from(gameStatsTable)
    .innerJoin(usersTable, eq(gameStatsTable.userId, usersTable.id))
    .where(eq(gameStatsTable.gameMode, mode))
    .orderBy(desc(gameStatsTable.wins), desc(gameStatsTable.draws))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(gameStatsTable)
    .innerJoin(usersTable, eq(gameStatsTable.userId, usersTable.id))
    .where(eq(gameStatsTable.gameMode, mode));

  return res.json({
    entries: rows,
    total: count,
    page,
    totalPages: Math.max(1, Math.ceil(count / limit)),
  });
});

export default router;
