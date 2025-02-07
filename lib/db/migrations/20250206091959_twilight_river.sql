/*
  # Add deposit limit ID to users table

  1. Changes
    - Add deposit_limit_id column to users table
    - Add foreign key reference to deposit_limits table
*/

ALTER TABLE users 
ADD COLUMN deposit_limit_id integer REFERENCES deposit_limits(id);

-- Set default deposit limit for existing users
UPDATE users 
SET deposit_limit_id = (
  SELECT id 
  FROM deposit_limits 
  WHERE name = 'Level 1' 
  LIMIT 1
)
WHERE deposit_limit_id IS NULL;