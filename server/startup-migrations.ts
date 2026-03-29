import { sql } from "drizzle-orm";
import { db } from "./db";
import { log } from "./vite";

export async function ensureDatabaseCompatibility() {
  await ensureMatchIdColumn();
}

async function ensureMatchIdColumn() {
  try {
    await db.execute(sql.raw(`
      ALTER TABLE games
      ADD COLUMN IF NOT EXISTS match_id text;
    `));

    await db.execute(sql.raw(`
      UPDATE games
      SET match_id = upper(substr(md5(id::text || clock_timestamp()::text || random()::text), 1, 8))
      WHERE match_id IS NULL;
    `));

    await db.execute(sql.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'games_match_id_unique'
        ) THEN
          ALTER TABLE games
          ADD CONSTRAINT games_match_id_unique UNIQUE (match_id);
        END IF;
      END
      $$;
    `));

    await db.execute(sql.raw(`
      ALTER TABLE games
      ALTER COLUMN match_id SET NOT NULL;
    `));

    log("database compatibility ensured: games.match_id");
  } catch (error) {
    log(`database compatibility failed: ${(error as Error).message}`);
    throw error;
  }
}
