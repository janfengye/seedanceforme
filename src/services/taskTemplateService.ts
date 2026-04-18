import { getAuthHeaders } from './authService';
import type { ModelId, AspectRatio, Duration, UploadedImage, UploadedAudio } from '../types/index';

interface TaskConfig {
  prompt: string;
  model: string;
  ratio: string;
  duration: number;
  shotId?: number | null;
  assets: Array<{
    type: 'image' | 'audio';
    index: number;
    filename: string;
    originalname: string;
    mimetype: string;
  }>;
}

let templateNextId = 1000;

export interface TaskTemplate {
  prompt: string;
  model: ModelId;
  ratio: AspectRatio;
  duration: Duration;
  shotId?: number | null;
  images: UploadedImage[];
  audioFiles: UploadedAudio[];
}

/**
 * Load from local config + asset files
 */
async function loadLocalTemplate(taskId: number): Promise<TaskTemplate | null> {
  const configRes = await fetch(`/api/tasks/${taskId}/config`, {
    headers: getAuthHeaders(),
  });
  if (!configRes.ok) return null;
  const { config } = await configRes.json() as { config: TaskConfig };

  const images: UploadedImage[] = [];
  const audioFiles: UploadedAudio[] = [];

  for (let i = 0; i < config.assets.length; i++) {
    const asset = config.assets[i];
    try {
      const fileRes = await fetch(`/api/tasks/${taskId}/asset-file/${i}`, {
        headers: getAuthHeaders(),
      });
      if (!fileRes.ok) continue;

      const blob = await fileRes.blob();
      const file = new File([blob], asset.originalname, { type: asset.mimetype });

      if (asset.type === 'image') {
        images.push({
          id: `tpl-img-${++templateNextId}`,
          file,
          previewUrl: URL.createObjectURL(blob),
          index: images.length + 1,
        });
      } else {
        audioFiles.push({
          id: `tpl-aud-${++templateNextId}`,
          file,
          name: asset.originalname,
          index: audioFiles.length + 1,
        });
      }
    } catch {
      console.warn(`Failed to load asset ${i} for task ${taskId}`);
    }
  }

  return {
    prompt: config.prompt,
    model: config.model as ModelId,
    ratio: config.ratio as AspectRatio,
    duration: config.duration as Duration,
    shotId: config.shotId,
    images,
    audioFiles,
  };
}

interface RemoteAsset {
  type: 'image' | 'audio';
  index: number;
  cdnUrl: string;
  uri: string;
  width?: number;
  height?: number;
  name?: string;
}

interface RemoteConfig {
  prompt: string;
  model: string;
  ratio: string;
  duration: number;
  assets: RemoteAsset[];
  shotId?: number | null;
}

/**
 * Load from jimeng CDN (no local files, uses CDN URLs directly)
 */
async function loadRemoteTemplate(taskId: number, onProgress?: (msg: string) => void): Promise<TaskTemplate | null> {
  onProgress?.('正在从即梦获取任务信息...');
  const res = await fetch(`/api/tasks/${taskId}/remote-config`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return null;
  const { data } = await res.json() as { data: RemoteConfig };
  onProgress?.(`找到 ${data.assets.length} 个素材，开始下载...`);

  const images: UploadedImage[] = [];
  const audioFiles: UploadedAudio[] = [];

  for (const asset of data.assets) {
    if (!asset.cdnUrl) continue;

    if (asset.type === 'image') {
      try {
        onProgress?.(`正在下载图片 ${images.length + 1}/${data.assets.filter(a => a.type === 'image').length}...`);
        // Fetch image from CDN to create a File object for upload
        const imgRes = await fetch(`/api/video-proxy?url=${encodeURIComponent(asset.cdnUrl)}`);
        if (!imgRes.ok) {
          // Fallback: use CDN URL as preview only (can't re-upload)
          images.push({
            id: `cdn-img-${++templateNextId}`,
            file: new File([], `image_${asset.index}.jpg`),
            previewUrl: asset.cdnUrl,
            index: images.length + 1,
            cdnUri: asset.uri,
          });
          continue;
        }
        const blob = await imgRes.blob();
        const ext = blob.type.includes('png') ? 'png' : 'jpg';
        const file = new File([blob], `image_${asset.index}.${ext}`, { type: blob.type || 'image/jpeg' });
        images.push({
          id: `cdn-img-${++templateNextId}`,
          file,
          previewUrl: URL.createObjectURL(blob),
          index: images.length + 1,
          cdnUri: asset.uri,
        });
      } catch {
        console.warn(`Failed to load CDN image ${asset.index}`);
      }
    } else if (asset.type === 'audio') {
      try {
        onProgress?.(`正在下载音频 ${audioFiles.length + 1}...`);
        const audRes = await fetch(`/api/video-proxy?url=${encodeURIComponent(asset.cdnUrl)}`);
        if (!audRes.ok) continue;
        const blob = await audRes.blob();
        const file = new File([blob], asset.name || `audio_${asset.index}.mp3`, { type: blob.type || 'audio/mpeg' });
        audioFiles.push({
          id: `cdn-aud-${++templateNextId}`,
          file,
          name: asset.name || `audio_${asset.index}.mp3`,
          index: audioFiles.length + 1,
        });
      } catch {
        console.warn(`Failed to load CDN audio ${asset.index}`);
      }
    }
  }

  return {
    prompt: data.prompt,
    model: data.model as ModelId,
    ratio: data.ratio as AspectRatio,
    duration: data.duration as Duration,
    shotId: data.shotId,
    images,
    audioFiles,
  };
}

/**
 * Load task template: try local first, then fall back to jimeng CDN
 */
export async function loadTaskTemplate(taskId: number, onProgress?: (msg: string) => void): Promise<TaskTemplate | null> {
  try {
    // Try local config + assets first
    onProgress?.('正在加载本地素材...');
    const local = await loadLocalTemplate(taskId);
    if (local && local.images.length > 0) {
      // Local has images, use it directly
      console.log(`[template] 使用本地素材 (task ${taskId}, ${local.images.length} images)`);
      return local;
    }

    // Try remote: fetch from jimeng CDN
    console.log(`[template] 尝试从即梦CDN获取素材 (task ${taskId})`);
    try {
      const remote = await loadRemoteTemplate(taskId, onProgress);
      if (remote) {
        // If local had prompt/model but no images, merge local config with remote assets
        if (local && local.prompt && !remote.prompt) {
          remote.prompt = local.prompt;
        }
        onProgress?.(`素材加载完成！${remote.images.length} 张图片，${remote.audioFiles.length} 个音频`);
        console.log(`[template] 从即梦CDN获取成功 (${remote.images.length} images, ${remote.audioFiles.length} audio)`);
        return remote;
      }
    } catch (e) {
      console.warn(`[template] 即梦CDN获取失败:`, e);
    }

    // Fall back to local if available (has prompt but no images)
    if (local) {
      console.log(`[template] 使用本地配置（无素材）(task ${taskId})`);
      return local;
    }

    return null;
  } catch (e) {
    console.error('Failed to load task template:', e);
    return null;
  }
}
