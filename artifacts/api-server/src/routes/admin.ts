import { Router } from "express";
import { db } from "@workspace/db";
import { questionCardsTable, answerCardsTable, adminsTable, undercoverWordPairsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { reloadCardCache } from "../lib/cardCache";
import { reloadUndercoverWordCache } from "../lib/undercoverWordCache";

const router = Router();

const SESSION_SECRET = process.env["SESSION_SECRET"] || "bmc-secret-fallback";

function signToken(adminId: number): string {
  const ts = Date.now();
  const payload = `${adminId}:${ts}`;
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

function verifyToken(token: string): number | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return null;
    const [idStr, tsStr, sig] = parts;
    const payload = `${idStr}:${tsStr}`;
    const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
    if (sig !== expectedSig) return null;
    const ts = Number(tsStr);
    if (Date.now() - ts > 24 * 60 * 60 * 1000) return null;
    return Number(idStr);
  } catch {
    return null;
  }
}

function requireAuth(req: any, res: any, next: any) {
  const auth = req.headers["authorization"] as string | undefined;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Non autorisé" });
  }
  const token = auth.slice(7);
  const adminId = verifyToken(token);
  if (!adminId) {
    return res.status(401).json({ error: "Token invalide ou expiré" });
  }
  req.adminId = adminId;
  next();
}

router.post("/login", async (req, res) => {
  const { username, code } = req.body;
  if (!username || !code) {
    return res.status(400).json({ error: "Pseudo et code requis." });
  }
  const admins = await db.select().from(adminsTable).where(eq(adminsTable.username, username));
  if (admins.length === 0) {
    return res.status(401).json({ error: "Identifiants incorrects." });
  }
  const admin = admins[0];
  const valid = await bcrypt.compare(code, admin.codeHash);
  if (!valid) {
    return res.status(401).json({ error: "Identifiants incorrects." });
  }
  const token = signToken(admin.id);
  return res.json({ token, username: admin.username });
});

router.get("/questions", requireAuth, async (_req, res) => {
  const questions = await db.select().from(questionCardsTable).orderBy(questionCardsTable.id);
  return res.json(questions);
});

router.post("/questions", requireAuth, async (req, res) => {
  const { text, blanks } = req.body;
  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "Le texte de la question est requis." });
  }
  const [created] = await db.insert(questionCardsTable).values({
    text: text.trim(),
    blanks: Number(blanks) || 1,
    active: true,
  }).returning();
  await reloadCardCache();
  return res.status(201).json(created);
});

router.put("/questions/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { text, blanks, active } = req.body;
  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "Le texte de la question est requis." });
  }
  const [updated] = await db
    .update(questionCardsTable)
    .set({ text: text.trim(), blanks: Number(blanks) || 1, active: active !== false })
    .where(eq(questionCardsTable.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Question introuvable." });
  await reloadCardCache();
  return res.json(updated);
});

router.delete("/questions/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const deleted = await db.delete(questionCardsTable).where(eq(questionCardsTable.id, id)).returning();
  if (!deleted.length) return res.status(404).json({ error: "Question introuvable." });
  await reloadCardCache();
  return res.json({ success: true });
});

router.get("/answers", requireAuth, async (_req, res) => {
  const answers = await db.select().from(answerCardsTable).orderBy(answerCardsTable.id);
  return res.json(answers);
});

router.post("/answers", requireAuth, async (req, res) => {
  const { text, isBlank } = req.body;
  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "Le texte de la réponse est requis." });
  }
  const [created] = await db.insert(answerCardsTable).values({
    text: text.trim(),
    isBlank: isBlank === true,
    active: true,
  }).returning();
  await reloadCardCache();
  return res.status(201).json(created);
});

router.put("/answers/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { text, isBlank, active } = req.body;
  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "Le texte de la réponse est requis." });
  }
  const [updated] = await db
    .update(answerCardsTable)
    .set({ text: text.trim(), isBlank: isBlank === true, active: active !== false })
    .where(eq(answerCardsTable.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Réponse introuvable." });
  await reloadCardCache();
  return res.json(updated);
});

