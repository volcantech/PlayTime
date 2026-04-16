import { db } from "@workspace/db";
import { usersTable, questionCardsTable, answerCardsTable, undercoverWordPairsTable, petitBacCategoriesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
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
  const existingUsers = await db.select({ id: usersTable.id }).from(usersTable).limit(1);

  if (existingUsers.length === 0) {
    console.log("[seed] Creating default admin user...");
    const defaultPassword = "bmc2025!";
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    await db.insert(usersTable).values({
      email: "admin@playtime.local",
      username: "admin",
      passwordHash,
      avatar: "👑",
      isAdmin: true,
    });
    console.log("[seed] Default admin: email='admin@playtime.local', username='admin', password='bmc2025!'");
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

  await syncSerialSequences();
}

async function syncSerialSequences(): Promise<void> {
  await db.execute(sql`
    SELECT setval(
      pg_get_serial_sequence('question_cards', 'id'),
      COALESCE((SELECT MAX(id) FROM ${questionCardsTable}), 1),
      (SELECT COUNT(*) > 0 FROM ${questionCardsTable})
    )
  `);
  await db.execute(sql`
    SELECT setval(
      pg_get_serial_sequence('answer_cards', 'id'),
      COALESCE((SELECT MAX(id) FROM ${answerCardsTable}), 1),
      (SELECT COUNT(*) > 0 FROM ${answerCardsTable})
    )
  `);
  await db.execute(sql`
    SELECT setval(
      pg_get_serial_sequence('undercover_word_pairs', 'id'),
      COALESCE((SELECT MAX(id) FROM ${undercoverWordPairsTable}), 1),
      (SELECT COUNT(*) > 0 FROM ${undercoverWordPairsTable})
    )
  `);
  await db.execute(sql`
    SELECT setval(
      pg_get_serial_sequence('petit_bac_categories', 'id'),
      COALESCE((SELECT MAX(id) FROM ${petitBacCategoriesTable}), 1),
      (SELECT COUNT(*) > 0 FROM ${petitBacCategoriesTable})
    )
  `);
}
