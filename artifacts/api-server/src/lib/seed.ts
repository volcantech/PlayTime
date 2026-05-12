import { db } from "@workspace/db";
import { usersTable, questionCardsTable, answerCardsTable, undercoverWordPairsTable, petitBacCategoriesTable, guessWhoCharactersTable } from "@workspace/db";
import type { GWTraits } from "@workspace/db";
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

  const existingGWChars = await db.select({ id: guessWhoCharactersTable.id }).from(guessWhoCharactersTable).limit(1);
  if (existingGWChars.length === 0) {
    const DEFAULT_GW_CHARACTERS: { name: string; emoji: string; traits: GWTraits }[] = [
      { name: "Alice", emoji: "👩", traits: { gender: "femme", hair_color: "blond", hair_length: "long", glasses: false, hat: false, beard: false, earrings: true } },
      { name: "Bernard", emoji: "👨", traits: { gender: "homme", hair_color: "brun", hair_length: "court", glasses: false, hat: false, beard: true, earrings: false } },
      { name: "Camille", emoji: "👱‍♀️", traits: { gender: "femme", hair_color: "blond", hair_length: "court", glasses: true, hat: false, beard: false, earrings: false } },
      { name: "David", emoji: "🧔", traits: { gender: "homme", hair_color: "brun", hair_length: "court", glasses: false, hat: true, beard: true, earrings: false } },
      { name: "Emma", emoji: "👩‍🦰", traits: { gender: "femme", hair_color: "roux", hair_length: "long", glasses: false, hat: false, beard: false, earrings: true } },
      { name: "François", emoji: "👨‍🦳", traits: { gender: "homme", hair_color: "gris", hair_length: "court", glasses: true, hat: false, beard: false, earrings: false } },
      { name: "Gabrielle", emoji: "👩‍🦱", traits: { gender: "femme", hair_color: "brun", hair_length: "long", glasses: false, hat: true, beard: false, earrings: true } },
      { name: "Hugo", emoji: "👨‍🦲", traits: { gender: "homme", hair_color: "chauve", hair_length: undefined, glasses: false, hat: false, beard: false, earrings: false } },
      { name: "Isabelle", emoji: "👩‍🦳", traits: { gender: "femme", hair_color: "gris", hair_length: "court", glasses: true, hat: false, beard: false, earrings: true } },
      { name: "Jacques", emoji: "🧑", traits: { gender: "homme", hair_color: "brun", hair_length: "long", glasses: false, hat: false, beard: false, earrings: true } },
      { name: "Karine", emoji: "👩", traits: { gender: "femme", hair_color: "brun", hair_length: "court", glasses: false, hat: true, beard: false, earrings: false } },
      { name: "Louis", emoji: "👨", traits: { gender: "homme", hair_color: "blond", hair_length: "court", glasses: true, hat: false, beard: false, earrings: false } },
      { name: "Marie", emoji: "👩‍🦰", traits: { gender: "femme", hair_color: "roux", hair_length: "court", glasses: true, hat: false, beard: false, earrings: true } },
      { name: "Nicolas", emoji: "🧔", traits: { gender: "homme", hair_color: "roux", hair_length: "long", glasses: false, hat: false, beard: true, earrings: false } },
      { name: "Olivia", emoji: "👱‍♀️", traits: { gender: "femme", hair_color: "blond", hair_length: "long", glasses: false, hat: true, beard: false, earrings: true } },
      { name: "Pierre", emoji: "👨‍🦳", traits: { gender: "homme", hair_color: "gris", hair_length: "court", glasses: false, hat: true, beard: true, earrings: false } },
      { name: "Quentin", emoji: "👨", traits: { gender: "homme", hair_color: "brun", hair_length: "court", glasses: true, hat: false, beard: false, earrings: true } },
      { name: "Rachel", emoji: "👩‍🦱", traits: { gender: "femme", hair_color: "brun", hair_length: "long", glasses: true, hat: false, beard: false, earrings: false } },
      { name: "Samuel", emoji: "👨‍🦰", traits: { gender: "homme", hair_color: "roux", hair_length: "court", glasses: false, hat: false, beard: true, earrings: false } },
      { name: "Théa", emoji: "👩", traits: { gender: "femme", hair_color: "gris", hair_length: "long", glasses: false, hat: false, beard: false, earrings: true } },
      { name: "Ulysse", emoji: "👨‍🦲", traits: { gender: "homme", hair_color: "chauve", hair_length: undefined, glasses: true, hat: false, beard: false, earrings: true } },
      { name: "Valérie", emoji: "👩", traits: { gender: "femme", hair_color: "blond", hair_length: "court", glasses: false, hat: false, beard: false, earrings: true } },
      { name: "William", emoji: "🧔", traits: { gender: "homme", hair_color: "blond", hair_length: "long", glasses: false, hat: true, beard: true, earrings: false } },
      { name: "Xena", emoji: "👩‍🦳", traits: { gender: "femme", hair_color: "gris", hair_length: "court", glasses: true, hat: true, beard: false, earrings: false } },
    ];
    await db.insert(guessWhoCharactersTable).values(
      DEFAULT_GW_CHARACTERS.map(c => ({ name: c.name, emoji: c.emoji, traits: c.traits, active: true })),
    );
    console.log(`[seed] Created ${DEFAULT_GW_CHARACTERS.length} Qui est-ce characters.`);
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
