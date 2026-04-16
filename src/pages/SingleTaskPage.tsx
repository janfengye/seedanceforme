import { useState, useCallback, useRef } from 'react';
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
import { getProjects } from '../services/projectService';
import ShotSelector from '../components/ShotSelector';
import type { Project, Shot } from '../types/index';
import VideoPlayer from '../components/VideoPlayer';
import { GearIcon, PlusIcon, CloseIcon, SparkleIcon } from '../components/Icons';
import { useNavigate } from 'react-router-dom';

let nextId = 0;

export default function SingleTaskPage() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [audioFiles, setAudioFiles] = useState<UploadedAudio[]>([]);
  const [prompt, setPrompt] = useState('');
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showAtMenu, setShowAtMenu] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const [shotMeta, setShotMeta] = useState<{ projectCode?: string; episodeNumber?: number; shotNumber?: number } | null>(null);
  const [showShotSelector, setShowShotSelector] = useState(false);
  const [atCursorPos, setAtCursorPos] = useState(0);
  const [atSelectedIndex, setAtSelectedIndex] = useState(0);

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

  const handleShotSelect = useCallback((shot: Shot | null, meta?: { projectCode?: string; episodeNumber?: number; shotNumber?: number }) => {
    setSelectedShot(shot);
    setShotMeta(meta || null);
    // 如果镜头有预设提示词且当前提示词为空，提示填充
    if (shot?.prompt && !prompt.trim()) {
      setPrompt(shot.prompt);
    }
    // 如果镜头有推荐模型，预选
    if (shot?.preferred_model) {
      const modelValue = shot.preferred_model as any;
      setModel(modelValue);
    }
  }, [prompt]);

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setPrompt(value);

    // Check if user just typed '@'
    if ((images.length > 0 || audioFiles.length > 0) && cursorPos > 0 && value[cursorPos - 1] === '@') {
      setAtCursorPos(cursorPos);
      setAtSelectedIndex(0);
      setShowAtMenu(true);
    } else {
      setShowAtMenu(false);
    }
  }, [images.length, audioFiles.length]);

  const atMenuItems = [...images.map((img) => ({ type: 'image' as const, index: img.index, label: `@${img.index}`, sublabel: `参考图 ${img.index}`, id: img.id, previewUrl: img.previewUrl })), ...audioFiles.map((aud) => ({ type: 'audio' as const, index: aud.index, label: `@Audio${aud.index}`, sublabel: aud.name, id: aud.id }))];

  const insertAtReferenceItem = useCallback((item: typeof atMenuItems[0]) => {
    const before = prompt.slice(0, atCursorPos);
    const after = prompt.slice(atCursorPos);
    const ref = item.type === 'audio' ? `Audio${item.index}` : String(item.index);
    setPrompt(before + ref + ' ' + after);
    setShowAtMenu(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [prompt, atCursorPos]);

  const handleAtMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showAtMenu || atMenuItems.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAtSelectedIndex((prev) => (prev + 1) % atMenuItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAtSelectedIndex((prev) => (prev - 1 + atMenuItems.length) % atMenuItems.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertAtReferenceItem(atMenuItems[atSelectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowAtMenu(false);
    }
  }, [showAtMenu, atMenuItems, atSelectedIndex, insertAtReferenceItem]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() && images.length === 0) return;
    if (generation.status === 'generating') return;

    setGeneration({
      status: 'generating',
      progress: '正在提交视频生成请求...',
    });

    try {
      const result = await generateVideo(
        {
          prompt,
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
  }, [prompt, images, audioFiles, model, ratio, duration, generation.status]);

  const handleReset = () => {
    setPrompt('');
    clearAllImages();
    setAudioFiles([]);
    setGeneration({ status: 'idle' });
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
  const canGenerate = (prompt.trim() || images.length > 0) && !isGenerating;

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden bg-[#0f111a] text-white">
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
                      @{img.index}
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
                    <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded font-medium">@Audio{aud.index}</span>
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

          {/* Prompt */}
          <div className="bg-[#1c1f2e] rounded-2xl p-4 border border-gray-800 relative">
            <label className="block text-sm font-bold mb-3 text-gray-300">
              提示词
            </label>
            <textarea
              ref={textareaRef}
              className="w-full bg-transparent text-sm resize-none focus:outline-none min-h-[100px] placeholder-gray-600 text-gray-200 leading-relaxed"
              placeholder="描述你想要生成的视频场景。上传参考图后可使用 @1、@2 等引用图片，例如：@1 作为首帧，@2 作为尾帧，模仿 @3 的动作..."
              value={prompt}
              onChange={handlePromptChange}
              onKeyDown={handleAtMenuKeyDown}
              onBlur={() => setTimeout(() => setShowAtMenu(false), 200)}
              maxLength={5000}
              disabled={isGenerating}
            />
            {/* @ Mention Popup */}
            {showAtMenu && atMenuItems.length > 0 && (
              <div className="absolute z-50 mt-1 bg-[#252838] border border-gray-600 rounded-xl shadow-2xl p-2 min-w-[200px]">
                {images.length > 0 && (
                  <div className="text-xs text-gray-400 px-2 py-1 mb-1">参考图片</div>
                )}
                {atMenuItems.map((item, idx) => (
                  <div key={item.id}>
                    {item.type === 'audio' && idx === images.length && audioFiles.length > 0 && (
                      <div className="text-xs text-gray-400 px-2 py-1 mt-1 mb-1">参考音频</div>
                    )}
                    <button
                      onMouseDown={(e) => { e.preventDefault(); insertAtReferenceItem(item); }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
                        idx === atSelectedIndex ? 'bg-purple-500/20' : 'hover:bg-purple-500/20'
                      }`}
                    >
                      {item.type === 'image' && item.previewUrl ? (
                        <img src={item.previewUrl} alt="" className="w-8 h-8 object-cover rounded" />
                      ) : (
                        <svg className="w-8 h-8 text-purple-400 p-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                      )}
                      <span className="text-sm text-purple-400 font-medium">{item.label}</span>
                      <span className="text-xs text-gray-500 truncate">{item.sublabel}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="text-right text-xs text-gray-500 mt-2">
              {prompt.length}/5000
            </div>
          </div>

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
