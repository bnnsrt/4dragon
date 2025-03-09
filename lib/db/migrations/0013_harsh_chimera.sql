CREATE TABLE IF NOT EXISTS "payment_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"status_name" text,
	"total" numeric NOT NULL,
	"txn_id" text DEFAULT '-' NOT NULL,
	"method" text DEFAULT 'QR_DECIMAL' NOT NULL,
	"amount" numeric DEFAULT '0' NOT NULL,
	"trans_ref" text DEFAULT '-',
	"payment_date" timestamp,
	"merchant_id" text NOT NULL,
	"order_no" text NOT NULL,
	"ref_no" text NOT NULL,
	"product_detail" text,
	"card_type" text,
	"customer_email" text,
	"currency_code" text,
	"installment" integer,
	"post_back_url" text,
	"post_back_parameters" text,
	"post_back_method" text,
	"post_back_completed" boolean,
	"order_date_time" timestamp,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_transactions_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
