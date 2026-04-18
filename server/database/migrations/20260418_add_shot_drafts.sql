CREATE TABLE IF NOT EXISTS shot_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shot_id INTEGER NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  prompt TEXT DEFAULT '',
  tiptap_json TEXT,
  model TEXT DEFAULT '',
  ratio TEXT DEFAULT '',
  duration TEXT DEFAULT '',
  reference_mode TEXT DEFAULT '',
  expires_at DATETIME DEFAULT (datetime('now', '+48 hours')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shot_id) REFERENCES shots(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS shot_draft_files (
  id TEXT PRIMARY KEY,
  draft_id INTEGER NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT DEFAULT '',
  size INTEGER DEFAULT 0,
  file_type TEXT NOT NULL DEFAULT 'image',
  disk_path TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (draft_id) REFERENCES shot_drafts(id) ON DELETE CASCADE
);
