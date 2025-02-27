/*
  # Add verification codes table

  1. New Tables
    - `verification_codes`
      - `id` (serial, primary key)
      - `email` (varchar) - Email address the code was sent to
      - `code` (varchar) - The verification code
      - `expires_at` (timestamp) - When the code expires
      - `created_at` (timestamp) - When the code was created

  2. Security
    - Enable RLS on `verification_codes` table
*/

CREATE TABLE IF NOT EXISTS verification_codes (
  id serial PRIMARY KEY,
  email varchar(255) NOT NULL,
  code varchar(4) NOT NULL,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert verification codes"
  ON verification_codes
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can read their own verification codes"
  ON verification_codes
  FOR SELECT
  TO public
  USING (email = current_user);