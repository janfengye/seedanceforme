import type { Project, Task, TaskKind, ApiResponse, Episode, Shot, EpisodeWithShots, ShotVersion } from '../types/index';
import { getAuthHeaders } from './authService';

const API_BASE = '/api';

export interface GetProjectTasksOptions {
  status?: string;
  taskKind?: TaskKind;
}

/**
 * 获取所有项目
 */
export async function getProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE}/projects`, {
    headers: getAuthHeaders(),
  });
  const result: ApiResponse<Project[]> = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取项目列表失败');
  }
  return result.data || [];
}

/**
 * 获取项目详情
 */
export async function getProject(id: number): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects/${id}`, {
    headers: getAuthHeaders(),
  });
  const result: ApiResponse<Project> = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取项目详情失败');
  }
  return result.data!;
}

/**
 * 创建项目
 */
export async function createProject(
  name: string,
  description?: string,
  settings?: Record<string, any>,
  code?: string
): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name, description, settings, code }),
  });
  const result: ApiResponse<Project> = await response.json();
  if (!result.success) {
    throw new Error(result.error || '创建项目失败');
  }
  return result.data!;
}

/**
 * 更新项目
 */
export async function updateProject(
  id: number,
  data: {
    name?: string;
    description?: string;
    settings?: Record<string, any>;
    code?: string;
    video_save_path?: string;
    default_concurrent?: number;
    default_min_interval?: number;
    default_max_interval?: number;
  }
): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  const result: ApiResponse<Project> = await response.json();
  if (!result.success) {
    throw new Error(result.error || '更新项目失败');
  }
  return result.data!;
}

/**
 * 删除项目
 */
export async function deleteProject(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const result: ApiResponse = await response.json();
  if (!result.success) {
    throw new Error(result.error || '删除项目失败');
  }
}

/**
 * 获取项目下的任务列表
 */
export async function getProjectTasks(
  id: number,
  options: GetProjectTasksOptions = {}
): Promise<Task[]> {
  const url = new URL(`${API_BASE}/projects/${id}/tasks`, window.location.origin);
  if (options.status) {
    url.searchParams.set('status', options.status);
  }
  if (options.taskKind) {
    url.searchParams.set('taskKind', options.taskKind);
  }
  const response = await fetch(`${url.pathname}${url.search}`, {
    headers: getAuthHeaders(),
  });
  const result: ApiResponse<Task[]> = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取任务列表失败');
  }
  return result.data || [];
}

// ============================================================
// Episodes API
// ============================================================

export async function getEpisodes(projectId: number): Promise<Episode[]> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/episodes`, {
    headers: getAuthHeaders(),
  });
  const result: ApiResponse<Episode[]> = await response.json();
  if (!result.success) throw new Error(result.error || '获取集列表失败');
  return result.data || [];
}

export async function createEpisode(projectId: number, data: {
  episode_number?: number; title?: string; description?: string;
}): Promise<Episode> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/episodes`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  const result: ApiResponse<Episode> = await response.json();
  if (!result.success) throw new Error(result.error || '创建集失败');
  return result.data!;
}

export async function updateEpisode(id: number, data: {
  episode_number?: number; title?: string; description?: string;
}): Promise<Episode> {
  const response = await fetch(`${API_BASE}/episodes/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  const result: ApiResponse<Episode> = await response.json();
  if (!result.success) throw new Error(result.error || '更新集失败');
  return result.data!;
}

export async function deleteEpisode(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/episodes/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const result: ApiResponse = await response.json();
  if (!result.success) throw new Error(result.error || '删除集失败');
}

// ============================================================
// Shots API
// ============================================================

export async function getShots(episodeId: number): Promise<Shot[]> {
  const response = await fetch(`${API_BASE}/episodes/${episodeId}/shots`, {
    headers: getAuthHeaders(),
  });
  const result: ApiResponse<Shot[]> = await response.json();
  if (!result.success) throw new Error(result.error || '获取镜头列表失败');
  return result.data || [];
}

export async function getShotTree(projectId: number): Promise<EpisodeWithShots[]> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/shot-tree`, {
    headers: getAuthHeaders(),
  });
  const result: ApiResponse<EpisodeWithShots[]> = await response.json();
  if (!result.success) throw new Error(result.error || '获取镜头树失败');
  return result.data || [];
}

