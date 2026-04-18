import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import * as shotService from '../services/shotService.js';
import * as episodeService from '../services/episodeService.js';
import * as projectService from '../services/projectService.js';

const router = Router();

// GET /api/episodes/:episodeId/shots — 登录用户
router.get('/episodes/:episodeId/shots', authenticate, (req, res) => {
  try {
    const episode = episodeService.getEpisodeById(req.params.episodeId);
    if (!episode) {
      return res.status(404).json({ error: '集不存在' });
    }
    const shots = shotService.getShotsByEpisodeId(req.params.episodeId);
    res.json({ success: true, data: shots });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/projects/:projectId/shot-tree — 登录用户（获取完整的集→镜头树）
router.get('/projects/:projectId/shot-tree', authenticate, (req, res) => {
  try {
    const project = projectService.getProjectById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }
    const tree = shotService.getShotTree(parseInt(req.params.projectId));
    res.json({ success: true, data: tree });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/shots/:id — 登录用户（获取镜头详情，含集和项目信息）
router.get('/shots/:id', authenticate, (req, res) => {
  try {
    const shot = shotService.getShotById(req.params.id);
    if (!shot) {
      return res.status(404).json({ error: '镜头不存在' });
    }
    // Enrich with episode and project info
    const episode = episodeService.getEpisodeById(shot.episode_id);
    let projectCode, projectId, episodeNumber;
    if (episode) {
      episodeNumber = episode.episode_number;
      projectId = episode.project_id;
      const project = projectService.getProjectById(episode.project_id);
      if (project) {
        projectCode = project.code;
      }
    }
    res.json({
      success: true,
      data: {
        ...shot,
        episode_number: episodeNumber,
        project_id: projectId,
        project_code: projectCode,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/shots/:id/versions — 登录用户（获取镜头版本列表）
router.get('/shots/:id/versions', authenticate, (req, res) => {
  try {
    const shot = shotService.getShotById(req.params.id);
    if (!shot) {
      return res.status(404).json({ error: '镜头不存在' });
    }
    const versions = shotService.getShotVersions(req.params.id);
    res.json({ success: true, data: versions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/episodes/:episodeId/shots — 管理员
router.post('/episodes/:episodeId/shots', authenticate, (req, res) => {
  try {
    const episode = episodeService.getEpisodeById(req.params.episodeId);
    if (!episode) {
      return res.status(404).json({ error: '集不存在' });
    }
    const { shot_number, description, prompt, reference_image_url, preferred_model } = req.body;
    const shotNum = shot_number || shotService.getNextShotNumber(parseInt(req.params.episodeId));
    const shot = shotService.createShot({
      episode_id: parseInt(req.params.episodeId),
      shot_number: shotNum,
      description,
      prompt,
      reference_image_url,
      preferred_model,
    });
    res.json({ success: true, data: shot });
  } catch (error) {
    if (error.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: '该镜头号已存在' });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/shots/:id — 管理员
router.put('/shots/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const shot = shotService.getShotById(req.params.id);
    if (!shot) {
      return res.status(404).json({ error: '镜头不存在' });
    }
    const { shot_number, description, prompt, reference_image_url, preferred_model, status } = req.body;
    const updated = shotService.updateShot(req.params.id, {
      shot_number, description, prompt, reference_image_url, preferred_model, status,
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    if (error.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: '该镜头号已存在' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/shots/:id — 管理员
router.delete('/shots/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const shot = shotService.getShotById(req.params.id);
    if (!shot) {
      return res.status(404).json({ error: '镜头不存在' });
    }
    shotService.deleteShot(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
