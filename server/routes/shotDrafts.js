import { Router } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import * as shotDraftService from '../services/shotDraftService.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// GET /api/shots/:shotId/draft
router.get('/shots/:shotId/draft', authenticate, (req, res) => {
  console.log('[draft] GET /shots/' + req.params.shotId + '/draft by user ' + req.user?.id);
  try {
    const draft = shotDraftService.getDraftByShotId(parseInt(req.params.shotId));
    res.json({ success: true, data: draft });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/shots/:shotId/draft
router.put('/shots/:shotId/draft', authenticate, (req, res) => {
  console.log('[draft] PUT /shots/' + req.params.shotId + '/draft by user ' + req.user?.id, JSON.stringify(req.body).substring(0, 100));
  try {
    const { prompt, tiptapJson, model, ratio, duration, referenceMode, expectedVersion } = req.body;
    const draft = shotDraftService.upsertDraft(parseInt(req.params.shotId), req.user.id, {
      prompt, tiptapJson, model, ratio, duration, referenceMode,
    }, expectedVersion != null ? Number(expectedVersion) : undefined);
    res.json({ success: true, data: draft });
  } catch (error) {
    if (error.code === 'VERSION_CONFLICT') {
      const current = shotDraftService.getDraftByShotId(parseInt(req.params.shotId));
      return res.status(409).json({ error: '草稿已被其他人修改', code: 'VERSION_CONFLICT', data: current });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/shots/:shotId/draft
router.delete('/shots/:shotId/draft', authenticate, (req, res) => {
  try {
    shotDraftService.deleteDraft(parseInt(req.params.shotId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/shots/:shotId/draft/files
router.post('/shots/:shotId/draft/files', authenticate, upload.single('file'), (req, res) => {
  try {
    if (req.file) req.file.originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    console.log('[draft] POST file for shot ' + req.params.shotId + ', file: ' + req.file?.originalname);
    if (!req.file) return res.status(400).json({ error: '未上传文件' });
    const fileType = req.body.fileType || 'image';
    const fileId = req.body.fileId || crypto.randomUUID();
    const draft = shotDraftService.ensureDraft(parseInt(req.params.shotId), req.user.id);
    const fileRecord = shotDraftService.addFile(draft.id, fileId, req.file, fileType);
    res.json({ success: true, data: fileRecord });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/shot-draft-files/:fileId
router.get('/shot-draft-files/:fileId', authenticate, (req, res) => {
  try {
    const fileRecord = shotDraftService.getFileById(req.params.fileId);
    if (!fileRecord) return res.status(404).json({ error: '文件不存在' });
    const filePath = shotDraftService.getFilePath(fileRecord);
    res.setHeader('Content-Type', fileRecord.mime_type || 'application/octet-stream');
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(fileRecord.original_name)}`);
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/shot-draft-files/:fileId
router.delete('/shot-draft-files/:fileId', authenticate, (req, res) => {
  try {
    shotDraftService.deleteFile(req.params.fileId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
