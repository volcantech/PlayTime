import { db } from "@workspace/db";
import { adminsTable, undercoverWordPairsTable, petitBacCategoriesTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { DEFAULT_UNDERCOVER_WORD_PAIRS } from "./undercoverWordCache";

const DEFAULT_PETIT_BAC_CATEGORIES = [
  "Prénom",
  "Ville / Pays",
  "Animal",
  "Métier",
  "Objet",
  "Personnage célèbre",
  "Nourriture / Boisson",
  "Marque",
];

export async function seedIfEmpty(): Promise<void> {
  const existingAdmins = await db.select({ id: adminsTable.id }).from(adminsTable).limit(1);

  if (existingAdmins.length === 0) {
    console.log("[seed] Creating default admin...");
    const defaultCode = "bmc2025!";
    const codeHash = await bcrypt.hash(defaultCode, 10);
    await db.insert(adminsTable).values({ username: "admin", codeHash });
    console.log("[seed] Default admin created: username='admin', code='bmc2025!'");
  }

  const existingWordPairs = await db.select({ id: undercoverWordPairsTable.id }).from(undercoverWordPairsTable).limit(1);
  if (existingWordPairs.length === 0) {
    await db.insert(undercoverWordPairsTable).values(
      DEFAULT_UNDERCOVER_WORD_PAIRS.map(([wordCivilian, wordUndercover]) => ({
        wordCivilian,
        wordUndercover,
        active: true,
      })),
    );
    console.log(`[seed] Created ${DEFAULT_UNDERCOVER_WORD_PAIRS.length} Undercover word pairs.`);
  }

  const existingPBCategories = await db.select({ id: petitBacCategoriesTable.id }).from(petitBacCategoriesTable).limit(1);
  if (existingPBCategories.length === 0) {
    await db.insert(petitBacCategoriesTable).values(
      DEFAULT_PETIT_BAC_CATEGORIES.map(name => ({ name, active: true })),
    );
    console.log(`[seed] Created ${DEFAULT_PETIT_BAC_CATEGORIES.length} Petit Bac categories.`);
  }
}
