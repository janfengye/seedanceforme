import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project, AspectRatio } from '../types/index';
import { RATIO_OPTIONS } from '../types/index';
import { getProjects, createProject, deleteProject, updateProject } from '../services/projectService';
import { PlusIcon } from '../components/Icons';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/Toast';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCode, setNewCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [newRatio, setNewRatio] = useState<AspectRatio | null>(null);
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const { showToast } = useToast();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editRatio, setEditRatio] = useState<AspectRatio | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadProjects = async () => {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (e) {
      console.error('加载项目失败:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjects(); }, []);

  const handleCreate = async () => {
    if (!newName.trim() || !newRatio) return;
    setCreating(true);
    try {
      await createProject(newName.trim(), newDesc.trim() || undefined, { ratio: newRatio }, newCode.trim() || undefined);
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      setNewCode('');
      setNewRatio(null);
      loadProjects();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenSettings = (project: Project) => {
    try {
      const settings = project.settings_json ? JSON.parse(project.settings_json) : {};
      setEditRatio(settings.ratio || null);
    } catch { setEditRatio(null); }
    setEditingProjectId(project.id);
  };

  const handleSaveProjectSettings = async () => {
    if (!editingProjectId || !editRatio) return;
    setSavingSettings(true);
    try {
      await updateProject(editingProjectId, { settings: { ratio: editRatio } });
      showToast('项目画幅已更新', 'success');
      setEditingProjectId(null);
      loadProjects();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确定删除项目「${name}」？此操作不可撤销。`)) return;
    try {
      await deleteProject(id);
      loadProjects();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleEnterProject = (id: number) => {
    localStorage.setItem('seedance_last_project', String(id));
    navigate(`/projects/${id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin text-purple-500 mb-4">
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-gray-400">加载项目...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">项目列表</h1>
          <p className="text-gray-400 text-sm mt-1">选择一个项目开始工作</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/generate')}
            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 transition-colors"
          >
            快速生成
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              新建项目
            </button>
          )}
        </div>
      </div>

      {/* 创建项目表单 */}
      {showCreate && (
        <div className="bg-[#1c1f2e] rounded-xl p-6 mb-6 border border-gray-700">
          <h3 className="text-white font-medium mb-4">新建项目</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">项目名称 *</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="例：我的短片"
                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">项目代号</label>
              <input
                value={newCode}
                onChange={e => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="如 SN（用于文件命名）"
                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                maxLength={10}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">描述</label>
              <input
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="项目简介（可选）"
                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs text-gray-400 mb-2">画幅比例 *</label>
            <div className="flex gap-2 flex-wrap">
              {RATIO_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setNewRatio(opt.value)}
                  className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                    newRatio === opt.value
                      ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                      : 'border-gray-600 bg-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {!newRatio && <p className="text-xs text-yellow-500 mt-1">请选择画幅比例，创建后不可更改</p>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || !newRatio || creating}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? '创建中...' : '创建'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName(''); setNewDesc(''); setNewCode(''); setNewRatio(null); }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-500"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 项目卡片 */}
      {projects.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h3 className="text-gray-400 text-lg mb-2">还没有项目</h3>
          <p className="text-gray-500 text-sm mb-6">
            {isAdmin ? '创建你的第一个项目来组织镜头和生成任务' : '等待管理员创建项目'}
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              创建第一个项目
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => {
            const ep = (project as any).episode_count as number | undefined;
            const sh = (project as any).shot_count as number | undefined;
            return (
              <div
                key={project.id}
                onClick={() => handleEnterProject(project.id)}
                className="bg-[#1c1f2e] rounded-xl p-5 border border-gray-800 hover:border-purple-500/50 cursor-pointer transition-all hover:shadow-lg hover:shadow-purple-500/5 group"
              >
                {/* 头部 */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center flex-none">
                      <span className="text-purple-400 font-bold text-sm">
                        {project.code || project.name[0]?.toUpperCase() || 'P'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-white font-medium group-hover:text-purple-300 transition-colors truncate">{project.name}</h3>
                      {project.code && (
                        <span className="text-xs text-gray-500 font-mono">{project.code}</span>
                      )}
                      {(() => { try { const s = project.settings_json ? JSON.parse(project.settings_json) : null; return s?.ratio ? <span className="text-xs text-purple-400/60 ml-1">{s.ratio}</span> : null; } catch { return null; } })()}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => { e.stopPropagation(); handleOpenSettings(project); }}
                        className="text-gray-600 hover:text-purple-400 p-1"
                        title="项目设置"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(project.id, project.name); }}
                        className="text-gray-600 hover:text-red-400 p-1"
                        title="删除项目"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* 描述 */}
                {project.description && (
                  <p className="text-gray-400 text-sm mb-3 line-clamp-2">{project.description}</p>
                )}

                {/* 统计数据 */}
                <div className="flex items-center gap-3 flex-wrap">
                  {typeof ep === 'number' && ep > 0 && (
                    <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">
                      {ep} 集
                    </span>
                  )}
                  {typeof sh === 'number' && sh > 0 && (
                    <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded">
                      {sh} 个镜头
                    </span>
                  )}
                  {typeof project.task_count === 'number' && project.task_count > 0 && (
                    <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded">
                      {project.completed_count || 0}/{project.task_count} 已生成
                    </span>
                  )}
                  {(!ep || ep === 0) && (!sh || sh === 0) && (!project.task_count || project.task_count === 0) && (
                    <span className="text-xs text-gray-600">空项目</span>
                  )}
                  <span className="text-xs text-gray-600 ml-auto">{new Date(project.updated_at).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 项目设置弹窗 */}
      {editingProjectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditingProjectId(null)}>
          <div className="bg-[#1c1f2e] rounded-2xl p-6 w-full max-w-md border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold text-lg mb-1">项目设置</h3>
            <p className="text-gray-400 text-sm mb-5">
              {projects.find(p => p.id === editingProjectId)?.name}
            </p>
            <div className="mb-6">
              <label className="block text-sm text-gray-300 mb-3 font-medium">画幅比例</label>
              <div className="grid grid-cols-3 gap-2">
                {RATIO_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setEditRatio(opt.value)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border transition-all ${
                      editRatio === opt.value
                        ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                        : 'border-gray-600 bg-gray-700/50 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-center w-8 h-8">
                      <div
                        className={`rounded-sm border ${editRatio === opt.value ? 'border-purple-400' : 'border-gray-500'}`}
                        style={{
                          width: `${(opt.widthRatio / Math.max(opt.widthRatio, opt.heightRatio)) * 24}px`,
                          height: `${(opt.heightRatio / Math.max(opt.widthRatio, opt.heightRatio)) * 24}px`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveProjectSettings}
                disabled={!editRatio || savingSettings}
                className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-500 disabled:opacity-50 transition-colors"
              >
                {savingSettings ? '保存中...' : '保存'}
              </button>
              <button
                onClick={() => setEditingProjectId(null)}
                className="flex-1 py-2.5 bg-gray-700 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
