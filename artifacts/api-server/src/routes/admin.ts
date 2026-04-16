import { Router } from "express";
import { db } from "@workspace/db";
import { questionCardsTable, answerCardsTable, usersTable, undercoverWordPairsTable, petitBacCategoriesTable, gameSettingsTable, gameStatsTable, customAvatarsTable } from "@workspace/db";
import { eq, ilike, sql, or } from "drizzle-orm";
import { reloadCardCache } from "../lib/cardCache";
import { reloadUndercoverWordCache } from "../lib/undercoverWordCache";
import { reloadPBCategoryCache } from "../lib/petitBacCategoryCache";
import { verifyUserToken } from "../lib/authUtils";

const router = Router();

const GAME_KEYS = ["bmc", "connect4", "undercover", "petitbac"] as const;
type GameKey = typeof GAME_KEYS[number];

async function getGameSettings(): Promise<Record<GameKey, boolean>> {
  const rows = await db.select().from(gameSettingsTable);
  const result: Record<string, boolean> = { bmc: true, connect4: true, undercover: true, petitbac: true };
  for (const row of rows) {
    result[row.gameKey] = row.enabled;
  }
  return result as Record<GameKey, boolean>;
}

async function requireAdmin(req: any, res: any, next: any) {
  const auth = req.headers["authorization"] as string | undefined;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Non autorisé" });
  }
  const token = auth.slice(7);
  const userId = verifyUserToken(token);
  if (!userId) {
    return res.status(401).json({ error: "Token invalide ou expiré" });
  }
  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (users.length === 0 || !users[0].isAdmin) {
    return res.status(403).json({ error: "Accès réservé aux administrateurs." });
  }
  req.userId = userId;
  next();
}

router.post("/login", async (req, res) => {
  const { username, code } = req.body;
  if (!username || !code) {
    return res.status(400).json({ error: "Pseudo et code requis." });
  }
  const { signUserToken } = await import("../lib/authUtils");
  const bcrypt = (await import("bcryptjs")).default;
  const { or } = await import("drizzle-orm");

  const users = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.username, username.trim()), eq(usersTable.email, username.trim().toLowerCase())));

  if (users.length === 0) {
    return res.status(401).json({ error: "Identifiants incorrects." });
  }
  const user = users[0];
  if (!user.isAdmin) {
    return res.status(403).json({ error: "Accès réservé aux administrateurs." });
  }
  const valid = await bcrypt.compare(code, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Identifiants incorrects." });
  }
  const token = signUserToken(user.id);
  return res.json({ token, username: user.username });
});

router.get("/questions", requireAdmin, async (_req, res) => {
  const questions = await db.select().from(questionCardsTable).orderBy(questionCardsTable.id);
  return res.json(questions);
});

router.post("/questions", requireAdmin, async (req, res) => {
  const { text, blanks, isAdult } = req.body;
  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "Le texte de la question est requis." });
  }
  const [created] = await db.insert(questionCardsTable).values({
    text: text.trim(),
    blanks: Number(blanks) || 1,
    active: true,
    isAdult: isAdult === true,
  }).returning();
  await reloadCardCache();
  return res.status(201).json(created);
});

router.put("/questions/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { text, blanks, active, isAdult } = req.body;
  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "Le texte de la question est requis." });
  }
  const [updated] = await db
    .update(questionCardsTable)
    .set({ text: text.trim(), blanks: Number(blanks) || 1, active: active !== false, isAdult: isAdult === true })
    .where(eq(questionCardsTable.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Question introuvable." });
  await reloadCardCache();
  return res.json(updated);
});

router.delete("/questions/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const deleted = await db.delete(questionCardsTable).where(eq(questionCardsTable.id, id)).returning();
  if (!deleted.length) return res.status(404).json({ error: "Question introuvable." });
  await reloadCardCache();
  return res.json({ success: true });
});

router.get("/answers", requireAdmin, async (_req, res) => {
  const answers = await db.select().from(answerCardsTable).orderBy(answerCardsTable.id);
  return res.json(answers);
});

router.post("/answers", requireAdmin, async (req, res) => {
  const { text, isBlank, isAdult } = req.body;
  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "Le texte de la réponse est requis." });
  }
  const [created] = await db.insert(answerCardsTable).values({
    text: text.trim(),
    isBlank: isBlank === true,
    isAdult: isAdult === true,
    active: true,
  }).returning();
  await reloadCardCache();
  return res.status(201).json(created);
});

