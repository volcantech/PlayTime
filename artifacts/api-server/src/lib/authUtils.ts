import crypto from "crypto";

const SESSION_SECRET = process.env["SESSION_SECRET"] || "bmc-secret-fallback";

export function signUserToken(userId: number): string {
  const ts = Date.now();
  const payload = `${userId}:${ts}`;
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyUserToken(token: string): number | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return null;
    const [idStr, tsStr, sig] = parts;
    const payload = `${idStr}:${tsStr}`;
    const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
    if (sig !== expectedSig) return null;
    const ts = Number(tsStr);
    if (Date.now() - ts > 30 * 24 * 60 * 60 * 1000) return null;
    return Number(idStr);
  } catch {
    return null;
  }
}

export function requireUserAuth(req: any, res: any, next: any) {
  const auth = req.headers["authorization"] as string | undefined;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Non autorisé" });
  }
  const token = auth.slice(7);
  const userId = verifyUserToken(token);
  if (!userId) {
    return res.status(401).json({ error: "Token invalide ou expiré" });
  }
  req.userId = userId;
  next();
}
