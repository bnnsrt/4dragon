-- Insert default Level 1 deposit limit if it doesn't exist
INSERT INTO deposit_limits (name, daily_limit, monthly_limit, created_by)
SELECT 'Level 1', 10000, 10000, id
FROM users 
WHERE email = 'ronnakritnook1@gmail.com'
AND NOT EXISTS (
  SELECT 1 FROM deposit_limits WHERE name = 'Level 1'
)
ON CONFLICT DO NOTHING;

-- Update existing users to use Level 1 limit by default
UPDATE users
SET deposit_limit_id = (
  SELECT id FROM deposit_limits WHERE name = 'Level 1'
)
WHERE deposit_limit_id IS NULL;