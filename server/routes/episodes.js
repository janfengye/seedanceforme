import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import * as episodeService from '../services/episodeService.js';
import * as projectService from '../services/projectService.js';

const router = Router();

// GET /api/projects/:projectId/episodes — 登录用户
router.get('/projects/:projectId/episodes', authenticate, (req, res) => {
  try {
    const project = projectService.getProjectById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }
    const episodes = episodeService.getEpisodesByProjectId(req.params.projectId);
    res.json({ success: true, data: episodes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/projects/:projectId/episodes — 管理员
router.post('/projects/:projectId/episodes', authenticate, (req, res) => {
  try {
    const project = projectService.getProjectById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }
    const { episode_number, title, description } = req.body;
    const epNum = episode_number || episodeService.getNextEpisodeNumber(req.params.projectId);
    const episode = episodeService.createEpisode({
      project_id: parseInt(req.params.projectId),
      episode_number: epNum,
      title,
      description,
    });
    res.json({ success: true, data: episode });
  } catch (error) {
    if (error.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: '该集号已存在' });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/episodes/:id — 管理员
router.put('/episodes/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const episode = episodeService.getEpisodeById(req.params.id);
    if (!episode) {
      return res.status(404).json({ error: '集不存在' });
    }
    const { episode_number, title, description } = req.body;
    const updated = episodeService.updateEpisode(req.params.id, { episode_number, title, description });
    res.json({ success: true, data: updated });
  } catch (error) {
    if (error.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: '该集号已存在' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/episodes/:id — 管理员
router.delete('/episodes/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const episode = episodeService.getEpisodeById(req.params.id);
    if (!episode) {
      return res.status(404).json({ error: '集不存在' });
    }
    episodeService.deleteEpisode(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
