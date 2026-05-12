import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signUserToken, verifyUserToken, requireUserAuth } from "../lib/authUtils";

const router = Router();

router.post("/register", async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "Email invalide." });
  }
  if (!username || typeof username !== "string" || username.trim().length < 3) {
    return res.status(400).json({ error: "Le pseudo doit faire au moins 3 caractères." });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Le mot de passe doit faire au moins 6 caractères." });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedUsername = username.trim();

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(or(eq(usersTable.email, normalizedEmail), eq(usersTable.username, normalizedUsername)));

  if (existing.length > 0) {
    return res.status(409).json({ error: "Email ou pseudo déjà utilisé." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    email: normalizedEmail,
    username: normalizedUsername,
    passwordHash,
    avatar: "🐱",
    isAdmin: false,
  }).returning({ id: usersTable.id, username: usersTable.username, email: usersTable.email, avatar: usersTable.avatar, isAdmin: usersTable.isAdmin });

  const token = signUserToken(user.id);
  return res.status(201).json({ token, user });
});

router.post("/login", async (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).json({ error: "Identifiant et mot de passe requis." });
  }

  const normalizedLogin = login.trim().toLowerCase();
  const users = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.email, normalizedLogin), eq(usersTable.username, login.trim())));

  if (users.length === 0) {
    return res.status(401).json({ error: "Identifiants incorrects." });
  }

  const user = users[0];
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Identifiants incorrects." });
  }

  const token = signUserToken(user.id);
  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      isAdmin: user.isAdmin,
    },
  });
});

router.get("/me", requireUserAuth, async (req: any, res) => {
  const users = await db
    .select({ id: usersTable.id, username: usersTable.username, email: usersTable.email, avatar: usersTable.avatar, isAdmin: usersTable.isAdmin })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId));

  if (users.length === 0) {
    return res.status(404).json({ error: "Utilisateur introuvable." });
  }
  return res.json(users[0]);
});

router.put("/profile", requireUserAuth, async (req: any, res) => {
  const { avatar, currentPassword, newPassword } = req.body;

  const users = await db.select().from(usersTable).where(eq(usersTable.id, req.userId));
  if (users.length === 0) {
    return res.status(404).json({ error: "Utilisateur introuvable." });
  }
  const user = users[0];

  const updates: Partial<typeof usersTable.$inferInsert> = {};

  if (avatar && typeof avatar === "string" && avatar.trim()) {
    updates.avatar = avatar.trim();
  }

  if (newPassword) {
    if (!currentPassword) {
      return res.status(400).json({ error: "Le mot de passe actuel est requis pour en choisir un nouveau." });
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Mot de passe actuel incorrect." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit faire au moins 6 caractères." });
    }
    updates.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "Aucune modification à effectuer." });
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.userId))
    .returning({ id: usersTable.id, username: usersTable.username, email: usersTable.email, avatar: usersTable.avatar, isAdmin: usersTable.isAdmin });

  return res.json(updated);
});

export default router;
