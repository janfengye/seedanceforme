import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Project, EpisodeWithShots, ShotVersion, User } from '../types/index';
import { MODEL_OPTIONS } from '../types/index';
import {
  getProject, updateProject,
  getShotTree, getShotVersions,
  createEpisode, deleteEpisode,
  createShot, deleteShot,
} from '../services/projectService';

interface Props {
  currentUser: User | null;
}

export default function ProjectDetailPage({ currentUser }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [tree, setTree] = useState<EpisodeWithShots[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<number>>(new Set());
  const [selectedShotId, setSelectedShotId] = useState<number | null>(null);
  const [versions, setVersions] = useState<ShotVersion[]>([]);

  // 编辑状态
  const [editingCode, setEditingCode] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [addingEpisode, setAddingEpisode] = useState(false);
  const [newEpTitle, setNewEpTitle] = useState('');
  const [addingShotToEp, setAddingShotToEp] = useState<number | null>(null);
  const [newShotPrompt, setNewShotPrompt] = useState('');
  const [newShotDesc, setNewShotDesc] = useState('');
  const [newShotModel, setNewShotModel] = useState('');

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const projectId = Number(id);

  const loadData = useCallback(async () => {
    try {
      const [proj, shotTree] = await Promise.all([
        getProject(projectId),
        getShotTree(projectId),
      ]);
      setProject(proj);
      setTree(shotTree);
      setCodeInput(proj.code || '');
      // 默认展开所有集
      if (shotTree.length > 0) {
        setExpandedEpisodes(prev => {
          if (prev.size === 0) return new Set(shotTree.map(ep => ep.id));
          return prev;
        });
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (selectedShotId) {
      getShotVersions(selectedShotId).then(setVersions).catch(() => setVersions([]));
    } else {
      setVersions([]);
    }
  }, [selectedShotId]);

  const toggleEpisode = (epId: number) => {
    const next = new Set(expandedEpisodes);
    if (next.has(epId)) next.delete(epId); else next.add(epId);
    setExpandedEpisodes(next);
  };

  const handleSaveCode = async () => {
    if (!project) return;
    try {
      await updateProject(project.id, { code: codeInput.trim() || undefined });
      setEditingCode(false);
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleAddEpisode = async () => {
    try {
      await createEpisode(projectId, { title: newEpTitle || undefined });
      setAddingEpisode(false);
      setNewEpTitle('');
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteEpisode = async (epId: number) => {
    if (!confirm('确定删除此集？下属所有镜头也会被删除。')) return;
    try {
      await deleteEpisode(epId);
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleAddShot = async (episodeId: number) => {
    try {
      await createShot(episodeId, {
        description: newShotDesc || undefined,
        prompt: newShotPrompt || undefined,
        preferred_model: newShotModel || undefined,
      });
      setAddingShotToEp(null);
      setNewShotPrompt('');
      setNewShotDesc('');
      setNewShotModel('');
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteShot = async (shotId: number) => {
    if (!confirm('确定删除此镜头？已关联的任务将取消关联。')) return;
    try {
      await deleteShot(shotId);
      if (selectedShotId === shotId) setSelectedShotId(null);
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCreateFromShot = (shotId: number) => {
    navigate(`/generate?shotId=${shotId}`);
  };

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400">加载中...</div>;
  if (!project) return <div className="flex items-center justify-center h-full text-gray-400">项目不存在</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white text-sm mb-2 flex items-center gap-1">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6" /></svg>
            返回项目列表
          </button>
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          {project.description && <p className="text-gray-400 text-sm mt-1">{project.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {editingCode ? (
            <>
              <input
                value={codeInput}
                onChange={e => setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="项目代号（如 SN）"
                className="bg-gray-700 text-white rounded px-3 py-1.5 text-sm w-32"
                maxLength={10}
              />
              <button onClick={handleSaveCode} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">保存</button>
              <button onClick={() => setEditingCode(false)} className="px-3 py-1.5 bg-gray-600 text-white rounded text-sm">取消</button>
            </>
          ) : (
            <>
              <span className="text-gray-400 text-sm">代号：</span>
              <span className="text-white font-mono">{project.code || '未设置'}</span>
              {isAdmin && (
                <button onClick={() => setEditingCode(true)} className="text-blue-400 text-sm hover:underline">编辑</button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 集/镜头树 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">集 / 镜头</h2>
          {isAdmin && (
            <button
              onClick={() => setAddingEpisode(true)}
              className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              + 添加新集
            </button>
          )}
        </div>

        {addingEpisode && (
          <div className="bg-gray-800 rounded-lg p-4 flex items-center gap-3">
            <input
              value={newEpTitle}
              onChange={e => setNewEpTitle(e.target.value)}
              placeholder="集标题（可选）"
              className="bg-gray-700 text-white rounded px-3 py-2 text-sm flex-1"
            />
            <button onClick={handleAddEpisode} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">创建</button>
            <button onClick={() => setAddingEpisode(false)} className="px-4 py-2 bg-gray-600 text-white rounded text-sm">取消</button>
          </div>
        )}

        {tree.length === 0 && !addingEpisode && (
          <div className="text-center text-gray-500 py-8">
            暂无集数据{isAdmin ? '，点击上方按钮添加' : ''}
          </div>
        )}

        {tree.map(ep => (
          <div key={ep.id} className="bg-gray-800 rounded-lg overflow-hidden">
            {/* 集标题行 */}
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-750"
              onClick={() => toggleEpisode(ep.id)}
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-400">{expandedEpisodes.has(ep.id) ? '▼' : '▶'}</span>
                <span className="text-white font-medium">第 {ep.episode_number} 集</span>
                {ep.title && <span className="text-gray-400">— {ep.title}</span>}
                <span className="text-gray-500 text-xs">({ep.shots?.length || 0} 个镜头)</span>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setAddingShotToEp(addingShotToEp === ep.id ? null : ep.id)}
                    className="text-green-400 text-xs hover:underline"
                  >
                    + 镜头
                  </button>
                  <button
                    onClick={() => handleDeleteEpisode(ep.id)}
                    className="text-red-400 text-xs hover:underline"
                  >
                    删除集
                  </button>
                </div>
              )}
            </div>

            {/* 添加镜头表单 */}
            {addingShotToEp === ep.id && (
              <div className="px-4 pb-3 space-y-2 border-t border-gray-700 pt-3">
                <div className="grid grid-cols-3 gap-2">
                  <input
                    value={newShotDesc}
                    onChange={e => setNewShotDesc(e.target.value)}
                    placeholder="镜头描述"
                    className="bg-gray-700 text-white rounded px-3 py-2 text-sm"
                  />
                  <input
                    value={newShotPrompt}
                    onChange={e => setNewShotPrompt(e.target.value)}
                    placeholder="预设提示词"
                    className="bg-gray-700 text-white rounded px-3 py-2 text-sm"
                  />
                  <select
                    value={newShotModel}
                    onChange={e => setNewShotModel(e.target.value)}
                    className="bg-gray-700 text-white rounded px-3 py-2 text-sm"
                  >
                    <option value="">推荐模型（可选）</option>
                    {MODEL_OPTIONS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAddShot(ep.id)} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">创建镜头</button>
                  <button onClick={() => setAddingShotToEp(null)} className="px-3 py-1.5 bg-gray-600 text-white rounded text-sm">取消</button>
                </div>
              </div>
            )}

            {/* 镜头列表 */}
            {expandedEpisodes.has(ep.id) && (
              <div className="border-t border-gray-700">
                {(!ep.shots || ep.shots.length === 0) ? (
                  <div className="text-center text-gray-500 py-4 text-sm">暂无镜头</div>
                ) : (
                  ep.shots.map(shot => (
                    <div
                      key={shot.id}
                      className={`flex items-center justify-between px-6 py-2.5 hover:bg-gray-750 cursor-pointer ${
                        selectedShotId === shot.id ? 'bg-gray-700' : ''
                      }`}
                      onClick={() => setSelectedShotId(selectedShotId === shot.id ? null : shot.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-blue-400 font-mono text-sm">#{shot.shot_number}</span>
                        {shot.description && <span className="text-gray-300 text-sm">{shot.description}</span>}
                        {shot.preferred_model && (
                          <span className="text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded">{shot.preferred_model}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleCreateFromShot(shot.id)}
                          className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors"
                          title="跳转到生成页并关联此镜头"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                          创作
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteShot(shot.id)}
                            className="text-red-400 text-xs hover:underline"
                          >
                            删除
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 版本列表 */}
      {selectedShotId && versions.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-white font-medium mb-3">版本历史</h3>
          <div className="space-y-2">
            {versions.map(v => (
              <div key={v.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-blue-400 font-mono">{v.version_label}</span>
                  <span className="text-gray-300">{v.nickname || v.username}</span>
                  <span className={`text-xs ${v.status === 'done' ? 'text-green-400' : 'text-gray-500'}`}>{v.status}</span>
                </div>
                <span className="text-gray-500 text-xs">{new Date(v.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
