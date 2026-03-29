ALTER TABLE "games"
ADD COLUMN IF NOT EXISTS "match_id" text;
--> statement-breakpoint
UPDATE "games"
SET "match_id" = upper(substr(md5("id"::text || clock_timestamp()::text || random()::text), 1, 8))
WHERE "match_id" IS NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'games_match_id_unique'
  ) THEN
    ALTER TABLE "games"
    ADD CONSTRAINT "games_match_id_unique" UNIQUE("match_id");
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "games"
ALTER COLUMN "match_id" SET NOT NULL;
