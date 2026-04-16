DROP TABLE IF EXISTS users_new;

CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nickname TEXT DEFAULT NULL,
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  credits INTEGER DEFAULT 10,
  daily_check_in INTEGER DEFAULT 0,
  last_check_in_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  username TEXT
);

INSERT INTO users_new (id, email, password_hash, nickname, role, status, credits, daily_check_in, last_check_in_at, created_at, updated_at, username)
SELECT id, email, password_hash, nickname, role, status, credits, daily_check_in, last_check_in_at, created_at, updated_at, username FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

UPDATE users SET role = 'super_admin' WHERE email = 'admin@seedance.com';
