import { getDatabase } from '../database/index.js';

export function getShotsByEpisodeId(episodeId) {
  const db = getDatabase();
  return db.prepare(
    'SELECT * FROM shots WHERE episode_id = ? ORDER BY shot_number ASC'
  ).all(episodeId);
}

export function getShotById(id) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM shots WHERE id = ?').get(id);
}

export function createShot({ episode_id, shot_number, description, prompt, reference_image_url, preferred_model }) {
  const db = getDatabase();
  const stmt = db.prepare(
    'INSERT INTO shots (episode_id, shot_number, description, prompt, reference_image_url, preferred_model) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(
    episode_id, shot_number,
    description || null, prompt || null,
    reference_image_url || null, preferred_model || null
  );
  return getShotById(result.lastInsertRowid);
}

export function updateShot(id, { shot_number, description, prompt, reference_image_url, preferred_model, status }) {
  const db = getDatabase();
  const updates = [];
  const values = [];

  if (shot_number !== undefined) { updates.push('shot_number = ?'); values.push(shot_number); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description); }
  if (prompt !== undefined) { updates.push('prompt = ?'); values.push(prompt); }
  if (reference_image_url !== undefined) { updates.push('reference_image_url = ?'); values.push(reference_image_url); }
  if (preferred_model !== undefined) { updates.push('preferred_model = ?'); values.push(preferred_model); }
  if (status !== undefined) { updates.push('status = ?'); values.push(status); }

  if (updates.length === 0) return getShotById(id);

  updates.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE shots SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return getShotById(id);
}

export function deleteShot(id) {
  const db = getDatabase();
  const del = db.transaction((shotId) => {
    db.prepare('UPDATE tasks SET shot_id = NULL WHERE shot_id = ?').run(shotId);
    db.prepare('DELETE FROM shots WHERE id = ?').run(shotId);
  });
  del(id);
}

/**
 * 获取集下一个可用的镜头号
 */
export function getNextShotNumber(episodeId) {
  const db = getDatabase();
  const row = db.prepare(
    'SELECT MAX(shot_number) as max_num FROM shots WHERE episode_id = ?'
  ).get(episodeId);
  return (row?.max_num || 0) + 1;
}

/**
 * 获取项目的完整镜头树：episodes → shots
 */
export function getShotTree(projectId) {
  const db = getDatabase();
  const episodes = db.prepare(
    'SELECT * FROM episodes WHERE project_id = ? ORDER BY episode_number ASC'
  ).all(projectId);

  return episodes.map(ep => ({
    ...ep,
    shots: db.prepare(
      "SELECT * FROM shots WHERE episode_id = ? AND status = 'active' ORDER BY shot_number ASC"
    ).all(ep.id)
  }));
}

/**
 * 获取镜头的版本列表
 */
export function getShotVersions(shotId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT t.id, t.user_id, t.version_label, t.status, t.video_url, t.created_at,
           u.nickname, u.username
    FROM tasks t
    LEFT JOIN users u ON t.user_id = u.id
    WHERE t.shot_id = ? AND t.version_label IS NOT NULL
    ORDER BY t.created_at ASC
  `).all(shotId);
}