router.delete("/answers/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const deleted = await db.delete(answerCardsTable).where(eq(answerCardsTable.id, id)).returning();
  if (!deleted.length) return res.status(404).json({ error: "Réponse introuvable." });
  await reloadCardCache();
  return res.json({ success: true });
});

router.get("/undercover-word-pairs", requireAuth, async (_req, res) => {
  const wordPairs = await db.select().from(undercoverWordPairsTable).orderBy(undercoverWordPairsTable.id);
  return res.json(wordPairs);
});

router.post("/undercover-word-pairs", requireAuth, async (req, res) => {
  const { wordCivilian, wordUndercover } = req.body;
  if (!wordCivilian || typeof wordCivilian !== "string" || wordCivilian.trim() === "") {
    return res.status(400).json({ error: "Le mot civil est requis." });
  }
  if (!wordUndercover || typeof wordUndercover !== "string" || wordUndercover.trim() === "") {
    return res.status(400).json({ error: "Le mot undercover est requis." });
  }
  const [created] = await db.insert(undercoverWordPairsTable).values({
    wordCivilian: wordCivilian.trim(),
    wordUndercover: wordUndercover.trim(),
    active: true,
  }).returning();
  await reloadUndercoverWordCache();
  return res.status(201).json(created);
});

router.put("/undercover-word-pairs/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { wordCivilian, wordUndercover, active } = req.body;
  if (!wordCivilian || typeof wordCivilian !== "string" || wordCivilian.trim() === "") {
    return res.status(400).json({ error: "Le mot civil est requis." });
  }
  if (!wordUndercover || typeof wordUndercover !== "string" || wordUndercover.trim() === "") {
    return res.status(400).json({ error: "Le mot undercover est requis." });
  }
  const [updated] = await db
    .update(undercoverWordPairsTable)
    .set({
      wordCivilian: wordCivilian.trim(),
      wordUndercover: wordUndercover.trim(),
      active: active !== false,
    })
    .where(eq(undercoverWordPairsTable.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Groupe de mots introuvable." });
  await reloadUndercoverWordCache();
  return res.json(updated);
});

router.delete("/undercover-word-pairs/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const deleted = await db.delete(undercoverWordPairsTable).where(eq(undercoverWordPairsTable.id, id)).returning();
  if (!deleted.length) return res.status(404).json({ error: "Groupe de mots introuvable." });
  await reloadUndercoverWordCache();
  return res.json({ success: true });
});

router.post("/change-password", requireAuth, async (req: any, res) => {
  const { newCode } = req.body;
  if (!newCode || typeof newCode !== "string" || newCode.length < 6) {
    return res.status(400).json({ error: "Le nouveau code doit faire au moins 6 caractères." });
  }
  const codeHash = await bcrypt.hash(newCode, 10);
  await db.update(adminsTable).set({ codeHash }).where(eq(adminsTable.id, req.adminId));
  return res.json({ success: true });
});

router.post("/change-username", requireAuth, async (req: any, res) => {
  const { username } = req.body;
  if (!username || typeof username !== "string" || username.trim().length < 3) {
    return res.status(400).json({ error: "Le pseudo doit faire au moins 3 caractères." });
  }
  const nextUsername = username.trim();
  const existingAdmins = await db.select().from(adminsTable).where(eq(adminsTable.username, nextUsername));
  if (existingAdmins.some((admin) => admin.id !== req.adminId)) {
    return res.status(409).json({ error: "Ce pseudo est déjà utilisé." });
  }
  const [updated] = await db
    .update(adminsTable)
    .set({ username: nextUsername })
    .where(eq(adminsTable.id, req.adminId))
    .returning();
  if (!updated) return res.status(404).json({ error: "Administrateur introuvable." });
  return res.json({ success: true, username: updated.username });
});

export default router;
