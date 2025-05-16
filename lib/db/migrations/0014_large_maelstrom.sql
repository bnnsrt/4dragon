CREATE TABLE IF NOT EXISTS "minimum_purchase_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"minimum_amount" numeric DEFAULT '0' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "minimum_purchase_settings" ADD CONSTRAINT "minimum_purchase_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
