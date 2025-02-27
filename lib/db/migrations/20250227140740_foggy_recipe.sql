/*
  # Add verification codes table for email verification

  1. New Tables
    - `verification_codes`
      - `id` (serial, primary key)
      - `email` (varchar) - Email address the code was sent to
      - `code` (varchar) - The 4-digit verification code
      - `expires_at` (timestamp) - When the code expires
      - `created_at` (timestamp) - When the code was created
*/

CREATE TABLE IF NOT EXISTS "verification_codes" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" varchar(255) NOT NULL,
  "code" varchar(4) NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Create index on email and expires_at for faster lookups
CREATE INDEX IF NOT EXISTS "verification_codes_email_expires_at_idx" 
ON "verification_codes" ("email", "expires_at");

-- Add cleanup function to remove expired codes
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM "verification_codes" WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically cleanup expired codes
CREATE OR REPLACE FUNCTION trigger_cleanup_expired_verification_codes()
RETURNS trigger AS $$
BEGIN
  PERFORM cleanup_expired_verification_codes();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cleanup_expired_codes_trigger
    AFTER INSERT ON "verification_codes"
    EXECUTE FUNCTION trigger_cleanup_expired_verification_codes();