import { getDatabase } from '../database/index.js';

function sanitizeForFilename(str) {
  if (!str) return '';
  return str.replace(/[^\w\u4e00-\u9fff-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

/**
 * 构建规范文件名：{项目代号}-{集数}-{镜头号}-{版本号}-{用户昵称}.mp4
 */
export function buildStandardFilename(task) {
  const { project_code, episode_number, shot_number, version_label, nickname, username } = task;
  if (!project_code || episode_number == null || shot_number == null || !version_label) return null;

  const displayName = nickname || username || null;
  if (!displayName) return null;

  const safeName = sanitizeForFilename(displayName);
  if (!safeName) return null;

  return `${project_code}-${episode_number}-${shot_number}-${version_label}-${safeName}.mp4`;
}

export function buildFallbackFilename(taskId) {
  return `video_${taskId}_${Date.now()}.mp4`;
}

/**
 * 查询任务的文件名所需信息
 */
export const FILENAME_QUERY = `
  SELECT
    t.id,
    t.version_label,
    p.code AS project_code,
    e.episode_number,
    s.shot_number,
    u.nickname,
    u.username
  FROM tasks t
  LEFT JOIN shots s ON t.shot_id = s.id
  LEFT JOIN episodes e ON s.episode_id = e.id
  LEFT JOIN projects p ON e.project_id = p.id
  LEFT JOIN users u ON t.user_id = u.id
  WHERE t.id = ?
`;

/**
 * 获取任务的规范文件名
 */
export function getFilenameForTask(taskId) {
  const db = getDatabase();
  const row = db.prepare(FILENAME_QUERY).get(taskId);
  if (!row) return buildFallbackFilename(taskId);
  return buildStandardFilename(row) || buildFallbackFilename(taskId);
}
