import { db } from "@workspace/db";
import { adminsTable } from "@workspace/db";
import bcrypt from "bcryptjs";

export async function seedIfEmpty(): Promise<void> {
  const existingAdmins = await db.select({ id: adminsTable.id }).from(adminsTable).limit(1);

  if (existingAdmins.length === 0) {
    console.log("[seed] Creating default admin...");
    const defaultCode = "bmc2025!";
    const codeHash = await bcrypt.hash(defaultCode, 10);
    await db.insert(adminsTable).values({ username: "admin", codeHash });
    console.log("[seed] Default admin created: username='admin', code='bmc2025!'");
  }
}
