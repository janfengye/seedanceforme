-- 邀请码表
CREATE TABLE IF NOT EXISTS invitation_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  created_by INTEGER NOT NULL,
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  note TEXT DEFAULT '',
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 邀请码使用记录表
CREATE TABLE IF NOT EXISTS invitation_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (code_id) REFERENCES invitation_codes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invitation_codes_code ON invitation_codes(code);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_created_by ON invitation_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_invitation_usage_code_id ON invitation_usage(code_id);
CREATE INDEX IF NOT EXISTS idx_invitation_usage_user_id ON invitation_usage(user_id);
