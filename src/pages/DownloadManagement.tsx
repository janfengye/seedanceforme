import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as downloadService from '../services/downloadService';
import { triggerBrowserDownload } from '../services/downloadService';
import { getProjects } from '../services/projectService';
import { useToast } from '../components/Toast';

const parseUTC = (dateStr: string) => new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
import type { DownloadTask, Project, TaskConfig } from '../types/index';
import VideoPreviewModal, { VideoHoverPreview } from '../components/VideoPreviewModal';

interface DownloadState {
  tasks: DownloadTask[];
  total: number;
  page: number;
  pageSize: number;
  statusFilter: string;
  sourceFilter: string;
  projectFilter: number | null;
  creatorFilter: number | null;
  dateFrom: string;
  dateTo: string;
  selectedTaskIds: number[];
  isLoading: boolean;
  downloadingIds: Set<number>;
}

interface GeneratingTask {
  taskId: number;
  historyId: string;
  createdAt: string;
  elapsedSeconds: number;
}

export default function DownloadManagementPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [state, setState] = useState<DownloadState>({
    tasks: [],
    total: 0,
    page: 1,
    pageSize: 20,
    statusFilter: 'all',
    sourceFilter: 'all',
    projectFilter: null,
    creatorFilter: null,
    dateFrom: '',
    dateTo: '',
    selectedTaskIds: [],
    isLoading: false,
    downloadingIds: new Set(),
  });

  const { tasks, total, page, pageSize, statusFilter, sourceFilter, projectFilter, creatorFilter, dateFrom, dateTo, selectedTaskIds, isLoading, downloadingIds } = state;

  const [previewTask, setPreviewTask] = useState<DownloadTask | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [creators, setCreators] = useState<Array<{ id: number; nickname: string; username: string }>>([]);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [expandedConfig, setExpandedConfig] = useState<TaskConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);

  // 轮询引用
  const pollIntervalRef = useRef<number | null>(null);
  const hasInitializedRef = useRef(false);
  const [generatingTasks, setGeneratingTasks] = useState<GeneratingTask[]>([]);

  // Load projects list
  useEffect(() => {
    getProjects().then(setProjects).catch(console.error);
    downloadService.getCreators().then(setCreators).catch(console.error);
  }, []);

  const toGeneratingTasks = (items: Array<{ taskId: number; historyId: string; createdAt: string }> = []) =>
    items.map((task) => ({
      taskId: task.taskId,
      historyId: task.historyId,
      createdAt: task.createdAt,
      elapsedSeconds: Math.floor((Date.now() - parseUTC(task.createdAt).getTime()) / 1000),
    }));

  // 手动添加单个任务到轮询列表
  const handleWatchTask = (taskId: number, historyId: string, createdAt: string) => {
    setGeneratingTasks((prev) => {
      if (prev.some((t) => t.taskId === taskId)) {
        return prev;
      }
      return [
        ...prev,
        {
          taskId,
          historyId,
          createdAt,
          elapsedSeconds: Math.floor((Date.now() - parseUTC(createdAt).getTime()) / 1000),
        },
      ];
    });
  };

  // 加载下载任务列表
  const loadTasks = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const result = await downloadService.getDownloadTasks(statusFilter, 'all', page, pageSize, projectFilter ?? undefined, sourceFilter, creatorFilter ?? undefined, dateFrom || undefined, dateTo || undefined);
      setState((prev) => ({
        ...prev,
        tasks: result.tasks,
        total: result.total,
        isLoading: false,
      }));
    } catch (error) {
      showToast(`加载任务列表失败：${error instanceof Error ? error.message : error}`, 'error');
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [statusFilter, sourceFilter, page, pageSize, projectFilter, creatorFilter, dateFrom, dateTo, showToast]);

  const refreshGeneratingState = useCallback(async ({
    showSummary = false,
    showCompletedNotice = false,
    silentError = false,
  }: {
    showSummary?: boolean;
    showCompletedNotice?: boolean;
    silentError?: boolean;
  } = {}) => {
    try {
      const result = await downloadService.refreshDownloadTasks();
      setGeneratingTasks(toGeneratingTasks(result.generatingTasks ?? []));
      await loadTasks();

      if (showSummary) {
        showToast(`刷新完成：已更新 ${result.refreshed} 个任务，${result.generating || 0} 个任务仍在生成中`, 'success');
      } else if (showCompletedNotice && result.refreshed > 0) {
        showToast(`有 ${result.refreshed} 个视频已生成完成！`, 'success');
      }

      return result;
    } catch (error) {
      if (!silentError) {
        showToast(`刷新失败：${error instanceof Error ? error.message : error}`, 'error');
      }
      throw error;
    }
  }, [loadTasks, showToast]);

  useEffect(() => {
    const initializeOrLoad = async () => {
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        try {
          await refreshGeneratingState({ silentError: true });
        } catch (error) {
          console.error('初始化刷新失败:', error);
          await loadTasks();
        }
        return;
      }

      await loadTasks();
    };

    void initializeOrLoad();
  }, [loadTasks, refreshGeneratingState]);

  // 刷新任务列表（获取已生成的视频）
  const handleRefresh = async () => {
    try {
      await refreshGeneratingState({ showSummary: true });
    } catch (error) {
      console.error('手动刷新失败:', error);
    }
  };

  // 轮询生成中的任务
  const pollGeneratingTasks = useCallback(async () => {
    if (generatingTasks.length === 0) return;

    try {
      await refreshGeneratingState({ showCompletedNotice: true, silentError: true });
    } catch (error) {
      console.error('轮询失败:', error);
    }
  }, [generatingTasks.length, refreshGeneratingState]);

  // 启动轮询
  useEffect(() => {
    if (generatingTasks.length > 0) {
      pollGeneratingTasks();
      pollIntervalRef.current = window.setInterval(pollGeneratingTasks, 5000);
    }

    return () => {
      if (pollIntervalRef.current !== null) {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [generatingTasks.length, pollGeneratingTasks]);

  // 从即梦平台同步
  const handleSyncFromJimeng = async () => {
    if (!confirm('确定要从即梦平台同步所有已生成的视频记录吗？\n\n这将会把即梦平台上的所有作品添加到本地任务列表。')) {
      return;
    }

    try {
      const result = await downloadService.syncFromJimeng();
      showToast(`同步完成！扫描 ${result.totalScanned || result.total} 条历史，发现 ${result.total} 条视频，成功同步 ${result.synced} 条`, 'success');
      loadTasks();
    } catch (error) {
      showToast(`同步失败：${error instanceof Error ? error.message : error}`, 'error');
    }
  };

  // 计算生成时长
  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs.toString().padStart(2, '0')}秒`;
  };

  const formatDuration = (createdAt: string, completedAt?: string) => {
    if (!completedAt) return null;
    const dur = Math.floor((parseUTC(completedAt).getTime() - parseUTC(createdAt).getTime()) / 1000);
    if (dur < 0) return null;
    const m = Math.floor(dur / 60);
    const s = dur % 60;
    return m > 0 ? `${m}分${s.toString().padStart(2, '0')}秒` : `${s}秒`;
  };

  const withDownloadingState = async (taskId: number, action: () => Promise<void>) => {
    if (downloadingIds.has(taskId)) return;

    setState((prev) => ({
      ...prev,
      downloadingIds: new Set(prev.downloadingIds).add(taskId),
    }));

    try {
      await action();
    } finally {
      setState((prev) => {
        const newSet = new Set(prev.downloadingIds);
        newSet.delete(taskId);
        return { ...prev, downloadingIds: newSet };
      });
    }
  };

  const handleDownload = async (task: DownloadTask) => {
    await withDownloadingState(task.id, async () => {
      try {
        const videoUrl = task.video_url;
        if (!videoUrl) { showToast('视频URL不存在', 'error'); return; }
        const proxyUrl = `/api/video-proxy?url=${encodeURIComponent(videoUrl)}&download=1&taskId=${task.id}`;
        triggerBrowserDownload(proxyUrl, `video_${task.id}.mp4`);
      } catch (error) {
        showToast(`下载失败：${error instanceof Error ? error.message : error}`, 'error');
      }
    });
  };

  const handleBrowserDownload = async (task: DownloadTask) => {
    await withDownloadingState(task.id, async () => {
      try {
        if (task.video_url) {
          const proxyUrl = `/api/video-proxy?url=${encodeURIComponent(task.video_url)}&download=1&taskId=${task.id}`;
          triggerBrowserDownload(proxyUrl, `video_${task.id}.mp4`);
        } else {
          await downloadService.downloadLocalVideoFile(task.id, `video_${task.id}.mp4`);
        }
      } catch (error) {
        showToast(`下载到本地失败：${error instanceof Error ? error.message : error}`, 'error');
      }
    });
  };

  // 批量下载
  const handleBatchDownload = async () => {
    if (selectedTaskIds.length === 0) {
      showToast('请先选择要下载的任务', 'error');
      return;
    }

    try {
      const results = await downloadService.batchDownloadVideos(selectedTaskIds);
      const successCount = results.filter((r) => r.success).length;
      showToast(`批量下载完成：成功 ${successCount} 个，失败 ${results.length - successCount} 个`, successCount > 0 ? 'success' : 'error');
      loadTasks();
    } catch (error) {
      showToast(`批量下载失败：${error instanceof Error ? error.message : error}`, 'error');
    }
  };

  // 下载全部待下载
  const handleDownloadAllPending = async () => {
    const pendingIds = tasks
      .filter((t) => t.effective_download_status === 'pending' && !!t.video_url)
      .map((t) => t.id);
    if (pendingIds.length === 0) {
      showToast('没有待下载的任务', 'error');
      return;
    }

    try {
      const results = await downloadService.batchDownloadVideos(pendingIds);
      const successCount = results.filter((r) => r.success).length;
      showToast(`下载完成：成功 ${successCount} 个，失败 ${results.length - successCount} 个`, successCount > 0 ? 'success' : 'error');
      loadTasks();
    } catch (error) {
      showToast(`批量下载失败：${error instanceof Error ? error.message : error}`, 'error');
    }
  };

  // 打开文件夹
  const handleOpenFolder = async (taskId: number) => {
    try {
      await downloadService.openVideoFolder(taskId);
    } catch (error) {
      showToast(`打开文件夹失败：${error instanceof Error ? error.message : error}`, 'error');
    }
  };

  // 删除任务
  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('确定要删除此任务吗？')) return;

    try {
      await downloadService.deleteTask(taskId);
      loadTasks();
    } catch (error) {
      showToast(`删除任务失败：${error instanceof Error ? error.message : error}`, 'error');
    }
  };

  // 展开任务详情
  const handleToggleExpand = async (taskId: number) => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
      setExpandedConfig(null);
      return;
    }
    setExpandedTaskId(taskId);
    setExpandedConfig(null);
    setConfigLoading(true);
    try {
      const config = await downloadService.getTaskConfig(taskId);
      setExpandedConfig(config);
    } catch {
      setExpandedConfig(null);
    } finally {
      setConfigLoading(false);
    }
  };

  // 切换任务选择
  const toggleTaskSelection = (taskId: number) => {
    setState((prev) => ({
      ...prev,
      selectedTaskIds: prev.selectedTaskIds.includes(taskId)
        ? prev.selectedTaskIds.filter((id) => id !== taskId)
        : [...prev.selectedTaskIds, taskId],
    }));
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedTaskIds.length === tasks.length) {
      setState((prev) => ({ ...prev, selectedTaskIds: [] }));
    } else {
      setState((prev) => ({
        ...prev,
        selectedTaskIds: tasks.map((t) => t.id),
      }));
    }
  };

  // Build shot label
  const getShotLabel = (task: DownloadTask) => {
    const parts: string[] = [];
    if (task.project_name) parts.push(task.project_name);
    if (task.episode_number != null && task.shot_number != null) {
      parts.push(`S${task.episode_number}E${task.episode_number}-${String(task.shot_number).padStart(3, '0')}`);
    }
    if (task.version_label) parts.push(task.version_label);
    return parts.length > 0 ? parts.join(' · ') : null;
  };

  // Stats counts
  const statCounts = {
    all: total,
    generating: tasks.filter((t) => t.effective_download_status === 'generating').length,
    pending: tasks.filter((t) => t.effective_download_status === 'pending').length,
    done: tasks.filter((t) => t.effective_download_status === 'done').length,
  };

  // 分页
  const totalPages = Math.ceil(total / pageSize);

  // Action buttons per status
  const renderActions = (task: DownloadTask) => {
    const status = task.effective_download_status;
    const btnClass = (color: string) =>
      `px-2 py-0.5 rounded text-xs font-medium transition-colors ${color}`;

    const btns: React.ReactNode[] = [];

    if (status === 'generating' && task.history_id) {
      btns.push(
        <button key="watch" onClick={(e) => { e.stopPropagation(); handleWatchTask(task.id, task.history_id!, task.created_at); }}
          className={btnClass('text-yellow-400 hover:bg-yellow-500/20')}>监听</button>
      );
    }

    if (status === 'pending' && task.video_url) {
      btns.push(
        <button key="dl" onClick={(e) => { e.stopPropagation(); handleDownload(task); }} disabled={downloadingIds.has(task.id)}
          className={btnClass('text-blue-400 hover:bg-blue-500/20 disabled:opacity-50')}>
          {downloadingIds.has(task.id) ? '下载中...' : '下载'}
        </button>
      );
    }

    if (status === 'done') {
      btns.push(
        <button key="save" onClick={(e) => { e.stopPropagation(); handleBrowserDownload(task); }} disabled={downloadingIds.has(task.id)}
          className={btnClass('text-blue-400 hover:bg-blue-500/20 disabled:opacity-50')}>
          {downloadingIds.has(task.id) ? '保存中...' : '保存'}
        </button>
      );
      if (task.video_path) {
        btns.push(
          <button key="open" onClick={(e) => { e.stopPropagation(); handleOpenFolder(task.id); }}
            className={btnClass('text-green-400 hover:bg-green-500/20')}>打开</button>
        );
      }
    }

    // 重新生成: for pending, done, failed
    if (status === 'pending' || status === 'done' || status === 'failed') {
      btns.push(
        <button key="regen" onClick={(e) => { e.stopPropagation(); navigate(`/generate?from_task=${task.id}`); }}
          className={btnClass('text-orange-400 hover:bg-orange-500/20')}>重新生成</button>
      );
    }

    // 删除: all statuses
    btns.push(
      <button key="del" onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
        className={btnClass('text-red-400 hover:bg-red-500/20')}>删除</button>
    );

    return <div className="flex gap-1 justify-end flex-wrap">{btns}</div>;
  };

  const statCards: Array<{ key: string; label: string; count: number; icon: React.ReactNode }> = [
    { key: 'all', label: '总任务', count: statCounts.all, icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> },
    { key: 'generating', label: '生成中', count: statCounts.generating, icon: <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> },
    { key: 'pending', label: '待下载', count: statCounts.pending, icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg> },
    { key: 'done', label: '已下载', count: statCounts.done, icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto bg-[#0f111a] min-h-screen">
      {/* 标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">下载管理</h1>
        <p className="text-gray-400 text-sm mt-1">
          管理已完成任务的下载与结果文件
          {generatingTasks.length > 0 && (
            <span className="ml-2 text-yellow-400">
              · 正在监听 {generatingTasks.length} 个生成中的任务
            </span>
          )}
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        {statCards.map((card) => (
          <button
            key={card.key}
            onClick={() => setState((prev) => ({ ...prev, statusFilter: card.key, page: 1 }))}
            className={`bg-[#1c1f2e] border rounded-lg p-4 flex items-center gap-3 transition-colors text-left ${
              statusFilter === card.key ? 'border-purple-500' : 'border-gray-800 hover:border-gray-600'
            }`}
          >
            <div className={`${statusFilter === card.key ? 'text-purple-400' : 'text-gray-400'}`}>{card.icon}</div>
            <div>
              <div className="text-2xl font-bold text-white">{card.count}</div>
              <div className="text-xs text-gray-400">{card.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* 生成中任务监控面板 */}
      {generatingTasks.length > 0 && (
        <div className="mb-6 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <h2 className="text-lg font-semibold text-yellow-400">正在监听生成中的任务</h2>
            </div>
            <button
              onClick={() => setGeneratingTasks([])}
              className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
            >
              停止监听
            </button>
          </div>
          <div className="space-y-2">
            {generatingTasks.slice(0, 5).map((task) => (
              <div
                key={task.taskId}
                className="flex items-center justify-between bg-[#0f111a]/50 rounded px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 font-mono">#{task.taskId}</span>
                  <span className="text-xs text-gray-400">History: {task.historyId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-yellow-400">
                    已等待 {formatElapsed(task.elapsedSeconds)}
                  </span>
                  <span className="text-xs text-gray-500">·</span>
                  <span className="text-xs text-gray-400">每 5 秒自动刷新</span>
                </div>
              </div>
            ))}
            {generatingTasks.length > 5 && (
              <div className="text-xs text-gray-500 text-center">
                还有 {generatingTasks.length - 5} 个任务正在生成中...
              </div>
            )}
          </div>
        </div>
      )}

      {/* 筛选器和操作栏 */}
      <div className="mb-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2">
          <select
            value={projectFilter ?? ''}
            onChange={(e) => setState((prev) => ({ ...prev, projectFilter: e.target.value ? parseInt(e.target.value) : null, page: 1 }))}
            className="px-3 py-1.5 border border-gray-700 rounded-md text-sm bg-[#1c1f2e] text-gray-300 focus:outline-none focus:border-purple-500"
          >
            <option value="">全部项目</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setState((prev) => ({ ...prev, sourceFilter: e.target.value, page: 1 }))}
            className="px-3 py-1.5 border border-gray-700 rounded-md text-sm bg-[#1c1f2e] text-gray-300 focus:outline-none focus:border-purple-500"
          >
            <option value="all">全部来源</option>
            <option value="project">项目任务</option>
            <option value="single">单次生成</option>
            <option value="jimeng">即梦同步</option>
          </select>

          <select
            value={creatorFilter ?? ''}
            onChange={(e) => setState((prev) => ({ ...prev, creatorFilter: e.target.value ? parseInt(e.target.value) : null, page: 1 }))}
            className="px-3 py-1.5 border border-gray-700 rounded-md text-sm bg-[#1c1f2e] text-gray-300 focus:outline-none focus:border-purple-500"
          >
            <option value="">全部生成者</option>
            {creators.map((c) => (
              <option key={c.id} value={c.id}>{c.nickname || c.username}</option>
            ))}
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setState((prev) => ({ ...prev, dateFrom: e.target.value, page: 1 }))}
            className="px-2 py-1.5 border border-gray-700 rounded-md text-sm bg-[#1c1f2e] text-gray-300 focus:outline-none focus:border-purple-500"
          />
          <span className="text-gray-500 self-center text-sm">-</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setState((prev) => ({ ...prev, dateTo: e.target.value, page: 1 }))}
            className="px-2 py-1.5 border border-gray-700 rounded-md text-sm bg-[#1c1f2e] text-gray-300 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSyncFromJimeng}
            disabled={isLoading}
            className="px-4 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-500 disabled:opacity-50 flex items-center gap-1 transition-colors"
          >
            从即梦同步
          </button>

          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="px-4 py-1.5 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-500 disabled:opacity-50 flex items-center gap-1 transition-colors"
          >
            刷新
          </button>

          <button
            onClick={handleDownloadAllPending}
            disabled={isLoading}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-500 disabled:opacity-50 flex items-center gap-1 transition-colors"
          >
            下载全部待下载
          </button>

          <button
            onClick={handleBatchDownload}
            disabled={selectedTaskIds.length === 0 || isLoading}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-1 transition-colors"
          >
            批量下载 ({selectedTaskIds.length})
          </button>
        </div>
      </div>

      {/* 任务列表表格 */}
      <div className="bg-[#1c1f2e] rounded-lg border border-gray-800 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">加载中...</div>
        ) : tasks.length === 0 ? (
          <div className="p-8 text-center text-gray-400">暂无任务</div>
        ) : (
          <table className="w-full">
            <thead className="bg-[#0f111a] border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selectedTaskIds.length === tasks.length && tasks.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-700 bg-[#1c1f2e] text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">镜头</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase w-20">状态</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase w-14">预览</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase w-24">生成者</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase w-36">时间</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase w-48">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {tasks.map((task) => {
                const shotLabel = getShotLabel(task);
                const isExpanded = expandedTaskId === task.id;
                return (
                <React.Fragment key={task.id}>
                <tr onClick={() => handleToggleExpand(task.id)} className="hover:bg-[#0f111a]/50 transition-colors cursor-pointer">
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.includes(task.id)}
                      onChange={() => toggleTaskSelection(task.id)}
                      className="rounded border-gray-700 bg-[#1c1f2e] text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                      disabled={task.effective_download_status !== 'pending'}
                    />
                  </td>
                  {/* 镜头列: 双行 */}
                  <td className="px-4 py-3 group relative">
                    <div className="text-sm text-gray-200">
                      {shotLabel || <span className="text-gray-500 font-mono">#{task.id.toString().padStart(6, '0')}</span>}
                    </div>
                    {task.prompt && (
                      <div className="text-xs text-gray-500 truncate max-w-[300px]" title={task.prompt}>
                        {task.prompt}
                      </div>
                    )}
                  </td>
                  {/* 状态 */}
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-0.5 rounded text-xs border whitespace-nowrap ${
                      task.effective_download_status === 'generating'
                        ? 'bg-gray-500/20 text-gray-300 border-gray-500/30'
                        : task.effective_download_status === 'pending'
                        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        : task.effective_download_status === 'downloading'
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                        : task.effective_download_status === 'done'
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                    }`}>
                      {task.effective_download_status === 'generating' && '生成中'}
                      {task.effective_download_status === 'pending' && '待下载'}
                      {task.effective_download_status === 'downloading' && '下载中'}
                      {task.effective_download_status === 'done' && '已下载'}
                      {task.effective_download_status === 'failed' && '失败'}
                    </span>
                  </td>
                  {/* 预览 */}
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    {task.video_url && task.effective_download_status !== 'generating' ? (
                      <VideoHoverPreview videoUrl={task.video_url}>
                        <button
                          onClick={() => setPreviewTask(task)}
                          className="p-1 text-purple-400 hover:bg-purple-500/10 rounded transition-colors inline-flex"
                          title="悬停预览 / 点击全屏"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      </VideoHoverPreview>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                  {/* 生成者 */}
                  <td className="px-4 py-3 text-sm">
                    <div className="text-gray-300">{task.nickname || task.username || '-'}</div>
                    {(() => {
                      try {
                        const info = task.account_info ? JSON.parse(task.account_info) : null;
                        return info?.name ? <div className="text-xs text-gray-500 mt-0.5">{info.name}</div> : null;
                      } catch { return null; }
                    })()}
                  </td>
                  {/* 时间: 双行 */}
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-400">
                      {parseUTC(task.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-xs text-gray-500">
                      {task.completed_at ? `耗时 ${formatDuration(task.created_at, task.completed_at) || '-'}` :
                        task.effective_download_status === 'generating' ? '生成中...' : ''}
                    </div>
                  </td>
                  {/* 操作 */}
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {renderActions(task)}
                  </td>
                </tr>
                {/* 展开详情行 */}
                {isExpanded && (
                  <tr>
                    <td colSpan={7} className="bg-[#0f111a] px-6 py-4 border-t border-gray-800">
                      {configLoading ? (
                        <div className="text-gray-400 text-sm">加载配置中...</div>
                      ) : expandedConfig ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">模型：</span>
                              <span className="text-gray-200 ml-1">{expandedConfig.model || '-'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">比例：</span>
                              <span className="text-gray-200 ml-1">{expandedConfig.ratio || '-'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">时长：</span>
                              <span className="text-gray-200 ml-1">{expandedConfig.duration ? `${expandedConfig.duration}s` : '-'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">镜头ID：</span>
                              <span className="text-gray-200 ml-1">{expandedConfig.shotId || '-'}</span>
                            </div>
                          </div>
                          {expandedConfig.prompt && (
                            <div>
                              <div className="text-gray-500 text-xs mb-1">提示词：</div>
                              <div className="text-gray-200 text-sm whitespace-pre-wrap bg-[#1c1f2e] rounded p-3 max-h-32 overflow-y-auto">{expandedConfig.prompt}</div>
                            </div>
                          )}
                          {expandedConfig.assets && expandedConfig.assets.length > 0 && (
                            <div>
                              <div className="text-gray-500 text-xs mb-1">素材：</div>
                              <div className="flex gap-2 flex-wrap">
                                {expandedConfig.assets.filter(a => a.type === 'image').map((asset, i) => (
                                  <div key={i} className="w-16 h-16 rounded border border-gray-700 overflow-hidden bg-gray-800">
                                    <img src={`/api/uploads/${asset.filename}`} alt={asset.originalname} className="w-full h-full object-cover" />
                                  </div>
                                ))}
                                {expandedConfig.assets.filter(a => a.type === 'audio').map((asset, i) => (
                                  <div key={`audio-${i}`} className="flex items-center gap-1 px-2 py-1 rounded border border-gray-700 bg-gray-800 text-xs text-gray-300">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" /></svg>
                                    {asset.originalname}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-gray-500 text-sm">无法加载任务配置</div>
                      )}
                    </td>
                  </tr>
                )}
                </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="mt-4 flex justify-between items-center">
          <div className="text-sm text-gray-400">
            共 {total} 条，第 {page} 页 / 共 {totalPages} 页
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setState((prev) => ({ ...prev, page: prev.page - 1 }))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-700 rounded text-sm text-gray-300 hover:bg-[#1c1f2e] disabled:opacity-50 transition-colors"
            >
              上一页
            </button>
            <button
              onClick={() => setState((prev) => ({ ...prev, page: prev.page + 1 }))}
              disabled={page >= totalPages}
              className="px-3 py-1 border border-gray-700 rounded text-sm text-gray-300 hover:bg-[#1c1f2e] disabled:opacity-50 transition-colors"
            >
              下一页
            </button>
          </div>
        </div>
      )}
      {previewTask && (
        <VideoPreviewModal
          videoUrl={previewTask.video_url!}
          visible={!!previewTask}
          onClose={() => setPreviewTask(null)}
          title={previewTask.prompt?.substring(0, 50) || '视频预览'}
        />
      )}
    </div>
  );
}
