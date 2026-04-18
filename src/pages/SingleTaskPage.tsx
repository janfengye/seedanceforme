import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  AspectRatio,
  Duration,
  ModelId,
  ReferenceMode,
  UploadedImage,
  UploadedAudio,
  GenerationState,
} from '../types/index';
import { RATIO_OPTIONS, DURATION_OPTIONS, REFERENCE_MODES, MODEL_OPTIONS } from '../types/index';
import { generateVideo } from '../services/videoService';
import { getProjects, getShot } from '../services/projectService';
import ShotSelector from '../components/ShotSelector';
import type { Project, Shot } from '../types/index';
import VideoPlayer from '../components/VideoPlayer';
import { PromptEditor } from '../components/PromptEditor';
import { GearIcon, PlusIcon, CloseIcon, SparkleIcon } from '../components/Icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDraftPersistence } from '../hooks/useDraftPersistence';
import { loadTaskTemplate } from '../services/taskTemplateService';

let nextId = 0;

export default function SingleTaskPage() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [audioFiles, setAudioFiles] = useState<UploadedAudio[]>([]);
  const [serializedPrompt, setSerializedPrompt] = useState('');
  const [model, setModel] = useState<ModelId>('seedance-2.0-fast');
  const [ratio, setRatio] = useState<AspectRatio>('16:9');
  const [duration, setDuration] = useState<Duration>(5);
  const [referenceMode, setReferenceMode] = useState<ReferenceMode>('全能参考');
  const [generation, setGeneration] = useState<GenerationState>({
    status: 'idle',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const maxImages = 9;
  const maxAudios = 3;
  const navigate = useNavigate();
  const [editorKey, setEditorKey] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const [shotMeta, setShotMeta] = useState<{ projectCode?: string; episodeNumber?: number; shotNumber?: number } | null>(null);
  const [showShotSelector, setShowShotSelector] = useState(false);
  const promptEditorRef = useRef<any>(null);
  const { saveDraft, loadDraft, clearDraft } = useDraftPersistence();
  const draftLoaded = useRef(false);
  const [searchParams] = useSearchParams();
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateLoadingMsg, setTemplateLoadingMsg] = useState('');
  const fromTaskId = searchParams.get('from_task');
  const shotIdParam = searchParams.get('shotId');

  // Load from template or draft on mount
  useEffect(() => {
    if (draftLoaded.current) return;
    draftLoaded.current = true;

    if (fromTaskId) {
      // Load from task template with loading indicator
      setTemplateLoading(true);
      setTemplateLoadingMsg('正在加载任务配置...');
      loadTaskTemplate(parseInt(fromTaskId), (msg: string) => setTemplateLoadingMsg(msg)).then(async (template) => {
        if (!template) { setTemplateLoading(false); return; }
        setImages(template.images);
        setAudioFiles(template.audioFiles);
        setModel(template.model);
        setRatio(template.ratio);
        setDuration(template.duration);
        if (template.prompt) {
          setTimeout(() => {
            promptEditorRef.current?.editor?.commands.setContent(`<p>${template.prompt}</p>`);
          }, 100);
        }
        // Restore shot association if template has shotId
        if (template.shotId) {
          try {
            const shotDetail = await getShot(template.shotId);
            if (shotDetail) {
              setSelectedShot(shotDetail);
              setShotMeta({
                projectCode: (shotDetail as any).project_code,
                episodeNumber: (shotDetail as any).episode_number,
                shotNumber: shotDetail.shot_number,
              });
              setShowShotSelector(true);
            }
          } catch (e) {
            console.warn('Failed to restore shot association:', e);
          }
        }
        setTemplateLoading(false);
      }).catch(() => setTemplateLoading(false));
    } else {
      // Load from draft
      loadDraft().then((draft) => {
        if (!draft) return;
        setImages(draft.images);
        setAudioFiles(draft.audioFiles);
        setModel(draft.model);
        setRatio(draft.ratio);
        setDuration(draft.duration);
        setReferenceMode(draft.referenceMode);
        if (draft.tiptapJson) {
          setTimeout(() => {
            promptEditorRef.current?.editor?.commands.setContent(draft.tiptapJson);
          }, 100);
        }
      });
    }
  }, []);

  // Auto-save draft on state changes
  useEffect(() => {
    if (!draftLoaded.current) return;
    saveDraft({
      editorJson: promptEditorRef.current?.editor?.getJSON() || null,
      model,
      ratio,
      duration,
      referenceMode,
      images,
      audioFiles,
    });
  }, [serializedPrompt, model, ratio, duration, referenceMode, images, audioFiles, saveDraft]);

  const addFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const remaining = maxImages - images.length;
      if (remaining <= 0) return;

      const newFiles = Array.from(fileList).slice(0, remaining);
      const newImages: UploadedImage[] = newFiles.map((file, i) => ({
        id: `img-${++nextId}`,
        file,
        previewUrl: URL.createObjectURL(file),
        index: images.length + i + 1,
      }));

      setImages([...images, ...newImages]);
    },
    [images]
  );

  const removeImage = useCallback(
    (id: string) => {
      const removed = images.find((img) => img.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);

      const updated = images
        .filter((img) => img.id !== id)
        .map((img, i) => ({ ...img, index: i + 1 }));
      setImages(updated);
    },
    [images]
  );

  const clearAllImages = useCallback(() => {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
  }, [images]);

  const addAudioFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const remaining = maxAudios - audioFiles.length;
      if (remaining <= 0) return;

      const newFiles = Array.from(fileList)
        .filter((f) => /\.(mp3|wav)$/i.test(f.name) || f.type.startsWith('audio/'))
        .slice(0, remaining);
      const newAudios: UploadedAudio[] = newFiles.map((file, i) => ({
        id: `aud-${++nextId}`,
        file,
        name: file.name,
        index: audioFiles.length + i + 1,
      }));

      setAudioFiles([...audioFiles, ...newAudios]);
    },
    [audioFiles]
  );

  const removeAudio = useCallback(
    (id: string) => {
      const updated = audioFiles
        .filter((a) => a.id !== id)
        .map((a, i) => ({ ...a, index: i + 1 }));
      setAudioFiles(updated);
    },
    [audioFiles]
  );

  // 加载项目列表
  useState(() => {
    getProjects().then(setProjects).catch(() => {});
  });

  // 从 shotId 查询参数自动关联镜头
  useEffect(() => {
    if (!shotIdParam) return;
    getShot(parseInt(shotIdParam)).then((shotDetail) => {
      setSelectedShot(shotDetail);
      setShotMeta({
        projectCode: shotDetail.project_code,
        episodeNumber: shotDetail.episode_number,
        shotNumber: shotDetail.shot_number,
      });
      setShowShotSelector(true);
      // 如果镜头有预设提示词且当前提示词为空，填充
      if (shotDetail.prompt && !serializedPrompt.trim()) {
        if (promptEditorRef.current?.editor) {
          promptEditorRef.current.editor.commands.setContent('<p>' + shotDetail.prompt + '</p>');
        }
      }
      // 如果镜头有推荐模型，设置模型
      if (shotDetail.preferred_model) {
        const modelMatch = MODEL_OPTIONS.find(m => m.value === shotDetail.preferred_model);
        if (modelMatch) setModel(modelMatch.value);
      }
    }).catch((e) => {
      console.error('加载镜头信息失败:', e);
    });
  }, [shotIdParam]);

  const handleShotSelect = useCallback((shot: Shot | null, meta?: { projectCode?: string; episodeNumber?: number; shotNumber?: number }) => {
    setSelectedShot(shot);
    setShotMeta(meta || null);
    // 如果镜头有预设提示词且当前提示词为空，提示填充
    if (shot?.prompt && !serializedPrompt.trim()) {
      // Set content in Tiptap editor
      if (promptEditorRef.current?.editor) {
        promptEditorRef.current.editor.commands.setContent(`<p>${shot.prompt}</p>`);
      }
    }
    // 如果镜头有推荐模型，预选
    if (shot?.preferred_model) {
      const modelValue = shot.preferred_model as any;
      setModel(modelValue);
    }
  }, [serializedPrompt]);

  const handleGenerate = useCallback(async () => {
    if (!serializedPrompt.trim() && images.length === 0) return;
    if (generation.status === 'generating') return;

    setGeneration({
      status: 'generating',
      progress: '正在提交视频生成请求...',
    });

    try {
      const result = await generateVideo(
        {
          prompt: serializedPrompt,
          model,
          ratio,
          duration,
          files: images.map((img) => img.file),
          audioFiles: audioFiles.map((a) => a.file),
          shotId: selectedShot?.id,
        },
        (progress) => {
          setGeneration((prev) => ({ ...prev, progress }));
        }
      );

      if (result.data && result.data.length > 0 && result.data[0].url) {
        setGeneration({ status: 'success', result });
        clearDraft();
      } else {
        setGeneration({
          status: 'error',
          error: '未获取到视频结果，请重试',
        });
      }
    } catch (error) {
      setGeneration({
        status: 'error',
        error: error instanceof Error ? error.message : '未知错误',
      });
    }
  }, [serializedPrompt, images, audioFiles, model, ratio, duration, generation.status, selectedShot]);

  const handleReset = () => {
    setEditorKey((k) => k + 1);
    setSerializedPrompt('');
    clearAllImages();
    setAudioFiles([]);
    setGeneration({ status: 'idle' });
    clearDraft();
  };

  const videoUrl =
    generation.status === 'success' && generation.result?.data?.[0]?.url
      ? generation.result.data[0].url
      : null;

  const revisedPrompt =
    generation.status === 'success'
      ? generation.result?.data?.[0]?.revised_prompt
      : undefined;

  const isGenerating = generation.status === 'generating';
  const canGenerate = (serializedPrompt.trim() || images.length > 0) && !isGenerating;

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden bg-[#0f111a] text-white relative">
      {/* Template loading overlay */}
      {templateLoading && (
        <div className="absolute inset-0 z-50 bg-[#0f111a]/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[#1c1f2e] border border-purple-500/30 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl shadow-purple-900/20">
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-purple-500/20"></div>
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
                <div className="absolute inset-2 rounded-full border-4 border-transparent border-b-indigo-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
              </div>
              <div className="text-center">
                <h3 className="text-white font-semibold text-lg mb-1">正在回传素材</h3>
                <p className="text-gray-400 text-sm">{templateLoadingMsg}</p>
              </div>
              <div className="w-full bg-gray-700/50 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full animate-loading-bar"></div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Mobile Header */}
      <div className="md:hidden sticky top-0 z-40 bg-[#0f111a]/95 backdrop-blur-sm px-4 py-3 flex items-center justify-between border-b border-gray-800">
        <h1 className="text-lg font-bold">{MODEL_OPTIONS.find(m => m.value === model)?.label || 'Seedance 2.0'}</h1>
        <button
          onClick={() => navigate('/settings')}
          className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <GearIcon className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Left Panel — Configuration */}
      <div className="flex-1 md:w-[520px] md:flex-none md:border-r border-gray-800 overflow-y-auto custom-scrollbar p-4 md:p-6 bg-[#0f111a]">
        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">{MODEL_OPTIONS.find(m => m.value === model)?.label || 'Seedance 2.0'} 视频配置</h2>
          <button
            onClick={() => navigate('/settings')}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            title="设置"
          >
            <GearIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Reference Images */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-bold text-gray-300">
                参考图片 (全能参考)
              </label>
              {images.length > 0 && (
                <button
                  onClick={clearAllImages}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  清除全部
                </button>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-3">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="relative group w-20 h-20 flex-shrink-0"
                  >
                    <img
                      src={img.previewUrl}
                      alt={`参考图 ${img.index}`}
                      className="w-full h-full object-cover rounded-xl border border-gray-700"
                    />
                    <span className="absolute bottom-0 left-0 bg-black/70 text-[10px] text-purple-400 px-1.5 py-0.5 rounded-br-xl rounded-tl-xl font-medium">
                      @图{img.index}
                    </span>
                    <button
                      onClick={() => removeImage(img.id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 hover:border-red-600"
                    >
                      <CloseIcon className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload zone */}
            {images.length < maxImages && (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addFiles(e.dataTransfer.files);
                }}
                className={`w-full ${
                  images.length === 0 ? 'h-40 md:h-52' : 'h-24'
                } border border-dashed border-gray-700 rounded-2xl flex flex-col items-center justify-center bg-[#1c1f2e] cursor-pointer hover:border-purple-500/50 hover:bg-[#25293d] transition-all`}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="p-2 bg-gray-800 rounded-lg text-gray-400">
                    <PlusIcon className="w-6 h-6" />
                  </div>
                  <span className="text-xs text-gray-500">
                    {images.length === 0
                      ? `点击或拖拽上传参考图（可选，最多 ${maxImages} 张）`
                      : `继续添加（${images.length}/${maxImages}）`}
                  </span>
                  {images.length === 0 && (
                    <span className="text-[10px] text-gray-600">
                      不上传则为纯文生视频
                    </span>
                  )}
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          {/* Audio Upload */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-bold text-gray-300">
                参考音频 (可选，最多 {maxAudios} 个)
              </label>
              {audioFiles.length > 0 && (
                <button
                  onClick={() => setAudioFiles([])}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  清除全部
                </button>
              )}
            </div>

            {audioFiles.length > 0 && (
              <div className="flex flex-col gap-2 mb-3">
                {audioFiles.map((aud) => (
                  <div
                    key={aud.id}
                    className="flex items-center gap-3 bg-[#1c1f2e] border border-gray-700 rounded-xl px-3 py-2 group"
                  >
                    <svg className="w-5 h-5 text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                    <span className="text-sm text-gray-300 truncate flex-1">{aud.name}</span>
                    <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded font-medium">@音频{aud.index}</span>
                    <button
                      onClick={() => removeAudio(aud.id)}
                      className="w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                    >
                      <CloseIcon className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {audioFiles.length < maxAudios && (
              <div
                onClick={() => audioInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addAudioFiles(e.dataTransfer.files);
                }}
                className="w-full h-16 border border-dashed border-gray-700 rounded-2xl flex items-center justify-center bg-[#1c1f2e] cursor-pointer hover:border-purple-500/50 hover:bg-[#25293d] transition-all"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-gray-800 rounded-lg text-gray-400">
                    <PlusIcon className="w-4 h-4" />
                  </div>
                  <span className="text-xs text-gray-500">
                    {audioFiles.length === 0
                      ? '点击或拖拽上传音频（MP3/WAV）'
                      : `继续添加（${audioFiles.length}/${maxAudios}）`}
                  </span>
                </div>
              </div>
            )}

            <input
              ref={audioInputRef}
              type="file"
              accept="audio/mpeg,.mp3,audio/wav,.wav"
              multiple
              className="hidden"
              onChange={(e) => {
                addAudioFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          {/* Prompt Editor */}
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

          {/* Shot Selector */}
          <div className="bg-[#1c1f2e] rounded-2xl border border-gray-800 overflow-hidden">
            <button
              onClick={() => setShowShotSelector(!showShotSelector)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300 hover:bg-[#25293d] transition-colors"
            >
              <span className="font-bold">
                {selectedShot
                  ? `已关联：${shotMeta?.projectCode || '?'}-${shotMeta?.episodeNumber}-${shotMeta?.shotNumber}`
                  : '关联镜头（可选）'}
              </span>
              <span className="text-gray-500">{showShotSelector ? '▲' : '▼'}</span>
            </button>
            {showShotSelector && (
              <div className="px-4 pb-4">
                <ShotSelector
                  projects={projects}
                  onShotSelect={handleShotSelect}
                />
                {selectedShot && shotMeta?.projectCode && (
                  <div className="mt-2 text-xs text-blue-400">
                    文件名预览：{shotMeta.projectCode}-{shotMeta.episodeNumber}-{shotMeta.shotNumber}-?-昵称.mp4
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="bg-[#1c1f2e] rounded-2xl p-4 border border-gray-800 space-y-5">
            {/* Model Selection */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-3">
                选择模型
              </label>
              <div className="flex flex-col gap-2">
                {MODEL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setModel(opt.value)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                      model === opt.value
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-gray-700 bg-[#161824] hover:border-gray-600'
                    }`}
                  >
                    <div className={`text-sm font-medium ${
                      model === opt.value ? 'text-purple-400' : 'text-gray-300'
                    }`}>
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Reference Mode */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-3">
                参考模式
              </label>
              <div className="flex gap-2">
                {REFERENCE_MODES.map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setReferenceMode(mode)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                      referenceMode === mode
                        ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                        : 'border-gray-700 bg-[#161824] text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-3">
                画面比例
              </label>
              <div className="grid grid-cols-6 gap-2">
                {RATIO_OPTIONS.map((opt) => {
                  const isSelected = opt.value === ratio;
                  const maxDim = 24;
                  const scale =
                    maxDim / Math.max(opt.widthRatio, opt.heightRatio);
                  const w = Math.round(opt.widthRatio * scale);
                  const h = Math.round(opt.heightRatio * scale);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setRatio(opt.value)}
                      className={`flex flex-col items-center gap-1.5 py-2 rounded-lg border transition-all ${
                        isSelected
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-gray-700 bg-[#161824] hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-center w-8 h-8">
                        <div
                          className={`rounded-sm border ${
                            isSelected
                              ? 'border-purple-400'
                              : 'border-gray-500'
                          }`}
                          style={{ width: `${w}px`, height: `${h}px` }}
                        />
                      </div>
                      <span
                        className={`text-[11px] ${
                          isSelected ? 'text-purple-400' : 'text-gray-400'
                        }`}
                      >
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-3">
                视频时长
              </label>
              <div className="flex flex-wrap gap-2">
                {DURATION_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                      duration === d
                        ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                        : 'border-gray-700 bg-[#161824] text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {d}秒
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Generate Section */}
          <div className="pb-6 md:pb-4">
            {/* Progress */}
            {isGenerating && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{generation.progress || '处理中...'}</span>
                </div>
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full animate-progress" />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    生成中...
                  </>
                ) : (
                  <>
                    <SparkleIcon className="w-4 h-4" />
                    生成视频
                  </>
                )}
              </button>
              <button
                onClick={handleReset}
                disabled={isGenerating}
                className="px-6 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold py-3.5 rounded-xl transition-all"
              >
                重置
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel — Result */}
      <div className="flex-1 bg-[#090a0f] overflow-y-auto flex flex-col">
        <VideoPlayer
          videoUrl={videoUrl}
          revisedPrompt={revisedPrompt}
          isLoading={isGenerating}
          error={generation.status === 'error' ? generation.error : undefined}
          progress={generation.progress}
        />
      </div>
    </div>
  );
}
