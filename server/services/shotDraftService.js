import { getDatabase } from '../database/index.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRAFT_FILES_DIR = path.join(__dirname, '..', 'data', 'draft-files');

export function getDraftByShotId(shotId) {
  const db = getDatabase();
  const draft = db.prepare(
    "SELECT * FROM shot_drafts WHERE shot_id = ? AND expires_at > datetime('now')"
  ).get(shotId);
  if (!draft) return null;
  const files = db.prepare('SELECT * FROM shot_draft_files WHERE draft_id = ?').all(draft.id);
  return { ...draft, files };
}

export function upsertDraft(shotId, userId, data, expectedVersion) {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM shot_drafts WHERE shot_id = ?').get(shotId);
  if (existing) {
    let sql = `
      UPDATE shot_drafts SET
        prompt = ?, tiptap_json = ?, model = ?, ratio = ?, duration = ?, reference_mode = ?,
        expires_at = datetime('now', '+30 days'), updated_at = CURRENT_TIMESTAMP,
        version = version + 1
      WHERE shot_id = ?
    `;
    const params = [
      data.prompt ?? existing.prompt,
      (data.tiptapJson != null ? JSON.stringify(data.tiptapJson) : existing.tiptap_json),
      data.model ?? existing.model,
      data.ratio ?? existing.ratio,
      data.duration ?? existing.duration,
      data.referenceMode ?? existing.reference_mode,
      shotId
    ];
    if (expectedVersion != null) {
      sql += ' AND version = ?';
      params.push(expectedVersion);
    }
    const result = db.prepare(sql).run(...params);
    if (expectedVersion != null && result.changes === 0) {
      const err = new Error('VERSION_CONFLICT');
      err.code = 'VERSION_CONFLICT';
      throw err;
    }
    return db.prepare('SELECT * FROM shot_drafts WHERE shot_id = ?').get(shotId);
  }
  const result = db.prepare(`
    INSERT INTO shot_drafts (shot_id, user_id, prompt, tiptap_json, model, ratio, duration, reference_mode, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+30 days'))
  `).run(
    shotId, userId,
    data.prompt ?? '', (data.tiptapJson != null ? JSON.stringify(data.tiptapJson) : null),
    data.model ?? '', data.ratio ?? '',
    data.duration ?? '', data.referenceMode ?? ''
  );
  return db.prepare('SELECT * FROM shot_drafts WHERE id = ?').get(result.lastInsertRowid);
}

export function deleteDraft(shotId) {
  const db = getDatabase();
  const draft = db.prepare('SELECT * FROM shot_drafts WHERE shot_id = ?').get(shotId);
  if (!draft) return;
  const files = db.prepare('SELECT * FROM shot_draft_files WHERE draft_id = ?').all(draft.id);
  db.prepare('DELETE FROM shot_draft_files WHERE draft_id = ?').run(draft.id);
  db.prepare('DELETE FROM shot_drafts WHERE id = ?').run(draft.id);
  for (const file of files) {
    const count = db.prepare('SELECT COUNT(*) as cnt FROM shot_draft_files WHERE disk_path = ?').get(file.disk_path);
    if (count.cnt === 0) {
      const absPath = path.join(__dirname, '..', '..', file.disk_path);
      if (fs.existsSync(absPath)) {
        fs.unlinkSync(absPath);
      }
    }
  }
}

export function addFile(draftId, fileId, file, fileType) {
  const db = getDatabase();
  const ext = path.extname(file.originalname);
  const contentHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const blobDir = path.join(DRAFT_FILES_DIR, 'blobs');
  const fileName = contentHash + ext;
  const absPath = path.join(blobDir, fileName);
  fs.mkdirSync(blobDir, { recursive: true });
  if (!fs.existsSync(absPath)) {
    fs.writeFileSync(absPath, file.buffer);
  }
  const diskPath = path.relative(path.join(__dirname, '..', '..'), absPath);
  db.prepare(`
    INSERT OR REPLACE INTO shot_draft_files (id, draft_id, original_name, mime_type, size, file_type, disk_path, content_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(fileId, draftId, file.originalname, file.mimetype, file.size, fileType, diskPath, contentHash);
  return db.prepare('SELECT * FROM shot_draft_files WHERE id = ?').get(fileId);
}

export function getFileById(fileId) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM shot_draft_files WHERE id = ?').get(fileId);
}

export function getFilePath(fileRecord) {
  return path.join(__dirname, '..', '..', fileRecord.disk_path);
}

export function deleteFile(fileId) {
  const db = getDatabase();
  const file = db.prepare('SELECT * FROM shot_draft_files WHERE id = ?').get(fileId);
  if (!file) return;
  db.prepare('DELETE FROM shot_draft_files WHERE id = ?').run(fileId);
  const count = db.prepare('SELECT COUNT(*) as cnt FROM shot_draft_files WHERE disk_path = ?').get(file.disk_path);
  if (count.cnt === 0) {
    const absPath = path.join(__dirname, '..', '..', file.disk_path);
    if (fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
    }
  }
}

export function ensureDraft(shotId, userId) {
  const db = getDatabase();
  const existing = db.prepare(
    "SELECT * FROM shot_drafts WHERE shot_id = ? AND expires_at > datetime('now')"
  ).get(shotId);
  if (existing) return existing;
  const result = db.prepare(`
    INSERT INTO shot_drafts (shot_id, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))
  `).run(shotId, userId);
  return db.prepare('SELECT * FROM shot_drafts WHERE id = ?').get(result.lastInsertRowid);
}

export function cleanOrphanFiles() {
  const db = getDatabase();
  const dbPaths = new Set(
    db.prepare('SELECT DISTINCT disk_path FROM shot_draft_files').all().map(r => r.disk_path)
  );
  const blobDir = path.join(DRAFT_FILES_DIR, 'blobs');
  if (fs.existsSync(blobDir)) {
    for (const fileName of fs.readdirSync(blobDir)) {
      const absPath = path.join(blobDir, fileName);
      const relPath = path.relative(path.join(__dirname, '..', '..'), absPath);
      if (!dbPaths.has(relPath)) {
        console.log('[cleanup] removing orphan file:', relPath);
        fs.unlinkSync(absPath);
      }
    }
  }
  if (fs.existsSync(DRAFT_FILES_DIR)) {
    for (const entry of fs.readdirSync(DRAFT_FILES_DIR)) {
      if (entry === 'blobs') continue;
      const dirPath = path.join(DRAFT_FILES_DIR, entry);
      if (fs.statSync(dirPath).isDirectory()) {
        console.log('[cleanup] removing legacy draft dir:', entry);
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    }
  }
}

export function cleanExpiredDrafts() {
  const db = getDatabase();
  const expired = db.prepare(
    "SELECT id FROM shot_drafts WHERE expires_at <= datetime('now')"
  ).all();
  for (const draft of expired) {
    db.prepare('DELETE FROM shot_draft_files WHERE draft_id = ?').run(draft.id);
  }
  db.prepare("DELETE FROM shot_drafts WHERE expires_at <= datetime('now')").run();
  cleanOrphanFiles();
}
