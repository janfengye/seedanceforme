import { getDatabase } from '../database/index.js';

export function getEpisodesByProjectId(projectId) {
  const db = getDatabase();
  return db.prepare(
    'SELECT * FROM episodes WHERE project_id = ? ORDER BY episode_number ASC'
  ).all(projectId);
}

export function getEpisodeById(id) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM episodes WHERE id = ?').get(id);
}

export function createEpisode({ project_id, episode_number, title, description }) {
  const db = getDatabase();
  const stmt = db.prepare(
    'INSERT INTO episodes (project_id, episode_number, title, description) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(project_id, episode_number, title || null, description || null);
  return getEpisodeById(result.lastInsertRowid);
}

export function updateEpisode(id, { episode_number, title, description }) {
  const db = getDatabase();
  const updates = [];
  const values = [];

  if (episode_number !== undefined) { updates.push('episode_number = ?'); values.push(episode_number); }
  if (title !== undefined) { updates.push('title = ?'); values.push(title); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description); }

  if (updates.length === 0) return getEpisodeById(id);

  updates.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE episodes SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return getEpisodeById(id);
}

export function deleteEpisode(id) {
  const db = getDatabase();
  const deleteEp = db.transaction((episodeId) => {
    // 清除关联任务的 shot_id（因为 tasks.shot_id 没有外键约束）
    const shots = db.prepare('SELECT id FROM shots WHERE episode_id = ?').all(episodeId);
    for (const shot of shots) {
      db.prepare('UPDATE tasks SET shot_id = NULL WHERE shot_id = ?').run(shot.id);
    }
    // CASCADE 会自动删除 shots
    db.prepare('DELETE FROM episodes WHERE id = ?').run(episodeId);
  });
  deleteEp(id);
}

/**
 * 获取项目下一个可用的集号
 */
export function getNextEpisodeNumber(projectId) {
  const db = getDatabase();
  const row = db.prepare(
    'SELECT MAX(episode_number) as max_num FROM episodes WHERE project_id = ?'
  ).get(projectId);
  return (row?.max_num || 0) + 1;
}
