-- M3+M4: 项目结构改造 + 版本号文件命名
-- 新增 episodes/shots 表，projects 加 code，tasks 加 shot_id/version_label

-- 1. projects 表加 code
ALTER TABLE projects ADD COLUMN code TEXT DEFAULT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_code ON projects(code) WHERE code IS NOT NULL;

-- 2. episodes 表
CREATE TABLE IF NOT EXISTS episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  title TEXT DEFAULT NULL,
  description TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, episode_number)
);
CREATE INDEX IF NOT EXISTS idx_episodes_project_id ON episodes(project_id);

-- 3. shots 表
CREATE TABLE IF NOT EXISTS shots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id INTEGER NOT NULL,
  shot_number INTEGER NOT NULL,
  description TEXT DEFAULT NULL,
  prompt TEXT DEFAULT NULL,
  reference_image_url TEXT DEFAULT NULL,
  preferred_model TEXT DEFAULT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
  UNIQUE(episode_id, shot_number)
);
CREATE INDEX IF NOT EXISTS idx_shots_episode_id ON shots(episode_id);

-- 4. tasks 表扩展
ALTER TABLE tasks ADD COLUMN shot_id INTEGER DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN version_label TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_shot_id ON tasks(shot_id);
CREATE INDEX IF NOT EXISTS idx_tasks_shot_user_version ON tasks(shot_id, user_id) WHERE version_label IS NOT NULL;
