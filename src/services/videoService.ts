import type { GenerateVideoRequest, VideoGenerationResponse } from '../types';
import { getAuthHeaders } from './authService';

export async function generateVideo(
  request: GenerateVideoRequest & { preUploadedUris?: Record<number, string> },
  onProgress?: (message: string) => void,
  signal?: AbortSignal
): Promise<VideoGenerationResponse> {
  const formData = new FormData();
  formData.append('prompt', request.prompt);
  formData.append('model', request.model);
  formData.append('ratio', request.ratio);
  formData.append('duration', String(request.duration));

  const preUploaded = request.preUploadedUris || {};
  const preUploadedIndices: number[] = [];
  const preUploadedUriList: string[] = [];

  for (let i = 0; i < request.files.length; i++) {
    if (preUploaded[i]) {
      preUploadedIndices.push(i);
      preUploadedUriList.push(preUploaded[i]);
    } else {
      formData.append('files', request.files[i]);
    }
  }

  if (preUploadedUriList.length > 0) {
    formData.append('preUploadedUris', JSON.stringify(preUploadedUriList));
    formData.append('preUploadedIndices', JSON.stringify(preUploadedIndices));
  }

  for (const file of request.audioFiles ?? []) {
    formData.append('audioFiles', file);
  }

  if (request.shotId) {
    formData.append('shotId', String(request.shotId));
  }

  // 第1步: 提交任务
  onProgress?.('正在提交视频生成请求...');
  const submitRes = await fetch('/api/generate-video', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
    signal,
  });

  const submitData = await submitRes.json();
  if (!submitRes.ok) {
    throw new Error(submitData.error || `提交失败 (HTTP ${submitRes.status})`);
  }

  const { taskId } = submitData;
  if (!taskId) {
    throw new Error('服务器未返回任务ID');
  }


  // Save generation state to localStorage for resume on page refresh
  if (request.shotId) {
    localStorage.setItem("generating_shot_" + request.shotId, JSON.stringify({
      taskId, dbTaskId: submitData.dbTaskId, startTime: Date.now()
    }));
  }
  // 第2步: 轮询获取结果
  onProgress?.('已提交，等待AI生成视频...');

  const maxPollTime = 180 * 60 * 1000; // 3 小时
  const pollInterval = 10000; // 10 秒
  const startTime = Date.now();

  while (Date.now() - startTime < maxPollTime) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, pollInterval);
      if (signal) signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason || new DOMException('Aborted', 'AbortError')); }, { once: true });
    });

    const pollRes = await fetch(`/api/task/${taskId}`, { headers: getAuthHeaders(), signal });
    const pollData = await pollRes.json();

    if (pollData.status === 'done') {
      const result = pollData.result;
      if (result?.data?.[0]?.url) {
        if (request.shotId) localStorage.removeItem("generating_shot_" + request.shotId);
        return result;
      }
      if (request.shotId) localStorage.removeItem("generating_shot_" + request.shotId);
      throw new Error('未获取到视频结果');
    }

    if (pollData.status === 'error') {
      if (request.shotId) localStorage.removeItem("generating_shot_" + request.shotId);
      throw new Error(pollData.error || '视频生成失败');
    }

    if (pollData.progress) {
      onProgress?.(pollData.progress);
    }
  }

  if (request.shotId) localStorage.removeItem("generating_shot_" + request.shotId);
  throw new Error('视频生成超时，请稍后重试');
}

export async function preUploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/upload-image', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || '图片预上传失败');
  }
  return data.imageUri;
}
