import { getDatabase } from '../database/index.js';

/**
 * 数字转版本标签（A-Z, AA-AZ 风格，类似 Excel 列名）
 */
export function numberToVersionLabel(n) {
  let label = '';
  let num = n;
  do {
    label = String.fromCharCode(65 + (num % 26)) + label;
    num = Math.floor(num / 26) - 1;
  } while (num >= 0);
  return label;
}

/**
 * 为已完成的 output 任务分配版本号
 * 调用时机：updateTaskStatus 中 status='done' 且 shot_id 不为空时
 * 并发安全：better-sqlite3 同步 + Node.js 单线程
 */
export function assignVersionLabel(taskId) {
  const db = getDatabase();
  const task = db.prepare('SELECT id, shot_id, user_id, version_label FROM tasks WHERE id = ?').get(taskId);
  if (!task || !task.shot_id) return null;
  if (task.version_label) return task.version_label; // idempotent

  const count = db.prepare(
    'SELECT COUNT(*) as cnt FROM tasks WHERE shot_id = ? AND user_id = ? AND version_label IS NOT NULL'
  ).get(task.shot_id, task.user_id).cnt;

  const label = numberToVersionLabel(count);
  db.prepare('UPDATE tasks SET version_label = ? WHERE id = ?').run(label, taskId);
  return label;
}
