/*
  # Add minimum purchase settings table

  1. New Tables
    - `minimum_purchase_settings`
      - `id` (serial, primary key)
      - `minimum_amount` (decimal) - Minimum purchase amount
      - `updated_at` (timestamp) - Last update timestamp
      - `updated_by` (integer, foreign key) - Admin who updated the setting
*/

CREATE TABLE IF NOT EXISTS minimum_purchase_settings (
  id serial PRIMARY KEY,
  minimum_amount decimal NOT NULL DEFAULT '0',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by integer REFERENCES users(id)
);

-- Insert default setting
INSERT INTO minimum_purchase_settings (minimum_amount, updated_by)
SELECT 0, id
FROM users 
WHERE email = 'ronnakritnook1@gmail.com'
LIMIT 1
ON CONFLICT DO NOTHING;