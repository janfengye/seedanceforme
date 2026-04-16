ALTER TABLE users ADD COLUMN username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
UPDATE users SET username = 'admin' WHERE email = 'admin@seedance.com' AND username IS NULL;
