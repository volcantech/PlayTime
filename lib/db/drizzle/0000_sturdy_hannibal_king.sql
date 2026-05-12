CREATE TABLE "question_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"blanks" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_adult" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "answer_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"is_blank" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_adult" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"avatar" text DEFAULT '🐱' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "game_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"game_mode" text NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "game_stats_user_mode_unique" UNIQUE("user_id","game_mode")
);
--> statement-breakpoint
CREATE TABLE "undercover_word_pairs" (
	"id" serial PRIMARY KEY NOT NULL,
	"word_civilian" text NOT NULL,
	"word_undercover" text NOT NULL,
	"words" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petit_bac_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_key" varchar(32) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "game_settings_game_key_unique" UNIQUE("game_key")
);
--> statement-breakpoint
CREATE TABLE "custom_avatars" (
	"id" serial PRIMARY KEY NOT NULL,
	"emoji" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_avatars_emoji_unique" UNIQUE("emoji")
);
--> statement-breakpoint
CREATE TABLE "guess_who_characters" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"emoji" text DEFAULT '🧑' NOT NULL,
	"traits" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_stats" ADD CONSTRAINT "game_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;