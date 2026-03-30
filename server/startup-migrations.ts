import { sql } from "drizzle-orm";
import { db } from "./db";
import { log } from "./vite";

export async function ensureDatabaseCompatibility() {
  await ensureMatchIdColumn();
  await ensureClockColumns();
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

async function ensureClockColumns() {
  try {
    await db.execute(sql.raw(`
      ALTER TABLE games
      ADD COLUMN IF NOT EXISTS time_control_seconds integer,
      ADD COLUMN IF NOT EXISTS clock_state jsonb;
    `));

    await db.execute(sql.raw(`
      UPDATE games
      SET time_control_seconds = 300
      WHERE time_control_seconds IS NULL;
    `));

    await db.execute(sql.raw(`
      UPDATE games
      SET clock_state = jsonb_build_object(
        'whiteRemainingMs', time_control_seconds * 1000,
        'blackRemainingMs', time_control_seconds * 1000,
        'activeColor', NULL,
        'lastUpdatedAt', NULL,
        'isPaused', true
      )
      WHERE clock_state IS NULL;
    `));

    await db.execute(sql.raw(`
      ALTER TABLE games
      ALTER COLUMN time_control_seconds SET DEFAULT 300,
      ALTER COLUMN time_control_seconds SET NOT NULL,
      ALTER COLUMN clock_state SET NOT NULL;
    `));

    await db.execute(sql.raw(`
      ALTER TABLE moves
      ADD COLUMN IF NOT EXISTS clock_state jsonb;
    `));

    log("database compatibility ensured: games.clock_state, games.time_control_seconds, moves.clock_state");
  } catch (error) {
    log(`database clock compatibility failed: ${(error as Error).message}`);
    throw error;
  }
}