import { useState, useEffect, useCallback } from 'react';
import type { Project, EpisodeWithShots, Shot } from '../types/index';
import { getShotTree } from '../services/projectService';

interface ShotSelectorProps {
  projects: Project[];
  selectedProjectId?: number;
  onShotSelect: (shot: Shot | null, meta?: {
    projectCode?: string;
    episodeNumber?: number;
    shotNumber?: number;
  }) => void;
  compact?: boolean;
  className?: string;
}

export default function ShotSelector({
  projects,
  selectedProjectId,
  onShotSelect,
  compact = false,
  className = '',
}: ShotSelectorProps) {
  const [projectId, setProjectId] = useState<number | undefined>(selectedProjectId);
  const [episodeId, setEpisodeId] = useState<number | undefined>();
  const [shotId, setShotId] = useState<number | undefined>();
  const [tree, setTree] = useState<EpisodeWithShots[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载镜头树
  const loadTree = useCallback(async (pid: number) => {
    setLoading(true);
    try {
      const data = await getShotTree(pid);
      setTree(data);
    } catch (e) {
      console.error('加载镜头树失败:', e);
      setTree([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (projectId) {
      loadTree(projectId);
      setEpisodeId(undefined);
      setShotId(undefined);
      onShotSelect(null);
    } else {
      setTree([]);
    }
  }, [projectId]);

  useEffect(() => {
    if (selectedProjectId !== projectId) {
      setProjectId(selectedProjectId);
    }
  }, [selectedProjectId]);

  const selectedEpisode = tree.find(ep => ep.id === episodeId);
  const shots = selectedEpisode?.shots || [];
  const selectedShot = shots.find(s => s.id === shotId);
  const selectedProject = projects.find(p => p.id === projectId);

  const handleEpisodeChange = (eid: number | undefined) => {
    setEpisodeId(eid);
    setShotId(undefined);
    onShotSelect(null);
  };

  const handleShotChange = (sid: number | undefined) => {
    setShotId(sid);
    if (sid) {
      const shot = shots.find(s => s.id === sid);
      if (shot && selectedEpisode && selectedProject) {
        onShotSelect(shot, {
          projectCode: selectedProject.code,
          episodeNumber: selectedEpisode.episode_number,
          shotNumber: shot.shot_number,
        });
      }
    } else {
      onShotSelect(null);
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <select
          value={projectId || ''}
          onChange={e => setProjectId(e.target.value ? Number(e.target.value) : undefined)}
          className="bg-gray-700 text-white rounded px-2 py-1 text-xs"
        >
          <option value="">不关联项目</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ''}</option>
          ))}
        </select>
        {projectId && tree.length > 0 && (
          <select
            value={episodeId || ''}
            onChange={e => handleEpisodeChange(e.target.value ? Number(e.target.value) : undefined)}
            className="bg-gray-700 text-white rounded px-2 py-1 text-xs"
          >
            <option value="">选择集</option>
            {tree.map(ep => (
              <option key={ep.id} value={ep.id}>第 {ep.episode_number} 集{ep.title ? ` - ${ep.title}` : ''}</option>
            ))}
          </select>
        )}
        {episodeId && shots.length > 0 && (
          <select
            value={shotId || ''}
            onChange={e => handleShotChange(e.target.value ? Number(e.target.value) : undefined)}
            className="bg-gray-700 text-white rounded px-2 py-1 text-xs"
          >
            <option value="">选择镜头</option>
            {shots.map(s => (
              <option key={s.id} value={s.id}>镜头 {s.shot_number}{s.description ? ` - ${s.description}` : ''}</option>
            ))}
          </select>
        )}
        {loading && <span className="text-gray-400 text-xs">加载中...</span>}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="text-sm font-medium text-gray-300">关联镜头（可选）</div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs text-gray-400 mb-1">项目</label>
          <select
            value={projectId || ''}
            onChange={e => setProjectId(e.target.value ? Number(e.target.value) : undefined)}
            className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
          >
            <option value="">不关联</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">集</label>
          <select
            value={episodeId || ''}
            onChange={e => handleEpisodeChange(e.target.value ? Number(e.target.value) : undefined)}
            disabled={!projectId || tree.length === 0}
            className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">{loading ? '加载中...' : '选择集'}</option>
            {tree.map(ep => (
              <option key={ep.id} value={ep.id}>第 {ep.episode_number} 集{ep.title ? ` - ${ep.title}` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">镜头</label>
          <select
            value={shotId || ''}
            onChange={e => handleShotChange(e.target.value ? Number(e.target.value) : undefined)}
            disabled={!episodeId || shots.length === 0}
            className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">选择镜头</option>
            {shots.map(s => (
              <option key={s.id} value={s.id}>镜头 {s.shot_number}{s.description ? ` - ${s.description}` : ''}</option>
            ))}
          </select>
        </div>
      </div>
      {selectedShot && (
        <div className="bg-gray-700/50 rounded p-3 text-xs space-y-1">
          {selectedShot.prompt && (
            <div className="text-gray-300">
              <span className="text-gray-500">提示词：</span>{selectedShot.prompt.substring(0, 100)}
              {selectedShot.prompt.length > 100 ? '...' : ''}
            </div>
          )}
          {selectedShot.preferred_model && (
            <div className="text-gray-300">
              <span className="text-gray-500">推荐模型：</span>{selectedShot.preferred_model}
            </div>
          )}
          {selectedProject?.code && selectedEpisode && (
            <div className="text-blue-400">
              文件名预览：{selectedProject.code}-{selectedEpisode.episode_number}-{selectedShot.shot_number}-?-用户昵称.mp4
            </div>
          )}
        </div>
      )}
    </div>
  );
}
