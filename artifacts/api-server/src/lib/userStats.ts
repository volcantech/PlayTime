import { db, gameStatsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

export type GameMode = "bmc" | "connect4" | "undercover" | "petitbac" | "guess_who";

export async function recordWin(userId: number, gameMode: GameMode): Promise<void> {
  try {
    await db
      .insert(gameStatsTable)
      .values({ userId, gameMode, wins: 1, losses: 0, draws: 0 })
      .onConflictDoUpdate({
        target: [gameStatsTable.userId, gameStatsTable.gameMode],
        set: { wins: sql`${gameStatsTable.wins} + 1` },
      });
  } catch (err) {
    console.error("[userStats] Failed to record win:", err);
  }
}

export async function recordLoss(userId: number, gameMode: GameMode): Promise<void> {
  try {
    await db
      .insert(gameStatsTable)
      .values({ userId, gameMode, wins: 0, losses: 1, draws: 0 })
      .onConflictDoUpdate({
        target: [gameStatsTable.userId, gameStatsTable.gameMode],
        set: { losses: sql`${gameStatsTable.losses} + 1` },
      });
  } catch (err) {
    console.error("[userStats] Failed to record loss:", err);
  }
}

export async function recordDraw(userId: number, gameMode: GameMode): Promise<void> {
  try {
    await db
      .insert(gameStatsTable)
      .values({ userId, gameMode, wins: 0, losses: 0, draws: 1 })
      .onConflictDoUpdate({
        target: [gameStatsTable.userId, gameStatsTable.gameMode],
        set: { draws: sql`${gameStatsTable.draws} + 1` },
      });
  } catch (err) {
    console.error("[userStats] Failed to record draw:", err);
  }
}

export async function getUserStats(userId: number): Promise<Record<GameMode, { wins: number; losses: number; draws: number }>> {
  const rows = await db
    .select()
    .from(gameStatsTable)
    .where(eq(gameStatsTable.userId, userId));

  const result: Record<GameMode, { wins: number; losses: number; draws: number }> = {
    bmc: { wins: 0, losses: 0, draws: 0 },
    connect4: { wins: 0, losses: 0, draws: 0 },
    undercover: { wins: 0, losses: 0, draws: 0 },
    petitbac: { wins: 0, losses: 0, draws: 0 },
    guess_who: { wins: 0, losses: 0, draws: 0 },
  };
  for (const row of rows) {
    if (row.gameMode in result) {
      result[row.gameMode as GameMode] = {
        wins: row.wins,
        losses: row.losses,
        draws: row.draws,
      };
    }
  }
  return result;
}
