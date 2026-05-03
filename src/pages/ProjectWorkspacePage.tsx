import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type {
  Project, EpisodeWithShots, ShotVersion, User,
  AspectRatio, Duration, ModelId, ReferenceMode,
  UploadedImage, UploadedAudio, GenerationState,
} from '../types/index';
import { DURATION_OPTIONS, REFERENCE_MODES, MODEL_OPTIONS } from '../types/index';
import {
  getProject, updateProject,
  getShotTree, getShotVersions,
  createEpisode, deleteEpisode,
  createShot, deleteShot,
} from '../services/projectService';
import { generateVideo, preUploadImage } from '../services/videoService';
import VideoPlayer from '../components/VideoPlayer';
import { PromptEditor } from '../components/PromptEditor';
import { PlusIcon, CloseIcon, SparkleIcon } from '../components/Icons';
import { useShotDraftCache } from '../hooks/useShotDraftCache';

let nextId = 0;

interface Props {
  currentUser: User | null;
}

export default function ProjectWorkspacePage({ currentUser }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = Number(id);
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  // ── 项目 & 镜头树数据 ──
  const [project, setProject] = useState<Project | null>(null);
  const [tree, setTree] = useState<EpisodeWithShots[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<number>>(new Set());

  // ── 选中镜头 ──
  const [activeShotId, setActiveShotId] = useState<number | null>(null);
  const [versions, setVersions] = useState<ShotVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [shotGenerating, setShotGenerating] = useState(false);

  // ── 管理操作状态 ──
  const [editingCode, setEditingCode] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [addingEpisode, setAddingEpisode] = useState(false);
  const [newEpTitle, setNewEpTitle] = useState('');

  // ── 生成器状态 ──
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [audioFiles, setAudioFiles] = useState<UploadedAudio[]>([]);
  const [serializedPrompt, setSerializedPrompt] = useState('');
  const [model, setModel] = useState<ModelId>('seedance-2.0-fast');
  const [ratio, setRatio] = useState<AspectRatio>('16:9');
  const [duration, setDuration] = useState<Duration>(5);
  const [referenceMode, setReferenceMode] = useState<ReferenceMode>('全能参考');
  const [generation, setGeneration] = useState<GenerationState>({ status: 'idle' });
  const [editorKey, setEditorKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const promptEditorRef = useRef<any>(null);
  const { saveShotDraftDebounced, saveShotDraftImmediate, saveShotDraftBeforeUnload, loadShotDraft, clearShotDraft, cancelPendingSave } = useShotDraftCache();
  const activeShotIdRef = useRef<number | null>(null);
  const loadingDraftRef = useRef(false);
  const maxImages = 9;
  const abortRef = useRef<AbortController | null>(null);
  const maxAudios = 3;

  // ── 版本展开/收起 ──
  const [versionsExpanded, setVersionsExpanded] = useState(true);
  const [isDraftLoading, setIsDraftLoading] = useState(false);

  // ── 计算辅助 ──
  const allShots = useMemo(() => tree.flatMap(ep => (ep.shots || []).map(s => ({ ...s, episode: ep }))), [tree]);
  const activeShotIndex = allShots.findIndex(s => s.id === activeShotId);
  const activeShot = activeShotIndex >= 0 ? allShots[activeShotIndex] : null;
  const activeEpisode = activeShot?.episode;

  // ── 数据加载 ──
  const loadData = useCallback(async () => {
    try {
      const [proj, shotTree] = await Promise.all([
        getProject(projectId),
        getShotTree(projectId),
      ]);
      setProject(proj);
      setTree(shotTree);
      setCodeInput(proj.code || '');
      // 从项目设置读取固定画幅比例
      if (proj.settings_json) {
        try {
          const settings = JSON.parse(proj.settings_json);
          if (settings.ratio) setRatio(settings.ratio);
        } catch {}
      }
      if (shotTree.length > 0) {
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  // 加载版本 + 检查是否正在生成
  useEffect(() => {
    if (activeShotId) {
      setVersionsLoading(true);
      getShotVersions(activeShotId)
        .then(v => { setVersions(v); setVersionsExpanded(true); })
        .catch(() => setVersions([]))
        .finally(() => setVersionsLoading(false));
      // 查询是否有活跃生成任务
      fetch(`/api/shots/${activeShotId}/generating`, { headers: { 'X-Session-ID': localStorage.getItem('seedance_session_id') || '' } })
        .then(r => r.json())
        .then(d => setShotGenerating(d.generating || false))
        .catch(() => setShotGenerating(false));

      // Resume polling from localStorage if page was refreshed during generation
      const savedGen = localStorage.getItem('generating_shot_' + activeShotId);
      if (savedGen) {
        try {
          const { taskId, startTime } = JSON.parse(savedGen);
          const elapsed = Date.now() - startTime;
          const maxPollTime = 180 * 60 * 1000;
          if (elapsed < maxPollTime && taskId) {
            setShotGenerating(true);
            setGeneration({ status: 'generating', progress: '恢复生成状态，继续轮询...' });
            const headers = { 'X-Session-ID': localStorage.getItem('seedance_session_id') || '' };
            const pollInterval = 10000;
            const resumePoll = async () => {
              const remaining = maxPollTime - elapsed;
              const resumeStart = Date.now();
              while (Date.now() - resumeStart < remaining) {
                await new Promise(r => setTimeout(r, pollInterval));
                try {
                  const res = await fetch('/api/task/' + taskId, { headers });
                  const data = await res.json();
                  if (data.status === 'done') {
                    localStorage.removeItem('generating_shot_' + activeShotId);
                    if (data.result?.data?.[0]?.url) {
                      setGeneration({ status: 'success', result: data.result });
                    } else {
                      setGeneration({ status: 'error', error: '未获取到视频结果' });
                    }
                    setShotGenerating(false);
                    getShotVersions(activeShotId).then(setVersions).catch(() => {});
                    return;
                  }
                  if (data.status === 'error') {
                    localStorage.removeItem('generating_shot_' + activeShotId);
                    setGeneration({ status: 'error', error: data.error || '视频生成失败' });
                    setShotGenerating(false);
                    return;
                  }
                  if (data.progress) {
                    setGeneration(prev => ({ ...prev, progress: data.progress }));
                  }
                } catch {
                  // network error, keep retrying
                }
              }
              localStorage.removeItem('generating_shot_' + activeShotId);
              setGeneration({ status: 'error', error: '视频生成超时' });
              setShotGenerating(false);
            };
            resumePoll();
          } else {
            localStorage.removeItem('generating_shot_' + activeShotId);
          }
        } catch {
          localStorage.removeItem('generating_shot_' + activeShotId);
        }
      }
    } else {
      setVersions([]);
      setShotGenerating(false);
    }
  }, [activeShotId]);

  // ── 选中镜头 ──
  const selectShot = useCallback(async (shotId: number) => {

    // Save current shot draft before switching
    if (activeShotIdRef.current && activeShotIdRef.current !== shotId) {
      const editorJson = promptEditorRef.current?.editor?.getJSON() || null;
      saveShotDraftImmediate(activeShotIdRef.current, {
        prompt: serializedPrompt,
        editorJson,
        model, ratio, duration, referenceMode,
        images, audioFiles,
      });
    }

    // Block auto-save BEFORE any state changes to prevent race condition
    loadingDraftRef.current = true;
    cancelPendingSave();

    setActiveShotId(shotId);
    activeShotIdRef.current = shotId;
    setGeneration({ status: 'idle' });

    // Try loading cached draft for new shot
    setIsDraftLoading(true);
    let cached;
    try {
      cached = await loadShotDraft(shotId);
    } finally {
      setIsDraftLoading(false);
    }
    if (cached) {
      if (cached.tiptapJson) {
        setTimeout(() => {
          promptEditorRef.current?.editor?.commands.setContent(cached.tiptapJson);
        }, 50);
      } else {
        setEditorKey(k => k + 1);
        setSerializedPrompt('');
      }
      setModel(cached.model);
      // ratio 由项目设置锁定，不从草稿缓存恢复
      setDuration(cached.duration);
      setReferenceMode(cached.referenceMode);
      images.forEach(img => URL.revokeObjectURL(img.previewUrl));
      setImages(cached.images);
      setAudioFiles(cached.audioFiles);
      setSerializedPrompt(cached.prompt);
      // Re-upload restored images to CDN
      for (const img of cached.images) {
        setImages(prev => prev.map(x => x.id === img.id ? { ...x, uploadStatus: 'uploading' as const } : x));
        preUploadImage(img.file)
          .then(uri => setImages(prev => prev.map(x => x.id === img.id ? { ...x, cdnUri: uri, uploadStatus: 'done' as const } : x)))
          .catch(() => setImages(prev => prev.map(x => x.id === img.id ? { ...x, uploadStatus: 'error' as const } : x)));
      }
    } else {
      const shot = allShots.find(s => s.id === shotId);
      if (shot) {
        if (shot.prompt) {
          setTimeout(() => {
            promptEditorRef.current?.editor?.commands.setContent(`<p>${shot.prompt}</p>`);
          }, 50);
        } else {
          setEditorKey(k => k + 1);
          setSerializedPrompt('');
        }
        if (shot.preferred_model) {
          const m = MODEL_OPTIONS.find(o => o.value === shot.preferred_model);
          if (m) setModel(m.value);
        }
        images.forEach(img => URL.revokeObjectURL(img.previewUrl));
        setImages([]);
        setAudioFiles([]);
      }
    }
    // Delay re-enabling auto-save to let React finish re-rendering
    setTimeout(() => { loadingDraftRef.current = false; }, 500);
  }, [allShots, serializedPrompt, model, ratio, duration, referenceMode, images, audioFiles, saveShotDraftImmediate, loadShotDraft]);

  // ── 镜头导航 ──
  const goPrevShot = () => { if (activeShotIndex > 0) selectShot(allShots[activeShotIndex - 1].id); };
  const goNextShot = () => { if (activeShotIndex < allShots.length - 1) selectShot(allShots[activeShotIndex + 1].id); };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as any)?.contentEditable === 'true') return;
      if (e.key === 'ArrowLeft' || e.key === '[') goPrevShot();
      if (e.key === 'ArrowRight' || e.key === ']') goNextShot();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // ── 自动保存草稿（debounced）──
  useEffect(() => {
    const shotId = activeShotIdRef.current;
    if (!shotId || loadingDraftRef.current) return;
    const editorJson = promptEditorRef.current?.editor?.getJSON() || null;
    saveShotDraftDebounced(shotId, {
      prompt: serializedPrompt,
      editorJson,
      model, ratio, duration, referenceMode,
      images, audioFiles,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedPrompt, images, audioFiles, model, ratio, duration, referenceMode, saveShotDraftDebounced]);

  // ── 页面关闭/卸载时保存 ──
  useEffect(() => {
    const handleBeforeUnload = () => {
      const sid = activeShotIdRef.current;
      if (!sid) return;
      const editorJson = promptEditorRef.current?.editor?.getJSON() || null;
      // Use keepalive fetch to save metadata before page unloads
      saveShotDraftBeforeUnload(sid, {
        prompt: serializedPrompt,
        editorJson,
        model, ratio, duration, referenceMode,
      });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [serializedPrompt, model, ratio, duration, referenceMode, saveShotDraftBeforeUnload]);

  // ── 文件上传 ──
  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const remaining = maxImages - images.length;
    if (remaining <= 0) return;
    const newFiles = Array.from(fileList).slice(0, remaining);
    const newImages: UploadedImage[] = newFiles.map((file, i) => ({
      id: `img-${++nextId}`, file, previewUrl: URL.createObjectURL(file), index: images.length + i + 1,
      uploadStatus: 'pending' as const,
    }));
    const merged = [...images, ...newImages];
    setImages(merged);

    // Auto pre-upload each new image to CDN
    for (const img of newImages) {
      setImages(prev => prev.map(x => x.id === img.id ? { ...x, uploadStatus: 'uploading' } : x));
      preUploadImage(img.file)
        .then(uri => {
          setImages(prev => prev.map(x => x.id === img.id ? { ...x, cdnUri: uri, uploadStatus: 'done' } : x));
        })
        .catch(() => {
          setImages(prev => prev.map(x => x.id === img.id ? { ...x, uploadStatus: 'error' } : x));
        });
    }
  }, [images]);

  const removeImage = useCallback((imgId: string) => {
    const removed = images.find(img => img.id === imgId);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    setImages(images.filter(img => img.id !== imgId).map((img, i) => ({ ...img, index: i + 1 })));
  }, [images]);

  const addAudioFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const remaining = maxAudios - audioFiles.length;
    if (remaining <= 0) return;
    const newFiles = Array.from(fileList).filter(f => /\.(mp3|wav)$/i.test(f.name) || f.type.startsWith('audio/')).slice(0, remaining);
    const newAudios: UploadedAudio[] = newFiles.map((file, i) => ({
      id: `aud-${++nextId}`, file, name: file.name, index: audioFiles.length + i + 1,
    }));
    setAudioFiles([...audioFiles, ...newAudios]);
  }, [audioFiles]);

  const removeAudio = useCallback((audId: string) => {
    setAudioFiles(audioFiles.filter(a => a.id !== audId).map((a, i) => ({ ...a, index: i + 1 })));
  }, [audioFiles]);

  // ── 生成 ──
  const handleCancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setGeneration({ status: 'idle' });
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!serializedPrompt.trim() && images.length === 0) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setGeneration({ status: 'generating', progress: '正在提交视频生成请求...' });
    try {
      const preUploadedUris: Record<number, string> = {};
      images.forEach((img, i) => {
        if (img.cdnUri) preUploadedUris[i] = img.cdnUri;
      });
      const result = await generateVideo(
        {
          prompt: serializedPrompt, model, ratio, duration,
          files: images.map(img => img.file),
          audioFiles: audioFiles.map(a => a.file),
          shotId: activeShotId || undefined,
          preUploadedUris: Object.keys(preUploadedUris).length > 0 ? preUploadedUris : undefined,
        },
        (progress) => setGeneration(prev => ({ ...prev, progress })),
        controller.signal,
      );
      if (result.data?.length > 0 && result.data[0].url) {
        setGeneration({ status: 'success', result });
        if (activeShotId) {
          getShotVersions(activeShotId).then(setVersions).catch(() => {});
          clearShotDraft(activeShotId);
        }
      } else {
        setGeneration({ status: 'error', error: '未获取到视频结果，请重试' });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setGeneration({ status: 'error', error: error instanceof Error ? error.message : '未知错误' });
    }
  }, [serializedPrompt, images, audioFiles, model, ratio, duration, activeShotId]);

  // ── 管理操作 ──
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
    } catch (e: any) { alert(e.message); }
  };

  const handleAddEpisode = async () => {
    try {
      await createEpisode(projectId, { title: newEpTitle || undefined });
      setAddingEpisode(false);
      setNewEpTitle('');
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleDeleteEpisode = async (epId: number) => {
    if (!confirm('确定删除此集？下属所有镜头也会被删除。')) return;
    try {
      const ep = tree.find(e => e.id === epId);
      const shotIds = (ep?.shots || []).map(s => s.id);
      await deleteEpisode(epId);
      if (activeShotId && shotIds.includes(activeShotId)) {
        setActiveShotId(null);
        setGeneration({ status: 'idle' });
      }
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleAddShot = async (episodeId: number) => {
    try {
      await createShot(episodeId, {});
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleDeleteShot = async (shotId: number) => {
    if (!confirm('确定删除此镜头？')) return;
    try {
      await deleteShot(shotId);
      if (activeShotId === shotId) setActiveShotId(null);
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  // ── 渲染辅助 ──
  const videoUrl = generation.status === 'success' && generation.result?.data?.[0]?.url ? generation.result.data[0].url : null;
  const revisedPrompt = generation.status === 'success' ? generation.result?.data?.[0]?.revised_prompt : undefined;
  const isGenerating = generation.status === 'generating';
  const shotHasActiveTask = shotGenerating || versions.some(v => v.status === 'generating');
  const canGenerate = (serializedPrompt.trim() || images.length > 0) && !isGenerating && !shotHasActiveTask;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400">
        <div className="text-center">
          <div className="inline-block animate-spin text-purple-500 mb-4">
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeWidth={2} strokeLinecap="round" /></svg>
          </div>
          <p>加载项目...</p>
        </div>
      </div>
    );
  }

  if (!project) return <div className="flex items-center justify-center h-screen text-gray-400">项目不存在</div>;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0f111a] text-white">
      {/* ── 顶部栏 ── */}
      <div className="flex-none h-12 bg-[#1c1f2e] border-b border-gray-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition-colors" title="返回项目列表">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <h1 className="text-sm font-bold text-white truncate">{project.name}</h1>
          {project.code && <span className="text-xs text-gray-500 font-mono bg-gray-800 px-2 py-0.5 rounded">{project.code}</span>}
          <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded" title="项目画幅比例">{ratio}</span>
        </div>
        <div className="flex items-center gap-2">
          {editingCode ? (
            <>
              <input value={codeInput} onChange={e => setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="代号" className="bg-gray-700 text-white rounded px-2 py-1 text-xs w-20" maxLength={10} />
              <button onClick={handleSaveCode} className="text-xs text-blue-400 hover:underline">保存</button>
              <button onClick={() => setEditingCode(false)} className="text-xs text-gray-400 hover:underline">取消</button>
            </>
          ) : isAdmin ? (
            <button onClick={() => setEditingCode(true)} className="text-xs text-gray-500 hover:text-blue-400">编辑代号</button>
          ) : null}
        </div>
      </div>

      {/* ── 主体 ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ══════════════════════════════════════════════ */}
        {/* ══ 左侧：镜头列表面板 ══                     */}
        {/* ══════════════════════════════════════════════ */}
        <div className="w-[280px] xl:w-[320px] flex-none border-r border-gray-800 bg-[#13151f] flex flex-col overflow-hidden">

          {/* 列表头 */}
          <div className="flex-none px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-300">镜头列表</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAddingEpisode(true)}
                className="text-xs px-2 py-1 rounded-md bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors"
              >
                + 新集
              </button>
            </div>
          </div>

          {/* 新建集 */}
          {addingEpisode && (
            <div className="flex-none px-4 py-3 border-b border-gray-800 bg-gray-800/30">
              <input value={newEpTitle} onChange={e => setNewEpTitle(e.target.value)} placeholder="集标题（可选，回车创建）" className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm mb-2" autoFocus onKeyDown={e => e.key === 'Enter' && handleAddEpisode()} />
              <div className="flex gap-2">
                <button onClick={handleAddEpisode} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg">创建</button>
                <button onClick={() => setAddingEpisode(false)} className="text-xs px-3 py-1.5 bg-gray-600 text-white rounded-lg">取消</button>
              </div>
            </div>
          )}

          {/* 镜头滚动区 */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {tree.length === 0 && (
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-800 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
                </div>
                <p className="text-gray-500 text-sm">{'点击上方「+ 新集」添加集和镜头'}</p>
              </div>
            )}

            {tree.map(ep => (
              <div key={ep.id} className="border-b border-gray-800/50">
                {/* 集标题行 */}
                <div
                  className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-gray-800/40 transition-colors"
                  onClick={() => toggleEpisode(ep.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-gray-500 text-xs transition-transform ${expandedEpisodes.has(ep.id) ? 'rotate-90' : ''}`}>▶</span>
                    <span className="text-sm font-medium text-gray-200">第{ep.episode_number}集</span>
                    {ep.title && <span className="text-xs text-gray-500 truncate max-w-[100px]">{ep.title}</span>}
                    <span className="text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">{ep.shots?.length || 0}</span>
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleAddShot(ep.id)} className="text-[10px] px-1.5 py-0.5 rounded bg-green-600/10 text-green-400/70 hover:text-green-400 hover:bg-green-600/20">+镜头</button>
                      {isAdmin && <button onClick={() => handleDeleteEpisode(ep.id)} className="text-[10px] px-1.5 py-0.5 rounded text-red-400/40 hover:text-red-400 hover:bg-red-600/10">删除</button>}
                    </div>
                </div>

                {/* 添加镜头 - 直接点击按钮添加 */}

                {/* 镜头卡片列表 */}
                {expandedEpisodes.has(ep.id) && (
                  <div className="pb-1">
                    {isAdmin && (!ep.shots || ep.shots.length === 0) ? (
                      <div className="text-center text-gray-600 py-4 text-xs">暂无镜头{'，点击上方添加'}</div>
                    ) : (
                      ep.shots.map(shot => {
                        const isActive = shot.id === activeShotId;
                        return (
                          <div
                            key={shot.id}
                            onClick={() => selectShot(shot.id)}
                            className={`mx-2 mb-1 px-3 py-3 rounded-lg cursor-pointer transition-all ${
                              isActive
                                ? 'bg-purple-500/15 border border-purple-500/40 shadow-sm shadow-purple-500/10'
                                : 'hover:bg-gray-800/60 border border-transparent'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className={`font-mono text-xs font-bold ${isActive ? 'text-purple-400' : 'text-blue-400/80'}`}>
                                    S{String(shot.shot_number).padStart(2, '0')}
                                  </span>
                                  {shot.preferred_model && (
                                    <span className="text-[10px] bg-gray-700/80 text-gray-400 px-1.5 py-0.5 rounded">
                                      {MODEL_OPTIONS.find(m => m.value === shot.preferred_model)?.label?.replace('Seedance ', '') || ''}
                                    </span>
                                  )}
                                </div>
                                <p className={`text-sm leading-snug ${isActive ? 'text-gray-200' : 'text-gray-400'} ${shot.description ? '' : 'italic'}`}>
                                  {shot.description || '暂无描述'}
                                </p>
                                {shot.prompt && (
                                  <p className="text-[11px] text-gray-600 mt-1 line-clamp-1">
                                    提示词：{shot.prompt}
                                  </p>
                                )}
                              </div>
                              {isAdmin && (
                                <button
                                  onClick={e => { e.stopPropagation(); handleDeleteShot(shot.id); }}
                                  className="text-gray-700 hover:text-red-400 transition-colors p-0.5 flex-none"
                                  title="删除镜头"
                                >
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 底部导航 */}
          {allShots.length > 0 && activeShotId && (
            <div className="flex-none border-t border-gray-800 bg-[#1c1f2e] flex items-center justify-between px-4 py-2.5">
              <button onClick={goPrevShot} disabled={activeShotIndex <= 0} className="text-xs text-gray-400 hover:text-white disabled:text-gray-700 disabled:cursor-not-allowed transition-colors flex items-center gap-1">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6" /></svg>
                上一镜
              </button>
              <span className="text-xs text-gray-500 font-mono">{activeShotIndex + 1} / {allShots.length}</span>
              <button onClick={goNextShot} disabled={activeShotIndex >= allShots.length - 1} className="text-xs text-gray-400 hover:text-white disabled:text-gray-700 disabled:cursor-not-allowed transition-colors flex items-center gap-1">
                下一镜
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* ══ 右侧：工作区                              */}
        {/* ══════════════════════════════════════════════ */}
        <div className="flex-1 flex overflow-hidden">
          {!activeShotId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md px-6">
                <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-gray-800 flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg text-gray-300 mb-2">在左侧选择一个镜头</h3>
                <p className="text-gray-500 text-sm leading-relaxed">点击镜头卡片后，这里会显示创作工具。你可以编辑提示词、上传参考素材、生成视频，所有操作在同一页面完成。</p>
                <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-600">
                  <span>← → 快捷切换镜头</span>
                  <span>[ ] 同样有效</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* 创作表单 */}
              <div className="w-[400px] xl:w-[440px] flex-none border-r border-gray-800 overflow-y-auto custom-scrollbar bg-[#0f111a] relative">
                {/* 镜头信息头 */}
                <div className="sticky top-0 z-10 bg-[#1c1f2e] border-b border-gray-800 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-purple-400 font-mono text-sm font-bold">
                        E{String(activeEpisode?.episode_number || 0).padStart(2, '0')}-S{String(activeShot?.shot_number || 0).padStart(2, '0')}
                      </span>
                      {activeShot?.description && (
                        <span className="text-gray-300 text-sm truncate max-w-[200px]">{activeShot.description}</span>
                      )}
                    </div>
                    {versions.length > 0 && (
                      <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                        {versions.length} 个版本
                      </span>
                    )}
                  </div>
                  {project.code && activeEpisode && activeShot && (
                    <div className="text-[10px] text-gray-600 mt-1 font-mono">
                      {project.code}-{activeEpisode.episode_number}-{activeShot.shot_number}-[版本]-[创作者].mp4
                    </div>
                  )}
                </div>

                {isDraftLoading && (
                  <div className="absolute inset-0 bg-[#0f111a]/80 z-20 flex items-center justify-center rounded-xl">
                    <div className="text-center">
                      <span className="inline-block w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mb-2" />
                      <p className="text-xs text-gray-400">正在加载草稿数据...</p>
                    </div>
                  </div>
                  )}
                <div className="p-4 space-y-4">
                  {/* 参考图片 */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-gray-400">参考图片</label>
                      {images.length > 0 && (
                        <button onClick={() => { images.forEach(img => URL.revokeObjectURL(img.previewUrl)); setImages([]); }} className="text-[10px] text-red-400 hover:text-red-300">清除全部</button>
                      )}
                    </div>
                    {images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {images.map(img => (
                          <div key={img.id} className="relative group w-16 h-16 flex-shrink-0">
                            <img src={img.previewUrl} alt="" className="w-full h-full object-cover rounded-lg border border-gray-700" />
                            <span className="absolute bottom-0 left-0 bg-black/70 text-[9px] text-purple-400 px-1 py-0.5 rounded-br-lg rounded-tl-lg">@{img.index}</span>
                            {img.uploadStatus === 'uploading' && (
                              <span className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-black/40 rounded-lg">
                                <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                              </span>
                            )}
                            {img.uploadStatus === 'done' && (
                              <span className="absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center">
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                              </span>
                            )}
                            {img.uploadStatus === 'error' && (
                              <span className="absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center text-white text-[8px] font-bold">!</span>
                            )}
                            <button onClick={() => removeImage(img.id)} className="absolute -top-1 -right-1 w-4 h-4 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-600">
                              <CloseIcon className="w-2.5 h-2.5 text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {images.length < maxImages && (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                        className={`w-full ${images.length === 0 ? 'h-24' : 'h-14'} border border-dashed border-gray-700 rounded-xl flex items-center justify-center bg-[#1c1f2e] cursor-pointer hover:border-purple-500/50 hover:bg-[#25293d] transition-all`}
                      >
                        <div className="flex items-center gap-2">
                          <PlusIcon className="w-4 h-4 text-gray-500" />
                          <span className="text-xs text-gray-500">{images.length === 0 ? `点击或拖拽上传参考图（最多${maxImages}张）` : `继续添加（${images.length}/${maxImages}）`}</span>
                        </div>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
                  </div>

                  {/* 音频 */}
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-2">参考音频</label>
                    {audioFiles.length > 0 && (
                      <div className="space-y-1 mb-2">
                        {audioFiles.map(aud => (
                          <div key={aud.id} className="flex items-center gap-2 bg-[#1c1f2e] border border-gray-700 rounded-lg px-3 py-1.5 group text-xs">
                            <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                            <span className="text-gray-300 truncate flex-1">{aud.name}</span>
                            <button onClick={() => removeAudio(aud.id)} className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100"><CloseIcon className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {audioFiles.length < maxAudios && (
                      <div
                        onClick={() => audioInputRef.current?.click()}
                        className="w-full h-12 border border-dashed border-gray-700 rounded-xl flex items-center justify-center bg-[#1c1f2e] cursor-pointer hover:border-purple-500/50 transition-all"
                      >
                        <span className="text-xs text-gray-500 flex items-center gap-1"><PlusIcon className="w-3 h-3" />上传音频（MP3/WAV）</span>
                      </div>
                    )}
                    <input ref={audioInputRef} type="file" accept="audio/mpeg,.mp3,audio/wav,.wav" multiple className="hidden" onChange={e => { addAudioFiles(e.target.files); e.target.value = ''; }} />
                  </div>

                  {/* 提示词编辑器 — 内置弹窗功能 */}
                  <PromptEditor
                    key={editorKey}
                    images={images}
                    audioFiles={audioFiles}
                    isGenerating={isGenerating}
                    onSerializedChange={setSerializedPrompt}
                    editorRef={promptEditorRef}
                  />

                  {/* 提示词字数统计 */}
                  {serializedPrompt.length > 0 && (
                    <div className={`text-right text-xs mt-1 ${serializedPrompt.length > 2500 ? 'text-red-400' : serializedPrompt.length > 2000 ? 'text-yellow-400' : 'text-gray-500'}`}>
                      {serializedPrompt.length > 2500 && '⚠ 提示词过长，可能导致生成失败。建议精简到 2500 字以内 · '}
                      {serializedPrompt.length}/2500
                    </div>
                  )}

                  {/* 生成参数 */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-gray-400 block mb-2">模型</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {MODEL_OPTIONS.map(opt => (
                          <button key={opt.value} onClick={() => setModel(opt.value)}
                            className={`text-left px-3 py-2 rounded-lg border text-xs transition-all ${model === opt.value ? 'border-purple-500 bg-purple-500/10 text-purple-400' : 'border-gray-700 bg-[#161824] text-gray-400 hover:border-gray-600'}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 block mb-2">参考模式</label>
                      <div className="flex gap-1.5">
                        {REFERENCE_MODES.map(mode => (
                          <button key={mode} onClick={() => setReferenceMode(mode)}
                            className={`flex-1 py-2 rounded-lg text-xs border transition-all ${referenceMode === mode ? 'border-purple-500 bg-purple-500/10 text-purple-400' : 'border-gray-700 bg-[#161824] text-gray-400 hover:border-gray-600'}`}>
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-gray-400 block mb-2">画面比例</label>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1.5 rounded text-xs border border-purple-500/50 bg-purple-500/10 text-purple-400 font-medium">{ratio}</span>
                          <span className="text-[10px] text-gray-500">项目固定</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-400 block mb-2">时长</label>
                        <div className="grid grid-cols-3 gap-1">
                          {DURATION_OPTIONS.map(d => (
                            <button key={d} onClick={() => setDuration(d)}
                              className={`py-1.5 rounded text-xs border transition-all ${duration === d ? 'border-purple-500 bg-purple-500/10 text-purple-400' : 'border-gray-700 bg-[#161824] text-gray-400 hover:border-gray-600'}`}>
                              {d}秒
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 生成按钮 */}
                    {shotHasActiveTask && !isGenerating && (
                      <div className="mb-3 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <p className="text-xs text-yellow-400">该镜头有正在生成的任务，请等待完成后再提交新任务</p>
                      </div>
                    )}
                  <div>
                    {isGenerating && (
                      <div className="mb-3">
                        <div className="text-xs text-gray-400 mb-1">{generation.progress || '处理中...'}</div>
                        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full animate-progress" />
                        </div>
                      </div>
                    )}
                    {isGenerating ? (
                      <button onClick={handleCancel}
                        className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12" /></svg>
                        取消生成
                      </button>
                    ) : (
                      <button onClick={handleGenerate} disabled={!canGenerate}
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                        <SparkleIcon className="w-4 h-4" />生成视频
                      </button>
                    )}
                  </div>

                  {/* ── 版本历史区 ── */}
                  <div className="pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <button onClick={() => setVersionsExpanded(!versionsExpanded)} className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-gray-300">
                        <span className={`transition-transform ${versionsExpanded ? 'rotate-90' : ''}`}>▶</span>
                        版本历史
                        {versions.length > 0 && <span className="text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-full ml-1">{versions.length}</span>}
                      </button>
                    </div>

                    {versionsLoading && (
                      <div className="text-xs text-gray-600 py-2">加载版本...</div>
                    )}

                    {versionsExpanded && !versionsLoading && versions.length === 0 && (
                      <div className="text-xs text-gray-600 bg-gray-800/30 rounded-lg py-4 text-center">
                        暂无版本记录，生成第一个版本吧
                      </div>
                    )}

                    {versionsExpanded && versions.length > 0 && (
                      <div className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {versions.map(v => (
                          <div key={v.id} className="flex items-center gap-3 bg-[#1c1f2e] border border-gray-800 rounded-lg px-3 py-2.5 hover:border-gray-700 transition-colors">
                            {/* 版本标签 */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-sm flex-none ${
                              v.status === 'done'
                                ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                                : v.status === 'generating'
                                  ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                                  : v.status === 'error'
                                    ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                                    : 'bg-gray-700 text-gray-400 border border-gray-600'
                            }`}>
                              {v.version_label}
                            </div>
                            {/* 信息 */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-200">{v.nickname || v.username || '未知'}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  v.status === 'done' ? 'bg-green-500/10 text-green-400'
                                    : v.status === 'generating' ? 'bg-yellow-500/10 text-yellow-400'
                                    : v.status === 'error' ? 'bg-red-500/10 text-red-400'
                                    : 'bg-gray-700 text-gray-500'
                                }`}>
                                  {v.status === 'done' ? '已完成' : v.status === 'generating' ? '生成中' : v.status === 'error' ? '失败' : v.status}
                                </span>
                              </div>
                              <span className="text-[10px] text-gray-600">{new Date(v.created_at).toLocaleString('zh-CN')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 视频预览 */}
              <div className="flex-1 bg-[#090a0f] overflow-y-auto flex flex-col">
                <VideoPlayer
                  videoUrl={videoUrl}
                  revisedPrompt={revisedPrompt}
                  isLoading={isGenerating}
                  error={generation.status === 'error' ? generation.error : undefined}
                  progress={generation.progress}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