router.put("/answers/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { text, isBlank, active, isAdult } = req.body;
  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "Le texte de la réponse est requis." });
  }
  const [updated] = await db
    .update(answerCardsTable)
    .set({ text: text.trim(), isBlank: isBlank === true, isAdult: isAdult === true, active: active !== false })
    .where(eq(answerCardsTable.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Réponse introuvable." });
  await reloadCardCache();
  return res.json(updated);
});

router.delete("/answers/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const deleted = await db.delete(answerCardsTable).where(eq(answerCardsTable.id, id)).returning();
  if (!deleted.length) return res.status(404).json({ error: "Réponse introuvable." });
  await reloadCardCache();
  return res.json({ success: true });
});

router.get("/undercover-word-pairs", requireAdmin, async (_req, res) => {
  const wordPairs = await db.select().from(undercoverWordPairsTable).orderBy(undercoverWordPairsTable.id);
  return res.json(wordPairs);
});

router.post("/undercover-word-pairs", requireAdmin, async (req, res) => {
  const { wordCivilian, wordUndercover, words } = req.body;
  if (!wordCivilian || typeof wordCivilian !== "string" || wordCivilian.trim() === "") {
    return res.status(400).json({ error: "Le mot civil est requis." });
  }
  if (!wordUndercover || typeof wordUndercover !== "string" || wordUndercover.trim() === "") {
    return res.status(400).json({ error: "Le mot undercover est requis." });
  }
  let wordsJson: string | null = null;
  if (Array.isArray(words) && words.length >= 2) {
    const filtered = words.map((w: unknown) => String(w).trim()).filter((w) => w.length > 0).slice(0, 10);
    if (filtered.length >= 2) wordsJson = JSON.stringify(filtered);
  }
  const [created] = await db.insert(undercoverWordPairsTable).values({
    wordCivilian: wordCivilian.trim(),
    wordUndercover: wordUndercover.trim(),
    words: wordsJson,
    active: true,
  }).returning();
  await reloadUndercoverWordCache();
  return res.status(201).json(created);
});

router.put("/undercover-word-pairs/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { wordCivilian, wordUndercover, active, words } = req.body;
  if (!wordCivilian || typeof wordCivilian !== "string" || wordCivilian.trim() === "") {
    return res.status(400).json({ error: "Le mot civil est requis." });
  }
  if (!wordUndercover || typeof wordUndercover !== "string" || wordUndercover.trim() === "") {
    return res.status(400).json({ error: "Le mot undercover est requis." });
  }
  let wordsJson: string | null = null;
  if (Array.isArray(words) && words.length >= 2) {
    const filtered = words.map((w: unknown) => String(w).trim()).filter((w) => w.length > 0).slice(0, 10);
    if (filtered.length >= 2) wordsJson = JSON.stringify(filtered);
  }
  const [updated] = await db
    .update(undercoverWordPairsTable)
    .set({
      wordCivilian: wordCivilian.trim(),
      wordUndercover: wordUndercover.trim(),
      words: wordsJson,
      active: active !== false,
    })
    .where(eq(undercoverWordPairsTable.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Groupe de mots introuvable." });
  await reloadUndercoverWordCache();
  return res.json(updated);
});

router.delete("/undercover-word-pairs/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const deleted = await db.delete(undercoverWordPairsTable).where(eq(undercoverWordPairsTable.id, id)).returning();
  if (!deleted.length) return res.status(404).json({ error: "Groupe de mots introuvable." });
  await reloadUndercoverWordCache();
  return res.json({ success: true });
});

router.post("/change-password", requireAdmin, async (req: any, res) => {
  const { newCode } = req.body;
  if (!newCode || typeof newCode !== "string" || newCode.length < 6) {
    return res.status(400).json({ error: "Le nouveau code doit faire au moins 6 caractères." });
  }
  const bcrypt = (await import("bcryptjs")).default;
  const passwordHash = await bcrypt.hash(newCode, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, req.userId));
  return res.json({ success: true });
});

router.get("/petitbac-categories", requireAdmin, async (_req, res) => {
  const categories = await db.select().from(petitBacCategoriesTable).orderBy(petitBacCategoriesTable.id);
  return res.json(categories);
});

