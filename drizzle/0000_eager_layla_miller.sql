CREATE TABLE "games" (
	"id" serial PRIMARY KEY NOT NULL,
	"share_id" text,
	"white_player_id" integer,
	"black_player_id" integer,
	"game_state" jsonb NOT NULL,
	"current_turn" text DEFAULT 'white' NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"rules" jsonb DEFAULT '["standard"]'::jsonb NOT NULL,
	"move_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"captured_pieces" jsonb DEFAULT '{"white":[],"black":[]}'::jsonb NOT NULL,
	"game_start_time" timestamp DEFAULT now(),
	"game_end_time" timestamp,
	"winner" text,
	"draw_offered_by" text,
	CONSTRAINT "games_share_id_unique" UNIQUE("share_id")
);
--> statement-breakpoint
CREATE TABLE "moves" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"move_number" integer NOT NULL,
	"player" text NOT NULL,
	"from" text NOT NULL,
	"to" text NOT NULL,
	"piece" text NOT NULL,
	"captured" text,
	"special" text,
	"fen" text NOT NULL,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
