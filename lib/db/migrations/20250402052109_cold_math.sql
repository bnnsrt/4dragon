/*
  # Add trading status table

  1. New Tables
    - `trading_status`
      - `id` (serial, primary key)
      - `is_open` (boolean) - Whether trading is open or closed
      - `message` (text) - Message to display when trading is closed
      - `updated_at` (timestamp) - When the status was last updated
      - `updated_by` (integer, foreign key) - Admin who updated the status
*/

CREATE TABLE IF NOT EXISTS trading_status (
  id serial PRIMARY KEY,
  is_open boolean NOT NULL DEFAULT true,
  message text DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by integer REFERENCES users(id)
);

-- Insert default record if none exists
INSERT INTO trading_status (is_open, message)
SELECT true, 'Trading is open'
WHERE NOT EXISTS (SELECT 1 FROM trading_status);