router.post("/petitbac-categories", requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({ error: "Le nom de la catégorie est requis." });
  }
  const [created] = await db.insert(petitBacCategoriesTable).values({ name: name.trim(), active: true }).returning();
  await reloadPBCategoryCache();
  return res.status(201).json(created);
});

router.put("/petitbac-categories/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, active } = req.body;
  if (!name || typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({ error: "Le nom de la catégorie est requis." });
  }
  const [updated] = await db
    .update(petitBacCategoriesTable)
    .set({ name: name.trim(), active: active !== false })
    .where(eq(petitBacCategoriesTable.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Catégorie introuvable." });
  await reloadPBCategoryCache();
  return res.json(updated);
});

router.delete("/petitbac-categories/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const deleted = await db.delete(petitBacCategoriesTable).where(eq(petitBacCategoriesTable.id, id)).returning();
  if (!deleted.length) return res.status(404).json({ error: "Catégorie introuvable." });
  await reloadPBCategoryCache();
  return res.json({ success: true });
});

router.post("/change-username", requireAdmin, async (req: any, res) => {
  const { username } = req.body;
  if (!username || typeof username !== "string" || username.trim().length < 3) {
    return res.status(400).json({ error: "Le pseudo doit faire au moins 3 caractères." });
  }
  const nextUsername = username.trim();
  const existing = await db.select().from(usersTable).where(eq(usersTable.username, nextUsername));
  if (existing.some((u) => u.id !== req.userId)) {
    return res.status(409).json({ error: "Ce pseudo est déjà utilisé." });
  }
  const [updated] = await db
    .update(usersTable)
    .set({ username: nextUsername })
    .where(eq(usersTable.id, req.userId))
    .returning();
  if (!updated) return res.status(404).json({ error: "Utilisateur introuvable." });
  return res.json({ success: true, username: updated.username });
});

router.get("/game-settings", requireAdmin, async (_req, res) => {
  const settings = await getGameSettings();
  return res.json(settings);
});

router.put("/game-settings/:gameKey", requireAdmin, async (req, res) => {
  const { gameKey } = req.params;
  if (!GAME_KEYS.includes(gameKey as GameKey)) {
    return res.status(400).json({ error: "Mode de jeu invalide." });
  }
  const { enabled } = req.body;
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "Le champ 'enabled' doit être un booléen." });
  }
  const existing = await db.select().from(gameSettingsTable).where(eq(gameSettingsTable.gameKey, gameKey));
  if (existing.length === 0) {
    await db.insert(gameSettingsTable).values({ gameKey, enabled });
  } else {
    await db.update(gameSettingsTable).set({ enabled }).where(eq(gameSettingsTable.gameKey, gameKey));
  }
  return res.json({ gameKey, enabled });
});

router.get("/users", requireAdmin, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 10;
  const offset = (page - 1) * limit;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

  const baseQuery = db.select({
    id: usersTable.id,
    username: usersTable.username,
    email: usersTable.email,
    avatar: usersTable.avatar,
    isAdmin: usersTable.isAdmin,
    createdAt: usersTable.createdAt,
  }).from(usersTable);

  const users = await (search
    ? baseQuery.where(or(ilike(usersTable.username, `%${search}%`), ilike(usersTable.email, `%${search}%`)))
    : baseQuery
  ).orderBy(usersTable.id).limit(limit).offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(search ? or(ilike(usersTable.username, `%${search}%`), ilike(usersTable.email, `%${search}%`)) : sql`true`);

  const userIds = users.map(u => u.id);
  let statsRows: { userId: number; gameMode: string; wins: number; losses: number; draws: number }[] = [];
  if (userIds.length > 0) {
    const { inArray } = await import("drizzle-orm");
    statsRows = await db.select({
      userId: gameStatsTable.userId,
      gameMode: gameStatsTable.gameMode,
      wins: gameStatsTable.wins,
      losses: gameStatsTable.losses,
      draws: gameStatsTable.draws,
    }).from(gameStatsTable).where(inArray(gameStatsTable.userId, userIds));
  }

  const statsMap: Record<number, Record<string, { wins: number; losses: number; draws: number }>> = {};
  for (const row of statsRows) {
    if (!statsMap[row.userId]) statsMap[row.userId] = {};
    statsMap[row.userId][row.gameMode] = { wins: row.wins, losses: row.losses, draws: row.draws };
  }

  const result = users.map(u => ({
    ...u,
    stats: {
      bmc: statsMap[u.id]?.bmc ?? { wins: 0, losses: 0, draws: 0 },
      connect4: statsMap[u.id]?.connect4 ?? { wins: 0, losses: 0, draws: 0 },
      undercover: statsMap[u.id]?.undercover ?? { wins: 0, losses: 0, draws: 0 },
      petitbac: statsMap[u.id]?.petitbac ?? { wins: 0, losses: 0, draws: 0 },
    },
  }));

  return res.json({ users: result, total: count, page, totalPages: Math.max(1, Math.ceil(count / limit)) });
});

