CREATE TABLE IF NOT EXISTS "trading_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"is_open" boolean DEFAULT true NOT NULL,
	"message" text DEFAULT '',
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trading_status" ADD CONSTRAINT "trading_status_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
