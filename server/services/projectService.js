import { getDatabase } from '../database/index.js';

/**
 * 项目服务层
 * 负责项目的 CRUD 操作
 */

/**
 * 获取所有项目（支持用户过滤）
 * @param {number|null} userId - 用户 ID，null 表示获取全部（管理员）
 * @param {boolean} isAdmin - 是否管理员，true 时忽略 userId 过滤
 */
export function getAllProjects(userId = null, isAdmin = false) {
  const db = getDatabase();

  let query = `
    SELECT
      p.*,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as completed_count
    FROM projects p
  `;

  // 项目是团队共享资源，所有登录用户都可查看
  query += ` ORDER BY p.updated_at DESC`;

  const stmt = db.prepare(query);
  return stmt.all();
}

/**
 * 根据 ID 获取项目（支持权限检查）
 * @param {number} id - 项目 ID
 * @param {number|null} userId - 用户 ID，用于权限检查
 * @param {boolean} isAdmin - 是否管理员
 */
export function getProjectById(id, userId = null, isAdmin = false) {
  const db = getDatabase();

  let query = `
    SELECT
      p.*,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as completed_count
    FROM projects p
    WHERE p.id = ?
  `;

  const params = [id];

  // 项目是团队共享资源，所有登录用户都可查看
  const stmt = db.prepare(query);
  return stmt.get(...params);
}

/**
 * 创建项目
 */
export function createProject({ name, description, settings = {}, code, user_id }) {
  const db = getDatabase();

  if (!user_id) {
    throw new Error('创建项目时必须指定 user_id');
  }

  const stmt = db.prepare(`
    INSERT INTO projects (name, description, settings_json, code, user_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(name, description, JSON.stringify(settings), code || null, user_id);
  return getProjectById(result.lastInsertRowid);
}

/**
 * 更新项目
 */
export function updateProject(id, { name, description, settings, code }) {
  const db = getDatabase();

  const updates = [];
  const values = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  if (settings !== undefined) {
    updates.push('settings_json = ?');
    values.push(JSON.stringify(settings));
  }
  if (code !== undefined) {
    updates.push('code = ?');
    values.push(code || null);
  }

  if (updates.length === 0) {
    return getProjectById(id);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const stmt = db.prepare(`
    UPDATE projects
    SET ${updates.join(', ')}
    WHERE id = ?
  `);
  stmt.run(...values);

  return getProjectById(id);
}

/**
 * 删除项目
 */
export function deleteProject(id) {
  const db = getDatabase();
  const stmt = db.prepare(`DELETE FROM projects WHERE id = ?`);
  return stmt.run(id);
}

/**
 * 获取项目下的任务列表（支持权限检查）
 * @param {number} projectId - 项目 ID
 * @param {object} options - 查询选项
 * @param {number|null} userId - 用户 ID，用于权限检查
 * @param {boolean} isAdmin - 是否管理员
 */
export function getTasksByProjectId(projectId, options = {}, userId = null, isAdmin = false) {
  const db = getDatabase();
  const { status, limit = 100, offset = 0 } = options;

  // 项目是团队共享资源，只需确认项目存在
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    throw new Error('项目不存在');
  }

  let query = `
    SELECT * FROM tasks
    WHERE project_id = ?
  `;

  const params = [projectId];

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const stmt = db.prepare(query);
  return stmt.all(...params);
}

export default {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getTasksByProjectId,
};