router.put("/users/:id", requireAdmin, async (req: any, res) => {
  const targetId = Number(req.params.id);
  const { password, avatar, stats } = req.body;

  const existing = await db.select().from(usersTable).where(eq(usersTable.id, targetId));
  if (existing.length === 0) return res.status(404).json({ error: "Utilisateur introuvable." });

  if (avatar !== undefined) {
    if (typeof avatar !== "string" || avatar.trim() === "") {
      return res.status(400).json({ error: "Avatar invalide." });
    }
    await db.update(usersTable).set({ avatar: avatar.trim() }).where(eq(usersTable.id, targetId));
  }

  if (password !== undefined) {
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Le mot de passe doit faire au moins 6 caractères." });
    }
    const bcrypt = (await import("bcryptjs")).default;
    const passwordHash = await bcrypt.hash(password, 10);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, targetId));
  }

  if (stats && typeof stats === "object") {
    const { inArray } = await import("drizzle-orm");
    for (const [gameMode, modeStats] of Object.entries(stats)) {
      if (!GAME_KEYS.includes(gameMode as GameKey)) continue;
      const s = modeStats as { wins?: number; losses?: number; draws?: number };
      const wins = typeof s.wins === "number" ? Math.max(0, s.wins) : undefined;
      const losses = typeof s.losses === "number" ? Math.max(0, s.losses) : undefined;
      const draws = typeof s.draws === "number" ? Math.max(0, s.draws) : undefined;
      if (wins === undefined && losses === undefined && draws === undefined) continue;

      const existingStats = await db.select().from(gameStatsTable)
        .where(sql`${gameStatsTable.userId} = ${targetId} AND ${gameStatsTable.gameMode} = ${gameMode}`);

      if (existingStats.length === 0) {
        await db.insert(gameStatsTable).values({
          userId: targetId,
          gameMode,
          wins: wins ?? 0,
          losses: losses ?? 0,
          draws: draws ?? 0,
        });
      } else {
        const updates: Record<string, number> = {};
        if (wins !== undefined) updates.wins = wins;
        if (losses !== undefined) updates.losses = losses;
        if (draws !== undefined) updates.draws = draws;
        await db.update(gameStatsTable).set(updates).where(
          sql`${gameStatsTable.userId} = ${targetId} AND ${gameStatsTable.gameMode} = ${gameMode}`
        );
      }
    }
  }

  return res.json({ success: true });
});

router.get("/avatars", requireAdmin, async (_req, res) => {
  const avatars = await db.select().from(customAvatarsTable).orderBy(customAvatarsTable.id);
  return res.json(avatars);
});

router.post("/avatars", requireAdmin, async (req, res) => {
  const { emoji, label } = req.body;
  if (!emoji || typeof emoji !== "string" || emoji.trim() === "") {
    return res.status(400).json({ error: "L'emoji est requis." });
  }
  if (!label || typeof label !== "string" || label.trim() === "") {
    return res.status(400).json({ error: "Le nom est requis." });
  }
  const existing = await db.select().from(customAvatarsTable).where(eq(customAvatarsTable.emoji, emoji.trim()));
  if (existing.length > 0) return res.status(409).json({ error: "Cet avatar existe déjà." });
  const [created] = await db.insert(customAvatarsTable).values({ emoji: emoji.trim(), label: label.trim() }).returning();
  return res.status(201).json(created);
});

router.delete("/avatars/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const deleted = await db.delete(customAvatarsTable).where(eq(customAvatarsTable.id, id)).returning();
  if (!deleted.length) return res.status(404).json({ error: "Avatar introuvable." });
  return res.json({ success: true });
});

export default router;