export async function getShotVersions(shotId: number): Promise<ShotVersion[]> {
  const response = await fetch(`${API_BASE}/shots/${shotId}/versions`, {
    headers: getAuthHeaders(),
  });
  const result: ApiResponse<ShotVersion[]> = await response.json();
  if (!result.success) throw new Error(result.error || '获取版本列表失败');
  return result.data || [];
}

export async function createShot(episodeId: number, data: {
  shot_number?: number; description?: string; prompt?: string;
  reference_image_url?: string; preferred_model?: string;
}): Promise<Shot> {
  const response = await fetch(`${API_BASE}/episodes/${episodeId}/shots`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  const result: ApiResponse<Shot> = await response.json();
  if (!result.success) throw new Error(result.error || '创建镜头失败');
  return result.data!;
}

export async function updateShot(id: number, data: {
  shot_number?: number; description?: string; prompt?: string;
  reference_image_url?: string; preferred_model?: string; status?: string;
}): Promise<Shot> {
  const response = await fetch(`${API_BASE}/shots/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  const result: ApiResponse<Shot> = await response.json();
  if (!result.success) throw new Error(result.error || '更新镜头失败');
  return result.data!;
}

export async function deleteShot(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/shots/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const result: ApiResponse = await response.json();
  if (!result.success) throw new Error(result.error || '删除镜头失败');
}

export interface ShotDetail extends Shot {
  episode_number?: number;
  project_id?: number;
  project_code?: string;
}

export async function getShot(id: number): Promise<ShotDetail> {
  const response = await fetch(`${API_BASE}/shots/${id}`, {
    headers: getAuthHeaders(),
  });
  const result: ApiResponse<ShotDetail> = await response.json();
  if (!result.success) throw new Error(result.error || '获取镜头详情失败');
  return result.data!;
}

// ============================================================
// Shot Drafts API
// ============================================================

export interface ShotDraftData {
  id: number;
  shot_id: number;
  user_id: number;
  prompt: string;
  tiptap_json: string | null;
  model: string;
  ratio: string;
  duration: string;
  reference_mode: string;
  files: ShotDraftFileData[];
}

export interface ShotDraftFileData {
  id: string;
  draft_id: number;
  original_name: string;
  mime_type: string;
  size: number;
  file_type: string;
  disk_path: string;
}

export async function getShotDraft(shotId: number): Promise<ShotDraftData | null> {
  const response = await fetch(`${API_BASE}/shots/${shotId}/draft`, {
    headers: getAuthHeaders(),
  });
  const result: ApiResponse<ShotDraftData | null> = await response.json();
  if (!result.success) throw new Error(result.error || '获取草稿失败');
  return result.data ?? null;
}

export async function saveShotDraft(shotId: number, data: {
  prompt: string;
  tiptapJson: any;
  model: string;
  ratio: string;
  duration: string;
  referenceMode: string;
}): Promise<ShotDraftData> {
  const response = await fetch(`${API_BASE}/shots/${shotId}/draft`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  const result: ApiResponse<ShotDraftData> = await response.json();
  if (!result.success) throw new Error(result.error || '保存草稿失败');
  return result.data!;
}

export async function deleteShotDraft(shotId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/shots/${shotId}/draft`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const result: ApiResponse = await response.json();
  if (!result.success) throw new Error(result.error || '删除草稿失败');
}

export async function uploadShotDraftFile(shotId: number, fileId: string, file: File, fileType: string): Promise<ShotDraftFileData> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('fileId', fileId);
  formData.append('fileType', fileType);

  const response = await fetch(`${API_BASE}/shots/${shotId}/draft/files`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  const result: ApiResponse<ShotDraftFileData> = await response.json();
  if (!result.success) throw new Error(result.error || '上传草稿文件失败');
  return result.data!;
}

export async function downloadShotDraftFile(fileId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}/shot-draft-files/${fileId}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('下载草稿文件失败');
  return response.blob();
}

export async function deleteShotDraftFile(fileId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/shot-draft-files/${fileId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const result: ApiResponse = await response.json();
  if (!result.success) throw new Error(result.error || '删除草稿文件失败');
}

export default {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectTasks,
  getEpisodes,
  createEpisode,
  updateEpisode,
  deleteEpisode,
  getShots,
  getShotTree,
  getShotVersions,
  createShot,
  updateShot,
  deleteShot,
  getShot,
  getShotDraft,
  saveShotDraft,
  deleteShotDraft,
  uploadShotDraftFile,
  downloadShotDraftFile,
  deleteShotDraftFile,
};
